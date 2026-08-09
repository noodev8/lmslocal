import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:provider/provider.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:lmslocal_flutter/core/config/app_config.dart';
import 'package:lmslocal_flutter/core/config/env_dev.dart';
import 'package:lmslocal_flutter/core/config/env_prod.dart';
import 'package:lmslocal_flutter/core/constants/app_constants.dart';
import 'package:lmslocal_flutter/core/di/injection.dart';
import 'package:lmslocal_flutter/core/theme/coupon_theme.dart';
import 'package:lmslocal_flutter/core/router/app_router.dart';
import 'package:lmslocal_flutter/core/router/pending_destination.dart';
import 'package:lmslocal_flutter/core/services/notification_routes.dart';
import 'package:lmslocal_flutter/presentation/bloc/auth/auth_event.dart';
import 'package:lmslocal_flutter/presentation/bloc/auth/auth_state.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Firebase
  await Firebase.initializeApp();

  // Automatically use production config for release builds
  // Development builds (flutter run, debug APKs) use dev config
  Config.initialize(kReleaseMode ? prodConfig : devConfig);

  // Initialize dependencies
  await Injection.init(Config.instance);

  // Set up 401 handler - clean up auth state and navigate to login
  final apiClient = Injection.getApiClient();
  apiClient.onUnauthorized = (message) {
    debugPrint('Session expired: $message');
    Injection.getAuthBloc().add(AuthSessionExpired(message: message));
    AppRouter.router.go('/login');
  };

  // Setup foreground notification handler
  Injection.getNotificationService().setupForegroundHandler();

  // A notification tapped while the app was backgrounded. The router exists by the time
  // this can fire, so it is acted on immediately unless there is no session to act with.
  Injection.getNotificationService().setupBackgroundTapHandler((message) {
    final route = routeForNotification(message);
    if (route == null) return;

    if (Injection.getAuthBloc().state is AuthAuthenticated) {
      AppRouter.router.go(route);
    } else {
      // Signed out, or a session that expired while the app sat in the background.
      // Holding the route means signing in finishes the journey the tap started.
      PendingDestination.remember(route);
    }
  });

  // A notification that started the app from cold. This resolves before the first frame,
  // long before the auth check has settled, so it cannot navigate — it is handed to the
  // splash screen, which already waits for auth and knows where to send people.
  final initialMessage = await Injection.getNotificationService().getInitialMessage();
  if (initialMessage != null) {
    final route = routeForNotification(initialMessage);
    if (route != null) PendingDestination.remember(route);
  }

  runApp(const LmsLocalApp());
}

class LmsLocalApp extends StatelessWidget {
  const LmsLocalApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        // Provide AuthBloc
        BlocProvider(
          create: (context) => Injection.getAuthBloc()
            ..add(const AuthCheckRequested()), // Check auth status on startup
        ),
        // Provide AuthRepository for profile page
        Provider.value(
          value: Injection.getAuthRepository(),
        ),
        // Provide ApiClient for profile page
        Provider.value(
          value: Injection.getApiClient(),
        ),
        // Provide TokenStorage for profile page
        Provider.value(
          value: Injection.getTokenStorage(),
        ),
      ],
      child: MaterialApp.router(
        title: AppConstants.appName,
        debugShowCheckedModeBanner: false,
        theme: CouponTheme.themeData(),
        routerConfig: AppRouter.createRouter(),
      ),
    );
  }
}
