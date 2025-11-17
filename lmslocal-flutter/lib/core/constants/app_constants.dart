import 'package:flutter/material.dart';

/// Application-wide constants
class AppConstants {
  // App Info
  static const String appName = 'LMS Local';
  static const String appVersion = '1.1.0';

  // Brand Colors (extracted from LMS-Local-Logo.png)
  static const Color primaryNavy = Color(0xFF2C497C); // Matches logo background exactly
  static const Color primaryWhite = Color(0xFFFFFFFF);
  static const Color accentLightBlue = Color(0xFF6B8EBF);

  // Additional UI Colors
  static const Color successGreen = Color(0xFF10B981);
  static const Color errorRed = Color(0xFFEF4444);
  static const Color warningOrange = Color(0xFFF59E0B);
  static const Color infoBlue = Color(0xFF3B82F6);

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
  static const double radiusSmall = 4.0;
  static const double radiusMedium = 8.0;
  static const double radiusLarge = 12.0;

  // Animation Durations
  static const Duration animationFast = Duration(milliseconds: 200);
  static const Duration animationNormal = Duration(milliseconds: 300);
  static const Duration animationSlow = Duration(milliseconds: 500);
}
