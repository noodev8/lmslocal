import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lmslocal_flutter/presentation/pages/auth/login_page.dart';
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

        // Register screen - placeholder for now
        GoRoute(
          path: '/register',
          builder: (context, state) => Scaffold(
            appBar: AppBar(title: const Text('Register')),
            body: const Center(
              child: Text('Register page - Phase 1'),
            ),
          ),
        ),

        // Forgot password screen - placeholder for now
        GoRoute(
          path: '/forgot-password',
          builder: (context, state) => Scaffold(
            appBar: AppBar(title: const Text('Forgot Password')),
            body: const Center(
              child: Text('Forgot Password page - Phase 1'),
            ),
          ),
        ),
      ],
    );
  }
}
