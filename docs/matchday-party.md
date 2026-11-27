# Matchday Party — the party game

A third way to play, for one evening in one room. Friends or family predict the winners of
made-up Premier League fixtures on their phones; when everyone has chosen, the TV turns into a
vidiprinter and the scores come in. Points go on a table, and after 2, 3 or 4 rounds the most points
wins. Fast, free, and played for fun.

**Status, 2026-11-27: phase 0 (the engine, §4) and phase 1 (tables and routes, §7) built. No screens.** The decisions marked *(decided)* came
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
| Teams | **Premier League only, to start** *(decided)*. Real club names; no crests or badges (§8). **Each game plays 12 of the 20, picked at random when the game starts** *(2026-11-27)*. A random twelve, not the top twelve: the scoring pays for backing the side fewer people picked, so it needs real underdogs. A top twelve made most matches coin-flips. A fresh twelve each game also makes repeat games feel different |
| A round | **6 fixtures: the game's 12 teams, each playing once** *(2026-11-27; was 10 fixtures, all 20 teams)*, drawn at random. Every team plays every round, which is what makes form matter (§4.3). Six fit on one phone screen, and the reveal is about 2 minutes 10 rather than 3 minutes 40 (§6) |
| What a player does | For each fixture, predicts the **home team or the away team to win** *(decided: winners only)*. A draw cannot be predicted, as in Matchday |
| Players | **Always six** *(2026-11-25)*. A person takes a seat; every seat nobody takes is a bot, which plays like anyone and has an ordinary name - nothing on screen marks it. Joining takes a bot's seat; the room is full only when all six are people. Bots send their coupons as each round opens, leaning to the stronger side with enough chance to disagree, and most take a banker |
| Picking | **A winner in every match**: no blanks *(2026-11-25)* |
| Scoring | *(2026-11-25, replacing 3 / 1 / 0 and its bonuses)* **Your team wins: one point for each player who picked the other team.** Back City with four others and City win: 1. Back Hull on your own and Hull win: 5. All six on one team and it wins: 0. **A draw: 1 point to the side fewer players picked**, nothing to the larger side or an even split. **A loss: 0.** Bravery pays by itself, so there are no brave-few bonuses |
| The banker | Once a round, **required** *(2026-11-27; was optional: the phone offers no "no banker" choice)*, chosen on a screen of its own after the cards: **doubles what its pick scores.** No penalty *(2026-11-25; it was +6 / −3)*. The TV gives it a tag of its own on its team's row, solid red while the team is not winning |
| ~~The brave few, on their own, the crowd~~ | *(Tried on 2026-11-25 and replaced the same day by the scoring above, which rewards the smaller side without them.)* |
| Length | **2, 3 or 4 rounds**, chosen by the host at setup *(2026-11-27, with shorter rounds; was 1, 2 or 3 from 2026-11-25, and 4, 6 or 8 before that)* |
| Locking | **The host kicks off**, and that is the only way a round locks *(2026-11-25; it used to lock itself when the last coupon arrived, which started the reveal before the room was ready)*. Once the host has sent their own coupon, their screen shows only who is still to send, then Kick off once everyone has *(2026-11-27; the host does not go back to their cards)*. While anyone is still to send, a smaller **Kick off without them** is there too; who they are is on the TV and every phone, and their coupon scores 0. Until kick-off any other player can change and resend. Fixtures left blank score 0 |
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
| **Player phone** | Each player | Join with the code and a name → predict the 6 fixtures → wait → see their own round score |
| **Host controls** | The host, on their own phone | Everything a player does, plus: start the game, lock the round now, start the reveal, next round, remove a player, end the game |

**One person is always in charge** *(decided)*: the host. The host is also a player. If the host's
phone dies, the game waits; nothing advances without them (§10, question 6).

---

## 4. The match engine

Agreed 2026-11-24, built as `services/mdPartyEngine.js` and tuned with
`scripts/mdparty-engine-sim.js` (no database). The engine is pure: the same seed always gives the
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
- A team's window is **22 × its share of the chances** *(decided 2026-11-25; was 31)*. A share, not the bare rating, so two
  strong sides do not trade six goals each and two weak ones do not draw 0–0 every time.
