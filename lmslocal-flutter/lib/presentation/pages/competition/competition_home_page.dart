import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:lmslocal_flutter/core/constants/app_constants.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/api_client.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/competition_remote_data_source.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/dashboard_remote_data_source.dart';
import 'package:lmslocal_flutter/domain/entities/competition.dart';
import 'package:lmslocal_flutter/domain/entities/pick_statistics.dart';
import 'package:lmslocal_flutter/domain/entities/round_info.dart';
import 'package:lmslocal_flutter/domain/entities/round_statistics.dart';
import 'package:lmslocal_flutter/core/theme/game_theme.dart';
import 'package:lmslocal_flutter/presentation/pages/competition/widgets/glowing_players_circle.dart';
import 'package:lmslocal_flutter/presentation/pages/competition/widgets/dark_status_cards.dart';
import 'package:lmslocal_flutter/presentation/pages/competition/widgets/pick_status_card.dart';
import 'package:lmslocal_flutter/presentation/pages/competition/widgets/round_results_card.dart';
import 'package:lmslocal_flutter/presentation/pages/competition/widgets/invite_section.dart';
import 'package:lmslocal_flutter/presentation/pages/competition/widgets/complete_banner.dart';
import 'package:lmslocal_flutter/presentation/pages/competition/widgets/unpicked_players_sheet.dart';

/// Competition home page - Overview of a specific competition
/// Shows competition details, current round, picks, etc.
class CompetitionHomePage extends StatefulWidget {
  final String competitionId;
  final Object? initialCompetition;

  const CompetitionHomePage({
    super.key,
    required this.competitionId,
    this.initialCompetition,
  });

  @override
  State<CompetitionHomePage> createState() => _CompetitionHomePageState();
}

class _CompetitionHomePageState extends State<CompetitionHomePage> {
  late CompetitionRemoteDataSource _competitionDataSource;
  late DashboardRemoteDataSource _dashboardDataSource;

