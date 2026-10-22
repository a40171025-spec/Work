// Runs on every page: in-page links, cart, phone menu.
import { initEngine } from './engine';
import { initCart } from './cart';

initEngine();
initCart();

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
