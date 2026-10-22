"""Turn the opening video into scroll-scrub frame sequences.

Usage:
  python3 -I scripts/build_frames.py <video> [--start N] [--end N] [--full | --no-full]
                                   [--max 120] [--dial X,Y] [--mobile-x X] [--budget-mb 7.8] [--dry-run]

What it does
1. Reads the video once at thumbnail size, finds hard cuts, and looks for one full 360 degree
   turn inside the first continuous shot. It compares the edges in the middle of every frame
   (where the watch is) with frame <start>, so a still table or wall around the watch does not
   hide the turn. The turn ends at the first frame that matches frame <start> again after the
   picture has moved far away from it. A still lead-in (4+ identical frames) is skipped.
   A camera that moves away and comes back to the same picture also looks like a turn:
   check the printed range, and use --no-full if it is wrong.
2. Picks up to --max frames evenly across that one turn (or across the first shot when there is
   no turn) and writes:
     public/assets/hero/<version>/d/NNNN.webp   desktop, 16:9 up to 1600 px wide
                                                (a tall phone video gets soft blurred sides)
     public/assets/hero/<version>/m/NNNN.webp   phone, 9:16 up to 900 px wide
     public/assets/hero/<version>/lineart-{d,m}.webp   thin-line drawing of frame 0 (loader)
     public/assets/hero/<version>/loop-{d,m}.{mp4,webm}  small silent loop for slow connections
   WebP quality steps down until both sets together fit --budget-mb (default 7.8 MB).
   <version> is a hash of the video and the settings, so new frames always get new URLs.
3. Writes src/data/hero-manifest.json, which the page reads at build time.

Overrides
  --start/--end  frame numbers in the source (as printed by --dry-run).
  --full         treat --start..--end as one full turn (the frame after --end looks like --start).
  --no-full      treat the range as a plain camera move (the page then shows % instead of degrees).
  --dial X,Y     where the dial centre is in the source frame (0..1); used to zoom "into the dial".
  --mobile-x X   moves the phone crop centre (0..1) for wide videos.
Phone videos are fine as they are (vertical, rotated, HEVC, HDR): the size is read from the
decoded picture and HDR is tone-mapped to normal colours.
"""
import argparse, hashlib, io, json, os, shutil, subprocess, sys, tempfile
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HERO = os.path.join(ROOT, 'public', 'assets', 'hero')
CREAM = (244, 238, 226)

ap = argparse.ArgumentParser(description='Build the opening frame sequences from a video.')
ap.add_argument('video')
ap.add_argument('--start', type=int)
ap.add_argument('--end', type=int)
grp = ap.add_mutually_exclusive_group()
grp.add_argument('--full', dest='force', action='store_const', const=True, help='range is one full turn')
grp.add_argument('--no-full', dest='force', action='store_const', const=False, help='range is not a turn')
ap.add_argument('--max', type=int, default=120, help='most frames per set (the brief allows about 150)')
ap.add_argument('--dial', default='0.5,0.45')
ap.add_argument('--mobile-x', type=float, default=0.5)
ap.add_argument('--qd', type=int, default=64, help='desktop WebP quality to start from')
ap.add_argument('--qm', type=int, default=68, help='phone WebP quality to start from')
ap.add_argument('--budget-mb', type=float, default=7.8, help='desktop + phone frames together')
ap.add_argument('--dry-run', action='store_true', help='only print the analysis')
args = ap.parse_args()


def run(cmd):
    subprocess.run(cmd, check=True)


def out(cmd):
    return subprocess.run(cmd, check=True, capture_output=True).stdout


