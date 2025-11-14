/// Application configuration class
/// Holds environment-specific settings like API URLs, timeouts, and feature flags
class AppConfig {
  final String apiBaseUrl;
  final String webBaseUrl;
  final String environment;
  final int apiTimeout;
  final bool enableLogging;
  final bool enableCertificatePinning;

  const AppConfig({
    required this.apiBaseUrl,
    required this.webBaseUrl,
    required this.environment,
    this.apiTimeout = 10000,
    this.enableLogging = false,
    this.enableCertificatePinning = false,
  });

  bool get isDevelopment => environment == 'development';
  bool get isProduction => environment == 'production';
}

/// Global configuration singleton
/// Initialize once at app startup with the appropriate environment config
class Config {
  static late AppConfig instance;

  static void initialize(AppConfig config) {
    instance = config;
  }
}
