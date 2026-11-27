# Mobile push notifications

How a push gets to a player's phone, and where a tap lands.

This is the hardest path in the product to test — it needs a real device, a real signed
build, and Firebase in the middle — so the parts that are easy to get silently wrong are
written down here rather than left to be rediscovered.

---

## 1. The pipeline: a push goes with an email

Since 2026-11-27 a push is an **add-on to an email**, never a message of its own. The email's
service decides who qualifies, when and what they are told; a push goes to someone only when
**their email was actually sent**, and only if they have a registered device. Held by the 48-hour
quiet period, failed, opted out or never a candidate: no email, no push. So no push rule exists
anywhere — the email's rules are the push's rules.

Admin **Emails** → Send (with *Also push to the app* ticked) → `services/emailSweep.js` sends the
emails → `services/emailPush.js` pushes to whoever was sent one, in one batch →
`services/fcmService.js` → Firebase → device.

| Email | Push title | Push body | Tap lands on |
|---|---|---|---|
| `pick_reminder`, one competition | The email's subject (`Pick by Sat 11:30am — …` / `Predict by …`) | The email's opening line | That competition's **Play** tab (LMS pick or Matchday predictions) |
| `pick_reminder`, several | The email's subject (`Before … — 3 competitions need you`) | `3 of your competitions are waiting on you this round.` | No competition — the app just opens, as the email's button goes to the dashboard |
| `results` (Round Over), one competition | `Aptar LMS — Round 3 results` | Their own round: `You picked Arsenal and they won. You are through to the next round.` / `You scored 10 points in Round 2: …` | The competition's page (`results` is not a type the app names, so it takes the default) |
| `results`, several | `Your results — 2 competitions` | `Results are in for 2 of your competitions.` | No competition — the app just opens |
| `game_complete` | The subject, which carries the result (`You won Aptar LMS`, `… ends in a shared win`) | The line under the email's headline | The competition's page (default) |

An email takes part by carrying `push` on its entry in `services/emailCatalog.js`: a function from
the email's template data to the notification (`pushFor` in the email's service). Three have one:
`pick_reminder`, `results` and `game_complete`. Round Over and Game complete take their body from
the template's own sentence functions in `services/emailService.js` (`lmsRoundOverResultLine` and
friends), so the push cannot drift from the email; the pick reminder's two short lines are copied —
change one, change both.

The app is player-only, so organiser emails never carry a push: there is no organiser screen for a
tap to open.

- **Opt-in per send.** `sendToAll` pushes only when its caller asks. The admin route does, when
  the box is ticked; `scripts/email-sweep.js` does not, so a crontab line sends emails only. When a
  push may land on a phone (not at 07:15) is a decision for when the cron comes back.
- **Test mode** sends the first candidate's push to the signed-in admin's own devices, and writes
  nothing.
- **A token belongs to whoever registered it last.** Signing out does not remove a token, so a
  phone that changed hands carries it under both accounts; only the latest registration is sent to.
- **Dead tokens are deleted** when Firebase reports them unregistered, so "has the app" on the admin
  screen stays honest.
- **`mobile_notification_queue` is the record**, not a queue: one row per person per push, `sent` or
  `failed`, filed under the lead competition and round — no round for `game_complete`, which is
  about a competition (`db/migrations/2026-11-27-push-record-round-optional.sql`). Nothing is
  `pending` any more.

**Before 2026-11-27** pushes had their own queue, filled when fixtures went up or a player joined,
and a 5-minute cron (`/process-mobile-notifications`) to drain it — its own 24-hour window, a
`new_round` "Results are in" message, and no opt-out or archived checks. The cron was never
scheduled; seven pushes went out in its life. It was removed rather than fixed, so that there is one
set of rules.

---

## 2. The channel id is a three-way contract

Android 8.0+ **silently discards** a notification whose channel does not exist. No error, no
logcat line, nothing in the shade. It looks exactly like the push never arrived.

Three places name the same channel and all three must agree:

