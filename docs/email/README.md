# Email & Notifications

`email-outline.xlsx` is the authoritative list of what we intend to send. This README maps that
list onto what actually exists in the code. `email-operations.md` covers how to send.

**If the outline and this README disagree, the outline wins** — update this file to match.

---

## Two tiers, and only one is in scope

**Comms** — the outline. Lifecycle and engagement mail, driven by `email_queue`, subject to
`email_preference`, unsubscribable. This is the scope of the current work.

**Account/transactional** — mail a user gets because they did something that requires a reply.
No queue, no preference check, not unsubscribable, and deliberately **not on the outline**. Once
the dead ones are cleared out (below), this tier is closed and out of scope.

---

## Tier 1: Account/transactional

| Sender | Trigger | Keep? |
|---|---|---|
| `sendPasswordResetEmail` | `routes/forgot-password.js` | ✅ Keep |
| `sendPaymentConfirmationEmail` | `routes/stripe-webhook.js` | ✅ Keep |
| `sendContactMessage` | `routes/submit-contact-message.js` | ✅ Keep — **contact form**, message to us |
| `sendOnboardingNotification` | `routes/submit-onboarding-application.js` | ✅ Keep — **onboarding**, application to us |
| `sendOnboardingConfirmation` | `routes/submit-onboarding-application.js` | ✅ Keep — **onboarding**, receipt to applicant |
| `sendPlayerMagicLink` | — none — | ❌ **Remove.** Zero callers anywhere. |
| `sendVerificationEmail` | `routes/resend-verification.js` only | ❌ **Remove.** See below. |

Contact and onboarding are separate concerns and stay separate: contact is a one-way message to
us from anyone; onboarding is an application, and fires two emails (one to us, one back to the
applicant).

### Why verification goes

Verification is already switched off at source. `routes/register.js` inserts new users with
`email_verified` true and the token generation commented out — the header says
`"verification_sent": false // (disabled)`. So nothing ever needs verifying, and
`resend-verification` resends a verification that was never sent in the first place.

Remove together: `sendVerificationEmail`, `routes/resend-verification.js`,
`routes/verify-email.js`, and their two `server.js` registrations.

**Safe to remove** — `/unsubscribe` is its own route (`routes/unsubscribe.js`) and does not depend
on `verify-email`. It only shares the `EMAIL_VERIFICATION_URL` env var as a base URL, which stays.

---

## Tier 2: Comms — the outline mapped

14 rows, after removing the duplicate and folding "Game started" into "Round Over".
**Four built, one half-built, nine to build.**

### Built

| Consumer | Section | Email | `email_type` | Push wanted | Push built |
|---|---|---|---|---|---|
| Player | Welcome | Join Comp | `welcome` | — | — |
| Player | Game | Pick reminder | `pick_reminder` | Y | ✅ |
| Organiser | Tips | Result set mid round | `update_scores_mid_round_tip` | — | — |
| All | Welcome | Join LMS | `join_lms` | — | — |

Only `pick_reminder` and `join_lms` are reachable from the admin screen; the other two predate it.

### Half-built

| Consumer | Section | Email | Gap |
|---|---|---|---|
| Player | Game | Round Over | Email exists as `results`. **Push marked Y is not built.** |

**"Game started" folds into "Round Over"** (decision, 2026-08-11). They are the same moment: a
round ends, results go out, the next round opens. One notification covers both, and the existing
`new_round` push is the push half of it. Row 18 comes off the outline.

### To build

| Consumer | Section | Email | Push wanted |
|---|---|---|---|
| Player | Game | Game complete | — |
| Player | Game | Organiser Game Invite | Y |
| Organiser | Welcome | Created Comp | — |
| Organiser | Game | Game Start reminder | — |
| Organiser | Game | Result reminder | — |
| Organiser | Game | Fixture reminder | — |
| Organiser | Tips | Promote competition | — |
| All | Info | Official game invite | — |
| All | Info | News | — |

