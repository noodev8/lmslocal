# Results processing: performance brief

**Status:** problem documented, not solved. Written 2026-08-04 to hand to a focused session.

This is a briefing document. It assumes no prior context. Read it end to end before
touching code — §8 is constraints that will cost you a day if you meet them cold, and §9
carries the correctness arguments that make the recommended fix safe.

Companion: `docs/results-processing-logic.md` describes the same process as rules rather than
statements. §9 is what that document contributes here.

---

## 1. What the code is actually for

LMSLocal is Last Man Standing. Each round, every player picks one team. Win and you
survive; draw or lose and you lose a life; run out of lives and you are out.

"Processing results" is the step that turns fixture results into player outcomes. Per
player, per round it must:

1. Compare the player's pick against the fixture result → `WIN` or `LOSE`
   (a `DRAW` eliminates everyone who picked that fixture)
2. Write the outcome to `pick.outcome`
3. Insert a `player_progress` row — the per-round history the standings screens read
4. If `LOSE`: decrement `competition_user.lives_remaining` (floor 0) and set
   `status = 'out'` when lives would go below zero

Then, **only once every fixture in the round has been processed**:

5. Apply no-pick penalties to active players who never picked
6. If exactly one active player remains, record them as winner and set the competition
   to `COMPLETE`
7. Clear pending notifications, write an audit log entry

In one line: **decide who is in and who is out, and write it down.**

That is the requirement. Everything below is about how slowly it currently does it.

---

## 2. There are two implementations, and that is deliberate

| | route | scope |
|---|---|---|
| Organiser-managed | `lmslocal-server/routes/organizer-process-results.js` | **one** competition per call |
| Fixture service | `lmslocal-server/routes/admin/push-results-to-competition.js` | **one** competition per call (was every competition in one call — see §5) |

`competition.fixture_service` decides which path a competition uses. Today: **12 false,
2 true.**

Both files contain their own copy of steps 1–7. This is intentional and both headers now
carry a `SHARED LOGIC WARNING` pointing at the other. **If you change a rule, change it in
both**, or organiser-managed and service-managed competitions start playing different
games. Consolidating them into one shared function is a reasonable thing to do — it has
been deliberately deferred, not overlooked.

What is **not** duplication, and must not be "fixed" into symmetry:

- the organiser route runs one competition in its own transaction
- the admin route loops every affected competition **inside a single transaction**

---

## 3. The performance problem

The SQL is not the problem. Every statement is a single-row `UPDATE` or `INSERT` by key.
The problem is the **number of network round trips**.

Measured against the production database, 30 sequential trivial queries:

```
median 24ms   mean 23.7ms   min 22ms   max 25ms
```

Almost all of that is network latency — the database is remote. So the cost model is
simply **queries × 24ms**, and the fix direction is *fewer, larger statements*, not
cleverer ones.

### Where the round trips come from

`organizer-process-results.js`:

| line | what | runs |
|---|---|---|
| 174 | `for (const fixture of unprocessedResults.rows)` | per fixture |
| 176 | fetch picks for that fixture | **1 per fixture** |
| 184 | `for (const pick of picksResult.rows)` | per player |
| 197 | `UPDATE pick SET outcome` | **1 per player** |
| 204 | `INSERT INTO player_progress` | **1 per player** |
| 211 | `UPDATE competition_user` (lives) | **1 per losing player** |
| 266 | `for (const player of noPickPlayersResult.rows)` | per no-pick player |
| 268, 274 | insert progress + decrement lives | **2 per no-pick player** |

So roughly: `fixtures + (players × 2) + (losers × 1)`, plus the no-pick tail.

`push-results-to-competitions.js` has the same inner structure at lines 264 / 274 / 353,
wrapped in an outer `for (const competitionId of affectedCompetitions)` at line 210 —
all inside the single transaction opened at line 101.

### Measured baseline

Largest real round in production — Lakers LMS (competition 149), round 1: 10 fixtures,
43 picks, 8 eliminations.

**≈110 queries ≈ 2.6 seconds.**

