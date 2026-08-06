# Round state machine

The organiser's view of a round — fixtures and results — is **one screen**, not two. What it
shows is derived from a single phase value computed in one place: `lmslocal-web/src/lib/roundState.ts`.

This doc is the contract. When a new scenario turns up ("what should a delegated helper see
between kickoff and the first result?"), answer it here first, then change the code to match.
The code deliberately carries no rules that aren't written down here.

## Why it was merged

Fixtures and Results were two dashboard tiles pointing at two pages that render the same list of
matches. Before kickoff, Results is a wall of greyed-out buttons that reads as broken. After
kickoff, Fixtures is the stale copy. At no moment are both useful, so one of the two is always a
dead end — which is why an organiser asked us what "Fixtures" even meant. They had clicked both
and got the same thing twice.

One tile, one page, content follows the clock.

---

## 1. Inputs

Everything the machine needs, and nowhere it gets it from beyond this list:

| Input | Source | Notes |
|---|---|---|
| `hasRound` | `organizer-get-fixtures-for-results` → `return_code` is `SUCCESS` vs `NO_ROUNDS` | |
| `roundNumber` | same route, `round_number` | latest round only; see §6 |
| `lockTime` | same route, `round_start_time` (which is `round.lock_time`) | may be null |
| `fixtures[]` | same route, each with `result` and `processed` | |
| `automated` | `competition.fixture_service === true` | from `AppDataContext` |
| `readyToStart` | `competition.ready_at !== null` | organiser has pressed Ready; only ever read in `NO_ROUND`, and only when `automated` |
| `competitionComplete` | `competition.is_complete` | |
| `now` | injected, not read from the global clock | so phases are testable |
| `canManageFixtures` | `is_organiser || manage_fixtures` | permission, **not** a phase input |
| `canManageResults` | `is_organiser || manage_results` | permission, **not** a phase input |

**Permissions never change the phase.** The round is where it is regardless of who is looking.
Permissions only decide what is *interactive* — see §4. This split is the whole point: it means
"what's happening" and "what may I do about it" can't drift apart, and a helper with no
permissions still gets an honest picture instead of an empty screen.

### Landmines in these inputs

- `fixture.result` holds a **team short code or the string `DRAW`**, not `home_win`/`away_win`.
  The client-side outcome vocabulary is a separate thing, converted at the boundary.
- `processed` is a **timestamp or null**, not a boolean. `processed !== null` means the round's
  eliminations for that fixture have been applied.
- `lockTime` doubles as kickoff. Every fixture in a round shares one, which is why a real
  gameweek spread over Fri–Sun is pushed as several batches (see CLAUDE.md).
- `competition.status` casing is inconsistent in the database. Don't reach for it here — use
  `is_complete` off the dashboard payload.

---

## 2. Phases

```
NO_ROUND ──▶ OPEN ──▶ LOCKED ──▶ RESULTS_PARTIAL ──▶ RESULTS_READY ──▶ COMPLETE
                                                                          │
                                                                          ▼
                                                              (next round pushed → OPEN)
```

`COMPETITION_COMPLETE` can be reached from anywhere and wins over everything else.

| Phase | Condition | What it means |
|---|---|---|
| `NO_ROUND` | no round exists | nothing to show yet |
| `OPEN` | `now < lockTime` | fixtures published, players picking |
| `LOCKED` | `now >= lockTime`, zero results in | picks shut, matches in play |
| `RESULTS_PARTIAL` | `0 < resultsIn < total` | results arriving |
| `RESULTS_READY` | `resultsIn === total`, some unprocessed | every result in, eliminations not yet applied |
| `COMPLETE` | every fixture processed | round settled |
| `COMPETITION_COMPLETE` | `is_complete` | there is a winner |

Notes on the edges:

- **`lockTime` null** counts as locked. Matches the pre-merge behaviour in
  `organizer-results/page.tsx` (`roundHasStarted` defaults true when there's no start time) — a
  round with no lock time is one nobody is waiting on.
- **Zero fixtures on an existing round** is `LOCKED`, not `COMPLETE`. "All zero fixtures are
  processed" is technically true and completely wrong to show; treat an empty round as a round
  that hasn't received its fixtures.
- **`RESULTS_READY` is a manual-competition phase.** The fixture service sets `result` and
  `processed` in the same push, so automated competitions step from `RESULTS_PARTIAL` straight to
  `COMPLETE` and never sit in `RESULTS_READY`. It can still be *observed* on an automated
  competition mid-push; it just isn't actionable.
- **Partial processing is real.** Results are pushed one competition at a time, so a fixture can
  carry a `result` with `processed` still null for a while.

---

## 3. Scenario matrix

The four organiser situations, by phase. "Sheet" means the fixture list; "slots" means the
three-way result row under each fixture.

### A. Automated fixtures, organiser not playing (the common case)

| Phase | Page shows |
|---|---|
| `NO_ROUND`, not ready | The start gate: **"Start with the matches on Saturday 15 March?"** + the button. Also on the competition dashboard, which is where it is normally pressed. |
| `NO_ROUND`, ready | The start date if we have one, otherwise "starts when the next fixtures are in" |
| `OPEN` | Sheet + the lock time. **This is the "I just want to see upcoming fixtures" case.** |
| `LOCKED` | Sheet + "Picks are locked. Results come in automatically." |
| `RESULTS_PARTIAL` | Sheet with slots, read-only, filled ones marked |
| `COMPLETE` | Sheet with final results + "Round settled" |

No buttons anywhere. The old `results.png` greyed-button wall never appears, because before
kickoff there are no slots at all.

### B. Manual fixtures, organiser runs the round

| Phase | Page shows |
|---|---|
| `NO_ROUND` | Empty state + **Add fixtures** → the existing entry form |
| `OPEN` | Sheet + lock time + a note that results open at kickoff |
| `LOCKED` | Sheet with **live slots** — this is the job |
| `RESULTS_PARTIAL` | Same, with progress ("4 of 10 in") |
| `RESULTS_READY` | Same + **Process results** as the screen's primary action |
| `COMPLETE` | Final results, read-only, + **Add next round's fixtures** as the primary action |

The `COMPLETE` action is what carries a manual competition from one week to the next. Without it
the organiser finishes a round and the screen offers nothing at all — see §4.

### C. Organiser who is also playing

Identical to A or B, plus the existing Play tile. Open question in §7 — there's a third view of
the same fixtures over there and it may want folding in later. Out of scope for this merge.

### D. Delegated helper

Phase is the same as their organiser sees. Interactivity per §4. A helper with `manage_fixtures`
but not `manage_results` still sees the results as they arrive; they just can't set them.

---

## 4. Capabilities

Derived from phase **and** permission, never from permission alone:

| Capability | True when |
|---|---|
| `canEditFixtures` | `canManageFixtures && !automated && (phase === NO_ROUND \|\| phase === COMPLETE) && !competitionComplete` |
| `showResultSlots` | phase is `LOCKED`, `RESULTS_PARTIAL`, `RESULTS_READY`, or `COMPLETE` |
| `canEnterResults` | `showResultSlots && canManageResults && !automated && phase !== COMPLETE` |
| `canProcessResults` | `canManageResults && !automated && at least one fixture has a result and null processed` |

Two consequences worth stating out loud:

- **Result slots don't exist before kickoff.** Not disabled — absent. A control that can't be
  used shouldn't be drawn; that was the single worst thing about the old Results screen.
- **`canEditFixtures` covers `COMPLETE` as well as `NO_ROUND`, and this is the only way to start
  the next round.** It was `NO_ROUND` alone, on the reasoning that the backend refuses fixtures
  for a round that already has them (`ROUND_HAS_FIXTURES`). True, but it conflated two different
  things: adding fixtures *to this round* and starting *the next one*. `organizer-add-fixtures`
  distinguishes them — it refuses only while the latest round has unprocessed fixtures
  (`PREVIOUS_ROUND_INCOMPLETE`) and otherwise creates round N+1 itself. So a manual competition
  whose round was fully settled had a willing backend and no button anywhere in the UI: the
  organiser's week ended in a dead end, with nothing on the screen to run the competition
  forward. Adding fixtures *to* an existing unsettled round is still refused, which is what the
  original rule was actually protecting.

**The three result slots are a toggle group.** Tapping the slot that's already selected clears
that fixture's result — `organizer-set-result` takes `"clear"` and writes NULL, through the same
guards as a set. Entering a round's results is a sitting of ten or twenty taps and a mis-tap is
ordinary; without an undo the only way out was to leave a result you knew to be wrong. Clearing
moves the round back down the phase list on its own, because the phase is derived from how many
fixtures carry a result — `RESULTS_PARTIAL` back to `LOCKED`, and `canProcessResults` back to
false once nothing is left unprocessed.

**Processing is still the point of no return.** `ALREADY_PROCESSED` refuses any change to a
processed fixture, clear included, and `canEnterResults` is false in `COMPLETE`. Undo exists for
the part before the round is settled, not after.

**A slot's colour says what happened, not which button is pressed:**

| Slot | Fill | Meaning |
|---|---|---|
| Undecided | outlined, full-strength ink | nothing has happened here yet |
| Winner | **moss** (green) | a team won — the only green on the row |
| Draw | ink (near-black) | settled, but nobody won, so not green |
| Beaten side | faded, hairline border | recedes; context, not news |

The winning team is also named in moss in the fixture line above the slots, and the beaten one
fades there too, so the row can be read at a glance without decoding the slots. The same green
means the same thing on the player's results screen.

**A loss is never red**, even though losing eliminates you. Every decided fixture has a loser, so
red would cover half the screen and stop meaning "this needs you" — which is the job it does on
the dashboard tile and the Play tile. Losing fades; it doesn't shout.

---

## 5. Copy

The tile subtitle and the page status line come from the same table, so the dashboard never
disagrees with the screen it links to.

| Phase | Tile subtitle | Page status line |
|---|---|---|
| `NO_ROUND` (automated, not ready) | "Not started yet" | "Press Ready when you've invited your players." |
| `NO_ROUND` (automated, ready) | "Waiting for fixtures" | "Your first round starts with the next set of matches." |
| `NO_ROUND` (manual) | "No fixtures yet" | "Add this round's fixtures to get started." |
| `OPEN` | "Open for picks" | "Picks close {full date}." |
| `LOCKED` | "In play" | "Picks are locked." |
| `RESULTS_PARTIAL` | "{n} of {total} results in" | "{n} of {total} results in." |
| `RESULTS_READY` | "All results in" | "Every result is in — process the round to settle it." |
| `COMPLETE` | "Complete" | "Round {n} is settled." |
| `COMPETITION_COMPLETE` | "Finished" | "This competition has finished." |

### When the organiser owes the round something

The table above states the round's condition. That is *almost* the whole story on an automated
competition, where the fixture service enters and processes results and the organiser is a
spectator — the tile stays on the neutral wording above.

**The one exception is the start, and it is not a tile.** An automated competition sitting at
`NO_ROUND` is waiting on the organiser and nobody else: no fixtures are pushed to it, ever, until
they press Ready. That gets its own card — `isStartGateVisible` — carrying the prompt, the button
and afterwards the date. `roundTileNeedsAction` stays false on automated competitions, because a
red tile beneath a red card is two alarms for one job; the tile states the condition ("Not started
yet" / "Waiting for matches") and stays out of the card's way.

**The card is drawn on the competition dashboard, where the button is pressed**, and on the round
screen, which would otherwise be an empty page. Pressing Ready is one act on a competition that
cannot move without it, so it is answered where the organiser already is rather than a navigation
away — the round screen version exists for the organiser who went looking there, not as the route
to it.

**On the dashboard it exists only until it is answered.** Once the organiser has said yes the card
has no job left: it was announcing a date nobody could act on, under a heading that read as news,
on the screen they check most often. The Round tile carries the state from then on ("Waiting for
matches"), and the round screen still carries the date for anyone who goes looking. `isStartGateVisible`
covers both faces because the round screen uses both; the dashboard adds `&& !readyToStart`.

Everything about that choice follows from a rule we could not otherwise keep: **we never claim to
know when the next fixtures are.** Asking at creation how many weeks to wait made the organiser
guess, could not be corrected afterwards, and implied a fixture list we hadn't seen. Pressing
Ready is an act, not a prediction, and it cannot be wrong.

`NO_ROUND` is only ever reachable before a competition's first round — once round 1 exists the
between-rounds phase is `COMPLETE` — so the Ready gate has exactly one moment to apply. A reset
clears `ready_at` and puts the competition back in it, deliberately: an emptied competition that
stayed ready would take the very next batch with nobody told.

**The date is shown before the button, not after it.** `/get-competition-start-outlook` evaluates
the competition *as though it were already ready*, so the card can name the actual kickoff the
organiser would get and the button becomes a plain yes to a stated question — "Start with the
matches on Saturday 15 March?" / **Start my competition**. Two unexplained steps before finding out
the date was the original sin of the wait-in-weeks question in a new costume: a button whose
consequence you learn by pressing it. Every other rule still applies to the hypothetical, so a
mid-gameweek batch or one inside the 48-hour lead time yields no date here either — because it
would yield no round.

When there is no batch they could start on, the card says so and promises nothing: *"We don't have
the next set of matches yet."* Never a guess at when the next fixtures land.

**There is no un-press.** The card offered a "Hold on, not yet" alongside the confirmation, which
invented a decision nobody has to make: an organiser who isn't ready simply doesn't press the
button, and offering to undo an act they haven't taken only suggests the act is riskier than it is.
Once started, the card states the date and owes nothing — no button, and no overprint accent, which
is reserved for what is actually waiting on someone. `/set-competition-ready` still accepts
`ready: false` for support, and refuses once a round exists.

It is the same `evaluateCompetition()` the admin push uses, so the date the organiser is shown is
the one the push would actually produce.

On a **manual** competition those same phases are a job the organiser hasn't done yet, and the
tile has to say so — it is the one screen they look at, and the only route to the round. The
condition wording states the round's condition; the action wording states theirs:

| Phase | Neutral | Organiser's own | Needs | Tile goes to |
|---|---|---|---|---|
| `NO_ROUND` (manual) | "No matches yet" | **"Add matches"** | `canManageFixtures` | entry form |
| `LOCKED` | "In play" | **"Enter results"** | `canManageResults` | round |
| `RESULTS_PARTIAL` | "{n} of {total} results in" | **"{n} of {total} — enter the rest"** | `canManageResults` | round |
| `RESULTS_READY` | "All results in" | **"Process the round"** | `canManageResults` | round |
| `COMPLETE` | "Complete" | **"Add next matches"** | `canManageFixtures` | entry form |

**A tile that names a job goes where the job is done.** "Add next matches" used to land on the
round screen — a read-only page of last week's results, with the actual button somewhere below the
fold on a screen that looks like it's about something else. `roundTileTarget` sends the two
fixture-entry phases straight to `/game/[id]/organizer-fixtures` and everything else to
`/game/[id]/round`. It returns a role, not a URL, so the routing table stays in the app and the
rule stays in `roundState.ts`. It can only return `'fixtures'` where `canEditFixtures` is also
true, so the form is never reached at a point where it would refuse the submission — the form's
own guard (unprocessed fixtures remain) mirrors the backend's `PREVIOUS_ROUND_INCOMPLETE`.

**The two ends of that list are the ones that keep the competition alive.** A competition with no
round yet, and one whose round has just settled, are both stopped dead until fixtures are entered
— nothing happens on its own, no clock is running, no player can act. "No fixtures yet" and
"Complete" describe those states accurately and read as *nothing to do here*, which is the
opposite of the truth for the person who can fix them. The two action phases mirror
`canEditFixtures` exactly, so the tile prompts precisely when the button on the round page will
be there.

### Between rounds, name the round you mean

A settled round and an unstarted one are both "now", and the screen has to say which it is talking
about. Three places got this wrong at once by naming the round that just finished:

- **The tile label** paired "Round 1" with "Add next fixtures" — a settled round beside a job
  belonging to the next one, which reads as an invitation to add fixtures to round 1. When the
  tile asks for fixtures it names the round being *created*: `roundNumber + 1`, or "Round 1" when
  no round exists. The pair reads "Round 2 / Add next fixtures".
- **The still-in count** was headed "Round 1". The figure is current and the round is over, so a
  settled round's number over a live figure reads as a snapshot from back then. Between rounds it
  reads "After round 1".
- **The Play tile** said "Round progress", which gives no clue whether pressing it shows the round
  just finished or one not yet started. It shows the finished one, so once a round settles it says
  "Round 1 results".

The general rule: **while a round is running, "Round N" is unambiguous; between rounds it is not,
and every use has to say whether it means the one that ended or the one about to start.**

`roundTileNeedsAction` drives both the marking and the wording, so the accent and the words can
never disagree. The accent is `border-overprint` — the same red the Play tile uses for "Pick
needed", because it means the same thing: this one is waiting on you. Nothing else on the screen
may use it, or it stops meaning anything.

Delegated permission counts, and the two jobs are separate: a helper with `manage_results` is
prompted to enter results but not to add fixtures, and vice versa. Either way both still *see*
the tile, because the round is theirs to look at.

Copy rules from `docs/design-system.md` apply: "you" means the organiser, never state an opt-in
feature as universal. "Results come in automatically" is only ever shown when
`fixture_service` is actually on.

**Times are always shown in UK time**, never the viewer's local zone. Every formatter in
`roundState.ts` pins `timeZone: 'Europe/London'` (BST and GMT handled automatically). Kickoff
times *are* UK kickoff times: an organiser checking from Spain still needs to read the time the
match actually starts, and a player shown "9pm" when the pub says "8pm" has been given wrong
information, not localised information. Revisit only if the product runs outside the UK.

Storage is already correct and needs no change. `round.lock_time` and `fixture.kickoff_time` are
`timestamptz` holding true UTC instants — `organizer-add-fixtures.js:113-152` reads the entered
wall-clock components and converts via `Europe/London` before writing, ignoring the redundant `Z`
the client appends. Verified against live data: competition 200 round 1 stores `19:00+00`, which
is 20:00 BST, which is the 8pm the organiser intended.

A timestamp that won't parse is treated as **no lock time**, which reads as `LOCKED`. `Date`
rejects some real shapes — notably Postgres's own `'...+00'` text rendering — and the alternative
failure mode is a literal "Locks Invalid Date" on the organiser's dashboard.

**Word choice.** The tile is labelled **Round** — as in "Round 1" — not "Fixtures". "Fixtures" is
fixture-*service* vocabulary; it's obvious to us and to anyone who's run a sweepstake before, and
opaque to a first-time organiser in a pub. "Round" is the thing they already talk about.

The same reasoning retired "fixtures" from the copy entirely: **the user-facing word is
"matches"**. A pub landlord says "have you put this week's matches in", never "have you loaded the
fixtures". `fixture` remains the name in the database, the routes, the API payloads and the code —
`canEditFixtures`, `organizer-add-fixtures`, `fixture_load` — so only strings a person reads
change. `fixture_service` keeps its name in copy too on the rare occasion it is named, because it
is a product feature with that name.

**The deadline belongs to the Play tile, not the Round tile.** An organiser who also plays sees
both tiles side by side on `/game/[id]`, and `OPEN` used to render as "Round 1 / Locks Fri 7:30pm"
next to "Play / Pick needed" — two tiles quoting one round, with the timestamp on the wrong one.
The lock time is a *player's* concern: it's what costs a life. The organiser's concern in `OPEN`
is that there's nothing owed yet, which is what "Open for picks" says. So the Round tile states
the phase and the Play tile carries "Pick needed by {day} {time}" (`pickDeadlineText`). The full
deadline is still one click away on the page status line.

**The Play tile is only called "Play" while the round is `OPEN`.** `handlePlayClick` sends a
locked round to the read-only `/player-results` view, so past that point the tile reads **"Round
progress"** — "Play" promised something to do and delivered a read-out. The locked-round panel
above it reads "Picks are in — the window is closed." as plain text, rather than being a second
button to the same place. It deliberately states what happened to the window instead of counting
picks: a count is a claim, and "All picks made" was asserting something it hadn't checked on a
round that locked with picks missing.

The same `pickDeadlineText` fills the pick row on the `/dashboard` competition card, so the two
places that warn a player never quote different deadlines. `/get-user-dashboard` already carries
`current_round_lock_time`, so this costs no extra request on either screen.

---

## 6. What "the round" means

`organizer-get-fixtures-for-results` returns **the latest round by `round_number`**, always. There
is no round history in this screen and no round switcher. Once round 2 is pushed, round 1 is gone
from view even if you only settled it a minute ago.

That's deliberate for now — the organiser's live question is always about the current round — but
it's the most likely thing to want changing. See §7.

---

## 7. Data freshness

The round page is **not cached**. This is a deliberate exception to the TTL scheme in
`src/lib/cache.ts`, for one reason: this screen's entire job is to say what is true right now.
A stale fixture list is a minor annoyance; a stale "0 of 10 results in" when eight are in makes
the organiser think the system is broken, and the fix they'll reach for — reload — defeats the
cache anyway.

The economics don't favour caching it either. `apiCache` is an in-memory `Map`, so it dies on
every refresh and every hard navigation; it only ever deduplicated fetches within a single tab
session. For a screen an organiser opens a few times a week, a 5-minute TTL saves a handful of
requests and buys a class of "why is this wrong?" support question.

What the page *does* take from cache:

- **Team names** — `STATIC`, one year. Team names don't change mid-season and the mapping is
  needed on every row.
- **Competition record** — from `AppDataContext`, for `fixture_service`, permissions and
  `is_complete`. Already loaded by the time the user reaches this screen.

And it refetches on `visibilitychange`, because the organiser's actual pattern is to leave the
page open, go and do something else, and come back expecting it to be current.

### Cache-invalidation bugs found and fixed

An audit during this work found **fifteen** invalidation calls that did nothing. Nothing throws
when a delete misses — the key simply isn't there, and the stale entry survives — so they were
invisible. Two distinct faults:

**Wrong key.** The name at the delete site never matched the name at the write site:

| Key used | Key actually written |
|---|---|
| `user-dashboard` | `user-dashboard-${userId}` |
| `pick-stats-${id}` | `pick-statistics-${id}` |
| `competitions-user-${userId}` | nothing — no such key ever existed |
| `picks-${id}` | nothing — invented at the call site |

**Exact delete against a parameterised family.** `competition-players-${id}` and
`competition-standings-${id}` look like keys but are only prefixes: the real ones carry page,
size, filter and search on the end. An exact-key delete matches none of them. Nine calls did
this. `invalidateCompetition` was the same fault in pattern form — it swept
`competition-${id}-*`, but the id sits *after* the family name (`competition-players-199-…`), so
it matched nothing at all. Verified: it cleared 0 of 10 seeded keys.

The fix is `src/lib/cacheKeys.ts` — every key and prefix built in one place, with the exact keys
and the prefix families deliberately separated so the type of thing you hold tells you which
delete to use. `cache.ts` gains `deletePrefix` (plain `startsWith`, no regex to misfire), and
`invalidateCompetition` now drives off `competitionCachePrefixes`, so a new competition-scoped key
is registered once. There were also **two different `cacheUtils` objects** exported under the same
name from `api.ts` and `cache.ts`, disagreeing about several keys, so which behaviour a caller got
depended on which module they imported from; `api.ts` now re-exports the one in `cache.ts`.

The consequence that had been live: after processing results the dashboard cache was never
cleared. It only refreshed because the old results screen called `refreshCompetitions(true)`
guarded by `if (playersEliminated > 0)` — so a round where nobody went out left the organiser
looking at stale figures. The round screen refreshes unconditionally.

## 8. Open questions

Decide these here as they come up, don't decide them in a component.

1. **Round history.** No way to look back at round 1 once round 2 exists. Wanted eventually;
   needs a route that takes a `round_id`.

2. **The Play tile overlaps.** An organiser who plays sees the same fixtures a third time as pick
   options. Possibly Play absorbs the round view for them, possibly not.

### Closed

- **The dashboard tile couldn't see result counts.** *Resolved: the counts were added.* The tile
  used to be built from the round number and lock time alone, so it stopped at `LOCKED` and could
  not tell a round being played from one whose results were all in and processed. That was
  survivable while the copy read "In play" — true at every point past the lock — and became a lie
  the moment the tile began prompting "Enter results", which it then kept saying after every
  result was entered *and* processed. `/get-user-dashboard` now returns `total_fixtures`,
  `fixtures_with_results` and `fixtures_processed` for the current round; `deriveDashboardRoundState`
  expands them into placeholder rows so the phase rules have exactly one implementation. Counts,
  not rows, so the payload stays small.

  The lesson generalises: **a tile may degrade to a vaguer true statement, never to a confident
  wrong one.** Copy that tells someone to act is a claim about outstanding work, and it needs the
  data to back it.

- **`manage_fixtures`-only helpers couldn't load the round.** *Resolved.*
  `organizer-get-fixtures-for-results` now guards on `canViewRound` (organiser, `manage_results`
  **or** `manage_fixtures`) instead of `canManageResults`. It is a read-only route, so widening
  it grants no new writes — `organizer-set-result` and `organizer-process-results` still require
  `canManageResults`.

- **The manual backstop on automated competitions.** *Resolved: it isn't used.* CLAUDE.md and the
  comment at `game/[id]/page.tsx:831` described `organizer-fixtures` as reachable on automated
  competitions to fix a round the fixture service got wrong. Confirmed with the organiser that
  this has never been used, so **automated competitions are strictly read-only** in the merged
  screen and there is no override path. If one is ever needed it should be a deliberate,
  clearly-labelled action, not a tile that happens to look editable.

---

## 9. What lives where

| Path | Role |
|---|---|
| `src/lib/roundState.ts` | the machine — phases, capabilities, copy, UK time formatting |
| `src/app/game/[id]/round/page.tsx` | the merged screen |
| `src/app/game/[id]/page.tsx` | the dashboard's single Round tile |
| `src/app/game/[id]/organizer-fixtures/page.tsx` | **entry form only** — redirects to `/round` on automated competitions |
| ~~`src/app/game/[id]/organizer-results`~~ | deleted; the round screen does all of it |

The dashboard tile grid picks its column count from how many tiles the user actually gets
(`TILE_GRID_COLS`), so a row can't strand one or two tiles on a line of their own the way a fixed
four-column grid did with six tiles.

**No "managed for you" badge.** Who entered the fixtures is an implementation detail; they're on
the page either way, and saying so changes nothing the organiser does. The single exception is the
`LOCKED` status line, where results are due and there are deliberately no buttons — that's the one
moment the sentence answers a real question.

## 10. Related

- `docs/design-system.md` — the visual language and the copy rules
- `docs/results-processing-logic.md` — what "process results" actually does
- `CLAUDE.md` → Fixture & Result Management — how the fixture service pushes
