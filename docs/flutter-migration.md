# Flutter app migration

Tracks the work to bring `lmslocal-flutter` up to a current toolchain and onto the pools-coupon
design system. **Read `docs/design-system.md` first** — this document does not restate the system,
it records how it lands in Flutter and what is done.

The app is **live on both stores** (`1.2.9+15` at the time of writing) and is **player-only**.
Every API it needs already exists; no server work is in scope.

**Status:** Release A in progress on Android. Baseline was commit `aa0f83e`.

Done: fonts bundled, low-risk dependency bumps, version to `2.0.0+16`, launcher icons
(adaptive + monochrome + iOS) from the new badge, native and Dart splash on `stock`,
`coupon_theme.dart` tokens. Verified building and installing on a physical SM A426B (Android 12).

Outstanding for Release A: the four major dependency bumps (`go_router`, Firebase,
`flutter_secure_storage`, `package_info_plus`), then the iOS build on the Mac.

---

## 1. One release, `2.0.0+16`

Originally planned as two submissions — toolchain first, restyle second — so that a production
failure would be attributable to one or the other. That was reconsidered once the numbers were
clear: the user base is small enough that a staged rollout buys little, and the app is not yet
load-bearing for anyone. Upgrade and restyle ship together.

The two failure modes to watch for are silent, and neither shows an error the user can see:
`flutter_secure_storage` failing to read existing tokens (everyone is logged out) and a Firebase
bump breaking push. **A forced re-login is accepted** rather than engineered around.

**Nobody is locked out by the version bump.** The gate in `splash_page.dart` compares against
`app_version.minimum_version` in the database, currently `1.1.1` on both platforms. Shipping 2.0.0
leaves every existing install working. Raising that row is a deliberate, separate act — do not do
it as part of this release.

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
| `dark_status_cards.dart` | Named for the dark theme | Ruled rows |

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

| Screen | Lines | Notes |
|---|---|---|
| `splash_page.dart` | 142 | Do first — it is the icon, splash and font work meeting |
| `login` / `register` / `forgot_password` | 982 | Web equivalents are already migrated. Copy `AuthShell` |
| `dashboard_page.dart` | 1480 | Competition list |
| `competition_home_page.dart` + 11 widgets | 642 + ~1400 | Where the four dead widgets live |
| `play_page` / `pick_page` / `waiting_page` / `player_results_page` | ~1600 | `player_results` is where `moss` vs `moss-wash` was already got wrong twice on web — read §8 before touching it |
| `standings_page.dart` | 1663 | The survival sheet is the model: `font-data` names, dotted leaders, struck-through eliminations, count in display type |
| `profile_page.dart` | 1214 | |
| `update_required_dialog.dart` | | Small, but it is the only screen a blocked user ever sees |

---

## 4. Copy

Design system §9 applies with one inversion that matters: **on the web "you" is always the
organiser. This app is player-only, so here "you" is the player.** Everything else holds — sentence
case, active voice, "matches" not "fixtures" in anything a person reads, errors that say what
happened and what to do, empty states that invite action.

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

### Loose end

`lmslocal-flutter/upload-keystore.jks.old` is **committed to the repo** (added in `501f25a`). It
is a different file from the live `android/upload-keystore.jks` and appears to be dead, but a
keystore does not belong in git. Confirm it is unused, then delete it.
