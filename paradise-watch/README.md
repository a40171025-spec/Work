# Paradise Watch

Static store site (Astro 5), Hebrew RTL, mobile first. Orders go to WhatsApp 053-532-5643.

## בקצרה (לבעל החנות)
- **להחליף תמונות של שעון:** התמונות נמצאות ב־`public/assets/img/w/<שם-הדגם>-1.webp` (ו־`-2`, `-3`).
- **שמות, תיאורים ומחירים:** `src/data/products.ts` ו־`src/data/site.ts`.
- **התמונה בראש דף הבית:** `HERO_SLUG` ב־`src/data/products.ts` (התמונה הראשונה של הדגם).
- **מספר הזמנה:** כל הזמנה בוואטסאפ מקבלת מספר בצורה `PW-261019-4821` (תאריך + 4 ספרות).
- **רשימת הזמנות ב־Netlify (לא חובה):** ב־Netlify: Forms ← Enable form detection, ואז להעלות שוב את האתר. מאז כל הזמנה נשמרת גם שם (Forms ← order). בלי ההגדרה הזו ההזמנות מגיעות רק לוואטסאפ, כמו עכשיו.

## Commands
```bash
npm install
npm run dev            # local dev server
npm run build          # static site in dist/
npm run images -- <photos dir> scripts/photo-order.txt
npm run e2e            # needs `npm run build` + a server on :4321 (npx serve dist -l 4321)
```

## Pages
| Page | File | Notes |
|---|---|---|
| Home | `src/pages/index.astro` | photo intro, shop grid with filter, pair deal, packaging, price match, shipping, FAQ, contact |
| Product | `src/pages/products/[slug].astro` | gallery, box choice, add to cart, WhatsApp |
| Checkout | `src/pages/checkout.astro`, `src/scripts/checkout.ts` | form, order number, opens WhatsApp with the order |
| Policies | `terms`, `cancel`, `shipping` | |

Cart: `src/scripts/cart.ts` (drawer, localStorage `pw-cart`); prices and the pair deal: `src/data/pricing.ts`.
Phones get the header links in a menu (`Header.astro`, `src/scripts/common.ts`).
