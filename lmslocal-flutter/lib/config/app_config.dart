class AppConfig {
  // Change this URL for your environment
  // Uncomment the one you need and comment out the others
  
  // Development - Local server
  // static const String baseUrl = 'http://localhost:3015';
  static const String baseUrl = 'http://192.168.1.136:3015';
  // static const String baseUrl = 'http://10.0.2.2:3015'; // Android emulator host
  // static const String baseUrl = 'http://192.168.1.100:3015'; // Real device on WiFi
  // static const String baseUrl = 'https://api.lmslocal.com';
  
  // API Configuration
  static const Duration connectTimeout = Duration(seconds: 10);
  static const Duration receiveTimeout = Duration(seconds: 15);
  static const Duration sendTimeout = Duration(seconds: 10);
  
  // Cache Configuration (in hours) - Conservative for admin changes
  static const int competitionsCacheHours = 8;     // 8 hours (admin might add competitions)
  static const int currentRoundCacheHours = 4;     // 4 hours (admin might add fixtures mid-week)
  static const int historyCacheHours = 24;         // 1 day (historical data stable but not critical)
  static const int allowedTeamsCacheHours = 8;     // 8 hours (only changes after picks confirmed)
  static const int teamListsCacheHours = 24;       // 1 day (seasonal data, but admins might adjust)
  
  // App Information
  static const String appName = 'LMS Local';
  static const String appVersion = '1.0.0';
  
  // Debug settings
  static const bool enableApiLogging = true;
  static const bool enableCacheLogging = true;
}