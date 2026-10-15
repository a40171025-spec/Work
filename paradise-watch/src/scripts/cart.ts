// Cart: stored in localStorage (same key as the old site), drawer UI, add-to-cart buttons.
import { calcTotals, type CartLine, type Totals } from '../data/pricing';
import { boxLabel, ils, PRICE_BOX, PRICE_NO_BOX } from '../data/site';
import { lenis } from './engine';
import minusSvg from 'lucide-static/icons/minus.svg?raw';
import plusSvg from 'lucide-static/icons/plus.svg?raw';

type CatalogItem = { n: string; pre: boolean; img: string };
export const catalog: Record<string, CatalogItem> = JSON.parse(document.getElementById('pw-catalog')?.textContent || '{}');

const KEY = 'pw-cart';
const listeners = new Set<() => void>();
let lines: CartLine[] = read();

function read(): CartLine[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((l) => l && typeof l.slug === 'string' && catalog[l.slug] && Number.isInteger(l.qty) && l.qty > 0)
      .map((l) => ({ slug: l.slug, withBox: !!l.withBox, qty: Math.min(20, l.qty) }));
  } catch {
    return [];
  }
}
function commit(next: CartLine[]) {
  lines = next;
  try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch { /* private mode */ }
  listeners.forEach((fn) => fn());
}
window.addEventListener('storage', (e) => {
  if (e.key === KEY) { lines = read(); listeners.forEach((fn) => fn()); }
});

