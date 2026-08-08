import 'package:flutter/material.dart';
import 'package:lmslocal_flutter/core/theme/coupon_theme.dart';

/// Application-wide constants
class AppConstants {
  // App Info
  static const String appName = 'LMS Local';
  static const String appVersion = '1.2.5'; // Not used - version comes from pubspec.yaml

  // **Transitional**, like GameTheme: the old navy brand colours remapped onto
  // the coupon system so the screens still importing them are on the right
  // palette. Use CouponTheme in new code; there is no blue in this system.
  static const Color primaryNavy = CouponTheme.ink;
  static const Color primaryWhite = CouponTheme.stockLit;
  static const Color accentLightBlue = CouponTheme.inkFade;

  // JWT Token
  static const String tokenKey = 'jwt_token';
  static const int tokenExpiryDays = 90;

  // API Response Codes
  static const String successCode = 'SUCCESS';
  static const String validationErrorCode = 'VALIDATION_ERROR';
  static const String unauthorizedCode = 'UNAUTHORIZED';
  static const String invalidCredentialsCode = 'INVALID_CREDENTIALS';
  static const String emailExistsCode = 'EMAIL_EXISTS';
  static const String emailNotVerifiedCode = 'EMAIL_NOT_VERIFIED';
  static const String serverErrorCode = 'SERVER_ERROR';

  // Spacing & Sizing
  static const double paddingSmall = 8.0;
  static const double paddingMedium = 16.0;
  static const double paddingLarge = 24.0;
  // Printed forms are square. rounded-sm (4) survives on buttons and inputs as
  // a slight stamped softening; everything else is squared off.
  static const double radiusSmall = 4.0;
  static const double radiusMedium = 0.0;
  static const double radiusLarge = 0.0;

  // Animation Durations
  static const Duration animationFast = Duration(milliseconds: 200);
  static const Duration animationNormal = Duration(milliseconds: 300);
  static const Duration animationSlow = Duration(milliseconds: 500);
}