Six of the nine are organiser-facing. Everything built so far except the mid-round tip is
player- or platform-facing, so organiser comms is the whole gap.

**Deferred:** the Promote-page feature — an organiser writing free text to their own participants
— is **not in this scope** and will be addressed later. `Organiser | Tips | Promote competition`
stays on the outline untouched for now.

---

## `competition_announcement` — it is not what its name suggests

The intended home is a **Promote page feature: an organiser writes a message, it goes to their
own participants.** The existing code does not do that, and cannot be adapted by adding a UI.

What `load-competition-announcement.js` actually does:

- **Recipients: every user on the platform** who is not already in the named competition. Not the
  organiser's players — `app_user` filtered only by valid email and global opt-out. That is
  **216 users** today, so one trigger is over two days of the 100/day Resend limit.
- **No message field.** The payload is `{ competition_id, dry_run }`. There is nowhere for an
  organiser to type anything.
- **Fixed template.** `sendCompetitionAnnouncementEmail` renders "New Competition Available" with
  a join link built from the access code. It is an advert for a competition, not an announcement
  from one.
- **Service token, not organiser auth** (`verifyServiceToken`), which is the only thing currently
  stopping an organiser from mailing the entire user base.

So it is a **platform-wide invite blast**, and the outline row it matches is
**All | Info | Official game invite** — run by us, not by organisers.

**Decision (2026-08-11): fold it into `All | Info | Official game invite`.** Keep the existing
code and its service token, rename the `email_type` to match, and treat it as close to finished
for that purpose. It stops being called an "announcement" anywhere.

The organiser-writes-to-their-players feature is a **separate, later** piece of work and shares
nothing with this route but the queue.

---

## Join LMS — the rules (built 2026-08-11)

`services/joinLms.js`. The email a person gets once, when they first have an LMS Local account.

- **Not the same as `welcome`** (Player | Welcome | Join Comp), which fires per competition
  joined. This one is per account, and its group is `platform.welcome`.
- **`register.js` triggers nothing.** Sending is operator-driven from the admin screen like
  everything else, so registration never depends on Resend being up and every send can be
  previewed and test-sent first.
- **One template for both audiences.** People register either by joining someone's competition or
  by creating their own, and which door they came through says little about what they do next — a
  player who joins a pub competition often runs the next one. So it explains the game once and
  offers both doors, rather than branching on a signal that goes stale in a week.
- **No backfill.** `CUTOFF` in the service is a fixed timestamp — `2026-08-11T13:00:00Z`, just
  after the newest account at the time of writing (12:14 UTC) — so none of the 244 accounts that
  already existed can ever qualify. Note the Z: `db/query.js` prints local time (BST, an hour
  ahead), and the first value set here was copied off that output, landing an hour in the future
  and excluding a real signup. A fixed date rather than a rolling window on purpose: the rule is
  "only people who sign up from now on", and a rolling window would quietly start mailing anyone
  missed during a fortnight's silence.
- **Once ever**, per user: candidacy excludes anyone with a `join_lms` row in `email_queue`,
  whatever its status.
- **No competition.** `competition_id` is left NULL on both the queue and the tracking row — not
  0, which is `email_preference`'s sentinel for a global preference.

## `services/emailCatalog.js` — which emails are wired

The three admin routes each used to carry `if (email_type !== 'pick_reminder')` and import that
service directly, so a second email meant the same edit in three places and any one missed would
be a screen offering a send the server refused.

The catalog is now the one list. Each entry names the service (`findCandidates`,
`buildTemplateData`, `queueCandidate`), the build function, the send function, and whether the
email is **`scoped`** — competition-scoped or platform-wide. `scoped` is what the routes ask
before insisting on a `competition_id`, and what the admin screen asks before showing the
competition picker's name in the panel.

`OUTLINE` in `lmslocal-admin` carries a `wired` flag that mirrors this file and is kept in step by
hand; the server refusing an unwired type is what actually stops a send.

