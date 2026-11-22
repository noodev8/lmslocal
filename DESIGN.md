---
name: LMSLocal landing page
description: A Saturday results service on a phosphor-black screen. Governs the landing page (lmslocal-web route /) only.
colors:
  screen-black: "#000000"
  ink: "#f2f2ee"
  dim: "#c9c9c2"
  national-yellow: "#ffd400"
  club-cyan: "#2fd0ff"
  through-green: "#45e06a"
  out-red: "#ff4b3e"
  banner-blue: "#1f3ad8"
  rule: "#1e1e1e"
  rule-frame: "#2a2a2a"
  leader: "#4a4a4a"
typography:
  display:
    fontFamily: "VT323, ui-monospace, monospace"
    fontSize: "68px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0em"
  headline:
    fontFamily: "VT323, ui-monospace, monospace"
    fontSize: "52px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0em"
  numeral:
    fontFamily: "VT323, ui-monospace, monospace"
    fontSize: "clamp(104px, 11vw, 156px)"
    fontWeight: 400
    lineHeight: 0.74
  feed:
    fontFamily: "VT323, ui-monospace, monospace"
    fontSize: "40px"
    fontWeight: 400
    lineHeight: 1.06
  title:
    fontFamily: "VT323, ui-monospace, monospace"
    fontSize: "34px"
    fontWeight: 400
    lineHeight: 1
  readout:
    fontFamily: "VT323, ui-monospace, monospace"
    fontSize: "30px"
    fontWeight: 400
    lineHeight: 1.15
  label:
    fontFamily: "VT323, ui-monospace, monospace"
    fontSize: "26px"
    fontWeight: 400
    lineHeight: 1
  body-lede:
    fontFamily: "Atkinson Hyperlegible Mono, ui-monospace, monospace"
    fontSize: "21px"
    fontWeight: 400
    lineHeight: 1.55
  body:
    fontFamily: "Atkinson Hyperlegible Mono, ui-monospace, monospace"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.6
  body-small:
    fontFamily: "Atkinson Hyperlegible Mono, ui-monospace, monospace"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  none: "0px"
spacing:
  gutter: "clamp(16px, 3.4vw, 48px)"
  container: "1360px"
  group: "28px"
  block: "40px"
  column: "72px"
  section-bottom: "84px"
components:
  button-play:
    backgroundColor: "{colors.national-yellow}"
    textColor: "{colors.screen-black}"
    typography: "{typography.title}"
    rounded: "{rounded.none}"
    padding: "8px 20px 4px"
  button-play-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.screen-black}"
  button-club:
    backgroundColor: "{colors.screen-black}"
    textColor: "{colors.club-cyan}"
    typography: "{typography.title}"
    rounded: "{rounded.none}"
    padding: "8px 20px 4px"
  button-club-hover:
    backgroundColor: "{colors.club-cyan}"
    textColor: "{colors.screen-black}"
  button-club-solid:
    backgroundColor: "{colors.club-cyan}"
    textColor: "{colors.screen-black}"
    typography: "{typography.title}"
    rounded: "{rounded.none}"
    padding: "8px 20px 4px"
  button-club-solid-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.screen-black}"
  button-join:
    backgroundColor: "{colors.out-red}"
    textColor: "{colors.screen-black}"
    typography: "{typography.title}"
    rounded: "{rounded.none}"
    padding: "8px 20px 4px"
  button-join-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.screen-black}"
  input-code:
    backgroundColor: "{colors.screen-black}"
    textColor: "{colors.national-yellow}"
    rounded: "{rounded.none}"
    padding: "6px 12px 2px"
    width: "11ch"
  page-banner:
    backgroundColor: "{colors.national-yellow}"
    textColor: "{colors.screen-black}"
    typography: "{typography.headline}"
    padding: "10px 16px 8px"
  page-banner-blue:
    backgroundColor: "{colors.banner-blue}"
    textColor: "{colors.ink}"
    typography: "{typography.headline}"
    padding: "10px 16px 8px"
  index-row:
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    padding: "7px 6px 5px"
  index-row-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.screen-black}"
  fastext-key:
    backgroundColor: "{colors.screen-black}"
    typography: "{typography.label}"
    padding: "12px 8px 9px"
  sample-tag:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.screen-black}"
    padding: "2px 8px 0"
---

# Design System: LMSLocal landing page

> **Scope: this file governs the landing page only** — `lmslocal-web/src/app/page.tsx` (route `/`)
> and `lmslocal-web/src/components/landing/results/`. Every other screen (the other signed-out
> pages, the dashboard, the game screens, competition setup, billing) is governed by the older
> "pools coupon" system in `docs/design-system.md`, which stays authoritative for them. Do not
> apply this world to any other screen, and do not restyle the landing page back to the pools
> coupon. The two share no tokens: this world's colours live on the `.root` class in
> `results.module.css`, not in `tailwind.config.js` or `src/lib/design.ts`, and its fonts load in
> `page.tsx` so no other page pays for them. Where `docs/design-system.md` describes the landing
> page, that description predates the 2026-11-22 redesign; its rules for every other screen stand.

