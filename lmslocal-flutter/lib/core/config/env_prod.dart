import 'app_config.dart';

/// Production environment configuration
/// Uses live production URLs
const prodConfig = AppConfig(
  apiBaseUrl: 'https://api.lmslocal.co.uk',
  webBaseUrl: 'https://www.lmslocal.co.uk',
  environment: 'production',
  apiTimeout: 10000, // 10 seconds for production
  enableLogging: false,
  enableCertificatePinning: true, // Enable SSL pinning in production
);
