# Matchday — the second game

A second game type, played alongside Last Man Standing on the same fixtures, rounds and calendar.
For every match in a gameweek a player predicts the winner: **win +3, draw +1, loss −1**. The result is
a league table of points.

**Status: phases 1–3 built, 2026-11-22 — playable on the web end to end** (§10). Not yet: the
admin game column, Matchday emails, the app.

**IN PREVIEW: only organiser 50 can create a Matchday competition.** `MATCHDAY_PREVIEW_ORGANISER_IDS`
in `services/gameType.js`. Everyone else gets the create wizard exactly as before - three steps, no
"Which game?" - and `create-competition` refuses `matchday` from them with `FORBIDDEN`. The web
learns which games a user may create from `user.can_create_games` on `get-user-dashboard`.
**Launching is setting that constant to `null`**, in a commit of its own. What customers do see
meanwhile: the game's name ("Last Man Standing") above each competition on the dashboard and as a
row on the join page, and the game-neutral invite preview. "Matchday" is a working name; see §11.

This doc is the contract. When a new scenario turns up ("what does a postponed match score?",
"what does the app show a Matchday player?"), answer it here first, then change the code to
match. It also sets the presentation rules, because the real risk of a second game is a player
not knowing which game they are in or what to do next, not the server work.

---

## 1. The rules

| Rule | Decision |
|---|---|
| What a player does | For each fixture in the round, predicts the home team or the away team to win. A draw cannot be predicted |
| Scoring | Predicted team wins **+3**, draw **+1**, predicted team loses **−1** |
| Skipping | Allowed. An unpredicted fixture scores **0**. There is no penalty for skipping, unlike LMS's missed pick |
| Floor | **Applied after each round**: `total = max(0, previous total + round score)`. A total is never shown below 0 and there is no hidden debt below it |
| Lock | **One lock for the whole gameweek**, at `round.lock_time`, the same as LMS. Predictions can be changed until then |
| Joining | **Exactly the LMS rule**: open until round 1 locks, then closed. See §6 |
| Ending | Set by the organiser at creation, from a fixed list: **first to 10, 20 or 40 points**, or **highest total after 3, 7 or 10 rounds** (`ENDING_CHOICES`, 2026-11-22). See §5.3 |
| Tie-break | Total, then **most wins**, then **most predictions made**. Still level → the win is shared |
| Fixtures and results | **Fixture service only**, always. There is no organiser-managed Matchday |
| Pricing | The same as LMS: one player is one place |

### 1.1 Why the floor is applied per round

Three readings were possible, and only one holds up:

- **Per fixture**, in kickoff order. Results arrive in pushes (Friday night, then Saturday), so the
  total would depend on which push carried which result. Rejected.
- **On the displayed total only.** A raw −5 shows as 0, and the player then needs five points
  before their total moves. That is invisible debt. Rejected.
- **Per round** (chosen). The floor is applied once, when the round settles. Mid-round, the table
  shows `max(0, settled total + points so far this round)` as provisional. Every order of pushes
  gives the same answer.

### 1.2 Skipping is not a tactic

The expected value of predicting a team is at least 0 for nearly any match: even a heavy underdog
(say 15% win, 20% draw, 65% loss) comes out at 0.45 + 0.20 − 0.65 = 0. So letting players skip at
0 points does not reward cherry-picking, and "most predictions made" as the second tie-break
rewards the players who fill in the whole coupon.

### 1.3 Deferred: nobody should pull out of reach

A player who gets well ahead under first-to-N can make the rest of the game pointless for
everyone else. The scoring will be reworked to keep the table competitive. **Not decided, not in
version 1**, but keep the scoring in one place (§5) so the change lands in one place.

---

## 2. Vocabulary — the two games never share words

A player should know which game a sentence is about from the words alone: on a dashboard card,
in an email subject, in a push notification. So the words in one column **never appear on the
other game's screens or emails**.

**No betting words, in either game** (2026-11-22): never "back", "backed" or "backing" a team.
It reads as gambling. A chosen team is "predicted"; the deck's buttons say "ARS to win".

| | Last Man Standing | Matchday |
|---|---|---|
| The choice | pick | prediction; "predict the winner" |
| The action | Make your pick | Fill in your coupon |
| Where you stand | still in / out, lives | points, position |
| What a result does | survived / eliminated | +3 / +1 / −1 |
| The board | standings | the table |
| How it ends | last one standing | first to N points / after N rounds |

