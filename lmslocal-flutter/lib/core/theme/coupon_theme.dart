import 'package:flutter/material.dart';

/// The pools-coupon design system, ported from the web.
///
/// This is the Flutter half of `docs/design-system.md` — read that before
/// changing anything here. Token names and hex values match
/// `lmslocal-web/tailwind.config.js` exactly so the two codebases can be
/// compared by eye.
///
/// Deliberately absent, and not to be added back: gradients, blurred shadows,
/// glows, and any third accent colour. The system has two inks plus `moss` for
/// game state, and exactly one shadow — the hard print offset.
class CouponTheme {
  // === GROUNDS ===
  /// Banded sections that need to sit back from the page
  static const Color stockDeep = Color(0xFFCDD3C4);

  /// The page ground. The default background
  static const Color stock = Color(0xFFDDE1D6);

  /// Lifted panels: the sheet, the docket, cards
  static const Color stockLit = Color(0xFFF2F3EC);

  // === INKS ===
  /// Primary ink. Body text, rules, dark sections
  static const Color ink = Color(0xFF1C2620);

  /// Secondary text: labels, captions, ledger keys
  static const Color inkFade = Color(0xFF4A5249);

  /// The second ink. Eliminations, primary actions, emphasis.
  /// A scarce resource — if a screen has more than a handful of red elements,
  /// something is wrong. Never use it as a plain error colour.
  static const Color overprint = Color(0xFFC8341E);

  /// Third ink, game screens only. "Still in", won.
  /// A mark or a stamp, never a fill — see design-system.md §8.
  static const Color moss = Color(0xFF2F4B32);

  /// The same green as a *ground*. Winner cards and panels.
  /// Never text, never rules.
  static const Color mossWash = Color(0xFFCFE4C4);

  // === FONT FAMILIES ===
  /// Big Shoulders. Headings, buttons, big numbers. Always uppercase
  static const String display = 'BigShoulders';

  /// Instrument Sans. Body copy and every interface label
  static const String body = 'InstrumentSans';

  /// Courier Prime. ONLY things a person entered — names, picks, scores,
  /// access codes, timestamps. Never interface chrome
  static const String data = 'CourierPrime';

  /// Big Shoulders and Instrument Sans ship as single variable files, so weight
  /// is selected on the axis rather than by loading a second face. Setting
  /// `fontWeight` alone does not move a variable axis reliably across platforms.
  static List<FontVariation> weight(double w) => [FontVariation('wght', w)];

  // === SHADOW ===
  /// The one shadow in the system: a hard print offset, no blur. Anything
  /// blurred belongs to the old theme and should not come back.
  static const List<BoxShadow> printOffset = [
    BoxShadow(
      color: Color(0x291C2620),
      offset: Offset(4, 4),
      blurRadius: 0,
    ),
  ];

  // === RULES ===
  /// Hairline divider. A CSS pixel is thinner than a Flutter logical pixel, so
  /// rules are drawn sub-pixel to stay hairlines on high-density screens rather
  /// than thickening into bars.
  static BorderSide rule({double opacity = 0.3}) =>
      BorderSide(color: ink.withValues(alpha: opacity), width: 0.5);

  // === TEXT STYLES ===
  // Sizes and tracking mirror docs/design-system.md §3. Small uppercase text
  // needs some tracking and is ruined by too much — 0.12em labels, 0.16em
  // eyebrows, 0.06em display buttons.

  /// Section eyebrow above a display heading. Usually `overprint`.
  static const TextStyle eyebrow = TextStyle(
    fontFamily: body,
    fontSize: 12,
    letterSpacing: 12 * 0.16,
    height: 1.2,
    color: overprint,
  );

  /// Utility label: field labels, captions, chips, nav.
  static const TextStyle label = TextStyle(
    fontFamily: body,
    fontSize: 12,
    letterSpacing: 12 * 0.12,
    height: 1.2,
    color: inkFade,
  );

  /// Display heading. Always uppercase, always semibold — the page has one
  /// display voice, so do not mix weights within it.
  static TextStyle heading(double size) => TextStyle(
        fontFamily: display,
        fontSize: size,
        height: 0.9,
        fontVariations: weight(600),
        color: ink,
      );