- The share comes from the **gap** between the two ratings, on a curve 48 wide *(decided)*. Not
  their ratio: as a ratio, a gap of 30 counted for less at the top of the league than at the bottom,
  and Man City finished a 6-round game in the bottom half 24% of the time. On the gap it is 14%.
- The home side adds **10** to its rating before the gap is taken *(decided; was 5)*: home 44%,
  draw 23%, away 33%, close to real Premier League seasons.

Measured over 100,000 matches each (2026-11-24):

| Match-up | Home wins | Draw | Away wins |
|---|---|---|---|
| Top v bottom (92 v 20) | 75% | 20% | 5% |
| Bottom v top (20 v 92) | 9% | 23% | 68% |
| Top half v bottom half (74 v 48) | 55% | 28% | 17% |
| Evenly matched (62 v 60) | 41% | 31% | 28% |

About **2.0 goals a match**, about 12 in a round of six *(lowered from 2.8, the Premier League
average, on 2026-11-25)*. The goal is the excitement, so each should be rarer than in real football.
The cost, chosen knowingly: more draws (29%) and 0–0s (12%), and short games a little more open
(Man City finish 6 rounds in the bottom half about 1 game in 6, Hull reach the top half about 1 in
12). The common scorelines are 1–0 (27%), 2–0, 1–1 and 2–1.

### 4.3 Form: the league-position bonus *(decided)*

- From **round 2**, each team adds **(13 − its position) × 1** to its rating, from the teams' own
  table in this game: top +12, bottom +1 *(2026-11-27, with 12 teams; was 21 − position)*. Round 1
  has no table and no bonus.
- **×1, not ×2.** After a round or two the table is mostly goal difference, and ×2 let one lucky
  weekend count for more than the club.
- The bonus lives only in the game and never changes a stored rating.
- Players see form in two places: the W/D/L strip beside each team when predicting, and **the
  teams' table on the TV after each reveal** *(decided)*, which is what explains why Hull suddenly
  look dangerous.

Re-run on 2026-11-27 for the random twelve (20,000 games of each length; `node
scripts/mdparty-engine-sim.js`). The favourite wins 49% of its matches and loses 22%, so the game
stays open. Picking twelve at random changes nothing about a single match, and makes almost no
difference to how a game turns out: the strongest team in the game finishes in the bottom half about
as often as Man City did in the full league. The weakest team in the game reaches the top half a
little more often than Hull did, because it is less often as weak as Hull. The best-to-worst gap in a
random twelve is 70 at the median (72 in the full league) and under 54 only one game in ten, so most
games still have a clear favourite and a clear underdog.

| Rounds | Strongest team finishes bottom half | Weakest team finishes top half | Same, all 20 teams |
|---|---|---|---|
| 2 | 29% | 22% | 30% / 20% |
| 3 | 25% | 18% | 25% / 15% |
| 4 | 22% | 15% | 22% / 12% |

Man City plays in 60% of games (12 of 20). A short game is meant to allow a story; over a full
38 rounds City finish in the bottom half about 1% of the time.

### 4.4 Goal times

A goal's minute is a random minute inside the block it was scored in. That is what the vidiprinter
plays (§6).

### 4.5 Two steps, two seeds

- **When the game starts**, the engine picks its 12 teams from the 20 (`pickTeams`, seeded from the room id, so nothing is stored). Every round
  of that game uses the same twelve.
- **When a round opens**, the engine draws the fixtures: the twelve paired at random, home side
  at random.
- **When it locks**, and never before, the engine plays them with a second seed. No result exists
  while a prediction can still change.
- Both seeds are stored with the round, so any result can be played again to check it.

---

## 5. A game, start to finish

1. **Host creates a room**, signed in to a free LMSLocal account *(decided)*, and chooses 2, 3 or 4 rounds. The TV shows
   the room code and a QR code.
2. **Players join**: scan the QR or type the code, type a name. Their names appear on the TV.
3. **Host starts the game.** The game's twelve teams are picked and round 1's fixtures are drawn.
4. **Players predict** on their phones. The TV shows who has finished — names only, never what
   they chose.
