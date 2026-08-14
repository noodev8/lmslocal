# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LMSLocal is a "Last Man Standing" competition platform designed for pub landlords, workplace organizers, and club managers. The system follows an admin-first approach where organizers can easily set up and manage elimination-style competitions based on real fixtures.

## Architecture

This is a full-stack application with two main components:

### Backend (lmslocal-server/)
- **Technology**: Node.js with Express.js
- **Database**: PostgreSQL with connection pooling
- **Port**: 3015
- **Authentication**: JWT tokens with bcrypt password hashing
- **Token Policy**: Keep JWT tokens simple and consistent - only include user identification fields (user_id, email, display_name). Any additional data should be fetched from database when needed.
- **Email**: Resend. **Read `docs/email/README.md` before touching anything that sends email**,
  and change the doc first. `docs/email/email-outline.xlsx` is the authoritative list of what we
  send; the README maps it onto the code and carries a step-by-step for wiring the next one.
  The short version:
  - `services/emailService.js` — **`deliver()` is the single exit point**, with test mode as a
    parameter. Do not call `resend.emails.send` directly; seven senders once did, which is why a
    banner reading `ALL EMAILS REDIRECTED` was true of only five of them.
  - `services/emailPreference.js` — the one definition of opt-outs. Compose the candidate
    query's exclusion with `notOptedOutSql()`; never hand-write it. Preferences group by
    **consumer × section**, and **an absent row means subscribed**.
  - `services/pickReminder.js` — the worked example: one definition of eligibility, used by the
    batch route, the admin preview and the send. Copy this shape for each new email;
    `services/joinLms.js` is the second one built to it.
  - `services/emailCatalog.js` — **which emails are wired, in one list.** The three admin routes
    read it; adding an email is one entry, not three edits. `scoped` says whether the email needs
    a competition at all.
  - Unsubscribe is an **opaque token on `app_user`**, not a JWT — the old one was signed with
    `JWT_SECRET`, so killing a leaked link meant logging out every user.
  - Operator-driven from `lmslocal-admin` → Emails. There is no scheduler by design.
- **Security**: Helmet, CORS, rate limiting, input validation
- **Dependency override**: `package.json` pins `uuid` to `^11.1.1` via `overrides`. It is a
  transitive dep of `gaxios`/`teeny-request` under `firebase-admin`, which still resolve to
  `uuid@9`, and that carries GHSA-w5hq-g745-h8pq. The vulnerable path (v3/v5/v6 with a `buf`
  argument) is unreachable — both callers use `v4()` with no arguments — so this is about
  keeping `npm audit` at zero, not patching a live hole. Remove the override once
  firebase-admin ships a tree on `uuid` >= 11.1.1; verify FCM still sends afterwards.

### Admin Tool (lmslocal-admin/)
- **Technology**: Next.js 15.5.9 with React 19 and TypeScript 5 (matches lmslocal-web)
- **Port**: 3001 (development)
- **Backend**: none of its own — calls the same Express server under `/admin/*`
- **Auth**: normal LMSLocal credentials, but a separate login route, a separate signing key
  (`JWT_ADMIN_SECRET`), a `scope: "admin"` claim, and a live `app_user.is_admin` check
- **Rule**: never add an admin bypass to an existing player route; admin gets its own routes
- **Screens**: `/dashboard` (read-only platform snapshot, the landing page),
  `/dashboard/competitions`, `/dashboard/organisers`, `/dashboard/fixtures`,
  `/dashboard/fixtures/calendar`, `/dashboard/bots`
- **Bots**: placeholder players for seeding a competition. **A bot is never chargeable** — it costs
  no credit and takes no free place, in every counting query, via the shared definition in
  `services/botPool.js`. They are still confined to organisers listed there, but for a product
  reason rather than a billing one: a customer's competition filling with fake entrants means real
  players competing against opponents who are not people. See `docs/BOTS-Management.md`
- **Organisers**: an organiser owns at least one competition. "Players" counts memberships the
  same way the competitions screen does, so the two agree; "spend" is `credit_purchases`, never
  `app_user.paid_credit` — see `docs/admin-tool.md`
