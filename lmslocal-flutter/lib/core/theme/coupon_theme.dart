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
}