5. **The host kicks off**, once everyone has sent a coupon (or earlier). That locks the round.
6. **The engine plays the round** (§4), and the TV runs the vidiprinter (§6).
7. **The league** fills the TV once the results are in, and appears under each player's own result on
   their phone, so nobody has to be watching the TV.
8. **The host presses Next round**, straight from the results: the next coupon opens on every phone.
   There is no separate tables step *(2026-11-25: it was a press for nothing)*. Repeat from step 4.
9. After the last round, **the final table** and a winner.

Room states, in order: `lobby → open → revealing → table → (open … ) → finished`. Locking and
playing a round are one step, so there is no separate locked state. Only the host moves a room from
one state to the next. The host can end the game from any state.

---

## 6. The vidiprinter

The moment the game exists for. **One match at a time** (decided 2026-11-24). Ten matches playing out
at once was a wall of numbers: nobody can follow ten scores in fifty seconds, or tell whom to watch.
So the round is revealed match by match, like a results show reading the scores out. The rules and
the coupon are unchanged: players still predict all six.

**Each match, about 21½ seconds** (`lib/mdpartyReveal.ts`), after a 4-second kick-off countdown once
per round; a round of six takes about 2 minutes 10 (a round of ten took 3 minutes 40) *(slowed from 15 seconds a match on 2026-11-25: it felt frantic; full time then held longer, to take in the result and the league moving)*:

| Part | Time | The TV | The phone |
|---|---|---|---|
| Intro | 4.5 s | The fixture, large, and who in the room predicted each side | "You predicted Hull", or that they left it blank |
| First half | 5.5 s | The clock over a scoreboard: each team on its own full-width row with its goals at the end and its predictors under it, the scoring team's number turning red, with a chime | The score, and Winning / Drawing / Losing for them |
| Half time | 2 s | A pause, the score held *(added 2026-11-25)* | The same |
| Second half | 5.5 s | As the first | As the first |
| Result | 5.5 s | Full time, and the league moving. No list of who scored what: it was gone before it could be read, and the league says it (2026-11-25) | Won / Drew / Lost and the points |

**The stakes, before the result** *(2026-11-25; taken off both screens the same day: "no longer show potential points while playing")*. "Got to know what we are hoping for": from the
intro on, the TV tags each side with what its backers get if it wins (WIN +3, BRAVE FEW · WIN +5,
ON THEIR OWN · WIN +6), a banker's tag says "+6 or −3", and a line under the board gives the brave few's draw (+2) when there is a brave side. The ordinary draw (+1 each) is the same every time, so it is not shown.
Each phone shows three boxes for the player's team - WIN, DRAW, LOSE with the points for each - and
fills in the one that applies as it stands. All of it comes from the scoring rule itself
(`stakesFor`), so it cannot disagree with what the match pays. The intro is 4.5 s to read it.

**The players' league moves after every match** *(2026-11-25)*. Following one's own round points was
the thing that got lost, so the TV shows the league beside the match: at each full time the points go
on, names slide up or down, and arrows show who rose or fell. The phones show the same league
*(2026-11-27; they had one line of their own, "You're 2nd ▲1 · +7 this round")*. It is worked out the same way on every screen (`liveStandings`):
points from earlier rounds plus the matches revealed so far.

**It moved on every goal, too** *(2026-11-25; switched off the same day, `LEAGUE_MOVES_ON_GOALS`: with the stakes on screen the league settling once, at full time, is the better moment. The logic is kept)*. During a match the league is ordered as it stands, the
match being played included, and **the numbers shown are those same figures**: a total of 51 with a
small faded "live +3" beside it, never "48 +3". Showing the banked figure with the live part apart
put a player on 48 above one on 50, which read as the wrong order. At full time the tag goes and the
figure stays if the result holds; the "this round" column works the same way. Three rules keep it readable: nothing moves at 0–0
(the live part counts only once the match has a goal, so the league does not lurch at every kick-off;
a 0–0 gets its point at full time); the live part is always shown apart from the banked points; and
the ▲ / ▼ arrows appear only on a settled result. The phone adds "(live)" to its line while it is.

