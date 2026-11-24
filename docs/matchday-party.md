# Matchday Party — the party game

A third way to play, for one evening in one room. Friends or family predict the winners of
made-up Premier League fixtures on their phones; when everyone has chosen, the TV turns into a
vidiprinter and the scores come in. Points go on a table, and after 4, 6 or 8 rounds the most points
wins. Fast, free, and played for fun.

**Status, 2026-11-24: phase 0 (the engine, §4) and phase 1 (tables and routes, §7) built. No screens.** The decisions marked *(decided)* came
from Andreas on 2026-11-24. §10 lists what is still open. "Matchday Party" is a working name.

This doc is the contract, as `docs/matchday.md` is for Matchday: answer a new scenario here first,
then change the code to match. Keep section numbers stable once code cites them.

---

## 1. What it is, and what it is not

| | Matchday | Matchday Party |
|---|---|---|
| Played | Over weeks, on real gameweeks | One sitting, in one room, ~30–60 minutes |
| Fixtures | Real fixtures, real results | **Real Premier League teams, made-up fixtures, simulated results** *(decided)* |
| Who runs it | An organiser, through a competition | A **host**, who sets up a room and drives it *(decided)* |
| Players | LMSLocal accounts | **A name typed on a phone. No account** |
| Screens | Phone or web | Phones to predict, **one shared screen** (the TV) for everyone to watch |
| Cost | One player, one place | **Free, with no limits** *(decided)* |
| Money | The organiser's business, off-platform | **None, ever** — see §8 |

It is **not a competition**: no `competition` row, no `game_type`, no fixture service, no calendar,
no billing places, no emails, no bots. It borrows Matchday's scoring and vocabulary and nothing
else, so neither game can break the other.

**Think of it as an enhanced paper game** *(Andreas, 2026-11-24)*: the kind a family plays in the
front room, with the phones doing the scoring and the TV doing the drama. When a choice comes up,
take the simpler one.

**Why build it.** It is the one product that reaches people who are not organising anything — a
family at Christmas. Someone in that room may run the work competition in January. The game is
free and the host needs an account *(decided)*, which is how it pays its way.

---

## 2. The rules

| Rule | Decision |
|---|---|
| Teams | **Premier League only, to start** *(decided)*. Real club names; no crests or badges (§8) |
| A round | **10 fixtures: all 20 teams, each playing once** *(decided)*, drawn at random. Every team plays every round, which is what makes form matter (§4.3) |
| What a player does | For each fixture, predicts the **home team or the away team to win** *(decided: winners only)*. A draw cannot be predicted, as in Matchday |
| Scoring | Matchday's: predicted team wins **+3**, draw **+1**, predicted team loses **0**, left blank **0** |
| Length | **4, 6 or 8 rounds**, chosen by the host at setup *(decided)* |
| Locking | The round locks **when every player has submitted**, or **when the host locks it** *(decided: the host can push things on)*. Fixtures left blank at lock score 0 |
| Results | Simulated by the engine (§4) **at lock**, never earlier, so nothing can be found out in advance |
| The reveal | The TV plays the round as a vidiprinter (§6), then shows the table |
| What players see | **Team names, and from round 2 each team's W/D/L form in this game** *(decided)*. No ratings, no odds |
| Tie-break | Matchday's: points, then most winning predictions, then most predictions made. Still level, shared |
| Phones | **Every player needs their own phone** *(decided)*. There is no pass-the-phone mode |

---

## 3. Roles and screens

Three views, all in the web app. No new app is needed: phones use the browser, and the TV is any
browser — a laptop on HDMI, a smart TV's browser, or a Chrome tab cast to the TV.

| View | Who | What it does |
|---|---|---|
| **TV** | Everyone watches; nobody touches it | Lobby with the room code and a QR code → "who has chosen" while a round is open → the vidiprinter → the table → the final podium. **Read-only**, so it can run on any device and can be refreshed without losing anything |
| **Player phone** | Each player | Join with the code and a name → predict the 10 fixtures → wait → see their own round score |
| **Host controls** | The host, on their own phone | Everything a player does, plus: start the game, lock the round now, start the reveal, next round, remove a player, end the game |

