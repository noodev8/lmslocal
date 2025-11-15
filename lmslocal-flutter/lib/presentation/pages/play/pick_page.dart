import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:lmslocal_flutter/core/constants/app_constants.dart';
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
            SnackBar(
              content: Text(
                roundLocked
                    ? 'You were the last player to pick! Round is now locked. Tap "Home" or "Standings" to see results.'
                    : 'Pick saved successfully!',
              ),
              backgroundColor: AppConstants.successGreen,
              duration: roundLocked
                  ? const Duration(seconds: 5)
                  : const Duration(seconds: 2),
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
            backgroundColor: AppConstants.errorRed,
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
              backgroundColor: AppConstants.successGreen,
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
            backgroundColor: AppConstants.errorRed,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 64, color: Colors.grey[400]),
            const SizedBox(height: 16),
            Text(
              'Failed to load',
              style: TextStyle(fontSize: 18, color: Colors.grey[700]),
            ),
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32),
              child: Text(
                _error!,
                style: TextStyle(fontSize: 14, color: Colors.grey[600]),
                textAlign: TextAlign.center,
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: _loadPickData,
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
      onRefresh: _loadPickData,
      color: AppConstants.primaryNavy,
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
        color: AppConstants.primaryNavy.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Round ${widget.round.roundNumber}',
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: AppConstants.primaryNavy,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '${widget.round.fixtureCount} fixtures',
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.grey[600],
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
                  color: Colors.grey[600],
                ),
              ),
              Text(
                deadline,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: AppConstants.primaryNavy,
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
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: ListView.separated(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        itemCount: _fixtures.length,
        separatorBuilder: (context, index) => const Divider(height: 32),
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
              color: Colors.grey[600],
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
                  ? Colors.grey[300]
                  : (isSelected || isCurrentPick)
                      ? Colors.blue[50]
                      : Colors.white,
              border: Border.all(
                color: (isSelected || isCurrentPick)
                    ? Colors.blue
                    : isDisabled
                        ? Colors.grey[400]!
                        : Colors.grey[300]!,
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
                  color: isDisabled ? Colors.grey[400] : Colors.black,
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
                  color: AppConstants.primaryNavy,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Text(
                  'PICK',
                  style: TextStyle(
                    color: Colors.white,
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
        color: AppConstants.successGreen.withValues(alpha: 0.1),
        border: Border.all(
          color: AppConstants.successGreen.withValues(alpha: 0.3),
        ),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Text(
            'Confirm your pick: ${_getFullTeamName(_selectedTeam!.teamShort)}',
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: AppConstants.successGreen,
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
                    backgroundColor: AppConstants.primaryNavy,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  child: _isSubmitting
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
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
        color: Colors.grey[100],
        border: Border.all(color: Colors.grey[300]!),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Text(
            'Current Pick: ${_getFullTeamName(_currentPick!)}',
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            'Want to change your pick? Remove it first to select a different team.',
            style: TextStyle(
              fontSize: 14,
              color: Colors.grey[700],
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: _isSubmitting ? null : _removePick,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppConstants.primaryNavy,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 32),
            ),
            child: _isSubmitting
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
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
        color: Colors.grey[100],
        border: Border.all(color: Colors.grey[300]!),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          const Text(
            '💡 How to make your pick',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            '• Tap on any available team to select them\n'
            '• Confirm your selection before the round locks\n'
            '• Your team must WIN to advance - draws and losses eliminate you',
            style: TextStyle(
              fontSize: 14,
              color: Colors.grey[700],
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
        color: AppConstants.primaryNavy.withValues(alpha: 0.05),
        border: Border.all(
          color: AppConstants.primaryNavy.withValues(alpha: 0.2),
        ),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Icon(
            Icons.lock_outline,
            size: 48,
            color: AppConstants.primaryNavy,
          ),
          const SizedBox(height: 16),
          const Text(
            'Round is now locked',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: AppConstants.primaryNavy,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'All players have made their picks.\nNavigate to "Home" or "Standings" to see results.',
            style: TextStyle(
              fontSize: 14,
              color: Colors.grey[700],
              height: 1.5,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
