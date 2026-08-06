# Player onboarding

How a player gets from "someone told me about this" to "I am in the competition".

This doc is the contract. When a new scenario turns up ("what does a player see if they tap a
link for a competition they are already in, on a phone they have never signed in on?"), answer
it here first, then change the code to match.

The current implementation predates the thinking in this doc. Where the two disagree, this doc
is right and the code is a defect — §6 lists the ones already known.

---

## 1. Why it is being revisited

Onboarding was built around a single idea: the organiser gives out a 4-digit code, the player
types it in. Everything else grew around that. A direct link exists (`/join/[code]`) but it
carries the same 4 digits, so the link reads `lmslocal.co.uk/join/1252` — unmemorable, and in a
WhatsApp message it looks like something you should not tap.

The 4-digit code is not the problem. It is genuinely good at the job it was designed for:
being said out loud across a noisy bar. The problem is that it is also being used as the link
identity, which is a different job with different requirements, and it is bad at that one.

---

## 2. Arrival contexts

There are three ways a player arrives. The old code treats them as one flow with branches. They
are better understood as three, because they want different things:

| Context | Player is holding | Requirement |
|---|---|---|
| **Link** — WhatsApp, QR on a leaflet, organiser's own social post | A URL with the competition in it | Never type anything. Tap, confirm, in. |
| **Spoken code** — heard at the bar, read off a poster | Four digits | Short, unambiguous, forgiving of case and whitespace |
| **Organiser-added** — the landlord adds them by hand | Nothing | Not a self-service flow at all; see §5.2 |

Link is the path that matters most and is currently the weakest. Spoken code is the path the
system was built for and works. Organiser-added is out of scope for changes (§5.2).

---

## 3. A competition has two identities

This is the central change. Stop making one field do both jobs.

| Field | Job | Shape | Where it appears |
|---|---|---|---|
| `competition.invite_code` | **Spoken.** Said out loud, typed by hand. | 4 digits | Poster, leaflet, "code 1252", landing-page join strip |
| `competition.slug` | **Linked.** Never typed, only tapped or scanned. | Words, hyphenated | `lmslocal.co.uk/join/red-barn-lms`, QR targets, WhatsApp templates |

Both resolve through one lookup. Both must be unique. Neither replaces the other.

`slug` already exists on the table and `get-promote-data.js:142` already prefers it when building
`join_url` — it has simply never been populated, so every competition falls through to the digits.
The column is not new work; filling it is.

**Rules for slug generation:**

- Derived from venue name and competition name at creation, lowercased, hyphenated, ASCII only
- Must be unique across all competitions, ever — including finished ones, so old links never
  resolve to a stranger's competition
- Collisions get a numeric suffix (`red-barn-lms-2`), not a random string
- Organiser can edit it in competition settings while the competition is in `SETUP`
- Once round 1 locks it is frozen — printed material is already out there

**Backfill:** every existing competition needs one generated. Around 15 rows, so a one-off script
rather than a migration with logic in it.

---

## 4. The join gate

Three routes independently decide whether a player may join. They must agree exactly. If a rule
changes here, it changes in all three:

- `routes/get-competition-by-code.js` — the public pre-join lookup
- `routes/join-competition-by-code.js` — the actual join
- `routes/add-offline-player.js` — the organiser adding someone by hand

### 4.1 The rules

| Condition | Outcome | `closed_reason` |
|---|---|---|
| No competition matches the code or slug | Not found | — |
| Latest round number > 1 | Closed | `STARTED` |
| Round 1 exists and its lock time has passed | Closed | `STARTED` |
| Organiser at `FREE_PLAYER_LIMIT` across all their competitions with 0 credits | Closed | `FULL` |
| Otherwise | Open | `null` |

Player capacity is counted across **all** of the organiser's competitions, not just this one,
because that is how billing works. The lookup and the join both compute it the same way; they
must continue to.

### 4.2 Why the lookup happens before identity

A player arriving from a poster has a code and nothing else. Making them create an account
before telling them whether the code is even real means a typo costs them the entire journey.
So: resolve the competition first, show them what they are joining, then deal with identity.

The existing page gets this right and it should survive any rewrite.

### 4.3 What the public lookup may return

Only what is already printed on the organiser's promotional material: competition name, venue,
organiser display name, player count. **No player names, no contact details, and never the
invite code echoed back.**

Enumeration is mitigated, not prevented: `joinLookupLimit` allows 30 lookups a minute per IP
against a 10,000-code space, and `invite_code` is set to `NULL` once round 1 locks so only
competitions still open to new players are visible at all. Slugs are not enumerable in any
practical sense, which is a second reason to prefer them.

---

## 5. Scope decisions

Recorded here so they are not relitigated every time someone reads this doc.

### 5.1 Latecomers hit a dead end

A player arriving after round 1 locks cannot join, cannot spectate, and is not added in any
reduced state. They get the "has started" page: what happened, and to ask the organiser about the
next one.

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

---

## 6. Known defects in the current implementation

Found during survey. Each is a real problem independent of any redesign.

| # | Defect | Location |
|---|---|---|
| 1 | Register issues no token, so the join page calls register then login as two requests. If register succeeds and login fails, the player has an account and is **not** in the competition, with no path back. | `join/[code]/page.tsx:175-206`, `register.js` |
| 2 | No index on `invite_code` or `slug`, and the lookup is `WHERE UPPER(invite_code) = $1 OR UPPER(slug) = $1` — a sequential scan with a function, on a public endpoint. | `get-competition-by-code.js:103`, `join-competition-by-code.js:93` |
| 3 | No unique constraint on `invite_code`. Uniqueness relies on a retry loop whose `SELECT` does not lock, so concurrent creations can collide. No duplicates exist today. | `create-competition.js:211-231` |
| 4 | `slug` is empty on every competition, so the preferred link identity never activates. | schema / `get-promote-data.js:142` |
| 5 | `invite_code` is nulled lazily, only when the organiser happens to load their dashboard. A started competition stays publicly lookupable until then. Joining is still correctly blocked, so this is exposure, not a hole. | `get-user-dashboard.js:299` |
| 6 | `invite_code IS NULL` is overloaded as the "has started" flag. One field, two meanings. | `update-competition.js:271` |
| 7 | A signed-in player who is already a member still has to press **Join** and wait for `ALREADY_JOINED` before being redirected. Should go straight in. | `join/[code]/page.tsx:366-402` |
| 8 | The leaflet instructs players to install the app and type the code — no link, no QR. | `leaflet/[competitionId]/page.tsx:312` |
| 9 | `competition_user` carries five overlapping indexes on `(competition_id)` and `(competition_id, user_id)`. Harmless but wasteful on write. | schema |

---

## 7. Target behaviour

Given a resolved competition and an arriving player:

| Competition | Player | Behaviour |
|---|---|---|
| Open | Signed in, already a member | Straight to `/game/[id]`. No card, no button, no confirmation. |
| Open | Signed in, not a member | Show the card. One button. Joining is a deliberate act, so it is confirmed — this is the one place a tap is correct. |
| Open | Signed out, has an account | Card, then sign in, then join — **one** request, landing in the competition. |
| Open | Signed out, no account | Card, then create account and join in **one** request. |
| Open | Stale token | Treat as signed out. Fall back to the form in place, code still in the URL. Never bounce to `/login`. |
| Started | Any | "Has started" page. Nothing created, no account made. |
| Full | Any | "Full" page, naming the organiser as the person who can fix it. |
| Not found | Any | "That code is not working", with the possibility that the competition has started. |

Cross-cutting: if a player is ever sent to `/login`, the pending join must survive the round trip
and complete on return. Losing the code because someone took a phone call is the worst kind of
drop-off — they had already decided to join.

---

## 8. Plan

Ordered by friction removed per unit of work. Each phase is independently shippable.

**Phase 1 — Slugs.** Add unique indexes on `invite_code` and `slug`. Generate a slug on
competition creation. Backfill existing competitions. Make the resolver index-friendly (store
normalised, drop the `UPPER()` on the column side). Fixes defects 2, 3, 4.

**Phase 2 — Print and share.** QR code on the leaflet targeting the slug URL, with URL and
4-digit code printed underneath. Same QR on the promote screen for organisers who share digitally.
Rewrite the leaflet's join instructions away from app-first. Fixes defect 8.

**Phase 3 — The join page, rebuilt.** One resolver, the §7 matrix, auth forms extracted from the
page component. Single-request join for both new and returning accounts, which means register
must return a token or a dedicated join route must exist. Pending-join survives a `/login` bounce.
Fixes defects 1 and 7.

**Phase 4 — Registration trim.** Terms as inline consent rather than a checkbox, single screen,
sensible autofocus and `autocomplete`. Small, but it is the last thing between a player and the
competition.

**Phase 5 — Tidy.** Null `invite_code` on a schedule instead of on dashboard load. Introduce a
real "has started" signal and stop overloading `invite_code IS NULL`. Drop the duplicate
`competition_user` indexes. Fixes defects 5, 6, 9.

---

## 9. Testing

Per `docs/testing-rules.md`, this is the live production database. Competition **199** (organiser
50) is the sandbox; **200** is also organiser 50 and in `SETUP`, which covers the open case.
199 is `ACTIVE`, which covers the started case.

The `FULL` case needs an organiser at the free limit with no credits and cannot be reproduced on
199 without touching billing state — test that path against the lookup logic directly rather than
by manufacturing it in the database.

Do not create test competitions under any other organiser. 170 belongs to a customer and is one
keystroke from 199.
