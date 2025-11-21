import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
import 'package:lmslocal_flutter/domain/entities/unpicked_player.dart';

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
        showModalBottomSheet(
          context: context,
          isScrollControlled: true,
          backgroundColor: Colors.transparent,
          builder: (context) => _buildUnpickedPlayersSheet(
            round,
            unpickedPlayers,
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

  Widget _buildUnpickedPlayersSheet(
    RoundInfo round,
    List<UnpickedPlayer> unpickedPlayers,
  ) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(20),
          topRight: Radius.circular(20),
        ),
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Round ${round.roundNumber} - Players',
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Content
              if (unpickedPlayers.isEmpty)
                _buildAllPickedContent()
              else if (unpickedPlayers.length <= 10)
                _buildPlayerListContent(unpickedPlayers)
              else
                _buildCountOnlyContent(unpickedPlayers),

              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAllPickedContent() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 32),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppConstants.successGreen.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: const Text(
              '🎉',
              style: TextStyle(fontSize: 48),
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'All players have picked!',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Everyone has made their selection',
            style: TextStyle(
              fontSize: 14,
              color: Colors.grey[600],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPlayerListContent(List<UnpickedPlayer> unpickedPlayers) {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxHeight: 400),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          RichText(
            text: TextSpan(
              style: TextStyle(fontSize: 14, color: Colors.grey[700]),
              children: [
                TextSpan(
                  text: '${unpickedPlayers.length} ${unpickedPlayers.length == 1 ? 'player has' : 'players have'}',
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    color: Colors.black87,
                  ),
                ),
                const TextSpan(text: ' not made their pick yet:'),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Flexible(
            child: ListView.separated(
              shrinkWrap: true,
              itemCount: unpickedPlayers.length,
              separatorBuilder: (context, index) => const SizedBox(height: 8),
              itemBuilder: (context, index) {
                final player = unpickedPlayers[index];
                return Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.grey[100],
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: const BoxDecoration(
                          color: Colors.orange,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          player.displayName,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCountOnlyContent(List<UnpickedPlayer> unpickedPlayers) {
    final percentage = _pickStats != null
        ? (_pickStats!.playersWithPicks / _pickStats!.totalActivePlayers * 100)
            .round()
        : 0;

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 32),
      child: Column(
        children: [
          Text(
            '${unpickedPlayers.length}',
            style: TextStyle(
              fontSize: 48,
              fontWeight: FontWeight.bold,
              color: AppConstants.primaryNavy,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'players have not made their pick yet',
            style: TextStyle(
              fontSize: 16,
              color: Colors.grey[700],
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          Text(
            '$percentage% complete',
            style: TextStyle(
              fontSize: 14,
              color: Colors.grey[600],
            ),
          ),
        ],
      ),
    );
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
      color: AppConstants.primaryNavy,
      child: Container(
        color: const Color(0xFFF5F7FA), // Match main dashboard background
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
                      _buildInviteSection(_competition!),
                      const SizedBox(height: 16),
                    ],

                    // Competition Complete Banner
                    if (_competition!.status == 'COMPLETE')
                      _buildCompleteBanner(_competition!),
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
      color: AppConstants.primaryNavy,
      child: SafeArea(
        bottom: false,
        left: false,
        right: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 28),
          child: Column(
            children: [
              // Logo
              Container(
                width: 90,
                height: 90,
                decoration: BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.2),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                clipBehavior: Clip.antiAlias,
                child: competition.logoUrl != null
                    ? Image.network(
                        competition.logoUrl!,
                        fit: BoxFit.cover,
                        errorBuilder: (context, error, stackTrace) {
                          return Container(
                            color: Colors.white,
                            child: Icon(
                              Icons.sports_soccer,
                              size: 45,
                              color: AppConstants.primaryNavy,
                            ),
                          );
                        },
                      )
                    : Icon(
                        Icons.sports_soccer,
                        size: 45,
                        color: AppConstants.primaryNavy,
                      ),
              ),
              const SizedBox(height: 16),

              // Competition Name
              Text(
                competition.name,
                style: const TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
                textAlign: TextAlign.center,
              ),
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
      padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          Text(
            'Round ${round.roundNumber}',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: AppConstants.primaryNavy,
              letterSpacing: 0.3,
            ),
          ),
          const SizedBox(height: 8),

          // Number with gradient
          Text(
            activeCount.toString(),
            style: TextStyle(
              fontSize: 72,
              fontWeight: FontWeight.w900,
              color: AppConstants.primaryNavy,
              height: 0.9,
              letterSpacing: -2,
            ),
          ),
          const SizedBox(height: 6),

          Text(
            'Players Active',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w500,
              color: Colors.grey[700],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPersonalStatusCards(Competition competition) {
    final isIn = competition.userStatus?.toLowerCase() == 'active';
    final lives = competition.livesRemaining ?? 0;

    // Determine knockout mode
    final bool isKnockout = isIn && lives == 0;

    return Row(
      children: [
        // Your Status
        Expanded(
          child: Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.06),
                  blurRadius: 10,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Column(
              children: [
                Icon(
                  isIn ? Icons.check_circle : Icons.cancel,
                  color: isIn ? AppConstants.successGreen : AppConstants.errorRed,
                  size: 32,
                ),
                const SizedBox(height: 8),
                Text(
                  isIn ? 'Still In' : 'Knocked Out',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: isIn ? AppConstants.successGreen : AppConstants.errorRed,
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(width: 12),

        // Lives Remaining (with knockout indicator)
        Expanded(
          child: Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.06),
                  blurRadius: 10,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      'Lives',
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.grey[600],
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (isKnockout) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.grey[300],
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          'KNOCKOUT',
                          style: TextStyle(
                            fontSize: 8,
                            fontWeight: FontWeight.bold,
                            color: Colors.grey[700],
                            letterSpacing: 0.5,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.favorite,
                      color: lives > 0 ? AppConstants.errorRed : Colors.grey[400],
                      size: 22,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      lives.toString(),
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        color: lives > 0 ? AppConstants.errorRed : Colors.grey[600],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildRoundStatusSection(RoundInfo round) {
    if (!round.isLocked && _pickStats != null) {
      return _buildPickStatusCard(round, _pickStats!);
    } else if (round.isLocked && _roundStats != null) {
      return _buildRoundResultsCard(round, _roundStats!);
    }
    return const SizedBox.shrink();
  }

  Widget _buildPickStatusCard(RoundInfo round, PickStatistics stats) {
    return InkWell(
      onTap: () => _showUnpickedPlayersModal(round),
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.06),
              blurRadius: 12,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFFD1F2EB),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  Icons.check_circle_outline,
                  color: const Color(0xFF00897B),
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Round ${round.roundNumber} Picks',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              Text(
                '${stats.pickPercentage.floor()}%',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF00897B),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Progress bar
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: LinearProgressIndicator(
              value: stats.pickPercentage / 100,
              minHeight: 10,
              backgroundColor: Colors.grey[200],
              valueColor: const AlwaysStoppedAnimation<Color>(
                Color(0xFF00897B),
              ),
            ),
          ),
          const SizedBox(height: 12),

          Text(
            '${stats.playersWithPicks} of ${stats.totalActivePlayers} players have picked',
            style: TextStyle(
              fontSize: 13,
              color: Colors.grey[600],
            ),
          ),
        ],
      ),
    ),
    );
  }

  Widget _buildRoundResultsCard(RoundInfo round, RoundStatistics stats) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 12,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppConstants.primaryNavy.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  Icons.bar_chart,
                  color: AppConstants.primaryNavy,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              Text(
                'Round ${round.roundNumber} Results',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Three-segment bar
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: Row(
              children: [
                if (stats.won > 0)
                  Expanded(
                    flex: stats.won,
                    child: Container(
                      height: 10,
                      color: AppConstants.successGreen,
                    ),
                  ),
                if (stats.lost > 0)
                  Expanded(
                    flex: stats.lost,
                    child: Container(
                      height: 10,
                      color: Colors.grey[400],
                    ),
                  ),
                if (stats.eliminated > 0)
                  Expanded(
                    flex: stats.eliminated,
                    child: Container(
                      height: 10,
                      color: AppConstants.errorRed,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Stats breakdown
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildStatItem('WON', stats.won, AppConstants.successGreen),
              Container(
                width: 1,
                height: 40,
                color: Colors.grey[300],
              ),
              _buildStatItem('DREW', stats.lost, Colors.grey[600]!),
              Container(
                width: 1,
                height: 40,
                color: Colors.grey[300],
              ),
              _buildStatItem('OUT', stats.eliminated, AppConstants.errorRed),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatItem(String label, int value, Color color) {
    return Column(
      children: [
        Text(
          value.toString(),
          style: TextStyle(
            fontSize: 26,
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: color.withValues(alpha: 0.8),
            letterSpacing: 0.5,
          ),
        ),
      ],
    );
  }

  Widget _buildInviteSection(Competition competition) {
    final inviteCode = competition.inviteCode ?? '';
    final inviteMessage = '''Invite players to
https://lmslocal.co.uk

using competition code:

$inviteCode''';

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppConstants.primaryNavy.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  Icons.group_add,
                  color: AppConstants.primaryNavy,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              Text(
                'Invite Players',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: AppConstants.primaryNavy,
                ),
              ),
            ],
          ),

          if (competition.playerCount < 5) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.orange[50],
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: Colors.orange[200]!,
                  width: 1,
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.info_outline,
                    size: 16,
                    color: Colors.orange[700],
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Add more players to start',
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.orange[900],
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],

          const SizedBox(height: 16),

          // Invite code
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.grey[100],
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: Colors.grey[300]!,
                width: 1.5,
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  inviteCode,
                  style: TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 4,
                    fontFamily: 'monospace',
                    color: AppConstants.primaryNavy,
                  ),
                ),
                Container(
                  decoration: BoxDecoration(
                    color: AppConstants.primaryNavy.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: IconButton(
                    icon: Icon(Icons.copy, color: AppConstants.primaryNavy),
                    onPressed: () => _copyToClipboard(inviteCode, 'Invite code'),
                    tooltip: 'Copy Code',
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 12),

          // Copy message button
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: () =>
                  _copyToClipboard(inviteMessage, 'Invite message'),
              icon: const Icon(Icons.share, size: 18),
              label: const Text(
                'Share Invite Message',
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 15,
                ),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppConstants.primaryNavy,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                elevation: 2,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCompleteBanner(Competition competition) {
    final winner = _getWinner(competition);

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          Text(
            'Competition Complete',
            style: TextStyle(
              fontSize: 14,
              color: AppConstants.primaryNavy.withValues(alpha: 0.7),
              fontWeight: FontWeight.w500,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 20),
            decoration: BoxDecoration(
              color: Colors.green[50],
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: Colors.green[200]!,
                width: 1,
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  winner != null ? 'Winner:' : 'Result:',
                  style: TextStyle(
                    fontSize: 16,
                    color: AppConstants.primaryNavy,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(width: 12),
                Text(
                  winner ?? 'Draw',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: Colors.green[800],
                    letterSpacing: 0.5,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String? _getWinner(Competition competition) {
    return competition.winnerName;
  }
}
