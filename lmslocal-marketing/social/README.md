# social

Fixed-size tiles for Facebook and Instagram. Open the HTML directly in Chrome — no dev server.

## The link previews (`og-*.html`)

`og-default.html` and `og-join.html` are 1200×630 and are **not** part of the free-game campaign
below. They are the images a chat app draws when someone pastes a link to the site, and they are
built by `node make-png.js og-default` / `og-join` from the parent folder — never by hand. See
[Making a link preview image](../README.md#making-a-link-preview-image-og).

The pair exists because the two links go to different people. `og-default` is the organiser
(**you** = the organiser, §9 of `docs/design-system.md`); `og-join` is the player who has been
sent an invite code, and says nothing about pricing, fees or running your own — the join route is
the sanctioned exception to the voice rule, and the whole reason it has its own image is that a
site-wide preview selling the platform to organisers was going out on links sent to players.

Their copy repeats the metadata on the pages they preview. If one changes, change both.

## The free game

The free national last-man-standing game: £50 to the winner, a new game every week, join code
**1992**. Audience A in `docs/marketing-strategy.md` — the player, not the organiser.

| File | Canvas | Placement | Carries |
|---|---|---|---|
| `free-game-square.html` | 1080×1080 | Square feed | The offer and the code, nothing else |
| `free-game-portrait.html` | 1080×1350 | Portrait feed — reaches furthest | The offer plus all four rules |
| `free-game-story.html` | 1080×1920 | Story / reel | The offer plus the survival sheet |

They are one campaign in three shapes, not three posts. The rules on the portrait tile follow
`leaflet/a5-player.html` almost word for word, and the survival sheet on the story tile uses the
same names and picks as `leaflet/a5-landlord.html` — someone who meets the game twice should not
have to learn it twice.

**Rule 4 is the one deliberate divergence.** The leaflet says "no life", because it is generic
stock artwork for pub competitions that may be set up with spare lives. These tiles say "you are
out", because the free game is single-life. That only stays true if competition 1992 is created
with `lives_per_player = 0` — rule 2 ("draw or lose and you are out") depends on it too. At the
time of writing the code is reserved but the competition does not exist yet, so this is unverified.

## Exporting

Unlike the leaflets, these are **screenshots, not PDFs**. The canvases are fixed pixel sizes, so
a 1:1 screenshot is already native resolution.

1. Open the HTML in Chrome.
2. Open DevTools → device toolbar → set **DPR to 1**. On a HiDPI screen the default is 2 and you
   get a 2160px file that the platform re-compresses on upload.
3. Right-click the `.tile` node in the elements panel → **Capture node screenshot**.
4. Save into `out/`.

Capture the node, not the viewport — the grey desk and the on-screen instruction line are not
part of the tile.

## The flex trap

Each tile is a fixed-height flex column, which means **an over-full tile does not overflow
visibly — it silently eats things instead.** Flexbox shrinks whatever it can along the main axis,
so a hairline rule collapses to nothing and an `mt-auto` gap resolves to zero, and the tile still
looks plausible. The symptom is not a broken layout; it is a missing divider and a block sitting
flush against the one above it.

If a rule disappears or two blocks jam together, do not thicken the rule — the tile is full.
`shrink-0` on the fixed-height elements makes it fail honestly instead, and then you can take the
space out of the headline.

**On the story tile, check the small print sits above the lower dashed band before exporting.**
Overflow there is completely silent: the tile still looks fine on the desk, and the only symptom
is that the 18+/UK line ends up under the platform's caption bar in the wild — the one line that
has to be readable, hidden. If it has drifted below the band, the tile is over-full; shrink the
headline rather than the small print.

## Rules these tiles follow

- **No pricing.** This audience is not buying anything. No packs, no per-player places, no
  "start your own" — that is a different tile for a different audience.
- **No day of the week.** A new game starts most weeks, but which day is not settled and this is
  stock artwork meant to run for months.
- **£50 and 1992 are the only figures on them.** Both are real. Do not add a player count, a
  "join 400 others", or anything else that needs to stay true — see the honesty rules in
  `docs/design-system.md`.
- **The headline says "every game", not "every week", and that is deliberate.** Terms §5 lets us
  cancel or suspend at any time, so the weekly cadence is not a promise we can print at 172px.
  The per-game prize is a stable fact; the frequency is not, which is why it sits in the eyebrow
  as "most weeks". A "terms apply" line cannot rescue a headline that contradicts the terms — a
  qualification may clarify a claim but not reverse it.
- **The small print is load-bearing, not decoration.** 18+, UK residents and one-entry-per-person
  come straight from terms §5; they also set the ad targeting. So does "no prize if the game ends
  in a draw", which is why no tile says anyone "takes the £50". If terms §5 changes, these three
  files change with it.
- **Two inks.** `overprint` is doing three jobs across these tiles: the eyebrow, the rule
  numerals, and "9 left in". That is already near the limit.
