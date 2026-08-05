# Changing a Result After Processing

How to correct a result that was entered wrongly and has already been processed. The third of
three: `results-processing-logic.md` says what the process does,
`results-processing-performance.md` says how to make it scale, this says how to change your mind.

**Status:** design and reasoning, written 2026-08-05. No tooling built yet.

Today this is a support path: an organiser reports a mistake, the platform operator runs it. The
two-phase shape in §4 is deliberately the same shape a future organiser-facing button would
need — assess, show the impact, confirm.

---

## 1. This is a new action, not an undo

**Nothing is unwound.** The round stays processed, the fixtures stay claimed, the picks stay
exactly where they are, no-pick penalties stay applied, team availability is never touched.

A correction is a **forward action with its own rules**: change what the result says, bring the
affected players' records into line with it, and rebuild everything that derives from them.

This was chosen over reversing and reprocessing a whole round, for three reasons:

- **Smaller blast radius.** Only players who picked the corrected fixture are affected. Everyone
  else's record is untouched, including every no-pick penalty — changing a result never changes
  who picked.
- **No reprocessing window.** Reversal leaves the round unprocessed with results cleared, and in
  that window someone can press process again before the correction is entered. A correction never
  makes the round claimable, so there is no race to lose.
- **It matches what actually happens.** The one real occurrence to date affected exactly one
  player. Unwinding a round of fifty to fix one of them is the wrong size of tool.

---

## 2. Why the arithmetic is easy

Player lives and status are a **cache** of the per-round history:

- lives = starting lives − losses recorded
- out = losses exceeded starting lives

Verified against production on 2026-08-05: Lakers LMS, 52 players, **zero mismatches** between
stored values and values derived from history alone.

So a correction never computes a delta. **It corrects the record, then rebuilds the cache from
it.** Rebuilding is idempotent, needs no knowledge of the previous value, and handles every
cascade — a player becoming active again, or newly out — without anyone reasoning about it.

The same derivation doubles as a health check: run it against a state you believe is correct and
it should change nothing (§7).

### The one rule this bends

The logic doc states the history is append-only and never revised. That rule is load-bearing —
it is what makes lives derivable and what licenses the batched writes in the performance work.

A correction **revises** the affected history rows. It has to: appending a "this was wrong" row
would leave both the old loss and its replacement in place, and the history records outcomes, not
amounts, so nothing could net them out.

The precise formulation is therefore:

> The history is append-only **during processing**. Correction is a separate, deliberate, audited
> action that may revise it — and is the only thing that may.

Nothing is deleted, no round is unwound, no fixture returns to unprocessed. The audit log gains a
permanent record of what changed and from what, so the narrative of actions stays append-only even
though a row was revised.

---

## 3. What may be corrected

**Only a fixture in the most recently processed round.**

Precisely: the fixture's round has processed fixtures, and every round above it has none. That
allows for the common case where the next round already exists but is empty — pushing fixtures
creates rounds cheaply, so a new round often sits waiting while the mistake is in the one below.

### Why earlier rounds are refused

A correction in an earlier round cannot be resolved automatically, in either direction:

- **If it resurrects someone** eliminated in that round, they have no picks in the rounds since —
  being out is why they did not pick. Are they owed no-pick penalties for those rounds, which
  would eliminate them again? Or were they wrongly barred from playing? That is a judgement, not
  arithmetic.
- **If it eliminates someone**, they have picks in later rounds they should never have been
  allowed to make.

Both need a human decision. Refuse, report why, and let the operator decide what to do by hand.

### Also check

- **Is the round above already locked?** If players have picked for it, resurrecting someone means
  they had no chance to pick and would take a no-pick penalty for a round they were barred from.
  Warn — this turns one mistake into two.
- **Have manual lives adjustments been made?** See §6.

---

## 4. Two phases

Deliberately separate. Phase one answers "what would this do", and is the whole value of the tool
— knowing the extent of the damage before touching anything. The real incident affected one
player; knowing that in advance is what made it safe to fix by hand.

### Phase one — assess (read-only, writes nothing)

Given a fixture and the result it should have had, report:

- the players who picked that fixture, and for each: outcome now → outcome after
- lives now → lives after
- status now → status after, calling out every resurrection and every new elimination
- whether the competition's completion changes — including a completed competition reopening, and
  who stops being the winner
- any manual lives adjustment in this competition (§6)
- any precondition in §3 that fails, with the reason

This is also the answer to a support request on its own. Sometimes the report is enough to decide
no change is needed.

### Phase two — apply (one transaction)

Re-run the assessment first — state may have moved since — then:

1. Set the fixture's result to the corrected value. It stays processed.
2. Recompute the outcome for each pick in that fixture, from the new result.
3. Revise those players' history rows to match.
4. Rebuild lives and status from history.
5. Rebuild completion and winner from the resulting active count.
6. Write an audit entry recording the fixture, the old and new result, and every player affected.

Steps 4 and 5 must not be skipped when "nothing looks like it changed" — a correction that flips
one player can uncomplete a competition.

**Running it in parts is fine.** Assess, decide, apply. There is no requirement that this be one
magic button, and while it is a support path it is better that it is not.

