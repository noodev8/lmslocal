import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:lmslocal_flutter/core/constants/app_constants.dart';
import 'package:lmslocal_flutter/core/theme/game_theme.dart';
import 'package:lmslocal_flutter/core/theme/coupon_theme.dart';
import 'package:lmslocal_flutter/domain/entities/competition.dart';
import 'package:lmslocal_flutter/domain/entities/round_info.dart';
import 'package:lmslocal_flutter/domain/entities/fixture.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/pick_remote_data_source.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/api_client.dart';
import 'package:lmslocal_flutter/presentation/widgets/shell_back_button.dart';
import 'package:lmslocal_flutter/presentation/widgets/pick_tag.dart';

/// Player results page - shown when round is locked or player is eliminated
/// Displays all picks made by players and match results
class PlayerResultsPage extends StatefulWidget {
  final String competitionId;
  final Competition competition;
  final RoundInfo round;

  /// Leaves the Play tab — see `ShellBackButton`.
  final VoidCallback? onBack;

  const PlayerResultsPage({
    super.key,
    required this.competitionId,
    required this.competition,
    required this.round,
    this.onBack,
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

              // The matches first. They are the round — what happened, and what
              // it meant for the reader, on the fixture they have a stake in.
              // Who else picked what is context for that, so it follows rather
              // than standing between the reader and their own result.
              _buildMatchResultsList(),
              const SizedBox(height: 32),

              _buildPickDistributionGrid(),
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
        // On the title's own line, so the arrow costs no vertical space. The
        // title is Expanded because a long round number plus the arrow must
        // wrap rather than overflow.
        Row(
          children: [
            if (widget.onBack != null) ...[
              ShellBackButton(onPressed: widget.onBack!),
              const SizedBox(width: 4),
            ],
            Expanded(
              child: Text(
                'Round ${widget.round.roundNumber} Results',
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: GameTheme.textPrimary,
                ),
              ),
            ),
          ],
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
          'Picks',
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
              borderRadius: BorderRadius.zero,
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

  /// One team in the "who picked what" grid.
  ///
  /// The colours are a port of the web's `/player-results`, which went through
  /// two rejected attempts before this one — see design-system.md §8 and the
  /// comment in `lmslocal-web/src/app/game/[id]/player-results/page.tsx`. The
  /// short version, because it is easy to undo by accident:
  ///
  /// - **A winner takes `mossWash` as a ground with `ink` text on top.** Filling
  ///   with `moss` itself is a dark slab, and `moss` at 20% over the stock reads
  ///   as grey — both were shipped here and both were wrong. The light ground is
  ///   the only treatment that is green *and* comfortable at card size.
  /// - **A loser is not `overprint`.** Every fixture has a loser, and red is the
  ///   ink that means *the reader is out*. Beaten teams recede: stock ground,
  ///   faint rule, name struck through in `inkFade`.
  /// - **The word stays.** §8 requires state to be doubled rather than left to
  ///   colour, so the card reads correctly in greyscale. That is also what
  ///   replaced the status icons — a tick and a cross said the same thing in
  ///   `moss` and `overprint`, which is where half the darkness came from.
  Widget _buildPickCard(_TeamPickInfo info) {
    final Color cardColor;
    final Color borderColor;
    final double borderWidth;
    final Color textColor;

    if (info.didWin) {
      cardColor = CouponTheme.mossWash;
      borderColor = CouponTheme.moss;
      borderWidth = 1;
      textColor = CouponTheme.ink;
    } else if (info.didLose) {
      cardColor = CouponTheme.stock;
      borderColor = CouponTheme.ink.withValues(alpha: 0.15);
      borderWidth = 1;
      textColor = CouponTheme.inkFade;
    } else {
      // No result yet, whether or not it is the player's own pick. The pick is
      // marked by its border and its stamp, never by a tint: a wash here read as
      // "greyed out, already lost" on a round with no results at all.
      cardColor = GameTheme.cardBackground;
      borderColor = info.isUserPick ? CouponTheme.ink : GameTheme.border;
      borderWidth = info.isUserPick ? 2 : 1;
      textColor = CouponTheme.ink;
    }

    final card = Container(
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.zero,
        border: Border.all(color: borderColor, width: borderWidth),
      ),
      padding: const EdgeInsets.all(12),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // The team as the player chose it, so `font-data` (§3).
          Text(
            info.shortName,
            style: CouponTheme.dataText.copyWith(
              fontSize: 15,
              color: textColor,
              decoration: info.didLose ? TextDecoration.lineThrough : null,
              decorationColor: CouponTheme.inkFade.withValues(alpha: 0.5),
            ),
            textAlign: TextAlign.center,
          ),
          if (info.didWin || info.didLose) ...[
            const SizedBox(height: 4),
            Text(
              info.didWin ? 'WON' : 'LOST',
              style: CouponTheme.label.copyWith(
                color: info.didWin ? CouponTheme.moss : CouponTheme.inkFade,
                fontWeight: info.didWin ? FontWeight.w600 : null,
              ),
            ),
          ],
          const SizedBox(height: 6),
          // A plain label, not a solid ink pill. Four black pills in a
          // four-card grid outweighed the state they sat next to.
          Text(
            '${info.pickCount} ${info.pickCount == 1 ? 'player' : 'players'}',
            style: CouponTheme.label,
          ),
        ],
      ),
    );

    if (!info.isUserPick) return card;

