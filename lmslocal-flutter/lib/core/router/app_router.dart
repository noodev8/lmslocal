import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lmslocal_flutter/core/theme/game_theme.dart';
import 'package:lmslocal_flutter/presentation/pages/auth/forgot_password_page.dart';
import 'package:lmslocal_flutter/presentation/pages/auth/login_page.dart';
import 'package:lmslocal_flutter/presentation/pages/auth/register_page.dart';
import 'package:lmslocal_flutter/presentation/pages/competition/competition_navigation_page.dart';
import 'package:lmslocal_flutter/presentation/pages/dashboard/dashboard_page.dart';
import 'package:lmslocal_flutter/presentation/pages/profile/profile_page.dart';
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

        // Dashboard (protected) - no bottom nav
        GoRoute(
          path: '/dashboard',
          builder: (context, state) => const DashboardPage(),
        ),

        // Profile (standalone page, no bottom nav)
        GoRoute(
          path: '/profile',
          builder: (context, state) => Scaffold(
            backgroundColor: GameTheme.background,
            appBar: AppBar(
              title: const Text('Profile'),
              backgroundColor: GameTheme.background,
              foregroundColor: GameTheme.textPrimary,
              elevation: 0,
            ),
            body: const ProfilePage(),
          ),
        ),

        // Competition view with 4-tab bottom nav (protected)
        GoRoute(
          path: '/competition/:id',
          builder: (context, state) {
            final competitionId = state.pathParameters['id']!;
            final competition = state.extra;
            return CompetitionNavigationPage(
              competitionId: competitionId,
              competition: competition,
            );
          },
        ),

        // Deep link: /game/:id - same as /competition/:id (matches web URL structure)
        GoRoute(
          path: '/game/:id',
          builder: (context, state) {
            final competitionId = state.pathParameters['id']!;
            return CompetitionNavigationPage(
              competitionId: competitionId,
              competition: null,
            );
          },
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
