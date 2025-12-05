import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:lmslocal_flutter/core/theme/game_theme.dart';
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

  const CompetitionNavigationPage({
    super.key,
    required this.competitionId,
    this.competition,
  });

  @override
  State<CompetitionNavigationPage> createState() =>
      _CompetitionNavigationPageState();
}

class _CompetitionNavigationPageState extends State<CompetitionNavigationPage> {
  int _currentIndex = 0;

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
        backgroundColor: GameTheme.background,
        appBar: AppBar(
          backgroundColor: GameTheme.background,
          elevation: 0,
          toolbarHeight: 0,
          systemOverlayStyle: const SystemUiOverlayStyle(
            statusBarColor: Colors.transparent,
            statusBarIconBrightness: Brightness.light,
            statusBarBrightness: Brightness.dark,
            systemNavigationBarColor: Colors.transparent,
            systemNavigationBarIconBrightness: Brightness.light,
          ),
        ),
        body: _getPage(_currentIndex),
        bottomNavigationBar: _buildNavBar(),
        ),
      ),
    );
  }

  Widget _buildNavBar() {
    // Order: Home | Game | Play | Standings | Profile
    return Container(
      decoration: BoxDecoration(
        color: GameTheme.cardBackground,
        border: Border(
          top: BorderSide(
            color: GameTheme.border,
            width: 1,
          ),
        ),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Row(
            children: [
              // Home - navigates to main dashboard
              Expanded(
                child: _buildNavItem(
                  icon: Icons.home_outlined,
                  label: 'Home',
                  isActive: false,
                  onTap: () => context.go('/dashboard'),
                ),
              ),
              // Game
              Expanded(
                child: _buildNavItem(
                  icon: _currentIndex == 0 ? Icons.dashboard : Icons.dashboard_outlined,
                  label: 'Game',
                  isActive: _currentIndex == 0,
                  onTap: () => setState(() => _currentIndex = 0),
                ),
              ),
              // Play
              Expanded(
                child: _buildNavItem(
                  icon: _currentIndex == 1 ? Icons.sports_soccer : Icons.sports_soccer_outlined,
                  label: 'Play',
                  isActive: _currentIndex == 1,
                  onTap: () => setState(() => _currentIndex = 1),
                ),
              ),
              // Standings
              Expanded(
                child: _buildNavItem(
                  icon: _currentIndex == 2 ? Icons.leaderboard : Icons.leaderboard_outlined,
                  label: 'Standings',
                  isActive: _currentIndex == 2,
                  onTap: () => setState(() => _currentIndex = 2),
                ),
              ),
              // Profile
              Expanded(
                child: _buildNavItem(
                  icon: _currentIndex == 3 ? Icons.person : Icons.person_outline,
                  label: 'Profile',
                  isActive: _currentIndex == 3,
                  onTap: () => setState(() => _currentIndex = 3),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem({
    required IconData icon,
    required String label,
    required bool isActive,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            size: 26,
            color: isActive ? GameTheme.accentGreen : GameTheme.textMuted,
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
              color: isActive ? GameTheme.accentGreen : GameTheme.textMuted,
            ),
          ),
        ],
      ),
    );
  }
}
