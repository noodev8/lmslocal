import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:lmslocal_flutter/core/constants/app_constants.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/api_client.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/competition_remote_data_source.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/dashboard_remote_data_source.dart';
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
  Competition? _competition;
  CompetitionRemoteDataSource? _competitionDataSource;
  bool _isHiding = false;

  late final List<Widget> _pages;

  @override
  void initState() {
    super.initState();

    // Extract competition if provided
    if (widget.competition != null && widget.competition is Competition) {
      _competition = widget.competition as Competition;
    }

    _pages = [
      CompetitionHomePage(
        competitionId: widget.competitionId,
        initialCompetition: widget.competition,
      ),
      PlayPage(competitionId: widget.competitionId),
      StandingsPage(competitionId: widget.competitionId),
      const ProfilePage(),
    ];

    _initializeDataSource();
  }

  Future<void> _initializeDataSource() async {
    final apiClient = context.read<ApiClient>();
    final prefs = await SharedPreferences.getInstance();

    _competitionDataSource = CompetitionRemoteDataSource(
      apiClient: apiClient,
      prefs: prefs,
    );

    // If we don't have competition data yet, try to fetch it
    if (_competition == null) {
      await _loadCompetitionData();
    }
  }

  Future<void> _loadCompetitionData() async {
    try {
      final apiClient = context.read<ApiClient>();
      final prefs = await SharedPreferences.getInstance();
      final dashboardDataSource = DashboardRemoteDataSource(
        apiClient: apiClient,
        prefs: prefs,
      );

      final competitions = await dashboardDataSource.getUserDashboard();
      final competition = competitions.firstWhere(
        (c) => c.id.toString() == widget.competitionId,
        orElse: () => throw Exception('Competition not found'),
      );

      if (mounted) {
        setState(() {
          _competition = competition;
        });
      }
    } catch (e) {
      // Silently fail - we'll just not show the menu if we can't get competition data
    }
  }

  String _getPageTitle() {
    switch (_currentIndex) {
      case 0:
        return 'Competition';
      case 1:
        return 'Play';
      case 2:
        return 'Standings';
      case 3:
        return 'Profile';
      default:
        return 'Competition';
    }
  }

  /// Show confirmation dialog before hiding competition
  Future<void> _showHideConfirmationDialog() async {
    final competition = _competition;
    if (competition == null) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Hide Competition'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Hide "${competition.name}" from your dashboard?',
              style: const TextStyle(fontSize: 16),
            ),
            const SizedBox(height: 12),
            const Text(
              'This will remove it from your view.',
              style: TextStyle(fontSize: 14, color: Colors.grey),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            style: TextButton.styleFrom(
              foregroundColor: Colors.red,
            ),
            child: const Text('Hide'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await _hideCompetition();
    }
  }

  /// Hide the competition from dashboard
  Future<void> _hideCompetition() async {
    if (_competitionDataSource == null || _competition == null) return;

    // Capture context-dependent values before async operations
    final apiClient = context.read<ApiClient>();
    final competitionName = _competition!.name;

    setState(() {
      _isHiding = true;
    });

    try {
      await _competitionDataSource!.hideCompetition(
        competitionId: _competition!.id,
      );

      // Clear dashboard cache so it refreshes when we navigate back
      final prefs = await SharedPreferences.getInstance();
      final dashboardDataSource = DashboardRemoteDataSource(
        apiClient: apiClient,
        prefs: prefs,
      );
      await dashboardDataSource.clearCache();

      if (mounted) {
        // Show success message
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('$competitionName removed from dashboard'),
            backgroundColor: AppConstants.successGreen,
          ),
        );

        // Navigate back to dashboard (will auto-refresh due to cleared cache)
        context.go('/dashboard');
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isHiding = false;
        });

        // Show error message
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to remove competition: ${e.toString()}'),
            backgroundColor: AppConstants.errorRed,
          ),
        );
      }
    }
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
      child: Scaffold(
        appBar: AppBar(
          title: Text(_getPageTitle()),
          backgroundColor: AppConstants.primaryNavy,
          foregroundColor: Colors.white,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () {
              // If on any tab other than Home, go back to Home tab
              if (_currentIndex != 0) {
                setState(() {
                  _currentIndex = 0;
                });
              } else {
                // If on Home tab, go back to dashboard
                context.go('/dashboard');
              }
            },
          ),
          actions: [
            // Only show menu for participants (not organisers)
            if (_competition != null &&
                _competition!.isParticipant &&
                !_competition!.isOrganiser)
              PopupMenuButton<String>(
                icon: const Icon(Icons.more_vert),
                enabled: !_isHiding,
                onSelected: (value) {
                  if (value == 'hide') {
                    _showHideConfirmationDialog();
                  }
                },
                itemBuilder: (context) => [
                  const PopupMenuItem(
                    value: 'hide',
                    child: Row(
                      children: [
                        Icon(Icons.visibility_off, size: 20),
                        SizedBox(width: 12),
                        Text('Hide from Dashboard'),
                      ],
                    ),
                  ),
                ],
              ),
          ],
        ),
        body: IndexedStack(
          index: _currentIndex,
          children: _pages,
        ),
        bottomNavigationBar: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: (index) {
            // If Home tab is tapped, navigate to main dashboard
            if (index == 0) {
              context.go('/dashboard');
            } else {
              setState(() {
                _currentIndex = index;
              });
            }
          },
          type: BottomNavigationBarType.fixed,
          selectedItemColor: AppConstants.primaryNavy,
          unselectedItemColor: Colors.grey,
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.home_outlined),
              activeIcon: Icon(Icons.home),
              label: 'Home',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.sports_soccer_outlined),
              activeIcon: Icon(Icons.sports_soccer),
              label: 'Play',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.leaderboard_outlined),
              activeIcon: Icon(Icons.leaderboard),
              label: 'Standings',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.person_outline),
              activeIcon: Icon(Icons.person),
              label: 'Profile',
            ),
          ],
        ),
      ),
    );
  }
}
