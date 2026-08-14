# Email & Notifications

`email-outline.xlsx` is the authoritative list of what we intend to send. This README maps that
list onto what actually exists in the code. `email-operations.md` covers how to send.

**If the outline and this README disagree, the outline wins** — update this file to match.

**This file is not updated on every change** (2026-08-14). It was written while the design was
being settled and "change the doc first" was the right discipline; the shape is agreed now. It
records **decisions and traps** — why something is the way it is, and what would be re-discovered
the hard way otherwise. It does not track button labels, counts or wording. Ask before adding to
it, and expect it to lag the code in small ways by design.

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
**Six built, one half-built, seven to build.**

### Built

| Consumer | Section | Email | `email_type` | Push wanted | Push built |
|---|---|---|---|---|---|
| Player | Welcome | Join Comp | `welcome` | — | — |
| Player | Game | Pick reminder | `pick_reminder` | Y | ✅ |
| Organiser | Tips | Result set mid round | `update_scores_mid_round_tip` | — | — |
| All | Welcome | Join LMS | `join_lms` | — | — |
| Organiser | Welcome | Created Comp | `created_comp` | — | — |
| Organiser | Game | Game Start reminder | `game_start_reminder` | — | — |
| Organiser | Game | Share reminder | `share_reminder` | — | — |

All except `update_scores_mid_round_tip` are reachable from the admin screen.

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
| Player | Game | Organiser Game Invite | Y |
| Organiser | Tips | Promote competition | — |
| All | Info | Official game invite | — |
| All | Info | News | — |

Four of the seven are organiser-facing. Everything built so far except the mid-round tip is
player- or platform-facing, so organiser comms is the whole gap.

**Dropped:** an organiser writing free text to their own participants is **not being built as an
email** — see "Broadcast from Organiser" below for the reasoning.

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

## Created Comp — the rules (built 2026-08-11)

`services/createdComp.js`. One per competition, to whoever created it. Competition-scoped, so the
admin picker chooses which one and there is exactly one recipient per press.

- **`create-competition.js` triggers nothing** — operator-driven from the admin screen, same as
  the rest.
- **It is not the confirmation screen again.** The organiser saw that seconds earlier. This
  email's job is to be findable in an inbox a week later, when they are in the pub trying to get
  people in — so the invite code and join link are the content, framed as the thing to forward.
- **Branches on whether round 1 already exists** (rewritten 2026-08-14, see
  `docs/competition-start.md`). Three outcomes, in this order:

  | Competition | What the email says |
  |---|---|
  | Round 1 exists | **When it kicks off, and that joining closes then.** The organiser chose the date minutes ago; this is the copy of it they can find later. |
  | `fixture_service`, no round | Press **Ready** — the old copy, still correct for a competition waiting on the button |
  | Organiser-managed, no round | Nothing. They have no button to press and no date yet. |

  The start date is resolved at **queue** time from round 1's `lock_time`. A provisional lock can
  move if the block's kickoffs are confirmed differently, so a row left pending for days could name
  a stale time — in practice the admin screen queues and sends in one pass, and the alternative
  (resolving at send time) would break the preview, which renders from stored `template_data`.
- **No backfill.** `CUTOFF` is `2026-08-11T16:45:00Z`, just after the newest competition at the
  time of writing (2026-08-10 21:55 UTC). 18 competitions existed and none had ever had this
  email; "you have created a competition" about one set up in June is a bad email.
- **Once per competition**, ever — candidacy excludes any competition with a `created_comp` row in
  `email_queue`, whatever its status.

## Join Comp — the rules (rewired 2026-08-11)

`services/joinComp.js`, `email_type` still **`welcome`** — that key is what `EMAIL_GROUPS` maps to
`player.welcome` and what 244 historical `email_tracking` rows are recorded under.

**What was there before, and why none of it survived.** Two implementations, neither of which ever
delivered anything:

- `join-competition-by-code.js` queued a row inline at join time, fire-and-forget in a
  `setImmediate`, scheduled `+1 day`.
- `load-welcome-competition.js` did the same job again with its own hand-written opt-out check,
  using the legacy per-email `welcome` preference key instead of the `player.welcome` group.
  **Nothing had ever called it** — registered in `server.js`, zero callers.

Nothing drained either queue. **Nine rows sat pending**, the oldest six days old, and were deleted
along with their `email_tracking` rows rather than sent. Both paths are now gone: the inline block
is removed from the join route (a comment stands in its place saying why), and
`load-welcome-competition.js` and its two `server.js` lines are deleted.

The rules now:

- **Derived live**, like the rest: active membership, joined since `CUTOFF`
  (`2026-08-11T17:03:00Z`), real email, no `welcome` row for that member and competition, not
  opted out of `player.welcome`.
- **The organiser is excluded** when they join their own competition as a player. They created it;
  `created_comp` is their email.
- **No backfill** — otherwise every existing member of every competition becomes a candidate the
  moment it is wired. **`CUTOFF` was retired 2026-08-14**: 104 memberships became `skipped` rows
  instead, so the count on the screen has nothing invisible behind it. See "Mark as sent" under
  Sending.
- **Content carried over** from the old template: the rules of the competition actually joined
  (lives, the no-repeat-teams setting) plus the next deadline when a round is open. `0 lives` now
  renders as "one wrong pick and you are out" rather than "you start with 0 lives".
- **It now goes through `deliver()`.** The old sender called `resend.emails.send` directly, so test
  mode never applied to it — one of the seven described at the top of this file.

`email_tracking.sent_at` **defaults to insert time**, so it does not mean "was sent". That is why
the nine deleted rows all carried a timestamp despite never being delivered.

## Game Start reminder — the rules (built 2026-08-11)

`services/gameStartReminder.js`. Goes to an organiser whose fixture-service competition could
start today but who has never pressed Ready. **Platform-wide** (`scoped: false`) — "who is stuck?"
is not a question about one competition, and the operator wants the list rather than hunting for
it a competition at a time.

Two stages. SQL narrows to competitions that are plausibly stuck:

- `fixture_service = true` — **only those have a Ready button.** An organiser-managed competition
  would be told to press something that does not exist; "you have not added fixtures yet" is a
  different email.
- not COMPLETE, **no rounds at all** (this is only ever about a first round), `ready_at IS NULL`
- created at least **`REMINDER_AFTER_DAYS` (14)** ago — a competition made yesterday is left alone
  to gather players
