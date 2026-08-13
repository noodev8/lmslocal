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
_shared/bleed.js    `?bleed` print-shop mode: sheet +3mm per side. Leaflets only.
_shared/social.css  Fixed-size canvas + screenshot desk. Social tiles only.
leaflet/            Print artwork. a5-test.html is the pipeline reference.
                    a5-landlord (pubs), a5-club (clubs), a5-workplace (offices),
                    a5-player (players).
social/             Fixed-size tiles for Facebook etc. See social/README.md.
out/                Exported PDFs and PNGs. Git-ignored — scratch.
press/              PDFs actually sent to a printer. Tracked. See press/README.md.
```

Exports are git-ignored on purpose: the artwork source is the HTML, which is already tracked, and
it regenerates in Chrome in two minutes on any machine. The exception is `press/` — a file a
printer has run is a record, and a reprint has to match it.

## Making a leaflet (PDF, not a screenshot)

A screenshot is ~96dpi and prints visibly soft. Print-to-PDF keeps text as vectors, so it stays
sharp at whatever resolution the printer runs, and print shops accept the PDF directly.

1. Open the HTML in Chrome.
2. `Ctrl+P` → Destination **Save as PDF**.
3. Paper size = the sheet's size (A5 for `a5-test.html`), Margins = **None**.
4. More settings → **Background graphics** ticked. Without it Chrome drops every fill and you
   get black text on white paper instead of the tinted stock.
5. **Headers and footers** unticked, or Chrome stamps the URL and the date onto the sheet.
6. Save into `out/`.

The fonts load from Google's CDN at print time, so check the finished PDF is actually set in
Big Shoulders and Instrument Sans — a flaky connection silently gives you a leaflet in Arial.
In Acrobat that is File → Properties → Fonts.

Dashed guides on screen mark the trim edge (red) and the safe area (dark). They are screen-only.

## Sending one to a print shop

Add `?bleed` to the URL — `a5-club.html?bleed`. `_shared/bleed.js` grows the sheet by 3mm on
every side with the artwork running into the extra, so the guillotine has something to cut into:
at exact trim size, the ±1mm drift that is normal in trimming leaves a white sliver down an edge
of an edge-to-edge design. The layout does not move, and the red dashes shift to the line that
gets cut. Print it with the same dialog settings as above.

The handoff is "**154 × 216mm, 3mm bleed, trims to A5**". No crop marks — there is no room for
them inside 3mm, and print shops impose their own.

It is opt-in rather than the default because the two files are for two different machines: an
office printer handed a 154 × 216mm page scales it to fit A4 and adds a margin, which loses the
edge-to-edge ground the design depends on. Print the plain file yourself, send the `?bleed` one.

Chrome exports RGB. A digital press takes that happily; if the shop is running litho they will
want CMYK, and `overprint` (`#C8341E`) is a saturated RGB red that dulls noticeably in the
conversion — worth asking which before approving a proof.

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