---

## 4. Scenario A — the organiser (the focus)

An organiser opens one competition, clicks process, waits, then navigates to the next
competition and repeats. **Separate requests, separate transactions.** Nothing is summed;
having two competitions means two independent waits, not a doubled one.

Holding fixtures at 10:

| players | queries | wait |
|---|---|---|
| 20 | ~55 | 1.3s |
| 50 *(largest today)* | ~120 | 2.9s |
| 100 | ~230 | 5.5s |
| 200 | ~450 | 11s |
| 500 | ~1,110 | 27s |
| ~1,100 | ~2,500 | **60s — proxy timeout territory** |

Two important details:

- Results are processed **incrementally**. Both routes select
  `WHERE result IS NOT NULL AND processed IS NULL`, so each click handles whatever is
  newly available. An organiser processing midweek and again at the weekend splits the
  cost across those clicks.
- The **last** click of a round is disproportionately expensive: it carries the remaining
  picks *plus* the no-pick loop *plus* the winner check, which are gated behind
  `total_fixtures == processed_fixtures` (lines 248 and 301).

**Business judgement from the product owner:** organisers do not mind waiting — it beats
working eliminations out on paper. Organisers are also unlikely to run many competitions
concurrently, because managing them becomes unwieldy long before results processing does.
So raw speed is **not** the primary driver here.

---

## 5. Scenario B — the admin push (context, not the focus)

> **Resolved 2026-08-04 — this section describes the old shape.** The admin now pushes **one
> competition per call** (`push-results-to-competition`, singular), each in its own transaction,
> driven from a list on the fixtures screen. The compounding below no longer happens: the
> ceiling is per competition, the same as the organiser path, and a failure is confined to one
> competition instead of rolling back the batch. Clearing `fixture_load` became its own step
> (`clear-staged-batch`) because the staged rows must outlive each individual push. The old
> route is kept unregistered as a frozen reference. The analysis is left below because it is
> the reason the change was made.

Kept separate deliberately. This is the platform operator pushing one staged fixture batch
out to every opted-in competition, in **one transaction**.

| competitions × players | queries | wait |
|---|---|---|
| **2 × 50 — today** | ~240 | ~6s |
| 5 × 50 | ~600 | 14s |
| 10 × 50 | ~1,200 | 29s |
| 10 × 100 | ~2,300 | 55s |
| 20 × 100 | ~4,600 | **110s** |

This path compounds where the organiser path does not, and it is the path customers are
being migrated toward. Because it is a single transaction, a timeout **rolls back every
competition in the batch** — nobody gets their results and the whole push must be retried.

**The number to watch is competitions with `fixture_service = true`, not player counts.**
It is 2. Roughly 8 competitions of headroom before this needs attention.

Atomicity here is correct and worth preserving; the duration is the problem.

---

## 6. The two things the solution needs to address

### 6a. Proxy timeout (the real risk)

**Verified 2026-08-04 — the ceiling is 60 seconds.** Three things were checked:

- `nginx -T` on the VPS — the merged, *effective* config, so this covers `nginx.conf`,
  the site file and every `conf.d` include — contains no `proxy_read_timeout` or
  `proxy_send_timeout` at all. Nothing overrides nginx's built-in default of **60s**.
- Nothing sits in front of nginx. `curl -D -` against the production API returns
  `Server: nginx/1.24.0 (Ubuntu)` with no CDN headers, matching
  `app.set('trust proxy', 1)` in `server.js`. There is no second, lower ceiling hiding
  behind a CDN.
- Node is not the constraint. `server.js` sets no `server.timeout`, `headersTimeout` or
  `requestTimeout`, and the Node defaults bound how long the *client* takes to send a
  request — not how long a handler takes to respond. Node will not kill a slow handler.

So the 60s figures above stand as written.

The organiser path only reaches 60s at roughly **1,100 players**, which is far away. The
admin path reaches it at around **11 competitions × 100 players**, which is much closer.

### 6b. Progress feedback (the stated requirement)

