"""Turn the hero video into scroll-scrub frame sequences.

Usage:
  python3 -I scripts/build_frames.py <video.mp4> [--start N] [--end N] [--max 150]
                                   [--dial X,Y] [--mobile-x X]

What it does
1. Reads every frame, finds hard cuts, and looks for one full turn inside the
   first continuous shot: the first frame the picture comes back to after it
   has moved furthest away from frame <start>. If the match is strong enough,
   that span is treated as a 360 degree rotation.
2. Picks up to --max frames evenly across the chosen span and writes:
     public/assets/hero/<version>/d/NNNN.webp   desktop, up to 1600 px wide
     public/assets/hero/<version>/m/NNNN.webp   phone, centre 9:16 crop, up to 900 px wide
     public/assets/hero/<version>/lineart-{d,m}.webp   thin-line drawing of frame 0 (loader)
     public/assets/hero/<version>/loop-{d,m}.{mp4,webm}  silent loop for slow connections
   <version> is a hash of the video file, so a new video gets new URLs.
3. Writes src/data/hero-manifest.json, which the page reads at build time.

If no full turn is found, the first shot is used and the manifest says
fullRotation=false, so the page shows progress instead of degrees.
--start/--end override the detected range (frame numbers in the source).
--dial is where the dial centre sits in the last frame (0..1), used for the
"enter the dial" zoom. --mobile-x moves the phone crop centre (0..1).
"""
import argparse, hashlib, json, os, shutil, subprocess, sys, tempfile
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HERO = os.path.join(ROOT, 'public', 'assets', 'hero')

ap = argparse.ArgumentParser()
ap.add_argument('video')
ap.add_argument('--start', type=int)
ap.add_argument('--end', type=int)
ap.add_argument('--max', type=int, default=150)
ap.add_argument('--dial', default='0.5,0.45')
ap.add_argument('--mobile-x', type=float, default=0.5)
ap.add_argument('--qd', type=int, default=64, help='desktop WebP quality')
ap.add_argument('--qm', type=int, default=68, help='phone WebP quality')
args = ap.parse_args()

# every video gets its own folder, so browsers can cache frames forever
with open(args.video, 'rb') as fh:
    VERSION = hashlib.sha1(fh.read()).hexdigest()[:8]
OUT = os.path.join(HERO, VERSION)
if os.path.isdir(HERO):
    for old in os.listdir(HERO):
        target = os.path.join(HERO, old)
        if os.path.isdir(target):
            shutil.rmtree(target, ignore_errors=True)
        else:
            os.remove(target)
os.makedirs(OUT, exist_ok=True)
URL = f'/assets/hero/{VERSION}/'


def run(cmd):
    subprocess.run(cmd, check=True)


probe = json.loads(subprocess.run(
    ['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
     'stream=width,height,r_frame_rate', '-of', 'json', args.video],
    check=True, capture_output=True, text=True).stdout)['streams'][0]
W, H = probe['width'], probe['height']
num, den = probe['r_frame_rate'].split('/')
fps = float(num) / float(den)

