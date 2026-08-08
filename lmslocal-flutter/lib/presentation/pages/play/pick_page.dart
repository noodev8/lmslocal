import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:lmslocal_flutter/core/game/round_state.dart';
import 'package:lmslocal_flutter/core/theme/game_theme.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/api_client.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/pick_remote_data_source.dart';
import 'package:lmslocal_flutter/domain/entities/competition.dart';
import 'package:lmslocal_flutter/domain/entities/round_info.dart';
import 'package:lmslocal_flutter/domain/entities/fixture.dart';
import 'package:lmslocal_flutter/domain/entities/allowed_team.dart';

/// Pick page - shown when round is unlocked and player can make their pick
/// Displays fixtures and allows team selection
class PickPage extends StatefulWidget {
  final String competitionId;
  final Competition competition;
  final RoundInfo round;

  const PickPage({
    super.key,
    required this.competitionId,
    required this.competition,
    required this.round,
  });

  @override
  State<PickPage> createState() => _PickPageState();
}

class _PickPageState extends State<PickPage> {
  late PickRemoteDataSource _pickDataSource;

  List<Fixture> _fixtures = [];
  List<String> _allowedTeamShorts = [];
  String? _currentPick;

  /// The team whose tap is in flight, so its own card can show the wait rather
  /// than a banner somewhere else on the screen.
  String? _submittingTeam;

  bool _isLoading = true;
  bool _isSubmitting = false;
  String? _error;

  // Track if round has been locked (overrides widget.round.isLocked)
  bool _roundLockedOverride = false;

  @override
  void initState() {
    super.initState();
    _initializeData();
  }

  Future<void> _initializeData() async {
    final apiClient = context.read<ApiClient>();
    _pickDataSource = PickRemoteDataSource(apiClient: apiClient);

    await _loadPickData();
  }

  Future<void> _loadPickData() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      // Load all data in parallel
      final results = await Future.wait([
        _pickDataSource.getFixtures(widget.round.id),
        _pickDataSource.getAllowedTeams(widget.competition.id),
        _pickDataSource.getCurrentPick(widget.round.id),
      ]);

      final fixtures = results[0] as List<Fixture>;
      final allowedTeams = results[1] as List<AllowedTeam>;
      final currentPick = results[2] as String?;

