# Flutter app migration

Tracks the work to bring `lmslocal-flutter` up to a current toolchain and onto the pools-coupon
design system. **Read `docs/design-system.md` first** — this document does not restate the system,
it records how it lands in Flutter and what is done.

The app is **live on both stores** (`1.2.9+15` at the time of writing) and is **player-only**.
Every API it needs already exists; no server work is in scope.

**Status:** the core is done on Android. Baseline was commit `aa0f83e`; this work ends at `47ce453`.

**Done, and exercised on a physical SM A426B (Android 12):**

- Toolchain: every dependency current, including the four majors. `compileSdk` pinned to 37.
- Version `2.0.0+16`. The forced-update gate is gone (§2).
- Launcher icons — adaptive, monochrome and iOS — from the new badge. Native and Dart splash
  on `stock`, so there is no flash between them.
- The whole app is on the coupon palette, square, and free of blurred shadows.
- Splash and the three auth screens are properly migrated; everything else is on the palette
  via the shims in §3 and awaits its own pass.
- Shared bottom navigation, on the dashboard as well as inside a competition.
- Sign in, session persistence across a cold restart, routing, and the join dialog all verified
  by hand on the device.

**Not done, and none of it blocked by the app code** — see §6 for the detail:

1. `/join/*` deep links: the app-side route, plus adding `"/join/*"` to
   `apple-app-site-association` and **deploying it**.
2. The iOS build, on the Mac. Nothing iOS-specific has been run — only compiled against.
3. A real push-notification send, after the Firebase 3→4 / 15→16 bump.
4. The remaining screens' own migration passes, and the UX rework that follows.

**One risk to carry forward.** `flutter_secure_storage` 11 was verified reading a token *it* wrote,
on a fresh install — not one written by v9, which is what everyone currently on 1.2.9 has. A forced
re-login on upgrade is accepted rather than engineered around, but it has not been proven either
way, so do not report it as tested.

---

## 1. One release, `2.0.0+16`

Originally planned as two submissions — toolchain first, restyle second — so that a production
failure would be attributable to one or the other. That was reconsidered once the numbers were
clear: the user base is small enough that a staged rollout buys little, and the app is not yet
load-bearing for anyone. Upgrade and restyle ship together.

The two failure modes to watch for are silent, and neither shows an error the user can see:
`flutter_secure_storage` failing to read existing tokens (everyone is logged out) and a Firebase
bump breaking push. **A forced re-login is accepted** rather than engineered around.

### The version gate is gone

The app used to call `/check-app-version` on the splash screen and, if the installed version was
below `app_version.minimum_version`, show a dialog the user could not dismiss. That has been
removed at the client's request — it was never used in anger, and letting the stores update
whenever they can is the simpler behaviour. `UpdateRequiredException` went with it; it was declared
and caught but never actually thrown.

**Do not delete the server route or the `app_version` table.** Every 1.2.9 install still in the
wild calls `/check-app-version` on every launch. The row stays at `1.1.1` so those clients keep
getting `update_required: false`; removing the route would make them fail that call on startup.
The table becomes dead only once no old installs remain, which is not something we can observe.

`package_info_plus` stays a dependency — the profile screen still shows the app version.

---

## 2. Release A — toolchain

### Already fine

Do not "fix" these; they are current as of Flutter 3.38.9.

- `targetSdk` resolves from `flutter.targetSdkVersion`, which defaults to **36**. The Play Store
  target-API requirement is already met — this is not a deadline we are racing.
- Gradle 8.14, AGP 8.11.1, Kotlin 2.2.20, Java 17, `minSdk` 24.
- The project builds with the Kotlin DSL (`build.gradle.kts`), not Groovy.

### compileSdk 37

`flutter_secure_storage` 11 compiles against API 37, above Flutter's default of 36, so
`compileSdk` is **pinned to 37** in `android/app/build.gradle.kts`. Compiling against a higher SDK
is backward compatible and does not change which devices are supported — `targetSdk` still comes
from Flutter.

