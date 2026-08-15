# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

LMSLocal is a "Last Man Standing" competition platform for pub landlords, workplace organizers and
club managers. Admin-first: organisers set up and run elimination competitions against real
fixtures.

## Docs to read first

Each of these is authoritative for its area — **read it before changing that area, and change the
doc first** (except the email README, see below):

| Area | Doc |
|---|---|
| Anything that sends email | `docs/email/README.md` |
| Any screen's visual language | `docs/design-system.md` |
| Which teams a player may pick | `docs/allowed-teams.md` |
| The forward fixture calendar / competition start | `docs/competition-start.md` |
| What `/game/[id]/round` shows | `docs/round-state-machine.md` |
| Writing to the database | `docs/testing-rules.md`, `lmslocal-server/db/README.md` |
| Marketing artwork | `lmslocal-marketing/README.md` |
| Admin tool, bots | `docs/admin-tool.md`, `docs/BOTS-Management.md` |

## Architecture

### Backend (lmslocal-server/)
- Node.js + Express, PostgreSQL with connection pooling, port **3015**
- **Auth**: JWT + bcrypt. **Keep tokens simple** — only `user_id`, `email`, `display_name`;
  fetch anything else from the database when needed. Middleware: `middleware/auth.js` (player),
  `middleware/admin-auth.js`, `middleware/service-auth.js`
- **Security**: Helmet, CORS, rate limiting, input validation
- **Email**: Resend. `docs/email/email-outline.xlsx` is the authoritative list of what we send;
  `docs/email/README.md` maps it onto the code and has a step-by-step for wiring the next one.
  - **Do not update that README as a matter of course** (rule set 2026-08-14). It was written
    while the design was being settled, when "change the doc first" was right. The shape is agreed
    now, and a doc edit on every tweak buries the decisions worth keeping. **Ask, and update it
    when Andreas agrees** — a real decision, a changed rule, a trap someone would re-discover. Not
    a button label or a count that moved.
  - `services/emailService.js` — **`deliver()` is the single exit point**, with test mode as a
    parameter. Never call `resend.emails.send` directly; seven senders once did, which is why a
    banner reading `ALL EMAILS REDIRECTED` was true of only five of them.
  - `services/emailPreference.js` — the one definition of opt-outs. Compose the candidate query's
    exclusion with `notOptedOutSql()`, never by hand. Preferences group by **consumer × section**,
    and **an absent row means subscribed**.
  - `services/pickReminder.js` — the worked example: one definition of eligibility used by the
    batch route, the admin preview and the send. Copy this shape; `services/joinLms.js` is the
    second built to it.
  - `services/emailCatalog.js` — **which emails are wired, in one list**, read by the three admin
    routes. Adding an email is one entry, not three edits. `scoped` says whether it needs a
    competition at all.
  - Unsubscribe is an **opaque token on `app_user`**, not a JWT — the old one was signed with
    `JWT_SECRET`, so killing a leaked link meant logging out every user.
  - Operator-driven from `lmslocal-admin` → Emails. **No scheduler, by design.**
- **Dependency override**: `package.json` pins `uuid` to `^11.1.1`. It is transitive via
  `gaxios`/`teeny-request` under `firebase-admin`, which resolve to `uuid@9` and carry
  GHSA-w5hq-g745-h8pq. The vulnerable path (v3/v5/v6 with a `buf` argument) is unreachable — both
  callers use `v4()` with no arguments — so this keeps `npm audit` at zero rather than patching a
  live hole. Remove it once firebase-admin ships on `uuid` >= 11.1.1; verify FCM still sends.

### Frontend (lmslocal-web/)
- Next.js 15.5, React 19, TypeScript 5 (strict), Tailwind + PostCSS, port **3000**
- Axios client `src/lib/api.ts` — organised by domain (`authApi`, `playerApi`, `competitionApi`…),
  full request/response types, interceptors for JWT injection and 401 → localStorage cleanup
- No global state manager: local state, localStorage, and `AppDataContext` as the single source of
  truth for competition data. Request caching in `src/lib/cache.ts`
