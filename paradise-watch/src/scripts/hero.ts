// Opening scene: the watch turns with the scroll (image sequence on a canvas),
// glass cards appear at set angles, then the camera "enters" the dial.
import {
  clamp, damp, easeInCubic, easeInOutCubic, onFrame, reduced, scrollToY, sectionProgress, sectionY, smoothstep,
} from './engine';
import { ROT_END } from '../data/scenes';

type Manifest = {
  base: string;
  count: number;
  fullRotation: boolean;
  desktop: { w: number; h: number };
  mobile: { w: number; h: number };
  /** dial centre in the desktop frames (0..1) */
  dial: [number, number];
  /** dial centre in the phone frames; older manifests only have `dial` */
  dialM?: [number, number];
};
export type HeroMode = 'scrub' | 'loop' | 'poster';

export function pickMode(): HeroMode {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (reduced) return 'poster';
  if (c?.saveData || /(^|-)2g$/.test(c?.effectiveType ?? '')) return 'poster';
  if (c?.effectiveType === '3g') return 'loop';
  return 'scrub';
}

/** 0, then every 8th frame, every 4th, every 2nd, then the rest. */
function loadOrder(n: number) {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const step of [n, 8, 4, 2, 1]) {
    for (let i = 0; i < n; i += step) if (!seen.has(i)) { seen.add(i); out.push(i); }
  }
  return out;
}