- nothing sent for it in the last **`COOLDOWN_DAYS` (7)**
- organiser has a real email and has not opted out of `organiser.game`

Then each survivor goes through **`getCompetitionStartOutlook`** — the same function behind the
organiser's own start card — and only `can_start: true` qualifies.

That last stage is the point. `evaluateCompetition`'s first-round path returns `NOT_READY`
**before** it checks the gameweek, kickoff and 48-hour lead-time rules, so `ready_at IS NULL` on
its own would happily chase an organiser toward a button that would then refuse them. Reusing the
outlook means **nobody is reminded unless pressing Ready right now would actually produce a
round**, and the email can name the date rather than nag.

**A cooldown, not once-ever.** Unlike the other four this is a nudge: an organiser who ignored the
first one is exactly the organiser worth reminding again. Re-eligible seven days after the last
attempt, sent or failed.

**No CUTOFF.** Eligibility is live state — a round is available and unclaimed today — so there is
no history to backfill.

Copy branches on player count: an organiser with nobody signed up is told to share their code
first, since pressing Ready would otherwise start a competition with no players in it.

## Share reminder — the rules (built 2026-08-14)

`services/shareReminder.js`, `email_type` **`share_reminder`**. Goes to an organiser whose
**round 1 is about to lock**, because that is also the moment **joining closes**.

It exists because `docs/competition-start.md` changed what a new competition looks like: round 1
now exists from creation, so an organiser has a real, dated deadline from day one, and nothing was
telling them about it.

**Its rules were written alongside the code rather than agreed in advance**, which is the wrong way
round per "Wiring the next email" below. The outline row was added afterwards (2026-08-14), so this
section is now a record rather than a proposal — but it was ratified, not agreed first, and the
next email should not follow this order.

- **Round 1 only** (`round_number = 1`). This is not a pick nudge — `pick_reminder` does that every
  round. It is about the join deadline, and `join-competition-by-code.js:134-151` closes joining
  once round 1 locks. That happens once per competition, ever.
- **Locking within `REMINDER_BEFORE_HOURS` (48)** and not yet locked. Two days is enough to get a
  message out and short enough that "last chance" is true.
- **Both fixture models.** Unlike the three organiser reminders this does *not* branch on
  `fixture_service`. The join deadline is a game rule, not a fixtures one, and it bites identically
  whoever supplied the matches.
- competition not COMPLETE, organiser has a real email, not opted out of `game`.
- **Once per competition, ever** — queue check on competition + type, no cooldown. Round 1 locks
  once; a second one would be a nudge about a deadline that had passed.
- **No CUTOFF.** Eligibility is a lock time inside the next 48 hours, so nothing historical can
  qualify however long this sits unsent. Nothing to backfill and nothing to exclude.

**Copy branches on player count**, which is the whole reason to send it:

| Players | What it says |
|---|---|
| 0–1 | Nobody has joined. Share the link now or the competition starts empty. |
| 2+ | N in so far. Anyone not in by kick-off misses this one. |

Scoped (`scoped: true`) — it names one competition and its deadline, so the operator picks it.

## Game Start reminder — still live, and not replaced

`docs/competition-start.md` originally proposed retiring this when the calendar shipped. **It was
not retired, and should not be.** It chases competitions with **no rounds at all** and
`ready_at IS NULL`, and a competition started from a calendar block has a round from the moment it
is created — so those are excluded by the existing SQL with no change needed.

What still reaches that state, and therefore still needs this email: organiser-managed
competitions, team lists with no calendar keyed, a calendar with nothing far enough ahead, and the
competitions already sitting on the Ready button. See `docs/competition-start.md` §8.

Share reminder is **not** its replacement. They cannot overlap: this one requires no rounds, that
one requires round 1 to exist and be about to lock.

## Fixture reminder — the rules (built 2026-08-11)

`services/fixtureReminder.js`. The mirror of Game Start reminder, for the other half of the
platform: an organiser who supplies their own fixtures, whose last round is settled, and who has
not put up the next one. **Platform-wide** (`scoped: false`), same reasoning — the operator wants
the list of who is holding their players up.

- **`fixture_service = false`, and this is the whole point.** An automated competition is *sent*
  its fixtures; telling that organiser to add some would be asking for work we do ourselves. Game
  Start reminder takes `fixture_service = true` and these two never overlap.
- **The last round is settled** — it has fixtures and every one of them has `processed` set. A
  round with an unprocessed fixture is waiting on *results*, which is Result reminder's job, not
  this one.
- **Nothing newer exists.** Eligibility is read off the highest `round_number`, so an organiser who
  has already added round N+1 is not chased for it.
- settled at least **`REMINDER_AFTER_DAYS` (3)** ago — long enough not to land the same evening
  they entered the results
- competition not COMPLETE, and **at least two active players**. The second is a belt-and-braces
  check: `process-results` sets COMPLETE when a winner emerges, so a one-player competition should
  never reach here, and if it does it is finished whatever the status column says.
- nothing sent for it in the last **`COOLDOWN_DAYS` (7)**
- organiser has a real email and has not opted out of `organiser.game`

**A cooldown, not once-ever**, and **no CUTOFF** — both for the same reasons as Game Start
reminder, which see.

**Known gap, deliberately out of scope.** A manual competition that has *never* had a round is
chased by nothing: Game Start reminder is automated-only, and this one keys off a settled previous
round. That organiser created a competition and left it empty, which is worth chasing, but it is a
different trigger and different copy. Andreas scoped this build to "after a previous round".

## Result reminder — the rules (built 2026-08-11)

`services/resultReminder.js`. The other half of the organiser-managed cycle: the matches have been
played and the round has not been settled, so the competition is frozen. **Platform-wide**
(`scoped: false`), same reasoning as the other two.

Where Fixture reminder waits for a round to be *settled*, this one waits for a round to be
*played and not settled*. The two are mutually exclusive on the same round by construction — one
needs `unprocessed_count = 0`, the other `> 0` — so a competition can never be chased for both at
once.

- **`fixture_service = false`.** Results for an automated competition arrive with the next push;
  its organiser has nothing to enter.
- **The latest round has at least one unprocessed fixture**, and **every kickoff in it is at least
  `REMINDER_AFTER_HOURS` (36) in the past**. Kickoff rather than lock time: a result cannot exist
  until the match has been played, and 36 hours clears a Saturday 3pm round by Sunday evening
  without chasing anyone mid-gameweek.