LMS copy that says "pick" stays as it is. New Matchday copy is checked against this table.

---

## 3. Keeping the games apart

### 3.1 `competition.game_type`, fixed at creation

`game_type` is `'lms'` or `'matchday'`, `NOT NULL DEFAULT 'lms'`, so every existing competition is
LMS with no migration of meaning. Like `fixture_service`, it is **fixed at creation**:
`update-competition` ignores it, and the settings screen does not offer it. Changing the game
under players who joined for the other one is not a setting; it is a new competition.

### 3.2 Branch once, at the top

A route, page or service decides which game it is serving **at its entry point**, and then runs
code written for that game only. No `if (gameType === ...)` sprinkled through the 1,600-line
`/game/[id]/page.tsx` or the 500-line results push.

### 3.3 Guards name the game they allow

Every LMS-only path filters on **`game_type = 'lms'`**, never on `game_type <> 'matchday'`. A
third game is then kept out of LMS emails, bots, the app and the elimination rules **by
default**, instead of leaking in until someone remembers. The SQL fragment lives in one place,
`services/gameType.js` (`isLmsSql(alias)`), and is composed like `notArchivedSql()`. Never write
it by hand.

### 3.4 Predictions get their own table, not `pick`

`pick` is read in roughly forty places, all of which assume **one pick per player per round**,
plus lives and elimination: the no-pick penalty, allowed teams, reminders, statistics, unpicked
players, bots. Ten Matchday rows per player per round in `pick` would need a guard on every one
of those queries, forever, and the first one missed breaks LMS. In a separate table, LMS code
cannot see Matchday data at all.

---

## 4. Data

### 4.1 `competition`

| Column | Type | Notes |
|---|---|---|
| `game_type` | varchar, not null, default `'lms'` | `CHECK (game_type IN ('lms','matchday'))` |
| `end_rule` | varchar, null | `'points'` or `'rounds'`. Null for LMS |
| `end_value` | integer, null | The target points or the number of rounds |

`competition_end_rule_check`: an LMS row carries neither value, a Matchday row must carry both
(`end_value > 0`). `create-competition` and `update-competition` also hold them to the fixed
lists in `ENDING_CHOICES` (`services/matchdayScoring.js`, mirrored in `lmslocal-web/src/lib/games.ts`).
A competition created before the lists existed keeps its ending; settings only sends the ending
when it changes, so its other saves still work.

`end_rule` / `end_value` are to be editable **until round 1 locks**, the same window as joining,
and fixed after: players joined knowing how it ends. **Not built yet** — `update-competition`
does not take them. It arrives with the settings screen that offers it, in phase 3.

The LMS columns (`lives_per_player`, `no_team_twice`, `competition_user.lives_remaining`,
`teams_reset_round`, `re_buys`) are left at their defaults and **never read** for Matchday.
`competition_user.status` stays `'active'` for every Matchday player: nobody is eliminated.

### 4.2 `prediction`

| Column | Type | Notes |
|---|---|---|
| `id` | serial | |
| `competition_id` | integer, not null | |
| `round_id` | integer, not null | |
| `fixture_id` | integer, **null** | Null only between a reconcile clearing it and re-pointing it — §4.3 |
| `user_id` | integer, not null | |
| `team` | varchar, not null | Team short code, the same values as `fixture.result` |
| `points` | integer, null | Null until the fixture is settled; then 3, 1 or −1. The CHECK also allows 0, for the hand fix of a postponed match (§5.4) |
| `created_at` / `updated_at` | timestamptz | |

`UNIQUE (user_id, fixture_id)`. A changed prediction is an update, not a second row.

**Totals are derived, never stored.** The stored `allowed_teams` copy is the lesson
(`docs/allowed-teams.md`): it drifted from what it was copied from. `points` on a row is the record
of what happened, like `pick.outcome`; the running total is a fold over round scores with the
floor (§1.1), computed in **one** service, `services/matchdayTable.js`, from one grouped query
(players × rounds, which is small). The dashboard, the table, the completion check and the emails
all read it from there.

### 4.3 Landmine: the calendar reconcile deletes fixtures

