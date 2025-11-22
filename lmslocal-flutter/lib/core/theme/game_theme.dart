import 'package:flutter/material.dart';

/// Dark gaming theme colors for the competition dashboard redesign
/// Based on Mock-Up.jpg - dark navy with cyan glow effects
class GameTheme {
  // === BACKGROUND COLORS ===
  /// Main dark background - deep navy
  static const Color background = Color(0xFF0A1628);

  /// Slightly lighter background for layering
  static const Color backgroundLight = Color(0xFF12203A);

  /// Card/surface background - semi-transparent
  static const Color cardBackground = Color(0xFF1A2D4A);

  // === GLOW COLORS ===
  /// Primary cyan glow for the players ring
  static const Color glowCyan = Color(0xFF00D4FF);

  /// Secondary teal glow
  static const Color glowTeal = Color(0xFF00B4D8);

  /// Subtle blue glow
  static const Color glowBlue = Color(0xFF4DA8DA);

  // === TEXT COLORS ===
  /// Primary text - bright white
  static const Color textPrimary = Color(0xFFFFFFFF);

  /// Secondary text - slightly dimmed
  static const Color textSecondary = Color(0xFFB8C5D6);

  /// Muted text - for labels
  static const Color textMuted = Color(0xFF6B7D93);

  // === ACCENT COLORS ===
  /// Success/active state - green
  static const Color accentGreen = Color(0xFF00E676);

  /// Lives/heart - red
  static const Color accentRed = Color(0xFFFF5252);

  /// Warning - orange
  static const Color accentOrange = Color(0xFFFFAB40);

  // === BORDER/DIVIDER COLORS ===
  /// Subtle border
  static const Color border = Color(0xFF2A3F5F);

  /// Glowing border for highlighted elements
  static const Color borderGlow = Color(0xFF00D4FF);

  // === GRADIENTS ===
  /// Background gradient (top to bottom)
  static const LinearGradient backgroundGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [
      Color(0xFF0A1628),
      Color(0xFF0D1B2A),
      Color(0xFF1B2838),
    ],
  );

  /// Card gradient for depth
  static const LinearGradient cardGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Color(0xFF1A2D4A),
      Color(0xFF152238),
    ],
  );

  /// Glow gradient for the ring effect
  static const LinearGradient glowGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [
      Color(0xFF00D4FF),
      Color(0xFF00B4D8),
      Color(0xFF0077B6),
    ],
  );

  // === BOX SHADOWS ===
  /// Cyan glow shadow for the main ring
  static List<BoxShadow> get glowShadow => [
    BoxShadow(
      color: glowCyan.withValues(alpha: 0.4),
      blurRadius: 30,
      spreadRadius: 5,
    ),
    BoxShadow(
      color: glowCyan.withValues(alpha: 0.2),
      blurRadius: 60,
      spreadRadius: 10,
    ),
  ];

  /// Subtle card shadow
  static List<BoxShadow> get cardShadow => [
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.3),
      blurRadius: 10,
      offset: const Offset(0, 4),
    ),
  ];

  /// Glow border shadow for status cards
  static List<BoxShadow> get borderGlowShadow => [
    BoxShadow(
      color: glowCyan.withValues(alpha: 0.15),
      blurRadius: 8,
      spreadRadius: 1,
    ),
  ];

  // === HELPER METHODS ===
  /// Get a semi-transparent version of the card background
  static Color cardBackgroundWithOpacity(double opacity) {
    return cardBackground.withValues(alpha: opacity);
  }

  /// Get glow color with custom intensity
  static Color glowWithIntensity(double intensity) {
    return glowCyan.withValues(alpha: intensity);
  }
}