- competition not COMPLETE, and **at least two active players** — see Fixture reminder for why.
- nothing sent for it in the last **`COOLDOWN_DAYS` (7)**
- organiser has a real email and has not opted out of `organiser.game`

**The copy branches on how far they got**, because two different organisers land here:

| State | What the email says |
|---|---|
| No results entered | "N results still to go in" |
| Some entered | "N of M in" |
| All entered, none processed | "They just need processing" — the work is done, one button remains |

That last case is worth the branch. `RESULTS_READY` is a real phase in the round state machine
(`docs/round-state-machine.md`) and an organiser sitting in it has done everything except press
the button; telling them to "add your results" would be wrong and would read as if we had not
looked.

**A cooldown, not once-ever**, and **no CUTOFF** — as with the other two reminders.

## Game complete — the rules (built 2026-08-11)

`services/gameComplete.js`. Goes to **everyone who took part** in a competition that has finished,
winners and eliminated alike. **Scoped** (`scoped: true`) — unlike the three organiser reminders
this is about one named competition, so the operator picks it.

- competition status is **COMPLETE**
- every `competition_user` row with a real email, **whatever their status**. Somebody knocked out
  in round 2 still wants to know who won.
- **once ever, per player per competition** — a lifecycle email, not a nudge, so there is no
  cooldown. The queue check is on user + competition + type.
- `@lms-guest.com` addresses are excluded, which is what keeps guests and bots out
- has not opted out of `player.game`

**The outcome is derived, not stored.** Survivors are `competition_user.status = 'active'` when
the competition is COMPLETE, and the count decides which of three emails this is:

| Survivors | Outcome |
|---|---|
| 1 | A winner, named |
| 0 | **Nobody left** — everyone went out in the same round. Real: competition 161 finished with all 21 players `out`. |
| 2+ | Shared between the survivors, all named |

The zero case is why "either a winner or a draw" is the right framing and a winner-shaped template
alone would have been wrong.

**Organisers are ordinary players here.** An organiser's `competition_user` row is a real playing
row — 168's organiser survived and won with 6 picks, 161's went out with 2 — so `active` means
survivor with no special-casing, and an organiser who wins is named like anyone else.

The copy branches again on **whether the recipient is one of the survivors**, so the same send is
"you won", "you shared it", or "{name} won it" as appropriate. It does not tell a player which
round they went out in: that needs `player_progress`, which carries more rows than `pick` for
reasons documented in `db/README.md`, and a wrong round number in a results email is worse than
no round number.

## Round Over — the rules (built 2026-08-11)

`services/roundOver.js`, `email_type` still `results`. The one email every player gets every week,
and the reason the others exist.

**It is not ready when the round ends. It is ready when the round ends AND the next round's
fixtures are in** — or when the competition has finished. Andreas's rule, and the right one: a
"round over" email with nothing to do next is a dead end, and the player would have to come back
later anyway. Waiting means one email that both settles the last round and opens the next.

Ready when the highest **fully processed** round (fixtures exist, all `processed`) is followed by
either:

- a round `N+1` that **has fixtures** — the competition continues, or
- competition status **COMPLETE** — somebody won, or nobody did

**Recipients are read from `player_progress`**, one row per player per round, which is exactly
"who was in this round". Players eliminated in an earlier round fall out naturally and are not
told about a round they had no part in. `NO-PICK` is a real row there (`chosen_team = 'NO-PICK'`,
outcome `LOSE`), so somebody who forgot to pick is still told what it cost them.

**Three things in every send**, per Andreas's spec:

1. **The recipient's own result first** — their team, whether it won, and whether they are still
   in. Taken from their `player_progress` row for the outcome and `competition_user.status` for
   whether they survived it, because those are different questions: a player with a life left
   loses and stays in.
2. **A sample of who is in and who is out**, not the full list — a 100-player competition would
   otherwise send a 100-line email. Counts are exact, names are capped at five a side.
3. **What happens next**: the next round's fixtures and the deadline, or — if the competition is
   over — who won, or that it ended with nobody left.

Once per player per round (`email_queue.round_id` carries the round), group `game`.

**Known overlap, flagged not fixed.** For the final round this and **Game complete** both announce
the winner, so a player who reached the end gets two emails saying the same thing. Both were asked
for. The clean resolution is for Game complete to skip anyone who was in the final round — it
exists to reach the long-since-eliminated — but that is a change to a built email and wants
deciding rather than assuming.

## Hints — the rules (built 2026-08-11)

`services/hints.js`. Occasional training for organisers: one feature, one email, a few days apart.
Two on the outline today (`Hint - Promote competition`, `Hint - Result set mid round`) and the
list is expected to grow and shrink as Andreas edits the workbook.

**That expectation is the design.** Hints are a **list in one file**, not an email each. A hint is
an entry with a day offset, an applicability rule and its copy; the query, the template, the
queueing and the guards are shared. Adding a third hint is one entry — not a new service, a new
template and three edits. Removing one is deleting it.

Each hint still gets its **own catalog entry and outline row**, so the admin screen can send them
independently and `email_queue.email_type` stays meaningful per hint. The entries are thin: both
point at the same builder, and `hints.serviceFor(key)` supplies the eligibility.

**Trigger: days since the competition was created** — 3 for Promote, 7 for the mid-round hint.
Simple and predictable, which is what training wants. Four guards:

1. **Once per organiser per hint, ever — not per competition.** Somebody running four
   competitions would otherwise be taught the same lesson four times. A hint teaches the person.
   When several competitions qualify, the oldest is the one named.
2. **One hint per organiser per week** (`HINT_SPACING_DAYS`). With two hints and offsets of 3 and
   7 this rarely bites; with six it would, and it is far easier to put in now than to retrofit
   after somebody gets three in a morning.
3. **`Hint - Result set mid round` is `fixture_service = false` only.** An automated competition
   rejects organiser result entry outright (`AUTOMATED_COMPETITION`), so the hint would teach a
   button that organiser does not have — the same trap Game Start reminder avoids from the other
   side.
4. **…and only once they have a round with fixtures.** At day 7 a great many competitions are
   still in SETUP, and "enter results as matches finish" means nothing with no fixtures. So it is
   day 7 *or later*, whenever they are actually ready.

Promote needs no state guard: an organiser with no players is exactly who should hear about it.

**What Promote may claim.** `/game/[id]/promote` is real and carries WhatsApp message templates,
Facebook/Instagram image generation, a QR code and a copyable join link — the hint names those.
It must **not** mention broadcasting to members: `Broadcast from Organiser` was dropped (see
below) and there is no dashboard notice either. A hint that teaches a feature which does not exist
is worse than no hint.

