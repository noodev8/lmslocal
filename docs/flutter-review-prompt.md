# Build spec — in-app review prompt (Flutter)

> **TEMPORARY FILE. Delete it when the prompt ships.** It is a handoff note for one piece of work,
> not a doc anybody should be maintaining. If you are reading this and the feature exists, delete
> the file in the same commit that finishes the work.
>
> Agreed with Andreas 2026-09-13. Not started.

## Why

Both store listings show **zero ratings** on 50+ installs. A landlord comparing LMSLocal against
Tippd sees stars on one and a blank on the other, so this is a conversion problem before it is a
ranking one — though ratings feed store search too.

This sits alongside the store-listing work (rename to include "Last Man Standing", recategorise
from Games to Sports). Ratings are the third leg of that and the only one needing code.

## The decisions already made

Andreas was reluctant to ask players at all — *"I always feel bad about asking. We don't want to
annoy them in the game."* The design answers that, and the reasoning matters as much as the rule:

**Frequency is not the risk. Timing is.** iOS caps `SKStoreReviewController` at **3 prompts per
user per 365 days** and lets people switch it off entirely in Settings; Play's In-App Review API
has its own quota. Call it every week and the OS silently does nothing most weeks. So the danger
is not nagging — it is that a scheduled prompt eventually fires at a *bad* moment.

| Decision | Rule |
|---|---|
| **Trigger** | After a player **survives a round**, from **round 3 onward** |
| **Never** | After an elimination. Never mid-pick. Never on launch or first run |
| **Our own gate** | At most **once per competition**, persisted locally |
| **Mechanism** | Native prompt only — `in_app_review`. No custom "rate us" dialog, no stars-in-app, no "enjoying the app?" pre-ask |

Round 3 rather than round 1 is deliberate: it selects someone on a good run who is engaged enough
to have an opinion, rather than someone who joined yesterday.

The one hard rule is **never after an elimination**. A player who has just been knocked out being
asked to rate the app is the single bad outcome this design exists to avoid.

## Implementation notes

- Package: [`in_app_review`](https://pub.dev/packages/in_app_review). Not currently in
  `pubspec.yaml` — it will need adding. `shared_preferences: ^2.5.5` **is** already there, so use
  it for the gate rather than introducing storage.
- Always check `isAvailable()` before requesting. It is false on devices with no Play Store, and
  on iOS below the supported version.
- **You cannot detect whether the prompt appeared, or whether the user rated.** Both platforms
  return nothing useful. Do not build any logic, retry, or analytics that depends on knowing —
  treat `requestReview()` as fire-and-forget.
- Write the gate *before* or at the same time as the request, not after a callback. There is no
  callback worth waiting for, and a crash between the two would re-ask.
- Suggested key shape: `review_asked_comp_<competitionId>`. Competition-scoped, so a player in
  their second competition next season is eligible again — which is correct, and the OS cap stops
  it becoming frequent.
- Do not fire in debug builds. A developer hammering hot reload will burn the real quota on their
  own device.

### Where the trigger goes

Confirm this rather than trusting it — the code moves.

- `lib/presentation/pages/competition/competition_home_page.dart` is the screen a player lands on,
  and `widgets/player_status_block.dart` renders their IN/OUT status.
- `lib/domain/entities/competition.dart` carries `status` and `livesRemaining`.
- `lib/core/game/round_state.dart` is the ported state machine — `RoundPhase.resultsReady` and
  the phases around it are how the app knows results are in. **Read `docs/round-state-machine.md`
  first; that doc is the contract for this file and its web twin.**
- `lib/presentation/pages/play/player_results_page.dart` also shows results, including to
  eliminated players — so it is a tempting but **wrong** place to hook, unless you are certain you
  can distinguish survived from eliminated there.

The condition is roughly: *results for round N are in, this player is still in, N >= 3, and we
have not asked for this competition.* Find the single place that is true exactly once per round
transition — not on every rebuild.

### A note on losing a life

A player with lives who loses one has survived, technically. Treat that as **not** a moment to
ask: they have just had bad news. Only ask on a clean survival.

## Testing

- **iOS:** the prompt behaves differently per channel. In a **TestFlight** build it never shows;
  in a **debug/simulator** build it shows every time; in **production** it is throttled by the
  3-per-year cap. So you cannot verify production behaviour directly — verify the *call* happens
  under the right conditions (log it), and verify the prompt renders at all in a simulator build.
- **Android:** needs the app installed from a Play track (internal testing is enough). Sideloaded
  debug builds will not show it.
- Per the project convention, **build, install and screenshot on the phone** after the UI work
  rather than stopping at a green build.

## Acceptance

1. A player surviving round 3+ triggers exactly one `requestReview()` call for that competition.
2. An eliminated player never triggers one, in any code path.
3. A player who loses a life but survives never triggers one.
4. Re-opening the app, pulling to refresh, or rebuilding the widget does not trigger a second call.
5. Nothing is requested in debug builds.
6. No custom rating UI exists anywhere in the app.

## Do not

- Do not add a "rate us" button, banner, or pre-ask dialog. The native prompt is the whole feature.
- Do not ask on app launch, after a pick, or on a timer.
- Do not route people to the store listing manually as a fallback when `isAvailable()` is false —
  just do nothing.
- Do not gate anything in the app behind rating it.
