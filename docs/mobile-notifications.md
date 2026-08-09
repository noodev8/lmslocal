# Mobile push notifications

How a push gets from the queue to a player's phone, and where a tap lands.

This is the hardest path in the product to test — it needs a real device, a real signed
build, and Firebase in the middle — so the parts that are easy to get silently wrong are
written down here rather than left to be rediscovered.

---

## 1. The pipeline

`mobile_notification_queue` → `POST /process-mobile-notifications` (cron, every 5 min) →
`services/fcmService.js` → Firebase → device.

Two types, in priority order. A user gets **at most one** notification per run; the rest of
their pending entries are marked `skipped`.

| Type | Copy | Tap lands on |
|---|---|---|
| `new_round` | "Results Are In / Results are in - see how you did!" | The competition's own page |
| `pick_reminder` | "Pick Reminder / Don't forget to make your pick before it locks!" | That competition's **Play** tab |

`process-mobile-notifications.js` re-checks conditions at send time, not just at queue time:
still an active, unhidden member; has not already picked; round not yet locked. A queued
notification that has become wrong is dropped rather than sent.

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
# Fires a real push through the shipping code path.
node <<'EOF'
# see git history for scripts/send-test-push.js, or write six lines against
# services/fcmService.js sendNotification(token, type, { competition_id })
EOF
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