tmp = tempfile.mkdtemp(prefix='frames-')
try:
    run(['ffmpeg', '-v', 'error', '-y', '-i', args.video, '-vsync', '0', os.path.join(tmp, 'f_%05d.png')])
    files = sorted(f for f in os.listdir(tmp) if f.endswith('.png'))
    n = len(files)

    def small(i):
        im = Image.open(os.path.join(tmp, files[i])).convert('L').resize((160, 90), Image.BILINEAR)
        return np.asarray(im, dtype=np.float32) / 255.0

    thumbs = [small(i) for i in range(n)]
    diffs = [float(np.mean(np.abs(thumbs[i] - thumbs[i - 1]))) for i in range(1, n)]
    med = float(np.median(diffs)) if diffs else 0.0
    cuts = [i + 1 for i, d in enumerate(diffs) if d > max(0.08, 6 * med)]

    def corr(a, b):
        a = a - a.mean(); b = b - b.mean()
        return float((a * b).sum() / (np.sqrt((a * a).sum() * (b * b).sum()) + 1e-9))

    start = args.start if args.start is not None else 0
    shot_end = next((c - 1 for c in cuts if c > start), n - 1)
    sims = [corr(thumbs[start], thumbs[k]) for k in range(start, shot_end + 1)]
    lo = int(np.argmin(sims))
    back = lo + int(np.argmax(sims[lo:])) if lo < len(sims) - 1 else lo
    full = (lo > 3 and back > lo and sims[back] > 0.92 and sims[lo] < 0.8)

    if args.end is not None:
        end = args.end
        full = full and (abs((start + back) - end) <= 2)
    elif full:
        end = start + back - 1  # the matching frame closes the loop, do not repeat it
    else:
        end = shot_end

    report = {
        'source': {'width': W, 'height': H, 'fps': fps, 'frames': n},
        'cuts': cuts, 'range': [start, end], 'fullRotation': full,
        'furthestFrame': start + lo, 'furthestCorr': round(sims[lo], 3),
        'returnFrame': start + back, 'returnCorr': round(sims[back], 3),
    }
    print(json.dumps(report, indent=2))

    span = list(range(start, end + 1))
    count = min(args.max, len(span))
    picks = [span[round(i * (len(span) - 1) / max(count - 1, 1))] for i in range(count)]
    if full:  # spread evenly over the turn without duplicating the closing frame
        picks = [span[int(i * len(span) / count)] for i in range(count)]

    for sub in ('d', 'm'):
        shutil.rmtree(os.path.join(OUT, sub), ignore_errors=True)
        os.makedirs(os.path.join(OUT, sub), exist_ok=True)

    dw = min(1600, W - W % 2)
    dh = round(H * dw / W)
    # phone: centre 9:16 crop (or the whole frame if the video is already tall)
    if W / H > 9 / 16:
        cw = round(H * 9 / 16); ch = H
    else:
        cw = W; ch = min(H, round(W * 16 / 9))
    cx = min(max(round(args.mobile_x * W - cw / 2), 0), W - cw)
    cy = round((H - ch) / 2)
    mw = min(900, cw - cw % 2)
    mh = round(ch * mw / cw)

    sizes = {'d': 0, 'm': 0}
    for idx, src in enumerate(picks):
        im = Image.open(os.path.join(tmp, files[src])).convert('RGB')
        d = im.resize((dw, dh), Image.LANCZOS) if dw != W else im
        d.save(os.path.join(OUT, 'd', f'{idx:04d}.webp'), 'WEBP', quality=args.qd, method=6)
        m = im.crop((cx, cy, cx + cw, cy + ch))
        if mw != cw:
            m = m.resize((mw, mh), Image.LANCZOS)
        m.save(os.path.join(OUT, 'm', f'{idx:04d}.webp'), 'WEBP', quality=args.qm, method=6)
    for sub in ('d', 'm'):
        sizes[sub] = sum(os.path.getsize(os.path.join(OUT, sub, f)) for f in os.listdir(os.path.join(OUT, sub)))

    # thin-line drawing of the first frame, espresso lines on transparent
    first = os.path.join(tmp, files[picks[0]])
    edge = os.path.join(tmp, 'edge.png')
    run(['ffmpeg', '-v', 'error', '-y', '-i', first, '-vf', 'edgedetect=low=0.08:high=0.2:mode=wires', edge])
    e = Image.open(edge).convert('L')

    def lineart(img, path):
        a = np.asarray(img, dtype=np.float32)
        a = np.clip(a * 1.6, 0, 255).astype(np.uint8)
        rgba = np.zeros((a.shape[0], a.shape[1], 4), dtype=np.uint8)
        rgba[..., 0], rgba[..., 1], rgba[..., 2], rgba[..., 3] = 42, 31, 23, a
        Image.fromarray(rgba, 'RGBA').save(path, 'WEBP', quality=80, method=6)

    lineart(e.resize((dw, dh), Image.LANCZOS) if dw != W else e, os.path.join(OUT, 'lineart-d.webp'))
    em = e.crop((cx, cy, cx + cw, cy + ch))
    lineart(em.resize((mw, mh), Image.LANCZOS) if mw != cw else em, os.path.join(OUT, 'lineart-m.webp'))

    # silent loop for slow connections; a ping-pong loop when it is not a full turn
    t0, t1 = start / fps, (end + 1) / fps
    loop_filter = '' if full else ',split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1:a=0'
    run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{t0:.3f}', '-to', f'{t1:.3f}', '-i', args.video, '-an',
         '-filter_complex', f'[0:v]scale={dw}:-2{loop_filter}', '-c:v', 'libx264', '-preset', 'slow',
         '-crf', '28', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', os.path.join(OUT, 'loop-d.mp4')])
    run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{t0:.3f}', '-to', f'{t1:.3f}', '-i', args.video, '-an',
         '-filter_complex', f'[0:v]crop={cw}:{ch}:{cx}:{cy},scale={mw}:-2{loop_filter}', '-c:v', 'libx264',
         '-preset', 'slow', '-crf', '28', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
         os.path.join(OUT, 'loop-m.mp4')])
    # VP9 copies for browsers without H.264 (e.g. open-source Chromium)
    for src_mp4, dst in (('loop-d.mp4', 'loop-d.webm'), ('loop-m.mp4', 'loop-m.webm')):
        run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(OUT, src_mp4), '-an', '-c:v', 'libvpx-vp9',
             '-b:v', '0', '-crf', '40', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2',
             os.path.join(OUT, dst)])

    dial = [float(v) for v in args.dial.split(',')]
    manifest = {
        'version': VERSION,
        'base': URL,
        'count': count,
        'fullRotation': full,
        'sourceRange': [start, end],
        'desktop': {'w': dw, 'h': dh, 'bytes': sizes['d']},
        'mobile': {'w': mw, 'h': mh, 'bytes': sizes['m']},
        'dial': dial,
    }
    with open(os.path.join(ROOT, 'src', 'data', 'hero-manifest.json'), 'w') as f:
        json.dump(manifest, f, indent=2)
    print(json.dumps({'frames': count, 'desktopKB': sizes['d'] // 1024, 'mobileKB': sizes['m'] // 1024,
                      'avgDesktopKB': round(sizes['d'] / count / 1024, 1),
                      'avgMobileKB': round(sizes['m'] / count / 1024, 1)}, indent=2))
finally:
    shutil.rmtree(tmp, ignore_errors=True)