A block-started competition has a provisional round 1. When its block is pushed,
`pushFixturesToCompetition` **deletes the round's fixtures and re-inserts them**
(`services/fixtureService.js`, the `reconciled` branch), then re-points `pick.fixture_id` by team.
Predictions need the same treatment in the same place: clear `prediction.fixture_id` before the
delete, and re-point by `team` after the insert. A prediction whose team is no longer playing
keeps `fixture_id` null and scores 0 — the same as an orphaned pick, which that branch already
leaves to the operator.

Give `prediction.fixture_id` a foreign key to `fixture` (`NO ACTION`). Then any path that deletes
fixtures without dealing with predictions **fails loudly** rather than leaving orphans. The same
applies to `reset-competition` and `delete-competition`, which both `DELETE FROM fixture` and
must delete the competition's predictions first.

---

## 5. Results

### 5.1 The operator's workflow does not change

Confirm results → Push all, exactly as now. Matchday competitions are fixture-service
competitions, so they appear in `/admin/get-push-targets` with no change. The report on each row
reads "40 predictions settled, leader on 34" instead of "3 eliminated".

### 5.2 The push dispatches at step 3

`routes/admin/push-results-to-competition.js` splits cleanly:

- **Steps 1–2** (write `fixture.result` from the staged scores) are game-agnostic and run for
  every competition, unchanged.
- **Step 3** (from "PROCESS THIS COMPETITION'S RESULTS") is LMS: lives, `out`, the no-pick
  penalty, last player standing. For Matchday it is replaced, after the same lock check and the
  same `processed` claim, by `settleMatchday(client, competitionId, roundId, fixtureIds)` in
  `services/matchdayScoring.js`.

Settling a fixture is **one statement** for all its predictions, not a loop:

```sql
UPDATE prediction p
SET    points = CASE WHEN f.result = 'DRAW' THEN 1
                     WHEN f.result = p.team THEN 3
                     ELSE -1 END
FROM   fixture f
WHERE  p.fixture_id = f.id AND f.id = ANY($1)
```

There is no no-pick step: a skipped fixture has no row and scores 0.

`routes/organizer-process-results.js` stays LMS-only and **refuses** a Matchday competition. The
header's "two copies of one ruleset" warning is about LMS; Matchday adds one ruleset in one place
and must not become a third copy.

### 5.3 Completion

Checked **only once every fixture in the round is processed**, the same gate LMS uses:

- **`points`**: if anyone's total is ≥ `end_value`, the game is complete.
- **`rounds`**: if this was round `end_value`, the game is complete.

The winner is the top of the table by total, then wins, then predictions made. A tie on all
three is a shared win: `winner_id` is left null, which already means "no single winner" for LMS
(everybody out). The table and the emails name the joint winners.

No new push rule is needed to stop rounds after the end. `evaluateCompetition` already refuses a
`COMPLETE` competition, and refuses a new round while the current one has unprocessed fixtures.

### 5.4 Postponed matches score 0

**The rule: a postponed match scores 0 for every prediction on it.** Decided 2026-11-22.

**Not built in version 1, deliberately.** A postponement has never happened in either game, so it
is fixed **by hand in the database** if one does, and built properly later, for both games at
once. LMS has the same gap: no postponement concept, a round that cannot finish processing, and
the operator force-closing the gameweek (`docs/competition-start.md` §3).

The manual fix for Matchday, through `db/write.js` (read `lmslocal-server/db/README.md` first): set
`points = 0` on that fixture's predictions and stamp the fixture's `processed`. The round then
counts as fully processed, and the completion check runs on the next push.

**Do not write `DRAW` as a stand-in.** It gives Matchday +1, not 0, and in LMS a draw costs every
player who picked that match a life.

---

## 6. Joining

**The LMS rule, with no Matchday-specific code.** Joining is open while round 1 has not locked,
computed live from round 1's `lock_time`, never from `competition.status`
(`docs/player-onboarding.md` §4.2). Places, the free limit, `joinBlock` and the full-competition
message behave the same.

Late joining is not allowed. A late joiner starts so far behind that the deferred scoring rework
(§1.3) would have to solve their problem as well.

---

## 7. Clients: the server decides what each one sees

### 7.1 Clients declare the games they can show

