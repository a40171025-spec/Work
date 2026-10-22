// Home page: the shop filter.
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