**One person is always in charge** *(decided)*: the host. The host is also a player. If the host's
phone dies, the game waits; nothing advances without them (§10, question 6).

---

## 4. The match engine

Agreed 2026-11-24, built as `services/partyEngine.js` and tuned with
`scripts/party-engine-sim.js` (no database). The engine is pure: the same seed always gives the
same result. It is a paper game played by the server: dice, windows and a count.

### 4.1 Ratings

Every team has a **rating from 1 to 100** that we set and maintain. It is a judgement, not
computed from live data, so no feed can break the game. Reviewed each season and at promotion and
relegation. The first set is **provisional**, in the sim script; once agreed it moves to the
`mdparty_team` table (§7). Ratings are never shown to players (§2).

### 4.2 A match *(decided)*

- A match is **9 blocks of ten minutes**.
- In each block **both teams roll** a number from 0 to 100. A roll inside the team's **window** is a
  goal. Both can score in the same block; a draw is simply level counts.
- A team's window is **31 × its share of the chances**. A share, not the bare rating, so two
  strong sides do not trade six goals each and two weak ones do not draw 0–0 every time.
- The share comes from the **gap** between the two ratings, on a curve 48 wide *(decided)*. Not
  their ratio: as a ratio, a gap of 30 counted for less at the top of the league than at the bottom,
  and Man City finished a 6-round game in the bottom half 24% of the time. On the gap it is 14%.
- The home side adds **10** to its rating before the gap is taken *(decided; was 5)*: home 44%,
  draw 23%, away 33%, close to real Premier League seasons.

Measured over 100,000 matches each (2026-11-24):

| Match-up | Home wins | Draw | Away wins |
|---|---|---|---|
| Top v bottom (92 v 20) | 84% | 12% | 4% |
| Bottom v top (20 v 92) | 7% | 16% | 77% |
| Top half v bottom half (74 v 48) | 63% | 22% | 15% |
| Evenly matched (62 v 60) | 46% | 26% | 28% |

About **2.8 goals a match**, the Premier League average. The common scorelines are 2–1, 1–0, 2–0
and 1–1, with the odd 4–1 or 3–3.

### 4.3 Form: the league-position bonus *(decided)*

- From **round 2**, each team adds **(21 − its position) × 1** to its rating, from the teams' own
  table in this game: top +20, bottom +1. Round 1 has no table and no bonus.
- **×1, not ×2.** After a round or two the table is mostly goal difference, and ×2 let one lucky
  weekend count for more than the club.
- The bonus lives only in the game and never changes a stored rating.
- Players see form in two places: the W/D/L strip beside each team when predicting, and **the
  teams' table on the TV after each reveal** *(decided)*, which is what explains why Hull suddenly
  look dangerous.

Over 5,000 simulated games of 6 rounds, the favourite wins 56% of its matches, so the game stays
open. Hull (rated 20) finish in the top half about 1 game in 20, and Man City (92) in the bottom
half about 1 in 7. That is a short game's story, by design: over a full 38 rounds City finish in
the bottom half about 1% of the time.

| Rounds | City finish bottom half | Hull finish top half |
|---|---|---|
| 4 | 18% | 8% |
| 6 | 14% | 5% |
| 8 | 11% | 3% |
| 38 | 1% | 0% |

### 4.4 Goal times

A goal's minute is a random minute inside the block it was scored in. That is what the vidiprinter
plays (§6).

### 4.5 Two steps, two seeds

- **When a round opens**, the engine draws the fixtures: all 20 teams paired at random, home side
  at random.
- **When it locks**, and never before, the engine plays them with a second seed. No result exists
  while a prediction can still change.
- Both seeds are stored with the round, so any result can be played again to check it.

---

## 5. A game, start to finish

1. **Host creates a room**, signed in to a free LMSLocal account *(decided)*, and chooses 4, 6 or 8 rounds. The TV shows
   the room code and a QR code.