The Flutter app is live, player-only, and has no forced-update gate, so every version ever
shipped stays in use indefinitely. **None of them knows Matchday exists**, and none will be
changed for this. The server guarantees they are never shown a game they cannot render.

- A client lists the game types it can show in a header: **`X-Game-Types: lms,matchday`**.
- **No header means `lms` only.** Every app version in the wild sends nothing, so it keeps
  behaving exactly as today with no app release.
- The web sends the header from the axios client (`src/lib/api.ts`). A future app version opts in
  the same way.
- **The header must be added to CORS `allowedHeaders` in `server.js`.** The list is fixed
  (`Content-Type`, `Authorization`, …), and a browser preflight rejects an unlisted header, which
  fails every web request rather than just this feature.
- Parsed in one place: `clientGameTypes(req)` in `services/gameType.js`.

### 7.2 What an LMS-only client gets

| Route | Behaviour |
|---|---|
| `get-user-dashboard` | Competitions of a game the client did not declare are **left out**. The app's dashboard already has its "open on the web" card |
| `get-competition-by-code` | Unchanged, `SUCCESS`. The old app treats any other code as "We could not check that code", which is wrong here |
| `join-competition-by-code` | Refuses with **`GAME_NOT_SUPPORTED`** and a message naming the game and saying to join on the web. The app shows the join route's `message` verbatim (`join_page.dart`), so the player is told the truth |
| Push notifications | No `mobile_notification_queue` rows for Matchday competitions. FCM's only reader is the app |

The `/join/*` app deep link (not yet built, `docs/flutter-migration.md`) lands on the same join
screen and gets the same refusal.

### 7.3 LMS routes refuse Matchday competitions, whatever the client

`set-pick`, `unselect-pick`, `get-current-pick`, `get-allowed-teams`, `get-unpicked-players`,
`get-pick-statistics`, `get-round-statistics`, `get-fixture-pick-count`, `get-standings-*`,
`get-player-history`, `admin-set-pick` and the bot routes return `FORBIDDEN` for a competition
whose `game_type` is not `'lms'`. That is not about the app; it stops any client writing LMS state
into a Matchday competition.

---

## 8. Presentation

### 8.1 The game is the first thing on every screen

- **Dashboard card**: the game's name is the eyebrow on every competition card, both games, so
  the difference is visible in a list. The main line is game-specific:
  - LMS: "Still in · pick needed"
  - Matchday: "4th of 12 · 23 pts" and "7 of 10 predicted · locks Sat 12:30"
- **Create wizard**: step one is **"Which game?"**, two large choices with one sentence each,
  before anything else is asked. Matchday adds the ending (first to N points / after N rounds).
- **Join page** (`/join/...`): the headline names the game, with one line on how it is scored,
  before the Join button. This is where a player first forms a picture of the game.
- **Inside a competition**: the game name appears in the header of every page.

### 8.2 Entry: a card deck, then the coupon

- One card per fixture: the two teams, and "Win +3 · Draw +1 · Lose −1".
- **Home**, **Away** and **Skip** are always visible as buttons. Swiping is a shortcut, never the
  only way: desktop has no swipe, and a gesture alone is not accessible.
- The deck shows its position ("3 of 10").
- After the last card, the player lands on **the coupon**: every fixture, the team predicted or
  "not predicted", each editable until lock. The coupon, not the deck, is the game's home while
  the round is open; the deck is how you fill it in. A player who returns mid-week sees what they
  have done and what is missing.
- After lock: the coupon shows the predictions; as results come in, each row gets its points.
- Other players' predictions are **hidden until lock**, as LMS picks are
  (`get-standings-group.js`: own pick, or the round is locked).

### 8.3 The table

