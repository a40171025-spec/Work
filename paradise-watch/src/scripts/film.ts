// Collection film: a dark, warm stage where the scroll moves the camera past real watch photos.
import { clamp, damp, onFrame, scrollToY, sectionProgress, sectionY, smoothstep } from './engine';

export function initFilm(staticMode: boolean) {
  const sec = document.querySelector<HTMLElement>('.film');
  if (!sec) return;

  // Photos load only when the film is close
  const lazy = [...sec.querySelectorAll<HTMLImageElement>('img[data-src]')];
  const loadAll = () => lazy.forEach((img) => { if (img.dataset.src) { img.src = img.dataset.src; img.removeAttribute('data-src'); } });
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) { loadAll(); io.disconnect(); } }, { rootMargin: '120% 0px' });
    io.observe(sec);
  } else loadAll();

  if (staticMode) { sec.classList.add('is-static'); return; }

  const N = Number(sec.style.getPropertyValue('--stops')) || sec.querySelectorAll('.stop').length;
  const stage = sec.querySelector<HTMLElement>('.film__stage')!;
  const stops = [...sec.querySelectorAll<HTMLElement>('.stop')];
  const names = [...sec.querySelectorAll<HTMLElement>('.film__name')];
  const infos = [...sec.querySelectorAll<HTMLElement>('.finfo')];
  const bokeh = [...sec.querySelectorAll<HTMLElement>('.film__bokeh span')].map((el) => ({
    el, x: Number(el.dataset.x), d: Number(el.dataset.d),
  }));
  const floor = sec.querySelector<HTMLElement>('.film__floor')!;
  const intro = sec.querySelector<HTMLElement>('.film__intro')!;
  const outro = sec.querySelector<HTMLElement>('.film__outro')!;
  const fade = sec.querySelector<HTMLElement>('.film__fade')!;
  const meterN = sec.querySelector<HTMLElement>('[data-film-n]')!;
  const meter = sec.querySelector<HTMLElement>('.film__meter')!;
  const all = sec.querySelector<HTMLElement>('.film__all');
  const touch = matchMedia('(pointer: coarse)').matches;

  // camera position c: -1 (intro) .. N (outro), lingering a little at every watch
  const U0 = -1, U1 = N;
  const camera = (p: number) => {
    const u = U0 + p * (U1 - U0);
    const i = Math.floor(u), f = u - i;
    return i + (f - (0.82 * Math.sin(2 * Math.PI * f)) / (2 * Math.PI));
  };
  const progressFor = (c: number) => (c - U0) / (U1 - U0);

  let ps = sectionProgress(sec), active = false, lastN = '';
  // hide = false keeps an element reachable by keyboard while it is transparent
  const set = (el: HTMLElement, o: number, tf: string, filter?: string, hide = true) => {
    el.style.opacity = o.toFixed(3);
    el.style.transform = tf;
    if (hide) el.style.visibility = o < 0.01 ? 'hidden' : '';
    if (filter !== undefined) el.style.filter = filter;
  };

  function render(p: number) {
    const W = stage.clientWidth, H = stage.clientHeight;
    const c = camera(p);

    stops.forEach((el, i) => {
      const t = c - i;
      const side = i % 2 ? 1 : -1;
      if (t < -2.3 || t > 1.4) { if (el.style.visibility !== 'hidden') set(el, 0, el.style.transform); return; }
      let s: number, x: number, y: number, o: number, blur: number;
      if (t <= 0) {
        const d = -t;
        s = 1 / (1 + d * 0.95);
        x = side * Math.min(d, 1.8) * W * 0.2;
        y = -d * H * 0.05;
        o = clamp(1 - Math.max(0, d - 0.55) * 0.62);
        blur = d * 3.5;
      } else {
        s = 1 + t * 0.95;
        x = -side * t * W * 0.38;
        y = t * H * 0.07;
        o = clamp(1 - t * 1.5);
        blur = t * 7;
      }
      set(el, o, `translate(-50%, -50%) translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${s.toFixed(4)})`,
        touch ? undefined : blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : 'none');
      el.style.zIndex = String(100 - Math.round(Math.abs(t) * 10));
      const lit = Math.abs(t) < 0.08;
      if (lit && !el.classList.contains('is-lit')) el.classList.add('is-lit');
      if (Math.abs(t) > 0.45 && el.classList.contains('is-lit')) el.classList.remove('is-lit');
    });

    names.forEach((el, i) => {
      const t = c - i;
      const o = clamp(1 - Math.abs(t) * 2.3);
      set(el, o * 0.95, `translateY(-50%) translate3d(${(-t * W * 0.12).toFixed(1)}px, 0, 0)`);
    });

    infos.forEach((el, i) => {
      const t = c - i;
      const o = clamp(1 - Math.abs(t) * 3.1);
      set(el, o, `translate3d(0, ${(t * 26).toFixed(1)}px, 0)`, undefined, false);
      const on = o > 0.55;
      if (on !== el.classList.contains('is-on')) el.classList.toggle('is-on', on);
    });

    for (const b of bokeh) {
      const span = W + 300;
      const x = (((b.x * span - c * 260 * b.d) % span) + span) % span - 150;
      b.el.style.transform = `translate3d(${x.toFixed(1)}px, 0, 0)`;
    }
    floor.style.backgroundPosition = `0 ${(c * 220).toFixed(1)}px`;

    const io = 1 - smoothstep(-0.72, -0.35, c);
    set(intro, io, `translate3d(0, ${(-(1 - io) * 30).toFixed(1)}px, 0)`);
    const oo = smoothstep(N - 1 + 0.3, N - 1 + 0.55, c) * (1 - smoothstep(N - 1 + 0.86, N - 1 + 0.97, c));
    set(outro, oo, `translate3d(0, ${((1 - oo) * 24).toFixed(1)}px, 0)`, undefined, false);
    outro.classList.toggle('is-on', oo > 0.6);
    const fo = smoothstep(N - 1 + 0.78, N - 1 + 0.99, c);
    fade.style.opacity = fo.toFixed(3);
    sec!.dataset.header = fo > 0.5 ? 'light' : 'dark';

    const k = clamp(Math.round(c), 0, N - 1) + 1;
    const label = String(k).padStart(2, '0');
    if (label !== lastN) { meterN.textContent = label; lastN = label; }
    meter.style.setProperty('--fp', clamp(c / (N - 1)).toFixed(4));
    const mo = smoothstep(-0.5, -0.2, c) * (1 - smoothstep(N - 1 + 0.2, N - 1 + 0.45, c));
    meter.style.opacity = mo.toFixed(3);
    if (all) all.style.opacity = (mo * 0.85).toFixed(3);
  }

  // keyboard users: focusing a watch's buttons brings that watch to the centre
  infos.forEach((el, i) => el.addEventListener('focusin', () => {
    if (!el.classList.contains('is-on')) scrollToY(sectionY(sec, progressFor(i)));
  }));
  outro.addEventListener('focusin', () => {
    if (!outro.classList.contains('is-on')) scrollToY(sectionY(sec, progressFor(N - 1 + 0.6)));
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([en]) => { active = en.isIntersecting; if (active) ps = sectionProgress(sec); }, { rootMargin: '5% 0px' }).observe(sec);
  } else active = true;

  render(ps);
  onFrame((_, dt) => {
    if (!active) return;
    const p = sectionProgress(sec);
    ps += (p - ps) * damp(10, dt);
    if (Math.abs(p - ps) < 0.00005) ps = p;
    render(ps);
  });
}