Group `info`, which both keys already mapped to.

## Broadcast from Admin — the rules (built 2026-08-11)

`services/broadcast.js`, screen at `lmslocal-admin` → Emails → **Broadcast**, routes
`/admin/broadcast-audience` and `/admin/send-broadcast`.

**Deliberately not in `emailCatalog.js`.** Every other email derives both its recipients and its
words from the data, which is what makes a one-click send safe. This one carries a sentence
somebody typed and can reach every account on the platform. The catalog's shape is
`findCandidates()` with no arguments; bending it to carry operator text would have put a free-text
blast behind the same button as a pick reminder. Its outline row is therefore marked unwired on
the Emails screen, with a link across to its own.

Two audiences: **all** (every account with a real email) and **competition** (one competition's
members). Both minus opt-outs, applied in the query *and* again at `deliver()` — belt and braces,
because this is the email where ignoring an unsubscribe would be least defensible: nothing about
it is transactional and nobody asked for it.

Three guards the template emails do not have:

1. **The number, before the button.** The audience is counted and shown — after opt-outs, beside
   the raw total — before anything can be sent. "I thought it was going to about thirty people" is
   only preventable in advance.
2. **A confirmation carrying that number.** The live send passes back the count the operator was
   looking at and the server refuses on a mismatch (`COUNT_CHANGED`). Somebody joining between the
   count and the press is normal; a send bigger than the one reviewed is not.
3. **A send cap** (`BROADCAST_SEND_CAP`, default 80). Resend allows 100 a day and there are 216
   accounts, so "send to all" *cannot* complete in one press however it is written. **Everyone is
   queued, the cap is sent now, the rest drain via `/send-email`** on later runs — the pending
   rows are the record of who is still owed it. Sending 80 and failing 136 would leave no record
   at all.

**Operator text is escaped** (`escapeHtml` in `emailService.js`) — the only template here that
needs it, since every other one interpolates our own data. Blank lines become paragraphs, single
newlines become line breaks. No HTML, no markdown.

A live send clears the compose box and resets test mode, so a second press cannot repeat a
broadcast blind.

## Broadcast from Organiser — dropped (2026-08-11)

**Not being built as an email, and not deferred either — decided against.** Andreas's call, and
the reasoning is worth keeping so it does not get re-proposed:

**Email is for reaching someone who is not looking.** A player in a live competition already comes
back every week, and already gets Round Over, Pick reminder and Game complete. The messages we
send are adequate. Anything else an organiser wants to say can wait on the screen the player is
going to open anyway.

**And the cost was never the compose box.** Free text from a customer, sent from our domain, to
people who joined for a competition rather than for him, brings all of:

- **Rate limiting in three separate senses** — a per-competition cap so players are not pestered;
  a share of the 100/day Resend allowance, which organiser sends would spend in competition with
  the pick reminders that have a deadline attached; and the drain problem below.
- **Latency we cannot honour.** `broadcast.js` queues everyone and sends `SEND_CAP` now, the rest
  waiting for an operator to press `/send-email`. That is fine for us — we know when we will next
  look. An organiser told "sent" while forty of their eighty players get it on Thursday is a
  broken promise, and "we're starting Saturday" is exactly the message this would carry.
- **Reputation and complaints landing on us**, not on the organiser whose words they are.
- **An opt-out at the wrong grain.** It was mapped to `info`, so a player tired of one chatty
  organiser would have to mute welcome mail and hints platform-wide to stop him.

**What takes its place, if anything does: a notice on the competition dashboard.** Organiser types
it, players see it when they next open the game, expanded until they minimise it. No deliverability
risk, no send budget, no unsubscribe obligation, and it only reaches people who already joined.
**Not built, not scheduled** — and if it is, `competition.description` is the wrong field to reuse:
13 of 19 competitions have one and near enough every one is entry fee, prize split or rules, it is
rendered on the join page as the sales pitch, and it is deliberately collapsed once a round is live.
A message needs to be loud exactly when a description should be quiet, and overwriting the pitch to
say "no game this week" loses the pitch.

The `broadcast_organiser` key stays mapped to `info` in `EMAIL_GROUPS` — an entry nobody uses costs
nothing, and a missing one is a hole if anyone ever revives this.

## `services/emailCatalog.js` — which emails are wired

The three admin routes each used to carry `if (email_type !== 'pick_reminder')` and import that
service directly, so a second email meant the same edit in three places and any one missed would
be a screen offering a send the server refused.

The catalog is now the one list. Each entry names the service (`findCandidates`,
`buildTemplateData`, `queueCandidate`), the build function, the send function, and whether the
email is **`scoped`** — competition-scoped or platform-wide. `scoped` is what the routes ask
before insisting on a `competition_id`, and what the admin screen asks before showing the
competition picker's name in the panel.

`OUTLINE` in `lmslocal-admin` mirrors `email-outline.xlsx` row for row and is kept in step by hand.
It **no longer carries a `wired` flag** — the catalog is the only answer to that question, and the
server refusing an unwired type is what actually stops a send. A new email still needs its row
added there or it will not appear on the screen.

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

## Unsubscribe: grouped by SECTION

**Built 2026-08-11, regrouped the same day.** `services/emailPreference.js` is the one definition
— group keys, labels, the opt-out SQL and the runtime check, and the token helpers.

Preferences are keyed on **SECTION alone**: two groups, `game` and `info`, matching the two
sections the outline was cut to. A person sees two switches plus the kill switch.

| Group key | Emails in the group |
|---|---|
| `game` | Round Over, Pick reminder, Game complete, Game Start reminder, Share reminder, Result reminder, Fixture reminder |
| `info` | Welcome Join Comp, Welcome Created Comp, Welcome Join LMS, Promote competition, Result set mid round, Official game invite, News |

Plus `all`, the global kill switch, which overrides everything.

**This replaced a seven-group CONSUMER × SECTION model** (`player.game`, `organiser.tips`,
`platform.welcome` …), at Andreas's decision, when the outline itself lost its Welcome and Tips
sections. The cost was known and accepted and is worth restating rather than rediscovering:
**somebody who both organises and plays now has one switch for both roles**, so turning Game off
stops their pick reminders and their fixture reminders together. That was the argument for the old
model. The argument against it was a page nobody reads and a group key that no column of the
outline corresponded to.

