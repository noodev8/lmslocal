# Matchday in the Flutter app — what the app must know

Written 2026-11-22 for whoever brings Matchday to `lmslocal-flutter/`. It says **what** changes and
**where**, from a product, design and server-contract point of view. How to write the Dart is
yours: read the code, change it, test it.

**Status: built 2026-11-23, not yet released.** The app sends `X-Game-Types: lms,matchday`
(`api_client.dart`) and branches once, in `CompetitionEntryPage`, to `pages/matchday/`. Shared
helpers are `core/game/games.dart` (the Dart `games.ts`, including UK time) and
`domain/entities/matchday.dart`. Tested on an Android phone against production on test
competitions 284 and 285 (organiser 50, sandbox rounds) - every item in §16's list except an app
cold-started from a `/join/` link while signed out, and a table of 30+ players (trimming). Not done:
a version bump and release - production already serves everything the app calls.

Three small things found while building it were fixed in the app, then on the web (2026-11-23):
a Previous tapped while a save is in flight was overridden by the auto-advance (the timer is set
after the save returns, so there was nothing to cancel - both now advance only if the player is
still on the card they tapped); the table said "After round 0" during round 1 (now "Round 1");
and an organiser who is not playing was told each match is "Not predicted · scores 0".

**Scoring is 3 / 1 / 0 since 2026-11-23** (it was 3 / 1 / −1), on the server, the web and the app
alike. No score is negative, so the table no longer has a floor.

**Read first, in this order:**

1. `docs/matchday.md`. The contract for the game: rules, vocabulary, presentation. When a question
   here is not answered, it is answered there, or it gets answered there before it is coded.
2. `docs/design-system.md`, §2 (colour), §8 (game screens). The app already follows it through
   `lib/core/theme/coupon_theme.dart`.
3. The web screens, which are the reference implementation and were tested by the owner:

| Web file | What it is |
|---|---|
| `lmslocal-web/src/lib/games.ts` | Game names, scoring line, ending label, formatting helpers |
| `lmslocal-web/src/app/dashboard/page.tsx` | The dashboard card, both games (search `isMatchday`) |
| `lmslocal-web/src/components/matchday/MatchdayHome.tsx` | A Matchday competition's home |
| `lmslocal-web/src/app/game/[id]/coupon/page.tsx` | The predictions screen: the strip of cards |
| `lmslocal-web/src/app/game/[id]/table/page.tsx` | The league table |
| `lmslocal-web/src/app/game/[id]/table/[userId]/page.tsx` | One player's predictions, round by round |
| `lmslocal-web/src/app/join/[code]/page.tsx` | Join page: how a Matchday competition is described |

---

## 1. The ground rules

- **Matchday is a second game beside Last Man Standing.** For every match in a round a player
  predicts the winner: win **+3**, draw **+1**, loss **0**, unpredicted **0**. Most points after
  the last round wins. The two games share fixtures, rounds, the calendar, accounts and billing,
  and nothing else.
- **The app is player-only.** A Matchday organiser has nothing to run anyway: fixtures and results
  are always the fixture service's. No organiser screens are needed.
- **Old app versions stay in use until they are forced off.** The server's minimum version
  (`app_version`, `/check-app-version`) blocks older builds - from 2.1.0 on every launch and every
  invite link (`version_gate.dart`); before that only a launch from the icon. None before 2.1.0
  knows Matchday exists, and the server keeps them safe on its own (§2). Nothing in this work may
  break an old version, and nothing old needs changing.
- **Matchday is in preview.** Only organiser 50 can create one. Customers cannot yet, but anyone
  invited to one can play it. So this work is not urgent for customers, and there is time to get
  it right.
- **The server is the authority** for totals, positions, tie-breaks, and what may be
  seen when. The app displays; it never recalculates. See §9.

---

## 2. The switch: the `X-Game-Types` header

The server decides what each client sees from one request header (`docs/matchday.md` §7,
`lmslocal-server/services/gameType.js` → `clientGameTypes`).

| The app sends | The server does |
|---|---|
| Nothing (every app version in the wild) | Treats it as LMS-only. Matchday competitions are **left out** of `get-user-dashboard` (both lists). `join-competition-by-code` **refuses** a Matchday code with `GAME_NOT_SUPPORTED`. |
| `X-Game-Types: lms,matchday` | Returns Matchday competitions on the dashboard and lets the player join one. |

