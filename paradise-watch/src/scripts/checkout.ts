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
  const text =
    `הזמנה חדשה מ־Paradise Watch 🛍️\n\n${items}\n\n` +
    `כמות: ${t.qty}\nסכום ביניים: ${ils(t.subtotal)}${t.discount ? `\nמבצע זוגי: -${ils(t.discount)}` : ''}\n` +
    `משלוח: ${t.shipping ? ils(t.shipping) : 'חינם'}\nסה״כ לתשלום: ${ils(t.total)}\nתשלום: מזומן לשליח\n\n` +
    `שם: ${d.name}\nטלפון: ${d.phone}\nעיר: ${d.city}\nכתובת: ${d.address}${notes ? `\nהערות: ${notes}` : ''}`;
  const url = waLink(text);
  finished = true;
  cart.clear();
  if (main) main.hidden = true;
  if (empty) empty.hidden = true;
  if (link) link.href = url;
  if (done) { done.hidden = false; done.focus(); }
  window.location.href = url;
});