**Taken out** *(2026-11-25)*: the teleprinter lines under the score and, on the TV, the teams' league.
Both added numbers without adding anything for the room. The teams' league stays on the phones'
tables screen. **No list of finished results** either, during the reveal or after it, and no results
cards on the phone afterwards: nobody looked back at them. The league is what is watched.

**The league has a "this round" column** beside the total, because the rivalry in the room is who is
having the better round ("I want to beat Sam"). **When all the results are in**, the match card goes
and the league takes the whole TV: position, name, the arrows, this round, total.

**One clock for the room.** Every screen works out where the reveal is from the moment the round
locked (`round.locked_at`) against the database clock (`server_now`), never from when it loaded. The
TV and every phone show the same match and the same goal together, and a refreshed screen comes back
at the right point. The teleprinter's typing is worked out from the clock as well.

**Who predicted what** (`round.crowd`) is sent only once the round has locked, as in Matchday.

**The TV** (`/mdparty/tv`, `components/mdparty/TvReveal.tsx`, its scoreboard in `MatchBoard.tsx`) is neutral and shared: the match, and the
players' league, which everyone can see. **Sound on the TV only:** a chime as each goal goes in,
synthesised in the browser, with a mute switch remembered on the device. In LMSLocal's
own type and colours, the coupon's paper and ink: **no BBC name, logo or screen design.**

**The phone shows exactly what the TV shows** *(2026-11-27)*: the same component, `TvReveal`, with
`onPhone` only making the scoreboard smaller and keeping it silent. The match and the players' league
are all anyone needs; a personal card beside it made the phone a different screen. No sound on
phones, so the room does not hear six chimes.

**The end of the game** *(2026-11-25)* is made a moment of. The TV fills with **CHAMPION** (or
**JOINT CHAMPIONS**) over the winner's name in the biggest type on the site, their points, confetti in
the coupon's inks and a four-note fanfare, with the final league beneath and the winner's row
picked out (`components/mdparty/Celebration.tsx`). The winner's phone says "You won!" with its own
confetti; everyone else's says where they finished and who won. A game the host ended early gets no
celebration - it was stopped, not won - only who was leading. Reduced motion drops the confetti.

**Moving on.** Once every result is in, each phone shows the league under the player's own result,
and the host's one button is **Next round** (or **Show the champion** after the last), which opens the
next coupon everywhere. There is no skip during the reveal *(2026-11-27)*: every round plays through. The teams' league
is on no screen any more *(2026-11-25)*.

---

## 7. Data and API

Built 2026-11-24 (phase 1): `db/migrations/2026-11-24-matchday-party.sql`, `services/mdParty.js`,
ten routes, `scripts/prune-mdparty-rooms.js`.

**Tables**, all new and all `mdparty_`-prefixed. They reference only `app_user`; nothing that
exists reads them.

| Table | What |
|---|---|
| `mdparty_team` | The 20 teams and their ratings (§4.1). Seeded with the provisional set |
| `mdparty_room` | One game: code, host, state, rounds, current round, `version`, expiry |
| `mdparty_player` | Everyone in the room, host included. A hashed token; `user_id` for the host only |
| `mdparty_round` | A round, with its draw seed and, once locked, its play seed |
| `mdparty_fixture` | Six a round. Goals, goal minutes and the effective ratings, null until locked |
| `mdparty_submission` | A player has sent their coupon for a round (it may be all blanks) |
| `mdparty_prediction` | One row per predicted match; points are derived, never stored |

Inside a party the foreign keys **cascade**, so deleting a room removes everything under it in one
statement. That is the whole prune script.

**Routes** (POST, HTTP 200, `return_code`):

