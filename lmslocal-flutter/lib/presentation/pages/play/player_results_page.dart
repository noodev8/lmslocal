import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:lmslocal_flutter/core/constants/app_constants.dart';
import 'package:lmslocal_flutter/core/theme/game_theme.dart';
import 'package:lmslocal_flutter/domain/entities/competition.dart';
import 'package:lmslocal_flutter/domain/entities/round_info.dart';
import 'package:lmslocal_flutter/domain/entities/fixture.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/pick_remote_data_source.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/api_client.dart';

/// Player results page - shown when round is locked or player is eliminated
/// Displays all picks made by players and match results
class PlayerResultsPage extends StatefulWidget {
  final String competitionId;
  final Competition competition;
  final RoundInfo round;

  const PlayerResultsPage({
    super.key,
    required this.competitionId,
    required this.competition,
    required this.round,
  });

  @override
  State<PlayerResultsPage> createState() => _PlayerResultsPageState();
}

class _PlayerResultsPageState extends State<PlayerResultsPage> {
  late final PickRemoteDataSource _dataSource;

  List<Fixture> _fixtures = [];
  Map<String, int> _pickCounts = {};
  String? _currentPick;
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    final apiClient = context.read<ApiClient>();
    _dataSource = PickRemoteDataSource(apiClient: apiClient);
    _loadData();
  }

  Future<void> _loadData() async {
    if (!mounted) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      // Load all data in parallel
      final results = await Future.wait([
        _dataSource.getFixtures(widget.round.id),
        _dataSource.getCurrentPick(widget.round.id),
        _dataSource.getPickCounts(widget.round.id),
      ]);

      if (!mounted) return;

      setState(() {
        _fixtures = results[0] as List<Fixture>;
        _currentPick = results[1] as String?;
        _pickCounts = results[2] as Map<String, int>;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _errorMessage = e.toString();
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Container(
        color: GameTheme.background,
        child: Center(
          child: CircularProgressIndicator(
            color: GameTheme.glowCyan,
          ),
        ),
      );
    }

    if (_errorMessage != null) {
      return Container(
        color: GameTheme.background,
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(AppConstants.paddingLarge),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.error_outline,
                  size: 64,
                  color: GameTheme.accentRed,
                ),
                const SizedBox(height: 16),
                Text(
                  'Failed to load results',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: GameTheme.textPrimary,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  _errorMessage!,
                  style: TextStyle(
                    fontSize: 14,
                    color: GameTheme.textMuted,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: _loadData,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: GameTheme.glowCyan,
                    foregroundColor: GameTheme.background,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 32,
                      vertical: 16,
                    ),
                  ),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    if (_fixtures.isEmpty) {
      return Container(
        color: GameTheme.background,
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(AppConstants.paddingLarge),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.sports_soccer,
                  size: 64,
                  color: GameTheme.textMuted,
                ),
                const SizedBox(height: 16),
                Text(
                  'No Fixtures',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: GameTheme.textPrimary,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'No fixtures available for this round',
                  style: TextStyle(
                    fontSize: 14,
                    color: GameTheme.textMuted,
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Container(
      color: GameTheme.background,
      child: RefreshIndicator(
        onRefresh: _loadData,
        color: GameTheme.glowCyan,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(AppConstants.paddingMedium),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              _buildHeader(),
              const SizedBox(height: 24),

              // No pick warning (only show if user is a participant)
              if (_currentPick == null && widget.competition.isParticipant) ...[
                _buildNoPickWarning(),
                const SizedBox(height: 24),
              ],

              // Pick distribution grid
              _buildPickDistributionGrid(),
              const SizedBox(height: 32),

              // Match results list
              _buildMatchResultsList(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    final isParticipant = widget.competition.isParticipant;
    final isEliminated = widget.competition.userStatus?.toLowerCase() != 'active';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Round ${widget.round.roundNumber} Results',
          style: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.bold,
            color: GameTheme.textPrimary,
          ),
        ),
        const SizedBox(height: 8),
        // Only show status messages if user is actually a participant
        if (isParticipant && isEliminated)
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: 12,
              vertical: 6,
            ),
            decoration: BoxDecoration(
              color: GameTheme.accentRed.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              'You\'ve been eliminated',
              style: TextStyle(
                fontSize: 14,
                color: GameTheme.accentRed,
                fontWeight: FontWeight.w600,
              ),
            ),
          )
        else if (isParticipant)
          Text(
            'Round is locked - see what everyone picked',
            style: TextStyle(
              fontSize: 14,
              color: GameTheme.textMuted,
            ),
          )
        else
          Text(
            'Viewing results as organiser',
            style: TextStyle(
              fontSize: 14,
              color: GameTheme.textMuted,
            ),
          ),
      ],
    );
  }

  Widget _buildNoPickWarning() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: GameTheme.accentOrange.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: GameTheme.accentOrange.withValues(alpha: 0.4),
        ),
      ),
      child: Row(
        children: [
          Icon(
            Icons.warning_amber_rounded,
            color: GameTheme.accentOrange,
            size: 24,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              'You didn\'t make a pick this round',
              style: TextStyle(
                fontSize: 14,
                color: GameTheme.textPrimary,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPickDistributionGrid() {
    // Build list of teams with picks
    final teamsWithPicks = <_TeamPickInfo>[];

    for (final fixture in _fixtures) {
      // Home team
      final homeCount = _pickCounts[fixture.homeTeamShort] ?? 0;
      if (homeCount > 0) {
        teamsWithPicks.add(_TeamPickInfo(
          shortName: fixture.homeTeamShort,
          fullName: fixture.homeTeam,
          pickCount: homeCount,
          result: fixture.result,
          isUserPick: _currentPick == fixture.homeTeamShort,
          isHomeTeam: true,
        ));
      }

      // Away team
      final awayCount = _pickCounts[fixture.awayTeamShort] ?? 0;
      if (awayCount > 0) {
        teamsWithPicks.add(_TeamPickInfo(
          shortName: fixture.awayTeamShort,
          fullName: fixture.awayTeam,
          pickCount: awayCount,
          result: fixture.result,
          isUserPick: _currentPick == fixture.awayTeamShort,
          isHomeTeam: false,
        ));
      }
    }

    // Sort: Winners first, then by pick count descending
    teamsWithPicks.sort((a, b) {
      final aWon = a.didWin;
      final bWon = b.didWin;

      if (aWon && !bWon) return -1;
      if (!aWon && bWon) return 1;

      return b.pickCount.compareTo(a.pickCount);
    });

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Pick Distribution',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: GameTheme.textPrimary,
          ),
        ),
        const SizedBox(height: 12),
        if (teamsWithPicks.isEmpty)
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: GameTheme.cardBackground,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: GameTheme.border),
            ),
            child: Center(
              child: Text(
                'No picks made yet',
                style: TextStyle(
                  fontSize: 14,
                  color: GameTheme.textMuted,
                ),
              ),
            ),
          )
        else
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              crossAxisSpacing: 8,
              mainAxisSpacing: 8,
              childAspectRatio: 0.9,
            ),
            itemCount: teamsWithPicks.length,
            itemBuilder: (context, index) {
              return _buildPickCard(teamsWithPicks[index]);
            },
          ),
      ],
    );
  }

  Widget _buildPickCard(_TeamPickInfo info) {
    Color cardColor;
    Color borderColor;
    Color textColor;
    late IconData statusIcon;
    late Color iconColor;

    if (info.didWin) {
      // Winner - green with visible background
      cardColor = GameTheme.accentGreen.withValues(alpha: 0.2);
      borderColor = GameTheme.accentGreen.withValues(alpha: 0.5);
      textColor = GameTheme.accentGreen;
      statusIcon = Icons.check_circle;
      iconColor = GameTheme.accentGreen;
    } else if (info.didLose) {
      // Loser - red with visible background
      cardColor = GameTheme.accentRed.withValues(alpha: 0.2);
      borderColor = GameTheme.accentRed.withValues(alpha: 0.5);
      textColor = GameTheme.accentRed;
      statusIcon = Icons.cancel;
      iconColor = GameTheme.accentRed;
    } else if (info.isUserPick) {
      // User's pick (pending) - cyan highlight
      cardColor = GameTheme.glowCyan.withValues(alpha: 0.15);
      borderColor = GameTheme.glowCyan.withValues(alpha: 0.5);
      textColor = GameTheme.glowCyan;
      statusIcon = Icons.schedule;
      iconColor = GameTheme.glowCyan;
    } else {
      // Other teams (pending) - card background (more visible)
      cardColor = GameTheme.cardBackground;
      borderColor = GameTheme.border;
      textColor = GameTheme.textPrimary;
      statusIcon = Icons.schedule;
      iconColor = GameTheme.textMuted;
    }

    return Container(
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: borderColor,
          width: info.isUserPick || info.didWin || info.didLose ? 2 : 1,
        ),
        boxShadow: info.didWin
            ? [
                BoxShadow(
                  color: GameTheme.accentGreen.withValues(alpha: 0.3),
                  blurRadius: 8,
                  spreadRadius: 1,
                ),
              ]
            : null,
      ),
      padding: const EdgeInsets.all(12),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            statusIcon,
            size: 24,
            color: iconColor,
          ),
          const SizedBox(height: 6),
          Text(
            info.shortName,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: textColor,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 4),
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: 8,
              vertical: 3,
            ),
            decoration: BoxDecoration(
              color: GameTheme.glowCyan,
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              '${info.pickCount} ${info.pickCount == 1 ? 'player' : 'players'}',
              style: TextStyle(
                fontSize: 11,
                color: GameTheme.background,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMatchResultsList() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Match Results',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: GameTheme.textPrimary,
          ),
        ),
        const SizedBox(height: 12),
        ListView.separated(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: _fixtures.length,
          separatorBuilder: (context, index) => const SizedBox(height: 8),
          itemBuilder: (context, index) {
            return _buildMatchResultCard(_fixtures[index]);
          },
        ),
      ],
    );
  }

  Widget _buildMatchResultCard(Fixture fixture) {
    final homeIsUserPick = _currentPick == fixture.homeTeamShort;
    final awayIsUserPick = _currentPick == fixture.awayTeamShort;

    // Result contains the winning team's short name (e.g., "ARS", "CHE")
    final homeIsWinner = fixture.result == fixture.homeTeamShort;
    final awayIsWinner = fixture.result == fixture.awayTeamShort;
    final isPending = fixture.result == null || fixture.result!.isEmpty;

    // Result text
    String resultText;
    if (homeIsWinner) {
      resultText = '${fixture.homeTeamShort} won';
    } else if (awayIsWinner) {
      resultText = '${fixture.awayTeamShort} won';
    } else if (!isPending) {
      resultText = 'Draw';
    } else {
      resultText = 'Pending';
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: GameTheme.cardBackground,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: GameTheme.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Teams
          Row(
            children: [
              // Home team
              Expanded(
                child: Row(
                  children: [
                    if (homeIsUserPick)
                      Container(
                        width: 8,
                        height: 8,
                        margin: const EdgeInsets.only(right: 8),
                        decoration: BoxDecoration(
                          color: GameTheme.glowCyan,
                          shape: BoxShape.circle,
                        ),
                      ),
                    Expanded(
                      child: Text(
                        fixture.homeTeam,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: homeIsWinner ? FontWeight.bold : FontWeight.normal,
                          color: homeIsWinner ? GameTheme.accentGreen : GameTheme.textPrimary,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Text(
                  'vs',
                  style: TextStyle(
                    fontSize: 12,
                    color: GameTheme.textMuted,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
              // Away team
              Expanded(
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        fixture.awayTeam,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: awayIsWinner ? FontWeight.bold : FontWeight.normal,
                          color: awayIsWinner ? GameTheme.accentGreen : GameTheme.textPrimary,
                        ),
                        textAlign: TextAlign.right,
                      ),
                    ),
                    if (awayIsUserPick)
                      Container(
                        width: 8,
                        height: 8,
                        margin: const EdgeInsets.only(left: 8),
                        decoration: BoxDecoration(
                          color: GameTheme.glowCyan,
                          shape: BoxShape.circle,
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),

          // Result - positioned based on which team won
          Row(
            mainAxisAlignment: homeIsWinner
                ? MainAxisAlignment.start
                : awayIsWinner
                    ? MainAxisAlignment.end
                    : !isPending
                        ? MainAxisAlignment.center  // Draw in center
                        : MainAxisAlignment.start,  // Pending on left
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 8,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: homeIsWinner || awayIsWinner
                      ? GameTheme.accentGreen.withValues(alpha: 0.15)
                      : GameTheme.backgroundLight,
                  borderRadius: BorderRadius.circular(4),
                  border: Border.all(
                    color: homeIsWinner || awayIsWinner
                        ? GameTheme.accentGreen.withValues(alpha: 0.3)
                        : GameTheme.border,
                  ),
                ),
                child: Text(
                  resultText,
                  style: TextStyle(
                    fontSize: 12,
                    color: homeIsWinner || awayIsWinner
                        ? GameTheme.accentGreen
                        : GameTheme.textMuted,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Helper class to organize team pick information
class _TeamPickInfo {
  final String shortName;
  final String fullName;
  final int pickCount;
  final String? result;
  final bool isUserPick;
  final bool isHomeTeam;

  _TeamPickInfo({
    required this.shortName,
    required this.fullName,
    required this.pickCount,
    required this.result,
    required this.isUserPick,
    required this.isHomeTeam,
  });

  bool get didWin {
    if (result == null || result!.isEmpty) return false;

    // Result contains the winning team's short name (e.g., "ARS", "CHE")
    return result == shortName;
  }

  bool get didLose {
    if (result == null || result!.isEmpty) return false;

    // If result exists but doesn't match this team, they lost (including draws)
    return result != shortName;
  }
}