2. **Players join**: scan the QR or type the code, type a name. Their names appear on the TV.
3. **Host starts the game.** Round 1's fixtures are drawn.
4. **Players predict** on their phones. The TV shows who has finished — names only, never what
   they chose.
5. **The round locks** when the last player submits, or when the host locks it.
6. **The engine plays the round** (§4), and the TV runs the vidiprinter (§6).
7. **The table** appears on the TV and phones, with the movement since last round.
8. **Host moves on** to the next round. Repeat from step 4.
9. After the last round, **the final table** and a winner.

Room states, in order: `lobby → open → revealing → table → (open … ) → finished`. Locking and
playing a round are one step, so there is no separate locked state. Only the host moves a room from
one state to the next, except `open → revealing` when the last player sends their coupon. The host
can end the game from any state.

---

## 6. The vidiprinter

The moment the game exists for. The TV becomes a results service: scores typed in line by line in
block capitals, a minute-by-minute run through the round compressed into roughly 60–90 seconds,
goals arriving in kick-off order, then FT on each line, then the teams' table, then the players' table.

- In the spirit of the classic teleprinter, built in LMSLocal's own type and colours.
  **No BBC name, logo or screen design.** The parked `landing-redesign` branch already has a typing
  results feed in this style worth borrowing from.
- Pacing is the whole design problem: long enough for tension, short enough that a room of children
  stays with it. Late goals are held back to the end.
- Phones show a simpler version, so a player looking down still sees their own matches land.

---

## 7. Data and API

Built 2026-11-24 (phase 1): `db/migrations/2026-11-24-matchday-party.sql`, `services/party.js`,
ten routes, `scripts/prune-party-rooms.js`.

**Tables**, all new and all `mdparty_`-prefixed. They reference only `app_user`; nothing that
exists reads them.

| Table | What |
|---|---|
| `mdparty_team` | The 20 teams and their ratings (§4.1). Seeded with the provisional set |
| `mdparty_room` | One game: code, host, state, rounds, current round, `version`, expiry |
| `mdparty_player` | Everyone in the room, host included. A hashed token; `user_id` for the host only |
| `mdparty_round` | A round, with its draw seed and, once locked, its play seed |
| `mdparty_fixture` | Ten a round. Goals, goal minutes and the effective ratings, null until locked |
| `mdparty_submission` | A player has sent their coupon for a round (it may be all blanks) |
| `mdparty_prediction` | One row per predicted match; points are derived, never stored |

Inside a party the foreign keys **cascade**, so deleting a room removes everything under it in one
statement. That is the whole prune script.

**Routes** (POST, HTTP 200, `return_code`):

| Route | Who | What |
|---|---|---|
| `create-party-room` | Host (JWT) | Rounds 4/6/8. Returns the code and the host's player token. Finishes any other unfinished room of the host's |
| `join-party-room` | Anyone | Code and a name; returns a player token. Lobby only. Rate limited like the competition join lookup |
| `get-party-state` | TV, phones | The whole room as a screen needs it. `known_version` makes an unchanged poll one read. Its own rate limit (§7.1) |
| `set-party-predictions` | Player token | The whole coupon at once; replaces an earlier one. The last coupon locks and plays the round |
| `start-party-game` | Host | Needs 1 player, so the host can play alone. Draws round 1 |
| `lock-party-round` | Host | Locks and plays without waiting |
| `show-party-table` | Host | Reveal → tables |
| `next-party-round` | Host | Tables → next round, or finished after the last |
| `remove-party-player` | Host | Not the host. If the round was waiting only on them, it plays |
| `end-party-game` | Host | Finished from any state; an open round is not played |

**Who is who.** The host's controls need their LMSLocal sign-in. A bad player token answers `PLAYER_NOT_FOUND`, never `UNAUTHORIZED`, because the web client signs a user out on that code. Players hold a random token for
one room, stored hashed, opening nothing else. The TV sends the code alone and can only read.