A machine without that platform fails with `Failed to find target with hash string 'android-37'`.
Install it with:

```bash
export JAVA_HOME="C:/Program Files/Android/Android Studio/jbr"
"$ANDROID_SDK/cmdline-tools/latest/bin/sdkmanager.bat" "platforms;android-37"
```

It lands as `platforms/android-37.0` under the newer major.minor SDK naming, and `sdkmanager`
reports `Failed to find package 'platforms;android-37'` while installing it anyway. Both are
expected; Gradle resolves it correctly.

### If the build fails on a plugin class that plainly exists

After a major plugin bump, `android/app/src/main/java/io/flutter/plugins/GeneratedPluginRegistrant.java`
can go stale and fail with `cannot find symbol` on a class that is present in the pub cache. It is
a generated, gitignored artifact. `flutter clean` fixes it — deleting the file alone does not,
because the stale Gradle build directory is the actual culprit.

### Dependency bumps

Nine direct dependencies need major bumps. Ordered by how much can go wrong:

| Package | From | To | What to watch |
|---|---|---|---|
| `go_router` | 14.8 | 17.4 | Three majors of API churn. `AppRouter` is the only consumer, but redirect and refresh semantics changed. Walk every route including the deep links |
| `flutter_secure_storage` | 9.2 | 11.0 | **Reads existing JWTs.** A migration failure logs everyone out. Test by upgrading over an installed build, not a fresh install |
| `firebase_core` / `firebase_messaging` | 3 / 15 | 4 / 16 | Push. Must be tested on a real device — foreground, background and terminated |
| `flutter_bloc` | 8.1 | 9.1 | bloc 9 breaking changes. Only `AuthBloc` uses it |
| `package_info_plus` | 8.3 | 10.2 | Feeds the version gate in `splash_page.dart`. If it reports wrong, the update dialog can lock users out of a working app |
| `intl` | 0.19 | 0.20 | Date formatting on results and lock times |
| `dio`, `equatable`, `cupertino_icons`, `shared_preferences` | | | Routine |
| `flutter_launcher_icons` | 0.13 | 0.14 | Dev only. Needed for the icon work below |

`flutter_secure_storage_macos` and `js` are flagged discontinued upstream. Neither is a direct
dependency and neither affects iOS or Android; no action.

### Icons

The app currently ships **legacy square icons only** — `mipmap-anydpi-v26/` does not exist, so
Android 13+ themed icons and the modern adaptive launcher treatment do not work.

Source art is `docs/LMS-Local-Logo.jpg` (800×800), which is already the coupon system rendered as a
badge: `stock-lit` ground, `ink` linework, `overprint` on the stars, cup and the "1". It replaces
`assets/images/logo.png` (the old blue and green tile), which is a different brand.

Source art is `docs/LMS-Local-Logo.png`, 1024×1024. Config lives in `pubspec.yaml`; regenerate with
`dart run flutter_launcher_icons` after changing the art.

- **Background** is `#EAE4D1`, sampled from the logo's own paper — *not* `stock-lit` `#F2F3EC`.
  The badge's ground is warmer than the design system's, and matching it makes the icon read as
  one sheet with a stamp on it rather than a disc pasted onto a lighter square.
- **Foreground** is the emblem cut to its own circle on transparency, so a launcher mask crops
  paper instead of slicing through the outer rings.
- **Sizing.** Only the centre 72/108 (66.7%) of an adaptive layer is ever visible — the outer 18dp
  each side is always masked. The emblem is a circle, so it fills that viewport at 65.3% rather
  than hiding inside the 66/108 (61%) safe zone, which is sized for arbitrary content and leaves a
  circular mark looking marooned with an illegible wordmark at 48dp. `flutter_launcher_icons`
  applies its own further 16% inset, so the source art is sized to `target / 0.68`.