**The regroup needs its migration run**: `db/migrate-email-preference-groups.sql`. Old dotted keys
are invisible to `getPreferences`, and an invisible row means the default applies — and the default
is *subscribed*. Skipping it silently resubscribes everyone who had opted out. The merge rule is
**off wins**: someone with `player.game` off and `organiser.game` on ends up with `game` off,
because restoring mail somebody switched off is the outcome worth being careful about.

Stored on the existing table, no schema change: `email_preference.email_type` holds the group key,
`competition_id = 0` for a global preference, a real id to mute one competition entirely.

- **An absent row means subscribed.** Load-bearing: nobody on the platform has a row, so an
  opt-in default would have stopped every email at once. Rows are written only on an explicit
  choice.
- **Transactional never consults this.** A password reset suppressed because someone muted game
  updates is a broken product, not a respected preference. Mechanically: an email with no entry in
  `EMAIL_GROUPS` has no group, and no group means never suppressed.
- **Pick reminder sits in `game` with no exemption.** Switching Game off stops it, and that costs
  a life when a pick is then missed. The unsubscribe page says so plainly and honours the choice
  anyway.

### The opt-out is enforced at `deliver()`, not only in the candidate queries

`notOptedOutSql` filters at **queue** time. `isOptedOut` — its runtime twin, same three exclusions
in the same order — is checked inside `deliver()`, at **send** time, which is the only place that
can be authoritative. Three ways someone unsubscribed could otherwise still be emailed, all of
them real:

- a queued row waits days before `/send-email` drains it, and they unsubscribe in between
- the legacy senders (`results`, `competition_announcement`, `update_scores_mid_round_tip`) queue
  rows **without consulting any candidate query** — `results` is Round Over, a live player email
- anything new that sends directly, which is exactly what happened the last time a rule lived in
  the callers instead of at the exit

Recipient and type come off the payload itself (`to`, and the `email_type` tag), so no sender
passes anything and a sender that forgets is not a hole.

A suppressed send is **neither sent nor failed**: `deliver()` returns `{ suppressed: true }`,
`readSendResult` surfaces it, and `/send-email` marks the row `suppressed` and counts it in
`suppressed_count`. Marking it sent would put a null message id against an email nobody received;
marking it failed would retry it forever against an explicit wish.

It applies in test mode too — test mode is for seeing what a send would do, and not sending is
part of what it would do.

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

**Saving names what is now switched off**, rather than just saying "saved". Saving re-renders the
same page, so without a banner the only evidence of success is that the toggles kept their new
positions — which is exactly what a silent failure would also look like. The banner has three
forms: unsubscribed from everything, subscribed to everything, or the list of groups that will no
longer arrive.

**`/unsubscribe` is exempt from CORS, deliberately** (`server.js`, in the `cors()` delegate). The
Save button is an ordinary HTML form POST — a navigation, which the browser sends regardless of
CORS and renders whatever comes back. There is nothing for CORS to protect and no header the
response needs. It only ever broke because that delegate *rejects* an origin it doesn't recognise
instead of just omitting the headers, so Save failed in production with `Not allowed by CORS`
while the page itself loaded fine.

The first fix was a same-origin rule comparing `Origin` against `req.headers.host`, and it did not
work: behind the production reverse proxy `Host` is whatever nginx forwards — the loopback address
unless it is explicitly configured to pass the original. That made the fix depend on proxy config
nothing in this repo can see. The path exemption doesn't. The same-origin rule is still there and
still useful for other routes; it is just no longer what keeps unsubscribe working.

If you add another server-rendered page with a form, it needs the same exemption.

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

## Sending: the whole platform, the two counts, send or skip

**Agreed and built 2026-08-14, except where marked deferred below.**

It exists because the screen could only answer "how many people are waiting for a welcome in
*this* competition". Nobody runs the platform one competition at a time, and the destination is a
cron, which cannot pick one either. This is the last piece that assumes the operator is a person
holding a mouse.

### One email at a time, and a card each

**Andreas's rule, and it shapes the screen.** Emails are taken up one at a time: rules agreed,
numbers looked at properly, backlog dealt with, and only then the next. Each one that has been
through that gets **its own card** above the table — `focus: true` on its row in the admin screen's
`OUTLINE`. **`welcome` and `created_comp` have cards** as of 2026-08-14.

The flag **moves** an email rather than copying it: the table below holds only what has not been
taken up, so it reads as the to-do list and empties as cards appear. An email is in exactly one
place, and the screen therefore says where things stand without anyone having to remember.

Cards are the only place that counts across every competition and the only place that sends or
marks. What is left in the table stays per-competition and preview-only — deliberate rather than
unfinished: a screen offering a platform-wide send on a dozen emails whose rules nobody has been
through is exactly what "be careful for now" rules out.

**Cards count on request, one at a time.** Every number is a live query — ~25ms each, but across
the whole platform — and the operator comes to this screen for one email. A card shows "Not counted
yet" until Count is pressed, and Refresh re-runs only that card. Measured 2026-08-14: a candidate
query is ~24ms, dominated by round-trip latency rather than work, and **unscoped is not slower than
scoped** (323ms vs 394ms for all twelve), which is what made dropping the competition filter safe.

The thing that will bite first, when volume arrives: the route counts by **fetching every candidate
row** and taking its length. Fine at 27 rows; at ten times the players it is building hundreds of
rows to show a number. The fix is a `countCandidates` sharing one SQL body with `findCandidates` —
worth resisting early, because one definition of eligibility is what stops the screen offering a
count the send contradicts.

### The panel is the recipient list

**What gets checked here is who qualifies, not what the email says.** The panel opens on the list —
expanded, no toggle — with name, address, competition and **how long they have been waiting**.
That last column is the whole judgement: a join from yesterday is a send, one from January is a
mark-as-sent. It reads whichever column the service triggers on (`joined_at`, `created_at`), so it
needs no per-email code.

**The rendered template is gone from it** (`include_sample: false`, so the server does not even
build it). A signed-off template re-rendered on every open is work nobody reads, and it was
occupying most of the panel while the list sat hidden behind a "View list" button. A test send is
how you look at the email again.

The list caps at `MAX_LISTED` (50) with the count still exact above it. Ticking reaches only what
is shown, and the panel says so.

### `scoped` changes meaning

