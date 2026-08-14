# How a competition starts

**Status: steps 1–3 built (§10). Steps 4–6 are not.** The server side is done: the calendar
exists, creation binds round 1 to a chosen block, and the push reconciles it. **Nothing in the web
app calls it yet** — until step 4, no organiser is offered a start date, so every competition
still goes down the `ready_at` path and everything in §8 is still present and still live. Read
this before changing competition creation, the fixture service's first-round path, or the Ready
button. Change this doc first.

This replaces the `ready_at` / "I'm Ready" model. That model is described here only where it helps
explain what is being removed; `CLAUDE.md` is the record of how it works today.

---

## 1. The problem

A fixture-service competition currently has no round until an operator stages a batch and the
organiser presses **Ready**. Until then it is an empty shell.

That is fine for the organiser, who knows what they are waiting for. It is not fine for the
players they recruit, and recruitment is the whole point of the waiting. A player follows a join
link, lands in a competition with nothing in it, and leaves. The organiser, sensibly, tries to
avoid this by recruiting *before* pressing Ready — which is exactly the state that produces the
empty shell.

The two constraints that make this bite:

1. **Everyone must start together.** Joining is refused once round 1 locks
   (`join-competition-by-code.js:134-151`), and that is a deliberate game rule: a late joiner would
   face opponents who had already burned teams, which is an advantage, not a handicap.
2. **So the recruitment window is exactly the window before round 1 locks** — and for that whole
   window there must be something on screen worth joining.

A start *date* alone does not fix this. It gives the recruit a promise instead of a pick, and it
obliges us to build fixture-arrival notification for a gap that should not exist.

**The fix: round 1 exists, with real fixtures and a real lock time, from the moment the
competition is created.**

## 2. Why this was not possible before

One conflation. `fixture_load` does two jobs:

- **the calendar** — what is coming, weeks out, provisional
- **the batch** — what is going out now, kickoffs confirmed

Because they are one table, "only one batch at a time" — correct for the second job — also
forbids the first. Split them and the problem dissolves. `fixture_load` keeps the second job
unchanged. A new set of tables takes the first.

## 3. The model

```
  fixture_block  ──promote──▶  fixture_load  ──push──▶  round + fixture
  (hand-keyed,                 (confirmed,              (per competition)
   weeks ahead,                 one at a time,
   provisional)                 today's model)

        │
        └── create-competition binds round 1 to a block directly,
            before the block is ever promoted
```

A **block** is one round's worth of fixtures sharing a start window — the same unit
`fixture_load` holds today, but keyed ahead of time and allowed to sit alongside others.

Two things read blocks:

- **Competition creation** — offers up to three upcoming blocks as start dates and creates round 1
  from the chosen one, immediately.
- **The admin promote button** — copies a block into `fixture_load` when its kickoffs are
  confirmed, which is where today's flow picks up unchanged.

### Provisional, then confirmed

Between creation and promotion, round 1's fixtures and lock time are provisional. They come from
hand-keyed calendar data that may move. Promotion is what confirms them, and the existing push
reconciles the round to the confirmed batch.

**Void and postponed fixtures are operator-fixed by hand.** There is no postponement concept
anywhere in the codebase today and this design does not add one. It does widen the window in
which a fixture can move — from hours to a week or two — so the manual fix will be needed more
often than never. Accepted deliberately; automate only if it repeats.

## 4. Schema

Two new tables and one new column. Nothing is dropped — see §8.

### `fixture_block`

One row per block. A real row rather than a grouping key on the fixtures, because "which
competitions are starting on this block" has to be answerable.

| column | type | notes |
|---|---|---|
| `id` | serial PK | |
| `team_list_id` | int NOT NULL | blocks are per team list, like `fixture_load` |
| `label` | varchar NOT NULL | what the organiser sees, e.g. `Sat 29 Aug`. Hand-written |
| `opens_gameweek` | boolean NOT NULL default true | as `fixture_load.opens_gameweek` |
| `staged_at` | timestamptz NULL | set when promoted into `fixture_load`. NULL = still provisional |
| `created_at` | timestamptz NOT NULL default now() | |

### `fixture_block_item`

| column | type | notes |
|---|---|---|
| `id` | serial PK | |
| `block_id` | int NOT NULL → `fixture_block.id` ON DELETE CASCADE | |
| `home_team_short` | varchar NOT NULL | |
| `away_team_short` | varchar NOT NULL | |
| `kickoff_time` | timestamptz NOT NULL | |

A block's **lock time is `MIN(kickoff_time)` across its items** — the same derivation
`fixtureService.js:248-251` already uses for a staged batch. Not stored; derived, so it cannot
drift from the fixtures.

### `round.source_block_id`

`int NULL` → `fixture_block.id`. Records that this round was created from a block and is
therefore provisional until that block is promoted. NULL for every existing round and for every
round 2+, which keeps the migration additive.

This is what makes reconciliation targeted (§6) and what would make an "unconfirmed blocks with
competitions on them" warning trivial later. That warning is **not in v1** — the operator is
across the fixtures.

