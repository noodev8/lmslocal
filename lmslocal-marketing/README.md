# lmslocal-marketing

Print and social artwork: leaflets, Facebook posts, anything that ends up as a PDF or a PNG
rather than a page on the site.

**This folder is not part of any app.** It has no `package.json`, no build step, no
`node_modules`, and nothing here is imported by `lmslocal-web`, `lmslocal-admin` or the server.
Deleting it would not affect a single deploy.

You can open the HTML files straight in Chrome to look at them. **Do not print from there** —
a leaflet opened as a `file://` page silently loses two of the three brand fonts and Chrome
substitutes Arial, which looks close enough to pass unnoticed all the way to the print shop.
Use `make-pdf.js` for anything you intend to print.

It is kept out of `lmslocal-web/public/` on purpose: anything under `public/` ships with the site
and is reachable by URL, so a half-finished leaflet would be live on the internet.

## Layout

```
make-pdf.js         Build a print-ready PDF from a leaflet. Start here.
make-png.js         Render an OG image to lmslocal-web/public/. Tiles only.
_shared/brand.js    Tailwind token config + Google Fonts. Load on every page.
_shared/print.css   Print rules, screen preview desk, trim/safe guides. Leaflets only.
_shared/bleed.js    `?bleed` print-shop mode: sheet +3mm per side. Leaflets only.
_shared/social.css  Fixed-size canvas + screenshot desk. Social tiles only.
_shared/bare.js     `?bare` screenshot mode: strips the desk. make-png.js only.
leaflet/            Print artwork. a5-test.html is the pipeline reference.
                    a5-landlord (pubs), a5-club (clubs), a5-workplace (offices),
                    a5-player (players). a5-player-1992 is a one-off for a single
                    competition code — copy that pattern per competition, and the
                    printed code and its QR in assets/ must change together.
                    a5-landlord-post is the only double-sided piece — see below.
social/             Fixed-size tiles for Facebook etc. See social/README.md.
ai-brief/           Prompts for generating artwork with an image model instead of
                    laying it out here. Clubs only so far. See ai-brief/README.md.
out/                Exported PDFs and PNGs. Git-ignored — scratch.
press/              PDFs actually sent to a printer. Tracked. See press/README.md.
```

Exports are git-ignored on purpose: the artwork source is the HTML, which is already tracked, and
`make-pdf.js` regenerates the PDF on any machine in seconds. The exception is `press/` — a file a
printer has run is a record, and a reprint has to match it.

## Making a PDF

```bash
cd lmslocal-marketing
node make-pdf.js a5-player-1992          # for a print shop
node make-pdf.js a5-player-1992 --home   # to print on your own printer
```

The file lands in `out/`. The print-shop one is ready to upload as-is. Run it with no arguments
to list the leaflets.

**Use the script rather than Ctrl+P.** Printing by hand needs four dialog settings right and
gets two things wrong that do not show up until the leaflets are printed:

- Opening a leaflet as a `file://` page **silently loses two of the three brand fonts** and
  Chrome substitutes Arial. The sheet still looks fine, so it passes the eye. The script serves
  the folder over http instead, where the fonts load correctly.
- Print shops **reject live fonts** and want the text as outlines — vector shapes instead of
  characters. Vistaprint rejects the file outright. Chrome's dialog cannot do this; the script
  runs the finished PDF through Ghostscript's `-dNoOutputFonts`.

