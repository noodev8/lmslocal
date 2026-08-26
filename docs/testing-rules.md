# Testing rules

**Read this before writing anything to the database.** There is no staging copy — development
connects straight to `lmslocal_prod`, the database the live site is using right now. Every other
competition in it belongs to a real person whose players are mid-competition.

For *how* to query and write safely (the read-only guard, `--dry-run`, the no-WHERE guard), see
`lmslocal-server/db/README.md`. This document is the other half: **what you are allowed to touch.**

---

## The rule

> Write only to data you have been given. Everything else is read-only, no matter how convenient
> it would be.

Reads are always fine. It is writes — and anything that triggers a write, including hitting an
API route — that this is about.

## The sandbox

**Organiser 50** — `aandreou25@gmail.com`, display name Andreas — is the only stable fact here,
and the only account bots may be used under. Everything else about the sandbox changes.

> **No competition id is written down in this doc on purpose. Ask which one to test against.**

Andreas creates a competition to test a particular phase, works through it, and **deletes it**, so
the sandbox is a different competition week to week and often a different one by the end of a
session. Any id in a doc, a memory, a commit message or an earlier part of the conversation is a
guess about the past. Competition 199 was named as the long-lived sandbox throughout the older
docs and no longer exists — it was deleted, not renamed. **206 replaced it and will go the same
way.**

So the sequence at the start of any session that needs to write:

1. **Ask.** "Which competition should I test against?" One line, and it settles it.
2. Look it up **by the name he gives**, never by a remembered id:

   ```bash
   node db/query.js "SELECT id, name, status FROM competition WHERE organiser_id = 50 ORDER BY id"
   ```

3. If the name isn't in that result, **stop and ask again** — a competition of that name under a
   different organiser is a customer's, not a near-miss.

**Organiser 50 is necessary, never sufficient.** He also owns competitions that are *not* for
testing — competition 200 was one as of 10 Aug 2026 — so the ownership check passing does not make
a competition safe. Only his answer does.

**If he hasn't said and isn't around, do the read-only part and stop.** A blocked write reported
honestly costs a message; the wrong competition costs a customer's game.

## Everything else

Every other competition and account belongs to a customer. Do not write to them — not to fix
something that looks broken, not to set up a test, not "just this one row".

If a test genuinely needs a second competition, **ask and name it.** Permission is per
competition and per session; being allowed to touch something last week is not permission to
touch it today.

Deletion is the one to be most careful about: `delete-admin-competition` and `remove-player`
take a competition or player apart across seven tables and there is no undo.

## Check ownership before you touch

Competition ids are close together and easy to fat-finger — 200 is a keystroke from 206 and is
Andreas's but not a sandbox, and 170 belongs to a customer with 18 players in it. Before any
write aimed at a specific competition:

```bash
node db/query.js "SELECT c.id, c.name, c.organiser_id, u.email
                  FROM competition c JOIN app_user u ON u.id = c.organiser_id
                  WHERE c.id = <id>"
```

If `organiser_id` is not 50, stop. If it is 50 but the name is not the competition Andreas named
in this session, stop as well.

## Leave it as you found it

Even inside the sandbox, capture the state you are about to change and put it back when the test
is done, unless the change was the point. Two things make this easy to get wrong:

- **A route can restore more than it removed.** Clearing a bot's pick puts the team back into
  `allowed_teams` — correct behaviour, but if the row was missing beforehand you have now added
  one. Count rows before and after, not just the ones you meant to change.
- **Fixing broken data is not the same as restoring it.** Competition 199's two oldest bots had
  zero `allowed_teams` rows; the fix left them correct rather than back at zero. That is the
  right call, but say so rather than quietly reporting "restored to baseline".

## The testing account: user 1088, "Claude (test)"

Sign admin tokens as **1088**, not as 50. Both work, but `audit_log` records whichever id the
token carries — signing as 50 makes test writes indistinguishable from Andreas's real ones.
With 1088 the trail reads:

