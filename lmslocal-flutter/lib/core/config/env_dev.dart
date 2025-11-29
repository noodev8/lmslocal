import 'app_config.dart';

/// Development environment configuration
/// Uses local IP address for testing on physical devices
const devConfig = AppConfig(
  apiBaseUrl: 'https://lmslocal.express.noodev8.com',
  // apiBaseUrl: 'http://192.168.1.136:3015',
  
  webBaseUrl: 'https://www.lmslocal.co.uk',
  //webBaseUrl: 'http://192.168.1.136:3000',
  environment: 'development',
  apiTimeout: 30000, // 30 seconds for development (allows debugging)
  enableLogging: false,
  enableCertificatePinning: false,
);
