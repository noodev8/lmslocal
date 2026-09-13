import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// The store review ask: the native prompt, once per competition, only to a
/// player who has just cleanly survived a round.
///
/// Both listings showed zero ratings on 50+ installs, which is a conversion
/// problem before it is a ranking one — a landlord comparing us against a rival
/// with stars sees a blank. This is the only part of that work needing code.
///
/// **The timing is the whole design, not the frequency.** iOS caps
/// `SKStoreReviewController` at three prompts per user per year and lets people
/// switch it off entirely; Play has its own quota. Ask every week and the OS
/// silently does nothing most weeks — so the risk was never nagging, it was a
/// scheduled prompt eventually firing at a bad moment. Hence:
///
/// - **Never after an elimination.** A player just knocked out being asked to
///   rate the app is the single outcome this design exists to avoid.
/// - **Never after a lost life.** Technically they survived; in the only sense
///   that matters they have just had bad news. Only a clean win qualifies.
/// - **Round 3 onward**, which selects someone on a good run with an opinion
///   rather than someone who joined yesterday.
///
/// Nothing here is a custom rating UI, and deliberately so: no "rate us" button,
/// no pre-ask, no stars in the app, and no manual route to the store listing when
/// the platform says the prompt is unavailable. The native prompt is the feature.
///
/// **Why a channel rather than `in_app_review`.** That package was the obvious
/// choice and does not build here: 2.0.12 is the newest release, its own
/// `android/build.gradle` applies `kotlin-android` and declares no `compileSdk`,
/// and this app is on AGP 9 with built-in Kotlin — so the plugin project fails
/// to evaluate. The only global escape hatch, `android.builtInKotlin=false`,
/// would undo the migration `android/app/build.gradle.kts` made deliberately.
/// The two platform calls are a handful of lines each, so they are ours: Play's
/// `ReviewManager` on Android, `SKStoreReviewController` on iOS.
class ReviewPrompt {
  ReviewPrompt._();

  /// Competition-scoped, so a player in their second competition next season is
  /// eligible again. That is correct — a fresh run is a fresh opinion — and the
  /// OS cap is what stops it becoming frequent.
  static String _key(int competitionId) => 'review_asked_comp_$competitionId';

  /// The earliest round worth asking after.
  static const int _minRound = 3;

  /// Ask, if this is one of the moments we ask.
  ///
  /// [survivedCleanly] must mean a win, not merely "still in": see the class
  /// note. Callers pass it rather than deriving it here, because the place that
  /// knows a round has just settled is the place that loaded its outcome.
  ///
  /// Fire-and-forget by nature. **Neither platform tells you whether the prompt
  /// appeared or whether anyone rated**, so there is no callback, no retry and
  /// no analytics to hang off this — anything built on knowing would be built on
  /// a guess.
  static Future<void> maybeAsk({
    required int competitionId,
    required int roundNumber,
    required bool survivedCleanly,
  }) async {
    if (!survivedCleanly) return;
    if (roundNumber < _minRound) return;

    final prefs = await SharedPreferences.getInstance();
    final key = _key(competitionId);
    if (prefs.getBool(key) ?? false) return;

    // Written before the request, never after it. There is no completion worth
    // waiting on, and a crash between the two would re-ask.
    await prefs.setBool(key, true);

    // A developer on hot reload would otherwise burn the real quota on their own
    // device, and on iOS a debug build shows the prompt every single time. The
    // log is how the decision is verified on a plugged-in phone, since a
    // `flutter run` install can never show the production behaviour anyway.
    if (kDebugMode) {
      debugPrint(
        '[ReviewPrompt] would request review: '
        'competition $competitionId, round $roundNumber, survived cleanly',
      );
      return;
    }

    await _request();
  }

  static const MethodChannel _channel =
      MethodChannel('uk.co.lmslocal/review');

  /// Ask the platform to ask. Never throws: a device with no Play Store, an iOS
  /// version without the API, or a flow the OS declines to show are all the same
  /// outcome here — nothing happens, and there is nothing to tell the player.
  static Future<void> _request() async {
    try {
      await _channel.invokeMethod<void>('requestReview');
    } on PlatformException catch (e) {
      debugPrint('[ReviewPrompt] platform declined: ${e.code}');
    } on MissingPluginException {
      // A platform with no implementation — the desktop and web targets the
      // project also builds. Silently correct: there is no store prompt to show.
    }
  }
}
