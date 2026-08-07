# LMSLocal design system — "the pools coupon"

The visual language established on the marketing landing page (`lmslocal-web/src/app/page.tsx`),
written up so it can be extended to pricing, contact, help and eventually the game screens.

**Status:** every page a signed-out visitor can reach is built to this system — the landing page,
`/join/[code]`, pricing, terms, privacy, the six help pages, and sign in / create account / forgot
password. The boundary sits at the sign-in door.

Everything behind it — the dashboard, the game screens, competition setup, billing — and all of
`lmslocal-admin` is still on the older slate/emerald defaults. That is a known, deliberate
inconsistency rather than an oversight; see [Migrating a screen](#migrating-a-screen) and
[§8](#8-extending-to-the-game-screens) before crossing it.

**Shared chrome** lives in `lmslocal-web/src/components/public/`:

| Component | Use |
|---|---|
| `PublicHeader` | Wordmark, nav, auth-aware Sign in / Dashboard. `current` hides the current page's own link; `width` matches the page measure |
| `PublicFooter` | Links and the company details a UK company must show |
| `AuthShell` | Frame for sign in / create account / forgot password, plus `authInput`, `authButton`, `Notice` and `AuthLink` |

---

## 1. The idea

Last Man Standing did not start on a phone. It started as a sheet of paper pinned behind the bar:
names in a column, a line drawn through you when your team lost. Before that, the football pools
coupon — a printed form on tinted stock, filled in by hand, two inks, a deadline in red.

**That artefact is what LMSLocal replaces, so it is what the interface is made of.** Not a page
decorated with coupon motifs — a page that behaves like the form.

Three consequences that drive every rule below:

1. **Two inks.** Pools coupons were printed with one dark ink and one red overprint on tinted
   stock. That constraint is the whole colour system, and it makes restraint automatic.
2. **Filled in, not typed out.** A typewriter face marks anything a person entered. Interface
   chrome is never set in it.
3. **Structure carries meaning.** Rules, dotted leaders, tick boxes and ledger rows encode what
   the content is. They are not decoration, and they are not added for texture.

### What this system is deliberately not

Avoid drifting into any of these, because they are where generic design lands:

- Cream `#F4F1EA` background with a high-contrast serif and a terracotta accent.
- Near-black background with a single acid-green or vermilion accent.
- Numbered markers (`01 / 02 / 03`) on content that is not actually a sequence.
- Gradient cards, pill badges with emoji, drop shadows used for depth rather than as print offset.

---

## 2. Colour

Defined as Tailwind theme extensions in `lmslocal-web/tailwind.config.js`.

| Token | Hex | Role |
|---|---|---|
| `stock-deep` | `#CDD3C4` | Banded sections that need to sit back from the page |
| `stock` | `#DDE1D6` | The page ground. The default background |
| `stock-lit` | `#F2F3EC` | Lifted panels: the sheet, the docket, cards |
| `ink` | `#1C2620` | Primary ink. Body text, rules, dark sections |
| `ink-fade` | `#4A5249` | Secondary text: labels, captions, ledger keys |
| `overprint` | `#C8341E` | The second ink. Eliminations, primary actions, emphasis |
| `moss` | `#2F4B32` | Third ink, game screens only (§8). "Still in", won. Marks and small fills |
| `moss-wash` | `#CFE4C4` | The same green as a **ground**. Winner cards and panels. Never text or rules |

### Rules

- **Two inks means two.** Do not introduce a third accent colour. If something needs to stand
  apart, use weight, size, or a rule — not a new hue. Semantic state colours on the game screens
  are the one sanctioned exception (see [§8](#8-extending-to-the-game-screens)).
- **`overprint` is a scarce resource.** On the landing page it appears on eliminations, the
  primary button, section eyebrows and the big tally numbers — and nowhere else. If a screen has
  more than a handful of red elements, something is wrong.
- **Never use `overprint` as a plain error colour.** It is the brand's second ink. An error
  message set in it reads as emphasis, not alarm. Errors get `ink` text with an `overprint` rule
  or tick-box marker beside them.
- **Grounds alternate, they do not repeat.** Consecutive full-width sections must not share a
  ground. The landing page runs `stock → stock-deep → stock → stock-deep → stock-lit → stock →
  ink`.
- **Opacity modifiers are fine on `ink` and `stock`** (`border-ink/30`, `text-stock/85`) and are
  the normal way to make rules and secondary text on dark grounds. Do not do this to `overprint`.

### Contrast floor

Every combination in use must clear **WCAG AA (4.5:1)** for body text. The measured values:

| Combination | Ratio |
|---|---|
| `ink` on `stock` | 12.9:1 |
| `ink-fade` on `stock` | 6.1:1 |
| `ink-fade` on `stock-deep` | 5.3:1 |
| `ink-fade` on `stock-lit` | 7.2:1 |
| `stock/85` on `ink` | 6.5:1 |

`ink-fade` was originally `#6B7267`, which measured 3.7:1 and failed. If you find yourself wanting
a lighter grey, the answer is to use less text, not fainter text.

---

## 3. Typography

Three faces, loaded in `lmslocal-web/src/app/layout.tsx` via `next/font/google` and exposed as
Tailwind families.

| Family | Face | Role |
|---|---|---|
| `font-display` | Big Shoulders | Headlines, wordmark, primary buttons, big numbers. Always uppercase |
| `font-body` | Instrument Sans | All body copy, and every interface label |
| `font-data` | Courier Prime | **Only** things that read as filled in by hand |

### The typewriter rule

This is the rule most likely to be broken, and breaking it is what made the first draft of the
landing page unreadable.

**`font-data` is reserved for content a person entered.** On the landing page that is exactly
three things: the names and teams on the survival sheet, the figures in the docket ledger, and the
join-code input. Everything else — eyebrows, nav, buttons, captions, field labels, footer legal —
is `font-body`.

Courier at 11px in caps with wide tracking stacks four legibility penalties at once. It is the
wrong tool for interface chrome. On the game screens the natural homes for `font-data` are player
names, team picks, scores, access codes and timestamps.

### Scale

Keep a rung between the display sizes and the body sizes; a page that jumps from 100px straight to
16px makes the small text feel smaller than it is.

| Use | Class | Notes |
|---|---|---|
| Hero headline | `text-[4rem] sm:text-[5.5rem] lg:text-[6.2rem]` | `leading-[0.82]` |
| Section heading | `text-5xl sm:text-6xl` | `leading-[0.9]` |
| Sub-section heading | `text-4xl sm:text-5xl` | |
| Card / row heading | `text-2xl` | `tracking-[0.03em]` |
| Section intro | `text-xl` | The middle rung. Do not skip it |
| Body | `text-[17px]` | |
| Caption, ledger, small print | `text-[15px]` / `text-[16px]` | |
| Labels and eyebrows | `text-xs` | See constants below |

Display type is always uppercase and always `font-semibold`. Big Shoulders is a variable font, so
other weights are available, but the page has one display voice — do not mix weights within it.

### Tracking

Small uppercase text needs *some* tracking and is ruined by too much. `0.12em` for labels,
`0.16em` for eyebrows, `0.06em` for display buttons, `0.1em` for the wordmark. The first draft used
`0.2em`–`0.22em` and it hurt.

---

## 4. Shared constants

Import from `lmslocal-web/src/lib/design.ts` rather than retyping class strings:

```ts
import { LABEL, EYEBROW, HEADING, PANEL, BTN_PRIMARY, BTN_OUTLINE, TICK, RULE } from '@/lib/design';
```

| Constant | What it is |
|---|---|
| `LABEL` | Utility label: nav, buttons, captions, field labels, chips |
| `EYEBROW` | Section eyebrow above a display heading |
| `HEADING` | Display heading base — add a size class |
| `PANEL` | Lifted panel: `border border-ink/30 bg-stock-lit` |
| `BTN_PRIMARY` | Primary action. Swap focus ring to `outline-stock` on an ink ground |
| `BTN_OUTLINE` | Secondary action on a light ground |
| `TICK` | Tick-box glyph wrapper, pair with `&#10003;` |
| `RULE` | Hairline divider colour |

Colour and size still come from Tailwind classes at the call site — these constants capture the
combinations that would otherwise drift.

---

## 5. Layout

- **Container:** `mx-auto max-w-6xl px-4 sm:px-6`. Every section uses it.
- **Section padding:** `py-14 sm:py-20` for major sections, `py-12 sm:py-16` for compact ones.
- **Radius:** `rounded-sm` on buttons and inputs — a slight stamped softening. **`rounded-none`
  everywhere else.** Panels, cards and sections are square, because printed forms are square. Never
  use `rounded-xl` or above.
- **Dividers:** hairlines at `border-ink/30`. Sections are separated by `border-y`, rows by
  `border-b`. Never use a shadow to separate one block from another.
- **Shadow:** exactly one shadow exists — the hard print offset on the sheet,
  `shadow-[4px_4px_0_0_rgba(28,38,32,0.16)]`. No blurred shadows anywhere.
- **Dashed borders** mark something detachable, like the docket. Use sparingly.

---

## 6. Components

### Panel
`PANEL` plus `p-5 sm:p-6`. A lifted surface on any ground.

### Buttons
Primary is `BTN_PRIMARY` plus size: `px-7 py-3.5 text-2xl` for hero, `px-8 py-4 text-2xl` for the
closing call to action. Secondary is `BTN_OUTLINE`. A tertiary action is a `LABEL` link with
`underline decoration-dotted underline-offset-[6px]`.

There is **one primary action per screen region**. The landing page has the same primary action at
the top and the bottom and nothing else competing.

### Inputs
`rounded-sm border`, transparent background, `font-data` if the user is entering data that appears
elsewhere as data (codes, names, scores). Focus is a border change plus, on interactive controls,
`focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2`.

### Chip
A state flag such as "Free right now": `LABEL` plus `bg-overprint px-2 py-1 text-stock-lit`. Solid
fill, square, no radius beyond the button default. Use for facts, never for manufactured urgency.

### Tick list
`TICK` glyph plus `text-[17px]` item text, in a `sm:grid-cols-2` grid. The box is a real box with a
border — it reads as a form, not as an icon list.

### Ledger
A `<dl>` in `font-data text-[15px]`, keys in `ink-fade`, values in `ink`, a `border-t border-ink/30`
above the total, and the total itself in display type. This is the pattern for any figures that add
up — billing, credits, prize breakdowns.

### Dotted leader row
Name, then `flex-1 border-b border-dotted border-ink/30` translated up 3px, then the value. Used on
the survival sheet and the offline-players panel. Good for any two-column name/value list that
should read as a filled-in form.

### Stat block
Big number in `font-display text-6xl sm:text-7xl text-overprint`, label beneath in `LABEL
text-ink-fade`, cells divided by `border-r border-ink/30` inside a `border-y`.

---

## 7. Motion

- **A resting state must be coherent on its own.** The survival sheet originally rested at round
  zero and only made sense once its animation had run — so a throttled tab, a screenshot, a slow
  load or a scroll-past showed nonsense. It now rests at the finished competition and animates as
  an enhancement. Apply this test to anything that animates: *if the animation never runs, does
  this still read correctly?*
- **Start sequences inside `requestAnimationFrame`,** not a bare `setTimeout`. `rAF` does not fire
  in a background tab, so an unseen tab keeps the correct resting state instead of rewinding into a
  broken one.
- **Always honour `prefers-reduced-motion: reduce`** by rendering the final state immediately.
- Transitions are `duration-300` and shorter. Nothing eases for longer than a third of a second.
- One orchestrated moment per page beats scattered hover effects everywhere.

---

## 8. Extending to the game screens

The marketing pages and the game screens have different jobs, and the system needs one addition to
cover the second.

**What carries over unchanged:** the palette, the three faces and the typewriter rule, square
corners, hairline dividers, the ledger and dotted-leader patterns, button hierarchy, the motion
rules.

**What needs to change:**

- **Density.** Section padding of `py-20` is right for a landing page and wrong for a standings
  table. Drop to `py-6`–`py-8` and tighten row padding, but do not shrink the type below the sizes
  in §3 — the readability lesson applies twice over on a screen someone uses weekly.
- **Semantic state colours.** A player is in, out, or has not picked yet. Two inks cannot carry
  three states plus emphasis. Add a **third ink** for "still in" — a deep bottle green in the same
  printed register, so `overprint` keeps meaning "out". Define it as a token before using it, and
  never let it drift into decoration.
- **`moss` is an ink; `moss-wash` is a ground. Pick by area, not by preference.** `moss` is
  `#2F4B32` — dark enough that a hairline rule or 11px text set in it reads as plain black, and
  dark enough that filling a card with it produces a murky slab that outweighs everything around
  it. Both failures were shipped and rejected in turn on `/player-results`. The rule that came out
  of it: **marks and stamps take `moss`, fields take `moss-wash` with `ink` text on top**
  (11.5:1). A tint of `moss` is never the answer — `bg-moss/10` over the stock reads as grey,
  which is what started the whole exercise.
- **Say the state, don't just colour it.** Every status carries its word — "Won", "Lost", "Out" —
  so nothing depends on a reader seeing the hue.
- **One statement per row.** A results row states either what happened or what it meant for the
  reader, never both: "Everton won · You picked Everton — won" says *won* twice and names the team
  three times. The personal one wins, because it implies the other.
- **State must not rely on colour alone.** The sheet strikes eliminated names through *and* colours
  them, and carries an `sr-only` "— out". Keep that doubling on every status.
- **The survival sheet is the model for standings.** It is already the game screen, rendered for
  marketing. A real standings table should look like it: names in `font-data`, dotted leaders,
  struck-through eliminations, the count in display type.

Pricing and contact pages need nothing new — they are the ledger, panel and tick-list patterns.

---

## 9. Voice and copy

The design rules and the copy rules are one system. These are enforced on the landing page.

- **"You" is always the organiser.** Anything a player does is third person: *"They pick one team
  each round."* The first draft addressed players in the hero and organisers in the paragraph
  below, and the page read as a player page. The one exception is the join strip at the top, which
  is the only element for players.
- **Lead with the outcome, not the mechanic.** The organiser already knows what Last Man Standing
  is. What they do not know is what it does for them.
- **No invented social proof, and no rounded-up numbers.** See
  `docs/` history and the landing page's "Where we're up to" section — real figures, stated plainly,
  including how small they are.
- **Never state an optional feature as universal.** The fixture service is opt-in and costs money;
  an early draft said "fixtures arrive on their own" as a flat fact. Check the code before writing
  a capability claim.
- **State prices and offers as facts.** "20 credits a competition — free right now" with no countdown
  clock, no "limited time!", no urgency theatre.
- **Sentence case in prose, active voice, plain verbs.** An action keeps its name through the whole
  flow: a button that says "Start one" leads to a screen about starting one.
- **"Matches", not "fixtures".** A pub landlord says "have you put this week's matches in".
  "Fixtures" is fixture-*service* vocabulary — obvious to us, opaque to a first-time organiser.
  The word stays `fixture` in the database, routes and code; only what a person reads changes.
  See `docs/round-state-machine.md` §5.
- **Errors explain what happened and what to do.** They do not apologise and they are never vague.
  Empty states are an invitation to act.

---

## 10. Migrating a screen

1. Set the page root to `bg-stock font-body text-ink`.
2. Replace slate/emerald colours with the tokens in §2. `slate-900` → `ink`, `slate-600` →
   `ink-fade`, `emerald-600` → `overprint` **only if the element is genuinely a primary action or
   an elimination** — otherwise it probably becomes `ink`.
3. Strip `rounded-lg`/`rounded-xl`/`rounded-2xl` to `rounded-none`, leaving `rounded-sm` on buttons
   and inputs.
4. Remove blurred shadows and gradients entirely.
5. Replace Heroicons used as decoration. Icons that carry meaning can stay; icons filling space go.
6. Move headings to `font-display` uppercase, labels to `LABEL`, and check nothing small ended up in
   `font-data`.
7. Check contrast against §2 and confirm focus rings are visible on every interactive element.

Do not migrate a screen halfway. A page in mixed styling looks worse than a page still fully in the
old system.
