# Player onboarding

How a player gets from "someone told me about this" to "I am in the competition".

This doc is the contract. When a new scenario turns up ("what does a player see if they tap a
link for a competition they are already in, on a phone they have never signed in on?"), answer
it here first, then change the code to match.

Where the doc and the code disagree, this doc is right and the code is a defect — §7 lists the ones
already known, and which phase each belongs to. Phases 1–6 are done; only Phase 7 remains.

---

## 1. Why it is being revisited

Onboarding was built around one idea: the organiser gives out a 4-digit code, the player types
it in. Everything else grew around that.

The first pass at this doc concluded that the code was the problem — that `lmslocal.co.uk/join/1252`
reads badly in a WhatsApp message and needed a word-based slug alongside it. **That conclusion was
wrong**, and §6 records why in full. The short version: the code is fine at every job it has. What
was broken is that it *disappears* mid-life, and everything that felt wrong downstream was a
symptom of that.

The real defect is that `invite_code` is set to `NULL` when a competition starts, purely so that
`invite_code IS NULL` can be read elsewhere as "this competition has started". A field that
vanishes cannot be a durable link identity, so a second identity looked necessary. Give the
competition an honest has-started signal and the field stops vanishing, at which point one code
does the whole job for the life of the competition.

---

## 2. Arrival contexts

There are three ways a player arrives. The old code treats them as one flow with branches. They
are better understood as three, because they want different things:

| Context | Player is holding | Requirement |
|---|---|---|
| **Link or QR** — WhatsApp, a leaflet, the organiser's own social post | A URL with the code in it | Never type anything. Tap or scan, confirm, in. |
| **Spoken code** — heard at the bar, read off a poster | Five digits, or four on older competitions | Short, unambiguous, forgiving of case and whitespace |
| **Organiser-added** — the landlord adds them by hand | Nothing | Not a self-service flow at all; see §5.2 |

Link is the path that matters most. It was the weakest — not because of what the URL says, but
because the leaflet's QR codes pointed at app stores and its first instruction was to install one
(defect 6, fixed in Phase 3). Spoken code is the path the system was built for and works.
Organiser-added is out of scope for changes (§5.2).

The join page behind it is now one request for a new account and a straight-through redirect for
an existing member (Phase 4).

---

## 3. A competition has one identity

`competition.invite_code` is the only way a competition is identified publicly. It is both the
spoken code and the thing in the URL, because those are the same string and there is no benefit
in having two.

| Property | Rule |
|---|---|
| **Shape** | 5 digits. Competitions created before Phase 5 keep their 4; matching is exact, so the two lengths coexist and no migration was needed. |
| **Generated** | Automatically at creation, exactly as now. The organiser is never asked and never sees a decision. |
| **Unique** | Across all *existing* competitions, enforced by a database constraint, not a retry loop. |
| **Lifetime** | Permanent for the life of the competition. **Never nulled.** |
| **Released** | Only when the competition row is deleted. A reset keeps it — see §3.1. |
| **Editable** | Not yet. See §6.3 for the deliberately deferred option. |

### 3.1 Why it must not be recycled while the competition exists

This is the constraint everything else follows from.

If a code returns to the pool while the competition it names still exists, a poster printed with
`/join/1252` does not go stale — it goes **wrong**. Red Barn's competition starts, 1252 is
released, Nags Inn is issued 1252 next month, and Red Barn's old poster now walks people into
Nags Inn's competition and invites them to join it.

That is worse than a dead link, and it is invisible to everyone involved. So: while the
competition exists, its code is its own. Deleting a finished competition frees the code, and that
is acceptable because the competition it pointed at is genuinely gone.

**A reset does not end a competition, so it keeps its code.** `reset-competition.js` used to issue
a fresh one, which silently killed every poster and QR already printed — the same failure as
recycling, arriving through the back door on the one action an organiser takes between seasons.
Fixed in Phase 5.

### 3.2 Why the namespace is not under pressure

Finished competitions are deleted as a matter of routine, so the code space is bounded by the
number of competitions **alive at once**, not by the number ever created. Five digits gives 90,000
of those. The pool does not need recycling to survive, which is what makes §3.1 affordable.

### 3.3 The `slug` column is gone

`competition.slug` was the intended second identity under the rejected design. It was `NULL` on
every row for its whole existence, and was dropped in Phase 1 along with every read of it. The
resolver matches one column.

Recorded because the name still appears in `emailService.js`'s unused `sendPlayerMagicLink` and in
the dead `playerApi` block (§7.1), where it is a function argument rather than the column.

---

## 4. The join gate

Three routes independently decide whether a player may join. They must agree exactly. If a rule
changes here, it changes in all three:

- `routes/get-competition-by-code.js` — the public pre-join lookup
- `routes/join-competition-by-code.js` — the actual join
- `routes/add-offline-player.js` — the organiser adding someone by hand

### 4.1 The rules

| Condition | Outcome |
|---|---|
| No competition matches the code | Closed |
| Latest round number > 1 | Closed |
| Round 1 exists and its lock time has passed | Closed |
| Organiser at `FREE_PLAYER_LIMIT` across all their competitions with 0 credits | Closed |
| Otherwise | Open |

Player capacity is counted across **all** of the organiser's competitions, not just this one,
because that is how billing works. The lookup and the join both compute it the same way; they
must continue to.

### 4.2 The window is exactly `SETUP`

A competition is open to new players for precisely as long as its status is `SETUP`. `SETUP` ends
when round 1's lock time passes, which is the same instant joining closes. One window, one
meaning.

**But `status` is not the authority.** The `SETUP → ACTIVE` transition is a stored value written
after the fact, so between the moment a round locks and the moment the transition runs, the column
reads `SETUP` for a competition that has started. A gate that trusts the column lets people join
after lock.

So the gate computes the condition live from round 1's lock time, per the table above, and treats
`status` as a denormalised mirror for display and reporting. Same rule, two representations, only
one of them trustworthy at any given instant. The nightly sweep
(`scripts/sync-competition-status.js`) shrinks the window of disagreement from "until the organiser
next logs in" to "at most a day", which matters for admin reporting — but it never makes the column
safe to gate on, and no amount of scheduling would.

### 4.3 What a closed competition reveals

The line is **recoverable or not**, not leak or no-leak.

| Closed because | Response | Why |
|---|---|---|
| No such code | `COMPETITION_NOT_FOUND`, nothing attached | — |
| Started | `COMPETITION_NOT_FOUND`, nothing attached | Nothing recovers it. That competition will never take this player, so saying so achieves nothing |
| **Full** | `COMPETITION_FULL` **naming the organiser** | One credit purchase away from letting them in. Silence destroys the recovery |

Withholding an *unrecoverable* state costs nothing, because there is no action to prompt.
Withholding a *recoverable* one loses a player, a sale, and an organiser who never learns why their
competition stopped growing. Started and nonexistent must stay indistinguishable **from each
other** — the moment they differ, the code space becomes a directory of every venue on the
platform. Codes are enumerable by construction; enumeration that returns nothing is not worth
performing.

This matters more than it did. Nulling the code at lock used to drop started competitions out of
the lookup as a side effect. Competitions 149, 167, 161 and 168 are the last that will ever have
that — with codes now permanent (§3.1), the set of matchable rows only grows, and returning nothing
is the only thing keeping them private.

**The organiser's display name on `FULL` is the one identifying detail any closed response gives
up.** Weighed and chosen: a message naming someone to go and ask is something a player can act on,
and it reads as human rather than broken. It is a real, deliberate narrowing of §4.3's original
absolutism.

The accepted cost: a player who is genuinely too late gets no explanation. Tolerable, because "ask
your organiser" is the right next action in every unrecoverable case anyway.

### 4.3.1 The organiser is told too

Telling the player is necessary but not sufficient — many will not pass the message on, and the
organiser is the only person who can fix it.

Every block is recorded in `join_block` (`services/joinBlock.js`), written from the public lookup
and from `join-competition-by-code`'s race path, and surfaced on the dashboard as *"3 people tried
to join EKRR AFC this week and couldn't"* beside an **Add credits** button. It replaces the generic
credit banner rather than stacking with it.

Three constraints that shaped it, all still binding:

- **Nothing identifying the player.** This is written from a public, unauthenticated endpoint. No
  IP, no user agent. A salted IP hash would still be personal data under GDPR and would buy
  precision the message does not want.
- **The count is a floor, never a headcount.** Repeats inside ten minutes collapse to one row —
  which also bounds how fast strangers can grow the table — but two real players arriving five
  minutes apart also collapse, and anyone who never opened the link is invisible. The copy says
  "people tried" and must never imply precision.
- **The dashboard lookup is wrapped and must stay wrapped.** It is an enrichment for a banner;
  `get-user-dashboard` is the most-called authenticated route in the product and must not gain a
  new way to fail for it.

Pruned to 90 days nightly by `scripts/prune-join-blocks.js` — a public endpoint writing to an
unbounded table needs an upper limit.

### 4.4 Why the lookup happens before identity

A player arriving from a poster has a code and nothing else. Making them create an account before
telling them whether the code is even real means a typo costs them the entire journey. So: resolve
the competition first, show them what they are joining, then deal with identity.

The existing page gets this right and it should survive any rewrite.

---

## 5. Scope decisions

Recorded here so they are not relitigated every time someone reads this doc.

### 5.1 Latecomers hit a dead end

A player arriving after round 1 locks cannot join, cannot spectate, and is not added in any
reduced state. They get the §4.3 message and nothing else.

Spectator and join-as-eliminated were both considered and rejected. Either would put a player in
`competition_user`, which is the billing unit — the organiser would be charged for someone who
cannot play.

### 5.2 No guest claim path

`add-offline-player.js` creates accounts with generated `{id}@lms-guest.com` addresses for players
the organiser enters by hand. Those players have no way to take the account over later, and that
stays true. They are offline players by definition; the organiser is their interface to the
competition.

### 5.3 Web only

The Flutter app can join by code once you are signed in
(`user_remote_data_source.dart:153`) but has no deep-link handling, so a `/join/...` link opens
the web. That is fine and stays that way for now. The app is for players who are already in.

**Consequence for print:** the leaflet must stop leading with "download the app". Asking someone
to install an app, register in it, sign in, and then type a code is the highest-friction path in
the system aimed at the least patient audience. QR to web, with the URL and code printed
underneath.

### 5.4 No magic links

Passwordless email sign-in is explicitly not being built.

- Outbound email is currently redirected to a test inbox, so an email-dependent join flow would
  not work at all today
- `register.js:165` auto-verifies every account and sends nothing, so there is no existing email
  dependency in the join path to build on — this would be introducing the first one
- A season runs 20+ weeks. Players change phones. A password they can reset is the boring thing
  that keeps working

### 5.5 Competition display names are the player's, not the organiser's

Players rename competitions on their own dashboard. Twelve organisers all calling it "Premier
League LMS" costs the player nothing, because they see whatever they typed.

This has a consequence for everything above: **the code is never a display name.** A player reads
it once, at the moment they tap or type it, and never again. It does not need to be meaningful,
memorable after the fact, or distinguishable by a human from any other competition's. It needs to
survive a WhatsApp message and be sayable across a noisy bar. Nothing more.

---

## 6. Rejected alternatives

### 6.1 A word slug alongside the code

`competition.slug`, derived from venue and competition name, globally unique, used for links while
the code stayed spoken-only: `lmslocal.co.uk/join/red-barn-winter`.

Rejected. The case for it was that the digit URL looks untrustworthy in a WhatsApp message, which
is an aesthetic claim with no evidence behind it — and most of the trust in a link comes from the
domain rather than the last path segment. The real argument was that a *recycled* code cannot be a
durable link, which is true, and is solved far more cheaply by not recycling it (§3.1).

What it would have cost: derivation rules, a reserved-word list, collision suffixes, a backfill, a
freeze rule, an edit surface, and a resolver matching two columns instead of one — all to change
how one URL looks in one channel.

**What would bring it back:** an organiser wanting printed material that survives into a *new*
competition. A slug does not solve that either — see §6.2.

### 6.2 An organiser-level namespace

`/join/red-barn/winter`, where the venue owns a permanent slug and competitions sit inside it, so
a beer mat outlives any single competition.

Rejected, and this one is worth understanding because it is seductive.

It fits the Red Barn and it fits a series like `LMS 501`, `502`, `503`. It does not fit Paul, who
runs a competition for an under-11s team and does not have an "organisation" in his head at all —
his two competitions are named `Marshfield JYFC` and `Marshfield U11's`, which is one club labelled
twice because we asked twice. Most organisers have exactly one competition and would be answering a
question about a concept that does not exist for them.

It also cannot be derived, only asked: `app_user` has no venue field, `display_name` is a person's
name, and `competition.venue_name` is empty for most organisers and inconsistent where present. So
it means a new decision in the flow of an organiser who wants to create a competition and tell
their friends — friction placed on exactly the people the project depends on.

The problem it solves is real but not present: only two competitions have ever reached `COMPLETE`,
and none has been succeeded by another. `reset-competition.js` restarts a competition in place,
keeping its row and — since Phase 5 — its code, so printed material survives a season rollover.
That may be the whole answer.

*This paragraph originally claimed reset already kept the code. It did not; it generated a new one
on every reset. The claim was load-bearing for rejecting an organiser namespace, so it was made
true rather than quietly dropped.*

**What would bring it back:** an organiser actually asking how to keep their poster across
seasons, and `reset-competition` turning out to be the wrong model for it. Adding a second path
segment later does not break a one-segment URL, so nothing here is painted into a corner.

### 6.3 Letting the organiser choose a word code

Allowing `invite_code` to hold `red-barn` instead of `48213`, checked for availability, offered on
the promote screen.

Deferred rather than rejected. It is cheap once the field is already unique and permanent, and it
is opt-in, so it adds no friction to organisers who do not care. But it is cosmetic, it weakens
§4.3 slightly (a guessable word confirms a competition exists where a random number does not), and
nobody has asked for it. Revisit once the work in §8 is done and there is evidence anyone wants it.

### 6.4 Freeing codes on a delay

Nulling the code 60 days after the competition starts, rather than at lock or not at all.

Rejected. It still recycles, so it still produces the §3.1 failure — just later, when nobody is
watching for it — and it buys that by adding a scheduled job. It is the worst of both options.

---

## 7. Known defects

Numbers are stable and referenced from §9. Fixed entries stay in the table rather than being
renumbered out of it.

| # | Defect | Location | Status |
|---|---|---|---|
| 1 | `invite_code IS NULL` is overloaded as the "has started" flag, which is why the code is nulled at all. One field, two meanings, and the root of the rejected redesign. There was exactly **one** reader — the guard on changing `lives_per_player` and `no_team_twice` — so this needed no new column, only that line computing from round 1's lock time like everything else does. | `update-competition.js`, `get-user-dashboard.js` | **Fixed** — Phase 1 |
| 2 | Register issued no token, so joining was three sequential requests: register, login, join. If register succeeded and login dropped, the player had an account and was not in the competition. | `join/[code]/page.tsx`, `register.js` | **Fixed** — Phase 4 |
| 3 | No unique constraint on `invite_code`. Uniqueness relied on a retry loop whose `SELECT` does not lock, so concurrent creations could collide. No duplicates ever existed. | `create-competition.js` | **Fixed** — Phase 1 |
| 4 | No index on `invite_code`, and the lookup was `WHERE UPPER(invite_code) = $1 OR UPPER(slug) = $1` — a sequential scan with a function, on a public endpoint. | `get-competition-by-code.js`, `join-competition-by-code.js` | **Fixed** — Phase 1 |
| 5 | The public lookup returned competition name, venue, organiser and player count for started and full competitions, not only open ones. Contradicted §4.3. | `get-competition-by-code.js` | **Fixed** — Phase 2 |
| 6 | The leaflet instructed players to install the app and type the code. Its two QR codes pointed at app stores; `join_url` was fetched but unused. | `leaflet/[competitionId]/page.tsx` | **Fixed** — Phase 3 |
| 7 | A signed-in player who was already a member still had to press **Join** and wait for `ALREADY_JOINED` before being redirected. | `join/[code]/page.tsx` | **Fixed** — Phase 4 |
| 8 | `SETUP → ACTIVE` was written only on organiser dashboard load, so a competition that had started read `SETUP` until its organiser next signed in — indefinitely, if they never did. Admin reporting counts by `status` and undercounted started competitions as a result. | `get-user-dashboard.js` | **Fixed** — Phase 1 |
| 9 | `load-competition-announcement.js` selected `access_code`, a column that does not exist, so the query threw on every call and no announcement email could be sent. The same path built a join URL as `/competition/{slug}`, a route that does not exist. | `load-competition-announcement.js`, `emailService.js` | **Fixed** in passing — both blocked the `slug` drop. The wider email rewrite is still separate; see §9. |
| 10 | `competition_user` carries five overlapping indexes on `(competition_id)` and `(competition_id, user_id)`. Harmless but wasteful on write. | schema | Open — Phase 7 |

### 7.1 Dead code found alongside, deliberately left

- `emailService.js` exports `sendPlayerMagicLink`, which nothing calls. It belongs to the
  magic-link approach ruled out in §5.4.
- `api.ts` exports a whole `playerApi` block — `player-login`, `join-competition-by-slug`,
  `register-and-join-competition`. All three routes are commented out in `server.js` and nothing
  in the frontend imports it.

Neither blocks anything. Removing them is a decision about the parked magic-link question, not
about onboarding.

---

## 8. Target behaviour

Given a resolved competition and an arriving player:

| Competition | Player | Behaviour |
|---|---|---|
| Open | Signed in, already a member | Straight to `/game/[id]`. No card, no button, no confirmation. |
| Open | Signed in, not a member | Show the card. One button. Joining is a deliberate act, so it is confirmed — this is the one place a tap is correct. |
| Open | Signed out, has an account | Card, then sign in, then join — **one** request, landing in the competition. |
| Open | Signed out, no account | Card, then create account and join in **one** request. |
| Open | Stale token | Treat as signed out. Fall back to the form in place, code still in the URL. Never bounce to `/login`. |
| Started, or no such code | Any | The generic §4.3 message. Nothing created, no account made, nothing revealed — the two are indistinguishable. |
| Full | Any | Told it is full, and who to ask. Nothing created. The block is recorded and shown to the organiser (§4.3.1). |

Cross-cutting: if a player is ever sent to `/login`, the pending join must survive the round trip
and complete on return. Losing the code because someone took a phone call is the worst kind of
drop-off — they had already decided to join.

---

## 9. Plan

Ordered by friction removed per unit of work. Each phase is independently shippable.

**Phase 1 — Make the code durable. ✅ DONE, deployed 7 Aug 2026** (`56c8fa7`, `cd3b1fc`).
Fixed defects 1, 3, 4, 8, and 9 in passing.

1. **One unique functional index**, `idx_competition_invite_code` on `UPPER(invite_code)`. This
   single object does uniqueness *and* serves the existing `WHERE UPPER(invite_code) = $1` lookup,
   so no query had to change. `UPPER()` is deliberately **kept**, not dropped: it is a no-op on
   today's all-digit codes, but the field is free to hold `REDBARN25` one day and case-insensitive
   matching should not have to be reintroduced when it does. Case-insensitive uniqueness also stops
   `REDBARN25` and `redbarn25` coexisting. Built without `CONCURRENTLY` — at 16 rows the write lock
   is milliseconds, and `db/write.js` wraps everything in one transaction, which `CONCURRENTLY`
   cannot run inside.
2. **The constraint is a backstop, not a gate.** `create-competition.js` keeps its retry loop and
   catches `23505` on that index, treating it as "that code went, pick another". The race the
   constraint closes must never surface to an organiser as a failed creation — that would be a
   worse defect than the one being fixed. The `INSERT` sits inside a `SAVEPOINT`, which is
   load-bearing rather than tidy: a constraint violation aborts the enclosing transaction, so
   without one every statement after the first collision fails and the retry is decorative.
3. **`update-competition.js` computes hasStarted from round 1's lock time** instead of reading a
   nulled code. No new column.
4. **Stopped nulling `invite_code`.** The guard in `get-user-dashboard.js` was doing double duty as
   "has not transitioned yet" and became `AND status = 'SETUP'`. The candidate filter moved from
   the code's presence to `status === 'SETUP'` for the same reason — with the code never
   disappearing, filtering on it would stop narrowing anything and re-check round 1 for every
   competition on every dashboard load, finished ones included.
   **Still to check:** any UI offering to share the code must key off status, or it will invite
   sharing for a competition nobody can join. Not audited.
5. **Dropped the `slug` column** and every read of it. Done as a separate step *after* the code
   deploy: five routes selected it, including `get-user-dashboard`, so dropping first would have
   taken down the dashboard for every user.
6. **A nightly status sweep**, `scripts/sync-competition-status.js`, run by the VPS crontab at
   `30 3 * * *` (04:30 BST — the server clock is GMT). A script rather than a scheduled HTTP call
   because every other cron job on that box is `cd /apps/production/<app> && node scripts/<x>.js`
   and none use curl. `POST /sync-competition-status` survives as an on-demand trigger behind
   `verifyServiceToken`; both call `services/competitionStatus.js` so they cannot drift. It sets
   `ACTIVE` on any `SETUP` competition whose round 1 lock time has passed. This is a *reporting*
   fix — see §4.2 for why the join gate still must not read the column.

*Nothing was eligible for promotion at deploy time — the earliest round 1 lock was 20 Aug 2026 — so
the sweep's first runs correctly report nothing. A quiet run is the normal case, not a fault.*

**Phase 2 — Close the lookup. ✅ DONE.** Fixed defect 5.

`get-competition-by-code` returns `COMPETITION_NOT_FOUND` with no competition object for started
and nonexistent codes alike. `can_join`, `closed_reason` and `status` are gone from the response:
the reason is still computed, just never sent, because a discriminator is the whole vulnerability.
The frontend's `closed` stage was deleted rather than rewired — with the server silent there was
nothing to render.

Phase 1 made this urgent rather than merely planned; see §4.3 for why.

**Phase 2a — The full case, corrected. ✅ DONE.** Not in the original plan.

The first cut collapsed `FULL` into the same silence, which was wrong and was actively costing
money: organiser 1047 was at exactly 20 players with 0 credits, so their open competition (172,
round 1 locking 21 Aug) turned away everyone who scanned the poster, and they had no way to know.
`COMPETITION_FULL` now says so and names the organiser, and every block is recorded and shown to
them on the dashboard. §4.3 and §4.3.1 carry the reasoning and the three constraints that still
bind.

Two follow-ons, deliberately not built: nothing tells the organiser in the moment (the dashboard is
pull, not push — it waits for them to log in), and a player who bounces is not offered any way to
be told when space opens. Both are real, neither is urgent while the numbers are this small.

**Phase 3 — Print and share. ✅ DONE.** Fixed defect 6.

The leaflet already generated two QR codes and already fetched `join_url`. The codes pointed at the
App Store and Google Play; `join_url` was never used. So the sheet's first instruction was
"Download or open the LMS Local app" — install, register, sign in, then find the code again, four
things before seeing the competition. On paper it was worse than in principle: two codes side by
side compete, and scanning the wrong one lands you in an app store with no idea what the
competition was.

Now one QR, straight to the join page, with the URL printed underneath for anyone who cannot or
will not scan. Error correction is `H` rather than the default — this ends up creased and
photographed at an angle in a pub. Instructions are two steps, neither of which is installing
anything, with the app mentioned in passing for players already in (§5.3).

The same QR is on the promote screen, downloadable as a PNG for organisers who put it on their own
poster or a pub TV, shown on the same terms as the leaflet link — once joining closes, a QR nobody
can act on is worse than none.

*Not done:* the generated invitation image (`/api/generate-invite-image`) still carries only the
code, no QR. A scannable Facebook post is worth more than a typed code, but it is server-side image
generation and a separate piece of work.

**Phase 4 — The join page. ✅ DONE.** Fixed defects 2 and 7.

`register.js` now issues a JWT — same payload, same lifetime as `login.js`, and the token policy in
CLAUDE.md applies to both. Creating an account and using it is one request instead of two, so the
window where a player had an account but no membership is gone. Accounts were already auto-verified,
so the extra step had nothing to check.

`get-join-status` answers only "am I already in this one?", fired **alongside** the public lookup
rather than after it, so an existing member is redirected with no added latency and never sees a
Join button for something they already joined.

It is a separate route rather than optional auth on `get-competition-by-code`, and should stay one.
That route is deliberately unauthenticated and deliberately silent about competitions nobody can
join; membership is meaningless without an identity and is only ever disclosed to the person it is
about. Two concerns in one handler is how a future edit leaks one through the other's branch.

*Pending-join across a `/login` bounce needed nothing:* the page never sends anyone to `/login`.
A stale token falls back to the form in place with the code still in the URL — `/join` is in the
context's `PUBLIC_PATH_PREFIXES` and the `auth-expired` handler only clears state. Not bouncing is
the stronger version of surviving a bounce.

*Auth forms were not extracted.* The plan called for it, but the form shares ten pieces of state
with the page it sits in — mode, the four fields, busy, error, and the submit handler. Passing that
across a component boundary is more coupling than it removes, not less. Revisit if the page grows a
third mode.

**Phase 5 — Widen the code. ✅ DONE.**

New competitions get 5 digits — 90,000 against the number alive at once, since finished ones are
deleted and release their codes. Existing 4-digit codes keep working untouched: matching is exact,
so the lengths coexist and nothing needed migrating. Nothing in either frontend or the Flutter app
constrained a code's length, so there was nothing else to change.

The larger find was `reset-competition.js`, which held a **second copy of the code generator** —
4-digit, case-sensitive pre-check, no reserved-code list, and no `23505` retry. That last one was a
regression Phase 1 introduced: before the unique index a race there produced a rare duplicate,
after it the organiser got `SERVER_ERROR` mid-reset.

It is gone rather than fixed, because a reset should not issue a new code at all (§3.1). That
leaves one generator in the codebase, which is why widening was a one-line change.

**Phase 6 — Registration trim. ✅ DONE.**

Consent is stated rather than ticked, on `/register` and on the join page's signup. A checkbox
whose only valid answer is yes stops people without informing them, and the server validates
neither `acceptTerms` nor `confirmPassword` — it never has.

`/register` loses its confirm-password field. It guards a typo you cannot see, but the password can
be revealed with the toggle directly above it and a forgotten one is a reset away. The join page's
signup never had one, so the two disagreed and the shorter version was already in production.

`/register` also stops bouncing to `/login`. It used to redirect with "Account created. Sign in to
get going" — asking someone to prove who they were seconds after telling us, for an account that is
auto-verified and so had nothing to prove. It uses the token from Phase 4 and lands on `/dashboard`,
the same place `/login` goes. Not a new destination, just the existing one reached without a detour.

`autoFocus` on `/register` only, where the page *is* the form. **Not** on the join page: the
competition card sits above that form, and focusing an input scrolls past the venue and organiser
name the player needs in order to know they are joining the right thing — which is the whole reason
§4.4 puts the card first.

**Phase 7 — Tidy.** Drop the duplicate `competition_user` indexes. Fixes defect 10.

The announcement email path is being replanned and rewritten separately. Defect 9 was fixed only
because it blocked the `slug` drop — that route now runs at all, which it previously could not.
Nothing further about that path is owned by this doc.

---

## 10. Testing

Per `docs/testing-rules.md`, this is the live production database. Competition **199** (organiser
50) is the sandbox; **200** and **204** are also organiser 50 and in `SETUP`, which covers the open
case. 199 is `ACTIVE`, which covers the started case.

The `FULL` case needs an organiser at the free limit with no credits and cannot be reproduced on
199 without touching billing state — test that path against the lookup logic directly rather than
by manufacturing it in the database.

Do not create test competitions under any other organiser. 170 belongs to a customer and is one
keystroke from 199.