From **must name a competition** to **may name one, to narrow it**. The services are already
built for it — all six scoped ones (`pick_reminder`, `created_comp`, `welcome`, `share_reminder`,
`game_complete`, `results`) carry `AND ($n::int IS NULL OR c.id = $n)` and document
"omit to scan them all". The only thing stopping it is one guard repeated in three routes:

```javascript
if (entry.scoped && (!competition_id || !Number.isInteger(competition_id))) {
```

That guard goes. `competition_id` becomes optional everywhere; null means every competition.
`scoped` stays in the catalog because it still answers a real question — whether the picker
applies to this email at all — it just no longer forces a value.

**The picker defaults to All** and is a filter for previewing and testing, not the unit of
operation.

### Two counts, not one

`get-email-targets` returns a pair per email type:

| | |
|---|---|
| `waiting` | candidates from `findCandidates` — people who qualify and have no queue row |
| `sent_recently` | delivered in the last `SENT_WINDOW_DAYS` (30), read off `email_queue.status = 'sent'` |

`sent_recently` is what makes a zero legible: without it, "0 waiting" could equally mean caught up
or never sending at all. It reads `email_queue`, **not `email_tracking`**, whose `sent_at` defaults
to insert time and is therefore stamped on mail that never went — which is how nine stale rows all
carried a timestamp. `skipped` rows are excluded by the status check, so marking somebody as sent
never reads back as an email they received.

A `pending` count was built alongside these and then removed: it can only be non-zero once the
send cap below exists, and until then a permanent zero sat next to the real number inviting the
question of what it meant. It comes back with the cap.

Scoped rows also report `competitions` — how many distinct competitions the waiting recipients
span — because "14 waiting across 5 competitions" is the answer the operator actually wants and a
bare 14 invites the question.

### One press: drain, then send, up to a cap — DEFERRED

**Designed, not built.** With CUTOFF retired and its backlog marked as sent there is no volume to
cap: the largest number the screen has ever shown is 3. Building a drain against no backlog would
be untested code guarding nothing. It goes in when a count first approaches the Resend allowance,
and the design below is what it should be built to.

`send-emails` should do three things in order, and the order matters:

1. **Drain first.** Pending rows for this type and scope are sent from their stored
   `template_data` via the catalog's `send`. Anything left over from a capped press goes before
   anything new, or a busy week starves the oldest rows forever.
2. **Queue every remaining candidate.** All of them, whatever the cap. The queue row is the
   record that somebody is owed this email; sending 80 and dropping 136 on the floor would leave
   no record at all. This is `broadcast.js`'s answer and it was the right one.
3. **Send up to `EMAIL_SEND_CAP`** (default 80), counted across the drain and the new rows
   together. The rest stay `pending` and go on the next press.

This is what makes the cap safe rather than lossy, and it is why `pending` is **already** on the
screen and in `get-email-targets` — the count is built and shown now, in amber, so that a queue
that starts filling is visible from the day it starts rather than the day someone goes looking.
Nine stale `welcome` rows once sat unnoticed for six days precisely because nothing displayed
them.

When it is built it also retires `routes/send-email.js`: that route dispatches on a hardcoded
if/else over five types and a sixth is dead code the day it is added, whereas draining through the
catalog needs no edit per email.

**Test mode is untouched.** It still builds one email for the first candidate, sends it to the
test address and writes nothing — no drain, no queue, no cap. Queuing during a test would make
every one of those candidates permanently ineligible for the real send that follows.

### Mark as sent — a fourth status

`email_queue.status` gains **`skipped`**: a row written for a candidate who was *deliberately not
emailed*. No message was built, no `email_tracking` row is opened — tracking is a record of a
message, and there was none.

**It needs no change to any eligibility query.** Every once-ever guard is already
`NOT EXISTS (... AND eq.email_type = X)` with no status condition, and every cooldown reads the
latest row whatever its status. A `skipped` row is therefore excluded from candidacy the moment it
is written, by rules that already exist.

**Why a new value rather than `sent` or `suppressed`:**

| Status | Means |
|---|---|
| `sent` | Resend accepted it. Writing this would be a lie, and would leave a null message id against an email somebody is recorded as having received. |
| `suppressed` | `deliver()` refused it — **the recipient's** decision, an unsubscribe. |
| `skipped` | **The operator's** decision. Nothing was attempted. |

Keeping the last two apart is what lets the question "did we skip these, or did they unsubscribe?"
have an answer. There is no check constraint on the column, so the value costs nothing.

**What it means for cooldown emails is weaker, and that is correct.** For a once-ever email
(`welcome`, `created_comp`, `join_lms`, `game_complete`, hints) a skip is permanent. For the three
reminders on a `COOLDOWN_DAYS` window it counts as an attempt and defers them one cooldown, the
same as a failed send. That is the honest reading of "we decided not to chase this organiser
today" and no special case is wanted.

**This replaces `CUTOFF`, and `joinComp`'s is being retired** (decision 2026-08-14). Five services
carry a hardcoded timestamp because there was no other way to stop a newly wired email mailing
everybody who already qualified. That is the same job as a skip, done by a different means: by
join date, in code, permanently, and invisibly — nothing on the screen says it is there.

Two mechanisms for one rule is what this document has had to undo three times. So for `welcome`
the constant goes and its backlog becomes data. Measured before the change: **3 waiting with
CUTOFF, 38 without**, so its only live effect was hiding **35 members across 8 competitions** who
joined between Nov 2025 and 6 Aug 2026. Nobody who joins from here on is affected either way,
which is what makes the swap safe.

**Done 2026-08-14. All three constants are gone** — `joinLms`, `joinComp`, `createdComp` — and
each service's no-backfill rule is now the single once-ever `NOT EXISTS` clause it already had.
337 `skipped` rows replaced them, written by two scripts kept in `lmslocal-server/db/`:

| Script | Rows | Replaces |
|---|---|---|
| `mark-join-lms-backlog-skipped.sql` | 216 | every account created before 11 Aug |
| `mark-comp-welcome-backlogs-skipped.sql` | 104 + 16 | memberships joined, competitions created, before 11 Aug |

Verified after each: all three still return **0 waiting** with no date filter anywhere, which is
what proves the rows carry the rule the constants used to.

**Both scripts cast a wider net than candidacy, deliberately.** They ignore opt-outs, and the
welcome one ignores `competition_user.status` — 104 memberships rather than the 35 then eligible.
A preference can be reversed and a status can be set back to active from the admin tool, and
either would resurrect a months-old welcome. "Nobody who was already here" has to hold whatever
anyone does later, so the write-off covers people who are not candidates today.