- **Send it on every request, from the Dio client's base headers** in
  `lib/data/data_sources/remote/api_client.dart`, beside `Content-Type`. The web does the same
  in `lmslocal-web/src/lib/api.ts` (`GAME_TYPES_SHOWN`).
- **Send it only in the build where every Matchday screen exists.** The header *is* the feature
  switch. A build that sends it but cannot render Matchday would show a player a competition it
  cannot play. Build everything behind it, test with it on, and ship it on.
- Mobile requests are not subject to CORS. The header is already in the server's CORS
  `allowedHeaders` for the web, so nothing server-side is needed.

---

## 3. Branch once, at the top

`docs/matchday.md` §3.2: a screen decides which game it is serving **at its entry point**, then
runs code written for that game only. Do not sprinkle `if (gameType == ...)` through the existing
LMS widgets. The LMS screens stay as they are.

`competition.game_type` is `'lms'` or `'matchday'`. Treat **missing or null as `'lms'`**, the
same as the server. It is fixed at creation and never changes.

Entry points in the app that must branch:

| Where | What it must do for Matchday |
|---|---|
| `lib/data/models/competition_model.dart` | Carry `game_type`, `end_rule`, `end_value` and the `matchday` block (§5) |
| `lib/presentation/pages/dashboard/dashboard_page.dart` | A Matchday card (§5), not the LMS card |
| `lib/core/router/app_router.dart`: `/competition/:id`, `/game/:id` | Open the Matchday screens. `/game/:id` is a deep link, so the same competition URL serves both games |
| `lib/presentation/pages/competition/competition_navigation_page.dart` | The tabs (Home / Dashboard / Play / Standings / Profile): for Matchday, **Dashboard** is the Matchday home (§6), **Play** is the predictions screen (§7), **Standings** is the table (§8). The `?tab=play` behaviour carries over to Play = predictions |
| `lib/presentation/pages/join/join_page.dart` | Describe a Matchday competition before joining, then land on its home after joining (§11) |
| `lib/core/services/notification_routes.dart` | Nothing today: no Matchday notifications exist (§12). Keep it game-agnostic |

**Every LMS route refuses a Matchday competition with `FORBIDDEN`**, whatever the client
(`docs/matchday.md` §7.3): `set-pick`, `unselect-pick`, `get-current-pick`, `get-allowed-teams`,
`get-unpicked-players`, `get-pick-statistics`, `get-round-statistics`, `get-fixture-pick-count`,
`get-standings-*`, `get-player-history`, `buy-player-back-in`. If a Matchday competition ever
reaches an LMS screen, those calls fail; that is the symptom of a missed branch.

---

## 4. Server routes for Matchday

All are `POST`, JWT auth, and **always HTTP 200** with `return_code`. The header block at the top of
each route file is the exact contract, with field-by-field comments and every return code.
Read it rather than trusting this summary.

| Route | Request | What it gives | Notes |
|---|---|---|---|
| `get-predictions` | `competition_id`, `round_number?` | The player's own predictions for a round (default latest): `round` {round_number, lock_time, locked, latest} or null, `fixtures[]` with `my_team` / `my_points` / `result` / `settled`, `predicted`, `total_fixtures`, `is_player` | Feeds the predictions screen and the home. `round: null` = no round yet, a normal state |
| `set-prediction` | `fixture_id`, `team` (short code) | Saves or changes one prediction | Codes: `ROUND_LOCKED`, `COMPETITION_COMPLETE`, `INVALID_TEAM`, `FORBIDDEN` |
| `clear-prediction` | `fixture_id` | Takes a prediction back (the match then scores 0) | Idempotent. `ROUND_LOCKED` after lock |
| `get-matchday-table` | `competition_id` | `table[]` (position, user_id, display_name, total, wins, draws, losses, predictions, provisional, is_me), `rounds_settled`, `latest_round_number`, `competition` {end_rule, end_value, status, winner_id} | Already ranked, ties already shared. Display as given |
| `get-round-predictions` | `competition_id`, `round_number?` | **Everyone's** predictions for a **locked** round: `round` {round_number, lock_time, latest_locked_round_number} or null, `fixtures[]`, `players[]` (every member, with is_me), `predictions[]` {user_id, fixture_id, team, points} | `FORBIDDEN` for a round still open. Default = the latest *locked* round. `docs/matchday.md` §8.6 |
| `get-user-dashboard` | — | Matchday competitions (with the header), each with a `matchday` block | §5 |
| `get-competition-by-code` | `competition_code` | Now includes `game_type`, `end_rule`, `end_value` | Public join lookup |
| `join-competition-by-code` | `competition_code` | Joins, with the header | Without it: `GAME_NOT_SUPPORTED` |