- `remove_alpha_ios: true` — iOS rejects icons with an alpha channel.
- Samsung One UI's "icon frames" setting wraps the result in a white squircle on some devices.
  That is a launcher preference, not a fault in the icon; stock Android fills the mask with the
  background colour.

`assets/images/logo.png` is the same emblem on transparency at 512px, for in-app use — it carries
no paper square, so it drops onto the `stock` ground cleanly.

### Native splash

Today: a plain white Android window (`splash_white` in `colors.xml`), then the Dart `SplashPage`
holding for a minimum of two seconds while it checks auth and app version.

The white window is a flash of the wrong colour before a `stock` app. Set the Android window
background and the iOS `LaunchScreen.storyboard` to `stock` `#DDE1D6` so the native window, the
Dart splash and the first real screen are one continuous ground. `values-night/` gets the same
value — the app has no dark variant (§3).

Keep the two-second minimum. It is what gives the version check time to answer, and the version
check is the only thing that can stop a broken old build from talking to the API.

---

## 3. Release B — design

**Light ground, matching the web.** No dark variant. The web has none to copy, so inventing one
would be inventing design system, and it would drift. Set `SystemUiOverlayStyle` so status bar
icons are dark — a light app with white status icons is unreadable and is the classic tell of a
half-done light-mode conversion.

### Tokens

`lib/core/theme/game_theme.dart` is the dark gaming theme (navy `#0A1628`, cyan glow `#00D4FF`)
and is imported by 20 of the 25 presentation files. It is replaced by `coupon_theme.dart` carrying
the §2 palette from the design system verbatim — same names, same hex, so the two codebases can be
diffed by eye.

`AppConstants.primaryNavy` / `accentLightBlue` go too. `AppConstants` keeps its non-colour
contents (return codes, spacing, durations).

This is **not** a rename. `GameTheme` also exposes `backgroundGradient`, `cardGradient`,
`glowGradient`, `glowShadow`, `borderGlowShadow` and `glowWithIntensity()`. The coupon system has
no gradients and exactly one shadow — the hard print offset. Those members have no counterpart and
must not acquire one.

### Widgets that are wrong, not mis-coloured

Recolouring these produces a pale glow, which is worse than the dark one. They need replacing:

| Widget | Why | Becomes |
|---|---|---|
| `glowing_players_circle.dart` | A cyan glow ring | The count in display type over a ruled field |
| `active_players_ring.dart` | Same idea, second copy | Folded into the above |
| `glass_card.dart` | Frosted translucency | `PANEL` — hairline border on `stock-lit` |
| ~~`dark_status_cards.dart`~~ | Named for the dark theme | **Done** — `player_status_block.dart` |

### Flutter-specific rules

The design system is written against Tailwind. Four things do not carry over:

1. **Material fights this system.** `ThemeData` must zero `elevation` everywhere and set
   `shape: RoundedRectangleBorder(BorderRadius.zero)` globally — Cards, Dialogs, BottomSheets,
   SnackBars and Chips all default to rounded and elevated. Buttons and inputs keep a 4dp radius,
   the equivalent of `rounded-sm`. Set this once on the theme, not per widget.
2. **Hairlines.** `border-ink/30` is a CSS pixel; in Flutter use `BorderSide(width: 0.5)` or
   thinner against `devicePixelRatio` so a rule stays a rule on a 3x screen instead of becoming a
   bar.
3. **Touch targets stay 48dp** even where the coupon look wants a tight ruled row. Increase the
   tap area, not the visible row height.
4. **Density.** Design system §8 says drop to `py-6`–`py-8` and tighten rows, **but do not shrink
   the type**. That applies twice on a phone. The dark theme currently leans on glow for hierarchy;
   with that gone, hierarchy comes from weight, size and rules.

Everything else in §8 applies unchanged, in particular: `moss` is a mark and `moss-wash` is a
ground, never the reverse; every status carries its word so nothing depends on seeing a hue; and
one statement per results row.