**Sequencing, which mattered and would again.** The 3 genuinely-waiting welcomes were sent first,
*then* the constant came out, *then* the backlog was marked. Reversed, the 3 and the 104 arrive as
one undifferentiated list and somebody has to pick 3 out of it by hand.

The next email wired needs no constant at all: wire it, look at the count, mark the backlog as
sent.

Route: `POST /admin/mark-emails-sent`, taking `email_type`, optional `competition_id`, optional
`recipients`, and `expected_count`. Omitting `recipients` marks everyone waiting and requires
`expected_count`; passing it marks only those, matched on the **pair** `(user_id, competition_id)`
— never `user_id` alone, since the same person legitimately appears once per competition when a
scoped email is scanned across all of them.

**The screen only ever passes a list.** Both grains exist on the route because the cron will want
the bulk one, but the panel requires a tick before anything at all happens — see below.

### One shared skip helper, not a fourth function per service

`services/emailSkip.js`, exporting `markSkipped(emailType, candidates)`. It writes the queue rows
directly and no service is edited — so a new email inherits skipping from its catalog entry alone,
which is the whole point of the catalog.

It can do that because the convention is already uniform: every `queueCandidate` on the platform
inserts `(candidate.user_id, candidate.competition_id, candidate.round_id)`, with the last two
NULL where they do not apply. **The skip row must carry the identical triple** — a skip written
against a different `competition_id` than the guard checks would silently fail to take, and the
count would not move.

**One exception to watch:** `hints.js` takes its `email_type` from `candidate.hint_key`, not from
the catalog key. They happen to be equal today (`serviceFor('promote_competition')` yields
candidates whose `hint_key` is `promote_competition`), but the helper should prefer
`candidate.hint_key || emailType` rather than rely on that.

**The helper recounts afterwards and reports what is left.** `markSkipped` re-runs
`findCandidates` and returns `still_waiting`; if it is not zero after a bulk mark, an identifier
mismatch is showing itself immediately instead of a week later.

### Nothing happens without a tick

**The panel's rule, and the one that replaced typing the number back.** Every action on it — send
test, send live, mark as sent — acts on the ticked rows and nothing else, and all three are dead
until at least one row is ticked. Select all is one click when everyone genuinely is the intent.

A type-to-confirm box was built first and removed the same day: switching to live is already a
deliberate act, the red panel already states the number, and a second gate on the same screen read
as noise rather than care. The gesture that needed to be deliberate was **choosing who**, not
retyping a total.

An untTicked panel meaning "everyone" was the version that made this necessary. It put the most
far-reaching action behind the least deliberate gesture — open a card, press a button, the whole
qualifying set goes — and it produced a genuinely dangerous asymmetry while it existed: **Send
ignored the ticks while Mark honoured them**, silently, under one shared column of checkboxes. So
"mark one, send to the rest" worked in one order and emailed everybody in the other. Both buttons
now read the ticks the same way, and the send button always names the number it is about to send
to.

**`recipients` on a send narrows, it does not replace.** `send-emails` still runs `findCandidates`
and intersects the list with it, so a stale tick for somebody since sent to, unsubscribed or marked
cannot put them back in. The list can only shrink the qualifying set.

### The count is still the guard, for the caller that sends no list

`expected_count` — the number the operator was looking at when they pressed — makes the server
recount and refuse on a mismatch with **`COUNT_CHANGED`**. Somebody joining between the preview and
the press is normal; an action bigger than the one reviewed is not. Exactly `broadcast.js`'s rule,
and for the same reason: "I thought it was going to about thirty people" is only preventable in
advance.

It applies to a **send-everyone** call, which today means the cron rather than the screen: an
explicit list is its own statement of who, and has already been intersected with the live
candidates. Test mode is exempt — it sends one email to the test address whatever the count is.

**The routes deliberately still accept a call with no list and treat it as everyone.** That is the
cron's contract and it must not come to depend on somebody having ticked a box. "Must be ticked" is
the screen's rule, not the route's.

### What was built

| | |
|---|---|
| ✅ | `scoped` guard dropped in all three admin routes; `competition_id` optional throughout |
| ✅ | `get-email-targets` returns `waiting` / `sent_recently` / `competitions`, and takes an `email_types` filter so a card reads one email without a pass over the catalog |
| ✅ | `skipped` status, `services/emailSkip.js`, `POST /admin/mark-emails-sent`, both grains |
| ✅ | `expected_count` / `COUNT_CHANGED` on a send with no list; `recipients` narrowing on `send-emails` so ticks mean one thing |
| ✅ | A card per email, counting on request; `welcome` and `created_comp` have theirs |
| ✅ | Panel rebuilt around the recipient list — names, competition, waiting-since; no rendered template |
| ⏸ | Drain-then-send with `EMAIL_SEND_CAP`; retiring `routes/send-email.js` — deferred, see above |
| ✅ | `CUTOFF` retired from all three welcome services, backlogs written off as `skipped` rows |

**The cron then presses these same routes on a timer.** Nothing here is shaped around the operator
being a person, which is the test each step had to pass. Digests below are the next layer and are
independent of this one — they change what gets *queued*, not how it is sent.

## Digests — one email when several competitions qualify

**Agreed 2026-08-12. Not built.** Everything below is the design to build against, not a
description of the code.

Every player email is scoped to one competition, so somebody in four competitions gets four of
each. Nothing in the system currently notices. Live competitions only, real emails, guests
excluded, as at 2026-08-12:

| Live comps | Players |
|---|---|
| 1 | 46 |
| 3 | 1 |
| 4 | 1 |

Two people. And 14 organisers with one live competition, one with three. Small, but it is the
engaged player who gets spammed hardest — the pub regular in every competition going — and it
only grows with the platform.

### Which emails digest

The test is not "is this email competition-scoped" — nearly all of them are. It is **does it fire
on a clock that ticks for every competition at once**.

| Email | Digests | Why |
|---|---|---|
| `pick_reminder` | ✅ | Fixtures come from the same gameweek. Four competitions, four reminders, one afternoon. |
| `results` (Round Over) | ✅ | The same, every Sunday evening. |
| `result_reminder` | ✅ | Organiser-side: their competitions share a settle cycle. |
| `fixture_reminder` | ✅ | Same. |
| `game_start_reminder` | ❌ | The 7-day cooldown already spaces it, and it only ever concerns a first round. Revisit if an organiser with several new competitions complains. |
| `welcome` (Join Comp) | ❌ | A join is an event. Nobody joins four competitions in one minute. |
| `created_comp` | ❌ | Same. |
| `game_complete` | ❌ | Once ever per competition. Two finishing the same day is coincidence, not a pattern. |
| Hints | ❌ | **Already solved**, and the precedent for all of this: once per organiser per hint, never per competition. |
| `join_lms` | ❌ | Per account. There is only ever one. |

