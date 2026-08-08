import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:lmslocal_flutter/core/theme/coupon_theme.dart';
import 'package:lmslocal_flutter/presentation/widgets/app_nav_bar.dart';
import 'package:lmslocal_flutter/domain/entities/competition.dart';
import 'package:lmslocal_flutter/presentation/bloc/auth/auth_bloc.dart';
import 'package:lmslocal_flutter/presentation/bloc/auth/auth_state.dart';
import 'package:lmslocal_flutter/presentation/pages/competition/competition_home_page.dart';
import 'package:lmslocal_flutter/presentation/pages/play/play_page.dart';
import 'package:lmslocal_flutter/presentation/pages/profile/profile_page.dart';
import 'package:lmslocal_flutter/presentation/pages/standings/standings_page.dart';

/// Competition navigation page with 4-tab bottom navigation
/// Shows Home, Play, Standings, and Profile tabs within a competition context
class CompetitionNavigationPage extends StatefulWidget {
  final String competitionId;
  final Object? competition;

  /// Which tab to open on. The dashboard's "Make pick" sends players straight
  /// to Play (1) — landing them on Game and making them find the tab is the
  /// action changing its name halfway through the flow.
  final int initialTab;

  const CompetitionNavigationPage({
    super.key,
    required this.competitionId,
    this.competition,
    this.initialTab = 0,
  });

  @override
  State<CompetitionNavigationPage> createState() =>
      _CompetitionNavigationPageState();
}

class _CompetitionNavigationPageState extends State<CompetitionNavigationPage> {
  late int _currentIndex = widget.initialTab;

  // Cache built pages to preserve state when switching tabs
  final Map<int, Widget> _builtPages = {};

  Widget _getPage(int index) {
    // Return cached page if already built
    if (_builtPages.containsKey(index)) {
      return _builtPages[index]!;
    }

    // Extract playerDisplayName from competition if available
    final competition = widget.competition as Competition?;
    final playerDisplayName = competition?.playerDisplayName;

    // Build and cache the page
    final Widget page;
    switch (index) {
      case 0:
        page = CompetitionHomePage(
          competitionId: widget.competitionId,
          initialCompetition: widget.competition,
        );
        break;
      case 1:
        page = PlayPage(competitionId: widget.competitionId);
        break;
      case 2:
        page = StandingsPage(
          competitionId: widget.competitionId,
          playerDisplayName: playerDisplayName,
        );
        break;
      case 3:
        page = const ProfilePage();
        break;
      default:
        page = const SizedBox.shrink();
    }

    _builtPages[index] = page;
    return page;
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<AuthBloc, AuthState>(
      listener: (context, state) {
        // Navigate to login when logged out
        if (state is AuthUnauthenticated) {
          context.go('/login');
        }
      },
      child: PopScope(
        canPop: false,
        onPopInvokedWithResult: (didPop, result) {
          if (!didPop) {
            if (_currentIndex == 0) {
              // On Game tab: go to main dashboard
              context.go('/dashboard');
            } else {
              // On other tabs: go back to Game tab
              setState(() => _currentIndex = 0);
            }
          }
        },
        child: Scaffold(
        backgroundColor: CouponTheme.stock,
        appBar: AppBar(
          backgroundColor: CouponTheme.stock,
          elevation: 0,
          toolbarHeight: 0,
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
        body: _getPage(_currentIndex),
        bottomNavigationBar: _buildNavBar(),
        ),
      ),
    );
  }

  Widget _buildNavBar() {
    return AppNavBar(
      items: [
        AppNavItem(
          icon: Icons.home_outlined,
          activeIcon: Icons.home,
          label: 'Home',
          isActive: false,
          onTap: () => context.go('/dashboard'),
        ),
        AppNavItem(
          icon: Icons.dashboard_outlined,
          activeIcon: Icons.dashboard,
          label: 'Game',
          isActive: _currentIndex == 0,
          onTap: () => setState(() => _currentIndex = 0),
        ),
        AppNavItem(
          icon: Icons.sports_soccer_outlined,
          activeIcon: Icons.sports_soccer,
          label: 'Play',
          isActive: _currentIndex == 1,
          onTap: () => setState(() => _currentIndex = 1),
        ),
        AppNavItem(
          icon: Icons.leaderboard_outlined,
          activeIcon: Icons.leaderboard,
          label: 'Standings',
          isActive: _currentIndex == 2,
          onTap: () => setState(() => _currentIndex = 2),
        ),
        AppNavItem(
          icon: Icons.person_outline,
          activeIcon: Icons.person,
          label: 'Profile',
          isActive: _currentIndex == 3,
          onTap: () => setState(() => _currentIndex = 3),
        ),
      ],
    );
  }
}
