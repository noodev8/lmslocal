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

## Created Comp — the rules (built 2026-08-11)

`services/createdComp.js`. One per competition, to whoever created it. Competition-scoped, so the
admin picker chooses which one and there is exactly one recipient per press.

- **`create-competition.js` triggers nothing** — operator-driven from the admin screen, same as
  the rest.
- **It is not the confirmation screen again.** The organiser saw that seconds earlier. This
  email's job is to be findable in an inbox a week later, when they are in the pub trying to get
  people in — so the invite code and join link are the content, framed as the thing to forward.
- **Branches on `fixture_service`.** Those competitions get a line about pressing **Ready**,
  because nothing is pushed to them until it is and the organiser would otherwise wait for a round
  that never comes. Organiser-managed competitions have no such button and are not told to press
  it. The column is fixed at creation, so the branch cannot go stale between queueing and sending.
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
  moment it is wired.
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

## Unsubscribe: grouped by SECTION

**Built 2026-08-11, regrouped the same day.** `services/emailPreference.js` is the one definition
— group keys, labels, the opt-out SQL and the runtime check, and the token helpers.

Preferences are keyed on **SECTION alone**: two groups, `game` and `info`, matching the two
sections the outline was cut to. A person sees two switches plus the kill switch.

| Group key | Emails in the group |
|---|---|
| `game` | Round Over, Pick reminder, Game complete, Game Start reminder, Result reminder, Fixture reminder |
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

`lmslocal-admin` → **Emails** (`/dashboard/emails`). Wired end to end for **pick reminder, Join
LMS, Created Comp, Join Comp and Game Start reminder**; every other row renders greyed, and the server refuses it with
`UNSUPPORTED_EMAIL_TYPE` — the screen is not the only thing stopping a send.

| Piece | Where |
|---|---|
| Which emails are wired | `services/emailCatalog.js` — service, template and `scoped` per type |
| Eligibility, one definition | `services/pickReminder.js`, `joinLms.js`, `createdComp.js`, `joinComp.js`, `gameStartReminder.js` — `findCandidates`, `buildTemplateData`, `queueCandidate` |
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
