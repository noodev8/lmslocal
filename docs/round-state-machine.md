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
| `NO_ROUND` | "Fixtures for the next round haven't been published yet." Nothing else. |
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
| `COMPLETE` | Final results, everything read-only |

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
| `canEditFixtures` | `canManageFixtures && !automated && phase === NO_ROUND && !competitionComplete` |
| `showResultSlots` | phase is `LOCKED`, `RESULTS_PARTIAL`, `RESULTS_READY`, or `COMPLETE` |
| `canEnterResults` | `showResultSlots && canManageResults && !automated && phase !== COMPLETE` |
| `canProcessResults` | `canManageResults && !automated && at least one fixture has a result and null processed` |

Two consequences worth stating out loud:

- **Result slots don't exist before kickoff.** Not disabled — absent. A control that can't be
  used shouldn't be drawn; that was the single worst thing about the old Results screen.
- **`canEditFixtures` is false once a round exists.** The backend already refuses to add fixtures
  to a round that has them (`ROUND_HAS_FIXTURES`), so offering the button would only produce an
  error. Fixing a bad round is a separate, deliberate path — see §7.

---

## 5. Copy

The tile subtitle and the page status line come from the same table, so the dashboard never
disagrees with the screen it links to.

| Phase | Tile subtitle | Page status line |
|---|---|---|
| `NO_ROUND` (automated) | "Waiting for fixtures" | "Fixtures for the next round haven't been published yet." |
| `NO_ROUND` (manual) | "No fixtures yet" | "Add this round's fixtures to get started." |
| `OPEN` | "Open for picks" | "Picks close {full date}." |
| `LOCKED` | "In play" | "Picks are locked." |
| `RESULTS_PARTIAL` | "{n} of {total} results in" | "{n} of {total} results in." |
| `RESULTS_READY` | "All results in" | "Every result is in — process the round to settle it." |
| `COMPLETE` | "Complete" | "Round {n} is settled." |
| `COMPETITION_COMPLETE` | "Finished" | "This competition has finished." |

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

**The deadline belongs to the Play tile, not the Round tile.** An organiser who also plays sees
both tiles side by side on `/game/[id]`, and `OPEN` used to render as "Round 1 / Locks Fri 7:30pm"
next to "Play / Pick needed" — two tiles quoting one round, with the timestamp on the wrong one.
The lock time is a *player's* concern: it's what costs a life. The organiser's concern in `OPEN`
is that there's nothing owed yet, which is what "Open for picks" says. So the Round tile states
the phase and the Play tile carries "Pick needed by {day} {time}" (`pickDeadlineText`). The full
deadline is still one click away on the page status line.

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

1. **Dashboard tile subtitle costs a fetch.** `/get-user-dashboard` returns `current_round` and
   `current_round_lock_time` but no result counts, so the tile can name the phase and the Play
   tile its deadline from data they already have, but neither can say "3 of 10 results in"
   without either a second request on the
   dashboard or new fields in the dashboard payload. **Current decision: the tile degrades** —
   it shows phase-level copy from what the dashboard already knows, and the counts live on the
   round page. Revisit by adding `fixtures_with_results` / `total_fixtures` to the dashboard
   payload if the count turns out to matter on the tile.

2. **Round history.** No way to look back at round 1 once round 2 exists. Wanted eventually;
   needs a route that takes a `round_id`.

3. **The Play tile overlaps.** An organiser who plays sees the same fixtures a third time as pick
   options. Possibly Play absorbs the round view for them, possibly not.

### Closed

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