- React Hook Form for forms, `@heroicons/react` for icons. `@/*` maps to `./src/*`
- **Design system**: `docs/design-system.md` — the "pools coupon" language (tinted stock, two
  inks, signage caps, typewriter for filled-in data). Class constants in `src/lib/design.ts`,
  colour/font tokens in `tailwind.config.js`, shared chrome in `src/components/public/`. **Every
  signed-out page is built to it** (landing, join, pricing, terms, privacy, help, the three auth
  pages); everything behind the sign-in door, plus `lmslocal-admin`, is still on the older
  slate/emerald defaults. §10 covers migrating a screen. It also carries the copy rules: "you"
  always means the organiser, no invented testimonials, never state opt-in features as universal.

### Admin tool (lmslocal-admin/)
- Next.js 15.5.9, React 19, TypeScript 5, port **3001**. No backend of its own — calls the same
  Express server under `/admin/*`
- **Auth**: normal LMSLocal credentials, but a separate login route, a separate signing key
  (`JWT_ADMIN_SECRET`), a `scope: "admin"` claim, and a live `app_user.is_admin` check
- **Rule: never add an admin bypass to an existing player route** — admin gets its own routes
- **Screens**: `/dashboard` (read-only platform snapshot, the landing page), `/competitions`,
  `/organisers`, `/fixtures`, `/fixtures/calendar`, `/bots`
- **Bots**: placeholder players for seeding a competition. **A bot is never chargeable** — no
  credit, no free place, in every counting query, via `services/botPool.js`. Still confined to the
  organisers listed there, but for a product reason not a billing one: a customer's competition
  filling with fake entrants means real players facing opponents who are not people
- **Organisers**: an organiser owns at least one competition. "Players" counts memberships the
  same way the competitions screen does so the two agree; "spend" is `credit_purchases`, **never**
  `app_user.paid_credit`

### Marketing artwork (lmslocal-marketing/)
- Leaflets and social tiles — anything ending as a PDF or PNG rather than a page on the site.
  Plain HTML + Tailwind CDN, **no build step, no `package.json`**, imported by nothing
- **Never print by hand.** `node make-pdf.js <leaflet>` is the only supported route, because two
  failures are invisible until the leaflets are printed: a `file://` page **silently falls back to
  Arial** for two of the three brand fonts, and print shops **reject live fonts**, wanting text as
  outlines. The script serves over http and runs Ghostscript to fix both. `--home` for your own
  printer
- **Bleed**: `?bleed` (`_shared/bleed.js`) grows the sheet 3mm per side. The print-shop build uses
  it automatically. Handoff is "154 × 216mm, 3mm bleed, trims to A5"
- **`out/` is scratch and git-ignored; `press/` is tracked** and holds only PDFs a printer actually
  ran, because a reprint has to match the original
- Brand tokens in `_shared/brand.js` **duplicate `lmslocal-web/tailwind.config.js`** — change both

### Mobile (lmslocal-flutter/)
Flutter/Dart, Provider for state, offline-capable player dashboard, same backend JWT.
`flutter pub get`, `dart run build_runner build`.

## Development commands

```bash
# lmslocal-server/
npm run dev        # nodemon
npm start          # production

# lmslocal-web/ (and lmslocal-admin/)
npm run dev        # hot reload, port 3000 (admin: 3001)
npm run build      # production build, includes type checking
npm run lint       # ESLint
npx tsc --noEmit   # type check only
```

No test framework is configured.

## API standards

- **POST for mutations, GET for retrieval.** One route file per function — never combine
  endpoints. Lowercase-with-hyphens filenames (`set-pick.js`), not underscores
- **ALWAYS return HTTP 200**, including for errors — status carried in `return_code`. An HTTP
  error status can cause an unhandled rejection and crash the frontend
- **Every response includes `return_code`.** Reuse the existing vocabulary rather than inventing a
  synonym, since the frontend checks these strings: `SUCCESS`, `MISSING_FIELDS`, `INVALID_*`
  (`INVALID_EMAIL`…), `*_NOT_FOUND` / `NOT_FOUND`, `UNAUTHORIZED` (not authenticated), `FORBIDDEN`
  (authenticated, not permitted), `SERVER_ERROR`
