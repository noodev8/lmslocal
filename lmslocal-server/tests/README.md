# tests

There is no test framework here. These are standalone scripts you run by hand,
written because a change to a live production route needed to be *proved*
harmless rather than argued to be.

Run them from `lmslocal-server/`.

## capture-dashboard.js — equivalence harness

Captures the full JSON response of `/get-user-dashboard` for seven users chosen
to cover the route's branches, so a refactor can be shown to change nothing.

```bash
# terminal 1 — a port that is not your dev server
PORT=3016 node server.js

# terminal 2
node tests/capture-dashboard.js baseline    # before your change
# ... make the change, restart the server ...
node tests/capture-dashboard.js after
node tests/compare.js baseline after
```

`compare.js` exits non-zero if anything differs.

**Before you capture, check the route will not mutate anything.**
`get-user-dashboard` clears a competition's `invite_code` once Round 1 has
locked. If any competition is eligible, the first run will change data and the
second will not — and the diff becomes meaningless:

```bash
node db/query.js "SELECT c.id, r1.lock_time <= NOW() AS would_be_cleared
                  FROM competition c
                  JOIN round r1 ON r1.competition_id = c.id AND r1.round_number = 1
                  WHERE c.invite_code IS NOT NULL"
```

Every row must read `false`.

**The user ids are hardcoded and will rot.** They were picked against live data
to hit organiser, participant, both, `ACTIVE`, `COMPLETE`, and nobody-at-all. If
the data moves on, re-pick them — a diff of two empty responses proves nothing,
which is why both scripts print the history row count.

Captures are written to `tests/captures/` and git-ignored.

## cache-bound-test.js — auth cache bounding

Self-contained, no server or database needed:

```bash
node tests/cache-bound-test.js
```

Reproduces the old and new `middleware/auth.js` cache eviction side by side
under the workload that broke the old one — more distinct users than
`MAX_CACHE_SIZE`, all inside one TTL window. The old implementation grows
without bound; the new one caps. Exits non-zero on failure.

Keep it in step with `middleware/auth.js` if that eviction logic changes — it
copies the implementation rather than importing it, because the cache is module
private.