export const cart = {
  get lines() { return lines; },
  totals: (): Totals => calcTotals(lines),
  subscribe(fn: () => void) { listeners.add(fn); return () => listeners.delete(fn); },
  add(slug: string, withBox: boolean) {
    if (!catalog[slug]) return;
    const f = lines.find((l) => l.slug === slug && l.withBox === withBox);
    commit(f ? lines.map((l) => (l === f ? { ...l, qty: Math.min(20, l.qty + 1) } : l)) : [...lines, { slug, withBox, qty: 1 }]);
  },
  setQty(slug: string, withBox: boolean, qty: number) {
    commit(lines.map((l) => (l.slug === slug && l.withBox === withBox ? { ...l, qty: Math.min(20, qty) } : l)).filter((l) => l.qty > 0));
  },
  /** switch a line between branded box and small box, merging with an existing line */
  setBox(slug: string, from: boolean, to: boolean) {
    const a = lines.find((l) => l.slug === slug && l.withBox === from);
    if (!a || from === to) return;
    const b = lines.find((l) => l.slug === slug && l.withBox === to);
    const rest = lines.filter((l) => l !== a && l !== b);
    commit([...rest, { slug, withBox: to, qty: Math.min(20, a.qty + (b?.qty ?? 0)) }]);
  },
  clear() { commit([]); },
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const icon = (svg: string) => `<span class="icon">${svg.replace(/<!--.*?-->/s, '').replace('<svg', '<svg aria-hidden="true" focusable="false"')}</span>`;

/** Order summary, same wording as the old site. */
export function summaryHTML(t: Totals) {
  let h = `<div><dt>סכום ביניים</dt><dd>${ils(t.subtotal)}</dd></div>`;
  if (t.discount > 0) h += `<div class="sum__deal"><dt>מבצע זוגי 🎁</dt><dd>-${ils(t.discount)}</dd></div>`;
  h += `<div><dt>משלוח (מרכז ודרום)</dt><dd>${t.shipping === 0 ? 'חינם' : ils(t.shipping)}</dd></div>`;
  h += `<div class="sum__total"><dt>סה״כ לתשלום</dt><dd>${ils(t.total)}</dd></div>`;
  if (t.discount > 0) h += `<p class="sum__save">חסכתם ${ils(t.discount)}!</p>`;
  if (t.qty === 1) h += `<p class="sum__note">הוסיפו עוד שעון וקבלו את המבצע הזוגי אוטומטית.</p>`;
  if (t.qty === 2) h += `<p class="sum__note">עוד שעון אחד — והמשלוח חינם.</p>`;
  h += `<p class="sum__note">תשלום במזומן לשליח בעת המסירה בלבד.</p>`;
  return h;
}

export function announce(msg: string) {
  const live = document.getElementById('live');
  if (!live) return;
  live.textContent = '';
  setTimeout(() => (live.textContent = msg), 40);
}

// ---------- drawer ----------
const drawer = document.getElementById('cart');
const body = drawer?.querySelector<HTMLElement>('[data-cart-body]');
const foot = drawer?.querySelector<HTMLElement>('[data-cart-foot]');
const sum = drawer?.querySelector<HTMLElement>('[data-cart-sum]');
const panel = drawer?.querySelector<HTMLElement>('.drawer__panel');
let lastFocus: HTMLElement | null = null;

function render() {
  const t = cart.totals();
  document.querySelectorAll<HTMLElement>('[data-cart-count]').forEach((el) => {
    el.textContent = String(t.qty);
    el.hidden = t.qty === 0;
  });
  document.querySelectorAll<HTMLElement>('[data-cart-open]').forEach((el) => el.setAttribute('aria-label', `פתיחת הסל, ${t.qty} פריטים`));
  if (!body || !foot || !sum) return;
  if (!lines.length) {
    const href = drawer?.dataset.collectionHref ?? '/#collection';
    body.innerHTML = `<div class="drawer__empty"><p>הסל ריק. בחרו שעון מהקולקציה ✨</p><a class="btn btn--dark btn--sm" href="${href}" data-cart-close>לקולקציה</a></div>`;
    foot.hidden = true;
    return;
  }
  body.innerHTML = lines
    .map((l) => {
      const p = catalog[l.slug];
      const price = l.withBox ? PRICE_BOX : PRICE_NO_BOX;
      const img = p.img
        ? `<img src="${p.img}" alt="" width="76" height="95" loading="lazy" decoding="async">`
        : `<span class="line__ph" aria-hidden="true"></span>`;
      return `<div class="line" data-slug="${l.slug}" data-box="${l.withBox ? 1 : 0}">
        ${img}
        <div class="line__main">
          <p class="line__name">${esc(p.n)}</p>
          <p class="line__meta">${boxLabel(l.withBox)} · ${ils(price)}</p>
          ${p.pre ? '<p class="line__pre">הזמנה מראש</p>' : ''}
          <button type="button" class="swap" data-act="swap">${l.withBox ? `להחליף לקופסה קטנה ורגילה (${ils(PRICE_NO_BOX)})` : `להחליף לקופסה ממותגת (${ils(PRICE_BOX)})`}</button>
          <div class="line__row">
            <div class="qty" role="group" aria-label="כמות ${esc(p.n)}">
              <button type="button" data-act="dec" aria-label="הפחתה">${icon(minusSvg)}</button>
              <output aria-live="polite">${l.qty}</output>
              <button type="button" data-act="inc" aria-label="הוספה">${icon(plusSvg)}</button>
            </div>
            <strong>${ils(price * l.qty)}</strong>
          </div>
        </div>
      </div>`;
    })
    .join('');
  sum.innerHTML = summaryHTML(t);
  foot.hidden = false;
}

function focusables() {
  return [...(panel?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [])].filter(
    (el) => el.offsetParent !== null,
  );
}

export function openCart() {
  if (!drawer || drawer.classList.contains('is-open')) return;
  lastFocus = document.activeElement as HTMLElement;
  drawer.classList.add('is-open');
  document.documentElement.classList.add('drawer-open');
  lenis?.stop();
  requestAnimationFrame(() => drawer.querySelector<HTMLElement>('#cart-title')?.focus());
}
export function closeCart(restoreFocus = true) {
  if (!drawer?.classList.contains('is-open')) return;
  drawer.classList.remove('is-open');
  document.documentElement.classList.remove('drawer-open');
  lenis?.start();
  if (restoreFocus) lastFocus?.focus?.({ preventScroll: true });
}

export function initCart() {
  render();
  cart.subscribe(render);

  document.addEventListener('click', (e) => {
    const el = e.target as Element;
    const add = el.closest<HTMLElement>('[data-add-to-cart]');
    if (add) {
      e.preventDefault();
      const slug = add.dataset.slug!;
      let withBox = add.dataset.box !== '0';
      const from = add.dataset.boxFrom && document.querySelector<HTMLInputElement>(`${add.dataset.boxFrom}:checked`);
      if (from) withBox = from.value === '1';
      cart.add(slug, withBox);
      announce(`${catalog[slug]?.n ?? ''} נוסף לסל, ${boxLabel(withBox)}`);
      openCart();
      return;
    }
    if (el.closest('[data-cart-open]')) { e.preventDefault(); openCart(); return; }
    if (el.closest('[data-cart-close]')) {
      const link = el.closest('a[href]');
      closeCart(!link);
      if (!link) e.preventDefault();
      return;
    }
    const act = el.closest<HTMLElement>('[data-act]');
    const line = act?.closest<HTMLElement>('.line');
    if (act && line) {
      const slug = line.dataset.slug!;
      const box = line.dataset.box === '1';
      const cur = lines.find((l) => l.slug === slug && l.withBox === box);
      if (!cur) return;
      const kind = act.dataset.act;
      if (kind === 'inc') cart.setQty(slug, box, cur.qty + 1);
      if (kind === 'dec') cart.setQty(slug, box, cur.qty - 1);
      if (kind === 'swap') cart.setBox(slug, box, !box);
      // keep keyboard focus on the same control after re-render
      const again = body?.querySelector<HTMLElement>(`.line[data-slug="${slug}"][data-box="${kind === 'swap' ? (box ? 0 : 1) : box ? 1 : 0}"] [data-act="${kind}"]`);
      (again ?? drawer?.querySelector<HTMLElement>('#cart-title'))?.focus();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (!drawer?.classList.contains('is-open')) return;
    if (e.key === 'Escape') { e.preventDefault(); closeCart(); return; }
    if (e.key === 'Tab') {
      const f = focusables();
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement?.id === 'cart-title')) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
}