- **Header block**: every route opens with the standard comment block — purpose, method, request
  payload, success and error responses, and **every** return code it can emit. Copy the format
  verbatim from a recent route such as `routes/get-user-credits.js`, separator lines included
- **Logging**: through `utils/apiLogger.js` (requests, responses, timing) — match the surrounding
  pattern
- **Queries**: `const { query, transaction } = require('../database');` — both come from
  `database.js`, there is no `utils/transaction.js`. Never touch the pool directly. Always
  parameterized, never string-interpolated. **No N+1** — JOIN or batch instead of looping lookups
- **Comments**: explain **why**, not what — the non-obvious constraint, the reason for an
  ordering, the edge case guarded. Do not narrate code that already reads clearly
- **Secrets**: never hardcoded. Read from `.env` via `process.env`, and say so if a new variable
  is needed

`/get-user-dashboard` is the current exemplar: one unified endpoint returning competitions where
the user is organiser **or** participant, with role-specific fields.

## Environment

- `.env` files exist in **both** `lmslocal-server/` and `lmslocal-web/` — check both
- Required: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `PORT`, `JWT_SECRET`
- Optional: `CLIENT_URL` (CORS), `NODE_ENV`, `RESEND_API_KEY`, `NEXT_PUBLIC_API_URL` (frontend API
  endpoint), `MASTER_PASSWORD` (dev only — log in as any user for testing)
- Pool: max 20 connections, 30s idle timeout, 2s connection timeout
- Rate limits: general 1000 req/15min; DB-intensive 50 req/10sec keyed by IP + path;
  `joinLookupLimit` 30 req/min on the public `/get-competition-by-code`
- CORS: localhost:3000-3003 plus `CLIENT_URL`. Helmet CSP allows unsafe-inline for React dev

## Database access

**Before writing anything, read `docs/testing-rules.md`.** This is the **live production
database** and there is no staging copy. **Organiser 50** (`aandreou25@gmail.com`) owns the
sandbox; every other competition belongs to a customer and is read-only unless the user names it
in that session.

**Ask which competition to test against — never reuse an id from a doc, a memory or an earlier
session.** Andreas creates a test competition, works through it and deletes it, so the sandbox is
a different competition week to week. No id is recorded here deliberately: competition 199 was
named as the sandbox in older docs and no longer exists, and its replacement will go the same way.
Organiser 50 is necessary but **not sufficient** — he also owns real competitions — so the answer
has to come from him, not from an ownership check.

**There is no MCP server for this project, deliberately.** Use the scripts, run from
`lmslocal-server/`:

```bash
node db/query.js "SELECT ..."     # read-only (enforced by a READ ONLY transaction)
node db/write.js "UPDATE ..."     # writes: one transaction, --dry-run, no-WHERE guard
```

`lmslocal-server/db/README.md` is the front door — it also lists the data landmines (the
`competition.status` casing inconsistency, what `fixture.result` actually holds, why
`player_progress` has more rows than `pick`), each of which costs an hour if met cold.

**Schema**: no checked-in schema file — ask the database, which is never out of date:

```bash
node db/query.js "SELECT column_name, data_type, is_nullable FROM information_schema.columns
                  WHERE table_name='competition' ORDER BY ordinal_position"
```

Table names are **singular**: `competition`, `round`, `pick`, `team`, `team_list`, `fixture`,
`fixture_load`, `fixture_block` / `fixture_block_item`, `app_user` (not `users`),
`competition_user` (membership, lives, admin flags), `player_progress` (outcomes by round),
`credit_purchases`, `audit_log`.

## Competition game logic

### Player rules
- **Picks**: one team per round, no reuse across rounds — until every team has been used, when
  they all come back. What a player may still pick is **derived from their own picks**, not
  stored; the only stored state is `competition_user.teams_reset_round`. The `allowed_teams` table
  was **dropped in Aug 2026** — it duplicated derivable state and had **three** rebuild
  implementations carrying **two** different definitions. `services/allowedTeams.js` is now the
  only definition; **do not reintroduce a stored copy**
