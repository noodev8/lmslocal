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

  /// Whether the shell opened straight onto Play, and the player has not chosen
  /// a tab since.
  ///
  /// This is the whole of "where did they come from". The main dashboard's "Make
  /// pick" opens `/competition/:id?tab=play`, so it arrives with `initialTab: 1`;
  /// entering from the competition dashboard arrives on tab 0 and switches
  /// inward. Nothing needs tracking — the two entries already differ at the door.
  ///
  /// Cleared by any deliberate tab tap, because from that point the player has
  /// seen the competition dashboard and it is a sensible place to come back to.
  late bool _arrivedOnPlay = widget.initialTab == 1;

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
          // Through _selectTab, not a bare index set: reaching Play from the
          // competition dashboard is as deliberate as tapping the tab, and back
          // must then return there rather than to the main dashboard.
          onGoToPlay: () => _selectTab(1),
        );
        break;
      case 1:
        page = PlayPage(
          competitionId: widget.competitionId,
          onBack: _leavePlay,
        );
        break;
      case 2:
        page = StandingsPage(
          competitionId: widget.competitionId,
          playerDisplayName: playerDisplayName,
          // Always the competition dashboard: Standings is only reachable from
          // inside the shell, so there is no outside origin to return to.
          onBack: () => _selectTab(0),
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

  /// Where "back" goes from the Play tab.
  ///
  /// Drives both the arrow on the Play screens and the Android back button, so
  /// the two cannot disagree. The hardware button used to send every non-zero
  /// tab to tab 0 unconditionally, which dropped a player who came from the main
  /// dashboard onto a competition dashboard they had never seen.
  void _leavePlay() {
    if (_arrivedOnPlay) {
      context.go('/dashboard');
    } else {
      setState(() => _currentIndex = 0);
    }
  }

  /// A tab tap is a deliberate choice, so the shell stops treating the player as
  /// a visitor who came for one screen.
  void _selectTab(int index) {
    setState(() {
      _currentIndex = index;
      _arrivedOnPlay = false;
    });
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
              // On the competition's Dashboard tab: go to the app's home
              context.go('/dashboard');
            } else if (_currentIndex == 1) {
              // Play: the same decision the arrow makes.
              _leavePlay();
            } else {
              // On other tabs: go back to the Dashboard tab
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
          // "Dashboard", not "Game": the tab is a competition's overview, and
          // "Game" beside "Play" read as two names for the same thing.
          label: 'Dashboard',
          isActive: _currentIndex == 0,
          onTap: () => _selectTab(0),
        ),
        AppNavItem(
          icon: Icons.sports_soccer_outlined,
          activeIcon: Icons.sports_soccer,
          label: 'Play',
          isActive: _currentIndex == 1,
          onTap: () => _selectTab(1),
        ),
        AppNavItem(
          icon: Icons.leaderboard_outlined,
          activeIcon: Icons.leaderboard,
          label: 'Standings',
          isActive: _currentIndex == 2,
          onTap: () => _selectTab(2),
        ),
        AppNavItem(
          icon: Icons.person_outline,
          activeIcon: Icons.person,
          label: 'Profile',
          isActive: _currentIndex == 3,
          onTap: () => _selectTab(3),
        ),
      ],
    );
  }
}
