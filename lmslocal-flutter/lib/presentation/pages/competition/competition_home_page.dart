import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:lmslocal_flutter/core/constants/app_constants.dart';
import 'package:lmslocal_flutter/core/game/round_state.dart';
import 'package:lmslocal_flutter/core/theme/coupon_theme.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/api_client.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/competition_remote_data_source.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/dashboard_remote_data_source.dart';
import 'package:lmslocal_flutter/domain/entities/competition.dart';
import 'package:lmslocal_flutter/domain/entities/pick_statistics.dart';
import 'package:lmslocal_flutter/domain/entities/round_info.dart';
import 'package:lmslocal_flutter/domain/entities/round_statistics.dart';
import 'package:lmslocal_flutter/core/theme/game_theme.dart';
import 'package:lmslocal_flutter/presentation/pages/competition/widgets/players_active_block.dart';
import 'package:lmslocal_flutter/presentation/pages/competition/widgets/player_status_block.dart';
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
        final dashboardData = await _dashboardDataSource.getUserDashboard(
          forceRefresh: forceRefresh,
        );

        competition = dashboardData.competitions.firstWhere(
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
            backgroundColor: GameTheme.accentRed,
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
        backgroundColor: GameTheme.accentGreen,
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
                        _currentRound != null) ...[
                      _buildCurrentRoundCard(_currentRound!),
                      const SizedBox(height: 12),
                      // Where the round has got to, in one sentence. Without it
                      // the screen showed a count and a lives figure and left
                      // "have picks closed?" — the thing a player actually
                      // wants to know — to be inferred from whether the Play
                      // tab happened to offer a pick.
                      Text(
                        playerRoundStatus(_roundState()),
                        style: CouponTheme.bodyText.copyWith(
                          color: CouponTheme.inkFade,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 16),
                    ],

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

                    // The competition's own details, on the page rather than
                    // behind a button. They were a bottom sheet nobody opened
                    // twice — the prize is the reason a player entered, and a
                    // detail you have to remember to ask for is a detail most
                    // players never see. The web has always shown them inline.
                    _buildAboutBlock(_competition!),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// The competition's details as a ruled block: prize first, then the blurb,
  /// then a two-column ledger of facts.
  ///
  /// Prize leads because it is the answer to "what am I playing for?" — the
  /// question the old sheet buried under a heading. Set in `font-data` where a
  /// person typed the value in and `font-body` where the app supplies the key,
  /// per design-system.md §3.
  Widget _buildAboutBlock(Competition competition) {
    final venue = [competition.venueName, competition.city]
        .where((part) => part != null && part.isNotEmpty)
        .join(', ');

    final prize = competition.prizeStructure;
    final description = competition.description;

    // Venue only. The player count is already the biggest thing on this screen
    // and the team list is not a fact a player acts on — repeating either here
    // made the block longer without making it more useful.
    final rows = <Widget>[
      if (venue.isNotEmpty) _buildLedgerRow('Venue', venue),
    ];

    final hasPrize = prize != null && prize.isNotEmpty;
    final hasDescription = description != null && description.isNotEmpty;

    // Nothing to say, so nothing is drawn. An organiser who filled none of this
    // in would otherwise get a bare "ABOUT" ruled off at both ends, which reads
    // as content that failed to load.
    if (!hasPrize && !hasDescription && rows.isEmpty) {
      return const SizedBox.shrink();
    }

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: 24),
      padding: const EdgeInsets.symmetric(vertical: 20),
      decoration: BoxDecoration(
        border: Border(
          top: CouponTheme.rule(),
          bottom: CouponTheme.rule(),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('ABOUT', style: CouponTheme.label),
          if (hasPrize) ...[
            const SizedBox(height: 12),
            Text(prize, style: CouponTheme.intro.copyWith(fontSize: 18)),
          ],
          if (hasDescription) ...[
            const SizedBox(height: 12),
            Text(
              description,
              style: CouponTheme.bodyText.copyWith(color: CouponTheme.inkFade),
            ),
          ],
          if (rows.isNotEmpty) ...[
            const SizedBox(height: 16),
            ...rows,
          ],
        ],
      ),
    );
  }

  /// One key/value line. The dotted leader between them is the coupon's own
  /// device — it ties a label to a value across a gap without needing a rule
  /// or a box round either.
  Widget _buildLedgerRow(String key, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.baseline,
        textBaseline: TextBaseline.alphabetic,
        children: [
          Text(key.toUpperCase(), style: CouponTheme.label),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Divider(
                color: CouponTheme.ink.withValues(alpha: 0.25),
                height: 1,
                thickness: 0.5,
              ),
            ),
          ),
          Flexible(
            child: Text(
              value,
              style: CouponTheme.dataText,
              textAlign: TextAlign.right,
            ),
          ),
        ],
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
              // The organiser's own logo, if they uploaded one. There is no
              // placeholder behind it: a generic football beside every
              // competition's name decorated the header without identifying
              // anything, and the name is the identifier.
              if (competition.logoUrl != null) ...[
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
                  child: Image.network(
                    competition.logoUrl!,
                    fit: BoxFit.cover,
                    errorBuilder: (context, error, stackTrace) =>
                        const SizedBox.shrink(),
                  ),
                ),
                const SizedBox(width: 12),
              ],

              // Competition Name. Expanded rather than Flexible between two
              // Spacers: a Spacer is an Expanded, so three flex:1 children
              // split the row in thirds and the name ellipsised with half the
              // header empty. It takes the space the back arrow and its
              // counterweight leave, and centres in it.
              Expanded(
                child: Text(
                  competition.name,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: GameTheme.textPrimary,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              // Empty space to balance back arrow
              const SizedBox(width: 48),
            ],
          ),
        ),
      ),
    );
  }

  /// The round state, off the same three fixture counts the web dashboard uses,
  /// so the app and the web can never describe one round differently. See
  /// `core/game/round_state.dart`.
  RoundState _roundState() {
    final competition = _competition!;
    return deriveDashboardRoundState(
      currentRound: _currentRound?.roundNumber ?? competition.currentRound,
      currentRoundLockTime:
          _currentRound?.lockTime ?? competition.currentRoundLockTime,
      competitionComplete: competition.status == 'COMPLETE',
      now: DateTime.now(),
      totalFixtures: competition.totalFixtures,
      fixturesWithResults: competition.fixturesWithResults,
      fixturesProcessed: competition.fixturesProcessed,
    );
  }

  Widget _buildCurrentRoundCard(RoundInfo round) {
    // Use fresh pick statistics total when available - it's the accurate count from DB
    final activeCount = _pickStats?.totalActivePlayers ??
                       round.activePlayers ??
                       _competition!.playerCount;

    return PlayersActiveBlock(
      playerCount: activeCount,
      heading: roundHeading(_roundState()),
    );
  }

  Widget _buildPersonalStatusCards(Competition competition) {
    return PlayerStatusBlock(
      isStillIn: competition.userStatus?.toLowerCase() == 'active',
      livesRemaining: competition.livesRemaining ?? 0,
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
