// Runs on every page: smooth scroll + frame loop, cart, header colour, gentle reveals.
import { initEngine, onFrame, reduced } from './engine';
import { initCart } from './cart';

initEngine();
initCart();

// Header: transparent over the cinematic scenes, solid cream elsewhere,
// light or dark text depending on the scene under it.
const hdr = document.getElementById('hdr');
if (hdr) {
  const always = hdr.dataset.solid === 'always';
  const sections = [...document.querySelectorAll<HTMLElement>('[data-header]')];
  let theme = '', solid = always;
  onFrame(() => {
    const y = hdr.offsetHeight / 2;
    let cur: HTMLElement | undefined;
    for (const s of sections) {
      const r = s.getBoundingClientRect();
      if (r.top <= y && r.bottom > y) { cur = s; break; }
    }
    const t = cur?.dataset.header || 'light';
    const sol = always || (!!cur && !cur.hasAttribute('data-bare')) || !cur;
    if (t !== theme) { theme = t; hdr.dataset.theme = t; }
    if (sol !== solid) { solid = sol; hdr.classList.toggle('is-solid', sol); }
  });
}

// Phone menu (below 900px the header links live in a panel)
const menuBtn = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
const menu = document.getElementById('menu');
if (menuBtn && menu) {
  const isOpen = () => menuBtn.getAttribute('aria-expanded') === 'true';
  const setMenu = (open: boolean, focusButton = false) => {
    menuBtn.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
    if (focusButton) menuBtn.focus();
  };
  menuBtn.addEventListener('click', () => setMenu(!isOpen()));
  // a tapped link closes the menu; in-page links still scroll (engine.ts handles them)
  menu.addEventListener('click', (e) => { if ((e.target as Element).closest('a')) setMenu(false); });
  document.addEventListener('click', (e) => {
    if (isOpen() && !(e.target as Element).closest('#menu, [data-menu-toggle]')) setMenu(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) setMenu(false, true);
  });
  // leaving the menu with Tab closes it
  menu.addEventListener('focusout', (e) => {
    const to = e.relatedTarget as Node | null;
    if (to && !menu.contains(to) && to !== menuBtn) setMenu(false);
  });
  matchMedia('(min-width: 900px)').addEventListener?.('change', (mq) => { if (mq.matches) setMenu(false); });
}

// Soft fade-up for plain content blocks
const rv = document.querySelectorAll<HTMLElement>('.rv');
if (rv.length) {
  if (reduced || !('IntersectionObserver' in window)) rv.forEach((el) => el.classList.add('is-in'));
  else {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      }),
      { rootMargin: '0px 0px -8% 0px' },
    );
    rv.forEach((el) => io.observe(el));
  }
}