- **Full details**: `docs/admin-tool.md`

### Frontend (lmslocal-web/)
- **Technology**: Next.js 15.5 with React 19 and TypeScript 5
- **Styling**: Tailwind CSS with PostCSS
- **Port**: 3000 (development)
- **State Management**: Local state with localStorage persistence
- **HTTP Client**: Axios with automatic JWT token injection and interceptors
- **Forms**: React Hook Form with @heroicons/react for UI components
- **Design system**: `docs/design-system.md` — the "pools coupon" visual language (tinted stock,
  two inks, signage caps, typewriter reserved for filled-in data). **Read it before building or
  restyling any screen.** Shared class constants live in `src/lib/design.ts`; colour and font
  tokens are Tailwind theme extensions in `tailwind.config.js`, shared chrome in
  `src/components/public/`. Every signed-out page is built to it (landing, join, pricing, terms,
  privacy, help, and the three auth pages); everything behind the sign-in door, plus
  `lmslocal-admin`, is still on the older slate/emerald defaults. The doc's §10 covers migrating a
  screen. It also carries the copy rules: "you" always means the organiser, no invented
  testimonials, never state opt-in features as universal.

### Marketing artwork (lmslocal-marketing/)
- **What**: leaflets and social tiles — anything that ends up a PDF or PNG rather than a page on
  the site. Plain HTML + the Tailwind CDN, **no build step and no `package.json`**. Not imported
  by any app; deleting it would not affect a deploy.
- **Read `lmslocal-marketing/README.md` before touching it**, and change the doc first.
- **Never print by hand.** `node make-pdf.js <leaflet>` is the only supported route, because two
  failures here are invisible until the leaflets are printed: a leaflet opened as a `file://`
  page **silently falls back to Arial** for two of the three brand fonts, and print shops
  **reject live fonts** and want text as outlines. The script serves over http and runs
  Ghostscript to fix both. Add `--home` for a copy to print on your own printer.
- **Bleed**: `?bleed` (`_shared/bleed.js`) grows the sheet 3mm per side for the guillotine. The
  print-shop build uses it automatically. Handoff is "154 × 216mm, 3mm bleed, trims to A5".
- **`out/` is scratch and git-ignored; `press/` is tracked** and holds only PDFs a printer
  actually ran, because a reprint has to match the original.
- Brand tokens in `_shared/brand.js` **duplicate `lmslocal-web/tailwind.config.js`** — change
  both together. Artwork follows `docs/design-system.md`.

## Development Commands

### Server (lmslocal-server/)
```bash
cd lmslocal-server
npm start          # Production server
npm run dev        # Development with nodemon
```

### Frontend (lmslocal-web/)
```bash
cd lmslocal-web
npm run dev        # Development server with hot reload (port 3000)
npm run build      # Production build with TypeScript type checking
npm run start      # Production server
npm run lint       # ESLint code linting
npx tsc --noEmit   # TypeScript type checking only (no build output)
```

### Testing
No test framework is currently configured.

## API Development Standards

### Route Conventions
- **Use POST or GET methods** as appropriate (POST for mutations, GET for data retrieval)
- **All responses include "return_code"** field ("SUCCESS" or error type)
- **ALWAYS return HTTP 200** - Use `return_code` for success/error status (prevents frontend crashes)
- **Single route file per function** - no combining multiple endpoints
- **Lowercase filenames with hyphens** (e.g., `set-pick.js`, `add-fixtures-bulk.js`)
- **Database connections**: All routes properly use shared `database.js` utilities (✅ FIXED)
- **File naming**: Use lowercase with hyphens, not underscores

### Standard API Route Header Format
```javascript
/*
=======================================================================================================================================
API Route: [route_name]
=======================================================================================================================================
Method: POST | GET
Purpose: [Clear description of what this route does]
=======================================================================================================================================
Request Payload:
{
  "field1": "value1",                  // type, required/optional
  "field2": "value2"                   // type, required/optional
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "field1": "value1",                  // type, description
  "field2": "value2"                   // type, description
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE_1",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"UNAUTHORIZED" 
"NOT_FOUND"
"SERVER_ERROR"
=======================================================================================================================================
*/
```

