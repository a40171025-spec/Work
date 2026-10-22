// Checkout: delivery details -> order message opened in WhatsApp (same message as the old site).
import { cart, catalog, summaryHTML } from './cart';
import { boxLabel, ils, PRICE_BOX, PRICE_NO_BOX, waLink } from '../data/site';

const empty = document.querySelector<HTMLElement>('[data-co-empty]');
const done = document.querySelector<HTMLElement>('[data-co-done]');
const main = document.querySelector<HTMLElement>('[data-co-main]');
const form = document.querySelector<HTMLFormElement>('[data-co-form]');
const list = document.querySelector<HTMLElement>('[data-co-lines]');
const sum = document.querySelector<HTMLElement>('[data-co-sum]');
const link = document.querySelector<HTMLAnchorElement>('[data-co-link]');
let finished = false;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Order number for the WhatsApp message (the old site took it from its database): PW-YYMMDD-NNNN. */
function orderId() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  let r = Math.floor(Math.random() * 10000);
  try { r = crypto.getRandomValues(new Uint32Array(1))[0] % 10000; } catch { /* old browsers: Math.random */ }
  return `PW-${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${String(r).padStart(4, '0')}`;
}

/** Copy of the order to Netlify Forms. Fire and forget: it never delays or blocks WhatsApp. */
function logOrder(fields: Record<string, string>) {
  try {
    const body = new URLSearchParams({ 'form-name': 'order', ...fields }).toString();
    fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, keepalive: true }).catch(() => {});
  } catch { /* no fetch: WhatsApp still opens */ }
}

function render() {
  if (finished) return;
  const lines = cart.lines;
  if (empty) empty.hidden = lines.length > 0;
  if (main) main.hidden = lines.length === 0;
  if (!lines.length || !list || !sum) return;
  list.innerHTML = lines
    .map((l) => `<li><span><span class="latin">${esc(catalog[l.slug].n)}</span> · ${boxLabel(l.withBox)} × ${l.qty}</span><span>${ils((l.withBox ? PRICE_BOX : PRICE_NO_BOX) * l.qty)}</span></li>`)
    .join('');
  sum.innerHTML = summaryHTML(cart.totals());
}
render();
cart.subscribe(render);

const rules: Record<string, [(v: string) => boolean, string]> = {
  name: [(v) => v.length >= 2 && v.length <= 100, 'נא להזין שם מלא'],
  phone: [(v) => /^[0-9+\-\s]{9,15}$/.test(v), 'מספר טלפון לא תקין'],
  city: [(v) => v.length >= 2 && v.length <= 100, 'נא להזין עיר'],
  address: [(v) => v.length >= 2 && v.length <= 200, 'נא להזין כתובת'],
};

form?.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!cart.lines.length) { render(); return; } // never send an order without watches
  const fd = new FormData(form);
  const d = Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v).trim()])) as Record<string, string>;
  let firstBad: HTMLElement | null = null;
  for (const [k, [ok, msg]] of Object.entries(rules)) {
    const input = form.querySelector<HTMLInputElement>(`[name="${k}"]`)!;
    const err = document.getElementById(`${k}-err`)!;
    const bad = !ok(d[k] ?? '');
    input.setAttribute('aria-invalid', String(bad));
    err.hidden = !bad;
    err.textContent = bad ? msg : '';
    if (bad && !firstBad) firstBad = input;
  }
  if (firstBad) { firstBad.focus(); return; }

  const lines = cart.lines;
  const t = cart.totals();
  const items = lines
    .map((l) => {
      const p = catalog[l.slug];
      return `• ${p.n} — ${boxLabel(l.withBox)} × ${l.qty} (${ils((l.withBox ? PRICE_BOX : PRICE_NO_BOX) * l.qty)})${p.pre ? ' [הזמנה מראש]' : ''}`;
    })
    .join('\n');
  const notes = (d.notes ?? '').slice(0, 1000);
  const id = orderId();
  const text =
    `הזמנה חדשה מ־Paradise Watch 🛍️\nמספר הזמנה: ${id}\n\n${items}\n\n` +
    `כמות: ${t.qty}\nסכום ביניים: ${ils(t.subtotal)}${t.discount ? `\nמבצע זוגי: -${ils(t.discount)}` : ''}\n` +
    `משלוח: ${t.shipping ? ils(t.shipping) : 'חינם'}\nסה״כ לתשלום: ${ils(t.total)}\nתשלום: מזומן לשליח\n\n` +
    `שם: ${d.name}\nטלפון: ${d.phone}\nעיר: ${d.city}\nכתובת: ${d.address}${notes ? `\nהערות: ${notes}` : ''}`;
  const url = waLink(text);
  logOrder({
    'order-id': id, name: d.name, phone: d.phone, city: d.city, address: d.address,
    items: items.replace(/^• /gm, ''), total: ils(t.total), notes,
  });
  finished = true;
  cart.clear();
  if (main) main.hidden = true;
  if (empty) empty.hidden = true;
  if (link) link.href = url;
  const idEl = document.querySelector<HTMLElement>('[data-co-id]');
  if (idEl) idEl.textContent = id;
  if (done) { done.hidden = false; done.focus(); }
  window.location.href = url;
});