### Fonts

Bundled as variable TTFs under `assets/fonts/`, not fetched at runtime — the splash screen is the
first thing anyone sees and it must not paint in a fallback face. All three are OFL.

| Family | File | Role |
|---|---|---|
| `display` | `BigShoulders[opsz,wght].ttf` | Headings, buttons, big numbers. Always uppercase, always semibold |
| `body` | `InstrumentSans[wdth,wght].ttf` | Body copy and every interface label |
| `data` | `CourierPrime-Regular.ttf`, `-Bold.ttf` | **Only** things a person entered |

~485KB total. Note the family is `Big_Shoulders`, **not** `Big_Shoulders_Display` — matching
`lmslocal-web/src/app/layout.tsx`.

**The typewriter rule is the one most likely to be broken.** In this app `font-data` means player
names, team picks, scores, access codes and timestamps. Not labels, not buttons, not nav.

### Screen inventory

Migrate a screen completely or not at all — design system §10. A half-migrated screen looks worse
than an unmigrated one.

**`CouponTheme.themeData()` does most of the work.** It squares and flattens Cards, Dialogs,
BottomSheets, SnackBars and inputs, and sets the three families, so a screen migration is mostly
deleting per-widget colour and radius overrides rather than writing new ones.

**Display type is always uppercase**, and Flutter has no `text-transform`. Headings and button
labels are uppercased at the call site — `Text('SIGN IN')`. There is no way to enforce this from
the theme, so it is the easiest rule in the system to break.

`login_page.dart` is the migrated pattern to copy: eyebrow, display heading, intro, labelled
fields, one `overprint` primary action, a dotted-underline tertiary link.

### How the palette got everywhere at once

`GameTheme` and `AppConstants`' brand colours are now **transitional shims remapped onto coupon
tokens**, rather than the dark navy/cyan originals. Every screen that still imports them is on the
right palette without having been rewritten. The members with no counterpart are neutered in place:
the gradients return a flat colour, the glow shadows return nothing.

That put the whole app on the palette in one move. What it cannot fix is shape and structure, so
those were swept separately: 65 panel corners squared, 12 blurred shadows flattened, and
`radiusMedium`/`radiusLarge` set to 0 (`radiusSmall` stays 4 for buttons and inputs).

**A screen is properly done when its `game_theme.dart` import is gone.** When the last one goes,
delete both shims.

### The tint trap

The single most common defect found while migrating, three times over: an accent at 10–20% opacity
used as a fill. `moss` at 20% behind "Make pick", `moss` at 10% on the leading standings group,
`overprint` at 10% behind "Danger zone". Over the stock ground every one of them reads as grey
murk — this is the failure design-system.md §8 names outright.

The fixes, in order of how often they apply: a real action becomes a real button (solid `overprint`
if primary, outlined if secondary); a field becomes `moss-wash` with `ink` on top; a warning
becomes `ink` text with an `overprint` rule down the side. **A tint is never the answer.**

### Navigation

`widgets/app_nav_bar.dart` is shared by the dashboard and the competition screens so the two cannot
drift. The dashboard carries only Home and Profile — sparse, but the app keeping its navigation as
you move in and out of a competition beats it appearing and vanishing.

The active item is marked by an ink rule **and** a weight change, never by colour alone. It
deliberately avoids `moss`: green means "still in" in this product, and spending it on chrome would
blunt that.

`/competition/:id?tab=play` opens straight on Play. The dashboard's "Make pick" uses it, because
landing a player on the competition's own dashboard and making them find the tab is the action
changing its name halfway through the flow. The tab highlight itself was never broken — that was
the actual complaint's cause.

The competition tab is labelled **Dashboard**, not "Game". "Game" sat beside "Play" and read as
two names for one thing, when it is in fact the competition's overview.