## Overview

**Creative North Star: "The Saturday Results Service"**

The page is a broadcast text service on a Saturday afternoon. Scores type in one character at a
time, each knocking thousands out of a national game, and a giant count of who is still standing
drops as they land. Everything else is laid out the way a teletext service lays out its pages:
numbered pages with solid colour banners, an index whose entries are page numbers, dotted-leader
ledgers for figures, and four coloured keys fixed along the bottom of the screen.

It is dense, flat and loud on a black ground. Colour is never decoration: each of the five
broadcast colours has one fixed meaning across the whole page, and appears either as text on black
or as a solid block carrying black text. Depth, emphasis and state all come from fills and
inversion, never from shadow, blur, gradient or rounded corners. Motion is the teleprinter's: even,
stepped, on-or-off.

Figures that are invented to show the mechanism (the national game is not built yet) carry a
visible SAMPLE tag. That tag is part of the world, not a disclaimer bolted on.

**Key Characteristics:**
- Phosphor-black screen (`screen-black`) with off-white `ink` text; the browser's own scrollbar and selection follow it.
- Five broadcast colours with fixed roles; solid blocks always carry black text, except blue, which carries ink.
- VT323 in capitals for anything a line or shorter; Atkinson Hyperlegible Mono for anything longer.
- Double-height headings, drawn twice as tall at the same width and sized to fit without wrapping.
- Every section is a numbered page (P100 to P600), reached from the index and the fastext bar.
- Square corners, ruled lines, dotted leaders. No shadows.

## Colors

Five saturated broadcast colours on black, each meaning one thing everywhere, plus an off-white ink
and a short ladder of near-black greys for rules.

### Primary
- **Broadcast Yellow** (`national-yellow`): the national game and the primary action. The brand
  block, the hero heading, the STILL STANDING count, the "Play free" buttons, the P200 banner, the
  live clock, the code input's typed text and caret, and the focus ring. Also the scrollbar thumb
  and the text-selection fill.

### Secondary
- **Teletext Cyan** (`club-cyan`): organisers and clubs. The organiser offer line, "Start one for
  your club", the P300 banner, the fundraiser calculator's frame, thumbs and figures, the weekend
  listing times, text-link underlines, and the visitor's own pick in the feed.

### Tertiary
- **Through Green** (`through-green`): through, and the rules. THROUGH in the feed and the rules
  ledger, page 210 in the index, the rules fastext key, and the P600 downloads banner and numbers.
- **Out Red** (`out-red`): out, and the join code. Every OUT figure in the feed and ledgers, the
  P400 "Got a code?" banner, the Join button, the code fastext key, and a negative "left for your
  club" sum.
- **Banner Blue** (`banner-blue`): neutral page banners (P500, "Where we're up to") and the
  calculator's slider track. The one colour that is never text, and the only solid block that
  carries ink rather than black.

### Neutral
- **Screen Black** (`screen-black`): the ground of every surface, and the text colour on every solid
  colour block.
- **Phosphor Ink** (`ink`): all running text, and the inversion fill for hover.
- **Dim Ink** (`dim`): secondary copy — fine print, slider and ledger labels, the index heading,
  the code label, listing details, footer links.
- **Rule** (`rule`): 2px dividers between listings, download rows, the footer and (as the
  near-identical `#1c1c1c`) under the header row and above the fastext bar.
- **Frame Rule** (`rule-frame`): the index's 2px frame and the 2px rules inside the calculator.
- **Leader** (`leader`): the 3px dotted leaders in ledgers.

### Named Rules
**The Fixed Roles Rule.** Yellow is the national game and the primary action, cyan is organisers
and clubs, green is through and the rules, red is out and the join code, blue is a neutral banner,
white is text. A colour is chosen by what the thing *is*, and never reused for anything else; a
new section takes the colour of its audience, or blue if it has none.

**The Two Fills Rule.** Colour appears in exactly two ways: as text on black, or as a solid block
with black text on it (blue alone carries ink). No tints, no transparency, no gradients.

## Typography

**Display Font:** VT323 (with `ui-monospace, monospace`)
**Body Font:** Atkinson Hyperlegible Mono (with `ui-monospace, monospace`)

**Character:** VT323 is the screen: blocky, all capitals, the voice of the service itself.
Atkinson Hyperlegible Mono keeps the monospaced texture but stays readable for a paragraph on a
small phone in a dim pub.