Today the organiser sees a spinner. The product owner wants a real indicator — "results
are being processed", ideally with stages, so a long wait reads as *working* rather than
*broken*.

**These two requirements point at the same solution.** A synchronous HTTP request cannot
report progress and is exactly what a proxy timeout kills. Anything that fixes the
feedback (background job + status polling, or streamed/chunked progress) also removes the
timeout ceiling. Treat them as one design problem, not two.

---

## 7. Candidate directions (evaluate, do not assume)

Roughly increasing order of risk:

1. **Batch the writes only.** Keep every decision in JavaScript exactly as now; collapse
   the per-player `UPDATE pick` and `INSERT player_progress` into set-based statements
   (multi-row `INSERT`, `UPDATE … FROM (VALUES …)`). Takes ~110 queries to ~15 for the
   measured round. **Touches no rule that decides an outcome** — the highest
   value-to-risk option, and the one to try first.
2. **Push the decision into SQL.** Fewer trips still, but moves the elimination rules into
   SQL — in two places (§2), and SQL is harder to reason about for rules that will change.
3. **Background job + polling.** A `processing` job row, a worker, and a status endpoint
   the UI polls. Solves §6a and §6b together and removes the ceiling permanently. Much
   larger change: new state, new failure modes, and the UI must handle a job that fails
   halfway.
4. **Progress indicator alone.** Independent of all the above and worth doing regardless,
   though a synchronous request limits how honest the progress can be.

Option 1 plus a version of option 4 may well be enough for a long time.

**Read §9 before picking between 1 and 2** — the ruleset was written up after this section, and
it changes the risk assessment for part of option 2.

---

## 8. Constraints — read before writing code

- **The live production database is the only database.** No staging copy. Development
  connects straight to it. `lmslocal-server/db/README.md` is the front door; use
  `node db/query.js` (read-only) and `node db/write.js` (has `--dry-run`).
- **Test with organiser 50 only.** Every other competition belongs to a real customer.
- **This is the game's correctness path.** Getting it wrong eliminates the wrong player,
  which is visible to customers and awkward to unwind. Correctness outranks speed here by
  a wide margin.
- **Change both implementations** (§2) or they diverge.
- Everything already runs inside a transaction, which makes a rollback-based test
  practical — the natural way to test this safely.

### Already done — do not redo

- `competition.status` normalised to upper case in code *and* data (`SETUP`, `ACTIVE`,
  `COMPLETE`). `competition_user.status` is a different column and correctly lower case.
- Two dead lower-case `'complete'` guards fixed in `load-pick-reminder.js`.
- The same N+1 pattern was fixed in `routes/get-user-dashboard.js` — **read that commit
  first.** It is a worked example of the exact technique (`unnest` to zip per-row
  parameters) and of how the change was proved safe.
- `lmslocal-server/tests/` holds a capture-and-diff harness. It does not cover these
  routes — they mutate, so it cannot be pointed at them unchanged — but `tests/README.md`
  explains the approach and `compare.js` is reusable.

### Useful commands

```bash
# per-round volumes for the largest competition
node db/query.js "SELECT r.round_number,
    (SELECT count(*) FROM fixture f WHERE f.round_id=r.id) AS fixtures,
    (SELECT count(*) FROM pick p WHERE p.round_id=r.id) AS picks,
    (SELECT count(*) FROM pick p WHERE p.round_id=r.id AND p.outcome='LOSE') AS losers
  FROM round r WHERE r.competition_id=149 ORDER BY r.round_number"

# competitions approaching the organiser-path pain threshold
node db/query.js "SELECT c.id, c.name, count(cu.user_id) AS players
  FROM competition c JOIN competition_user cu ON cu.competition_id=c.id
  WHERE c.status IN ('SETUP','ACTIVE')
  GROUP BY c.id, c.name HAVING count(cu.user_id) > 120 ORDER BY players DESC"

# the admin-path multiplier
node db/query.js "SELECT fixture_service, count(*) FROM competition GROUP BY fixture_service"
```