## Wiring the next email

Pick reminder is the worked example — copy its shape. For each new email, in this order:

1. **Agree the rules first.** Who gets it, on what trigger, what it says. Nothing in this
   document specifies an individual email; that is the per-email conversation, and it comes
   before any code.
2. **A service beside `services/pickReminder.js`** exporting `findCandidates({ competition_id })`
   and `buildTemplateData(candidate)`. Eligibility goes here and **nowhere else** — the preview
   and the send must read the same definition or the screen will offer a count the send
   contradicts.
3. **Compose the opt-out clause**, never hand-write it:
   ```js
   AND ${notOptedOutSql({ userColumn: 'u.id', competitionColumn: 'c.id', groupParam: '$2' })}
   ```
   with `groupFor('<email_type>')` as the bind value. The group is already defined for all
   fourteen emails in `EMAIL_GROUPS`.
4. **Put the unsubscribe link in the template data** at queue time, so a queued email still
   renders correctly if sent later:
   ```js
   const token = await getOrCreateToken(user_id);
   const unsubscribe = token ? unsubscribeLinks(token, groupFor('<email_type>')) : null;
   ```
5. **Split build from send** in `emailService.js` — `buildXEmail()` returning the payload,
   `sendXEmail()` calling `deliver()` with it. The admin preview renders the real template, so a
   sender that builds and sends in one function cannot be previewed.
6. **Use `buildEmailFooter(unsubscribeUrl)`** and spread `unsubscribe.headers` into the send.
7. **Add one entry to `services/emailCatalog.js`**, with `scoped` set correctly, and flip
   `wired: true` on its row in the admin screen's `OUTLINE`. The three admin routes read the
   catalog and need no edit.
8. **Test with test mode on**, then check `email_queue` is still empty for it. Ask Andreas which
   competition to test a scoped email against — never reuse an id from this doc.

**Do not** add a stored copy of eligibility, a second unsubscribe mechanism, or a template that
builds its own footer. Each of those has already been removed once.

## Unsubscribe: grouped by CONSUMER × SECTION

**Built 2026-08-11.** `services/emailPreference.js` is the one definition — group keys, labels,
the opt-out SQL, and the token helpers.

Preferences are keyed on **SECTION × CONSUMER**, not on individual emails. Section alone would
put a player's Pick reminder and an organiser's Fixture reminder behind one switch; they are
unrelated things that happen to share a section.

| Group key | Emails in the group |
|---|---|
| `player.welcome` | Join Comp |
| `player.game` | Round Over, Pick reminder, Game complete, Organiser Game Invite |
| `organiser.welcome` | Created Comp |
| `organiser.game` | Game Start reminder, Result reminder, Fixture reminder |
| `organiser.tips` | Promote competition, Result set mid round |
| `platform.welcome` | Join LMS |
| `platform.info` | Official game invite, News |

Plus `all`, the global kill switch, which overrides everything.

Stored on the existing table, no schema change: `email_preference.email_type` holds the group key,
`competition_id = 0` for a global preference, a real id to mute one competition entirely.

- **An absent row means subscribed.** Load-bearing: nobody on the platform has a row, so an
  opt-in default would have stopped every email at once. Rows are written only on an explicit
  choice.
- **Transactional never consults this.** A password reset suppressed because someone muted game
  updates is a broken product, not a respected preference.
- **Pick reminder sits in `player.game` with no exemption.** Switching Game off stops it, and
  that costs a life when a pick is then missed. The unsubscribe page says so plainly and honours
  the choice anyway.
- **Migration done.** The three legacy rows were all `enabled = true` — nobody had opted out of
  anything — so `pick_reminder` and `results` were dropped as no-ops and `all` kept.

### Unsubscribe

`routes/unsubscribe.js`, no login, three entry points:

