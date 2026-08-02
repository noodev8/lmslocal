# lmslocal-admin — internal admin tool

A separate Next.js frontend for platform administration, deployed to its own Vercel project on
its own URL. It has **no backend of its own** — it calls the existing Express server on port
3015 under the `/admin/*` namespace.

```
lmslocal-admin  (Vercel, admin URL)   ──┐
lmslocal-web    (Vercel, lmslocal.co.uk)├──►  Express :3015  ──►  PostgreSQL
lmslocal-flutter                        ──┘
```

## Why a separate frontend but a shared backend

The backend owns the database pool, the email service and the fixture service. Duplicating it
would mean fixing every bug twice, so admin routes live alongside the rest. The *frontend* is
split so admin UI never ships in the public JavaScript bundle and never sits on the customer
domain.

## Authentication

Admins sign in with their **normal LMSLocal account** — no separate password. What differs is
the door and the token:

| | Player app | Admin tool |
|---|---|---|
| Login route | `/login` | `/admin/admin-login` |
| Signing key | `JWT_SECRET` | `JWT_ADMIN_SECRET` |
| Scope claim | none | `scope: "admin"` |
| Expiry | 5 years | 12 hours (`ADMIN_TOKEN_EXPIRES_IN`) |
| localStorage key | `jwt_token` | `admin_jwt_token` |

`middleware/admin-auth.js` requires all three of: a valid signature under `JWT_ADMIN_SECRET`,
`scope === 'admin'`, and `app_user.is_admin = true` **checked live on every request**. That
last one means revoking admin takes effect immediately rather than when the token expires.

Because the two apps use different signing keys, a player token is rejected by `/admin/*` and
an admin token is rejected everywhere else.

Two deliberate choices worth not "fixing" later:

- **`MASTER_PASSWORD` does not work on `/admin/admin-login`.** It exists so support can sign in
  as any player during development. Honouring it here would make it a platform-wide backdoor.
- **A non-admin account with the correct password gets `INVALID_CREDENTIALS`**, identical to a
  wrong password. A distinct code would turn the login form into an oracle for "is this address
  an administrator". The attempt is logged as `ADMIN_LOGIN_DENIED_NOT_ADMIN`.

### Granting admin

```bash
cd lmslocal-server
node db/write.js "UPDATE app_user SET is_admin = true WHERE email = 'someone@example.com'"
```

## The rule for new admin routes

**Never add an admin bypass to an existing player route.** Those routes are secured by "you only
see competitions you belong to"; punching an `if (is_admin)` hole through that turns a scoping
bug into a data leak in the player app. Admin reads get their own routes under `routes/admin/`
with their own queries — `get-admin-stats.js` is the pattern to copy.

Bulk email, when it arrives, must go *through* the existing `email_preference` / unsubscribe
machinery rather than around it.

## Environment variables

Server (`lmslocal-server/.env`):

| Variable | Purpose |
|---|---|
| `JWT_ADMIN_SECRET` | Signing key for admin tokens. Must differ from `JWT_SECRET`. |
| `ADMIN_TOKEN_EXPIRES_IN` | Admin session length, default `12h`. |
| `CLIENT_URL` | Comma-separated CORS allowlist — must include the admin origin. |

Admin frontend (`lmslocal-admin/.env.local`, and Vercel project settings):

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | Express API base URL. Falls back to `http://localhost:3015`. |

## Running locally

```bash
cd lmslocal-server && npm run dev     # API on 3015
cd lmslocal-admin  && npm run dev     # admin UI on 3001
```

Port 3001 keeps it clear of `lmslocal-web` on 3000, and `http://localhost:3001` is already in
`CLIENT_URL`.

## Deploying

Unlike `lmslocal-web` (which deploys from the repo root — see `DEPLOY-VERCEL.md`), the admin
tool is its own Vercel project deployed **from inside its own directory**:

```bash
cd lmslocal-admin
vercel --prod
```

Leave Root Directory at the default in the Vercel dashboard. The repo-root `.vercelignore`
excludes `lmslocal-admin/` so the admin source is not uploaded on web deploys.

Live at **https://lmslocal-admin.vercel.app**.

