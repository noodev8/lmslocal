# lmslocal-marketing

Print and social artwork — anything that ends as a PDF, PNG or MP4 rather than a page on the
site. Plain HTML + Tailwind CDN: no `package.json`, no build, imported by nothing. Kept out of
`lmslocal-web/public/` so half-finished artwork is never live.

```
make-pdf.js    leaflet → print-ready PDF in out/      (needs Chrome; Ghostscript for print shops)
make-png.js    social/og-*.html → lmslocal-web/public/ (link preview images, committed there)
make-video.js  video/film.html → out/*.mp4             (needs ffmpeg)
_shared/       brand tokens, print/bleed/social CSS
leaflet/       A5 print artwork        social/   Facebook tiles and OG sources
video/         promo film + storyboard ai-brief/ briefs for outside AI tools
list/          mailing-list builder    press/    PDFs a printer actually ran (tracked)
out/           exports — git-ignored scratch
```

## Rules

- **Never print by hand.** `node make-pdf.js <leaflet>` (add `--home` for your own printer). A
  `file://` page silently falls back to Arial for two brand fonts, and print shops reject live
  fonts — the script serves over http and outlines the text with Ghostscript.
- Print-shop build uses `?bleed` (+3mm per side). Handoff: "154 × 216mm, 3mm bleed, trims to A5".
  `a5-landlord-post.html` is double sided — tell the printer "double sided, long edge".
- **Check every QR scans** from the finished PDF. `a5-club-a`, `a5-club-b` and `a5-landlord`
  carry per-sheet QR codes (`/club-a`, `/club-b`, `/bar-a`) so scans can be counted in Vercel
  Analytics; don't swap them for the generic `assets/site-qr.png`. The printed URL and the PNG
  change together.
- OG images: rerun `make-png.js` after editing `social/og-*.html`, commit the PNG, and keep its
  copy in step with the metadata in `lmslocal-web/src/app/layout.tsx` / `join/[code]/layout.tsx`.
- Video: rendered frame by frame from `seek(t)`, retimed only via the `CUT` array in `film.html`.
  Scenes use real screenshots in `video/shots/`; silent with burned-in captions.
- Brand: follows `docs/design-system.md` — two inks, red used sparingly, Courier Prime only for
  filled-in data, no invented testimonials or numbers, never promise an amount.
  `_shared/brand.js` **duplicates `lmslocal-web/tailwind.config.js`** — change both.
