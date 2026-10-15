// End-to-end checks on the built site (run `npm run build` and serve dist first).
// Usage: node tests/e2e.cjs http://localhost:4321
// Needs Playwright (the global install is fine: NODE_PATH=$(npm root -g)).
const { chromium, devices } = require('playwright');
const assert = require('assert/strict');
const BASE = process.argv[2] || 'http://localhost:4321';

const results = [];
async function check(name, fn) {
  try { await fn(); results.push(['ok', name]); }
  catch (e) { results.push(['FAIL', name, e.message.split('\n')[0]]); }
}

async function totals(page) {
  return page.evaluate(() => {
    const sum = document.querySelector('[data-cart-sum]');
    const rows = {};
    sum.querySelectorAll('div').forEach((d) => { rows[d.querySelector('dt').textContent.trim()] = d.querySelector('dd').textContent.trim(); });
    return rows;
  });
}
const setCart = (page, lines) => page.evaluate((l) => { localStorage.setItem('pw-cart', JSON.stringify(l)); }, lines);

(async () => {
  const browser = await chromium.launch();

  // ---- pricing scenarios through the real drawer ----
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  await page.goto(BASE + '/products/monarch-ice');
  const scenarios = [
    { name: '1 with box: 299 + 50 shipping', lines: [{ slug: 'monarch-ice', withBox: true, qty: 1 }], total: '₪349', ship: '₪50' },
    { name: '2 with box: pair 499 + 50', lines: [{ slug: 'monarch-ice', withBox: true, qty: 1 }, { slug: 'petite-roma', withBox: true, qty: 1 }], total: '₪549', ship: '₪50', deal: '-₪99' },
    { name: '2 without box: pair 332 + 50', lines: [{ slug: 'monarch-ice', withBox: false, qty: 2 }], total: '₪382', ship: '₪50', deal: '-₪66' },
    { name: '1 box + 1 no box: no pair deal', lines: [{ slug: 'monarch-ice', withBox: true, qty: 1 }, { slug: 'marina-noir', withBox: false, qty: 1 }], total: '₪548', ship: '₪50' },
    { name: '3 with box: 499 + 299, free shipping', lines: [{ slug: 'monarch-ice', withBox: true, qty: 3 }], total: '₪798', ship: 'חינם', deal: '-₪99' },
    { name: '4 with box: 2 pairs, free shipping', lines: [{ slug: 'monarch-ice', withBox: true, qty: 4 }], total: '₪998', ship: 'חינם', deal: '-₪198' },
    { name: '2 box + 2 no box: both pairs', lines: [{ slug: 'monarch-ice', withBox: true, qty: 2 }, { slug: 'octa-midnight', withBox: false, qty: 2 }], total: '₪831', ship: 'חינם', deal: '-₪165' },
  ];
  for (const s of scenarios) {
    await check(s.name, async () => {
      await setCart(page, s.lines);
      await page.reload();
      await page.click('[data-cart-open]');
      await page.waitForSelector('#cart.is-open');
      const t = await totals(page);
      assert.equal(t['סה״כ לתשלום'], s.total);
      assert.equal(t['משלוח (מרכז ודרום)'], s.ship);
      if (s.deal) assert.equal(t['מבצע זוגי 🎁'], s.deal);
      else assert.equal(t['מבצע זוגי 🎁'], undefined);
    });
  }

  // ---- product page: box choice, add, swap, qty ----
  await check('product page adds the chosen box option', async () => {
    await setCart(page, []);
    await page.reload();
    await page.click('label.opt:has(input[value="0"])');
    assert.equal((await page.textContent('[data-price]')).trim(), '₪199');
    assert.match(await page.textContent('[data-deal]'), /₪332/);
    const wa = await page.getAttribute('[data-wa]', 'href');
    assert.match(decodeURIComponent(wa), /קופסה קטנה ורגילה \(₪199\)/);
    await page.click('.buy [data-add-to-cart]');
    await page.waitForSelector('#cart.is-open');
    const lines = await page.evaluate(() => JSON.parse(localStorage.getItem('pw-cart')));
    assert.deepEqual(lines, [{ slug: 'monarch-ice', withBox: false, qty: 1 }]);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'cart-title');
  });
  await check('drawer swap box + quantity buttons + Escape', async () => {
    await page.click('.line [data-act="swap"]');
    let lines = await page.evaluate(() => JSON.parse(localStorage.getItem('pw-cart')));
    assert.deepEqual(lines, [{ slug: 'monarch-ice', withBox: true, qty: 1 }]);
    await page.click('.line [data-act="inc"]');
    lines = await page.evaluate(() => JSON.parse(localStorage.getItem('pw-cart')));
    assert.equal(lines[0].qty, 2);
    assert.equal((await totals(page))['סה״כ לתשלום'], '₪549');
    await page.click('.line [data-act="dec"]');
    await page.click('.line [data-act="dec"]');
    assert.match(await page.textContent('[data-cart-body]'), /הסל ריק/);
    await page.keyboard.press('Escape');
    await page.waitForSelector('#cart:not(.is-open)');
    assert.equal(await page.getAttribute('[data-cart-count]', 'hidden'), '');
  });

  // ---- checkout -> WhatsApp ----
  await check('checkout validates and opens WhatsApp with the full order', async () => {
    await setCart(page, [
      { slug: 'regent-rose-emerald', withBox: true, qty: 1 },
      { slug: 'regent-navy', withBox: true, qty: 1 },
    ]);
    let waUrl = null;
    await page.route(/wa\.me/, (route) => { waUrl = route.request().url(); route.abort(); });
    await page.goto(BASE + '/checkout');
    await page.click('[data-co-form] button[type=submit]');
    assert.equal(await page.getAttribute('#name', 'aria-invalid'), 'true');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'name');
    await page.fill('#name', 'ישראל ישראלי');
    await page.fill('#phone', '050-1234567');
    await page.fill('#city', 'תל אביב');
    await page.fill('#address', 'הרצל 1');
    await page.fill('#notes', 'בערב');
    await Promise.all([page.waitForRequest(/wa\.me/).catch(() => null), page.click('[data-co-form] button[type=submit]')]);
    await page.waitForTimeout(300);
    assert.ok(waUrl, 'no WhatsApp navigation');
    const u = new URL(waUrl);
    assert.equal(u.pathname, '/972535325643');
    const text = u.searchParams.get('text');
    for (const part of ['Regent Rose Emerald — קופסה ממותגת × 1 (₪299)', 'Regent Navy — קופסה ממותגת × 1 (₪299) [הזמנה מראש]', 'מבצע זוגי: -₪99', 'משלוח: ₪50', 'סה״כ לתשלום: ₪549', 'שם: ישראל ישראלי', 'טלפון: 050-1234567', 'כתובת: הרצל 1', 'הערות: בערב']) {
      assert.ok(text.includes(part), `missing: ${part}`);
    }
    await page.unroute(/wa\.me/);
    await page.goto(BASE + '/checkout');
    const left = await page.evaluate(() => JSON.parse(localStorage.getItem('pw-cart')));
    assert.deepEqual(left, []);
    assert.equal(await page.isVisible('[data-co-empty]'), true);
  });

  // ---- SEO basics on every page type ----
  const seoPages = [
    ['/', 'Paradise Watch | שעונים במראה יוקרתי ב־₪299 עם קופסה', ['Store', 'FAQPage', 'ItemList']],
    ['/products/aurelia-turquoise', 'Aurelia Turquoise | שעון ב־₪299 עם קופסה | Paradise Watch', ['Store', 'Product', 'BreadcrumbList']],
    ['/products/regent-navy', 'Regent Navy | שעון ב־₪299 עם קופסה | Paradise Watch', ['Store', 'Product', 'BreadcrumbList']],
    ['/terms', 'תקנון האתר | Paradise Watch', ['Store']],
    ['/cancel', 'ביטול עסקה | Paradise Watch', ['Store']],
    ['/shipping', 'משלוחים ותשלום | Paradise Watch', ['Store']],
  ];
  for (const [path, title, types] of seoPages) {
    await check(`SEO ${path}`, async () => {
      await page.goto(BASE + path);
      assert.equal(await page.title(), title);
      assert.equal(await page.locator('h1').count(), 1);
      assert.ok((await page.getAttribute('meta[name=description]', 'content')).length > 40);
      assert.match(await page.getAttribute('link[rel=canonical]', 'href'), /^https:\/\//);
      const ld = await page.$$eval('script[type="application/ld+json"]', (s) => s.map((x) => JSON.parse(x.textContent)['@type']));
      for (const t of types) assert.ok(ld.includes(t), `missing JSON-LD ${t}`);
      const noAlt = await page.$$eval('img', (imgs) => imgs.filter((i) => !i.hasAttribute('alt')).length);
      assert.equal(noAlt, 0);
      assert.equal(await page.getAttribute('html', 'dir'), 'rtl');
      assert.equal(await page.getAttribute('html', 'lang'), 'he');
    });
  }
  await check('home h1 text unchanged', async () => {
    await page.goto(BASE + '/');
    assert.equal((await page.textContent('h1')).replace(/\s+/g, ' ').trim(), 'שעונים במראה יוקרתי, במחיר נגיש');
  });
  await check('17 products in the shop, 1 for women', async () => {
    assert.equal(await page.locator('.shop .pcard').count(), 17);
    await page.click('[data-filter="women"]');
    assert.equal(await page.locator('.shop .pcard:not([hidden])').count(), 1);
    await page.click('[data-filter="men"]');
    assert.equal(await page.locator('.shop .pcard:not([hidden])').count(), 16);
    await page.click('[data-filter="all"]');
    assert.equal(await page.locator('.shop .pcard:not([hidden])').count(), 17);
  });
  await check('no Nautica / Aqua Noir anywhere on the site', async () => {
    for (const path of ['/', '/sitemap.xml']) {
      const res = await page.goto(BASE + path);
      const body = await res.text();
      assert.ok(!/nautica|aqua-noir|Aqua Noir/i.test(body), path);
    }
  });
  await check('preorder badges on Regent Navy and Urban Black only', async () => {
    await page.goto(BASE + '/');
    const pre = await page.$$eval('.shop .pcard', (cards) => cards.filter((c) => c.querySelector('.badge:not(.badge--light)')).map((c) => c.querySelector('.pcard__name').textContent.trim()));
    assert.deepEqual(pre.sort(), ['Regent Navy', 'Urban Black']);
  });
  await check('water resistance wording, no 30m claim', async () => {
    const pages = ['/', '/terms', '/shipping', '/products/monarch-ice'];
    for (const path of pages) {
      const res = await page.goto(BASE + path);
      const body = await res.text();
      assert.ok(!/30\s*(מטר|m\b|מ׳)/.test(body), `30m claim on ${path}`);
    }
  });
  await check('sitemap lists home, policies and 17 products', async () => {
    const res = await page.goto(BASE + '/sitemap.xml');
    const xml = await res.text();
    assert.equal((xml.match(/<loc>/g) || []).length, 21);
  });

  // ---- keyboard: hero card button scrolls its moment into view ----
  await check('keyboard focus on a hidden hero card brings it on screen', async () => {
    const p2 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await p2.goto(BASE + '/');
    await p2.waitForFunction(() => !document.querySelector('.loader'), null, { timeout: 15000 });
    await p2.focus('.gcard[data-pos="d"] [data-add-to-cart]');
    await p2.waitForTimeout(1200);
    const op = await p2.$eval('.gcard[data-pos="d"]', (el) => Number(getComputedStyle(el).opacity));
    assert.ok(op > 0.6, `opacity ${op}`);
    await p2.keyboard.press('Enter');
    await p2.waitForSelector('#cart.is-open');
    const lines = await p2.evaluate(() => JSON.parse(localStorage.getItem('pw-cart')));
    assert.deepEqual(lines, [{ slug: 'aurelia-turquoise', withBox: true, qty: 1 }]);
    await p2.close();
  });

  // ---- phone: two taps from the opening to the cart ----
  await check('iPhone: "לקולקציה" then "הוספה לסל" opens the cart', async () => {
    const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } });
    const p3 = await ctx.newPage();
    await p3.goto(BASE + '/');
    await p3.waitForFunction(() => !document.querySelector('.loader'), null, { timeout: 15000 });
    await p3.tap('.hero__actions a[href="#collection"]');
    await p3.waitForTimeout(700);
    const top = await p3.$eval('#collection', (el) => el.getBoundingClientRect().top);
    assert.ok(Math.abs(top - 64) < 80, `collection top ${top}`);
    await p3.tap('.shop .pcard [data-add-to-cart]');
    await p3.waitForSelector('#cart.is-open');
    const overflow = await p3.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert.equal(overflow, 0);
    await ctx.close();
  });

  await browser.close();
  for (const r of results) console.log(r.join('  '));
  const failed = results.filter((r) => r[0] === 'FAIL').length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})();