      if (mounted) {
        setState(() {
          _fixtures = fixtures;
          _allowedTeamShorts =
              allowedTeams.map((t) => t.shortName).toList();
          _currentPick = currentPick;
          _isLoading = false;
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

  String _getFullTeamName(String shortName) {
    for (final fixture in _fixtures) {
      if (fixture.homeTeamShort == shortName) return fixture.homeTeam;
      if (fixture.awayTeamShort == shortName) return fixture.awayTeam;
    }
    return shortName;
  }

  Future<void> _clearDashboardCache() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('dashboard_competitions');
      await prefs.remove('dashboard_cache_time');
    } catch (e) {
      // Silently fail - not critical
    }
  }

  Future<void> _clearPickStatisticsCache() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      // Clear pick statistics cache for this round
      final cacheKey = 'pick_stats_${widget.competition.id}_${widget.round.roundNumber}';
      final cacheTimeKey = '${cacheKey}_time';
      await prefs.remove(cacheKey);
      await prefs.remove(cacheTimeKey);

      // Also clear rounds cache to get updated lock status
      final roundsCacheKey = 'competition_rounds_${widget.competition.id}';
      final roundsCacheTimeKey = '${roundsCacheKey}_time';
      await prefs.remove(roundsCacheKey);
      await prefs.remove(roundsCacheTimeKey);
    } catch (e) {
      // Silently fail - not critical
    }
  }

  /// Tapping a team **is** the pick. There is no separate confirm step.
  ///
  /// There used to be one, and it lost people their round: the confirm banner
  /// rendered under the fixture list, so on a ten-match round it sat off the
  /// bottom of the screen. A player tapped their team, saw it highlight, and
  /// left — having selected nothing. The step that existed to prevent mistakes
  /// was causing them.
  ///
  /// Safe to do directly because a pick is not a commitment until the round
  /// locks: `set-pick` takes a change (`ON CONFLICT (round_id, user_id) DO
  /// UPDATE`, putting the old team back in `allowed_teams` and auditing it as
  /// "Pick Changed"), so a mis-tap is corrected by tapping the right team. A
  /// modal would ask people to confirm something they can simply redo.
  Future<void> _pickTeam(String teamShort, int fixtureId, String position) async {
    if (_isSubmitting) return;
    if (widget.round.isLocked || _roundLockedOverride) return;
    if (!_allowedTeamShorts.contains(teamShort)) return;
    // Tapping the team already picked is a no-op rather than a pointless write.
    if (_currentPick == teamShort) return;

    setState(() {
      _isSubmitting = true;
      _submittingTeam = teamShort;
    });

    try {
      final roundLocked = await _pickDataSource.setPick(fixtureId, position);

      if (!mounted) return;

      // Clear dashboard cache so it reloads with fresh data
      await _clearDashboardCache();

      // Reload data to reflect new pick
      await _loadPickData();

      if (!mounted) return;
      setState(() {
        _isSubmitting = false;
        _submittingTeam = null;
      });

      // If round locked, clear caches before showing message
      if (roundLocked) {
        await _clearPickStatisticsCache();
      }

      // Names the team. With the tap itself being the pick, this is the only
      // confirmation the player gets, so it has to say what was saved rather
      // than that something was.
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Picked ${_getFullTeamName(teamShort)}'),
            backgroundColor: GameTheme.accentGreen,
            duration: const Duration(seconds: 2),
          ),
        );
      }

      // If round locked, update state to reflect locked round
      if (roundLocked && mounted) {
        setState(() {
          _roundLockedOverride = true;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
          _submittingTeam = null;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to save pick: ${e.toString()}'),
            backgroundColor: GameTheme.accentRed,
          ),
        );
      }
    }
  }


  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Center(child: CircularProgressIndicator(color: GameTheme.glowCyan));
    }

    if (_error != null) {
      return Center(
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
                style: TextStyle(fontSize: 14, color: GameTheme.textSecondary),
                textAlign: TextAlign.center,
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: _loadPickData,
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
              style: ElevatedButton.styleFrom(
                backgroundColor: GameTheme.glowCyan,
                foregroundColor: GameTheme.background,
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadPickData,
      color: GameTheme.glowCyan,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Round header with deadline
          _buildRoundHeader(),
          const SizedBox(height: 24),

          // Fixtures list
          _buildFixturesList(),
          const SizedBox(height: 16),

          if (_roundLockedOverride)
            _buildRoundLockedMessage()
          else if (!widget.round.isLocked)
            _buildFooterNote(),
        ],
      ),
    );
  }

  Widget _buildRoundHeader() {
    // The one formatter, shared with the dashboard card and the competition
    // screen. It was `DateFormat('EEE d MMM, HH:mm')` on a UTC DateTime with no
    // conversion, so this said "14:00" for the same deadline the dashboard
    // called "3pm" — an hour out through BST, and 24-hour where the rest of the
    // app speaks kickoffs as "3pm".
    final deadline = formatShort(widget.round.lockTime);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: GameTheme.cardBackground,
        borderRadius: BorderRadius.zero,
        border: Border.all(color: GameTheme.border),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Round ${widget.round.roundNumber}',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: GameTheme.textPrimary,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                // "Matches", not "fixtures" — design-system.md §9: fixtures is
                // the organiser's word for the same thing.
                '${widget.round.fixtureCount} matches',
                style: TextStyle(
                  fontSize: 14,
                  color: GameTheme.textSecondary,
                ),
              ),
            ],
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                'Deadline',
                style: TextStyle(
                  fontSize: 12,
                  color: GameTheme.textSecondary,
                ),
              ),
              Text(
                deadline,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: GameTheme.glowCyan,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildFixturesList() {
    return Container(
      decoration: BoxDecoration(
        color: GameTheme.cardBackground,
        borderRadius: BorderRadius.zero,
        border: Border.all(color: GameTheme.border),
      ),
      child: ListView.separated(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        itemCount: _fixtures.length,
        separatorBuilder: (context, index) => Divider(height: 32, color: GameTheme.border),
        itemBuilder: (context, index) {
          final fixture = _fixtures[index];
          return _buildFixtureRow(fixture);
        },
      ),
    );
  }

  Widget _buildFixtureRow(Fixture fixture) {
    return Row(
      children: [
        // Home team
        Expanded(
          child: _buildTeamCard(
            teamShort: fixture.homeTeamShort,
            teamFull: fixture.homeTeam,
            fixtureId: fixture.id,
            position: 'home',
          ),
        ),
        // VS separator
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8),
          child: Text(
            'VS',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: GameTheme.textMuted,
            ),
          ),
        ),
        // Away team
        Expanded(
          child: _buildTeamCard(
            teamShort: fixture.awayTeamShort,
            teamFull: fixture.awayTeam,
            fixtureId: fixture.id,
            position: 'away',
          ),
        ),
      ],
    );
  }

  Widget _buildTeamCard({
    required String teamShort,
    required String teamFull,
    required int fixtureId,
    required String position,
  }) {
    final isAllowed = _allowedTeamShorts.contains(teamShort);
    final isCurrentPick = _currentPick == teamShort;
    final isSubmittingThis = _submittingTeam == teamShort;

    // Having a pick no longer disables every other team. Changing your mind is
    // one tap, the way choosing was — the old "remove your pick first" step was
    // friction set-pick never required, since it takes a change directly.
    final roundIsLocked = widget.round.isLocked || _roundLockedOverride;
    // The team you picked is never "unavailable", even though it leaves
    // allowed_teams the moment you pick it — that is set-pick enforcing
    // no_team_twice, and it made your own choice render in the same grey as a
    // team you already used in an earlier round.
    final isDisabled = (!isAllowed && !isCurrentPick) || roundIsLocked;

    return GestureDetector(
      onTap: (isDisabled || _isSubmitting)
          ? null
          : () => _pickTeam(teamShort, fixtureId, position),
      child: Stack(
        children: [
          Container(
            constraints: const BoxConstraints(minHeight: 80),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: isDisabled
                  ? GameTheme.backgroundLight
                  : GameTheme.cardBackground,
              border: Border.all(
                color: isCurrentPick ? GameTheme.glowCyan : GameTheme.border,
                width: isCurrentPick ? 2 : 1,
              ),
              borderRadius: BorderRadius.zero,
            ),
            child: Center(
              child: isSubmittingThis
                  ? SizedBox(
                      height: 18,
                      width: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: GameTheme.glowCyan,
                      ),
                    )
                  : Text(
                      teamFull,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: isDisabled
                            ? GameTheme.textMuted
                            : GameTheme.textPrimary,
                      ),
                      textAlign: TextAlign.center,
                    ),
            ),
          ),
          // Current pick badge
          if (isCurrentPick)
            Positioned(
              top: -4,
              left: -4,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: GameTheme.glowCyan,
                  borderRadius: BorderRadius.zero,
                ),
                child: Text(
                  'PICK',
                  style: TextStyle(
                    color: GameTheme.background,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  /// One line, and it is the only rule a player needs at the moment of picking.
  ///
  /// It replaces a titled card of three bullets. "Tap a team to select" narrated
  /// the thing they are already doing, "confirm your selection" described a step
  /// that no longer exists, and the title asked a question nobody had.
  ///
  /// **It does not say what losing costs.** The old line — "draws and losses
  /// eliminate you" — is untrue for anyone holding a life, which is most players
  /// in most competitions. What survives is the part that is true for everyone.
  Widget _buildFooterNote() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 4),
      child: Text(
        _currentPick == null
            ? 'Your team must win to advance.'
            : 'Your team must win to advance. Tap another team to change your pick.',
        style: TextStyle(
          fontSize: 14,
          color: GameTheme.textSecondary,
          height: 1.5,
        ),
        textAlign: TextAlign.center,
      ),
    );
  }

  Widget _buildRoundLockedMessage() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: GameTheme.cardBackground,
        border: Border.all(color: GameTheme.border),
        borderRadius: BorderRadius.zero,
      ),
      child: Column(
        children: [
          Icon(
            Icons.lock_outline,
            size: 48,
            color: GameTheme.textMuted,
          ),
          const SizedBox(height: 16),
          Text(
            'Round is now locked',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: GameTheme.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}
