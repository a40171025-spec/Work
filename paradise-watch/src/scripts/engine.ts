// One animation loop for the whole page, plus Lenis smooth scrolling on desktop.
import Lenis from 'lenis';

export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

type FrameFn = (now: number, dt: number) => void;
const subs = new Set<FrameFn>();
export const onFrame = (fn: FrameFn) => {
  subs.add(fn);
  return () => subs.delete(fn);
};

export let lenis: Lenis | null = null;

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const easeInCubic = (t: number) => t * t * t;
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/** frame-rate independent smoothing factor */
export const damp = (lambda: number, dt: number) => 1 - Math.exp(-lambda * dt);

/** Progress (0..1) of a tall pinned section: 0 when its top hits the top of the screen. */
export function sectionProgress(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const total = r.height - window.innerHeight;
  return total > 0 ? clamp(-r.top / total) : 0;
}

/** Page Y for a given progress inside a pinned section. */
export function sectionY(el: HTMLElement, p: number) {
  const top = el.getBoundingClientRect().top + window.scrollY;
  return top + p * (el.offsetHeight - window.innerHeight);
}

export function scrollToY(y: number, smooth = false) {
  if (lenis) lenis.scrollTo(y, { immediate: !smooth, force: true });
  else window.scrollTo({ top: y, behavior: smooth && !reduced ? 'smooth' : 'auto' });
}

export function scrollToEl(el: HTMLElement) {
  const hdr = document.getElementById('hdr')?.offsetHeight ?? 64;
  const y = el.getBoundingClientRect().top + window.scrollY - hdr;
  // long jumps (across the cinematic scenes) are instant; short ones glide
  const far = Math.abs(y - window.scrollY) > window.innerHeight * 2.5;
  scrollToY(y, !far);
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
}

export function initEngine() {
  if (!reduced) {
    lenis = new Lenis({ autoRaf: false, lerp: 0.1, smoothWheel: true, syncTouch: false, wheelMultiplier: 0.9 });
  }
  let last = performance.now();
  const loop = (now: number) => {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    lenis?.raf(now);
    subs.forEach((fn) => fn(now, dt));
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  // in-page links (#collection, /#faq when already on the home page)
  document.addEventListener('click', (e) => {
    const a = (e.target as Element).closest?.('a[href]') as HTMLAnchorElement | null;
    if (!a || a.target === '_blank' || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname || !url.hash) return;
    const el = document.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (!el) return;
    e.preventDefault();
    history.pushState(null, '', url.hash);
    scrollToEl(el);
  });

  // arriving with a hash (e.g. /#faq from another page)
  if (location.hash.length > 1) {
    const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (el) requestAnimationFrame(() => scrollToEl(el));
  }
}