The script needs Chrome and, for the print-shop version,
[Ghostscript](https://ghostscript.com/releases/gsdnld.html). It finds both itself.

Whatever produced it, **check the QR scans** by pointing a phone at the finished PDF on screen.
It is the one element where a silent failure costs the whole print run.

Dashed guides on screen mark the trim edge (red) and the safe area (dark). They are screen-only.

## What the print-shop version does differently

It uses the `?bleed` variant — `_shared/bleed.js` grows the sheet 3mm on every side with the
artwork running into the extra, so the guillotine has something to cut into. At exact trim size,
the ±1mm drift that is normal in trimming leaves a white sliver down an edge of an edge-to-edge
design. The layout does not move, and on screen the red dashes shift to the line that gets cut.

The handoff is "**154 × 216mm, 3mm bleed, trims to A5**". No crop marks — there is no room for
them inside 3mm, and print shops impose their own.

Bleed is not the default because the two files are for different machines: an office printer
handed a 154 × 216mm page scales it to fit A4 and adds a margin, which loses the edge-to-edge
ground the design depends on. That is what `--home` is for.

You can still open `a5-club.html?bleed` in a browser to *look* at the bleed version. Just do not
print from there — see above.

Chrome exports RGB. A digital press takes that happily; if the shop is running litho they will
want CMYK, and `overprint` (`#C8341E`) is a saturated RGB red that dulls noticeably in the
conversion — worth asking which before approving a proof.

## Posting one instead of leaving one

`a5-landlord-post.html` is the pub leaflet reworked to go in an envelope. It exists because a
posted piece and a bar-top piece are not the same object: the leaflet you leave has **you**
standing next to it to answer "who is going to run this", and the one you post does not. So the
back page is a signed note that does that job — why it came by post, what happens if they say
yes, and a phone number set larger than anything else on the sheet.

It is **the only double-sided piece here**, which changes two things:

- **Tell the printer double sided, long edge.** Simplex posts the pitch with a blank back and
  loses the whole reason the piece exists. `make-pdf.js` needs no flag — the file is two `.sheet`
  divs and comes out two pages — but nothing in the PDF says "print these back to back".
- **Both sides must stay the same size and the same `.safe` padding.** `_shared/bleed.js`
  measures the *first* `.sheet` and the *first* `.safe`, then applies what it measured to all of
  them. Correct for a matched pair, silently wrong for a mixed one.

It goes in an envelope, not out as a self-mailer: there is no address panel and no stamp box, and
adding one would turn a letter into something that reads as junk before it is opened.

The QR on the back is `assets/site-qr.png` — plain `https://lmslocal.co.uk`, no competition code,
so it does not go stale. It was generated with the same settings the in-app leaflet uses
(error correction `H`, margin 2), because this one also ends up creased in a pub:

```bash
cd lmslocal-web && node -e "require('qrcode').toFile( \
  '../lmslocal-marketing/assets/site-qr.png', 'https://lmslocal.co.uk', \
  {width:600, margin:2, errorCorrectionLevel:'H', color:{dark:'#1C2620', light:'#F2F3EC'}})"
```

It is also the QR for anything generated from `ai-brief/` — an image model cannot draw a
scannable one, so the artwork leaves a square and this file is composited in.

**The two club leaflets do not use it.** `a5-club-a.html` and `a5-club-b.html` carry
`assets/club-a-qr.png` and `club-b-qr.png`, which resolve to `lmslocal.co.uk/club-a` and
`/club-b` — same settings, different URL. Those paths render the homepage and exist only so a
scan can be counted per variant, so **swapping either sheet back to `site-qr.png` destroys the
only number the mailshot can read** (`docs/marketing-mailshot.md` §7). The URL is printed under
each code, so the PNG and the printed line have to change together.

`qrcode` is a `lmslocal-web` dependency — this folder still has no `package.json` and the PNG is
committed, the same way `join-qr.png` is.

There is no club equivalent yet. When there is, it is a copy swap on this shell and **not** a
reworded pub note — the §5 rule in `docs/marketing-strategy.md` applies to the back page as much
as the front.

## Making a link preview image (OG)

```bash
cd lmslocal-marketing
node make-png.js og-default    # what lmslocal.co.uk previews as
node make-png.js og-join       # what an invite link previews as
```

These are the exception to "this folder ships nothing": the PNG is written
**straight into `lmslocal-web/public/`** and is committed there, because unlike a
leaflet the file itself is not the deliverable — the deployed site is, and an
export sitting in `out/` waiting to be copied goes stale the first time the copy
changes. The source HTML still lives here, with the rest of the artwork.

Run it after any edit to `social/og-*.html`, and commit the PNG with the HTML.
Do not screenshot these by hand: 1200×630 is a size the platforms check, and a
hand capture on a HiDPI screen is 2400px.

`og-default.html` repeats the root metadata copy in `lmslocal-web/src/app/layout.tsx`
and `og-join.html` repeats the copy in `join/[code]/layout.tsx` — **change the
image and the metadata together**, or the preview promises something the page
does not.

Chat apps cache previews hard, so test with a URL they have not seen before.

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
