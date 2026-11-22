# The database: how to touch it, and what you may touch

There is **no staging copy**. Development connects straight to `lmslocal_prod`, the database the
live site is using. Every competition in it belongs to a real organiser whose players may be
mid-game. Reads are always fine; writes — and anything that triggers one, including calling an
API route — are what this file is about.

## The scripts

Run from `lmslocal-server/` (they read its `.env`). There is deliberately no MCP server — do not
set one up without asking Andreas.

```bash
node db/query.js "SELECT ..."                 # READ ONLY transaction; --csv, --file, --max-rows N
node db/write.js "UPDATE ... WHERE ..."       # one transaction, row counts per statement
node db/write.js --dry-run "DELETE ..."       # runs, prints counts, rolls back
```

`write.js` refuses an `UPDATE`/`DELETE` with no `WHERE` unless given `--all-rows`. Game state
(`pick`, `player_progress`, `competition_user.lives_remaining`) is written by routes that also
write `audit_log`; a hand-written UPDATE bypasses that, so prefer the route.

There is no schema file. Ask the database:

```bash
node db/query.js "SELECT column_name, data_type, is_nullable FROM information_schema.columns
                  WHERE table_name='competition' ORDER BY ordinal_position"
```

## What you may write to

> Write only to data you have been given in this session. Everything else is read-only.

- **Ask which competition to test against.** Never reuse an id from a doc, a memory, a commit or
  an earlier session — Andreas creates a test competition, uses it and deletes it. Look it up by
  the name he gives:
  `node db/query.js "SELECT id, name, status FROM competition WHERE organiser_id = 50 ORDER BY id"`.
- **Organiser 50 (Andreas) is necessary, never sufficient.** He also owns real competitions. If
  the name is not the one he gave this session, stop. If he has not said, do the read-only part
  and stop.
- Before any targeted write, confirm `organiser_id` and name for that id — ids are close together
  and customers' competitions sit a keystroke away.
- Permission is per competition, per session. Deletion routes (`delete-admin-competition`,
  `remove-player`) take things apart across many tables with no undo.
- Leave the sandbox as you found it unless the change was the point; count rows before and after.

## Email is live

Every send goes through `deliver()` in `services/emailService.js`. Test mode is a per-send option
(redirects to `EMAIL_TEST_RECIPIENT`), not a global switch — **anything that triggers a send
against a customer's competition mails real people.**

## Testing identity and auth

- **User 1088, "Claude (test)", `claude@lmslocal.invalid`, `is_admin = true`, no usable
  password.** Sign admin tokens as 1088, not 50, so `audit_log` can tell test writes from real
  ones. Never add it to a competition as a player. Any `app_user` cleanup must spare it and 50 —
  add `AND is_admin = false`.
- Admin token (`admin-login` ignores `MASTER_PASSWORD`):
  ```bash
  node -e "require('dotenv').config(); const { signAdminToken } = require('./middleware/admin-auth');
    console.log(signAdminToken({ id: 1088, email: 'claude@lmslocal.invalid', display_name: 'Claude (test)' }));"
  ```
- Player routes: `MASTER_PASSWORD` in `.env` logs in as any user via `/login`.
- No password, host or credential belongs in a tracked file — this repo is public.

## Test players and rounds

- **Bots** are the preferred test players (`BOT_ORGANISER_IDS` in `services/botPool.js` limits
  them to organiser 50). They are never chargeable, so they cannot test billing. They play LMS
  only — test Matchday with real accounts.
- **Play rounds with `scripts/sandbox-round.js`**, never the calendar or Stage — those are shared
  by every customer on the team list. It only touches a competition owned by 50 **and** named
  `TEST` or `TEST ...` — except a Matchday competition while Matchday is in preview, which needs
  no name, since only 50 can create one then. It settles results through the real `/admin/push-results-to-competition`, and
  uses odd-second kickoffs so test rounds never appear in the live Results push. A competition
  created through the wizard starts on the live calendar — run `adopt` first. Usage is in the
  script header. Delete test competitions when done.

## Gotchas

- `app_user`, not `users`. Table names are singular.
- `competition.game_type` is `'lms'` or `'matchday'`. Matchday has no picks, lives or
  `player_progress` — its choices are `prediction` rows and totals are derived
  (`services/matchdayTable.js`). Filter `game_type = 'lms'` before reading LMS figures.
- `competition.status` is uppercase (`SETUP`, `ACTIVE`, `COMPLETE`); `competition_user.status` is
  a different column and lowercase (`active`, `out`). Both are correct.
- `fixture.result` is the winning team's `short_name` or `'DRAW'`; NULL means not yet resulted.
- `pick.user_id` / `pick.team` vs `player_progress.player_id` / `player_progress.chosen_team`.
- `player_progress` has more rows than `pick` by design: a missed pick is a `LOSE` progress row
  with no `pick`. Count eliminations from `player_progress`.
- What a player may still pick is derived (`services/allowedTeams.js`); the only stored state is
  `competition_user.teams_reset_round`.
- Fixtures and results arrive through `fixture_load` and the admin push; editing `fixture` rows by
  hand puts a competition out of step with the next push.
- Timestamps are `timestamptz` and come back as JS `Date`s in local time; cast to text for UTC.
- `audit_log` is written by ~25 routes and read by nothing but `delete-account.js`. Retention is
  12 months, pruned by hand. Rows for deleted competitions are kept on purpose.
