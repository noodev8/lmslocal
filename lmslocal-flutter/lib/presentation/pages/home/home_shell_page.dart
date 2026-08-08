import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:lmslocal_flutter/core/theme/coupon_theme.dart';
import 'package:lmslocal_flutter/presentation/bloc/auth/auth_bloc.dart';
import 'package:lmslocal_flutter/presentation/bloc/auth/auth_state.dart';
import 'package:lmslocal_flutter/presentation/pages/dashboard/dashboard_page.dart';
import 'package:lmslocal_flutter/presentation/pages/profile/profile_page.dart';
import 'package:lmslocal_flutter/presentation/widgets/app_nav_bar.dart';

/// The signed-in home: your competitions, and your profile.
///
/// A shell for the same reason [CompetitionNavigationPage] is one — so Profile
/// is a *destination* rather than a page pushed on top of the app.
///
/// It used to be pushed (`/profile`, wrapped in its own Scaffold and AppBar),
/// and that produced the two things this fixes:
///
/// 1. **The bottom bar vanished.** The pushed route carried no navigation of
///    its own, so opening your profile from Home took the app's navigation away
///    with it — the exact behaviour docs/flutter-migration.md §3 rejects.
/// 2. **The back arrow appeared and disappeared.** Profile is one screen, but
///    it was reached two ways: pushed from Home (so, a back arrow) and as a tab
///    inside a competition (so, none). Same screen, different chrome, depending
///    on a route the player cannot see.
///
/// One mechanism now: Profile is a tab in both shells and has a back arrow in
/// neither. Android's back button is handled below rather than by the stack.
class HomeShellPage extends StatefulWidget {
  const HomeShellPage({super.key});

  @override
  State<HomeShellPage> createState() => _HomeShellPageState();
}

class _HomeShellPageState extends State<HomeShellPage> {
  int _currentIndex = 0;

  /// Built once each and kept, so switching tabs does not refetch the dashboard
  /// or throw away a half-edited display name. Mirrors the competition shell.
  final Map<int, Widget> _builtPages = {};

  Widget _page(int index) {
    return _builtPages.putIfAbsent(
      index,
      () => index == 0 ? const DashboardPage() : const ProfilePage(),
    );
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<AuthBloc, AuthState>(
      // Logout is pressed on the Profile tab, and `body` mounts only the tab
      // you can see — so this has to live on the shell, which outlives both.
      // On the Dashboard tab it never heard the logout it was written for, and
      // the app sat on Profile's spinner instead of returning to login.
      listener: (context, state) {
        if (state is AuthUnauthenticated) {
          context.go('/login');
        }
      },
      child: PopScope(
      // Back off Profile returns to your competitions rather than leaving the
      // app — the same rule the competition shell follows for its own tabs.
      canPop: _currentIndex == 0,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop && _currentIndex != 0) {
          setState(() => _currentIndex = 0);
        }
      },
      child: Scaffold(
        backgroundColor: CouponTheme.stock,
        appBar: AppBar(
          // The masthead, not a page title: it stays put across both tabs
          // because it names the app, and Profile carries its own heading.
          title: Text('LMS Local', style: CouponTheme.heading(28)),
          backgroundColor: CouponTheme.stock,
          foregroundColor: CouponTheme.ink,
          automaticallyImplyLeading: false,
          elevation: 0,
          // Dark icons: the app is light now, and light-on-light is the classic
          // tell of a half-finished light-mode conversion.
          systemOverlayStyle: const SystemUiOverlayStyle(
            statusBarColor: Colors.transparent,
            statusBarIconBrightness: Brightness.dark,
            statusBarBrightness: Brightness.light,
            systemNavigationBarColor: CouponTheme.stockLit,
            systemNavigationBarIconBrightness: Brightness.dark,
          ),
        ),
        body: _page(_currentIndex),
        bottomNavigationBar: AppNavBar(
          items: [
            AppNavItem(
              icon: Icons.home_outlined,
              activeIcon: Icons.home,
              label: 'Home',
              isActive: _currentIndex == 0,
              onTap: () => setState(() => _currentIndex = 0),
            ),
            AppNavItem(
              icon: Icons.person_outline,
              activeIcon: Icons.person,
              label: 'Profile',
              isActive: _currentIndex == 1,
              onTap: () => setState(() => _currentIndex = 1),
            ),
          ],
        ),
      ),
      ),
    );
  }
}
