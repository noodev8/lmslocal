# CLAUDE.md

LMSLocal runs football prediction competitions for pub landlords, workplaces and clubs.
Admin-first: an organiser sets a competition up and runs it against real fixtures. Two game
types: **Last Man Standing** (`game_type = 'lms'`) and **Matchday** (`'matchday'`, in preview).

## Repo

| Folder | What | Port |
|---|---|---|
| `lmslocal-server/` | Node + Express + PostgreSQL API | 3015 |
| `lmslocal-web/` | Next.js 15 / React 19 / TypeScript strict / Tailwind — players and organisers | 3000 |
| `lmslocal-admin/` | Next.js admin tool; no backend of its own, calls `/admin/*` on the server | 3001 |
| `lmslocal-flutter/` | Player-only mobile app (Provider), same API and JWT | — |
| `lmslocal-marketing/` | Leaflets and social tiles; plain HTML, no build. Read its README before printing | — |

```bash
npm run dev            # server (nodemon), web, admin
npm run build          # web/admin: production build incl. type check
npm run lint           # web/admin
npx tsc --noEmit       # web/admin: type check only
```

No test framework. Verify with a build/type check, and against the API with the scripts in
`lmslocal-server/db/README.md`. Deploy steps: `docs/deploy.txt`.

## Read before changing

| Area | Doc |
|---|---|
| Touching the database, testing anything that writes | `lmslocal-server/db/README.md` |
| Any web screen's look, and user-facing copy | `docs/design-system.md` |
| Matchday | `docs/matchday.md` |
| Matchday in the Flutter app | `docs/matchday-app.md` |
| Which teams a player may pick | `docs/allowed-teams.md` |
| How a competition gets its first round; the fixture calendar | `docs/competition-start.md` |
| What `/game/[id]/round` shows | `docs/round-state-machine.md` |
| Joining a competition | `docs/player-onboarding.md` |
| Results processing / correcting a result | `docs/results-processing-logic.md`, `docs/results-processing-correction.md` |
| Billing for resets and re-buys | `docs/reset-billing.md`, `docs/re-buys.md` |
| Bots | `docs/BOTS-Management.md` |
| Sending email | `docs/email/email-operations.md` |
| Push notifications to the app (they go with an email) | `docs/mobile-notifications.md` |

Code comments cite these docs by section (`§3`). Keep section numbers stable when editing them.

## The database is production

There is **no staging copy** — development talks to the live database. Read
`lmslocal-server/db/README.md` before any write. In short: reads are free; **ask which
competition to test against** and never reuse an id from a doc, memory or earlier session;
organiser 50 (Andreas) owning it is necessary, not sufficient. Use `node db/query.js` /
`node db/write.js` from `lmslocal-server/`; there is deliberately no MCP server. No schema file
exists — query `information_schema`. Table names are singular (`app_user`, not `users`).

## API conventions (server)

- One route per file, lowercase-hyphenated (`set-pick.js`). POST for mutations, GET for reads.
- **Always HTTP 200**, with `return_code` in every response. Reuse the existing codes — the
  frontends match on the strings: `SUCCESS`, `MISSING_FIELDS`, `INVALID_*`, `*_NOT_FOUND`,
  `UNAUTHORIZED` (not signed in), `FORBIDDEN` (signed in, not allowed), `SERVER_ERROR`.
- Every route opens with the standard header block (purpose, method, payload, responses, every
  return code). Copy the format from `routes/get-user-credits.js`.
- `const { query, transaction } = require('../database');` — never the pool directly.
  Parameterised SQL only. No N+1: join or batch.
- Log through `utils/apiLogger.js` as surrounding routes do.
- Comments explain **why**, not what.
- Secrets come from `.env` (both `lmslocal-server/` and `lmslocal-web/` have one). The repo is
  public: no credentials in tracked files. Say so if a new env var is needed.
- JWT payload stays `user_id`, `email`, `display_name`; fetch anything else from the DB.
- **Admin gets its own `/admin/*` routes** (separate `JWT_ADMIN_SECRET`, live `is_admin` check).
  Never add an admin bypass to a player route.
- CORS allows only the origins in `CLIENT_URL` — a local frontend on an unlisted port is refused.

## Web