Both load through `next/font/google` in `page.tsx` as `--font-vt` and `--font-hyper`; the module
reads them as `--vt` and `--body`. VT323 is used at weight 400 only, always uppercased.

### Hierarchy
- **Display** (VT323 400, up to 68px, drawn at double height): the hero "LAST MAN STANDING" only.
- **Headline** (VT323 400, up to 52px, double height): page banner titles.
- **Numeral** (VT323 400, `clamp(104px, 11vw, 156px)`, line-height 0.74, tabular): the STILL
  STANDING count. The calculator's "left for your club" sum is its smaller sibling (72px, 56px on
  a phone).
- **Feed** (VT323 400, up to 40px, line-height 1.06): the results feed, sized so a 36-character
  line fits the screen (26 on a phone, where the OUT figure drops beneath).
- **Title** (VT323 400, 34px, line-height 1): sub-headings within a page, and button labels (30px
  on a phone).
- **Readout** (VT323 400, 30px, line-height 1.05–1.15): the hero offer lines, dotted-leader ledgers
  (25px on a phone), download rows, banner page numbers.
- **Label** (VT323 400, 24–28px, line-height 1): the header row, the index, fastext keys, ledger and
  slider labels, listings, text links, footer links.
- **Body Lede** (Atkinson 400, 21px / 1.55, max 40em): the opening paragraph under a banner (19px
  on a phone).
- **Body** (Atkinson 400, 18px / 1.6, max 42em): running copy (17px on a phone).
- **Body Small** (Atkinson 400, 16px, dim, max 46em): fine print, listing details, download blurbs.
  The company line in the footer is 14px.

### Named Rules
**The One Line Rule.** Anything a line or shorter is VT323 in capitals; anything longer is Atkinson
Hyperlegible Mono in sentence case. VT323 tires the eye in a paragraph.

**The Double Height Rule.** Headings are teletext double height: the glyphs are drawn with
`transform: scaleY(2)` from the top-left at their normal width, inside a box reserved at
`2em × lines`. Each heading declares its longest line in characters (`--chars`) and a ceiling
(`--max`); its size is the smaller of the ceiling and what fits the screen width, using VT323's
advance of 0.42em per character (`--adv`). A double-height heading never wraps. Banners reserve
120px (84px on a phone) for their page number.

## Layout

A centred screen, 1360px wide at most, with a fluid gutter of `clamp(16px, 3.4vw, 48px)` either
side. The page is a stack of numbered pages: the P100 hero, then P200 to P600, each opening with a
full-width colour banner and its page number at the right.

- **Hero (P100):** two columns, the main column and a 320px index, 56px apart; the main column holds
  the heading, two offer lines, the feed, the count, and the two doors (yellow play, cyan club)
  side by side.
- **Pages (P200–P600):** 40px top, 84px bottom. Under the banner, a two-column split (1.1fr / 0.9fr)
  with 72px between columns and 40px between rows, starting 40px below the banner.
- **Rhythm:** 40px before each sub-heading; 28px before a group of actions; 22px before a ledger.
- **Fastext bar:** fixed to the bottom edge, four equal keys; the page carries 60px of bottom
  padding to clear it.

**Responsive:**
- **≤1023px:** every split, the hero, and the calculator's three sliders drop to one column.
- **≤639px:** body text steps down a pixel; the page number, the Help link and the clock leave the
  header row; the doors move above the feed and go full width, so both actions sit on the first
  screen; in the feed each OUT figure drops under its score at 0.8em, indented 2ch; listings stack;
  fastext keys shorten to one word each (each anchor keeps its full name as its aria-label).

### Named Rules
**The Page Number Rule.** Every section is a numbered page, and the banner, the index and the
fastext keys all point at the same number in the same colour. A new section gets a page number, an
index entry in its role colour, and a banner — not an unnumbered block.

## Elevation & Depth

Flat. There are no shadows, blurs, gradients or overlays anywhere in the world. Depth is the
difference between a solid colour block and the black around it; the one layered element is the
fastext bar, which sits fixed above the content on its own black ground with a 2px rule above it.

### Named Rules
**The Inversion Rule.** State is shown by swapping fills, the way a selected row on a text service
lights up: hover turns a row, link or solid button to an ink block with black text; an outlined
cyan button fills cyan; a fastext key fills with its own colour. Nothing lifts, glows or moves.

## Shapes

Square everywhere (`rounded.none`), including the code input and the range thumbs, which are 16 ×
28px solid cyan blocks on a 6px blue track. Form comes from strokes and rules: 3px strokes on
buttons and the input, 2px rules and frames for structure, 3px dotted leaders for ledgers. The
flashing cursor and the teleprinter's print head are half-character blocks (0.5ch).

## Components