### API Response Pattern (NEW APIS ONLY)
**CRITICAL**: All new APIs must follow this crash-safe pattern:

```javascript
// ✅ CORRECT - Always return 200, use return_code for status
if (error) {
  return res.status(200).json({
    return_code: "ERROR_TYPE",
    message: "User-friendly error message"
  });
}

// ❌ WRONG - HTTP errors can crash frontend
if (error) {
  return res.status(404).json({ // Can cause unhandled promise rejection
    return_code: "ERROR_TYPE",
    message: "Error message"
  });
}
```

**Migration**: Most APIs have been migrated to this pattern. The unified `/get-user-dashboard` API exemplifies the current standard.

### Return Code Vocabulary
Return codes are machine-readable and checked by the frontend, so reuse the existing
vocabulary rather than inventing a synonym:
- `SUCCESS` - operation completed
- `MISSING_FIELDS` - a required field was absent
- `INVALID_*` - validation failed (`INVALID_EMAIL`, `INVALID_PASSWORD`)
- `*_NOT_FOUND` / `NOT_FOUND` - resource does not exist (`USER_NOT_FOUND`)
- `UNAUTHORIZED` - authentication missing or failed
- `FORBIDDEN` - authenticated but not permitted
- `SERVER_ERROR` - unexpected failure

Every code a route can return must be listed in its header block.

### Route Logging
Routes log through `utils/apiLogger.js` (requests, responses, timing). Most routes already
do; match the surrounding pattern when adding a new one.

### Query Conventions
- **No N+1 queries** - use a JOIN or a batch query rather than a loop of single lookups
- Use the shared helpers: `const { query, transaction } = require('../database');`
  (there is no `utils/transaction.js` — `transaction` comes from `database.js`)
- Always parameterized, never string-interpolated SQL

### Comments
Explain **why**, not what — the non-obvious constraint, the reason for an ordering, the edge
case being guarded. Do not narrate code that already reads clearly.

### Secrets
Never hardcode passwords, keys, or tokens. Read them from `.env` via `process.env`, and say
so if a new variable is needed.

## Database Configuration

- **Connection**: PostgreSQL with connection pooling via pg module
- **Configuration**: All database credentials stored in .env file
- **Pool Settings**: Max 20 connections, 30s idle timeout, 2s connection timeout
- **Security**: Always use parameterized queries to prevent SQL injection

## Application Architecture

### Backend Architecture
- **Server Entry**: server.js configures Express with comprehensive security middleware
- **Database Layer**: database.js provides connection pooling and query utilities
- **Route Pattern**: Each API endpoint is a separate file with standardized interface
- **Authentication**: JWT-based with separate middleware for admin vs player verification
- **Error Handling**: Centralized error handling with structured return_code responses

### Frontend Architecture 
- **App Router Structure**: Next.js App Router with TypeScript for admin dashboard and player-facing competition views
- **API Layer**: Axios service (api.ts) with automatic JWT token injection and response interceptors
- **State Management**: No global state management - relies on localStorage and local component state
- **Styling**: Tailwind utility-first CSS framework with PostCSS
- **Forms**: React Hook Form for form validation and handling

### Key Files
```
lmslocal-server/
├── server.js              # Express server with security middleware
├── database.js            # PostgreSQL pool and query utilities  
├── routes/                 # API endpoints (42 single-function routes)
├── middleware/verifyToken.js  # JWT verification middleware
├── services/emailService.js   # Resend integration, deliver(), shared footer
├── services/emailPreference.js # Opt-out groups, unsubscribe tokens
└── services/pickReminder.js   # Pick reminder eligibility and template data

lmslocal-web/
├── src/app/               # Next.js App Router pages and layouts
├── src/lib/api.ts         # Axios HTTP client with JWT injection and TypeScript types
└── next.config.js         # Next.js configuration
```

## Environment Configuration