**In preview:** only `PARTY_PREVIEW_HOST_IDS` (`services/party.js`, organiser 50) can create a
room. Launching is setting it to `null` in a commit of its own.

**Rooms expire** 24 hours after creation. Expired rooms are invisible to every route, and the prune
script deletes them nightly (crontab line in its header).

Room codes are five letters with no I, L, O or U, and no digits, so nothing is misread across a room.

### 7.1 Polling and the rate limits

Every phone and the TV in a room share one home address. The general limit (1,000 requests per 15
minutes per address) would freeze a room of ten devices in about three minutes, so
`get-party-state` is outside it, with its own limit of 1,500 a minute.

---

## 8. Guardrails

- **No money, no prizes, no stakes** in the product or its copy. The result is decided by a
  simulation, so with an entry fee this would be a game of chance in gambling-law terms, unlike Last
  Man Standing. Played for fun it is nothing of the kind. Do not add an entry fee, a pot or a
  prize field.
- **No betting words**, as in `docs/matchday.md` §2: "predict" and "prediction", never "back",
  "bet", "odds" or "stake". Ratings are shown as form, not as odds.
- **Club names only.** No crests, kits or league branding: the names state facts about real clubs;
  the badges are someone else's property.
- **Names are shown on a TV.** Keep them short, and let the host remove a player.
- **Not a recreation of an existing party game.** The phones-plus-TV shape is a genre; the
  game, its look and its words are ours.

---

## 9. Build order

| Phase | What | Visible? |
|---|---|---|
| 0 | **The engine**, as a pure function plus a simulation script. **Built 2026-11-24**; the ratings are still provisional | No |
| 1 | Tables and routes: create, join, state, predict, lock, play round, next round, end. **Built and migrated 2026-11-24**; tested end to end through the routes | No |
| 2 | Player phone screens. **Started 2026-11-24:** `/party` is one plain screen for host and players alike (create or join, coupon, results, both tables, host controls), reached from the create wizard's "Which game?" step. Same engine and routes for 1 to 20 players; playing alone is a room with only the host | Behind a preview flag |
| 3 | TV screens and the vidiprinter | Behind a preview flag |
| 4 | Host controls and the awkward cases: a phone that sleeps, the TV page refreshed mid-game, a player removed, the host disappearing | Behind a preview flag |
| 5 | A public page and the launch, aimed at a search such as "football party game" | Yes |

Phase 0 comes first because it decides whether the game is fun. A good engine with plain screens
is a game; a beautiful vidiprinter showing dull results is not.

---

## 10. Open questions

| # | Question | Notes |
|---|---|---|
| 0 | ~~Players in a room~~ | **Decided 2026-11-24: 1 to 20.** One is the host alone; there is no separate solo mode |
| 1 | ~~Does the host need an account?~~ | **Decided 2026-11-24: yes**, a free account; players never need one. It is the reason to build a free game, and it stops anonymous rooms being created in bulk |
| 2 | ~~How many fixtures a round?~~ | **Decided 2026-11-24: all 10**, so every team plays every round and form counts |
| 3 | ~~What do players see before predicting?~~ | **Decided 2026-11-24: names plus in-game form** from round 2 (§4.3). No ratings shown |
| 4 | ~~Late joiners~~ | **Decided 2026-11-24: no.** Joining closes when the host starts the game. Keep it simple |
| 5 | **A timer** | Not needed for a room that waits (§2). Possibly a host option later |
| 6 | ~~If the host leaves~~ | **Decided 2026-11-24: the game ends.** No handover |
| 7 | ~~Sound~~ | **Decided 2026-11-24: yes.** A typing sound and a goal chime on the TV, the only device that plays it |
| 8 | **The name** | "Matchday Party" is a working name |
| 9 | **Other leagues** | Premier League only to start *(decided)*. The Championship would come with its own ratings |
| 10 | ~~The app~~ | **Decided 2026-11-24: a game is started from the LMSLocal app or the website**, by a registered player. Whether players' phones use the app, the browser or both is a build question |