**Play keeps its name in every phase.** The web's equivalent tile relabels itself — "Play" while
picks are open, "Round 3 results" once they're settled, "Round progress" between — which works
for a tile and not for navigation. A bottom-nav item is an address, and an address that renames
itself through the week makes the app feel like it has moved. The phase is carried by the copy on
the screens instead (§3a below).

| Screen | Lines | Notes |
|---|---|---|
| ~~`splash_page.dart`~~ | 142 | **Done.** Where icon, splash and font work met |
| ~~`login` / `register` / `forgot_password`~~ | ~700 | **Done.** Share `widgets/auth_shell.dart`, mirroring the web's `AuthShell`. Register's intro is *not* the web's — that one sells to organisers |
| `dashboard_page.dart` | 1480 | Palette and shapes done, actions fixed, pick and round status added (§3a). Layout awaits the redesign |
| `competition_home_page.dart` + widgets | ~1900 | Glow ring replaced by `players_active_block.dart`. `active_players_ring.dart` and `glass_card.dart` were dead and are deleted. Round status and the inline `ABOUT` block added (§3a); the info sheet is deleted |
| `play_page` / `pick_page` / `waiting_page` / `player_results_page` | ~1600 | Palette only so far, plus `pick_page`'s deadline now on the shared formatter (§3a). `player_results` is where `moss` vs `moss-wash` was already got wrong twice on web — read §8 first |
| `standings_page.dart` | 1663 | Group tints fixed. Still to do: the survival sheet model — `font-data` names, dotted leaders, struck-through eliminations |
| `profile_page.dart` | 1214 | Palette, shapes and both tints done |

---

## 3a. Telling the player where the round has got to

The app knew less than the web about its own rounds, and it was a data gap rather than a design
one. `/get-user-dashboard` has always returned `current_round_lock_time`, `total_fixtures`,
`fixtures_with_results` and `fixtures_processed`; `CompetitionModel` simply never parsed them, so
the app could say "Round 2" and nothing about whether picks were open, closed, or settled. A
player had to open the Play tab and see what it offered.

Those four fields are now on `Competition`, and
`lib/core/game/round_state.dart` derives the phase from them — the same machine, off the same
counts, as `lmslocal-web/src/lib/roundState.ts`. **`docs/round-state-machine.md` is the contract
for both**; change it first, then change both files. The port is partial by design: phases and
player-facing copy only. The organiser copy, the capability functions and the start gate have no
reader in a player-only app.

Two divergences are deliberate, per §4: the copy is in the player's voice, and every phase past
the lock states what is happening rather than what someone owes. One is not: kickoff times render
in the device's zone rather than pinned to Europe/London, because Dart needs the `timezone`
package for that. It is still a fix on what was there — the app formatted UTC instants without
converting, showing every BST kickoff an hour early.

### One formatter, and the hour it was losing

`formatShort` / `formatLong` in `round_state.dart` are now the only place a kickoff is rendered.
There were two others, both calling `DateFormat(...).format()` straight onto a `DateTime` parsed
from an ISO string with a `Z` — which is a **UTC** `DateTime`, so it printed UTC. Through BST that
is an hour early, every time. The pick page also spoke 24-hour ("14:00") where everything else
says "3pm".

It stayed invisible while every screen was wrong in the same direction. It became a visible
contradiction the moment the dashboard card started saying "Pick needed by Sat 15 Aug, 3pm" beside
a pick page headed "Sat 15 Aug, 14:00" for the same deadline. Both now call `formatShort`.

If a third kickoff needs rendering, call these — do not reach for `DateFormat`. `intl` is no
longer imported by either screen.

Where it shows:

- **Dashboard card** — the pick row the web card has always had ("Pick needed by Fri, 8pm" in
  overprint with a rule round it, or "✓ Up to date"), plus the round's own status underneath when
  no pick is owed. Both, because a card on a phone is the only thing a player sees before deciding
  whether to open anything.