- **Environment Files**: Both lmslocal-server/.env and lmslocal-web/.env exist (check both locations)
- **Backend .env**: Contains database and server configuration
- **Required variables**: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, PORT, JWT_SECRET
- **Optional variables**: CLIENT_URL (for CORS), NODE_ENV, RESEND_API_KEY, NEXT_PUBLIC_API_URL (frontend API endpoint)
- **Access via**: `process.env.VARIABLE_NAME`
- **Frontend API**: Configure via NEXT_PUBLIC_API_URL environment variable in .env file

## Security Guidelines

- **Rate limiting**: General limit (1000 req/15min), DB-intensive endpoints (50 req/10sec, keyed by
  IP + path), and `joinLookupLimit` (30 req/min) on the public `/get-competition-by-code` lookup
- **CORS**: Configured for localhost:3000-3003 and CLIENT_URL environment variable
- **Helmet**: CSP, security headers with unsafe-inline allowances for React dev
- **Authentication**: JWT tokens with bcrypt password hashing
- **Database**: Connection pooling (max 20 connections) with parameterized queries

## Development Workflow

1. **Backend development**: Use `npm run dev` in lmslocal-server (nodemon auto-restart)
2. **Frontend development**: Use `npm run dev` in lmslocal-web (Next.js hot reload on port 3000)
3. **New API routes**: Each route in separate file, follow header format, use POST or GET as appropriate
4. **Database operations**: Use database.js query/transaction functions, never direct pool access
5. **Authentication**: Player routes use JWT middleware, admin routes use different verification

## Critical Architecture Patterns

### API Client Structure
- **Comprehensive API Client**: All API calls organized by domain (authApi, playerApi, competitionApi, etc.)
- **TypeScript Interfaces**: Full type definitions for requests and responses
- **Interceptors**: Automatic JWT token injection and 401 handling with localStorage cleanup
- **Consistent Response Format**: All API responses follow `ApiResponse<T>` interface with `return_code`

### Database Architecture (✅ RESOLVED)
- **Proper Implementation**: All 42 routes consistently use shared `database.js` utilities
- **Connection Pattern**: `const { query, transaction } = require('../database');`
- **Connection Details**: Max 20 connections, 30s idle timeout, 2s connection timeout

### Authentication Architecture
- **Unified System**: Email and password authentication for all users (admins and players)
- **JWT Implementation**: Tokens stored in localStorage, automatic injection via axios interceptors
- **User Flow**: Email + password → JWT token → competition access
- **Master Password**: Optional MASTER_PASSWORD in .env for development/testing - allows logging in as any user for testing purposes

## Competition Game Logic

### Player Rules
- **Pick System**: One team per round, cannot reuse teams across rounds — until every team has been
  used, at which point they all come back. What a player may still pick is **derived from their own
  picks**, not stored; the only stored state is `competition_user.teams_reset_round`. Read
  `docs/allowed-teams.md` before touching this, and change the doc first. The `allowed_teams` table
  was **dropped in Aug 2026** — it duplicated state derivable from `pick`, and had **three** rebuild
  implementations carrying **two** different definitions. `services/allowedTeams.js` is now the only
  definition; do not reintroduce a stored copy.
- **Lock Timing**: Picks lock when all players choose, admin sets time, or 1hr before kickoff
- **Elimination**: Win = advance, Draw/Loss = elimination, Missed pick = life lost
- **Results**: Based on regulation time only (90 minutes + stoppage time)

### Admin Controls
- **Competition Management**: Create competitions with custom access codes or slugs
- **Player Management**: Full ability to modify player status, lives, and participation
- **Fixture/Result Management**: Automated via backend fixture service (manual UI disabled)

### Fixture & Result Management
- **Fixture Service**: Automated system using the `fixture_load` staging table
- **UI**: `lmslocal-admin` → `/dashboard/fixtures`. Staging routes are `/admin/add-staged-fixtures`,
  `/admin/get-staged-results`, `/admin/set-staged-result`, `/admin/get-fixture-team-lists`
