# social

Fixed-size tiles for Facebook/Instagram, plus the site's link-preview images.

## Link previews (`og-*.html`)

1200×630, built by `node make-png.js og-default` / `og-join` — never by hand. `og-default` speaks
to the organiser; `og-join` to a player holding an invite code, so it says nothing about pricing.
Their copy repeats the page metadata — change both together.

## Free game tiles

The free national game: £50 to the winner, join code **1992**, aimed at the player.

| File | Canvas | Carries |
|---|---|---|
| `free-game-square.html` | 1080×1080 | The offer and the code |
| `free-game-portrait.html` | 1080×1350 | The offer plus the four rules |
| `free-game-story.html` | 1080×1920 | The offer plus the survival sheet |

Rules wording follows `leaflet/a5-player.html`, except rule 4 says "you are out" because the free
game is single-life — true only while competition 1992 has `lives_per_player = 0`.

**Export:** Chrome DevTools device toolbar at **DPR 1**, right-click the `.tile` node → Capture node
screenshot, save to `out/`.

**An over-full tile fails silently** — flexbox collapses hairline rules and `mt-auto` gaps rather
than overflowing. If a divider vanishes, cut the headline. On the story tile, check the small print
sits above the lower dashed band (the platform caption bar covers it otherwise).

**Copy rules:** no pricing, no day of the week, no figures but £50 and 1992. Headline says "every
game", not "every week" (terms §5 lets us suspend). The 18+ / UK / one-entry / no-prize-on-a-draw
small print comes from terms §5 — if §5 changes, these tiles change.
