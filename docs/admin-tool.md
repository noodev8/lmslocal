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

After the first deploy:

1. Set `NEXT_PUBLIC_API_URL` in the Vercel project to the production API URL.
2. Add the admin's Vercel URL to `CLIENT_URL` on the server, or CORS will block every request.
3. Set `JWT_ADMIN_SECRET` in the production server environment — it is not shared with `.env`
   on your machine.

The app sends `X-Robots-Tag: noindex, nofollow, noarchive` on every route plus a matching
`robots` meta tag. Treat the URL as public anyway — deployment URLs surface in certificate
transparency logs. Vercel's Deployment Protection is worth enabling as a second gate.

## Current surface

| Route | Method | Purpose |
|---|---|---|
| `/admin/admin-login` | POST | Exchange email + password for an admin token |
| `/admin/get-admin-stats` | GET | Platform-wide counts for the dashboard |

Pages: `/login`, `/dashboard`.

Not built yet: fixture management, competition drill-down, inactive-competition actions, bulk
email. The existing `/admin-fixtures` and `/admin-results` pages in `lmslocal-web` (gated by the
hardcoded access code `12221`) should move here and be deleted from the public app.
