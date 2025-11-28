import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
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

  // Selected team (before confirmation)
  ({String teamShort, int fixtureId, String position})? _selectedTeam;

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

  void _handleTeamSelect(String teamShort, int fixtureId, String position) {
    // Can't select if round is locked
    final isLocked = widget.round.isLocked || _roundLockedOverride;
    if (isLocked) return;

    // User must remove current pick first
    if (_currentPick != null) return;

    // Only allow selection if team is in allowed list
    if (_allowedTeamShorts.contains(teamShort)) {
      setState(() {
        _selectedTeam = (
          teamShort: teamShort,
          fixtureId: fixtureId,
          position: position
        );
      });
    }
  }

  Future<void> _submitPick() async {
    if (_selectedTeam == null || _isSubmitting) return;

    setState(() => _isSubmitting = true);

    try {
      final roundLocked = await _pickDataSource.setPick(
        _selectedTeam!.fixtureId,
        _selectedTeam!.position,
      );

      if (mounted) {
        // Clear dashboard cache so it reloads with fresh data
        await _clearDashboardCache();

        // Reload data to reflect new pick
        await _loadPickData();

        setState(() {
          _selectedTeam = null;
          _isSubmitting = false;
        });

        // If round locked, clear caches before showing message
        if (roundLocked) {
          await _clearPickStatisticsCache();
        }

        // Show success message
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Pick saved successfully!'),
              backgroundColor: GameTheme.accentGreen,
              duration: Duration(seconds: 2),
            ),
          );
        }

        // If round locked, update state to reflect locked round
        if (roundLocked && mounted) {
          setState(() {
            _roundLockedOverride = true;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSubmitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to submit pick: ${e.toString()}'),
            backgroundColor: GameTheme.accentRed,
          ),
        );
      }
    }
  }

  Future<void> _removePick() async {
    if (_isSubmitting) return;

    setState(() => _isSubmitting = true);

    try {
      await _pickDataSource.unselectPick(widget.round.id);

      if (mounted) {
        // Clear dashboard cache so it reloads with fresh data
        await _clearDashboardCache();

        // Reload data to reflect removed pick
        await _loadPickData();

        setState(() => _isSubmitting = false);

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Pick removed successfully!'),
              backgroundColor: GameTheme.accentGreen,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSubmitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to remove pick: ${e.toString()}'),
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

          // Confirmation banner or remove pick card or help
          if (_selectedTeam != null && !widget.round.isLocked && !_roundLockedOverride)
            _buildConfirmationBanner()
          else if (_currentPick != null && !widget.round.isLocked && !_roundLockedOverride)
            _buildRemovePickCard()
          else if (!widget.round.isLocked && !_roundLockedOverride && _currentPick == null)
            _buildHelpSection()
          else if (_roundLockedOverride)
            _buildRoundLockedMessage(),
        ],
      ),
    );
  }

  Widget _buildRoundHeader() {
    final formatter = DateFormat('EEE d MMM, HH:mm');
    final deadline = formatter.format(widget.round.lockTime);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: GameTheme.cardBackground,
        borderRadius: BorderRadius.circular(12),
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
                '${widget.round.fixtureCount} fixtures',
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
        borderRadius: BorderRadius.circular(16),
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
    final isSelected = _selectedTeam?.teamShort == teamShort;
    final isCurrentPick = _currentPick == teamShort;

    // Disable teams if:
    // 1. Team not in allowed list
    // 2. There's already a current pick (user must remove it first)
    // 3. Round is locked
    final roundIsLocked = widget.round.isLocked || _roundLockedOverride;
    final isDisabled =
        !isAllowed || (_currentPick != null && !isCurrentPick) || roundIsLocked;

    return GestureDetector(
      onTap: isDisabled
          ? null
          : () => _handleTeamSelect(teamShort, fixtureId, position),
      child: Stack(
        children: [
          Container(
            constraints: const BoxConstraints(minHeight: 80),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: isDisabled
                  ? GameTheme.backgroundLight
                  : (isSelected || isCurrentPick)
                      ? GameTheme.glowCyan.withValues(alpha: 0.15)
                      : GameTheme.cardBackground,
              border: Border.all(
                color: (isSelected || isCurrentPick)
                    ? GameTheme.glowCyan
                    : isDisabled
                        ? GameTheme.border
                        : GameTheme.border,
                width: (isSelected || isCurrentPick) ? 2 : 1,
              ),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Center(
              child: Text(
                teamFull,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: isDisabled ? GameTheme.textMuted : GameTheme.textPrimary,
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
                  borderRadius: BorderRadius.circular(12),
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

  Widget _buildConfirmationBanner() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: GameTheme.accentGreen.withValues(alpha: 0.15),
        border: Border.all(
          color: GameTheme.accentGreen.withValues(alpha: 0.3),
        ),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Text(
            'Confirm your pick: ${_getFullTeamName(_selectedTeam!.teamShort)}',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: GameTheme.accentGreen,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: ElevatedButton(
                  onPressed: _isSubmitting ? null : _submitPick,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: GameTheme.accentGreen,
                    foregroundColor: GameTheme.background,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  child: _isSubmitting
                      ? SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: GameTheme.background,
                          ),
                        )
                      : const Text('Confirm Pick'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton(
                  onPressed: _isSubmitting
                      ? null
                      : () => setState(() => _selectedTeam = null),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: GameTheme.textSecondary,
                    side: BorderSide(color: GameTheme.border),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  child: const Text('Cancel'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildRemovePickCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: GameTheme.cardBackground,
        border: Border.all(color: GameTheme.border),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Text(
            'Current Pick: ${_getFullTeamName(_currentPick!)}',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: GameTheme.textPrimary,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            'Want to change your pick? Remove it first to select a different team.',
            style: TextStyle(
              fontSize: 14,
              color: GameTheme.textSecondary,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: _isSubmitting ? null : _removePick,
            style: ElevatedButton.styleFrom(
              backgroundColor: GameTheme.glowCyan,
              foregroundColor: GameTheme.background,
              padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 32),
            ),
            child: _isSubmitting
                ? SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: GameTheme.background,
                    ),
                  )
                : const Text('Remove Pick'),
          ),
        ],
      ),
    );
  }

  Widget _buildHelpSection() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: GameTheme.cardBackground,
        border: Border.all(color: GameTheme.border),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Text(
            'How to make your pick',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: GameTheme.textPrimary,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            '• Tap on any available team to select them\n'
            '• Confirm your selection before the round locks\n'
            '• Your team must WIN to advance - draws and losses eliminate you',
            style: TextStyle(
              fontSize: 14,
              color: GameTheme.textSecondary,
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRoundLockedMessage() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: GameTheme.cardBackground,
        border: Border.all(color: GameTheme.border),
        borderRadius: BorderRadius.circular(12),
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
