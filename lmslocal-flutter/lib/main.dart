import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:lmslocal_flutter/core/config/app_config.dart';
import 'package:lmslocal_flutter/core/config/env_dev.dart';
import 'package:lmslocal_flutter/core/config/env_prod.dart';
import 'package:lmslocal_flutter/core/constants/app_constants.dart';
import 'package:lmslocal_flutter/core/di/injection.dart';
import 'package:lmslocal_flutter/core/router/app_router.dart';
import 'package:lmslocal_flutter/presentation/bloc/auth/auth_event.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Automatically use production config for release builds
  // Development builds (flutter run, debug APKs) use dev config
  Config.initialize(kReleaseMode ? prodConfig : devConfig);

  // Initialize dependencies
  await Injection.init(Config.instance);

  // Set up 401 handler - navigate to login on session expiry
  final apiClient = Injection.getApiClient();
  apiClient.onUnauthorized = (message) {
    // This will be handled by AuthBloc listening to session expiry
    print('⚠️ Session expired: $message');
  };

  runApp(const LmsLocalApp());
}

class LmsLocalApp extends StatelessWidget {
  const LmsLocalApp({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (context) => Injection.getAuthBloc()
        ..add(const AuthCheckRequested()), // Check auth status on startup
      child: MaterialApp.router(
        title: AppConstants.appName,
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(
            seedColor: AppConstants.primaryNavy,
            primary: AppConstants.primaryNavy,
          ),
          useMaterial3: true,
          appBarTheme: AppBarTheme(
            backgroundColor: AppConstants.primaryNavy,
            foregroundColor: Colors.white,
            elevation: 0,
          ),
          elevatedButtonTheme: ElevatedButtonThemeData(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppConstants.primaryNavy,
              foregroundColor: Colors.white,
            ),
          ),
          textButtonTheme: TextButtonThemeData(
            style: TextButton.styleFrom(
              foregroundColor: AppConstants.primaryNavy,
            ),
          ),
        ),
        routerConfig: AppRouter.createRouter(),
      ),
    );
  }
}