**Handling `ROUND_LOCKED` from a save:** the round locked while the player had the screen open.
Say so plainly ("This round has locked — predictions can no longer change"), reload, and show
the locked view. Never fail silently: a prediction that did not save costs real points. The web
does **not** save optimistically for that reason; the card changes once the server says yes.

---

## 5. The dashboard card

Reference: `lmslocal-web/src/app/dashboard/page.tsx`, inside the competitions grid, `isMatchday`.

**Tell the games apart at a glance. Both of these:**

- **The paper colour.** A Matchday card's background is **`buff` `#F1E4C2`**; an LMS card stays
  `stockLit`. It is a new design-system token (`docs/design-system.md` §2 and §8): add it to
  `CouponTheme` beside `mossWash`, with the same comment. **It is a ground only**, never text or
  rules. **Red (`overprint`) text fails contrast on buff (4.2:1)**, so on a buff card red is a
  border or an icon only, never words. Ink 12.3:1, inkFade 6.4:1 and moss 7.6:1 all pass.
- **The game's name as a stamp**, on every card of both games, above the competition name:
  `MATCHDAY` / `LAST MAN STANDING` in the label style, inside a 1px ink border, ink text. It is
  read before the name, so a player never has to infer the game from the colour.

**The card's lines for a Matchday player**, from the `matchday` block (`MatchdayStanding` in
`lmslocal-web/src/lib/api.ts`: players, position, total, provisional, predicted, rounds_settled,
leader, first_place):

| State | Show |
|---|---|
| Playing, not finished | `4TH OF 12 · 23 PTS` in display type; a small `SO FAR` when `provisional` |
| Round open, **nothing** predicted (`needs_pick` true) | The same red-bordered box with the warning icon that LMS uses for a pick: **"Make your predictions by Fri 8pm"** (ink text, red border and icon) |
| Round open, **anything** predicted | `✓ PREDICTIONS MADE · locks Fri 8pm`, moss |
| No round yet | "Waiting for the first round" |
| Round settled, next not out | "Round settled · next round soon" |
| Locked, results coming | "Matches in play" |
| Complete | A moss-wash box: "Winner: Name" or "Shared win: A and B", the winning total, "you finished 4th" |

- **Made or not made, never a count.** No "7 of 10 predicted" on the card. Skipping a match is
  allowed, so a player who predicted seven has done what the round asks. That is why
  `needs_pick` for Matchday means "nothing predicted yet".
- **No round number** on a Matchday card (LMS keeps its "Round 6").
- **"N playing"**, not "N active": nobody is eliminated in a league.
- The LMS fields on a Matchday competition (`lives_remaining`, `user_status`, `current_pick`,
  `history`, `no_team_twice`) are meaningless for Matchday. Do not read them.

---

## 6. A Matchday competition's home

Reference: `MatchdayHome.tsx`. In order, top to bottom:

1. **Masthead**: the eyebrow `MATCHDAY`, the competition name, and one line with the scoring and
   the length: `WIN +3 · DRAW +1 · LOSE 0 · 6 ROUNDS`.
2. **The round panel**, the one thing a player can act on, so it comes first:
   - No round: "Waiting for the first round's matches. We add them for you."
   - Open: `7/10 MATCHES PREDICTED`, "Locks Fri 27 Nov, 8pm. Change any of them until then."
     Button **"Make your predictions"** (the red primary) when nothing is predicted, otherwise an
     outline **"Your predictions"**.
   - Locked: "Predictions locked. Matches in play." / "Results coming in: 6 of 10." / "All
     results in.", then "You predicted 10 of 10 · +8 this round so far", and **"Your predictions"**.
3. **Your position**: `1ST OF 12 · 8 PTS` (display type), "Includes this round so far" when
   provisional, tapping through to the table.
4. **The top 5 of the table**: dotted-leader rows, names in the typewriter face, "6 of 6 rounds
   played" on the right, a "Full table" link.
5. **Complete**: a moss-wash panel with the winner (or "Shared win" and every joint name), their
   points, "You finished 4th on 23 points", "Final table".

---

## 7. The predictions screen

