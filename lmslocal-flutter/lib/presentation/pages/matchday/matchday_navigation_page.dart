import 'package:material_ui/material_ui.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:lmslocal_flutter/core/theme/coupon_theme.dart';
import 'package:lmslocal_flutter/domain/entities/competition.dart';
import 'package:lmslocal_flutter/presentation/bloc/auth/auth_bloc.dart';
import 'package:lmslocal_flutter/presentation/bloc/auth/auth_state.dart';
import 'package:lmslocal_flutter/presentation/pages/matchday/matchday_home_page.dart';
import 'package:lmslocal_flutter/presentation/pages/matchday/matchday_predictions_page.dart';
import 'package:lmslocal_flutter/presentation/pages/matchday/matchday_table_page.dart';
import 'package:lmslocal_flutter/presentation/pages/profile/profile_page.dart';
import 'package:lmslocal_flutter/presentation/widgets/app_nav_bar.dart';

/// A Matchday competition's shell: the same bottom bar as Last Man Standing's
/// (`CompetitionNavigationPage`), serving Matchday's own screens
/// (docs/matchday-app.md §3). Dashboard is the Matchday home, Play the
/// predictions, and the board is "Table" - Matchday's word, since the two
/// games never share vocabulary (§13).
///
/// The LMS shell is left exactly as it was; `CompetitionEntryPage` decides
/// which shell a competition gets, once, at the door.
class MatchdayNavigationPage extends StatefulWidget {
  const MatchdayNavigationPage({
    super.key,
    required this.competition,
    this.initialTab = 0,
  });

  final Competition competition;

  /// 1 opens straight onto Play - the dashboard card's "Make your
  /// predictions", the same `?tab=play` the LMS card uses for its pick.
  final int initialTab;

  @override
  State<MatchdayNavigationPage> createState() => _MatchdayNavigationPageState();
}

class _MatchdayNavigationPageState extends State<MatchdayNavigationPage> {
  late int _currentIndex = widget.initialTab;

  /// Arrived on Play from the main dashboard, and has not chosen a tab since:
  /// back then returns to the dashboard rather than to a competition home the
  /// player has never seen - the LMS shell's rule.
  late bool _arrivedOnPlay = widget.initialTab == 1;

  /// Bumped on every tab change so a tab is rebuilt, and reloads, when it is
  /// opened. Matchday's screens are never cached: the home's "7/10 predicted"
  /// must be the count the player just left the Play tab with.
  int _visit = 0;

  void _selectTab(int index) {
    setState(() {
      _currentIndex = index;
      _arrivedOnPlay = false;
      _visit++;
    });
  }

  void _leavePlay() {
    if (_arrivedOnPlay) {
      context.go('/dashboard');
    } else {
      _selectTab(0);
    }
  }

  Widget _page() {
    final key = ValueKey('$_currentIndex-$_visit');
    switch (_currentIndex) {
      case 0:
        return MatchdayHomePage(
          key: key,
          competition: widget.competition,
          onGoToPredictions: () => _selectTab(1),
          onGoToTable: () => _selectTab(2),
        );
      case 1:
        return MatchdayPredictionsPage(key: key, competition: widget.competition, onBack: _leavePlay);
      case 2:
        return MatchdayTablePage(key: key, competition: widget.competition, onBack: () => _selectTab(0));
      default:
        return const ProfilePage();
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<AuthBloc, AuthState>(
      listener: (context, state) {
        if (state is AuthUnauthenticated) context.go('/login');
      },
      child: PopScope(
        canPop: false,
        onPopInvokedWithResult: (didPop, result) {
          if (didPop) return;
          if (_currentIndex == 0) {
            context.go('/dashboard');
          } else if (_currentIndex == 1) {
            _leavePlay();
          } else {
            _selectTab(0);
          }
        },
        child: Scaffold(
          backgroundColor: CouponTheme.stock,
          appBar: AppBar(
            backgroundColor: CouponTheme.stock,
            elevation: 0,
            toolbarHeight: 0,
            systemOverlayStyle: const SystemUiOverlayStyle(
              statusBarColor: Colors.transparent,
              statusBarIconBrightness: Brightness.dark,
              statusBarBrightness: Brightness.light,
              systemNavigationBarColor: CouponTheme.stockLit,
              systemNavigationBarIconBrightness: Brightness.dark,
            ),
          ),
          body: _page(),
          bottomNavigationBar: AppNavBar(
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
                label: 'Table',
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
          ),
        ),
      ),
    );
  }
}