## 5. Competition creation

Fixture-service competitions only. `fixture_service = false` is untouched.

**Offer:** up to three blocks for the competition's `team_list_id`, ordered by lock time, where:

- `staged_at IS NULL` — not already pushed out
- lock time > `now() + START_LEAD_TIME_HOURS`

```
When does it start?

  ( ) Sat 22 Aug          ( •) Sat 29 Aug          ( ) Sat 5 Sep
                          recommended — a week
                          to get your players in
```

**The organiser sees the date, not the fixtures.** Ten fixtures invites them to shop between
gameweeks — a choice they have no basis to make, and one that quietly makes them feel responsible
for the matches. They are choosing when their competition starts. The *player* sees the fixtures,
on the pick screen, which already works.

Default to the second option where three are offered; the middle of the menu otherwise. A week is
enough to recruit and longer loses attention.

### `START_LEAD_TIME_HOURS = 1`

Lives in `services/fixtureBlock.js`. It governs which blocks may be *offered*, and does not
replace `FIRST_ROUND_LEAD_TIME_HOURS = 48` — see §6, that still governs the old path.

48 hours existed to stop someone pressing Ready on Friday and being handed Saturday's matches
before telling anyone. That risk is gone for a block-started competition: the date is chosen up
front and shown to every player from the moment they join, so nobody is surprised by it.

One hour is what remains — enough to get a pick in, and no more. Three friends who decide on a
Saturday morning to play that afternoon should be able to.

### On creation

Within the same transaction as the competition insert:

1. Create round 1: `round_number = 1`, `lock_time = MIN(kickoff)` of the block,
   `source_block_id = <block>`.
2. Copy the block's items into `fixture` against that round.

The competition now has fixtures and a deadline before the organiser has seen its dashboard.

### When no block is available

If nothing is offerable — calendar empty, or everything inside the lead time — create the
competition with no round, as today minus the Ready button. The dashboard says fixtures are being
prepared. This is an operator backlog, not a user-facing feature, and it should be rare.

## 6. What changes in the push

Round 2 onwards is unchanged. Round 2 cannot be pre-created — it does not exist until round 1 has
results — so the mid-competition gap between rounds stays, filled by the push exactly as now.
That asymmetry is deliberate: the gap only hurts at the start, when a player has no reason yet to
trust that anything is coming.

**The first-round gate does NOT collapse — this is a deliberate change from the original design.**
It proposed deleting `ready_at`, `opens_gameweek` and the 48-hour rule from `evaluateCompetition`
outright. That would have been wrong: live competitions were still waiting on the Ready button
when this was built (207 among them), and removing the gate would have handed their organisers a
round 1 they never asked for, closing joining on a date nobody had chosen.

So the two models run side by side. The rules are simply **skipped for a competition that already
has a round**, which every block-started competition does from the moment it is created. They go
when the last `ready_at` competition has started, and not before.

**Push becomes reconcile for a bound round.** `pushFixturesToCompetition` gains one case: if the
competition has a round whose `source_block_id` matches the block that produced this batch and
which has no results yet, **update it** rather than create — refresh `lock_time`, replace its
`fixture` rows, and report `round_action: 'reconciled'`.

Finding that block needs `fixture_load.source_block_id`, stamped by promote
(`db/migrations/2026-08-14-fixture-load-source-block.sql`). Matching on team and kickoff instead
would fail in exactly the case that matters — a kickoff that moved.

Two things the reconcile must do that are easy to miss:

- **Re-point the picks.** `push-results-to-competition.js:268` resolves a pick by
  `p.fixture_id`, so replacing the fixture rows orphans every pick made during the provisional
  week — and an unmatched pick reads as a *missed* one, costing a life. Picks are cleared and
  re-matched on `pick.team`, the only identity that survives a re-key. A pick whose team is no
  longer playing keeps `fixture_id NULL`: that is the postponement case from §3, and NULL is the
  honest record of it.
- **Clear `source_block_id` afterwards.** The round is no longer provisional once confirmed
  fixtures are in. Left set, a second push would reconcile it again instead of being refused.

## 7. Admin: the calendar screen

New screen, `/dashboard/fixtures/calendar`, kept **separate** from the existing fixtures screen.
Not tidiness: `fixture_load`'s rules — one batch at a time, refuses a new one while non-empty —
are right for the thing going out and wrong for a forward calendar. Two tables, two rule sets,
both honest.

- **List blocks** for a team list, soonest first, showing label, lock time, fixture count, and
  whether promoted.
- **Add a block** — label, `opens_gameweek`, and rows of home/away/kickoff. Same team pickers as
  the existing staging form (`/admin/get-fixture-team-lists`).
- **Edit / delete** while `staged_at IS NULL`. Deleting a block that competitions are bound to
  must be refused — their round 1 would lose its fixtures.
- **Promote** — copies items into `fixture_load` and stamps `staged_at`. Refused if
  `fixture_load` is non-empty for that team list, which is the existing rule enforced in the
  existing place.