- **Lock**: when all players have picked, at an admin-set time, or 1hr before kickoff
- **Outcome**: win = advance; draw or loss = eliminated; missed pick = life lost. Judged on
  **regulation time only** (90 minutes + stoppage)
- Players join by competition slug or access code

### Fixtures and results

Two worlds: `competition.fixture_service = true` (we supply fixtures) or false (the organiser
does). **Who supplies them is fixed at creation** — `update-competition` ignores it, the settings
screen does not offer it, and `set-fixture-service-organiser` is unregistered in `server.js`.
Change it in the database on request. A reset preserves it.

**Organiser-managed** competitions use the `organizer-*` routes. Their fixtures and results are
**one screen**, `/game/[id]/round`, driven by the state machine in `src/lib/roundState.ts` — read
`docs/round-state-machine.md` first. `/game/[id]/organizer-fixtures` survives only as the fixture
entry form and redirects to `/round` on automated competitions; `/game/[id]/organizer-results` is
gone.

**Fixture service** — staged in `fixture_load`, driven from `lmslocal-admin` → `/dashboard/fixtures`.
Staging: `/admin/add-staged-fixtures`, `get-staged-results`, `set-staged-result`,
`get-fixture-team-lists`. Opt-in per competition via `/admin/set-fixture-service`. Admin token on
all of it (`middleware/admin-auth.js`) — the old `12221` access code and the `BOT_MAGIC_2025` body
secret are gone from this path, the latter having shipped in the public web bundle.

**Everything goes out one competition at a time.** Fixtures:
`/admin/get-fixture-push-targets` + `/admin/push-fixtures-to-competition`. Results:
`/admin/get-push-targets` + `/admin/push-results-to-competition`, then `/admin/clear-staged-batch`
once every competition has been pushed. All **singular**. The two halves became per-competition
for different reasons — *results*: processing scales with player count and the old route did the
whole batch in one transaction, so a timeout anywhere rolled every competition back; *fixtures*:
the only thing keeping a mis-staged batch away from every customer was `FIXTURE_SERVICE_TEST_MODE`,
an env var naming one organiser's email that had to be set before testing and unset after, and
which silently starved real customers of fixtures while on. **That variable is gone from the
codebase** — delete it from `.env` if still there. Both plural routes
(`push-fixtures-to-competitions.js`, `push-results-to-competitions.js`) are deprecated,
**unregistered**, and kept on disk as frozen references — do not edit them or wire them back up.

**One staged batch at a time per team list** — `fixture_load` itself is the pending batch.
`add-staged-fixtures` refuses a new one while it is non-empty. Clearing is a deliberate step
(**Clear staged batch**) because the staged rows must survive until every competition has been
pushed to individually; it refuses while any competition is unfinished, unless forced. Every
fixture in a batch shares one kickoff time, which becomes the round's lock time, so a real Fri–Sun
gameweek is entered as several batches — **one round each**, since a round holding fixtures with
no results is `round_in_progress` and takes no further push. Untick "starts a new gameweek" on the
second and third.

**When a competition is ready for a round**: `evaluateCompetition` in `services/fixtureService.js`
— the one implementation, used by both the admin candidate list and the push, so the screen can
never offer a button the push then refuses. A skipped competition says which rule stopped it in
the push result's `reason`.

Every push needs the batch's earliest kickoff to be **in the future**; a passed kickoff would
create a round locked on arrival that nobody could pick in. A competition's **first** round needs
three more things, and only the first:

