# db/ — querying the LMSLocal database

The front door for reading and writing `lmslocal_prod`. **Start here** rather than looking for
an MCP server; there isn't one, and there is no need for one (see "Why no MCP" below).

- **Read** → `node db/query.js "SELECT ..."`
- **Write** → `node db/write.js "UPDATE ..."`

Run them from `lmslocal-server/` (they read that directory's `.env` and its `node_modules`, so
no extra install is needed). Paths below assume that working directory.

> ⚠️ This is the **LIVE production database** — the one the running site uses. Reads are safe;
> writes touch real competitions that real players are in.

This file covers *how* to query and write safely. For *what you are allowed to touch* — the
sandbox competition, and the rule for everything else — see `docs/testing-rules.md`.

## Ad-hoc queries

```bash
node db/query.js "SELECT count(*) FROM competition"
node db/query.js --file some_report.sql
node db/query.js --csv "SELECT id, name, status FROM competition" > out.csv
echo "SELECT 1" | node db/query.js
```

- Runs inside a **READ ONLY transaction**. An UPDATE/DELETE/DROP fails with
  `cannot execute UPDATE in a read-only transaction` and exits non-zero. This is a guard
  against accidents, not a security boundary — the credentials in `.env` can still write, so
  anything that genuinely needs to write must not route through here.
- Prints the first `--max-rows` rows (default 200) and tells you on stderr when it truncated.
  `--max-rows 0` for everything.
- Credentials come from `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` in
  `lmslocal-server/.env` — the same values `database.js` uses.

**This is for interactive lookups.** Anything scheduled or repeated should be its own script in
`scripts/`, connecting through `database.js` like the rest of the server.

## Writing

Writes go through `write.js` so every one happens the same way:

```bash
node db/write.js "UPDATE competition SET status='SETUP' WHERE id=42"
node db/write.js --dry-run "DELETE FROM pick WHERE round_id=101"
node db/write.js --file migration.sql
```

- Everything in one invocation runs in **one transaction** — all statements commit together, or
  all roll back if any fails. A failed run changes nothing.
- Reports the row count per statement and a total, so you can see what you touched.
- `--dry-run` executes for real, prints the counts, then rolls back. Worth doing first when the
  WHERE clause is doing heavy lifting.
- **The one guard:** an `UPDATE` or `DELETE` with no `WHERE` is refused (exit 2) unless you pass
  `--all-rows`. That is the mistake worth catching; nothing else is in the way.

Sensible habit, not a rule: `query.js` the SELECT version of your WHERE clause first, check the
count is what you expect, then run the write.

Because this is the live DB, prefer a targeted WHERE over a broad one, and think about whether
an API route already owns the table you are about to change — game state (`pick`,
`player_progress`, `allowed_teams`, `competition_user.lives_remaining`) is written by route
logic that also writes `audit_log`. A hand-written UPDATE bypasses that.

### Two accounts to spare when tidying `app_user`

Ad-hoc cleanup is the main thing that threatens these, because both look disposable:

| id | | Why it looks deletable |
|---|---|---|
| 50 | `aandreou25@gmail.com` | — the owner account, obviously keep |
| 1088 | `claude@lmslocal.invalid`, "Claude (test)" | **belongs to no competition at all**, so any "delete users with no memberships" sweep takes it |

1088 is the identity admin tokens are signed as during testing, so that `audit_log` can tell test
writes from real ones (`docs/testing-rules.md`). It is cheap to recreate but the audit trail
stops making sense without it. Both carry `is_admin = true` and nothing else does, so the
simplest guard on any account cleanup is:

```sql
AND is_admin = false
```

Searching for `claude` in either `email` or `display_name` finds 1088.

## Finding your way around the schema

There is no schema doc — it would rot. There used to be a `pg_dump` at `docs/DB-Schema.sql`; it
was removed in Aug 2026 once these scripts existed, because a checked-in copy is only ever as
good as the last person who remembered to refresh it. Ask the database instead — it is never
out of date:

```bash
# tables, with rough row counts and no full scan
node db/query.js "SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup DESC"

# columns of one table
node db/query.js "SELECT column_name, data_type, is_nullable FROM information_schema.columns
                  WHERE table_name='competition' ORDER BY ordinal_position"
```

## Key tables

| table | what it holds |
|-------|---------------|
| `app_user` | user accounts — **not `users`** |
| `competition` | competition definitions and settings |
| `competition_user` | membership: lives remaining, status, admin permission flags |
| `round` | rounds within a competition, with `lock_time` |
| `fixture` | fixtures within a round, with `result` |
| `pick` | one row per player per round — the team they chose |
| `player_progress` | per-round outcome per player, **including no-pick eliminations** |
| `allowed_teams` | teams a player may still use (no-team-twice rule) |
| `team` / `team_list` | master team list per competition type |
| `fixture_load` | staging table the fixture service pushes from |
| `audit_log` | system audit trail — written by route logic, not by hand |
| `email_queue` / `email_tracking` / `email_preference` | outbound email pipeline |

## Gotchas that will cost you an hour