Position, name, total, then wins and predictions made (the tie-breaks, shown so nobody argues).
A provisional total mid-round is marked as provisional. The footer states the ending ("First to
20 points" / "Round 6 of 10") and the tie-break order.

**A big table opens trimmed**: from 30 players, the top 20, then a row of dots and your own row
with two either side, and "Show all N players". The home screen shows only the top 5 and the
dashboard card only your position, so neither grows with the competition. The data is one query
of players × rounds - a hundred players over a 38-round season is under 4,000 rows.

### 8.4 Pages

- `/game/[id]/page.tsx` branches **once**, at the top, to an LMS home or a Matchday home
  component.
- Matchday pages: `/game/[id]/coupon` (the deck and the coupon) and `/game/[id]/table`.
- LMS player pages (`pick`, `standings`, `player-results`) redirect to the game home when opened
  on a Matchday competition.
- Shared organiser pages (`players`, `settings`, `promote`) stay shared, minus the LMS-only
  fields: lives, re-buys, no-team-twice. `/game/[id]/round` shows the organiser a read-only
  Matchday view; there is nothing for them to enter.

### 8.5 Design system

Built to `docs/design-system.md` like every game screen. The pools coupon fits Matchday better
than LMS: a real coupon was a row per match. Whether Matchday gets its own paper tint (pools
companies printed on different coloured stock) is a design-system decision. If it is taken, it is
**written into `design-system.md` before any screen uses it**. Open, §11.

---

## 9. Emails, notifications, bots, admin

- **Every competition email service** composes `isLmsSql()` into its candidate query, alongside
  `notArchivedSql()` and `notOptedOutSql()`, because their copy is LMS copy. That includes
  `welcome`, which is `services/joinComp.js` — a welcome **to a competition**, not to the
  platform — so Matchday players get **no emails at all at launch**. The two left unguarded are
  `join_lms` (platform-wide, no competition) and `join_blocked` (about places, not a game). The
  unwired `shareReminder.js` and `gameStartReminder.js` are guarded too, so re-wiring either
  cannot leak. Matchday emails are designed later as their own `emailCatalog.js` entries and
  `OUTLINE` rows.
- **Push notifications**: none for Matchday (§7.2). Guarded once, in
  `process-mobile-notifications` — the one place that sends — which marks any pending row for a
  non-LMS competition `skipped`. The six places that queue are left alone.
- **Bots**: LMS only. `loadBotCompetition` in `services/botPool.js` refuses any other game with
  `COMPETITION_NOT_ELIGIBLE`, which covers all five bot routes at once.
- **Admin, Competitions screen**: a game column and a filter. The counts (`get-admin-stats`,
  Active people, Organisers) include both games. They are about customers, not games.
- **Admin, Results**: unchanged apart from the row report (§5.1).

---

## 10. Build order

0. **This doc**, agreed. Plus the design-system decision in §8.5 if a tint is wanted.
1. **Guardrails, with no visible change. Built 2026-11-22.** The `game_type` column (migration
   `db/migrations/2026-11-22-competition-game-type.sql`, **applied** — all 50 rows `'lms'`),
   `services/gameType.js`, the CORS header, `isLmsSql()` in every email service, the bot and LMS
   route refusals (§7.3, plus `buy-player-back-in`, `organizer-set-result` and
   `organizer-add-fixtures`), the notification guard, and the dashboard and join filters.
   `push-results-to-competition` refused a non-LMS competition until phase 2's dispatch.
   **The web does not send `X-Game-Types` yet**: it starts when `'matchday'` joins
   `GAME_TYPES_SHOWN` in phase 3, and **the server must be live before that web deploy** — the
   header fails every preflight against a server without it in CORS `allowedHeaders`. (It was
   sent as `lms` at first; withdrawn the same day, since it changed nothing and made the first
   deploy order-sensitive.)
2. **Server. Built 2026-11-22.** Migration `db/migrations/2026-11-22-matchday-prediction.sql`
   (**applied**): `end_rule` / `end_value` and the `prediction` table, its foreign keys NO
   ACTION. `services/matchdayTable.js` (totals, floor, tie-break; `rankTable` is pure) and
   `services/matchdayScoring.js` (settling, completion). The push branches after its claim, so a
   Matchday competition finishes like any other and no longer holds the gameweek close open.
   Routes: `set-prediction`, `clear-prediction` (the deck's Skip; idempotent),
   `get-predictions` (the coupon) and `get-matchday-table`. `create-competition` takes
   `game_type`, `end_rule`, `end_value`, and refuses Matchday without the fixture service.
   Predictions are deleted wherever picks are (both competition deletes, reset, remove-player,
   leaving before the start, account deletion), and cleared and re-pointed by team in the
   calendar reconcile — the later prediction wins when two predicted teams are re-keyed into one
   fixture. The admin Results row reports "N predictions settled · X leads on 34".
   **Tested** end to end on test competitions under organiser 50, through the real routes and
   the real results push, with `scripts/sandbox-round.js` supplying rounds and results (see
   `lmslocal-server/db/README.md`): predictions made, changed, cleared, refused after lock and after
   the game ended; a partial push showing a provisional total floored at 0; a round crossing
   the target mid-round and completing only when settled; the rounds ending; reset, both
   deletes, remove-player and leaving with predictions in place; the reconcile SQL in a
   rolled-back transaction; and LMS through the changed push (a lost pick, a missed pick).
   **Not tested:** account deletion (reviewed only), and a real Stage push into a Matchday
   competition — the push path is game-agnostic and unchanged.
   **Not yet:** the dashboard's Matchday fields (position, total, "7 of 10 predicted") — with
   the dashboard card in phase 3.
3. **Web. Built 2026-11-22.**
   - **Create wizard**: "Which game?" is step 1 of 4, with no default. Matchday drops lives and
     the fixture-service choice (always on) and asks "How it ends" (default first to 100;
     10 if rounds). It refuses a league we don't supply matches for at the details step.
   - **Join page**: a "Game" row on every competition, and for Matchday a line on how it is
     scored and how it ends. `get-competition-by-code` now returns `game_type` / `end_rule` /
     `end_value`.
   - **Dashboard card**: the game's name above every competition's name. Matchday shows
     "4th of 12 · 23 pts", then "Fill in your coupon by …" / "7 of 10 predicted · locks …" /
     "Matches in play", and the winner or a shared win. `get-user-dashboard` adds a `matchday`
     block per competition from `getMatchdayTables` (one query however many competitions).
   - **`/game/[id]`** branches once, in a wrapper default export, to
     `components/matchday/MatchdayHome.tsx`; the LMS screen is otherwise untouched.
   - **`/game/[id]/coupon`**: the card deck (Home / Away / Skip buttons; swipe and arrow keys as
     shortcuts) and the coupon. The deck opens by itself only when nothing is predicted.
   - **`/game/[id]/table`**.
   - **Redirects**: pick and player-results → coupon, standings → table
     (`hooks/useMatchdayRedirect.ts`).
   - **Settings**: the ending is editable until round 1 locks (`update-competition` takes
     `end_rule` / `end_value`; `endingProblem` in `matchdayScoring.js` is the one validation for
     create and update). Lives are hidden, and the reset/delete wording follows the game.
   - **Players page**: no lives, Set pick, Mark as out or Bring back in.
   - **`StartDateChooser`** takes `gameType` for its one sentence.
   - The game names, the scoring line and the ending wording live in `src/lib/games.ts`.
     Renaming the game is a change there.

   Fixed on the way: settings decided "started" from a missing invite code, which no longer
   happens, so **every save on a started competition failed** with COMPETITION_STARTED, even one
   that only changed the description. It now uses `joiningOpen` from `roundState.ts`. The create
   wizard's error also showed only on the details step, behind the Back button; it now shows on
   review, where the submit is.

   **Tested** in a browser against a local server: dashboard, home, deck, coupon (change and
   skip), a partial push and a settled round, table, the wizard to review, join page signed out,
   settings, the LMS home, the redirect. **Not tested:** swiping with a real finger (the deck's
   buttons and arrow keys were), and `next build` (it would have overwritten a dev server running
   in the same folder; type-check and lint pass).

   **The invite preview is game-neutral** (2026-11-22): `join/[code]/layout.tsx` and
   `lmslocal-marketing/social/og-join.html` (rebuilt `og-join.png`) name neither game, because
   the preview is static and one link can be to either. The page names the game on opening.

   **Open:** the promote page and leaflets have not been checked for LMS wording.
4. **Admin.** Game column and filter on the Competitions screen. (The push row report went in
   with phase 2.)
5. **Matchday emails.** Then the app, by sending `X-Game-Types` from a new version.

---

## 11. Open questions

| Question | Notes |
|---|---|
| The name | "Matchday" is a working name. Common football word: fine inside LMS Local, hard to own on its own. Alternatives raised: The Coupon, Full Card, Every Match |
| Keeping the table competitive | §1.3 — deferred to after version 1 |
| A paper tint for Matchday | §8.5 — a design-system decision |
| Postponed matches, both games | §5.4 — fixed by hand until built properly, after version 1 |
| Matchday emails | Which emails, and their rules — after launch |