  Competition? _competition;
  RoundInfo? _currentRound;
  PickStatistics? _pickStats;
  RoundStatistics? _roundStats;

  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    // Use initial competition if provided (from dashboard navigation)
    if (widget.initialCompetition != null &&
        widget.initialCompetition is Competition) {
      _competition = widget.initialCompetition as Competition;
      _isLoading = false; // We have basic data, don't show spinner
    }
    _initializeData();
  }

  Future<void> _initializeData() async {
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

    await _loadCompetitionData();
  }

  Future<void> _loadCompetitionData({bool forceRefresh = false}) async {
    if (!forceRefresh) {
      // Only show loading if we don't already have competition data
      if (_competition == null) {
        setState(() {
          _isLoading = true;
          _error = null;
        });
      }
    }

    try {
      // Get competition data (either reload or use existing)
      Competition competition;
      if (_competition != null && !forceRefresh) {
        // Use existing competition data
        competition = _competition!;
      } else {
        // Load from cache/API
        final competitions = await _dashboardDataSource.getUserDashboard(
          forceRefresh: forceRefresh,
        );

        competition = competitions.firstWhere(
          (c) => c.id.toString() == widget.competitionId,
          orElse: () => throw Exception('Competition not found'),
        );
      }

      final rounds = await _competitionDataSource.getRounds(
        competitionId: competition.id,
        forceRefresh: forceRefresh,
      );

      RoundInfo? currentRound;
      PickStatistics? pickStats;
      RoundStatistics? roundStats;

      if (rounds.isNotEmpty) {
        currentRound = rounds.first;

        if (!currentRound.isLocked) {
          try {
            pickStats = await _competitionDataSource.getPickStatistics(
              competitionId: competition.id,
              roundNumber: currentRound.roundNumber,
              forceRefresh: forceRefresh,
            );
          } catch (e) {
            // Ignore error for pick stats
          }
        } else {
          try {
            roundStats = await _competitionDataSource.getRoundStatistics(
              competitionId: competition.id,
              roundNumber: currentRound.roundNumber,
              forceRefresh: forceRefresh,
            );
          } catch (e) {
            // Ignore error for round stats
          }
        }
      }

      if (mounted) {
        setState(() {
          _competition = competition;
          _currentRound = currentRound;
          _pickStats = pickStats;
          _roundStats = roundStats;
          _isLoading = false;
          _error = null;
        });
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

  Future<void> _onRefresh() async {
    await _loadCompetitionData(forceRefresh: true);
  }

  Future<void> _showUnpickedPlayersModal(RoundInfo round) async {
    if (_competition == null) return;

    // Show loading dialog
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => const Center(
        child: CircularProgressIndicator(color: Colors.white),
      ),
    );

    try {
      final unpickedPlayers = await _competitionDataSource.getUnpickedPlayers(
        competitionId: _competition!.id,
      );

      // Close loading dialog
      if (mounted) Navigator.of(context).pop();

      // Show unpicked players modal
      if (mounted) {
        final pickPercentage = _pickStats != null
            ? (_pickStats!.playersWithPicks / _pickStats!.totalActivePlayers * 100).round()
            : null;
        showModalBottomSheet(
          context: context,
          isScrollControlled: true,
          backgroundColor: Colors.transparent,
          builder: (context) => UnpickedPlayersSheet(
            round: round,
            unpickedPlayers: unpickedPlayers,
            pickPercentage: pickPercentage,
          ),
        );
      }
    } catch (e) {
      // Close loading dialog
      if (mounted) Navigator.of(context).pop();

      // Show error
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to load unpicked players: ${e.toString()}'),
            backgroundColor: AppConstants.errorRed,
          ),
        );
      }
    }
  }

  void _copyToClipboard(String text, String label) {
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('$label copied to clipboard'),
        backgroundColor: AppConstants.successGreen,
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null || _competition == null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 64, color: Colors.grey[400]),
            const SizedBox(height: 16),
            Text(
              'Failed to load competition',
              style: TextStyle(fontSize: 18, color: Colors.grey[700]),
            ),
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32),
              child: Text(
                _error ?? 'Competition not found',
                style: TextStyle(fontSize: 14, color: Colors.grey[600]),
                textAlign: TextAlign.center,
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: () => _loadCompetitionData(forceRefresh: true),
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppConstants.primaryNavy,
                foregroundColor: Colors.white,
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _onRefresh,
      color: GameTheme.glowCyan,
      child: Container(
        color: GameTheme.background, // Dark game theme background
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: Column(
            children: [
              // Hero Header with navy background
              _buildHeroHeader(_competition!),

              // Main Content with cards
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
                child: Column(
                  children: [
                    // Current Round Card (if not complete)
                    if (_competition!.status != 'COMPLETE' &&
                        _currentRound != null)
                      _buildCurrentRoundCard(_currentRound!),

                    if (_competition!.status != 'COMPLETE' &&
                        _currentRound != null)
                      const SizedBox(height: 12),

                    // Personal Status Cards (participants only)
                    if (_competition!.isParticipant) ...[
                      _buildPersonalStatusCards(_competition!),
                      const SizedBox(height: 16),
                    ],

                    // Round Status Section
                    if (_currentRound != null &&
                        _competition!.status != 'COMPLETE')
                      _buildRoundStatusSection(_currentRound!),

                    if (_currentRound != null &&
                        _competition!.status != 'COMPLETE')
                      const SizedBox(height: 16),

                    // Invite Section (organizers only, during setup)
                    if (_competition!.isOrganiser &&
                        _competition!.status == 'SETUP') ...[
                      InviteSection(
                        competition: _competition!,
                        onCopyToClipboard: _copyToClipboard,
                      ),
                      const SizedBox(height: 16),
                    ],

                    // Competition Complete Banner
                    if (_competition!.status == 'COMPLETE')
                      CompleteBanner(competition: _competition!),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeroHeader(Competition competition) {
    return Container(
      width: double.infinity,
      color: GameTheme.background,
      child: SafeArea(
        bottom: false,
        left: false,
        right: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(8, 8, 8, 8),
          child: Row(
            children: [
              // Back arrow
              IconButton(
                icon: Icon(
                  Icons.arrow_back,
                  color: GameTheme.textPrimary,
                ),
                onPressed: () => context.go('/dashboard'),
              ),
              const Spacer(),
              // Small Logo
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: GameTheme.cardBackground,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: GameTheme.border,
                    width: 1,
                  ),
                ),
                clipBehavior: Clip.antiAlias,
                child: competition.logoUrl != null
                    ? Image.network(
                        competition.logoUrl!,
                        fit: BoxFit.cover,
                        errorBuilder: (context, error, stackTrace) {
                          return Icon(
                            Icons.sports_soccer,
                            size: 20,
                            color: GameTheme.glowCyan,
                          );
                        },
                      )
                    : Icon(
                        Icons.sports_soccer,
                        size: 20,
                        color: GameTheme.glowCyan,
                      ),
              ),
              const SizedBox(width: 12),

              // Competition Name
              Text(
                competition.name,
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: GameTheme.textPrimary,
                ),
              ),
              const Spacer(),
              // Empty space to balance back arrow
              const SizedBox(width: 48),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCurrentRoundCard(RoundInfo round) {
    // Use fresh pick statistics total when available - it's the accurate count from DB
    final activeCount = _pickStats?.totalActivePlayers ??
                       round.activePlayers ??
                       _competition!.playerCount;

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: GameTheme.background,
        borderRadius: BorderRadius.circular(16),
      ),
      child: GlowingPlayersCircle(
        playerCount: activeCount,
      ),
    );
  }

  Widget _buildPersonalStatusCards(Competition competition) {
    final isIn = competition.userStatus?.toLowerCase() == 'active';
    final lives = competition.livesRemaining ?? 0;

    return DarkStatusCards(
      isStillIn: isIn,
      livesRemaining: lives,
    );
  }

  Widget _buildRoundStatusSection(RoundInfo round) {
    if (!round.isLocked && _pickStats != null) {
      return PickStatusCard(
        round: round,
        stats: _pickStats!,
        onTap: () => _showUnpickedPlayersModal(round),
      );
    } else if (round.isLocked && _roundStats != null) {
      return RoundResultsCard(
        round: round,
        stats: _roundStats!,
      );
    }
    return const SizedBox.shrink();
  }

}