Reference: `lmslocal-web/src/app/game/[id]/coupon/page.tsx`, the file most worth reading in
full. `docs/matchday.md` §8.2 states the rules. This was redesigned with the owner on 2026-11-22,
and these points are decisions, not suggestions:

- **One view: a strip of cards**, one per match, in kickoff order. There is **no** list or
  full-coupon view. Fewer options, by request.
- **The two teams are the buttons.** Home team first, then a small `v`, then the away team, each a
  full-width tile with the team name in the typewriter face. No "Home" / "Away" labels and no
  fixture line above them, which said the same thing twice. Above the teams: "Match 3 of 10",
  the kickoff time, and `WHO WINS?` while open.
- **Tap a team to predict it.** It saves, the tile turns moss-wash with a `YOUR PREDICTION` tag, and
  about 350 ms later the strip moves to the next match.
- **Tap the predicted team again to take it back.** It clears (`clear-prediction`) and the strip
  stays put. That is how a match is skipped; there is **no Skip button**.
- **Moving between cards never chooses anything.** The strip is a horizontal pager with snapping: a
  swipe moves it, and so do Previous / Next buttons under it. **No copy anywhere says "swipe".**
- **Any manual move cancels a pending auto-advance.** A player who taps a team and immediately
  taps Previous or the tracker must not be carried forward a moment later. (A real bug, found and
  fixed on the web.)
- **The tracker**: a row of segments above the strip, one per match, **moss when predicted**, a
  light grey otherwise, a ring on the current one. Tap a segment to jump to that card. It shows
  how many are left, and where, without a count to read.
- **One status line** under the tracker: "Tap the team you think will win." / "3 still to
  predict." / "All 10 predicted. You can change any of them until the lock." / after lock "You
  predicted 7 of 10. Matches in play." / "This round: +8 · 6 of 10 results in".
- **Open on the first match still to predict**, once only, so a player coming back mid-week
  lands on what is missing.
- **The scoring line on the cards in round 1 only** (`WIN +3 · DRAW +1 · LOSE 0`, under the
  teams of an unpredicted card). From round 2 it is gone from the cards; it stays on the home
  masthead and under the table.
- **Done**: a full-width button to the app's dashboard, shown on the last card, and on every card
  once all are predicted. Red primary while the round is open, ink once it is locked. With
  matches still unpredicted, a line above it: "3 matches not predicted — they score 0. You can
  come back to them until the lock." Nothing to save: every tap was saved as it was made.
- **After the lock** the same cards are read-only. Under the teams, one statement:
  `Nottm Forest won · WON +3`, or `Draw · DREW +1`, or "Liverpool won · not predicted", or
  "Not predicted · scores 0". Plus the crowd line (§10).
- **Earlier rounds**: "← Round 2" / "Latest round →" at the bottom.
- An organiser who is not playing (`is_player` false) sees the matches read-only, headed "The
  matches".

---

## 8. The table

Reference: `lmslocal-web/src/app/game/[id]/table/page.tsx`, and `docs/matchday.md` §8.3.

- Columns: **Pos**, **Player**, **W**, **D**, **L**, **Predicted** (can drop on a narrow screen),
  **Pts**. The figures that break a tie are shown so nobody argues.
- **Shared positions are already computed** (1, 2, 2, 4). Show `position` as given.
- `provisional` → an asterisk after the points, and a footnote: "* Includes the round still being
  played - it can still move."
- Header: "After round 3" (`rounds_settled`), "Round 1" while round 1 is the only one and not yet
  settled, "Before round 1" with no round at all, or "Final" when complete. Top right: **`GAME
  LENGTH`** with "6 rounds". It used to say "How it ends"; the owner renamed it.
- Footer, in words: the scoring; "Nothing takes points away, so a total only goes up."; "Level on points? More wins goes ahead, then more predictions made.
  Still level means sharing the place."; "Tap a name to see their predictions. Nobody's are shown
  until the round locks."
- **A big table opens trimmed**: from 30 players, the top 20, a row of dots, your own row with two
  either side, and "Show all N players".
- Your row bold with `YOU`; the winner's row moss-wash with `WINNER` once complete.
- **Every name opens that player's predictions** (§10).

---

## 9. Numbers the app must take as given

- **Totals, positions, provisional and the tie-break all come from the server**
  (`services/matchdayTable.js`, the one place they are calculated). Do not add up points in the
  app to make a total, even though under 3 / 1 / 0 a total is a plain sum: the server's rules can
  change without an app release.