- API client `src/lib/api.ts`, grouped by domain with full types; caching in `src/lib/cache.ts`;
  competition data via `AppDataContext`. No global state library. `@/*` → `./src/*`.
- Design system: class constants in `src/lib/design.ts`, tokens in `tailwind.config.js`, shared
  chrome in `src/components/public/`. New or reworked web screens are built to it; `/profile` and
  the admin tool are not on it yet.

## Game rules (LMS)

- One team per round, no reuse until every team has been used, then all return. Availability is
  **derived from the player's own picks** in `services/allowedTeams.js` — the only stored state
  is `competition_user.teams_reset_round`. Do not reintroduce a stored copy.
- A round locks at `round.lock_time` and nothing else. Auto-lock when everyone has picked is
  deliberately disabled (`utils/roundLocking.js`).
- Win advances; draw or loss eliminates; a missed pick costs a life. Regulation time only.
- LMS-only routes refuse a Matchday competition with `FORBIDDEN`. Matchday has no picks, lives
  or eliminations — see `docs/matchday.md`.

## Fixtures and results

- `competition.fixture_service` is fixed at creation: **true** = we supply fixtures and results
  via the admin tool; **false** = the organiser enters them on `/game/[id]/round`
  (`src/lib/roundState.ts`, `organizer-*` routes). Change it only in the database, on request.
- Fixture service flow: a gameweek is keyed as a block on the admin **calendar** (the only place
  fixtures are entered) → **Stage** copies it into `fixture_load` and pushes it to every eligible
  competition, one transaction each → results are confirmed and pushed per competition → the push
  that settles the last competition closes the gameweek and stages the next block.
- Whether a competition is ready for a round is `evaluateCompetition` in
  `services/fixtureService.js` — the single rule for both the admin screen and the push. The
  first-round rules (`ready_at`, start blocks, lead times) are in `docs/competition-start.md`.
- To play rounds in a **test** competition use `scripts/sandbox-round.js`, never the calendar or
  Stage — those are shared by every customer.

## Email

- Every email leaves through `deliver()` in `services/emailService.js`. Never call Resend
  directly. Email is live: triggering a send for a customer competition mails real people.
- What we send, and its priority, is the `OUTLINE` in
  `lmslocal-admin/src/app/dashboard/emails/page.tsx`. Which emails are wired is
  `services/emailCatalog.js` — adding one is a catalog entry plus a service.
- Each email's eligibility and reasoning live in its service's header and `findCandidates`;
  record rule changes there with the date and the why. `services/pickReminder.js` is the shape
  to copy.
- Every candidate query composes `notOptedOutSql()` (`emailPreference.js`), and every
  competition email also `notArchivedSql()` (`competitionEngagement.js`) and the guard for the
  game it is written for, `isLmsSql()` or `isMatchdaySql()` (`gameType.js`). Never write these
  conditions by hand. Archived competitions get no email, with no exceptions.
- A recurring player email covering both games is **one email per person**, one section per
  competition — `docs/matchday.md` §9.1. `services/pickReminder.js` is the shape.
- The 48-hour quiet period (`services/emailQuiet.js`) drops a second email rather than delaying
  it; `priority` on the `OUTLINE` decides which wins. Under-sending is preferred to over-sending.

## Admin rules

- **A bot is never chargeable** — no credit, no free place — in every counting query, via
  `services/botPool.js`. Bots are confined to the organisers in `BOT_ORGANISER_IDS`.
- `competition.archived_at` is a decision an admin makes (`/admin/set-competition-archived`),
  never something calculated. Archived competitions still get fixtures and results, but are
  excluded from every count and every email. Show activity signals; do not turn them into a rule.
- Organiser spend is `credit_purchases`, never `app_user.paid_credit`.

## Repo housekeeping

- Exactly **one `.gitignore` and one `.vercelignore`, both at the repo root** (the generated
  ones under `lmslocal-flutter/` excepted). `.vercelignore` applies to every Vercel project and
  silently drops matching files from the deploy — when a committed file 404s in production,
  check it first.
- `lmslocal-server/package.json` overrides `uuid` to `^11.1.1` to clear an `npm audit` advisory
  under `firebase-admin`. Remove it once firebase-admin depends on `uuid` >= 11.1.1.