- **Push APIs — everything goes out one competition at a time.** Fixtures:
  `/admin/get-fixture-push-targets` + `/admin/push-fixtures-to-competition`. Results:
  `/admin/get-push-targets` + `/admin/push-results-to-competition`, then
  `/admin/clear-staged-batch` once every competition has been pushed. All **singular — one
  competition per call**.

  The two halves became per-competition for different reasons. *Results*: processing scales with
  player count, and the old route did the whole batch in one transaction, so a timeout anywhere
  rolled every competition back. *Fixtures*: the only thing keeping a mis-staged batch away from
  every customer was `FIXTURE_SERVICE_TEST_MODE`, an env var naming one organiser's email that
  had to be set before testing and unset after — and which silently starved real customers of
  fixtures while it was on. **That variable is now gone from the codebase**; delete it from
  `.env` if it is still there.

  Both plural routes (`push-fixtures-to-competitions.js`, `push-results-to-competitions.js`) are
  deprecated, **unregistered**, and kept on disk as frozen references only — do not edit them or
  wire them back up.
- **Authentication**: admin token on all of the above (`middleware/admin-auth.js`). The old
  `12221` access code and the `BOT_MAGIC_2025` body secret are gone from this path — the latter
  shipped in the public web bundle. `BOT_MAGIC_2025` is now gone from the codebase entirely:
  `bot-join` / `bot-pick` were deleted when the admin Bots screen replaced them.
- **Opt-in**: `competition.fixture_service`. Only competitions with it set to true receive
  pushes, toggled per competition from the admin competitions list via `/admin/set-fixture-service`
- **When a competition is ready for a round** (`services/fixtureService.js`, `evaluateCompetition`).
  The one implementation, used by both the admin candidate list and the push, so the screen can
  never offer a button the push then refuses. A skipped competition says which rule stopped it in
  the push result's `reason`.

  Every push needs the batch's earliest kickoff to be **in the future** — a passed kickoff would
  create a round locked on arrival that no player could pick in. A competition's **first** round
  needs three more things, and only the first:
  1. `competition.ready_at` — **the organiser has pressed Ready** on `/game/[id]/round`. We never
     ask them to predict a start date, because we cannot say when the next fixtures are. Nothing
     is pushed until they say so, however long that takes. Reversible until the first round
     exists (`/set-competition-ready`); a **reset clears it** so an emptied competition goes back
     to waiting instead of taking the next batch with nobody told.

     **Pressing Ready publishes round 1 there and then** — `set-competition-ready` calls
     `pushFixturesToCompetition` itself, in a second transaction after the flag commits, swallowing
     failure so the organiser's decision always sticks. Without it the organiser was left "all set"
     beside a Play button that did nothing until an operator opened the admin screen.

     **So the button is only offered when a round is available** (`can_start` from
     `/get-competition-start-outlook`). Ready means "start me on the round I can see", not a
     standing order. When they can't start, the card drops the button and says why: it names the
     current batch's kickoff and tells them to come back after it, or — when nothing is staged —
     says only that there is nothing ready, since no date exists to promise.
  2. `fixture_load.opens_gameweek` — the batch must **start** a gameweek, not continue one. A real
     Fri–Sun gameweek is staged as several batches, one round each, so a competition that first
     became eligible on the Saturday would get a round 1 of Sunday's two matches while everyone
     else played a full slate. Nothing in the data can tell these apart, so `add-staged-fixtures`
     asks whoever stages the batch (checkbox on the admin fixtures screen, default true).
  3. **now + 48 hours** (`FIRST_ROUND_LEAD_TIME_HOURS`) — someone who presses Ready on Friday
     afternoon must not be handed Saturday's matches before they have told anyone.

  `/get-competition-start-outlook` runs the same evaluation for the organiser's own card, so the
  date they are shown is the one the push would actually produce. `competition.earliest_start_date`
  is the **dead column** left by the old "wait N weeks" question — nothing reads or writes it.

  Who supplies fixtures (`fixture_service`) is **fixed at creation**. `update-competition` ignores
  it, the settings screen does not offer it, and `set-fixture-service-organiser` is unregistered in
  `server.js` — change it in the database on request. A reset preserves it.