- **Competition dashboard** — "Round 2" as the eyebrow over the still-in count, and the status
  line under it: *Picks close Saturday 9 August, 3pm* → *Picks are in — the window is closed* →
  *4 of 10 results in* → *Round 2 is settled*.

### Competition info is on the page

`competition_home_page.dart` used to hide prize, description, venue and player count behind a
"Competition Info" button that opened a bottom sheet. The prize is the reason most players entered,
and a detail you have to know to ask for is one most players never see. It is now a ruled `ABOUT`
block at the foot of the screen — prize, blurb, then venue — matching where the web has always put
it. The sheet and its button are gone.

### The player's own status

`dark_status_cards.dart` is gone, replaced by `player_status_block.dart` — the two-column ruled
panel from the web's game screen, so the same two facts read the same way in both places. Colour
is a dot beside the word, never a fill behind it, and the word carries the state on its own.

**It shows two cells, not three.** The old middle cell repeated the round number that the block
directly above it already sets in 88pt. Two facts that are actually the player's — still in, lives
left — earn a cell each; the round is the screen's subject, not a statistic about them.

One thing that only shows up on a device: **display type needs its 0.06em tracking at small
sizes.** Big Shoulders is ultra-condensed, and `CouponTheme.heading()` carries no letter spacing,
so a two-letter value like "IN" sets with the strokes touching. Track any short display string.

**Prize, blurb and venue only.** The block first carried a player count and the team list as well,
and both were noise: the count is already the biggest thing on the screen, and which team list a
competition runs on is not a fact a player acts on. The whole block hides itself when an organiser
filled none of the three in, rather than showing a bare heading ruled off at both ends.

The generic football that sat beside the competition name went with it. It decorated the header
without identifying anything; an organiser's uploaded logo still shows, and nothing stands in for
it when there isn't one.

---

## 4. Copy

Design system §9 applies with one inversion that matters: **on the web "you" is always the
organiser. This app is player-only, so here "you" is the player.** Everything else holds — sentence
case, active voice, "matches" not "fixtures" in anything a person reads, errors that say what
happened and what to do, empty states that invite action.

---

## 4a. Checking a change on the real phone

A UI change is not verified until it has been looked at. There is no simulator worth trusting for
this — the coupon system is about hairlines, tracking and density, and all three lie on a desktop
window. The device is an SM A426B, 720×1600, `RZCR30746QZ`.

**Hot reload cannot be driven from an agent session.** `flutter run` wants a key press on an
interactive stdin, and an agent's shell has none. So drive it over adb instead, which needs no
attached session:

```bash
cd lmslocal-flutter
flutter build apk --debug                                   # ~15s warm, minutes cold
adb install -r build/app/outputs/flutter-apk/app-debug.apk
adb shell monkey -p uk.co.lmslocal.lmslocal_flutter -c android.intent.category.LAUNCHER 1
adb shell 'sleep 6'                                         # Dart splash holds 2s minimum
adb exec-out screencap -p > shot.png                        # then read the image
```

Then `adb shell input tap <x> <y>` to navigate, in the screenshot's own pixel coordinates
(`adb shell wm size` confirms they are 1:1 with the device).

**When you are working, don't use the phone.** Taps land in whatever is in front, and a
notification or a resumed app that arrives between `input tap` and `screencap` silently sends the
tap somewhere else — during this work one landed in Chess.com. Relaunch with `monkey` and carry
on; nothing is broken by it, but the screenshot is worthless.

Three things that will otherwise cost time:

- **Never `adb uninstall` to get past a signature clash.** The debug build shares
  `uk.co.lmslocal.lmslocal_flutter` with the release one, so installing over a *release*-signed
  build fails with `INSTALL_FAILED_UPDATE_INCOMPATIBLE` and uninstalling is the obvious fix. It is
  the wrong one: it wipes `flutter_secure_storage`, forcing a re-login, and destroys the only
  real-world instance of the untested v9→v11 token migration in §1. Stop and ask instead.
