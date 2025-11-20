import 'app_config.dart';

/// Development environment configuration
/// Uses local IP address for testing on physical devices
const devConfig = AppConfig(
  //apiBaseUrl: 'https://lmslocal.express.noodev8.com',
  webBaseUrl: 'https://www.lmslocal.co.uk',
  apiBaseUrl: 'http://192.168.1.94:3015',
  // webBaseUrl: 'http://192.168.1.88:3000',
  environment: 'development',
  apiTimeout: 30000, // 30 seconds for development (allows debugging)
  enableLogging: false,
  enableCertificatePinning: false,
);