---

## 5. More than one competition

A wrong staged result reaches every subscribed competition, so a correction usually needs to
happen in several at once.

The loop is not the hard part — each competition corrects independently, in its own transaction,
reported one at a time. That is the same lesson the results push already learned: nothing
compounds, a failure is confined to one competition, and you see each outcome before the next.

**The addressing is the part that needs care.** Round numbers are per competition and they
diverge — today there are competitions on round 6 and competitions on round 1, and a club joining
in October will be on round 1 while everyone else is on round 12. "Round 4" means nothing
platform-wide.

So a fixture must be identified by **team pairing and kickoff time**, which is exactly how the
push matched it in the first place. Same key, run backwards.

Assess every competition first, report the whole picture, then apply. Half-applied is recoverable
— a second run finds the already-corrected competitions in the desired state and reports nothing
to do.

---

## 6. Manual lives adjustments

An organiser can set a player's lives directly, outside processing. It exists for good reasons —
fixing their own earlier mistake, or doing a regular a favour — and it is genuinely rare: **used
exactly once in the whole production history.**

It leaves no history row, so rebuilding lives will overwrite it — handing back a life that was
deliberately removed, or taking back one that was given.

**Warn and continue.** Name the players, say their adjustment will be overwritten and may need
reapplying afterwards, and let the operator proceed. Refusing outright would block a real fix for
a rare and easily-repaired side effect.

**Detection is currently awkward.** Adjustments are audited, but the audit action embeds the
player's name in the action itself — `"Lives set for player Anastasia"` — so there is no stable
value to match on. Normalising that action to a fixed name is a small independent change worth
making before detection is relied on.

---

## 7. Verification

The derivation that powers the rebuild is also a health check. Any mismatch is either a bug or a
manual adjustment, and both are worth knowing about. Cheap and read-only.

**Run it before migrating competitions onto the fixture service**, to establish the invariant
holds everywhere and not only in the one competition checked so far. Run it after every correction.

```sql
-- Mismatches between stored state and state derived from history.
-- Expect zero rows. Any row is a bug or a manual adjustment.
WITH derived AS (
  SELECT cu.competition_id,
         cu.user_id,
         cu.lives_remaining,
         cu.status,
         c.lives_per_player,
         count(*) FILTER (WHERE pp.outcome = 'LOSE') AS losses
  FROM competition_user cu
  JOIN competition c ON c.id = cu.competition_id
  LEFT JOIN player_progress pp
         ON pp.player_id = cu.user_id
        AND pp.competition_id = cu.competition_id
  WHERE c.status IN ('SETUP','ACTIVE')
  GROUP BY cu.competition_id, cu.user_id, cu.lives_remaining, cu.status, c.lives_per_player
)
SELECT competition_id, user_id, lives_remaining, status, lives_per_player, losses
FROM derived
WHERE lives_remaining <> GREATEST(lives_per_player - losses, 0)
   OR status <> CASE WHEN losses > lives_per_player THEN 'out' ELSE 'active' END;
```

---

## 8. What is not recoverable

The database is correctable. The outside world is not, and none of this is fixable by tooling.

- **Players have already seen it.** Standings updated the moment processing committed.
- **Emails have been sent** and cannot be recalled.
- **Notifications were resolved.** Processing marks pending round notifications as skipped; a
  correction does not restore them.

A correction is a database operation **and** a communication. Assume you will need to tell people.
This is also why speed matters more than elegance here — the data will keep, the confusion will not.

---

## 9. Mechanics

**This section names tables and columns and will drift.** Everything above is the reasoning and
should outlive the schema; re-check this part against the database before use.

- The result lives in `fixture.result` — a team short code, or `'DRAW'`. Leave `fixture.processed`
  set; that is what keeps the round out of reach of the process routes.
- Affected picks are `pick` rows with `fixture_id` = the corrected fixture. One pick per player per
  round, so each affected player has exactly one.
- History rows are in `player_progress`, matched on `fixture_id` and `player_id`. No-pick rows
  carry no fixture and must not be touched.
- Rebuild `competition_user.lives_remaining` and `status` from `player_progress`, with
  `competition.lives_per_player` as the baseline.
- Completion is `competition.status` and `competition.winner_id`. **Reopening means setting the
  status back to `ACTIVE` and nulling the winner.**

Two cautions:

- **`competition.status` casing.** `SETUP` / `ACTIVE` / `COMPLETE`, upper case, normalised in both
  code and data. `competition_user.status` is a different column and correctly lower case.
- **Test with organiser 50 only.** Every other competition belongs to a real customer, and this is
  the one operation whose entire purpose is to change settled results.

---

## 10. Open questions

- **Script or route?** A script cannot be reached by accident and needs someone deliberate at a
  keyboard, which suits a support path. A route is faster under pressure and is the path toward an
  organiser-facing button. Leaning script first, route later — phase one is the same work either way.
- **Should phase one be exposed to organisers before phase two is?** An organiser seeing "this
  would change these two players" is useful even if the operator still applies it.
- **Normalising the manual-adjustment audit action** (§6) is small, independent, and worth doing
  regardless of when this gets built.
