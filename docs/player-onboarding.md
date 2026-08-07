# Player onboarding

How a player gets from "someone told me about this" to "I am in the competition".

This doc is the contract. When a new scenario turns up ("what does a player see if they tap a
link for a competition they are already in, on a phone they have never signed in on?"), answer
it here first, then change the code to match.

Where the doc and the code disagree, this doc is right and the code is a defect — §7 lists the ones
already known, and which phase each belongs to. Phases 1 and 2 are done; §9 tracks the rest.

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
| **Spoken code** — heard at the bar, read off a poster | Four or five digits | Short, unambiguous, forgiving of case and whitespace |
| **Organiser-added** — the landlord adds them by hand | Nothing | Not a self-service flow at all; see §5.2 |

Link is the path that matters most and is currently the weakest — not because of what the URL
says, but because no QR code exists and the leaflet tells people to install the app first (§7,
defect 6). Spoken code is the path the system was built for and works. Organiser-added is out of
scope for changes (§5.2).

---

## 3. A competition has one identity

`competition.invite_code` is the only way a competition is identified publicly. It is both the
spoken code and the thing in the URL, because those are the same string and there is no benefit
in having two.

| Property | Rule |
|---|---|
| **Shape** | 4 digits today. Phase 5 moves new competitions to 5; matching is exact so mixed lengths will coexist with no migration. |
| **Generated** | Automatically at creation, exactly as now. The organiser is never asked and never sees a decision. |
| **Unique** | Across all *existing* competitions, enforced by a database constraint, not a retry loop. |
| **Lifetime** | Permanent for the life of the competition. **Never nulled.** |
| **Released** | Only when the competition row is deleted. |
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

### 4.3 A closed competition reveals nothing

When the gate says closed — for **any** reason, including the code not existing at all — the
response is identical:

> That code isn't working. Ask your organiser for the correct one.

No competition name, no venue, no organiser name, no player count, no indication of whether the
competition exists, has started, is full, or was never real.

This is what makes the permanent code safe. Codes are enumerable by construction — 90,000 of them
against a rate limit — but enumeration that returns nothing is not worth performing. **The lookup
route must therefore return competition details only when the gate says open.** Anything else is a
leak of the customer list.

The cost, accepted knowingly: a player who is genuinely too late gets no explanation. That is
tolerable because "ask your organiser" is the correct next action in every closed case, and it
routes them to the one person who can actually do something.

The known rough edge is `FULL`. The organiser is out of credits, the player bounces off a generic
message, and the organiser never finds out. **The organiser should be notified when someone is
turned away by their limit** — separate work, not part of this.

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
and none has been succeeded by another. `reset-competition.js` already restarts a competition in
place, keeping its row and therefore its code, which may be the whole answer.

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
| 2 | Register issues no token, so joining is three sequential requests: register, login, join. If register succeeds and login drops, the player has an account and is not in the competition. Recovery works but is confusing — retrying returns `EMAIL_EXISTS`, which switches them to the sign-in form and tells them an account already exists, seconds after they created it. | `join/[code]/page.tsx:175-212`, `register.js:193` | Open — Phase 4 |
| 3 | No unique constraint on `invite_code`. Uniqueness relied on a retry loop whose `SELECT` does not lock, so concurrent creations could collide. No duplicates ever existed. | `create-competition.js` | **Fixed** — Phase 1 |
| 4 | No index on `invite_code`, and the lookup was `WHERE UPPER(invite_code) = $1 OR UPPER(slug) = $1` — a sequential scan with a function, on a public endpoint. | `get-competition-by-code.js`, `join-competition-by-code.js` | **Fixed** — Phase 1 |
| 5 | The public lookup returned competition name, venue, organiser and player count for started and full competitions, not only open ones. Contradicted §4.3. | `get-competition-by-code.js` | **Fixed** — Phase 2 |
| 6 | The leaflet instructs players to install the app and type the code — no link, no QR. | `leaflet/[competitionId]/page.tsx:312` | Open — Phase 3 |
| 7 | A signed-in player who is already a member still has to press **Join** and wait for `ALREADY_JOINED` before being redirected. Should go straight in. | `join/[code]/page.tsx:366-402` | Open — Phase 4 |
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
| Closed, any reason | Any | The §4.3 message. Nothing created, no account made, nothing revealed. |

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

`get-competition-by-code` now returns `COMPETITION_NOT_FOUND` with no competition object for
started, full *and* nonexistent codes alike. `can_join`, `closed_reason` and `status` are gone from
the response: the reason is still computed, just never sent, because a discriminator is the whole
vulnerability. The frontend's `closed` stage was deleted rather than rewired — with the server
silent there is nothing to render — and the `not-found` copy now has to stay true of all three
cases, so it says nothing is *open* under this code rather than that no such competition exists.

Phase 1 made this urgent rather than merely planned. Nulling the code at lock had been dropping
started competitions out of this lookup as a side effect; competitions 149, 167, 161 and 168 are
the last that will ever have that. With codes now permanent, the set of matchable rows only grows,
so returning nothing when closed is the only thing keeping them private.

`FULL` is logged server-side (`console.warn`, with competition and organiser id). The generic
response means an organiser who is losing players to their credit limit will never hear it from
the player, and until they can be notified properly that log is the only trace.

**Phase 3 — Print and share.** QR code on the leaflet targeting the join URL, with the URL and
code printed underneath. Same QR on the promote screen for organisers who share digitally. Rewrite
the leaflet's join instructions away from app-first. Fixes defect 6. *Independent of Phases 1–2 and
the highest-value work in this doc — the QR points at the code either way.*

**Phase 4 — The join page, rebuilt.** One resolver, the §8 matrix, auth forms extracted from the
page component. Single-request join for both new and returning accounts, which means register must
return a token or a dedicated join route must exist. Pending-join survives a `/login` bounce. Fixes
defects 2 and 7.

**Phase 5 — Widen the code.** Move new competitions to 5 digits. No migration; existing 4-digit
codes keep working. Do this before the live-competition count makes collisions frequent, not after.

**Phase 6 — Registration trim.** Terms as inline consent rather than a checkbox, single screen,
sensible autofocus and `autocomplete`. Small, but it is the last thing between a player and the
competition.

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