After promotion the operator continues on the current fixtures screen: push per competition,
then **Clear staged batch**. Nothing about that flow changes.

**Net keying effort is unchanged.** Each gameweek is typed once, into the calendar, then promoted
with a button — the typing that happens today just happens earlier. The only genuine extra is the
one-off backlog of getting two or three gameweeks in front of us at the start.

### New routes

| route | purpose |
|---|---|
| `POST /admin/get-fixture-blocks` | list blocks for a team list |
| `POST /admin/add-fixture-block` | create a block with its items |
| `POST /admin/update-fixture-block` | edit an unpromoted block |
| `POST /admin/delete-fixture-block` | delete an unpromoted, unbound block |
| `POST /admin/promote-fixture-block` | copy into `fixture_load`, stamp `staged_at` |

Admin token on all of them (`middleware/admin-auth.js`), standard header format, always HTTP 200.

## 8. What is removed — and what is kept

**Kept, deliberately:**

- **`competition.ready_at` stays in the database.** Nothing will read or write it. It is not
  dropped because this is the live production database with no staging copy, and a column drop is
  irreversible. It joins `competition.earliest_start_date` as a dead column.
- **`ready_at` stays in the `/get-user-dashboard` response** (`get-user-dashboard.js:144,460`).
  The Flutter app does not reference it — verified — but leaving a field in a response costs
  nothing and removing one is the kind of change that breaks a client nobody remembered.

**Removed:**

- `POST /set-competition-ready` — unregister in `server.js`, `.delete` the file per the existing
  convention for retired routes.
- `services/gameStartReminder.js` and its `emailCatalog.js` entry — the email chases a button that
  no longer exists. Retire the catalog entry rather than repointing it; a replacement is §9.
- The Ready card on `/game/[id]/round` and its state in `src/lib/roundState.ts`. Update
  `docs/round-state-machine.md` in the same change.
- `/get-competition-start-outlook` — the card it fed is gone. The dashboard reads round 1's
  `lock_time` directly, because round 1 now exists.
- `reset-competition.js`'s clearing of `ready_at`. **A reset must instead re-run the §5 choice** —
  an emptied competition has no round 1 and no start date, so the organiser picks a block again.

## 9. Copy and email

- **New-competition welcome** — currently sells the Ready button. Becomes: your competition starts
  **Sat 29 Aug**, players can join right up to kick-off, here is your link. State the join deadline
  explicitly; it is the thing the organiser is actually deciding and today nothing says so.
- **Replaces the Ready reminder** — a share nudge two days before lock: *"Round 1 kicks off
  Saturday. You have 6 players. Last chance to share your link."* Same slot in
  `services/emailCatalog.js`, better job. Follow `services/pickReminder.js`'s shape and
  `docs/email/README.md` — one eligibility definition, used by the batch route, the preview and
  the send.
- **Organiser dashboard** — "Round 1 starts Sat 29 Aug · 6 players · players can join until
  kick-off" in place of the Ready card.
- **Player join and dashboard** — the fixtures and the deadline. A joining player can pick
  immediately, which is the point of the whole change: they arrive engaged and leave having done
  something.

## 10. Build order

Each step is deployable on its own; nothing is user-visible until step 4.

1. ~~Migration: two tables, `round.source_block_id`.~~ **Done** —
   `db/migrations/2026-08-14-fixture-blocks.sql`, applied.
2. ~~Admin routes and the calendar screen.~~ **Done** — five routes under `routes/admin/`,
   `services/fixtureBlock.js`, `/dashboard/fixtures/calendar`. Key two or three real blocks and
   promote one; the existing push must behave exactly as before.

   Two checks are not yet possible and are outstanding: a **successful** promote (the SQL was
   verified in a rolled-back transaction, but a live batch was staged at the time so the route's
   success path has not run for real), and **COMPETITIONS_BOUND** on delete, which cannot fire
   until step 3 creates a round with `source_block_id` set.
3. ~~Server: creation binds round 1; the push's reconcile case.~~ **Done** —
   `START_LEAD_TIME_HOURS = 1`, `getStartOptions` / `loadBlockForStart` in
   `services/fixtureBlock.js`, `GET /get-competition-start-options`, `create-competition`'s
   `start_block_id`, and the reconcile branch in `services/fixtureService.js`. The first-round
   gate was **kept**, not removed — see §6.

   Untested until step 4 puts real data through it: a reconcile where the block's fixture set has
   *grown* between keying and confirmation, and `reset-competition` on a block-started
   competition (it clears `ready_at` and deletes rounds, so the competition falls back to the
   Ready path rather than re-asking for a start date — §8 wants it re-asked).
4. Web: create-competition start options; Ready card out; dashboard and join copy.
5. Email: welcome rewrite, `gameStartReminder` retired, share nudge added.
6. Docs: `CLAUDE.md`'s fixture-service section, `docs/round-state-machine.md`.

Flutter needs no change at any step. It does not read `ready_at`, and a competition that has a
round 1 on day one is a competition it already knows how to display.