    // Stamped on the corner, in every result state — "which of these is mine?"
    // is the first question this grid is asked, and a win or a loss does not
    // stop it being asked.
    //
    // `StackFit.passthrough` matters: a Stack hands *loose* constraints to a
    // non-positioned child, so without it the card shrank to its intrinsic
    // width inside the grid cell and the player's own card came out visibly
    // narrower than every other one. `clipBehavior: none` lets the tag overhang.
    return Stack(
      fit: StackFit.passthrough,
      clipBehavior: Clip.none,
      children: [
        card,
        const Positioned(top: -4, left: -4, child: PickTag()),
      ],
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
        // A ledger: one panel, hairline rules between fixtures. Four separately
        // boxed cards drew four frames the reader had to cross; the rows are a
        // list, so they are ruled like one.
        Container(
          decoration: BoxDecoration(
            color: GameTheme.cardBackground,
            border: Border.all(color: GameTheme.border),
          ),
          child: Column(
            children: [
              for (var i = 0; i < _fixtures.length; i++) ...[
                if (i > 0)
                  Divider(
                    height: 0.5,
                    thickness: 0.5,
                    color: CouponTheme.ink.withValues(alpha: 0.3),
                  ),
                _buildFixtureRow(_fixtures[i]),
              ],
            ],
          ),
        ),
      ],
    );
  }

  /// One fixture, one line, everything in reading order.
  ///
  /// This was two rows: the teams pushed to opposite edges, then a status pill
  /// whose alignment moved with the result — left when the home team won, right
  /// when the away team did, centred on a draw. Nothing sat in the same place
  /// twice, so the eye had to search each row to find out where the answer had
  /// been put this time. The pick badge made it worse by being pinned to a team's
  /// side rather than saying whose stake it was.
  ///
  /// Now: names left in `font-data`, one status right, in the same two places on
  /// every row. The status column carries only what the names cannot say
  /// themselves — whose pick it is, and whether a result has arrived — because
  /// the winner is already bold and the beaten side already faded, which is why
  /// a settled fixture the reader had no stake in says nothing at all.
  ///
  /// **Copy deliberately diverges from the web here.** `player-results/page.tsx`
  /// says "You're out" on a lost pick, which is untrue for anyone holding a life
  /// — most players in most competitions (the same trap §3b removed from the
  /// pick screen's footer). This states the pick's outcome and lets the
  /// dashboard's lives panel say what it cost.
  Widget _buildFixtureRow(Fixture fixture) {
    final homeIsUserPick = _currentPick == fixture.homeTeamShort;
    final awayIsUserPick = _currentPick == fixture.awayTeamShort;
    final isUserFixture = homeIsUserPick || awayIsUserPick;

    // `result` holds the winning team's short name, or nothing at all.
    final homeWon = fixture.result == fixture.homeTeamShort;
    final awayWon = fixture.result == fixture.awayTeamShort;
    final isPending = fixture.result == null || fixture.result!.isEmpty;
    final isDraw = !isPending && !homeWon && !awayWon;

    final userWon = (homeIsUserPick && homeWon) || (awayIsUserPick && awayWon);

    final String status;
    if (isUserFixture) {
      // "Pick", not "Your pick": the column is narrow and the underline on the
      // team name already establishes whose it is.
      status = isPending
          ? 'Pick'
          : userWon
              ? 'You won'
              : isDraw
                  ? 'Draw — you lost'
                  : 'You lost';
    } else {
      status = isPending ? 'Pending' : (isDraw ? 'Draw' : '');
    }

    final Color statusColor;
    if (isUserFixture && !isPending) {
      statusColor = userWon ? CouponTheme.moss : CouponTheme.overprint;
    } else if (isPending) {
      statusColor = CouponTheme.inkFade;
    } else {
      statusColor = CouponTheme.ink;
    }

    // The picked team is underlined, as on the web. "PICK" in the status column
    // says the reader has a stake in the row; the underline says which of the
    // two names it is — a two-team row cannot answer that from the status
    // word alone, which is the gap this closes. The word stays as well, because
    // an underline on its own is a mark with no meaning attached (§8).
    TextStyle teamStyle(bool won, bool lost, bool isPick) =>
        CouponTheme.dataText.copyWith(
          fontSize: 15,
          color: lost ? CouponTheme.inkFade : CouponTheme.ink,
          fontWeight: won ? FontWeight.w600 : null,
          decoration: isPick ? TextDecoration.underline : null,
          decorationColor: lost ? CouponTheme.inkFade : CouponTheme.ink,
          // Clear of the descenders, or the rule cuts through a "p" or a "y".
          decorationThickness: 1,
        );

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Text.rich rather than a Row of three: the names wrap as one phrase
          // and share a baseline, which a Row of separate Texts does not.
          Expanded(
            child: Text.rich(
              TextSpan(
                children: [
                  TextSpan(
                    text: fixture.homeTeam,
                    style: teamStyle(homeWon, awayWon, homeIsUserPick),
                  ),
                  TextSpan(
                    text: '  vs  ',
                    style: CouponTheme.label.copyWith(fontSize: 12),
                  ),
                  TextSpan(
                    text: fixture.awayTeam,
                    style: teamStyle(awayWon, homeWon, awayIsUserPick),
                  ),
                ],
              ),
            ),
          ),
          if (status.isNotEmpty) ...[
            const SizedBox(width: 12),
            Text(
              status.toUpperCase(),
              style: CouponTheme.label.copyWith(
                color: statusColor,
                fontWeight: isUserFixture ? FontWeight.w600 : null,
              ),
            ),
          ],
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