| | |
|---|---|
| `GET /unsubscribe?token=&group=` | A person clicking the footer link. **Acts on the group immediately**, then renders the confirmation with toggles for every group. |
| `POST /unsubscribe?token=&group=` | The mail client's own button (RFC 8058 one-click). Acts, returns plain `200 OK`. |
| `POST /unsubscribe/save` | The toggle form on that page. Sets all groups at once. |

The GET acts before it renders rather than presenting a form to submit — one-click has to
complete without further interaction, which Gmail and Yahoo have required of bulk senders since
Feb 2024. The toggles are for refining or reversing afterwards.

**Identity is `app_user.unsubscribe_token`** — opaque, random, 32 hex chars, unique-indexed,
backfilled for all 244 users. **Not a JWT.** The old one was signed with `JWT_SECRET`, the player
login secret, so invalidating a leaked unsubscribe link would have meant logging out every user
on the platform. A stored token is revocable on its own, shorter in a URL, and reveals nothing
when inspected. No unsubscribe link had ever actually been sent, so there was no legacy to keep.

The page shows the account's email address as a header, then what just happened, then the
toggles.

**This page is the only place preferences are edited.** The duplicate panels on the web profile
screen and the Flutter profile page were removed in Aug 2026: three UIs over one set of rows,
two of them behind a login that a person reacting to an unwanted email has no reason to go
through. `/get-email-preferences` and `/update-email-preferences-batch` are still registered and
still work — `lmslocal-web`'s `api.ts` keeps its wrappers — but no screen calls them. Don't
rebuild a settings panel on top of them; extend the unsubscribe page instead, where a new group
in `GROUPS` appears as a row with no UI change at all.

### Deliverability

Every comms send carries both:

```
List-Unsubscribe: <https://.../unsubscribe?token=...&group=...>
List-Unsubscribe-Post: List-Unsubscribe=One-Click
```

plus a footer link in the template. The header serves the mail client's button, the footer serves
the person — both, not either. Wired into pick reminder; rolls into each remaining template as it
gets wired.

## How sending works

**Queued** — a `load-*` route writes to `email_queue`; `POST /send-email` drains pending rows and
dispatches on `email_queue.email_type` via a hardcoded if/else in `routes/send-email.js`. An
unlisted type throws `Unknown email type`. Five types exist: `welcome`, `pick_reminder`,
`results`, `competition_announcement`, `update_scores_mid_round_tip`.

`join_lms` is deliberately **not** among them. The admin screen queues and sends in one pass, so a
`join_lms` row is never left pending for `/send-email` to drain; there is no `load-join-lms`
route and adding the type there would be dead code. Anything wired through the catalog from here
on works the same way.

**Direct** — the account/transactional tier, straight out of `emailService.js`.

**Push** — a separate queue: `mobile_notification_queue` → `process-mobile-notifications.js` →
`services/fcmService.js`. Two types: `new_round`, `pick_reminder`.

Tables: `email_queue`, `email_preference`, `email_tracking`, `mobile_notification_queue`.
`email_preference` is **singular**, has no `frequency` column, and uses **`competition_id = 0`**
for a global preference (not NULL). There is no `email_templates` or `email_consolidation` table;
templates are inline HTML in `emailService.js`.

---

## Sending is manual, from the admin tool

**Decision (2026-08-11): there is no scheduler in this scope.** Sending is an operator action on
a new screen in `lmslocal-admin`: see what is queued, pick or preview, press send. Volume is
managed by the person at the screen, not by a cron with throttling logic.

That makes the **100/day Resend limit an operational matter rather than a design constraint**, and
it goes away when we move to a paid Resend tier. Nothing in the architecture should be shaped
around it.

The existing `load-*` → `email_queue` → `/send-email` split already fits this: the `load-*` routes
build the recipient list, the admin screen shows it, `/send-email` drains it on request.

### What is built (2026-08-11)