tmp = tempfile.mkdtemp(prefix='frames-')
try:
    # ---------- source facts (size after rotation, HDR) ----------
    run(['ffmpeg', '-v', 'error', '-y', '-i', args.video, '-frames:v', '1', os.path.join(tmp, 'first.png')])
    W, H = Image.open(os.path.join(tmp, 'first.png')).size
    info = json.loads(out(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
                           'stream=r_frame_rate,color_transfer', '-of', 'json', args.video]))['streams'][0]
    num, den = info.get('r_frame_rate', '30/1').split('/')
    fps = float(num) / float(den or 1)
    hdr = info.get('color_transfer') in ('arib-std-b67', 'smpte2084')
    # iPhone HDR (HLG/PQ) -> normal colours; mobius keeps mid-tones close to the original brightness
    pre = ('zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=mobius:desat=0,'
           'zscale=t=bt709:m=bt709:r=tv,format=yuv420p,') if hdr else ''

    # ---------- pass 1: grey thumbnails of every frame ----------
    tw = 192
    th = max(2, int(round(tw * H / W / 2)) * 2)
    raw = out(['ffmpeg', '-v', 'error', '-i', args.video, '-map', '0:v:0', '-fps_mode', 'passthrough',
               '-vf', f'{pre}scale={tw}:{th}:flags=area,format=gray', '-f', 'rawvideo', '-'])
    n = len(raw) // (tw * th)
    if n < 2:
        sys.exit('The video has fewer than 2 frames.')
    T = np.frombuffer(raw, dtype=np.uint8)[: n * tw * th].reshape(n, th, tw).astype(np.float32) / 255.0

    diffs = np.abs(T[1:] - T[:-1]).mean(axis=(1, 2))
    med = float(np.median(diffs))
    cuts = [int(i) + 1 for i, d in enumerate(diffs) if d > max(0.08, 6 * med)]

    def feature(img):
        h, w = img.shape
        c = img[int(h * 0.1):int(h * 0.9), int(w * 0.2):int(w * 0.8)]
        c = (c[:-1, :-1] + c[1:, :-1] + c[:-1, 1:] + c[1:, 1:]) / 4  # soften noise
        g = np.hypot(np.diff(c, axis=1)[:-1, :], np.diff(c, axis=0)[:, :-1])
        g = g - g.mean()
        return (g / (np.linalg.norm(g) + 1e-9)).ravel()

    start = args.start if args.start is not None else 0
    if not 0 <= start < n:
        sys.exit(f'--start must be between 0 and {n - 1}')
    shot_end = next((c - 1 for c in cuts if c > start), n - 1)
    if args.start is None:  # skip a still lead-in (camera rolling before the turntable moves)
        still = 0
        while still < shot_end - 12 and float(np.abs(T[still + 1] - T[0]).mean()) < 0.002:
            still += 1
        if still >= 4:
            start = still
    F0 = feature(T[start])
    sims = np.array([float(feature(T[k]) @ F0) for k in range(start, shot_end + 1)])

    # furthest point, then the first return that wins back most of the way to the start picture
    lo = int(np.argmin(sims[3:])) + 3 if len(sims) > 6 else 0
    need = max(0.85, float(sims[lo]) + 0.8 * (1 - float(sims[lo])))
    back = None
    for k in range(lo + 1, len(sims)):
        if sims[k] >= need and sims[k] >= sims[max(k - 2, 0):k + 3].max() - 1e-6:
            back = k
            break
    detected = bool(back is not None and back >= 12 and sims[lo] <= 0.75)

    full = detected if args.force is None else args.force
    if args.end is not None:
        end = args.end
    elif detected and full:
        end = start + back - 1  # the matching frame closes the loop, do not repeat it
    else:
        end = shot_end
    if not start < end < n:
        sys.exit(f'Bad range {start}..{end} (the video has {n} frames).')

    span = list(range(start, end + 1))
    count = min(args.max, len(span))
    if full:  # spread evenly over the turn without duplicating the closing frame
        picks = [span[int(i * len(span) / count)] for i in range(count)]
    else:
        picks = [span[round(i * (len(span) - 1) / max(count - 1, 1))] for i in range(count)]

    report = {
        'source': {'width': W, 'height': H, 'fps': round(fps, 3), 'frames': n, 'hdr': hdr},
        'cuts': cuts, 'firstShot': [0 if args.start is None else args.start, shot_end],
        'turnDetected': detected, 'fullRotation': full, 'range': [start, end],
        'furthestFrame': start + lo, 'furthestSimilarity': round(float(sims[lo]), 3),
        'returnFrame': (start + back) if back is not None else None,
        'returnSimilarity': round(float(sims[back]), 3) if back is not None else None,
        'degreesPerSourceFrame': round(360 / (end - start + 1), 2) if full else None,
        'framesPerSet': count,
    }
    print(json.dumps(report, indent=2))
    if full:
        print(f'One full turn: source frames {start}..{end} ({end - start + 1} frames = 360 degrees).')
    else:
        print(f'No full 360 degree turn{" (forced)" if args.force is False else ""}: '
              f'using frames {start}..{end} as a camera move; the page will show % instead of degrees.')
    if args.dry_run:
        sys.exit(0)

    # ---------- pass 2: the picked frames at working size ----------
    s = min(1.0, 1600 / min(W, H))
    ew, eh = int(round(W * s / 2)) * 2, int(round(H * s / 2)) * 2
    sel = '+'.join(f'eq(n,{i})' for i in picks)
    src_dir = os.path.join(tmp, 'src')
    os.makedirs(src_dir)
    run(['ffmpeg', '-v', 'error', '-i', args.video, '-map', '0:v:0', '-fps_mode', 'passthrough',
         '-vf', f"{pre}select='{sel}',scale={ew}:{eh}:flags=lanczos", '-q:v', '2',
         os.path.join(src_dir, 's_%04d.jpg')])
    got = sorted(os.listdir(src_dir))
    if len(got) != count:
        sys.exit(f'Expected {count} frames from ffmpeg, got {len(got)}.')

    dial = [float(v) for v in args.dial.split(',')]
    landscape = ew / eh >= 1.25

    # desktop: keep wide videos as they are; tall or square ones go on a 16:9 canvas with soft sides
    if landscape:
        dw = min(1600, ew - ew % 2)
        dh = int(round(eh * dw / ew / 2)) * 2
        fgw, offx = dw, 0
        dial_d = dial
    else:
        dh = min(900, eh - eh % 2)
        dw = int(round(dh * 16 / 9 / 2)) * 2
        fgw = int(round(ew * dh / eh / 2)) * 2
        offx = (dw - fgw) // 2
        dial_d = [round((offx + dial[0] * fgw) / dw, 4), dial[1]]
    feather = Image.linear_gradient('L').rotate(90, expand=True).resize((max(2, fgw // 14), dh))

    def desktop(im):
        if landscape:
            return im.resize((dw, dh), Image.LANCZOS) if (dw, dh) != im.size else im
        bh = int(round(eh * dw / ew))
        bg = im.resize((dw, bh), Image.BILINEAR).crop((0, (bh - dh) // 2, dw, (bh - dh) // 2 + dh))
        bg = Image.blend(bg.filter(ImageFilter.GaussianBlur(28)), Image.new('RGB', (dw, dh), CREAM), 0.35)
        fg = im.resize((fgw, dh), Image.LANCZOS)
        mask = Image.new('L', (fgw, dh), 255)
        mask.paste(feather, (0, 0))  # soft left edge
        mask.paste(feather.transpose(Image.FLIP_LEFT_RIGHT), (fgw - feather.width, 0))  # soft right edge
        bg.paste(fg, (offx, 0), mask)
        return bg

    # phone: 9:16 crop (centre at --mobile-x for wide videos), up to 900 px wide
    if ew / eh > 9 / 16:
        cw, ch = int(round(eh * 9 / 16)), eh
        cx = min(max(int(round(args.mobile_x * ew - cw / 2)), 0), ew - cw)
        cy = 0
    else:
        cw, ch = ew, min(eh, int(round(ew * 16 / 9)))
        cx, cy = 0, (eh - ch) // 2
    mw = min(900, cw - cw % 2)
    mh = int(round(ch * mw / cw))
    dial_m = [round((dial[0] * ew - cx) / cw, 4), round((dial[1] * eh - cy) / ch, 4)]

    def phone(im):
        m = im.crop((cx, cy, cx + cw, cy + ch))
        return m.resize((mw, mh), Image.LANCZOS) if mw != cw else m

    work = os.path.join(tmp, 'work')
    os.makedirs(work)
    for idx, name in enumerate(got):
        im = Image.open(os.path.join(src_dir, name)).convert('RGB')
        desktop(im).save(os.path.join(work, f'd_{idx:04d}.jpg'), quality=95)
        phone(im).save(os.path.join(work, f'm_{idx:04d}.jpg'), quality=95)

    # ---------- quality that fits the byte budget ----------
    def webp_size(path, q):
        b = io.BytesIO()
        Image.open(path).save(b, 'WEBP', quality=q, method=6)
        return b.tell()

    budget = args.budget_mb * 1024 * 1024
    sample = list(range(0, count, max(1, count // 12)))
    step = 0
    while True:
        qd, qm = max(30, args.qd - step), max(30, args.qm - step)
        est = sum(webp_size(os.path.join(work, f'd_{i:04d}.jpg'), qd) + webp_size(os.path.join(work, f'm_{i:04d}.jpg'), qm)
                  for i in sample) * count / len(sample)
        if est <= budget * 0.96 or (qd == 30 and qm == 30):
            break
        step += 4

    # every video gets its own folder, so browsers can cache frames forever
    h = hashlib.sha1()
    with open(args.video, 'rb') as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b''):
            h.update(chunk)
    h.update(json.dumps([start, end, full, count, args.dial, args.mobile_x]).encode())
    version = h.hexdigest()[:8]
    if os.path.isdir(HERO):
        for old in os.listdir(HERO):
            target = os.path.join(HERO, old)
            shutil.rmtree(target, ignore_errors=True) if os.path.isdir(target) else os.remove(target)
    OUT = os.path.join(HERO, version)
    url = f'/assets/hero/{version}/'

    while True:
        for sub in ('d', 'm'):
            shutil.rmtree(os.path.join(OUT, sub), ignore_errors=True)
            os.makedirs(os.path.join(OUT, sub))
        for i in range(count):
            Image.open(os.path.join(work, f'd_{i:04d}.jpg')).save(os.path.join(OUT, 'd', f'{i:04d}.webp'), 'WEBP', quality=qd, method=6)
            Image.open(os.path.join(work, f'm_{i:04d}.jpg')).save(os.path.join(OUT, 'm', f'{i:04d}.webp'), 'WEBP', quality=qm, method=6)
        sizes = {sub: sum(os.path.getsize(os.path.join(OUT, sub, f)) for f in os.listdir(os.path.join(OUT, sub))) for sub in ('d', 'm')}
        if sizes['d'] + sizes['m'] <= budget or (qd == 30 and qm == 30):
            break
        qd, qm = max(30, qd - 4), max(30, qm - 4)
    if sizes['d'] + sizes['m'] > budget:
        print(f'Warning: frames are {(sizes["d"] + sizes["m"]) / 1048576:.1f} MB, over the budget; use a lower --max.')

    # ---------- thin-line drawing of frame 0 for the loader ----------
    def lineart(src, dst):
        edge = os.path.join(tmp, 'edge.png')
        run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-vf', 'edgedetect=low=0.08:high=0.2:mode=wires', edge])
        a = np.clip(np.asarray(Image.open(edge).convert('L'), dtype=np.float32) * 1.6, 0, 255).astype(np.uint8)
        rgba = np.zeros((a.shape[0], a.shape[1], 4), dtype=np.uint8)
        rgba[..., 0], rgba[..., 1], rgba[..., 2], rgba[..., 3] = 42, 31, 23, a
        Image.fromarray(rgba, 'RGBA').save(dst, 'WEBP', quality=80, method=6)

    lineart(os.path.join(work, 'd_0000.jpg'), os.path.join(OUT, 'lineart-d.webp'))
    lineart(os.path.join(work, 'm_0000.jpg'), os.path.join(OUT, 'lineart-m.webp'))

    # ---------- small silent loops for slow connections (a full turn loops; a camera move plays back and forth) ----------
    pingpong = '' if full else ',split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1:a=0'
    for sub, width in (('d', 960), ('m', 540)):
        mp4 = os.path.join(OUT, f'loop-{sub}.mp4')
        run(['ffmpeg', '-v', 'error', '-y', '-framerate', '24', '-i', os.path.join(work, f'{sub}_%04d.jpg'),
             '-filter_complex', f'[0:v]scale={width}:-2{pingpong}', '-c:v', 'libx264', '-preset', 'slow', '-crf', '30',
             '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', mp4])
        run(['ffmpeg', '-v', 'error', '-y', '-i', mp4, '-an', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '42',
             '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', os.path.join(OUT, f'loop-{sub}.webm')])

    manifest = {
        'version': version,
        'base': url,
        'count': count,
        'fullRotation': full,
        'sourceRange': [start, end],
        'desktop': {'w': dw, 'h': dh, 'bytes': sizes['d'], 'quality': qd},
        'mobile': {'w': mw, 'h': mh, 'bytes': sizes['m'], 'quality': qm},
        'dial': dial_d,
        'dialM': dial_m,
    }
    with open(os.path.join(ROOT, 'src', 'data', 'hero-manifest.json'), 'w') as f:
        json.dump(manifest, f, indent=2)
    print(json.dumps({'frames': count, 'desktopKB': sizes['d'] // 1024, 'mobileKB': sizes['m'] // 1024,
                      'totalMB': round((sizes['d'] + sizes['m']) / 1048576, 2),
                      'avgDesktopKB': round(sizes['d'] / count / 1024, 1), 'avgMobileKB': round(sizes['m'] / count / 1024, 1),
                      'quality': {'d': qd, 'm': qm}, 'folder': url}, indent=2))
finally:
    shutil.rmtree(tmp, ignore_errors=True)