---

## 9. What the ruleset adds — added 2026-08-05

`docs/results-processing-logic.md` was written after this brief. It describes the same process a
level above the code, as rules rather than statements. Read alongside this document it does two
things: it supplies the **correctness arguments** that make batching safe, and it changes one of
the risk judgements in §7.

### The goal is scalability, not speed

Worth stating plainly, because §4 can be read as "this is about seconds". It is not.

The real problem is the **60s ceiling in §6a**. Beyond roughly 1,100 players the operation does
not complete at all — it times out mid-round, on the path that decides who is eliminated. That is
the failure worth engineering against. Organisers waiting three seconds is not.

Batching changes the cost model from *"grows with players"* to *"a fixed cost, plus a small term
that grows with players"*. Round trips — where essentially all the time goes, at 24ms each — go
flat at roughly a dozen statements regardless of player count. The database still does more work
for 500 players than for 50, but that work is milliseconds inside one statement rather than
another wire crossing per player.

| players | today | batched |
|---|---|---|
| 50 *(largest today)* | ~2.9s | well under 1s |
| 500 | ~27s | still under 1s |
| ~1,100 | **60s — times out** | no ceiling in sight |

So the ceiling does not move further away so much as stop being a practical concern, and the
background job in §7.3 becomes a "probably never" rather than a "not yet".

It does **not** address §6b. Batching gives no progress feedback. But at sub-second processing a
spinner is an honest indicator — the wait it was meant to explain stops existing.

### Three rules that license the batching

These are the reasons option 1 is safe. Without them you would have to re-derive each one
nervously while writing the SQL.

- **One pick per player per round.** This is what makes a single set-based life deduction
  provably equivalent to the loop: no player can appear twice in the set, so every loser loses
  exactly one life. Without this rule you would have to count losses per player and subtract N.
- **Winners are recorded but never charged.** Part 2 splits into *recording* (everyone) and
  *consequence* (losers only) — two sets, two statements, no per-row branching. The branching is
  what forces the current loop.
- **History is append-only and never revised.** No conflict handling, no ordering constraints,
  no read-back. A single insert-select, and nothing downstream depends on the order rows land in.

### The claim is three steps that should be one

The ruleset says processing works on the fixtures the claim **actually won**. The code implements
that as select candidates → conditional update → filter the original list in JavaScript against
what came back.

Those are one operation. A conditional update returning the rows it claimed *is* the select. That
saves a round trip, but the better reason is structural: the current shape reconstructs the rule
after the fact and can drift — the select and the filter could disagree. The merged shape cannot.

### Ordering the batched statements

The ruleset gives the dependency order, which is not obvious from the loop: outcomes first, then
history derived from the now-stamped picks, then lives from the losers.

Roughly: round lookup → claim-with-return → outcomes → history → lives → gate check; then only if
the round closed: no-pick history → no-pick lives → active count → completion → notification
cleanup → audit. A dozen statements, flat.

Note this also removes the "last click is disproportionately expensive" problem in §4. The no-pick
tail stops scaling with players too.

### This revises the §7 risk ranking

§7.2 warns that pushing decisions into SQL moves the elimination rules somewhere harder to reason
about. That is fair for parts 3 and 4, where the gating and completion logic is genuinely fiddly.

It is **overstated for part 2**. The rule there is equality plus a draw special case — three lines.
Expressing it as set-based SQL is not "moving the rules into SQL" in the sense §7.2 warns about.
Whoever picks this up should reconsider that ordering rather than inheriting it.

### Two things to settle before writing the SQL

Neither is urgent and neither is a new bug; both are in the blast radius.

- **The elimination count.** Both loops count a player as eliminated when their status reads `out`
  after the update, so a player already `out` who somehow has a pick would be counted again.
  Set-based inherits this exactly. Decide whether it is intended before enshrining it in a
  statement that is harder to eyeball.
- **The gate arithmetic.** It compares total to processed fixtures with loose equality on values
  the driver returns as strings. It works. Worth tightening while someone is in there.