1. `lmslocal-server/services/fcmService.js` — `android.notification.channelId`
2. `lmslocal-flutter/android/app/src/main/AndroidManifest.xml` — the
   `com.google.firebase.messaging.default_notification_channel_id` meta-data
3. `lmslocal-flutter/android/app/src/main/kotlin/.../MainActivity.kt` — `CHANNEL_ID`, which
   is the only one that actually **creates** it

Currently `lms_notifications` in all three.

Creating it in `MainActivity.onCreate` is safe rather than lucky: a device cannot receive a
push until it has registered an FCM token, and it cannot do that until someone has opened
the app and signed in. The channel therefore always exists before the first push can arrive.

**A channel's settings are fixed at creation.** Android hands it to the user after that, so
editing importance or sound in `MainActivity.kt` does nothing on any device that already has
it. Changing those means a new channel id — which then has to change in all three places.

---

## 3. Where a tap goes

The server sends **facts**; the app decides the screen
(`lib/core/services/notification_routes.dart`).

The payload is `data: { type, competition_id, round_id, round_number }`. Every value is a
string — FCM rejects a data map containing a number, and it rejects the *whole message*, so
one integer id would stop the notification being delivered at all rather than merely arriving
without its id. `buildDataPayload` in `fcmService.js` does that conversion; do not bypass it.

Routing lives in the app rather than the server because a route chosen server-side is a route
chosen for app versions that do not exist yet, and the versions already on people's phones
can never be corrected. An unrecognised `type` therefore falls back to the competition page
instead of failing — that fallback is what lets a new notification type ship from the server
without stranding taps on older builds.

A message with no `competition_id` navigates nowhere at all, deliberately: the app was
already open behind the tap, and moving someone to a dashboard they did not ask for is worse
than leaving them where they were.

### The three delivery states

| App state | Firebase API | Wired in |
|---|---|---|
| Foreground | `onMessage` | `setupForegroundHandler` — logs only; the player is already in the app |
| Background | `onMessageOpenedApp` | `main.dart`, navigates immediately |
| Terminated | `getInitialMessage` | `main.dart`, resolves before the first frame |

The terminated case cannot navigate when it fires — it resolves long before the auth check
settles — so it stores the route in `PendingDestination` and `SplashPage` spends it once auth
resolves. Signed out, `LoginPage` spends it instead, so a tap that needed a sign-in still
finishes where it was aimed. Same holder the `/join/<code>` deep link uses; see
`docs/player-onboarding.md` §5.3.

---

## 4. Testing on a real device

`flutter run` is not enough — the tap paths need the app launched by the notification.

```bash
# Easiest: admin Emails -> Pick reminder -> Review, test mode, "Also push to the app" ticked.
# The first candidate's push goes to your own phone. Or, from lmslocal-server/:
node -e "require('dotenv').config(); require('./services/fcmService').sendPushes([{ token: '<fcm token>',
  type: 'pick_reminder', title: 'Test', body: 'Test', data: { competition_id: 123 } }]).then(r => console.log(JSON.stringify(r)))"
```

Three traps, each of which wasted time:

- **`adb shell am force-stop` cancels the app's notifications** and puts it in Android's
  stopped state, where it receives no FCM at all. It cannot be used to test the terminated
  case. Use **`adb shell am kill`** — a background kill that leaves the shade intact — after
  the notification has posted.
- **A notification can be delivered and still not display.** Check
  `adb shell dumpsys notification --noredact | grep lmslocal` for a `NotificationRecord`. If
  Firebase logged delivery in logcat but there is no record, suspect the channel (§2).
- **Notifications can be switched off for the app** in system settings, which looks identical
  to every code-level failure. Check `AppSettings: uk.co.lmslocal.lmslocal_flutter` in the
  same dumpsys output.

**Verified on device (Android 12):** channel creation, both routing destinations, background
tap via `onMessageOpenedApp`, and cold start via `getInitialMessage`.

**Not verified:** anything on iOS. The Dart side is shared and platform-independent, and
`UIBackgroundModes` already carries `remote-notification`, but APNs delivery and the tap
paths have never been run on an iOS build. Assume nothing there until it is tested against
TestFlight.
