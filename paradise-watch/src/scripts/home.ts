// Home page: loader -> opening spin -> enter the dial -> collection film -> shop.
import { easeInOutCubic, lenis, reduced } from './engine';
import { initHero, pickMode } from './hero';
import { initFilm } from './film';

const html = document.documentElement;
const mode = pickMode();
const hero = initHero(mode);
initFilm(mode === 'poster');

// ---------- loader ----------
const loader = document.querySelector<HTMLElement>('.loader');
const pctEl = loader?.querySelector<HTMLElement>('[data-pct]');
const countEl = loader?.querySelector<HTMLElement>('[data-count]');
const scan = loader?.querySelector<HTMLElement>('.loader__scan');

function finish() {
  loader?.remove();
  html.classList.remove('is-loading');
  lenis?.start();
  hero?.start();
}

function reveal() {
  if (!loader) return finish();
  hero?.prime();
  loader.setAttribute('aria-valuenow', '100');
  if (reduced) return finish();
  // a bright scanline sweeps down; above it the drawing becomes the real watch
  const t0 = performance.now(), dur = 1150;
  if (scan) scan.style.opacity = '1';
  const step = (now: number) => {
    const t = Math.min(1, (now - t0) / dur);
    const v = easeInOutCubic(t) * 100;
    loader.style.clipPath = `inset(${v.toFixed(2)}% 0 0 0)`;
    if (scan) {
      // transform (not top) so the sweep never counts as a layout shift
      scan.style.transform = `translate3d(0, ${((v / 100) * loader.clientHeight - 1).toFixed(1)}px, 0)`;
      scan.style.opacity = String(1 - Math.max(0, (t - 0.85) / 0.15));
    }
    if (t < 1) requestAnimationFrame(step);
    else finish();
  };
  requestAnimationFrame(step);
}

if (!hero || mode === 'poster' || !loader) {
  loader?.remove();
  hero?.start();
} else {
  html.classList.add('is-loading');
  lenis?.stop();
  window.scrollTo(0, 0);
  let shown = 0;
  const tick = (pct: number, loaded: number, total: number) => {
    shown = Math.max(shown, pct);
    loader.style.setProperty('--p', String(shown));
    loader.setAttribute('aria-valuenow', String(shown));
    if (pctEl) pctEl.textContent = String(shown).padStart(3, '0');
    if (countEl) countEl.textContent = `${String(loaded).padStart(3, '0')} / ${String(total).padStart(3, '0')}`;
  };
  const safety = new Promise<void>((r) => setTimeout(r, 9000));
  const minTime = new Promise<void>((r) => setTimeout(r, 650));
  Promise.all([Promise.race([hero.load(tick), safety]), minTime]).then(() => {
    tick(100, 0, 0);
    if (countEl) countEl.textContent = '';
    setTimeout(reveal, 180);
  });
}

// ---------- shop filter ----------
const filters = [...document.querySelectorAll<HTMLButtonElement>('[data-filter]')];
const cards = [...document.querySelectorAll<HTMLElement>('.shop .pcard')];
const count = document.querySelector<HTMLElement>('[data-shop-count]');
filters.forEach((btn) =>
  btn.addEventListener('click', () => {
    const f = btn.dataset.filter!;
    filters.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    let n = 0;
    cards.forEach((c) => {
      const show = f === 'all' || c.dataset.gender === f;
      c.hidden = !show;
      if (show) n++;
    });
    if (count) count.textContent = `מוצגים ${n} שעונים`;
  }),
);