  /// The middle rung between display and body. Do not skip it.
  static const TextStyle intro = TextStyle(
    fontFamily: body,
    fontSize: 20,
    height: 1.5,
    color: ink,
  );

  static const TextStyle bodyText = TextStyle(
    fontFamily: body,
    fontSize: 17,
    height: 1.45,
    color: ink,
  );

  /// Filled-in data only: names, picks, scores, access codes, timestamps.
  static const TextStyle dataText = TextStyle(
    fontFamily: data,
    fontSize: 15,
    color: ink,
  );

  /// The app-wide Material theme.
  ///
  /// Material defaults fight this system — Cards, Dialogs, BottomSheets,
  /// SnackBars and Chips all arrive rounded and elevated. Squaring and
  /// flattening them here means individual screens do not each have to.
  static ThemeData themeData() {
    const squared = RoundedRectangleBorder(borderRadius: BorderRadius.zero);
    // rounded-sm: a slight stamped softening, buttons and inputs only.
    final stamped = BorderRadius.circular(4);

    OutlineInputBorder field(Color color, double width) => OutlineInputBorder(
          borderRadius: stamped,
          borderSide: BorderSide(color: color, width: width),
        );

    return ThemeData(
      useMaterial3: true,
      fontFamily: body,
      scaffoldBackgroundColor: stock,
      canvasColor: stock,
      dividerColor: ink.withValues(alpha: 0.3),
      colorScheme: const ColorScheme.light(
        primary: ink,
        onPrimary: stockLit,
        secondary: overprint,
        onSecondary: stockLit,
        surface: stockLit,
        onSurface: ink,
        error: overprint,
        onError: stockLit,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: stock,
        foregroundColor: ink,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: heading(28),
      ),
      // Square, flat, hairline-ruled.
      cardTheme: CardThemeData(
        color: stockLit,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.zero,
          side: rule(),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: stockLit,
        elevation: 0,
        shape: squared,
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: stockLit,
        elevation: 0,
        shape: squared,
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: ink,
        contentTextStyle: bodyText.copyWith(color: stockLit),
        elevation: 0,
        shape: squared,
        behavior: SnackBarBehavior.floating,
      ),
      dividerTheme: DividerThemeData(
        color: ink.withValues(alpha: 0.3),
        thickness: 0.5,
        space: 0.5,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: stockLit,
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
        labelStyle: label,
        floatingLabelStyle: label.copyWith(color: ink),
        hintStyle: bodyText.copyWith(color: inkFade.withValues(alpha: 0.7)),
        // Errors get ink text with an overprint rule beside them — overprint is
        // the brand's second ink, so an error set in it reads as emphasis.
        errorStyle: bodyText.copyWith(fontSize: 15),
        border: field(ink.withValues(alpha: 0.4), 1),
        enabledBorder: field(ink.withValues(alpha: 0.4), 1),
        focusedBorder: field(ink, 1.5),
        errorBorder: field(overprint, 1),
        focusedErrorBorder: field(overprint, 1.5),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: overprint,
          foregroundColor: stockLit,
          disabledBackgroundColor: overprint.withValues(alpha: 0.7),
          disabledForegroundColor: stockLit,
          elevation: 0,
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 32),
          shape: RoundedRectangleBorder(borderRadius: stamped),
          textStyle: TextStyle(
            fontFamily: display,
            fontSize: 24,
            letterSpacing: 24 * 0.06,
            fontVariations: weight(600),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: ink,
          side: const BorderSide(color: ink, width: 1),
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 32),
          shape: RoundedRectangleBorder(borderRadius: stamped),
          textStyle: TextStyle(
            fontFamily: display,
            fontSize: 24,
            letterSpacing: 24 * 0.06,
            fontVariations: weight(600),
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: ink,
          textStyle: bodyText,
        ),
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: ink,
        linearTrackColor: stockDeep,
        circularTrackColor: stockDeep,
      ),
    );
  }
}
