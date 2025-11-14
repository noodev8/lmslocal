import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:lmslocal_flutter/core/constants/app_constants.dart';
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
      return const Center(
        child: CircularProgressIndicator(
          color: AppConstants.primaryNavy,
        ),
      );
    }

    if (_errorMessage != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(AppConstants.paddingLarge),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.error_outline,
                size: 64,
                color: AppConstants.errorRed,
              ),
              const SizedBox(height: 16),
              Text(
                'Failed to load results',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: AppConstants.primaryNavy,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                _errorMessage!,
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.grey[600],
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _loadData,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppConstants.primaryNavy,
                  foregroundColor: Colors.white,
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
      );
    }

    if (_fixtures.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(AppConstants.paddingLarge),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.sports_soccer,
                size: 64,
                color: Colors.grey[400],
              ),
              const SizedBox(height: 16),
              Text(
                'No Fixtures',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: AppConstants.primaryNavy,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'No fixtures available for this round',
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.grey[600],
                ),
              ),
            ],
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadData,
      color: AppConstants.primaryNavy,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(AppConstants.paddingMedium),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            _buildHeader(),
            const SizedBox(height: 24),

            // No pick warning
            if (_currentPick == null) ...[
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
    );
  }

  Widget _buildHeader() {
    final isEliminated = widget.competition.userStatus?.toLowerCase() != 'active';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Round ${widget.round.roundNumber} Results',
          style: const TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.bold,
            color: AppConstants.primaryNavy,
          ),
        ),
        const SizedBox(height: 8),
        if (isEliminated)
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: 12,
              vertical: 6,
            ),
            decoration: BoxDecoration(
              color: AppConstants.errorRed.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              'You\'ve been eliminated',
              style: TextStyle(
                fontSize: 14,
                color: AppConstants.errorRed,
                fontWeight: FontWeight.w600,
              ),
            ),
          )
        else
          Text(
            'Round is locked - see what everyone picked',
            style: TextStyle(
              fontSize: 14,
              color: Colors.grey[600],
            ),
          ),
      ],
    );
  }

  Widget _buildNoPickWarning() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppConstants.warningOrange.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: AppConstants.warningOrange.withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        children: [
          Icon(
            Icons.warning_amber_rounded,
            color: AppConstants.warningOrange,
            size: 24,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              'You didn\'t make a pick this round',
              style: TextStyle(
                fontSize: 14,
                color: Colors.grey[800],
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
        const Text(
          'Pick Distribution',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: AppConstants.primaryNavy,
          ),
        ),
        const SizedBox(height: 12),
        if (teamsWithPicks.isEmpty)
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.grey[100],
              borderRadius: BorderRadius.circular(8),
            ),
            child: Center(
              child: Text(
                'No picks made yet',
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.grey[600],
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
    Color textColor;
    IconData statusIcon;
    Color iconColor;

    if (info.didWin) {
      // Winner - green
      cardColor = AppConstants.successGreen.withValues(alpha: 0.1);
      textColor = AppConstants.successGreen;
      statusIcon = Icons.check_circle;
      iconColor = AppConstants.successGreen;
    } else if (info.didLose) {
      // Loser - red
      cardColor = AppConstants.errorRed.withValues(alpha: 0.1);
      textColor = AppConstants.errorRed;
      statusIcon = Icons.cancel;
      iconColor = AppConstants.errorRed;
    } else if (info.isUserPick) {
      // User's pick (pending) - blue
      cardColor = AppConstants.primaryNavy.withValues(alpha: 0.1);
      textColor = AppConstants.primaryNavy;
      statusIcon = Icons.remove_circle_outline;
      iconColor = Colors.grey[600]!;
    } else {
      // Other teams (pending) - grey
      cardColor = Colors.grey[100]!;
      textColor = Colors.grey[700]!;
      statusIcon = Icons.remove_circle_outline;
      iconColor = Colors.grey[400]!;
    }

    return Container(
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(8),
        border: info.isUserPick
            ? Border.all(
                color: AppConstants.primaryNavy.withValues(alpha: 0.3),
                width: 2,
              )
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
          const SizedBox(height: 8),
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
          Text(
            '${info.pickCount} ${info.pickCount == 1 ? 'player' : 'players'}',
            style: TextStyle(
              fontSize: 12,
              color: Colors.grey[600],
            ),
            textAlign: TextAlign.center,
          ),
          if (info.isUserPick) ...[
            const SizedBox(height: 4),
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: 6,
                vertical: 2,
              ),
              decoration: BoxDecoration(
                color: AppConstants.primaryNavy,
                borderRadius: BorderRadius.circular(4),
              ),
              child: const Text(
                'Your pick',
                style: TextStyle(
                  fontSize: 10,
                  color: Colors.white,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildMatchResultsList() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Match Results',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: AppConstants.primaryNavy,
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
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.grey[300]!),
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
                        decoration: const BoxDecoration(
                          color: AppConstants.primaryNavy,
                          shape: BoxShape.circle,
                        ),
                      ),
                    Expanded(
                      child: Text(
                        fixture.homeTeam,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: homeIsWinner ? FontWeight.bold : FontWeight.normal,
                          color: homeIsWinner ? AppConstants.successGreen : Colors.black,
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
                    color: Colors.grey[600],
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
                          color: awayIsWinner ? AppConstants.successGreen : Colors.black,
                        ),
                        textAlign: TextAlign.right,
                      ),
                    ),
                    if (awayIsUserPick)
                      Container(
                        width: 8,
                        height: 8,
                        margin: const EdgeInsets.only(left: 8),
                        decoration: const BoxDecoration(
                          color: AppConstants.primaryNavy,
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
                      ? AppConstants.successGreen.withValues(alpha: 0.1)
                      : !isPending
                          ? Colors.grey[100]
                          : Colors.grey[100],
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  resultText,
                  style: TextStyle(
                    fontSize: 12,
                    color: homeIsWinner || awayIsWinner
                        ? AppConstants.successGreen
                        : !isPending
                            ? Colors.grey[600]
                            : Colors.grey[600],
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