| Route | Who | What |
|---|---|---|
| `create-mdparty-room` | Host (JWT) | Rounds 2/3/4. Returns the code and the host's player token. Finishes any other unfinished room of the host's |
| `join-mdparty-room` | Anyone | Code and a name; returns a player token. Lobby only. Rate limited like the competition join lookup |
| `get-mdparty-state` | TV, phones | The whole room as a screen needs it. `known_version` makes an unchanged poll one read. Its own rate limit (§7.1) |
| `set-mdparty-predictions` | Player token | The whole coupon at once; replaces an earlier one. Says whether everyone has now sent one; never locks the round |
| `start-mdparty-game` | Host | Needs 1 player, so the host can play alone. Draws round 1 |
| `lock-mdparty-round` | Host | **Kick off**: locks and plays the round, and every screen starts the reveal |
| `show-mdparty-table` | Host | Reveal → tables; after the last round, straight to the finish |
| `next-mdparty-round` | Host | Reveal (or tables) → next round. For a room already on its last round's tables, the finish |
| `remove-mdparty-player` | Host | Not the host. Never locks the round |
| `end-mdparty-game` | Host | Finished from any state; an open round is not played |

**Who is who.** The host's controls need their LMSLocal sign-in. A bad player token answers `PLAYER_NOT_FOUND`, never `UNAUTHORIZED`, because the web client signs a user out on that code. Players hold a random token for
one room, stored hashed, opening nothing else. The TV sends the code alone and can only read.

**In preview:** only `PARTY_PREVIEW_HOST_IDS` (`services/mdParty.js`, organiser 50) can create a
room. Launching is setting it to `null` in a commit of its own.

**Rooms expire** 24 hours after creation. Expired rooms are invisible to every route, and the prune
script deletes them nightly (crontab line in its header).

Room codes are five letters with no I, L, O or U, and no digits, so nothing is misread across a room.

### 7.1 Polling and the rate limits

Every phone and the TV in a room share one home address. The general limit (1,000 requests per 15
minutes per address) would freeze a room of ten devices in about three minutes, so
`get-mdparty-state` is outside it, with its own limit of 1,500 a minute.

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
| 2 | Player phone screens. **Started 2026-11-24:** `/mdparty` is one plain screen for host and players alike (create or join, coupon, results, both tables, host controls), reached from the create wizard's "Which game?" step. Same engine and routes for 1 to 8 players; playing alone is a room with only the host | Behind a preview flag |
| 3 | TV screens and the vidiprinter | Behind a preview flag |
| 4 | Host controls and the awkward cases: a phone that sleeps, the TV page refreshed mid-game, a player removed, the host disappearing | Behind a preview flag |
| 5 | A public page and the launch, aimed at a search such as "football party game" | Yes |

**Testing alone** needs nothing extra: a room's empty seats are bots (§2), so a host can play a full game of six on their own.

Phase 0 comes first because it decides whether the game is fun. A good engine with plain screens
is a game; a beautiful vidiprinter showing dull results is not.

---

## 10. Open questions

| # | Question | Notes |
|---|---|---|
| 0 | ~~Players in a room~~ | **Decided 2026-11-25: 1 to 8 phones** (was 20). Nobody is turned away: anyone beyond eight teams up with a player already in and shares their phone. One is the host alone; there is no separate solo mode |
| 1 | ~~Does the host need an account?~~ | **Decided 2026-11-24: yes**, a free account; players never need one. It is the reason to build a free game, and it stops anonymous rooms being created in bulk |
| 2 | ~~How many fixtures a round?~~ | **Decided 2026-11-27: 6, from a random 12 of the 20** (was all 10 from 2026-11-24). Every team in the game still plays every round, so form counts (§2) |
| 3 | ~~What do players see before predicting?~~ | **Decided 2026-11-24: names plus in-game form** from round 2 (§4.3). No ratings shown |
| 4 | ~~Late joiners~~ | **Decided 2026-11-24: no.** Joining closes when the host starts the game. Keep it simple |
| 5 | **A timer** | Not needed for a room that waits (§2). Possibly a host option later |
| 6 | ~~If the host leaves~~ | **Decided 2026-11-24: the game ends.** No handover |
| 7 | ~~Sound~~ | **Decided 2026-11-24: yes.** A typing sound and a goal chime on the TV, the only device that plays it |
| 8 | **The name** | "Matchday Party" is a working name |
| 9 | **Other leagues** | Premier League only to start *(decided)*. The Championship would come with its own ratings |
| 10 | ~~The app~~ | **Decided 2026-11-24: a game is started from the LMSLocal app or the website**, by a registered player. Whether players' phones use the app, the browser or both is a build question |