`lmslocal-admin` → **Emails** (`/dashboard/emails`). Wired end to end for **pick reminder and
Join LMS**; every other row renders greyed, and the server refuses it with
`UNSUPPORTED_EMAIL_TYPE` — the screen is not the only thing stopping a send.

| Piece | Where |
|---|---|
| Which emails are wired | `services/emailCatalog.js` — service, template and `scoped` per type |
| Eligibility, one definition | `services/pickReminder.js`, `services/joinLms.js` — `findCandidates`, `buildTemplateData`, `queueCandidate` |
| Opt-outs, one definition | `services/emailPreference.js` — `notOptedOutSql`, used inside the candidate query |
| Unsubscribe | `routes/unsubscribe.js` (GET, one-click POST, save) |
| Template, build split from send | `services/emailService.js` — `buildPickReminderEmail`, `buildJoinLmsEmail` |
| Single delivery choke point | `services/emailService.js` — `deliver(emailData, { testMode })` |
| Counts | `POST /admin/get-email-targets` |
| Recipients + rendered sample | `POST /admin/preview-email` |
| Send | `POST /admin/send-emails` |

`routes/load-pick-reminder.js` was refactored onto the same service, so the batch path and the
admin screen cannot disagree about who qualifies — the reason `evaluateCompetition` lives in one
place in `services/fixtureService.js`.

**Test mode sends one copy to the test address, prefixes the subject `[TEST]`, and writes
nothing.** The writing-nothing part is load-bearing: candidacy excludes anyone already in
`email_queue` for that round, so a test that queued would make every one of those players
permanently ineligible for the real send that followed. Verified on competition 210 — a test send
left `email_queue` and `email_tracking` untouched and all three candidates still eligible.

The test address is `EMAIL_TEST_RECIPIENT`, falling back to `aandreou25@gmail.com`.
`test_mode` defaults to **true** server-side when the field is absent.

---

## What comes next

1. **Agree the high-level structure** — this document. Sections, consumers, preference key, the
   two tiers, what is being removed.
2. **Line up the documentation** and confirm we can technically deliver it.
3. **Build the admin screen** — display, preview, send.
4. **Take each email on the outline in turn**, with its own rules and detail. Nothing in this
   document specifies an individual email's trigger, content or timing; that is per-email work.

A one-line description per row on the outline would help step 4 — Andreas to add if useful.

---

## Open questions

1. **The outline still has the duplicate row.** `Player | Welcome | Join Comp` appears at both
   row 3 and row 14 in the file as saved. Worth re-saving.
2. ~~The test redirect is still live.~~ **Resolved 2026-08-11, and it was not what it claimed.**
   The `sendEmail` wrapper carrying that line was called by only **five of the twelve senders**.
   The other seven — including **pick reminder, results and welcome** — called
   `resend.emails.send` directly and were never redirected, so the three live player emails had
   always been reaching real inboxes despite the comment reading `ALL EMAILS REDIRECTED`. There
   is now one choke point, `deliver()`, and test mode is a per-send parameter.
3. **8 `welcome` emails have been pending in `email_queue` since 2026-08-10.** Not a design
   problem now that sending is deliberately manual, but the admin screen needs to surface stale
   pending rows rather than let them sit unseen.
4. **`EMAIL_VERIFICATION_URL` is a LAN address in local `.env`** (`http://192.168.1.102:3015`),
   and it is what builds every unsubscribe link. Fine for testing; it must be the public server
   URL in production or the links in sent mail will be unreachable.
5. **The remaining templates have no unsubscribe footer.** Only pick reminder and Join LMS do.
   Each one
   needs the footer and the two headers as it gets wired — the group is already defined for all
   fourteen in `EMAIL_GROUPS`.

---

## Files

| File | What it is |
|---|---|
| `email-outline.xlsx` | **Authoritative.** The list of emails to build. |
| `README.md` | This file — the outline mapped against the code. |
| `email-operations.md` | How to send: the queue, one-off scripts, recipient SQL. |