**Threshold: two or more.** One candidate sends today's email unchanged. The standalone is the
better email when there is one thing to say, and it is what almost everybody will always get.

**Same email type only.** A digest never mixes `pick_reminder` with `results`. They fire at
different moments — before a deadline, after results are in — and merging them means deciding
*when* the combined email goes, which is a worse question than either answers on its own. Round
Over already carries its own competition's next deadline, so the two are sequential rather than
simultaneous within a competition anyway.

### Sending goes all-competitions-at-once

**Decision: one press covers every competition for an email type** (the alternative considered
and rejected was keeping the per-competition press and forming the digest later, at drain time).
The reason is where this is heading: the operator will not click through competitions one at a
time forever, and **a cron is this model with a timer instead of a finger**. Building the
per-competition variant first would mean dismantling it.

The services are already shaped for it. `pickReminder.findCandidates` takes `competition_id` as
optional — "omit to scan them all". Nothing in the eligibility layer is per-competition. The
constraint is a single guard repeated in three routes:

```javascript
// routes/admin/send-emails.js
if (entry.scoped && (!competition_id || !Number.isInteger(competition_id))) {
```

So `scoped` changes meaning: from **must name a competition** to **may name one, to narrow it**.
The admin picker becomes a filter for testing and previewing, not the unit of operation.

### Grouping happens at QUEUE time, not send time

This is the one decision that is easy to get wrong and expensive to unpick.

One press over every competition cannot send synchronously — the Resend allowance, HTTP timeouts,
hundreds of recipients. `broadcast.js` already met this and its answer is the right one: queue
everyone, send the cap now, let the rest drain. Under a cron it is more true, not less. **So this
model has a pending window too**, and a digest assembled from "whatever is pending right now"
breaks on it:

> A send cap falling in the middle of somebody's four rows gives them a two-section digest today
> and another two-section digest tomorrow. Same person, two emails — exactly what the feature
> exists to prevent.

Therefore:

1. Candidate-finding runs **once, across all competitions**.
2. Before writing to `email_queue`, candidates are grouped by **`(user_id, email_type)`**. Any
   group of two or more gets a shared **`digest_key`** stamped on every row. One nullable column
   on `email_queue`; **null means send this on its own**, so the single-candidate path stays
   byte-identical to today.
3. The drain selects **a whole group at a time and treats it as indivisible**.
4. The send cap counts **digests, not rows** — one person's four competitions cost one send. That
   is the point of the feature, and it stretches the daily allowance as a side effect.
5. Marking sent writes the same message id across every row in the group.

The per-row guards are untouched by all of this. `email_queue` still holds one row per player per
competition per round, which is what makes `round_id`, the once-ever checks and the cooldowns
work; a digest that queued a single row would silently break every one of them.

**Who gets a digest is decided once and recorded.** Nothing downstream re-derives it. A drain that
regrouped would be a second definition of the same rule, which is the mistake this document has
had to undo three times already.

### What a digest looks like

**A digest section is not the standalone email mechanically shrunk.** Each email declares its own
section content, and it is much shorter. Round Over proves why: five names a side across four
competitions is unreadable, so in digest mode the survivor and casualty lists become **counts
only, no names**.

**Sections are ordered by urgency — soonest deadline first**, not by competition id. The reader
scans the first section and stops.

Pick reminder:

> **Subject:** 3 picks to make — first closes Saturday 2pm
> One line naming the soonest deadline, because it is the only urgent fact. Then per competition:
> name, round number, deadline, one button. Nothing else.

Round Over:

> **Subject:** Still in 2 of your 3 competitions
> Per competition: their team, won or lost, still in or out, and either the next deadline or who
> won. Counts of who survived. No names.

Organiser reminders:

> **Subject:** 3 competitions need results
> Barely a digest — a list, one line and one link each.

### What this changes on the admin screen

- The competition picker stops being required and becomes optional narrowing.
- Counts become **two numbers, recipients and emails**. They will differ once digests form, and
  the gap between them is the feature working.
- Preview must be able to render a digest, which needs a recipient who actually has one — today
  that is the two players in three and four live competitions.

### Build order

1. This section. ✅
2. `digest_key` on `email_queue`; grouping in the queue step.
3. Drain by group; cap counts digests.
4. Digest section rendering for `pick_reminder` and `results`.
5. Relax the three route guards; screen shows both counts.
6. Organiser reminders — the easiest of the four.

The cron then sits on top and presses the same button on a schedule. Nothing above is shaped
around the operator being a person.

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

Still true today, but no longer the end state: a cron over all competitions is the intended
destination, and "Digests" above is written so nothing depends on the operator being a person.

That makes the **100/day Resend limit an operational matter rather than a design constraint**, and
it goes away when we move to a paid Resend tier. Nothing in the architecture should be shaped
around it.

The existing `load-*` → `email_queue` → `/send-email` split already fits this: the `load-*` routes
build the recipient list, the admin screen shows it, `/send-email` drains it on request.

### What is built (2026-08-11)

`lmslocal-admin` → **Emails** (`/dashboard/emails`). Wired end to end for **pick reminder, Join
LMS, Created Comp, Join Comp and Game Start reminder**; every other row renders greyed, and the server refuses it with
`UNSUPPORTED_EMAIL_TYPE` — the screen is not the only thing stopping a send.

| Piece | Where |
|---|---|
| Which emails are wired | `services/emailCatalog.js` — service, template and `scoped` per type |
| Eligibility, one definition | `services/pickReminder.js`, `joinLms.js`, `createdComp.js`, `joinComp.js`, `gameStartReminder.js`, `shareReminder.js` — `findCandidates`, `buildTemplateData`, `queueCandidate` |
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
3. ~~8 `welcome` emails pending in `email_queue`.~~ **Resolved 2026-08-11.** It was nine by then,
   the oldest six days old. Deleted with their tracking rows when Join Comp was rewired — see that
   section. Nothing queues without sending any more, so the backlog cannot rebuild; the admin
   screen still has no view of stale pending rows, which only matters if something starts queuing
   ahead of a send again.
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
