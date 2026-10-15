// Product page: photo thumbnails and the box choice (price, deal line, WhatsApp text).
const root = document.querySelector<HTMLElement>('[data-product]');
if (root) {
  const main = root.querySelector<HTMLImageElement>('[data-main]');
  const thumbs = [...root.querySelectorAll<HTMLButtonElement>('[data-thumb]')];
  const name = root.querySelector('h1')?.textContent ?? '';
  thumbs.forEach((btn) =>
    btn.addEventListener('click', () => {
      if (!main) return;
      main.src = btn.dataset.src!;
      main.srcset = btn.dataset.srcset!;
      main.alt = `שעון ${name} — תמונה ${Number(btn.dataset.thumb) + 1}`;
      thumbs.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    }),
  );

  const price = root.querySelector<HTMLElement>('[data-price]');
  const deal = root.querySelector<HTMLElement>('[data-deal]');
  const wa = root.querySelector<HTMLAnchorElement>('[data-wa]');
  const add = root.querySelector<HTMLElement>('[data-add-to-cart]');
  root.querySelectorAll<HTMLInputElement>('input[name=box]').forEach((r) =>
    r.addEventListener('change', () => {
      const withBox = r.value === '1';
      if (price) price.textContent = withBox ? '₪299' : '₪199';
      if (deal) deal.textContent = `🎁 מבצע זוגי: 2 ${withBox ? 'בקופסה ממותגת ב־₪499' : 'בקופסה רגילה ב־₪332'} — אוטומטית בעגלה.`;
      if (wa) wa.href = (withBox ? wa.dataset.waBox : wa.dataset.waPlain) ?? wa.href;
      if (add) add.dataset.box = withBox ? '1' : '0';
    }),
  );
}
