# lmslocal-marketing

Print and social artwork: leaflets, Facebook posts, anything that ends up as a PDF or a PNG
rather than a page on the site.

**This folder is not part of any app.** It has no `package.json`, no build step, no
`node_modules`, and nothing here is imported by `lmslocal-web`, `lmslocal-admin` or the server.
Deleting it would not affect a single deploy. Open the HTML files directly in Chrome
(`file:///C:/lmslocal/lmslocal-marketing/...`) — no dev server needed.

It is kept out of `lmslocal-web/public/` on purpose: anything under `public/` ships with the site
and is reachable by URL, so a half-finished leaflet would be live on the internet.

## Layout

```
_shared/brand.js    Tailwind token config + Google Fonts. Load on every page.
_shared/print.css   Print rules, screen preview desk, trim/safe guides. Leaflets only.
_shared/social.css  Fixed-size canvas + screenshot desk. Social tiles only.
leaflet/            Print artwork. a5-test.html is the pipeline reference.
                    a5-landlord (pubs), a5-club (clubs), a5-workplace (offices),
                    a5-player (players).
social/             Fixed-size tiles for Facebook etc. See social/README.md.
out/                Exported PDFs and PNGs. Git-ignored.
```

## Making a leaflet (PDF, not a screenshot)

A screenshot is ~96dpi and prints visibly soft. Print-to-PDF keeps text as vectors, so it stays
sharp at whatever resolution the printer runs, and print shops accept the PDF directly.

1. Open the HTML in Chrome.
2. `Ctrl+P` → Destination **Save as PDF**.
3. Paper size = the sheet's size (A5 for `a5-test.html`), Margins = **None**.
4. More settings → **Background graphics** ticked. Without it Chrome drops every fill and you
   get black text on white paper instead of the tinted stock.
5. Save into `out/`.

Dashed guides on screen mark the trim edge (red) and the 5mm safe area (dark). They are
`display: none` in print. If a print shop asks for bleed, say so — the sheet needs rebuilding
3mm larger on each side with the background running into it.

## Making a social tile (screenshot is fine here)

Facebook sizes are fixed pixel canvases, so a 1:1 screenshot is already native resolution.

- 1080×1080 square feed
- 1080×1350 portrait feed (reaches furthest)
- 1080×1920 story

Screenshot at device pixel ratio 1 — on a HiDPI screen use Chrome DevTools' device toolbar and
set DPR to 1, or the tile comes out 2160px and Facebook re-compresses it.

## Brand

The artwork follows `docs/design-system.md` — the pools-coupon system. The rules that get broken
most often:

- **Two inks.** `ink` and `overprint`, nothing else. `overprint` is scarce: eliminations, one
  primary action, an eyebrow. A leaflet with lots of red is wrong.
- **`font-data` (Courier Prime) is only for things a person filled in** — names, picks, figures.
  Never headings, labels or buttons.
- No invented testimonials, no invented numbers. See the honesty rules in the design system doc.
- **The money angle is per-audience, not global.** Clubs are sold on fundraising, pubs on
  footfall — `a5-club.html` and `a5-landlord.html` are not rewordings of each other and must not
  drift into one. Never promise an amount. See §5 of `docs/marketing-strategy.md`.

`_shared/brand.js` duplicates the tokens from `lmslocal-web/tailwind.config.js` because these
pages have no build step. **If the app's tokens change, update `brand.js` too** — a leaflet whose
red is a shade off the website's red is worse than no leaflet.
