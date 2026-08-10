# Allowed teams

What a player may still pick is **derived, not stored**. There is no `allowed_teams` table in the
target design: the answer is computed from the player's own picks against the competition's team
list, every time it is asked for.

This doc is the contract. When a new scenario turns up ("what happens to a player who joins at
round 5?", "what if a team is deactivated mid-season?"), answer it here first, then change the code
to match.

The rule it implements is unchanged and is the one organisers already know: **you cannot pick the
same team twice — until you have used them all, at which point they all come back.**

---

## Why it changed

### It was already derived, in three places, in two different ways

`services/allowedTeams.js` defines allowed teams as *every active team in the competition's list,
minus the ones this player has already picked*, and rebuilds the rows from that whenever a player's
set comes back empty. That is a complete definition — it needs nothing the `pick` table doesn't
already hold.

But it is not the only rebuild. Two others exist and **they disagree with it**:

| Implementation | Definition | Fires when |
|---|---|---|
| `services/allowedTeams.js:39` | all active teams **minus already-picked** | pick screen read finds an empty set |
| `database.js:143` (`populateAllowedTeams`) | **all active teams**, no exclusion | helper called with a player on zero rows |
| `services/fixtureService.js:319` | **all active teams**, no exclusion | a push finds an active player on zero rows |

So a player who reaches zero rows gets either a re-derive that changes nothing, or a full amnesty
that hands back every team they have ever used — decided by which code path happens to notice
first. That is not a rule anybody chose. Derivation collapses all three into one definition that
cannot drift, because there is nothing to drift *from*.

### The stored copy was already redundant

Measured against production, stored versus derived across all 17 competitions:

```
derived_rows        3,549
stored_rows         3,547
stored_not_derived      0   ← the table never allowed a team derivation forbids
derived_not_stored      2   ← the table was missing two
```

A strict subset, 99.94% identical. The table carried no information the derivation didn't, and
what little it had that was different was wrong.

**The two drifted rows are the whole argument in miniature.** Both are eliminated players in
competition 149 (Lakers LMS), and both are missing Ipswich from their stored set despite never
having picked it. What they *did* pick, in round 2, was **West Ham — a team that no longer exists
in the `team` table at all**, in any list.

The mechanism is table-id reuse. Picking WHU deleted WHU's `team_id` from each player's
`allowed_teams`. The list was later rebuilt for 2026-27 (Leeds, Coventry, Sunderland and Hull are
all in it now), West Ham's row went, and the id it occupied is today Ipswich — `team` 17-20 read
LEE, TOT, IPS, COV. Two stale deletions silently became deletions of a different club.

The evidence is tight: exactly **two** picks in the entire database reference a team that no longer
exists, they belong to exactly the two players who show drift, each is missing exactly one team,
and there are **zero** orphaned `allowed_teams` foreign keys anywhere.

> **`allowed_teams` stored a pointer that outlived what it pointed at. `pick` stored a value.**

`pick.team` still says `'WHU'` and needs no `team` row to mean something, which is why the
derivation is right where the table is wrong: it never excludes West Ham (there is nothing to
exclude) and correctly offers Ipswich (never picked). Neither player can see any of it — both are
out, and Ipswich is not playing in the latest round, which is why the API-visible diff is zero.

**Nothing needs cleaning up.** The two rows are wrong in a table that step 4 deletes, and the
derivation already returns the correct answer for both players today.

### The reset message was not true

`get-allowed-teams.js:207` tells the player *"You ran out of teams! All teams have been reset and
are now available again."* The rebuild it just ran excludes already-picked teams
(`allowedTeams.js:44-50`), so a player who genuinely exhausts the list gets **zero teams back** and
a message saying otherwise.

Nobody has hit it — five `Teams Auto-Reset` events have fired, all of them the empty-set self-heal
on bots and new joiners, and the deepest competition is 7 rounds into a 20-team list. It becomes
real at round 21. Fixing it properly is what forced the question this doc answers: *where does a
reset live if nothing is stored?*

### The economics get worse, not better

At today's 3,624 rows the table costs 2.6 MB and nobody would care. The per-row cost is
**215 bytes heap + 531 bytes index = 746 bytes** — the table is 71% index, carrying **seven**
indexes of which two are byte-identical (`idx_allowed_teams_competition_user` and
`idx_allowed_teams_comp_user`).

Against a target of 24,000 memberships at ~100 players per competition:

| Team list | Rows at competition start | Size |
|---|---|---|
| EPL (20 teams) | 480,000 | ~358 MB |
| World Cup (48 teams) | 1,152,000 | ~859 MB |

Storage is the least of it. The write volume is what actually bites:

- **Joining** inserts the full list per player, *inside the join transaction* on the signup path
  (`join-competition-by-code.js:252`) — 480k–1.15M inserts per season.
- **Every pick** is a delete; every pick change an insert and a delete.
- **Every competition reset** deletes and reinserts the whole set — 100 players × 48 teams = 4,800
  rows churned (`reset-competition.js:245,286`).
- All of it maintaining seven indexes.

Derived, every one of those is zero.

---

## 1. What is stored

One column. Not a table, not a bitmask:

```sql
ALTER TABLE competition_user
  ADD COLUMN teams_reset_round INTEGER NOT NULL DEFAULT 0;
```

It records the round number **after which** picks still count against the player. Zero means "all
of them", which is the correct starting state and why the default needs no backfill.

**Per player, not per competition.** In practice everyone exhausts in the same round, because
everyone plays the same real-world gameweeks and **nobody joins mid-competition** — the public join
path refuses once round 1 locks (`join-competition-by-code.js:138,150`, `COMPETITION_STARTED`).

The asymmetry that remains is **missed picks**: a player who missed a round has one fewer pick and
so exhausts a round later than the pack. That is enough on its own to make per-player the correct
granularity, and `competition_user` is the row that knows it. It is also the gentler write pattern
— the boundary advances as each player opens the pick screen, rather than one transaction touching
every membership at once.

Note that `add-offline-player.js` carries **no** started-competition guard, so an organiser can add
an offline player after round 1. Derivation handles that correctly with no special case (they have
simply used fewer teams), which is why it is recorded here rather than fixed here.

**Only the latest boundary matters.** After a second reset, nothing before it is ever relevant
again, so a single integer is sufficient for unbounded resets:

| | `teams_reset_round` | Picks that count | Arsenal |
|---|---|---|---|
| Rounds 1–20 | 0 | rounds 1–20 | picked r3 → blocked |
| Round 21, set empty → boundary 20 | 20 | rounds 21+ | **available (2nd use)** |
| Rounds 21–40 | 20 | rounds 21–40 | picked r25 → blocked |
| Round 41, set empty → boundary 40 | 40 | rounds 41+ | **available (3rd use)** |

---

## 2. The derivation

```sql
SELECT t.id AS team_id, t.name, t.short_name
FROM team t
WHERE t.team_list_id = $1
  AND t.is_active
  AND NOT EXISTS (
    SELECT 1 FROM pick p
    WHERE p.competition_id = $2
      AND p.user_id       = $3
      AND p.round_number  > $4        -- teams_reset_round
      AND p.team          = t.short_name
  )
ORDER BY t.name
```

**No join to `round`.** `pick.competition_id` and `pick.round_number` are both fully populated
(289/289 verified), so this is a 20–48 row scan against `team` with one index probe per team.

It needs one index, which replaces the seven being dropped:

```sql
CREATE INDEX idx_pick_comp_user ON pick (competition_id, user_id);
```

`no_team_twice = false` short-circuits the whole thing — every active team is allowed, always.
Every competition currently has it on, but the flag is still read.

The pick screen additionally filters to teams with a fixture in the current round. That is a
separate concern and stays where it is; it is not part of "allowed".

---

## 3. When the boundary advances

Lazily, on read, in `services/allowedTeams.js` — the same self-healing position it occupies today.
The module changes from *"rebuild the rows"* to *"derive the list; if it comes back empty, set
`teams_reset_round` to the previous round number and derive again."*

One `UPDATE` of one integer, replacing a 20–48 row delete-and-reinsert. Still written to
`audit_log` as `Teams Auto-Reset`, which is now an accurate name for what happened.

**Every caller gets this, which is the point.** `admin-set-pick`, `set-bot-pick` and `set-bot-picks`
already route through this module, so bots and offline players — who never open a pick screen —
advance their boundary when someone sets a pick for them. That closes the un-healed-bot drift as a
side effect rather than needing its own handling.

**The empty set must mean "exhausted", not "not started".** With a stored table, zero rows was
ambiguous: it meant either a player who had used everything or one whose rows were never written.
Derived, zero rows can only mean exhausted, because there is no write to have missed. This is the
ambiguity that produced three rebuild implementations.

---

## 4. Landmines

- **`pick.team` holds a short code**, not a team id and not a full name. The derivation joins
  `p.team = t.short_name`. This is how the existing service already works
  (`allowedTeams.js:44-50`); it is easy to reach for `team_id` and get nothing back.
- **`teams_reset_round` is a round *number*, not a round id.** Round numbers are per-competition
  and start at 1; a boundary of 0 means no reset has happened.
- **Changing the team list under a running competition is a real event, not a hypothetical.** It
  has already happened once — see the competition 149 rows above, where West Ham was picked and
  later left the list. `t.is_active` and `t.team_list_id` are both evaluated at read time, so a
  team switched off or swapped out vanishes from every player's list at once, and a pick of a team
  that is no longer in the list stops excluding anything. Derivation handles this the sane way
  (the current list is the truth); the stored table did not. Worth knowing before anyone edits a
  list mid-season, but no longer a source of permanent corruption.
- **Do not compute the reset from `floor(picks / list_size)`.** It is tempting, needs no column at
  all, and is wrong: deactivate one team and `L` goes 20→19, which retroactively moves every past
  cycle boundary and silently changes what is allowed. A reset is an event with product meaning.
  Record it when it happens.
- **A bitmask was considered and rejected.** It re-encodes the same duplicated state in a form that
  cannot be diffed against the truth, couples correctness to team ordering, breaks the
  `allowed → team → fixture` join the pick screen needs, and would carry a different meaning per
  team list once the two lists differ in length. It also stores only the *current* state, not when
  or why it changed, so it cannot express the reset any more cheaply than one integer does.

---

## 5. Migration

Steps 1–3 are additive and run alongside the existing table. **Step 4 is the irreversible one and
has to be earned by step 3.**

**1. Schema, backward-compatible.** Add `competition_user.teams_reset_round` and
`idx_pick_comp_user`. Nothing reads either yet.

**2. Derive, and diff.** Rewrite `services/allowedTeams.js` to derive. `get-allowed-teams` returns
the derived list but **also** compares it against the stored table and logs any disagreement. The
response shape `{team_id, name, short_name}` is unchanged, so `pick_remote_data_source.dart:54` and
the web pick screen are untouched.

**3. Run it for a couple of gameweeks.** The diff should sit at the two known competition-149 rows
above and nothing else. `tests/captures/compare.js` and the two capture runs are the tool for
proving the responses are identical.

A full sweep of all 147 memberships through the real service code was run at the time of writing:
**2 allowed-set differences (both the known ones) and 0 differences in what the API would actually
return.** Repeating that sweep is the cheapest way to re-check before step 4.

**4. Strip and drop.** Remove `allowed_teams` from every path below, then drop the table and its
seven indexes.

### What step 4 touches

**Rebuilds — collapse into the one derivation:**
`services/allowedTeams.js:35,40` · `database.js:143` (`populateAllowedTeams`, delete outright) ·
`services/fixtureService.js:319`

**Population on entry — becomes nothing at all:**
`create-competition.js:349` · `join-competition-by-code.js:252` · `add-offline-player.js:233` ·
`admin/add-bots-to-competition.js:132`

**Pick maintenance — becomes nothing; the pick row *is* the record:**
`set-pick.js:277,286` · `unselect-pick.js:189` · `admin-set-pick.js:181,399,448` ·
`admin/set-bot-pick.js:155,244,253` · `admin/set-bot-picks.js:189`

**Cascade deletes — disappear entirely, no replacement:**
`remove-player.js:238` · `reset-competition.js:245,286` · `hide-competition.js:158` ·
`delete-competition.js:190` · `admin/delete-admin-competition.js:159` ·
`delete-account.js:203,233` · `admin/remove-bot-from-competition.js:136`

**Reads — repoint at the derivation:**
`get-allowed-teams.js:125,236` · `set-pick.js:148` (the validation join) ·
`admin-set-pick.js:264` · `services/botPool.js:399` · `admin/get-bots.js` (`available_teams`)

**Reported counts that stop existing:** `remove-player`'s `allowed_teams_deleted`,
`delete-competition.js:148`, `delete-admin-competition.js:128`, `delete-account.js:96`. These are
in API response payloads — check the admin UI before removing the fields.

**Independent of all of it:** drop the four redundant indexes
(`idx_allowed_teams_comp_user`, `idx_allowed_teams_user`, `idx_allowed_teams_competition`, and one
of the identical pair). Zero risk, no code change, and worth doing even if the rest stalls.

---

## 6. Decisions

Decide these here, not in a route.

### Closed

- **The list always loops.** *Decided: no setting.* When a player exhausts every team they all come
  back, in every competition, for as many cycles as the competition runs. There is no "competition
  ends when teams run out" alternative and no cap on cycles. One rule, no extra column, and it is
  what two of the three current rebuild paths already do by accident. A setting can be layered on
  later without disturbing the derivation, so building one now would be speculative.

- **The response shape does not change.** *Decided.* The list stays `{team_id, name, short_name}`.
  A team is either pickable or absent, exactly as today — no `times_used`, no cycle indicator, even
  though the derivation has that information for free. This is what keeps
  `pick_remote_data_source.dart:54` and the web pick screen untouched by the whole migration.
  Revisit only if a competition actually reaches round 21 and players ask.

- **There are no late joiners.** *Decided: not a case.* Players never join mid-competition, and the
  public path enforces it. Per-player granularity still stands on missed picks alone — see §1.

### Open

1. **Nothing currently.** Add here rather than deciding in a component.

---

## 7. What lives where

| Path | Role |
|---|---|
| `services/allowedTeams.js` | **the derivation** — the single definition, and the boundary advance |
| `routes/get-allowed-teams.js` | the player's list, filtered to teams with a fixture this round |
| `routes/set-pick.js` | validates a pick against the derivation |
| `competition_user.teams_reset_round` | the only stored state |
| ~~`allowed_teams`~~ | dropped at step 4 |
| ~~`database.js` `populateAllowedTeams`~~ | deleted at step 4 — a second definition, unreferenced after |

---

## 8. Related

- `CLAUDE.md` → Competition Game Logic — the player rules this implements
- `docs/round-state-machine.md` — what a round is doing when picks are open
- `lmslocal-server/db/README.md` — the data landmines, including what `fixture.result` holds
