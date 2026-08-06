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
| `/admin/get-admin-organisers` | GET | Every organiser, with contact details, reach and spend |
| `/admin/delete-admin-competition` | POST | Delete a competition and everything attached to it |
| `/admin/impersonate-organiser` | POST | Short-lived player token for "View as organiser" |
| `/admin/set-fixture-service` | POST | Opt a competition in or out of the fixture service |
| `/admin/get-fixture-team-lists` | GET | Active team lists and their teams, for fixture entry |
| `/admin/add-staged-fixtures` | POST | Stage a batch of fixtures (refused if one is already pending) |
| `/admin/get-staged-results` | GET | The currently staged batch, resulted or not |
| `/admin/set-staged-result` | POST | Record one fixture's outcome |
| `/admin/get-fixture-push-targets` | GET | Competitions that may receive the staged batch, each with a verdict and, if blocked, the reason |
| `/admin/push-fixtures-to-competition` | POST | Create a round from the staged batch, **one competition per call** |
| `/admin/get-push-targets` | GET | Competitions waiting on the staged batch's results, with player and fixture counts |
| `/admin/push-results-to-competition` | POST | Distribute staged results and process eliminations, **one competition per call** |
| `/admin/clear-staged-batch` | POST | Empty `fixture_load` once every competition has been pushed |
| `/admin/get-bots` | GET | Bot pool, eligible competitions, and one competition's bots and picks |
| `/admin/create-bots` | POST | Add new bots to the shared pool |
| `/admin/add-bots-to-competition` | POST | Put bots into a competition |
| `/admin/remove-bot-from-competition` | POST | Take one bot out and delete its history there |
| `/admin/set-bot-picks` | POST | Random picks for bots that have not picked this round |
| `/admin/set-bot-pick` | POST | Set or clear one bot's pick |

Pages: `/login`, `/dashboard`, `/dashboard/competitions`, `/dashboard/organisers`,
`/dashboard/fixtures`, `/dashboard/bots`. `/dashboard` is the landing page and is a read-only
snapshot — four headline numbers and four breakdown panels. The work happens on the other four,
which the header's nav row moves between.

Not built yet: inactive-competition actions, bulk email.

## Organisers

`/dashboard/organisers` is the people view of the same data the competitions screen shows: one
row per organiser, built for one-to-one outreach — a name, an address with copy and `mailto:`
buttons, and enough context to decide who is worth contacting.

**An organiser owns at least one competition.** Someone who only helps run another person's
competition (the permission flags on `competition_user`) does not appear. If that ever needs to
change, it changes in one place: the `EXISTS` clause in `get-admin-organisers.js`.

Two counts are easy to misread, and both are deliberate:

- **Players** counts `competition_user` rows, exactly as the competitions screen does, so an
  organiser's number is the sum of their competitions' numbers one click away. Keep it that way —
  the first thing anyone does with two screens showing the same data is check they agree.
  It includes the organiser, who joins their own competition on creating it, so a competition
  nobody has joined reads 1 rather than 0. A second line appears under the total with the
  deduplicated count, but only for organisers where someone plays in two of their competitions
  and the two figures actually differ.
- **Spend** is `SUM(credit_purchases.paid_amount)`, never `app_user.paid_credit`. Credit can be
  granted without money changing hands, so only a purchase makes someone a customer. The balance
  is carried separately and shown in the badge's tooltip.

The tiles filter the list: Paying, Running, New (signed up within 30 days) and **Gone quiet** —
an organiser with an active competition that has had no pick for 30 days, which is the one tile
that means "do something".

The two screens cross-link: an organiser's competition count and the trophy action open
`/dashboard/competitions?organiser=<id>`, and an organiser's name on the competitions screen
opens `/dashboard/organisers?q=<email>`. `?q=` seeds the search box rather than locking a filter,
so it can be typed away.

## Fixtures

`/dashboard/fixtures` replaced the `/admin-fixtures` and `/admin-results` pages in
`lmslocal-web`, which were gated by the hardcoded access code `12221` and, worse, shipped the
push secret `BOT_MAGIC_2025` inside the public JavaScript bundle — anyone who read the site's
source could create rounds and process eliminations across every subscribed competition. Both
pages and all three `12221` routes are deleted; the push routes now require an admin token.

