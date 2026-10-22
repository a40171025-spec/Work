# Paradise Watch — 3D redesign

Static site (Astro 5 + Lenis), Hebrew RTL, mobile first. Orders go to WhatsApp 053-532-5643.

## בקצרה (לבעל החנות)
- **להחליף את סרטון הפתיחה:** שולחים סרטון סיבוב חדש, ומריצים פקודה אחת (למטה). הסקריפט מוצא לבד סיבוב מלא של 360°, וגם סרטון אנכי מהטלפון עובד.
- **להחליף תמונות של שעון:** התמונות נמצאות ב־`public/assets/img/w/<שם-הדגם>-1.webp` (ו־`-2`, `-3`).
- **שמות, תיאורים ומחירים:** `src/data/products.ts` ו־`src/data/site.ts`.
- **אילו שעונים מופיעים בסרט הכהה:** `FILM_SLUGS` ב־`src/data/products.ts`.
- **מספר הזמנה:** כל הזמנה בוואטסאפ מקבלת מספר בצורה `PW-261019-4821` (תאריך + 4 ספרות).
- **רשימת הזמנות ב־Netlify (לא חובה):** ב־Netlify: Forms ← Enable form detection, ואז להעלות שוב את האתר. מאז כל הזמנה נשמרת גם שם (Forms ← order). בלי ההגדרה הזו ההזמנות מגיעות רק לוואטסאפ, כמו עכשיו.

## Commands
```bash
npm install
npm run dev            # local dev server
npm run build          # static site in dist/
npm run frames -- path/to/hero-watch.mp4 [--dry-run] [--full | --no-full] [--start N --end N]
                       #   [--dial X,Y] [--mobile-x X] [--max 120] [--budget-mb 7.8]
npm run images -- <photos dir> scripts/photo-order.txt
npm run e2e            # needs `npm run build` + a server on :4321 (npx serve dist -l 4321)
```

## How the home page works
| Scene | File | Notes |
|---|---|---|
| Loader | `src/components/Loader.astro`, `src/scripts/home.ts` | thin-line drawing of frame 0 on a moving grid, real % of the first frames, scanline reveal |
| Opening spin | `src/components/Hero.astro`, `src/scripts/hero.ts` | 520vh pinned section, WebP frames on a canvas (cover fit, DPR ≤ 2, smoothed), frame 0 → every 8th → 4th → 2nd → all, nearest loaded frame fallback, glass cards at set angles |
| Enter the dial | `src/scripts/hero.ts` | zoom to the dial (`dial` / `dialM` in the manifest) + expanding circle into the dark scene, caption "נכנסים פנימה." |
| Collection film | `src/components/Film.astro`, `src/scripts/film.ts` | dark pinned stage, camera dolly past real photos, spotlight, reflection, light sweep; photos load only when near |
| Shop and info | `src/pages/index.astro` | grid with filter, pair deal, packaging, shipping, FAQ, contact |

Fallbacks: `prefers-reduced-motion` or Save-Data/2G → poster only and a static film list; 3G → silent loop video.
Phones get the header links in a menu (`Header.astro`, `src/scripts/common.ts`).

## Frame pipeline
`scripts/build_frames.py` reads the video once at thumbnail size, finds cuts, and looks for one full turn in the first
shot by comparing the edges in the middle of each frame with the first frame (a still background cannot hide the
turn). Run it with `--dry-run` first: it prints the cuts, the range and whether it found a full turn. Without a turn
it uses the first shot and the page shows progress in % instead of degrees; `--full` / `--no-full` override the
detection. Vertical phone videos give 16:9 desktop frames with soft blurred sides; HDR clips are tone-mapped. WebP
quality steps down until desktop + phone frames together fit `--budget-mb`. Output goes to
`public/assets/hero/<hash>/` (old folders are deleted) and `src/data/hero-manifest.json`.
