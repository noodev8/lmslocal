import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lmslocal_flutter/presentation/pages/auth/forgot_password_page.dart';
import 'package:lmslocal_flutter/presentation/pages/auth/login_page.dart';
import 'package:lmslocal_flutter/presentation/pages/auth/register_page.dart';
import 'package:lmslocal_flutter/presentation/pages/dashboard/dashboard_page.dart';
import 'package:lmslocal_flutter/presentation/pages/splash/splash_page.dart';

/// App router configuration using GoRouter
class AppRouter {
  static GoRouter createRouter() {
    return GoRouter(
      initialLocation: '/',
      routes: [
        // Splash screen (handles its own navigation)
        GoRoute(
          path: '/',
          builder: (context, state) => const SplashPage(),
        ),

        // Login screen
        GoRoute(
          path: '/login',
          builder: (context, state) => const LoginPage(),
        ),

        // Dashboard screen (protected)
        GoRoute(
          path: '/dashboard',
          builder: (context, state) => const DashboardPage(),
        ),

        // Register screen
        GoRoute(
          path: '/register',
          builder: (context, state) => const RegisterPage(),
        ),

        // Forgot password screen
        GoRoute(
          path: '/forgot-password',
          builder: (context, state) => const ForgotPasswordPage(),
        ),
      ],
    );
  }
}