`bot-join` and `bot-pick` were the last two routes carrying `BOT_MAGIC_2025`. They have since
been deleted too, replaced by the Bots screen below, so the string no longer appears anywhere in
the codebase.

The model the screen is built around, which is worth understanding before changing it:

```
only one staged batch at a time per team list  ->  one round in each subscribed competition
```

`fixture_load` itself is the pending batch. `add-staged-fixtures` refuses to stage a new one
while the table already has rows for that team list; the table only empties again when the admin
presses **Clear staged batch** on the results tab. That is a deliberate step rather than a side
effect of the push, because results now go out one competition at a time and the staged rows
must survive until the last competition has taken them. Every fixture in a batch
shares a single kickoff time, and that time becomes the round's lock time. So a real football
gameweek spread across Friday to Sunday is entered as several batches, each becoming its own
round with its own deadline. Do not "fix" this into per-fixture kickoff times without deciding
what a round's lock time should then be.

Two things that catch people out:

- **Nothing receives a push unless `competition.fixture_service` is true**, and it is false by
  default (`create-competition` hardcodes it). The fixtures screen names the competitions a push
  will reach, and says so plainly when that list is empty.
- **A push names its competition. There is no push-all.** Both tabs list the competitions one per
  row with their own button, so a mis-staged batch can reach at most the one you pressed. This
  replaced a single "Push fixtures" button whose only guard was `FIXTURE_SERVICE_TEST_MODE`, an
  env var naming one organiser — which had to be remembered on and off, and starved real
  customers of fixtures whenever it was left on. The variable is gone; do not reintroduce either
  it or a push-all button without deciding what protects customers instead.

  Rows that cannot take the batch are listed greyed with the reason rather than hidden — a
  competition silently missing from the list looks like a bug, and the eligibility rules
  (`services/fixtureService.js`, and the readiness floors in CLAUDE.md) are shared with the push
  itself, so the screen can never offer a button the server then refuses.

## Bots

`/dashboard/bots` puts placeholder players into a competition so it is not empty when a real
player joins, and keeps them picking each round. It replaces driving the old `/bot-join` and
`/bot-pick` routes by hand with curl.

Bots are only offered for competitions run by an organiser in `BOT_ORGANISER_IDS`
(`lmslocal-server/services/botPool.js`) — currently just organiser 50. Every bot route enforces
it, returning `COMPETITION_NOT_ELIGIBLE` for anything else.

That restriction is about money, and it is the reason the feature is shaped this way:

- `competition_user` rows are counted against the organiser's free player allowance in six
  places, with no exclusion for bots. A bot uses up one of the 20 free places exactly like a
  person, and past that it costs the organiser a credit.
- `get-competition-by-code` answers `FULL` and turns real players away once an organiser is at
  the limit with no credit left.

So seeding a customer's competition would spend their money and could lock their own players
out. Confining bots to our accounts is what makes the feature safe without putting a bot
exclusion into live billing code. Adding an id to that list is a decision about someone's credit
balance, not a config tweak.

Two smaller decisions worth keeping:

- **Removal is not `remove-player`.** That route refunds a credit on the assumption one was
  spent getting the player in (`remove-player.js:189`). Nothing charges on the way in for a bot,
  so reusing it would mint credit out of nothing, once per removal.
- **A bot is not a special case of a player.** Picking runs the same two checks `set-pick.js`
  runs on a human — `TEAM_NOT_ALLOWED` against `allowed_teams`, then `TEAM_ALREADY_USED` against
  previous picks — and writes `allowed_teams` back the same way. The auto-reset that
  `get-allowed-teams.js` performs when a player's set is empty now lives in
  `services/allowedTeams.js` and is shared by both, because bots never open the pick screen and
  so never got it. That gap was visible in the data: competition 199's two oldest bots sat on
  zero `allowed_teams` rows while the humans beside them were correct.

Full walkthrough: `docs/BOTS-Management.md`.