- **The forward calendar** (`fixture_block` / `fixture_block_item`, `/dashboard/fixtures/calendar`)
  — **read `docs/competition-start.md` before touching it**, and change the doc first.
  `fixture_load` was doing two jobs: the calendar of what is coming AND the batch going out now.
  Its one-batch-at-a-time rule is right for the second and made the first impossible, which is why
  a new competition sat empty while its organiser recruited. Blocks are the calendar: several at
  once, provisional, editable, keyed by hand weeks ahead. **Stage** copies one into `fixture_load`
  (`/admin/promote-fixture-block`) and everything downstream — push per competition, clear the
  batch — is unchanged. Routes: `/admin/get-fixture-blocks`, `add-fixture-block`,
  `update-fixture-block`, `delete-fixture-block`, `promote-fixture-block`. Team validation is
  shared with `add-staged-fixtures` via `services/fixtureBlock.js`, so a block cannot pass when
  keyed and fail when promoted.

  **A competition created against a block has round 1 from the moment it exists** — real fixtures,
  a real lock time, provisional until the block is promoted. `create-competition` takes
  `start_block_id`, offered by `/get-competition-start-options` (up to three dates, no fixtures —
  the organiser picks *when*, not *which*, and each is shown as "in N days"). Two thresholds in
  `fixtureBlock.js`: `START_LEAD_TIME_HOURS = 1` decides what is offered, `DEFAULT_MIN_HOURS = 48`
  decides what is preselected — the soonest option unless it locks inside 48h.

  **`add-staged-fixtures` creates a `fixture_block` for every batch it stages**, so the batch
  going out now is itself a start option — usually the soonest one — and the push can reconcile
  onto it. There is one kind of thing, not "blocks and also batches".
  When the block is pushed, `pushFixturesToCompetition` **reconciles** that round rather than
  creating a second one, re-points picks by team, and clears `source_block_id`.

  `reset-competition` asks the same question and rebuilds round 1 the same way — both go through
  `createRoundFromBlock`, and the organiser-facing chooser is one component,
  `lmslocal-web/src/components/StartDateChooser.tsx`.

  **The `ready_at` gate is deliberately still there, permanently.** It is not a legacy — it is the
  fallback for manual competitions, team lists with no calendar, a calendar with nothing far
  enough ahead, and the competitions already on it. The old rules are skipped for any competition
  that already has a round, which block-started ones always do, so the two run side by side. The
  Ready card hides itself: `isStartGateVisible` needs `phase === 'NO_ROUND'`.

  Emails follow it: `created_comp` names the start date instead of the Ready button when round 1
  exists, and `services/shareReminder.js` warns the organiser 48h before joining closes. See
  `docs/email/README.md`.
- **The model**: only one staged batch at a time per team list — `fixture_load` itself is the
  pending batch. `add-staged-fixtures` refuses a new one while it's non-empty; a batch clears
  when the admin presses **Clear staged batch** (`/admin/clear-staged-batch`), which is a
  deliberate step because the staged rows must survive until every competition has been pushed
  to individually. It refuses while any competition is still unfinished, unless forced. Every
  fixture in a batch shares a single kickoff time that becomes the round's lock time, so a real
  gameweek spread over Fri–Sun is entered as several batches — **one round each**, since a round
  holding fixtures with no results is `round_in_progress` and takes no further push. Untick
  "starts a new gameweek" on the second and third of those.
- **Organiser-managed competitions** (`fixture_service = false`) use the `organizer-*` routes.
  Their fixtures and results are **one screen**, `/game/[id]/round`, driven by the state machine
  in `src/lib/roundState.ts` — read `docs/round-state-machine.md` before changing what that
  screen shows, and change the doc first. `/game/[id]/organizer-fixtures` survives only as the
  fixture entry form and redirects to `/round` on automated competitions;
  `/game/[id]/organizer-results` is gone.
- **Disabled Routes**: create-round, add-fixtures-bulk, submit-results, update-round, reset-fixtures, set-fixture-result, get-calculated-fixtures, organiser-mid-round-submit-tip (all preserved with `.delete` extension)

### Technical Implementation
- **Authentication**: Unified email/password authentication for all users
- **Access Methods**: Players join via competition slug or access code
- **Data Flow**: PostgreSQL backend with automated fixture/result distribution

## Database Access & Schema Reference