Deployment is through Vercel's Git integration, with Root Directory set to `lmslocal-admin`.
Note that the repo-root `.vercelignore` applies to every project built from this repo — listing
an app directory there deletes it before the build and the deploy fails. See the comment at the
top of that file.

After the first deploy:

1. Set `NEXT_PUBLIC_API_URL` to `https://lmslocal.express.noodev8.com` in the Vercel project.
   It is **not** a secret — `NEXT_PUBLIC_*` values are inlined into the browser bundle, so
   marking it sensitive hides it from you and from nobody else. It is also read at *build*
   time, so setting it after a build requires a redeploy to take effect.
2. Append the admin URL to `CLIENT_URL` in the production server `.env`, or CORS blocks every
   request:
   `CLIENT_URL=https://lmslocal.co.uk,https://lmslocal-admin.vercel.app`
   No trailing slash — the check is an exact match against the browser's `Origin` header. A
   rejected origin returns HTTP 500 with no CORS headers, which surfaces in the browser as a
   generic network failure rather than anything mentioning CORS.
3. Set `JWT_ADMIN_SECRET` in the production server environment — it is not shared with `.env`
   on your machine, and must differ from `JWT_SECRET`.

The app sends `X-Robots-Tag: noindex, nofollow, noarchive` on every route plus a matching
`robots` meta tag. Treat the URL as public anyway — deployment URLs surface in certificate
transparency logs. Vercel's Deployment Protection is worth enabling as a second gate.

## Current surface

| Route | Method | Purpose |
|---|---|---|
| `/admin/admin-login` | POST | Exchange email + password for an admin token |
| `/admin/get-admin-stats` | GET | Platform-wide counts for the dashboard |
| `/admin/get-admin-competitions` | GET | Every competition, with organiser, players, opt-in state |
| `/admin/delete-admin-competition` | POST | Delete a competition and everything attached to it |
| `/admin/impersonate-organiser` | POST | Short-lived player token for "View as organiser" |
| `/admin/set-fixture-service` | POST | Opt a competition in or out of the fixture service |
| `/admin/get-fixture-team-lists` | GET | Active team lists and their teams, for fixture entry |
| `/admin/add-staged-fixtures` | POST | Stage a gameweek of fixtures |
| `/admin/get-staged-results` | GET | The oldest staged gameweek still missing results |
| `/admin/set-staged-result` | POST | Record one fixture's outcome |
| `/admin/push-fixtures-to-competitions` | POST | Distribute staged fixtures as rounds |
| `/admin/push-results-to-competitions` | POST | Distribute staged results and process eliminations |

Pages: `/login`, `/dashboard`, `/dashboard/competitions`, `/dashboard/fixtures`.

Not built yet: inactive-competition actions, bulk email.

## Fixtures

`/dashboard/fixtures` replaced the `/admin-fixtures` and `/admin-results` pages in
`lmslocal-web`, which were gated by the hardcoded access code `12221` and, worse, shipped the
push secret `BOT_MAGIC_2025` inside the public JavaScript bundle — anyone who read the site's
source could create rounds and process eliminations across every subscribed competition. Both
pages and all three `12221` routes are deleted; the push routes now require an admin token.

`bot-join` and `bot-pick` still accept `BOT_MAGIC_2025`. They are a separate feature and were
left alone.

The model the screen is built around, which is worth understanding before changing it:

```
one submission  ->  one gameweek  ->  one round in each subscribed competition
```

Every fixture in a batch shares a single kickoff time, and that time becomes the round's lock
time. So a real football gameweek spread across Friday to Sunday is entered as several batches,
each becoming its own round with its own deadline. Every round in the database looks like this —
one distinct kickoff, one gameweek. Do not "fix" this into per-fixture kickoff times without
deciding what a round's lock time should then be.

Two things that catch people out:

- **Nothing receives a push unless `competition.fixture_service` is true**, and it is false by
  default (`create-competition` hardcodes it). The fixtures screen names the competitions a push
  will reach, and says so plainly when that list is empty.
- **`gameweek` is `MAX(gameweek) + 1` per team list and never resets per season.** Emptying
  `fixture_load` is what takes it back to 1. That was done in Aug 2026 to clear 20 rows staged in
  Oct 2025, ten of which had no results and sat permanently at the front of the results queue
  because the gameweek had never been pushed to a competition. The results screen now flags that
  state rather than silently jamming.