- **The dashboard cache outlives the build.** `dashboard_competitions` in `SharedPreferences` has
  a 5-minute TTL and is keyed on nothing else, so after a change to what `CompetitionModel` parses,
  the first launch reads a payload written by the old build with the new fields absent. Pull to
  refresh, or the round phase will be derived from defaults and be wrong.
- **`flutter build` and `flutter analyze` must run from `lmslocal-flutter/`.** Run from the repo
  root they analyse `lmslocal-server` and report "No issues found" having checked nothing Dart.

Verify what the screen claims against the database rather than trusting it — `node db/query.js`
from `lmslocal-server/`, read-only, no permission needed. A status line that says the right thing
for the wrong reason looks identical.

---

## 5. Building and releasing

There is no CI. Both platforms are built by hand.

- **Android** builds on the Windows dev machine. Signing config is in `android/key.properties`
  with the keystore at `android/upload-keystore.jks` — both correctly gitignored, neither is in the
  repo. Do not add them.
- **iOS** cannot be built here — there is no Xcode on Windows. All iOS changes (icons,
  `LaunchScreen.storyboard`, `Info.plist`, deployment target) are made in this repo and built on
  the Mac.
- `ios/Runner.xcodeproj/project.pbxproj` is listed in `.metadata` as an unmanaged file, so
  `flutter migrate` will not touch it. Changes there are manual and deliberate.
- iOS deployment target is 13.0. Leave it unless a dependency forces it up; raising it drops
  devices.

---

## 6. Owed by the client

Things that cannot be done from this machine, or that are decisions rather than work.

### Deep links: add `/join/*` — **not done, needs a web deploy**

Deep links already work and are correctly set up. `assetlinks.json` and
`apple-app-site-association` are both live and returning 200, and the Android fingerprints cover
the upload key *and* the Play App Signing key.

But both files only claim `/game/*`, so an invite link — `/join/[code]`, which is what onboarding
actually sends people — always opens the browser and never the app. Closing that needs three
changes, and only the first is in this repo:

1. **App** (here): an intent filter for `/join/*` in `AndroidManifest.xml`, plus a `/join/:code`
   route. The data layer already has `joinCompetitionByCode`, so this is routing, not new API
   work. The signed-out path is the fiddly half: remember the code, authenticate, *then* join.
2. **`lmslocal-web/public/.well-known/assetlinks.json`** — no change needed; it delegates all URLs.
3. **`lmslocal-web/public/.well-known/apple-app-site-association`** — add `"/join/*"` to `paths`.
   **This needs deploying to production before iOS join links work**, and iOS caches the file, so
   allow for it not taking effect immediately.

Test it separately from the rest of this work — it has its own failure modes and nothing else
depends on it.

Bundle IDs differ per platform and both are correct as they stand: Android is
`uk.co.lmslocal.lmslocal_flutter`, iOS is `uk.co.lmslocal.lmslocalflutter` (no underscore).

### iOS build

Built on the client's Mac; there is no Xcode on the Windows dev machine. All iOS-side changes are
made in this repo and pulled there. `flutter_secure_storage` 11 brings in a new
`flutter_secure_storage_darwin` implementation, so iOS wants a real device test of login and
session persistence, not just a compile.

### Push notifications

Firebase went 3→4 and 15→16. Token registration can be checked from here, but an actual send has
to be triggered by the client. Test foreground, background and terminated separately — they take
different code paths.

### `app_version.minimum_version`

Leave at `1.1.1`. See §2.

### Resolved

- `upload-keystore.jks.old` was committed to the repo (added in `501f25a`). Confirmed dead and
  deleted. The live `android/upload-keystore.jks` was and remains correctly gitignored.
- The 1024×1024 badge now exists as `docs/LMS-Local-Logo.png`. The two older 1024 files in `docs/`
  are the previous blue logo.
