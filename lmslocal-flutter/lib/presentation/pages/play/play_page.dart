import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:lmslocal_flutter/core/theme/game_theme.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/api_client.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/competition_remote_data_source.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/dashboard_remote_data_source.dart';
import 'package:lmslocal_flutter/presentation/pages/play/pick_page.dart';
import 'package:lmslocal_flutter/presentation/pages/play/player_results_page.dart';
import 'package:lmslocal_flutter/presentation/pages/play/waiting_page.dart';

/// Play page - Smart router that determines which screen to show
/// Based on round status, player status, and fixture availability
class PlayPage extends StatefulWidget {
  final String competitionId;

  const PlayPage({
    super.key,
    required this.competitionId,
  });

  @override
  State<PlayPage> createState() => _PlayPageState();
}

class _PlayPageState extends State<PlayPage> {
  late CompetitionRemoteDataSource _competitionDataSource;
  late DashboardRemoteDataSource _dashboardDataSource;

  bool _isLoading = true;
  String? _error;
  Widget? _destinationPage;

  @override
  void initState() {
    super.initState();
    _initializeAndRoute();
  }

  Future<void> _initializeAndRoute() async {
    final apiClient = context.read<ApiClient>();
    final prefs = await SharedPreferences.getInstance();

    _competitionDataSource = CompetitionRemoteDataSource(
      apiClient: apiClient,
      prefs: prefs,
    );
    _dashboardDataSource = DashboardRemoteDataSource(
      apiClient: apiClient,
      prefs: prefs,
    );

    await _determineDestination();
  }

  Future<void> _determineDestination() async {
    try {
      // Step 1: Get competition data
      final dashboardData = await _dashboardDataSource.getUserDashboard();
      final competition = dashboardData.competitions.firstWhere(
        (c) => c.id.toString() == widget.competitionId,
        orElse: () => throw Exception('Competition not found'),
      );

      // Step 2: Get rounds
      final rounds = await _competitionDataSource.getRounds(
        competitionId: competition.id,
      );

      // Step 3: Check if no rounds exist
      if (rounds.isEmpty) {
        _setDestination(
          WaitingPage(competitionId: widget.competitionId),
        );
        return;
      }

      // Step 4: Check if latest round has fixtures
      final latestRound = rounds.first; // Most recent round (rounds are in descending order)
      if (latestRound.fixtureCount == 0) {
        _setDestination(
          WaitingPage(competitionId: widget.competitionId),
        );
        return;
      }

      // Step 5: Check player status (eliminated players can't pick)
      final isEliminated = competition.userStatus?.toLowerCase() != 'active';
      if (competition.isParticipant && isEliminated) {
        // Eliminated participant - show results (read-only)
        _setDestination(
          PlayerResultsPage(
            competitionId: widget.competitionId,
            competition: competition,
            round: latestRound,
          ),
        );
        return;
      }

      // Step 6: Check if round is locked (for active players & organizers)
      if (latestRound.isLocked) {
        // Round is locked - show results
        _setDestination(
          PlayerResultsPage(
            competitionId: widget.competitionId,
            competition: competition,
            round: latestRound,
          ),
        );
      } else {
        // Round is not locked - show pick screen
        _setDestination(
          PickPage(
            competitionId: widget.competitionId,
            competition: competition,
            round: latestRound,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _error = e.toString();
        });
      }
    }
  }

  void _setDestination(Widget page) {
    if (mounted) {
      setState(() {
        _destinationPage = page;
        _isLoading = false;
        _error = null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Container(
        color: GameTheme.background,
        child: Center(
          child: CircularProgressIndicator(color: GameTheme.glowCyan),
        ),
      );
    }

    if (_error != null) {
      return Container(
        color: GameTheme.background,
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline, size: 64, color: GameTheme.textMuted),
              const SizedBox(height: 16),
              Text(
                'Failed to load',
                style: TextStyle(fontSize: 18, color: GameTheme.textPrimary),
              ),
              const SizedBox(height: 8),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 32),
                child: Text(
                  _error!,
                  style: TextStyle(fontSize: 14, color: GameTheme.textMuted),
                  textAlign: TextAlign.center,
                ),
              ),
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: () {
                  setState(() {
                    _isLoading = true;
                    _error = null;
                  });
                  _determineDestination();
                },
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: GameTheme.glowCyan,
                  foregroundColor: GameTheme.background,
                ),
              ),
            ],
          ),
        ),
      );
    }

    // Show the determined destination page
    return _destinationPage ?? const SizedBox();
  }
}
