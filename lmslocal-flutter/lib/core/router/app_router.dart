import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';
import 'package:lmslocal_flutter/presentation/pages/auth/forgot_password_page.dart';
import 'package:lmslocal_flutter/presentation/pages/auth/login_page.dart';
import 'package:lmslocal_flutter/presentation/pages/auth/register_page.dart';
import 'package:lmslocal_flutter/presentation/pages/competition/competition_navigation_page.dart';
import 'package:lmslocal_flutter/presentation/pages/home/home_shell_page.dart';
import 'package:lmslocal_flutter/presentation/pages/join/join_page.dart';
import 'package:lmslocal_flutter/presentation/pages/splash/splash_page.dart';

/// App router configuration using GoRouter
class AppRouter {
  static GoRouter? _instance;

  /// Access the router instance (e.g. for navigating from outside the widget tree)
  static GoRouter get router => _instance!;

  static GoRouter createRouter() {
    _instance = GoRouter(
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

        // Home (protected): your competitions and your profile, two tabs under
        // the shared bottom bar. There is deliberately no '/profile' route —
        // Profile is a destination in this shell and in the competition one,
        // never a page pushed over the top. See HomeShellPage for why.
        GoRoute(
          path: '/dashboard',
          builder: (context, state) => const HomeShellPage(),
        ),

        // Competition view with 4-tab bottom nav (protected)
        GoRoute(
          path: '/competition/:id',
          builder: (context, state) {
            final competitionId = state.pathParameters['id']!;
            final competition = state.extra;
            // ?tab=play lets the dashboard's "Make pick" open the Play tab
            // directly, so the action keeps its name through the whole flow.
            return CompetitionNavigationPage(
              competitionId: competitionId,
              competition: competition,
              initialTab: state.uri.queryParameters['tab'] == 'play' ? 1 : 0,
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

        // Deep link: /join/:code - the invite link an organiser shares. Claimed by the
        // app only because Universal Links cannot install anything, so reaching here
        // means the player already has LMS Local and is being sent a second competition.
        // Anyone without the app gets the web join page, which is the intended path for
        // a genuinely new player. See §5.3 of docs/player-onboarding.md.
        GoRoute(
          path: '/join/:code',
          builder: (context, state) {
            final code = state.pathParameters['code']!;
            // Keyed on the code so a second join link tears the screen down and
            // rebuilds it. Without this, Flutter reuses the existing State — same
            // widget type, same position — so initState never re-runs and the card
            // keeps showing the previous competition beside the new code. Being
            // shown one competition and joining another is the exact failure that
            // looking the code up before offering the button exists to prevent.
            return JoinPage(key: ValueKey(code), code: code);
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
    return _instance!;
  }
}