- **No score is negative** since 3 / 1 / 0 (2026-11-23). A lost match shows `LOST 0`.
- **Won / Drew / Lost are read from the match result, never from the points.** `result` is a team
  short code or `'DRAW'`. Your team = result → Won; `'DRAW'` → Drew; otherwise Lost; a settled
  prediction with no result → Void (a postponement fixed by hand). Reading "3 points = won" breaks
  the day the scoring changes. Same rule as `outcomeWord` in `games.ts`.
- **Signed points**: `+3`, `+1`, `0`. A negative would use a typographic minus (U+2212, not a
  hyphen); none occurs under 3 / 1 / 0.
- **Kickoff and lock times are always shown in UK time** (`Europe/London`), not the phone's zone:
  they are UK kickoffs and a player abroad still needs the real time. Format "Sat 28 Nov, 3pm",
  with ":00" dropped on the hour. (`formatKickoff` in `games.ts`; the app's `round_state.dart`
  likely has an equivalent already for LMS.)
- **Ordinals**: 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st.
- **Game length label**: `end_rule = 'rounds'` → "6 rounds". Two old test competitions have
  `end_rule = 'points'` → "First to 20 points". Handle both; only `'rounds'` can be created now.

---

## 10. Other players' predictions — only after the lock

`docs/matchday.md` §8.6, built on the web 2026-11-22, from `get-round-predictions`.

- **The rule:** nobody sees anyone else's predictions until the round locks. After that, everyone
  in the competition sees everyone's, for that round and every earlier one. View only. Names
  only, never emails. The server enforces it; the app must not try to show it earlier.
- **On each locked card, the crowd line**, below a hairline: `Nottm Forest 3 · Chelsea 7 · not
  predicted 2` and a `WHO` toggle. Opened, two columns, one per side, each headed by the team and,
  once settled, its word (`· WON` / `· LOST` / `· DREW`), listing the names; then "Not predicted"
  with the rest. Every member is in exactly one list. Your own name in bold.
- **Every name links to that player's page.** Reference:
  `lmslocal-web/src/app/game/[id]/table/[userId]/page.tsx`. Eyebrow `ROUND 1`, the player's name,
  their position and points top right. A ledger: one row per match with "Home v Away" small, the
  team they predicted in the typewriter face (or "Not predicted"), and on the right the word and
  points, or `IN PLAY`, or `0`. Then "This round: +8 so far", and ← Round / Round → between locked
  rounds only (`latest_locked_round_number`).

---

## 11. Joining, invite links and deep links

- **Invite links** are `https://lmslocal.co.uk/join/<code>`. An installed app claims `/join/*` and
  `/game/*` (`AndroidManifest.xml`, `lmslocal-web/public/.well-known/apple-app-site-association`).
  No change is needed to either.
- **Old app versions and a Matchday invite**: the app shows the competition (the lookup succeeds),
  and Join returns `GAME_NOT_SUPPORTED` with a message the app shows verbatim: "TEST is a Matchday
  competition, which this app cannot show yet. Open lmslocal.co.uk in your browser, sign in and
  join with the code 35004." It quotes the code because tapping the link again just reopens the
  app. This is why old versions need no change.
- **The new version** sends the header, so the join goes through. Before the Join button, the join
  screen must say which game it is and how it is played. The web's line: "A Matchday game:
  predict the winner of every match each round and score points. Win +3 · Draw +1 · Lose 0. 6
  rounds, most points wins." After joining, land on the Matchday home.
- **Joining closes when round 1 locks**, exactly as LMS. The server enforces it; there is no late
  joining.
- **`/game/:id` for a Matchday competition** must open the Matchday screens. In today's app it
  opens the LMS screen, whose calls all fail with `FORBIDDEN`. Nothing sends such links yet, but
  someone can copy one from a browser.

---

## 12. Notifications

- **There are no Matchday push notifications, and an app update alone will not create any.**
  `routes/process-mobile-notifications.js` marks every queued notification for a non-LMS
  competition `skipped`, whatever the client. The rows that queue them are LMS events (new round,
  pick reminder, results).
- So a Matchday player in the app gets **no** "new round" or "locks soon" prompt. That is a known
  gap on the web too: Matchday has no emails either (`docs/matchday.md` §9). Designing Matchday
  notifications is **server work**: wording in the Matchday vocabulary, which events, and lifting
  the guard per type. It is not part of the app change. Raise it with the owner rather than
  working around it.

