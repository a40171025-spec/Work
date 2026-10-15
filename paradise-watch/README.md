# Paradise Watch — 3D redesign

Static site (Astro 5 + Lenis), Hebrew RTL, mobile first. Orders go to WhatsApp 053-532-5643.

## בקצרה (לבעל החנות)
- **להחליף את סרטון הפתיחה:** שמים את הסרטון החדש ומריצים פקודה אחת (למטה). הסקריפט מוצא לבד סיבוב מלא של 360°.
- **להחליף תמונות של שעון:** התמונות נמצאות ב־`public/assets/img/w/<שם-הדגם>-1.webp` (ו־`-2`, `-3`).
- **שמות, תיאורים ומחירים:** `src/data/products.ts` ו־`src/data/site.ts`.
- **אילו שעונים מופיעים בסרט הכהה:** `FILM_SLUGS` ב־`src/data/products.ts`.

## Commands
```bash
npm install
npm run dev            # local dev server
npm run build          # static site in dist/
npm run frames -- path/to/hero-watch.mp4 [--dial X,Y] [--mobile-x X] [--start N --end N]
npm run images -- <photos dir> scripts/photo-order.txt
npm run e2e            # needs `npm run build` + a server on :4321 (npx serve dist -l 4321)
```

## How the home page works
| Scene | File | Notes |
|---|---|---|
| Loader | `src/components/Loader.astro`, `src/scripts/home.ts` | thin-line drawing of frame 0 on a moving grid, real % of the first frames, scanline reveal |
| Opening spin | `src/components/Hero.astro`, `src/scripts/hero.ts` | 520vh pinned section, WebP frames on a canvas (cover fit, DPR ≤ 2, smoothed), frame 0 → every 8th → 4th → 2nd → all, nearest loaded frame fallback, glass cards at set angles |
| Enter the dial | `src/scripts/hero.ts` | zoom to the dial + expanding circle into the dark scene, caption "נכנסים פנימה." |
| Collection film | `src/components/Film.astro`, `src/scripts/film.ts` | dark pinned stage, camera dolly past real photos, spotlight, reflection, light sweep; photos load only when near |
| Shop and info | `src/pages/index.astro` | grid with filter, pair deal, packaging, shipping, FAQ, contact |

Fallbacks: `prefers-reduced-motion` or Save-Data/2G → poster only and a static film list; 3G → silent loop video.

## Frame pipeline
`scripts/build_frames.py` finds cuts and looks for one full turn in the first shot (the frame that matches frame 0 again
after the picture moved furthest from it). Without a full turn it uses the first shot and the page shows progress in %
instead of degrees. Output goes to `public/assets/hero/<hash>/` and `src/data/hero-manifest.json`.