export function initHero(mode: HeroMode) {
  const sec = document.querySelector<HTMLElement>('.hero');
  const data = document.getElementById('hero-data');
  if (!sec || !data) return null;
  const m: Manifest = JSON.parse(data.textContent || '{}');
  sec.dataset.mode = mode;

  const stage = sec.querySelector<HTMLElement>('.hero__stage')!;
  const canvas = sec.querySelector<HTMLCanvasElement>('.hero__canvas')!;
  const ctx = canvas.getContext('2d', { alpha: false })!;
  const video = sec.querySelector<HTMLVideoElement>('.hero__loop')!;
  const intro = sec.querySelector<HTMLElement>('.hero__intro')!;
  const title = sec.querySelector<HTMLElement>('.hero__title')!;
  const hint = sec.querySelector<HTMLElement>('.hero__hint');
  const meter = sec.querySelector<HTMLElement>('.hero__meter')!;
  const deg = sec.querySelector<HTMLElement>('[data-deg]')!;
  const bar = sec.querySelector<HTMLElement>('.hero__bar i')!;
  const portal = sec.querySelector<HTMLElement>('.hero__portal')!;
  const portalText = portal.querySelector<HTMLElement>('p')!;
  const cards = [...sec.querySelectorAll<HTMLElement>('.gcard')].map((el) => ({
    el, a: Number(el.dataset.in), b: Number(el.dataset.out), on: false, o: -1,
  }));

  const N = m.count;
  const full = m.fullRotation;
  const portraitMq = matchMedia('(max-aspect-ratio: 4/5)');
  let set: 'd' | 'm' = portraitMq.matches ? 'm' : 'd';
  const frames: Record<'d' | 'm', (HTMLImageElement | null)[]> = { d: new Array(N).fill(null), m: new Array(N).fill(null) };
  const started: Record<'d' | 'm', boolean> = { d: false, m: false };
  const url = (s: 'd' | 'm', i: number) => `${m.base}${s}/${String(i).padStart(4, '0')}.webp`;
  const dial = () => (set === 'm' && m.dialM ? m.dialM : m.dial);

  // ---------- loading ----------
  let firstDone: () => void = () => {};
  const firstPass = new Promise<void>((r) => (firstDone = r));
  let onProgress: (pct: number, loaded: number, total: number) => void = () => {};

  function startLoading(s: 'd' | 'm') {
    if (started[s]) return;
    started[s] = true;
    const queue = loadOrder(N);
    const firstCount = Math.ceil(N / 8);
    const firstSet = new Set(queue.slice(0, firstCount));
    let firstLoaded = 0, loaded = 0, running = 0;
    const next = () => {
      while (running < 6 && queue.length) {
        const i = queue.shift()!;
        running++;
        const img = new Image();
        img.decoding = 'async';
        const done = (ok: boolean) => {
          running--;
          if (ok) { frames[s][i] = img; loaded++; dirty = true; }
          if (firstSet.has(i)) {
            firstLoaded++;
            if (s === set) onProgress(Math.round((firstLoaded / firstCount) * 100), loaded, N);
            if (firstLoaded === firstCount && s === set) firstDone();
          }
          next();
        };
        img.onload = () => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(() => done(true));
        img.onerror = () => done(false);
        img.src = url(s, i);
      }
    };
    next();
  }

  // ---------- canvas ----------
  let cw = 0, ch = 0, dirty = true;
  function resize() {
    const r = stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cw = Math.max(1, Math.round(r.width * dpr));
    ch = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    const s = portraitMq.matches ? 'm' : 'd';
    if (s !== set) { set = s; if (mode === 'scrub') startLoading(set); if (mode === 'loop') setVideo(); }
    dirty = true;
  }

  function nearest(i: number) {
    const f = frames[set];
    if (f[i]) return f[i];
    for (let d = 1; d < N; d++) {
      const a = full ? (i - d + N) % N : i - d;
      const b = full ? (i + d) % N : i + d;
      if (a >= 0 && f[a]) return f[a];
      if (b < N && f[b]) return f[b];
    }
    return null;
  }

  /** cover-fit draw, zoomed around the dial and drifting it to the centre */
  function draw(i: number, zoom: number, centre: number) {
    const img = nearest(i);
    if (!img) return false;
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const s = Math.max(cw / iw, ch / ih);
    const dw = iw * s, dh = ih * s, dx = (cw - dw) / 2, dy = (ch - dh) / 2;
    const [dxr, dyr] = dial();
    const px = dx + dxr * dw, py = dy + dyr * dh;
    const tx = px + (cw / 2 - px) * centre, ty = py + (ch / 2 - py) * centre;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#f4eee2';
    ctx.fillRect(0, 0, cw, ch);
    ctx.setTransform(zoom, 0, 0, zoom, tx - px * zoom, ty - py * zoom);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, dx, dy, dw, dh);
    return true;
  }

  // ---------- slow connection: silent loop ----------
  function setVideo() {
    const webm = video.canPlayType('video/webm; codecs="vp9"');
    const mp4 = video.canPlayType('video/mp4; codecs="avc1.42E01E"');
    video.src = `${m.base}loop-${set}.${mp4 === 'probably' || !webm ? 'mp4' : 'webm'}`;
    video.play().catch(() => {});
  }

  // ---------- per-frame update ----------
  let ps = sectionProgress(sec);
  let lastKey = '', lastDeg = '', active = true, ready = false;
  // hide = false keeps an element reachable by keyboard while it is transparent
  const style = (el: HTMLElement, o: number, ty = 0, hide = true) => {
    el.style.opacity = o.toFixed(3);
    el.style.transform = `translate3d(0, ${ty.toFixed(1)}px, 0)`;
    if (hide) el.style.visibility = o < 0.01 ? 'hidden' : '';
  };

  function render(p: number) {
    const rot = clamp(p / ROT_END);
    const e = clamp((p - ROT_END) / (1 - ROT_END));

    // frame + zoom
    const f = full ? rot * N : rot * (N - 1);
    const idx = full ? Math.round(f) % N : Math.round(f);
    const zoom = 1 + 3.4 * easeInCubic(e);
    const centre = easeInOutCubic(clamp(e * 1.1));
    if (mode === 'scrub') {
      const key = `${idx}|${zoom.toFixed(3)}|${centre.toFixed(3)}|${set}`;
      if (key !== lastKey || dirty) { if (draw(idx, zoom, centre)) { lastKey = key; dirty = false; } }
    } else if (mode === 'loop') {
      video.style.transformOrigin = `${dial()[0] * 100}% ${dial()[1] * 100}%`;
      video.style.transform = zoom > 1.001 ? `scale(${zoom.toFixed(3)})` : '';
    }

    // opening words, giant title, scroll hint
    style(intro, 1 - smoothstep(0.012, 0.06, p), -40 * smoothstep(0, 0.08, p), false);
    intro.classList.toggle('is-off', p > 0.06);
    style(title, 1 - smoothstep(0.02, 0.13, p), 60 * smoothstep(0, 0.16, p));
    if (hint) style(hint, 1 - smoothstep(0, 0.02, p));

    // degree counter + progress bar
    // fades in only once the giant title has faded out, so the two never overlap on a phone
    const mo = smoothstep(0.11, 0.15, p) * (1 - smoothstep(ROT_END - 0.03, ROT_END + 0.02, p));
    style(meter, mode === 'scrub' ? mo : 0);
    const val = String(Math.round(full ? rot * 360 : rot * 100)).padStart(3, '0');
    if (val !== lastDeg) { deg.textContent = val; lastDeg = val; }
    bar.style.transform = `scaleX(${rot.toFixed(4)})`;

    // glass cards
    for (const c of cards) {
      const o = smoothstep(c.a, c.a + 0.03, p) * (1 - smoothstep(c.b - 0.03, c.b, p));
      if (Math.abs(o - c.o) > 0.001) { style(c.el, o, (1 - o) * 18, false); c.o = o; }
      const on = o > 0.6;
      if (on !== c.on) { c.on = on; c.el.classList.toggle('is-on', on); }
    }

    // enter the dial: a dark circle opens from the dial and becomes the next scene
    const W = stage.clientWidth, H = stage.clientHeight;
    const dpr = cw / Math.max(1, W);
    const img = nearest(idx);
    let cx = W / 2, cy = H / 2;
    if (img) {
      const s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
      const px = (cw - img.naturalWidth * s) / 2 + dial()[0] * img.naturalWidth * s;
      const py = (ch - img.naturalHeight * s) / 2 + dial()[1] * img.naturalHeight * s;
      cx = (px + (cw / 2 - px) * centre) / dpr;
      cy = (py + (ch / 2 - py) * centre) / dpr;
    }
    const k = clamp((e - 0.25) / 0.75);
    const rr = k * k * Math.hypot(W, H) * 0.56;
    portal.style.visibility = rr > 0.5 ? 'visible' : 'hidden';
    portal.style.clipPath = `circle(${rr.toFixed(1)}px at ${cx.toFixed(1)}px ${cy.toFixed(1)}px)`;
    const to = smoothstep(0.66, 0.76, e) * (1 - smoothstep(0.9, 0.99, e));
    style(portalText, to, (1 - to) * 14);
    sec!.dataset.header = e > 0.55 ? 'dark' : 'light';
  }

  // keyboard users: focusing a card (or the opening buttons) brings that moment into view
  intro.addEventListener('focusin', () => {
    if (intro.classList.contains('is-off')) scrollToY(sectionY(sec, 0));
  });
  for (const c of cards) {
    c.el.addEventListener('focusin', () => {
      if (c.on) return;
      scrollToY(sectionY(sec, (c.a + c.b) / 2));
    });
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([en]) => { active = en.isIntersecting; }, { rootMargin: '10% 0px' }).observe(sec);
  }

  return {
    mode,
    /** start downloading frames; resolves when the first pass (every 8th frame) is in */
    load(cb: (pct: number, loaded: number, total: number) => void) {
      onProgress = cb;
      if (mode === 'scrub') { startLoading(set); return firstPass; }
      if (mode === 'loop') { setVideo(); }
      cb(100, N, N);
      return Promise.resolve();
    },
    start() {
      if (mode === 'poster') return;
      resize();
      window.addEventListener('resize', resize);
      portraitMq.addEventListener?.('change', resize);
      ready = true;
      sec.classList.add('is-ready');
      ps = sectionProgress(sec);
      render(ps);
      onFrame((_, dt) => {
        if (!active || !ready) return;
        const p = sectionProgress(sec);
        ps += (p - ps) * damp(11, dt);
        if (Math.abs(p - ps) < 0.00005) ps = p;
        render(ps);
      });
    },
    /** draw the first frame before the loader reveal */
    prime() {
      if (mode !== 'scrub') return;
      resize();
      draw(0, 1, 0);
      sec.classList.add('is-ready');
    },
  };
}
