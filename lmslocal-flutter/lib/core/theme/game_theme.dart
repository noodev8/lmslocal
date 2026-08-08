import 'package:flutter/material.dart';
import 'package:lmslocal_flutter/core/theme/coupon_theme.dart';

/// **Transitional.** The old dark navy/cyan gaming theme, remapped onto the
/// coupon system so every screen that still imports it is on the right palette
/// while it waits its turn to be migrated properly.
///
/// Do not add to this, and do not use it in new code — use [CouponTheme].
/// A screen is done when its `game_theme.dart` import is gone; when the last
/// one goes, delete this file.
///
/// The members with no counterpart in the coupon system are deliberately
/// neutered rather than removed, so the screens still compile while they wait:
/// the gradients return a flat colour and the glow shadows return nothing. The
/// system has no gradients and exactly one shadow — see docs/design-system.md.
class GameTheme {
  // === BACKGROUNDS ===
  static const Color background = CouponTheme.stock;
  static const Color backgroundLight = CouponTheme.stockDeep;
  static const Color cardBackground = CouponTheme.stockLit;

  // === WAS GLOW ===
  // Cyan carried emphasis in the old theme. Emphasis here is ink; overprint is
  // reserved for eliminations and primary actions, so a blanket remap to it
  // would scatter red over every screen.
  static const Color glowCyan = CouponTheme.ink;
  static const Color glowTeal = CouponTheme.ink;
  static const Color glowBlue = CouponTheme.inkFade;

  // === TEXT ===
  static const Color textPrimary = CouponTheme.ink;
  static const Color textSecondary = CouponTheme.inkFade;
  static const Color textMuted = CouponTheme.inkFade;

  // === ACCENTS ===
  /// "Still in", won. The third ink.
  static const Color accentGreen = CouponTheme.moss;

  /// Out, eliminated, lives lost. The second ink.
  static const Color accentRed = CouponTheme.overprint;

  /// Warnings. There is no third accent in this system, so this is plain ink —
  /// a warning earns its weight from size and position, not from a new hue.
  static const Color accentOrange = CouponTheme.ink;

  // === BORDERS ===
  static Color get border => CouponTheme.ink.withValues(alpha: 0.3);
  static const Color borderGlow = CouponTheme.ink;

  // === NEUTERED: no gradients in this system ===
  static const LinearGradient backgroundGradient = LinearGradient(
    colors: [CouponTheme.stock, CouponTheme.stock],
  );
  static const LinearGradient cardGradient = LinearGradient(
    colors: [CouponTheme.stockLit, CouponTheme.stockLit],
  );
  static const LinearGradient glowGradient = LinearGradient(
    colors: [CouponTheme.ink, CouponTheme.ink],
  );

  // === NEUTERED: exactly one shadow exists, and it is not a glow ===
  static List<BoxShadow> get glowShadow => const [];
  static List<BoxShadow> get borderGlowShadow => const [];
  static List<BoxShadow> get cardShadow => CouponTheme.printOffset;

  // === HELPERS ===
  static Color cardBackgroundWithOpacity(double opacity) =>
      CouponTheme.stockLit.withValues(alpha: opacity);

  static Color glowWithIntensity(double intensity) =>
      CouponTheme.ink.withValues(alpha: intensity);
}