---

## 13. Words — the two games never share them

`docs/matchday.md` §2. A player should know which game a sentence is about from the words alone.

| | Last Man Standing | Matchday |
|---|---|---|
| The choice | pick | prediction; "predict the winner" |
| The action | Make your pick | **Make your predictions** |
| Where you stand | still in / out, lives | points, position |
| What a result does | survived / eliminated | +3 / +1 / 0, Won / Drew / Lost |
| The board | standings | the table |
| How it ends | last one standing | most points after N rounds |

- **No betting words, in either game.** Never "back", "backed", "backing" a team, or anything
  else that reads as gambling. A chosen team is "predicted".
- **"Coupon" is not a player-facing word any more.** The screen is "Your predictions"; the
  action is "Make your predictions". (The web route is still `/coupon`; that is only a URL.)
- No "swipe" anywhere, no "Skip" button, no "active" count (say "playing").
- The game's display name comes from one place on the web (`GAME_NAMES` in `games.ts`). Keep one
  place in the app too: "Matchday" is a working name and may be renamed.
- The app's own copy rule still applies: in the app "you" is the player (see the note in
  `lib/presentation/widgets/auth_shell.dart`).

---

## 14. Design summary for the app

- Everything is the existing coupon system: stock grounds, ink and overprint, moss for "in / won",
  moss-wash for winner fields, the three faces (display, body, typewriter for filled-in data),
  hairline rules, the print-offset shadow on a held card.
- **New: `buff` `#F1E4C2`**, Matchday's paper, used **only on the dashboard card** for now. The
  Matchday screens themselves stay on the usual stock. Whether they take buff too is an open
  design-system question (`docs/matchday.md` §11). Do not extend it without the owner deciding
  it, and `docs/design-system.md` recording it, first.
- **State is never colour alone**: every state carries its word (Won, Predicted, In play), as the
  existing LMS widgets already do.
- **Red means "this is on you"**: the one primary action. On Matchday that is "Make your
  predictions" while nothing is predicted, and Done while the round is open. Once the player has
  acted, buttons step down to outline or ink.

---

## 15. Offline and caching

The app caches the dashboard for offline use. Points to check:

- The cache must carry `game_type`, `end_rule`, `end_value` and the `matchday` block. A cached
  card rendered without `game_type` would fall back to LMS.
- A cached Matchday card's "Make your predictions" / "Predictions made" can go stale like
  `needs_pick` does for LMS. The same freshness rule as LMS applies.
- **Predictions must not be queued offline and sent later.** A save is confirmed by the server
  or it did not happen, and a lock can pass in between. Show the failure and let the player
  retry.

---

## 16. Testing

- **The database is live production. There is no staging.** Read `lmslocal-server/db/README.md`
  before anything that writes, including saving a prediction through the app.
- **Ask the owner which competition to test against.** Never reuse an id from a doc. Matchday
  competitions belong to organiser 50 while in preview.
- **Rounds and results for a test competition**: `node scripts/sandbox-round.js` from
  `lmslocal-server/` (`status`, `adopt`, `open`, `lock`, `result`; usage in its header). It
  settles through the real results push. While Matchday is in preview it accepts any Matchday
  competition of organiser 50's, whatever its name. **Locking round 1 closes joining for good**,
  so confirm with the owner first. **Never use the admin calendar or Stage for testing**: they
  are shared by every customer.
- Run against a local server (`lmslocal-server`, port 3015) for anything not yet deployed.
- **What to see, at minimum**: an old build (no header) still showing no Matchday and refusing a
  Matchday join with the message; the new build showing the buff card; predicting, changing,
  taking back, auto-advance and a quick Previous after a tap; the tracker; Done; a lock passing
  while the screen is open (`ROUND_LOCKED`); a partial results push (provisional totals and
  asterisks); a settled round; the crowd line and a player page; a finished game with a winner;
  a `/game/:id` deep link and a `/join/:code` link into a Matchday competition.
- **Release order**: the server already has everything the app needs (as of commit `641ff83`,
  once deployed). Confirm production is running it before shipping the app build.

---

## 17. Not decided, so not to be built

- Matchday notifications and emails (§12).
- A paper colour for the Matchday screens beyond the dashboard card (§14).
- An icon per game (suggested by the owner, not decided).
- Postponed matches: fixed by hand in the database, for both games (`docs/matchday.md` §5.4).
- The game's final name (`docs/matchday.md` §11).