1. **`competition.ready_at` — the organiser has pressed Ready** on `/game/[id]/round`. We never
   ask them to predict a start date, because we cannot say when the next fixtures are. Nothing is
   pushed until they say so, however long that takes. Reversible until the first round exists
   (`/set-competition-ready`); a **reset clears it**, so an emptied competition goes back to
   waiting instead of taking the next batch with nobody told.
   **Pressing Ready publishes round 1 there and then** — `set-competition-ready` calls
   `pushFixturesToCompetition` itself in a second transaction after the flag commits, swallowing
   failure so the organiser's decision always sticks. Without it they were left "all set" beside a
   Play button that did nothing until an operator opened the admin screen.
   **So the button is only offered when a round is available** (`can_start` from
   `/get-competition-start-outlook`) — Ready means "start me on the round I can see", not a
   standing order. When they can't start, the card drops the button and says why: it names the
   current batch's kickoff and says to come back after it, or — when nothing is staged — says only
   that there is nothing ready, since no date exists to promise.
2. **`fixture_load.opens_gameweek`** — the batch must **start** a gameweek, not continue one.
   Otherwise a competition first eligible on the Saturday gets a round 1 of Sunday's two matches
   while everyone else plays a full slate. Nothing in the data distinguishes these, so
   `add-staged-fixtures` asks whoever stages the batch (checkbox, default true).
3. **now + 48 hours** (`FIRST_ROUND_LEAD_TIME_HOURS`) — someone pressing Ready on Friday afternoon
   must not be handed Saturday's matches before they have told anyone.

`/get-competition-start-outlook` runs the same evaluation for the organiser's own card, so the
date shown is the one the push would produce. `competition.earliest_start_date` is a **dead
column** from the old "wait N weeks" question — nothing reads or writes it.

**The forward calendar** (`fixture_block` / `fixture_block_item`, `/dashboard/fixtures/calendar`)
— read `docs/competition-start.md` first. `fixture_load` was doing two jobs: the calendar of what
is coming AND the batch going out now. Its one-batch-at-a-time rule is right for the second and
made the first impossible, which is why a new competition sat empty while its organiser recruited.
Blocks are the calendar: several at once, provisional, editable, keyed by hand weeks ahead.
**Stage** copies one into `fixture_load` (`/admin/promote-fixture-block`) and everything
downstream is unchanged. Routes: `/admin/get-fixture-blocks`, `add-fixture-block`,
`update-fixture-block`, `delete-fixture-block`, `promote-fixture-block`. Team validation is shared
with `add-staged-fixtures` via `services/fixtureBlock.js`, so a block cannot pass when keyed and
fail when promoted.

- **A competition created against a block has round 1 from the moment it exists** — real fixtures,
  a real lock time, provisional until the block is promoted. `create-competition` takes
  `start_block_id`, offered by `/get-competition-start-options` (up to three dates, no fixtures —
  the organiser picks *when*, not *which*, each shown as "in N days"). Two thresholds in
  `fixtureBlock.js`: `START_LEAD_TIME_HOURS = 1` decides what is offered, `DEFAULT_MIN_HOURS = 48`
  what is preselected — the soonest option unless it locks inside 48h
- **`add-staged-fixtures` creates a `fixture_block` for every batch it stages**, so the batch going
  out now is itself a start option, usually the soonest. There is one kind of thing, not "blocks
  and also batches". When that block is pushed, `pushFixturesToCompetition` **reconciles** the
  round rather than creating a second one, re-points picks by team, and clears `source_block_id`
- `reset-competition` asks the same question and rebuilds round 1 the same way — both go through
  `createRoundFromBlock`, and the organiser-facing chooser is one component,
  `lmslocal-web/src/components/StartDateChooser.tsx`
- **The `ready_at` gate is deliberately still there, permanently.** Not a legacy — it is the
  fallback for manual competitions, team lists with no calendar, a calendar with nothing far
  enough ahead, and the competitions already on it. The old rules are skipped for any competition
  that already has a round, which block-started ones always do, so the two run side by side. The
  Ready card hides itself: `isStartGateVisible` needs `phase === 'NO_ROUND'`
- Emails follow it: `created_comp` names the start date instead of the Ready button when round 1
  exists, and `services/shareReminder.js` warns the organiser 48h before joining closes

**Disabled routes**, preserved with a `.delete` extension: create-round, add-fixtures-bulk,
submit-results, update-round, reset-fixtures, set-fixture-result, get-calculated-fixtures,
organiser-mid-round-submit-tip.