### Buttons
Solid blocks of a role colour, in VT323 capitals.
- **Shape:** square, with a 3px stroke (transparent on solid buttons), padding 8px 20px 4px.
- **Play (yellow):** `button-play`; the national-game action. Hover turns it ink.
- **Club (cyan outline):** `button-club`; the organiser door beside the yellow one in the hero.
  Hover fills it cyan.
- **Club solid (cyan):** `button-club-solid`; the organiser's action inside P300. Hover turns it ink.
- **Join (red):** `button-join`; submits the join code. Disabled while the field is empty: no fill,
  a `#5a5a5a` stroke and `#8f8f8f` text.
- **Transition:** background, colour and stroke over 120ms ease-out; none under reduced motion.
- **Focus:** a 3px yellow outline, offset 3px — the focus ring for the whole page.

### Text links
VT323 capitals in ink with a 2px cyan underline (App Store, Google Play, "have us set it up").
Hover inverts to an ink block and drops the underline.

### Inputs / Fields
- **Code input:** black field, 3px ink stroke, square, 44px VT323 with 0.12em tracking, yellow text
  and caret, about 11 characters wide. The label sits above it in dim VT323.
- **Focus:** the stroke turns yellow and the outline sits flush (offset 0).
- **Range sliders (calculator):** 6px blue track, 16 × 28px square cyan thumb; label in dim VT323,
  value in 40px cyan VT323.

### Navigation
- **Header row:** page number (P100), the yellow LMSLOCAL block, links, and a yellow live clock
  ticking each second; 26px VT323 caps over a 2px rule. Links invert on hover.
- **Index:** a 2px framed panel titled INDEX in dim; each row is a page number in its role colour
  and a label in ink, the whole row inverting on hover.
- **Fastext bar:** four keys fixed along the bottom in red, green, yellow, cyan order (Code, Rules,
  Game, Run one), each label in its own colour; hover fills the key with that colour and black
  text.
- **Footer:** two rows of dim VT323 links that invert on hover, then the company line in 14px.

### Page Banner
A full-width solid block in the page's role colour carrying a double-height title in black (ink on
blue) and its page number, P-prefixed, at the right.

### Dotted-Leader Ledger
Label and value in 30px VT323 capitals joined by a 3px dotted leader. Rows align on their last
line, so a wrapped label still leads out from its final word. A value takes its role colour where
it has one (FREE in yellow, OUT in red, THROUGH in green, organiser terms in cyan); otherwise ink.
The calculator uses a plainer variant: dim labels, values right-aligned, a 2px rule above.

### Results Feed (signature)
A numbered list of results in VT323 capitals: each score sits in a fixed 26ch column and its OUT
figure in red beside it. The first lines are already printed on arrival; the live ones type in at
30ms per character with a block print head at the edge, the print head showing only while typing.
Each OUT figure landing drops the STILL STANDING count, eased over 700ms. The visitor's pick sits on
the last line in cyan with a flashing block cursor until the round is in, then THROUGH types in
green. Under reduced motion the feed renders the finished round.

### Still Standing Count
The giant yellow numeral with STILL STANDING beside it and a SAMPLE tag beneath: an ink block with
black text at 22px. Every invented national-game figure carries that tag.

### Programme Listing
The weekend set as a listings column: a cyan time on the left spanning two lines, a VT323 title
and a dim Atkinson detail beside it, rows divided by 2px rules.

## Do's and Don'ts

### Do:
- **Do** pick a colour by role — yellow national game and primary action, cyan organisers, green through and rules, red out and the code, blue neutral banners — and keep it on every element of that thing (banner, index number, fastext key, button).
- **Do** set anything a line or shorter in VT323 capitals and anything longer in Atkinson Hyperlegible Mono.
- **Do** draw headings at double height with a declared character count, sized to fit without wrapping.
- **Do** show hover and selection by inverting to a solid fill with black text.
- **Do** give every new section a page number, an index entry and a banner.
- **Do** put figures in dotted-leader ledgers, with values in their role colour.
- **Do** tag any invented or not-yet-live figure with a visible SAMPLE block.
- **Do** flash on and off with `step-end` and type with `steps()`; switch both off under reduced motion and show the finished state instead.

### Don't:
- **Don't** apply this world outside the landing page, or bring the pools-coupon tokens (`src/lib/design.ts`, the Tailwind colour tokens) into it.
- **Don't** use a colour outside its role, such as cyan on a national-game action or red as plain emphasis.
- **Don't** add shadows, gradients, blur, transparency or rounded corners.
- **Don't** set paragraphs in VT323, or let a double-height heading wrap.
- **Don't** fade a flash or a cursor; broadcast text is on or off.
- **Don't** put light text on yellow, cyan, green or red blocks; they carry black.