**Before writing anything to the database, read `docs/testing-rules.md`.** This is the live
production database and there is no staging copy. The short version: **organiser 50**
(`aandreou25@gmail.com`) owns the sandbox; every other competition belongs to a customer and is
read-only unless the user names it in that session.

**Ask which competition to test against — never reuse an id from a doc, a memory or an earlier
session.** Andreas creates a test competition, works through it and deletes it, so the sandbox is
a different competition week to week. No id is recorded here deliberately: competition 199 was
named as the sandbox in older docs and no longer exists, and its replacement will go the same way.
Organiser 50 is necessary but **not sufficient** — he also owns real competitions — so the answer
has to come from him, not from an ownership check. See `docs/testing-rules.md`.

**Connecting to the database**: `lmslocal-server/db/README.md` is the front door — read it before
writing SQL. There is **no MCP server** for this project and that is deliberate; use the scripts
instead, run from `lmslocal-server/`:

```bash
node db/query.js "SELECT ..."     # read-only (enforced by a READ ONLY transaction)
node db/write.js "UPDATE ..."     # writes: one transaction, --dry-run, no-WHERE guard
```

This is the **live production database**. The README also lists the data landmines (the
`competition.status` casing inconsistency, what `fixture.result` actually holds, why
`player_progress` has more rows than `pick`) — those cost an hour each if you meet them cold.

**Schema**: there is no checked-in schema file — ask the database, which is never out of date:

```bash
node db/query.js "SELECT column_name, data_type, is_nullable FROM information_schema.columns
                  WHERE table_name='competition' ORDER BY ordinal_position"
```

Table names are **singular** except where noted:

- `competition` - Competition definitions and settings
- `round` - Competition rounds
- `pick` - Player picks for each round
- `allowed_teams` - Teams available to players per competition (plural)
- `team` - Master list of teams
- `app_user` - User accounts table (uses `app_user`, not `users`)
- `competition_user` - Membership, lives remaining, admin permission flags
- `team_list` - Team list definitions by competition type
- `fixture` - Individual fixtures within rounds
- `fixture_load` - Staging table the fixture service pushes from
- `player_progress` - Track player outcomes by round
- `audit_log` - System audit logging

## Important Development Notes

### Unified User Data Architecture
- **Single API Endpoint**: `/get-user-dashboard` provides unified competition data for all user types
- **Comprehensive Data**: Returns competitions where user is organizer OR participant with role-specific fields
- **Smart Caching**: User-specific cache keys with proper TTL management
- **Frontend Integration**: AppDataContext serves as single source of truth for all competition data

### TypeScript Configuration
- **Frontend TypeScript**: Strict mode enabled with Next.js plugin integration
- **Path Mapping**: `@/*` maps to `./src/*` for clean imports
- **Type Checking**: Run `npx tsc --noEmit` for standalone type checking without build
- **Development Configuration**: Includes Next.js plugin integration for optimal type checking

## Additional Implementation Details

### Frontend App Structure
- **Route Organization**: Uses Next.js 15.5 App Router with nested route structure
- **Key Routes**: `/dashboard`, `/competition`, `/play`, `/login`, `/register`, `/profile`, `/forgot-password`
- **Responsive Design**: Mobile-first approach with Tailwind CSS utilities
- **Client-Side Caching**: Implements request caching system in `src/lib/cache.ts` for performance optimization

### Backend Route Architecture  
- **Comprehensive API Coverage**: 42 individual route files, each handling a specific function
- **Route Naming**: Consistent kebab-case naming (e.g., `get-competition-players.js`, `add-fixtures-bulk.js`)
- **Header Documentation**: Each route includes comprehensive header documentation with request/response formats
- **Token Verification**: Uses middleware for JWT verification across protected endpoints
- **Database Pattern**: All routes use shared `database.js` utilities (no anti-patterns present)

## Mobile Application

### Flutter App (lmslocal-flutter/)
- **Technology**: Flutter with Dart for cross-platform mobile experience
- **Architecture**: Provider pattern for state management with comprehensive user authentication
- **Key Features**: Offline-capable player dashboard, cached competition data, responsive UI
- **Authentication**: Integrated with main backend JWT system
- **Development**: Use `flutter pub get` for dependencies, `dart run build_runner build` for code generation