```
Bots Added  | 1088 | Claude (test) | 1 bot(s) added by admin: Bot George
Bot Removed |   50 | Andreas       | Bot Paula removed by admin
```

| | |
|---|---|
| id | 1088 |
| email | `claude@lmslocal.invalid` |
| display name | Claude (test) |
| `is_admin` | true |

The address is deliberately its own thing rather than a `@lms-guest.com` one. Both delete routes
run `DELETE FROM app_user WHERE email LIKE '%@lms-guest.com' AND email NOT LIKE 'bot_%'` when a
competition is removed, which is exactly the set a `claude@lms-guest.com` would have fallen into
— the only reason it survived was having no membership row for the delete to join through.

`.invalid` is reserved by RFC 2606 and can never resolve, so an accidental send fails at DNS
rather than reaching anyone. It is not covered by the `@lms-guest.com` suppression that keeps
email away from guests and bots, so **do not add this account to a competition as a player** —
it is an admin identity, nothing more.

**It has no usable password.** `password_hash` is a bcrypt hash of 32 random bytes that was
never recorded, so nobody can sign in as it — including whoever is reading this. It exists only
as an identity for tokens minted from `JWT_ADMIN_SECRET`.

**Ad-hoc cleanup is the main thing that threatens it.** It belongs to no competition, so any
"delete users with no memberships" sweep takes it. `is_admin = true` is the reliable guard —
only account 50 and this one have it. `db/README.md` carries the same warning next to where that
SQL gets written. Searching for `claude` in `email` or `display_name` finds it.

Revoke it any time with:

```bash
node db/write.js "UPDATE app_user SET is_admin = false WHERE id = 1088"
```

## Getting authenticated without a password

No password needs to be written down anywhere for testing.

- **Admin routes** (`/admin/*`): mint a token locally with the server's own helper, signed with
  `JWT_ADMIN_SECRET` from `.env`:

  ```bash
  node -e "require('dotenv').config();
    const { signAdminToken } = require('./middleware/admin-auth');
    console.log(signAdminToken({ id: 1088, email: 'claude@lmslocal.invalid', display_name: 'Claude (test)' }));"
  ```

  `admin-login` deliberately ignores `MASTER_PASSWORD` (see `routes/admin/admin-login.js`), so
  this is the way in.

- **Player routes**: `MASTER_PASSWORD` in `.env` logs in as any user via `/login`.

Neither value belongs in a document, a commit, or a comment. `.env` is gitignored; keep it that
way. Note that anyone able to read `.env` can already mint a token as any user — the testing
account does not widen that, it only makes the audit trail honest about who did what.

## Email

`services/emailService.js:19` currently overrides the recipient on **every** send:

```js
emailData.to = ['aandreou25@gmail.com']; // ⚠️ COMMENT OUT THIS LINE FOR PRODUCTION
```

So no customer can currently receive email, and email flows are safe to exercise. **Check that
line is still there before testing anything that sends** — the day it is removed, triggering a
pick reminder against a customer competition mails their players for real.

## Bots

Bots are already fenced in code: `BOT_ORGANISER_IDS` in `services/botPool.js` limits them to
organiser 50, and every bot route refuses anything else with `COMPETITION_NOT_ELIGIBLE`. Adding
an id to that list puts fake entrants into a real person's competition — see
`docs/BOTS-Management.md`.

Bots are the preferred way to create test players. They are free to add and remove, they never
receive email, and they are obviously not real people to anyone looking at the standings.

**A bot costs no credit and consumes no free place, anywhere in the system** — see
`docs/reset-billing.md` §4. So a bot-filled competition is not a way to test anything about
billing: to the counting queries those players are not there at all.

## When something needs more than the sandbox

Say what you need and why, and wait. A blocked test reported honestly is worth more than a test
that ran because it borrowed a customer's competition.