**`competition.status` is uppercase — `'SETUP'`, `'ACTIVE'`, `'COMPLETE'`.** It was not always:
production carried a mix, because `get-user-dashboard` wrote `'active'` in lower case while
everything else wrote upper. The code and the data were normalised on 2026-08-04. Some admin
routes still wrap the column in `LOWER()`; that is harmless and left in place deliberately, so
do not read it as evidence the inconsistency is back.

`competition_user.status` is a **different column** and is lowercase (`'active'`, `'out'`).
That one is correct as it is — do not "fix" it to match.

**`fixture.result` holds the winning team's short code, not a home/away marker.** Values are a
`team.short_name` (e.g. `'ARS'`), or the literal `'DRAW'`, or NULL when the fixture has not been
resulted yet. NULL means unplayed — it does not mean a draw.

**`pick` and `player_progress` name the same things differently.** `pick.user_id` /
`pick.team` versus `player_progress.player_id` / `player_progress.chosen_team`. Joining them on
`user_id = user_id` silently returns nothing.

**`player_progress` has more rows than `pick`, by design.** A player who missed the deadline
gets a `player_progress` row with `outcome='LOSE'` and no `pick` row at all (119 such rows as of
Aug 2026). Counting eliminations from `pick` alone undercounts. Conversely `pick.outcome` can be
NULL — the round is not resulted yet.

**Fixtures and results are pushed, not entered.** They arrive via the `fixture_load` staging
table and `/admin/push-fixtures-to-competitions` / `/admin/push-results-to-competition`
(**singular — one competition per call**), driven from `/dashboard/fixtures` in the admin tool.
Editing `fixture` rows by hand puts the DB out of step with what the push APIs will do next.

**Only competitions with `fixture_service = true` receive pushes,** and nothing has it on by
default — `create-competition` hardcodes false. If a competition mysteriously never gets a new
round, check that flag first. It is toggled from the admin competitions list; there is no need
to write it by hand any more.

**`fixture_load` only ever holds one pending batch per team list.** Non-empty means something is
staged and awaiting results/push; `add-staged-fixtures` refuses a new batch until it's empty
again. **It no longer empties itself.** Results are pushed one competition at a time, so the
staged rows have to survive until the last competition has taken them — the admin clears the
batch explicitly via `/admin/clear-staged-batch`. A non-empty table therefore means either
"still being pushed" or "finished but not yet cleared"; `/admin/get-push-targets` tells you
which.

**Timestamps are `timestamptz`,** so they come back as JS `Date` objects in local time (BST in
summer). Cast to text in SQL if you want the stored UTC value verbatim.

## Housekeeping: pruning `audit_log`

**Retention is 12 months, applied by hand.** There is no cron job and no script — this is rare
enough, and destructive enough, to be worth a person looking at the numbers first.

Check what would go before removing anything:

```bash
# from lmslocal-server/
node db/query.js "SELECT count(*) AS total,
                         count(*) FILTER (WHERE created_at < NOW() - INTERVAL '12 months') AS expiring,
                         min(created_at) AS oldest
                    FROM audit_log"

node db/write.js --dry-run "DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '12 months'"
node db/write.js           "DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '12 months'"
```

Three things make this safe and low-priority:

- **Nothing reads the table.** Around 25 routes write to it; the only reads anywhere are in
  `delete-account.js`, which counts rows for a deletion summary and deletes a user's own rows
  for GDPR erasure. No screen in the player app, the admin tool or the Flutter app surfaces
  audit history, so pruning cannot break a page. It is a forensic record you query by hand.
- **It is small.** 2,851 rows and 696 kB as of Aug 2026, growing around 240 rows a month.
- **Nothing has expired yet.** The oldest entry is 22 Sep 2025, so the first rows do not reach
  12 months until roughly **22 Sep 2026**. Running the delete before then removes zero rows.

### The orphans are a separate question

About 1,264 rows (44% of the table) reference competitions that no longer exist — 86 of them.
`delete-admin-competition` and `delete-competition` deliberately leave audit history behind, on
the grounds that a trail which vanishes with the thing it describes is not much of a trail.

Age-based retention will not touch these for a long time, because most are recent. Removing them
is a different rule and a different decision:

```bash
node db/write.js --dry-run "DELETE FROM audit_log a
                             WHERE a.competition_id IS NOT NULL
                               AND NOT EXISTS (SELECT 1 FROM competition c WHERE c.id = a.competition_id)"
```

Deliberately not done. Decide it on purpose rather than as a side effect of tidying by date.

## Why no MCP

There is no Postgres MCP server configured for this project, and that is the intended state, not
a fault. These scripts do the same job, work outside an interactive Claude Code session (on the
VPS, under cron), and need no per-machine config file. The same decision was taken in the
`bcweb` / `scripts` repos in Jul 2026 — see `C:\bcweb\docs\postgres-mcp-setup.md` for the
reasoning and the install steps should they ever be wanted.

**Do not set up an MCP server without asking Andreas first.**

If the scripts are unavailable for some reason, `psql` works with the same `.env` credentials.
Read them from `.env` rather than typing them — **this repo is public, so no host, username or
password belongs in a tracked file**:

```bash
# from lmslocal-server/
set -a; . ./.env; set +a
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" -c "SELECT 1"
```
