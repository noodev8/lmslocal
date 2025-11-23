import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:lmslocal_flutter/core/constants/app_constants.dart';
import 'package:lmslocal_flutter/core/theme/game_theme.dart';
import 'package:lmslocal_flutter/domain/entities/standings_group.dart';
import 'package:lmslocal_flutter/domain/entities/standings_player.dart';
import 'package:lmslocal_flutter/domain/entities/round_history.dart';
import 'package:lmslocal_flutter/domain/entities/user.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/standings_remote_data_source.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/api_client.dart';
import 'package:lmslocal_flutter/presentation/bloc/auth/auth_bloc.dart';
import 'package:lmslocal_flutter/presentation/bloc/auth/auth_state.dart';

/// Standings page - shows player standings grouped by status
class StandingsPage extends StatefulWidget {
  final String competitionId;
  final String competitionName;
  final String? playerDisplayName;

  const StandingsPage({
    super.key,
    required this.competitionId,
    this.competitionName = '',
    this.playerDisplayName,
  });

  @override
  State<StandingsPage> createState() => _StandingsPageState();
}

class _StandingsPageState extends State<StandingsPage> {
  late StandingsRemoteDataSource _dataSource;

  String _roundState = '';
  int _currentRound = 0;
  List<StandingsGroup> _groups = [];
  bool _isLoading = true;
  String? _errorMessage;

  // Expansion and player state
  final Map<String, bool> _expandedGroups = {};
  final Map<String, List<StandingsPlayer>> _groupPlayers = {};
  final Map<String, bool> _groupLoading = {};
  final Map<String, int> _groupCurrentPage = {};
  final Map<String, int> _groupTotalPages = {};

  // Current user
  User? _currentUser;

  @override
  void initState() {
    super.initState();
    final apiClient = context.read<ApiClient>();
    _dataSource = StandingsRemoteDataSource(apiClient: apiClient);
    _loadCurrentUser();
    _loadStandingsSummary();
  }

  void _loadCurrentUser() {
    final authState = context.read<AuthBloc>().state;
    if (authState is AuthAuthenticated) {
      setState(() {
        _currentUser = authState.user;
      });
    }
  }

  Future<void> _loadStandingsSummary() async {
    if (!mounted) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final response = await _dataSource.getStandingsSummary(
        int.parse(widget.competitionId),
      );

      if (!mounted) return;

      setState(() {
        _roundState = response.roundState;
        _currentRound = response.currentRound;
        _groups = response.groups;
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

  Future<void> _loadGroupPlayers(String groupKey, {bool append = false}) async {
    if (!mounted) return;

    setState(() {
      _groupLoading[groupKey] = true;
    });

    try {
      final page = append ? (_groupCurrentPage[groupKey] ?? 0) + 1 : 1;

      final response = await _dataSource.getStandingsGroup(
        competitionId: int.parse(widget.competitionId),
        groupKey: groupKey,
        page: page,
        pageSize: 20,
      );

      if (!mounted) return;

      setState(() {
        if (append) {
          _groupPlayers[groupKey] = [
            ...(_groupPlayers[groupKey] ?? []),
            ...response.players,
          ];
        } else {
          _groupPlayers[groupKey] = response.players;
        }
        _groupCurrentPage[groupKey] = response.currentPage;
        _groupTotalPages[groupKey] = response.totalPages;
        _groupLoading[groupKey] = false;
      });
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _groupLoading[groupKey] = false;
      });
    }
  }

  void _toggleGroup(String groupKey) {
    final isCurrentlyExpanded = _expandedGroups[groupKey] ?? false;

    if (!isCurrentlyExpanded) {
      // Expanding - load players if not already loaded
      setState(() {
        _expandedGroups[groupKey] = true;
      });

      if (_groupPlayers[groupKey] == null) {
        _loadGroupPlayers(groupKey);
      }
    } else {
      // Collapsing
      setState(() {
        _expandedGroups[groupKey] = false;
      });
    }
  }

  void _loadMorePlayers(String groupKey) {
    final currentPage = _groupCurrentPage[groupKey] ?? 0;
    final totalPages = _groupTotalPages[groupKey] ?? 0;

    if (currentPage < totalPages) {
      _loadGroupPlayers(groupKey, append: true);
    }
  }

  void _showHistoryModal(StandingsPlayer player) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _buildHistoryModal(player),
    );
  }

  void _showSearchModal() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _PlayerSearchModal(
        competitionId: widget.competitionId,
        dataSource: _dataSource,
        currentUserId: _currentUser?.id,
        onPlayerSelected: (player) {
          Navigator.pop(context); // Close search modal
          Future.delayed(const Duration(milliseconds: 100), () {
            _showHistoryModal(player);
          });
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: GameTheme.background,
      body: _buildBody(),
      floatingActionButton: FloatingActionButton(
        onPressed: _showSearchModal,
        backgroundColor: GameTheme.glowCyan,
        child: Icon(Icons.search, color: GameTheme.background),
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircularProgressIndicator(color: GameTheme.glowCyan),
            const SizedBox(height: 16),
            Text(
              'Loading Standings',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: GameTheme.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Getting the latest results...',
              style: TextStyle(
                fontSize: 14,
                color: GameTheme.textMuted,
              ),
            ),
          ],
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
                color: GameTheme.accentRed,
              ),
              const SizedBox(height: 16),
              Text(
                'Failed to load standings',
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
                onPressed: _loadStandingsSummary,
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
      );
    }

    return RefreshIndicator(
      onRefresh: _loadStandingsSummary,
      color: GameTheme.glowCyan,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(AppConstants.paddingMedium),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // My History Button - Prominent one-click access
            if (_currentUser != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Container(
                  decoration: BoxDecoration(
                    color: GameTheme.cardBackground,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: GameTheme.border),
                  ),
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: () {
                        // Use competition display name if available, fallback to account name
                        final currentUserPlayer = StandingsPlayer(
                          id: _currentUser!.id,
                          displayName: widget.playerDisplayName ?? _currentUser!.displayName,
                          livesRemaining: 0,
                          status: 'unknown',
                        );
                        _showHistoryModal(currentUserPlayer);
                      },
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        padding: const EdgeInsets.all(20),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.history,
                              size: 24,
                              color: GameTheme.glowCyan,
                            ),
                            const SizedBox(width: 12),
                            Text(
                              'View My Pick History',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                                color: GameTheme.textPrimary,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),

            // Groups
            if (_groups.isEmpty)
              Center(
                child: Padding(
                  padding: const EdgeInsets.all(48),
                  child: Column(
                    children: [
                      Icon(
                        Icons.people_outline,
                        size: 64,
                        color: GameTheme.textMuted,
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'No players yet',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                          color: GameTheme.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Players will appear here once the competition starts',
                        style: TextStyle(
                          fontSize: 14,
                          color: GameTheme.textMuted,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              )
            else
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _groups.length,
                separatorBuilder: (context, index) =>
                    const SizedBox(height: 12),
                itemBuilder: (context, index) {
                  return _buildGroupCard(_groups[index], index);
                },
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildGroupCard(StandingsGroup group, int index) {
    // Determine styling based on group position and type
    final isTopGroup = index == 0 && group.key != 'eliminated';
    final isBottomGroup = group.key == 'eliminated';

    // Calculate if this is a winner (exactly 1 active player total)
    final totalActivePlayers = _groups
        .where((g) => g.key != 'eliminated')
        .fold(0, (sum, g) => sum + g.count);
    final isWinner = isTopGroup && totalActivePlayers == 1;

    // Danger zone: 0 lives, game not played, during active round
    final isDangerZone = !isWinner &&
        _roundState == 'ACTIVE' &&
        group.lives == 0 &&
        group.fixtureStatus != 'played' &&
        index > 0;

    // Determine colors - dark theme
    Color borderColor;
    Color backgroundColor;
    Color badgeColor;
    Color badgeTextColor;

    if (isWinner) {
      borderColor = GameTheme.glowCyan;
      backgroundColor = GameTheme.glowCyan.withValues(alpha: 0.1);
      badgeColor = GameTheme.glowCyan;
      badgeTextColor = GameTheme.background;
    } else if (isTopGroup) {
      borderColor = GameTheme.accentGreen;
      backgroundColor = GameTheme.accentGreen.withValues(alpha: 0.1);
      badgeColor = GameTheme.accentGreen;
      badgeTextColor = GameTheme.background;
    } else if (isDangerZone) {
      borderColor = GameTheme.accentRed.withValues(alpha: 0.5);
      backgroundColor = GameTheme.cardBackground;
      badgeColor = GameTheme.accentRed;
      badgeTextColor = Colors.white;
    } else if (isBottomGroup) {
      borderColor = GameTheme.border;
      backgroundColor = GameTheme.backgroundLight;
      badgeColor = GameTheme.textSecondary;
      badgeTextColor = GameTheme.background;
    } else {
      borderColor = GameTheme.border;
      backgroundColor = GameTheme.cardBackground;
      badgeColor = GameTheme.glowCyan;
      badgeTextColor = GameTheme.background;
    }

    return Container(
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: borderColor,
          width: isWinner ? 2 : 1,
        ),
        boxShadow: (isWinner || isTopGroup)
            ? [
                BoxShadow(
                  color: borderColor.withValues(alpha: 0.3),
                  blurRadius: 8,
                  spreadRadius: 1,
                ),
              ]
            : null,
      ),
      child: Material(
        color: Colors.transparent,
        child: Column(
          children: [
            InkWell(
              onTap: () => _toggleGroup(group.key),
              borderRadius: BorderRadius.circular(12),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                // Player count badge or trophy
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: badgeColor,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Center(
                    child: isWinner
                        ? const Icon(
                            Icons.emoji_events,
                            color: Colors.white,
                            size: 24,
                          )
                        : Text(
                            group.count.toString(),
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: badgeTextColor,
                            ),
                          ),
                  ),
                ),
                const SizedBox(width: 12),

                // Group details
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Main label
                      Row(
                        children: [
                          if (isWinner) ...[
                            Text(
                              'Champion',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: GameTheme.glowCyan,
                              ),
                            ),
                            if (group.winnerName != null) ...[
                              const SizedBox(width: 8),
                              Text(
                                '•',
                                style: TextStyle(
                                  fontSize: 16,
                                  color: GameTheme.glowCyan,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  group.winnerName!,
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                    color: GameTheme.textPrimary,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ] else if (group.lives != null) ...[
                            Icon(
                              Icons.favorite,
                              size: 20,
                              color: GameTheme.accentRed,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              '${group.lives} ${group.lives == 1 ? 'Life' : 'Lives'}',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                                color: GameTheme.textPrimary,
                              ),
                            ),
                            if (group.fixtureStatus != null) ...[
                              const SizedBox(width: 8),
                              Text(
                                '•',
                                style: TextStyle(
                                  fontSize: 16,
                                  color: GameTheme.textMuted,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  group.fixtureStatus == 'played'
                                      ? 'Game Played'
                                      : group.fixtureStatus == 'pending'
                                          ? 'Game Pending'
                                          : 'No Pick',
                                  style: TextStyle(
                                    fontSize: 14,
                                    color: GameTheme.textSecondary,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ] else
                            Text(
                              'Eliminated',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                                color: GameTheme.textMuted,
                              ),
                            ),
                        ],
                      ),

                      // Show winner name on second line for single-player groups (not champions)
                      if (!isWinner && group.count == 1 && group.winnerName != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            group.winnerName!,
                            style: TextStyle(
                              fontSize: 14,
                              color: isTopGroup
                                  ? GameTheme.accentGreen
                                  : GameTheme.textMuted,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                    ],
                  ),
                ),

                // Chevron icon (rotates based on expansion)
                Icon(
                  _expandedGroups[group.key] == true
                      ? Icons.expand_more
                      : Icons.chevron_right,
                  color: GameTheme.textMuted,
                  size: 20,
                ),
              ],
            ),
          ),
        ),

            // Expandable player list
            if (_expandedGroups[group.key] == true)
              _buildPlayerList(group.key),
          ],
        ),
      ),
    );
  }

  Widget _buildPlayerList(String groupKey) {
    final isLoading = _groupLoading[groupKey] ?? false;
    final players = _groupPlayers[groupKey] ?? [];
    final currentPage = _groupCurrentPage[groupKey] ?? 0;
    final totalPages = _groupTotalPages[groupKey] ?? 0;
    final hasMorePages = currentPage < totalPages;

    if (isLoading && players.isEmpty) {
      // Initial loading
      return Padding(
        padding: const EdgeInsets.all(24),
        child: Center(
          child: CircularProgressIndicator(
            color: GameTheme.glowCyan,
          ),
        ),
      );
    }

    if (players.isEmpty) {
      return Padding(
        padding: const EdgeInsets.all(24),
        child: Center(
          child: Text(
            'No players in this group',
            style: TextStyle(
              fontSize: 14,
              color: GameTheme.textMuted,
            ),
          ),
        ),
      );
    }

    return Column(
      children: [
        // Divider
        Divider(
          height: 1,
          thickness: 1,
          color: GameTheme.border,
        ),

        // Player list
        ListView.separated(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(
            horizontal: 16,
            vertical: 8,
          ),
          itemCount: players.length,
          separatorBuilder: (context, index) => Divider(
            height: 1,
            thickness: 1,
            color: GameTheme.border.withValues(alpha: 0.5),
          ),
          itemBuilder: (context, index) {
            return _buildPlayerCard(players[index]);
          },
        ),

        // Load more button
        if (hasMorePages)
          Padding(
            padding: const EdgeInsets.all(12),
            child: isLoading
                ? SizedBox(
                    height: 32,
                    width: 32,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: GameTheme.glowCyan,
                    ),
                  )
                : TextButton.icon(
                    onPressed: () => _loadMorePlayers(groupKey),
                    icon: const Icon(Icons.expand_more),
                    label: const Text('Load More'),
                    style: TextButton.styleFrom(
                      foregroundColor: GameTheme.glowCyan,
                    ),
                  ),
          ),
      ],
    );
  }

  Widget _buildPlayerCard(StandingsPlayer player) {
    return InkWell(
      onTap: () => _showHistoryModal(player),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Row(
          children: [
            // Lives indicator
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: player.livesRemaining > 0
                    ? GameTheme.glowCyan.withValues(alpha: 0.15)
                    : GameTheme.backgroundLight,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Center(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.favorite,
                      size: 14,
                      color: player.livesRemaining > 0
                          ? GameTheme.accentRed
                          : GameTheme.textMuted,
                    ),
                    const SizedBox(width: 2),
                    Text(
                      player.livesRemaining.toString(),
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: player.livesRemaining > 0
                            ? GameTheme.textPrimary
                            : GameTheme.textMuted,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 12),

            // Player info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Player name
                  Text(
                    player.displayName,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: player.status == 'eliminated'
                          ? GameTheme.textMuted
                          : GameTheme.textPrimary,
                    ),
                  ),

                  // Current pick or elimination info
                  if (player.currentPick != null) ...[
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Icon(
                          player.currentPick!.outcome == 'won'
                              ? Icons.check_circle
                              : player.currentPick!.outcome == 'lost'
                                  ? Icons.cancel
                                  : Icons.schedule,
                          size: 14,
                          color: player.currentPick!.outcome == 'won'
                              ? GameTheme.accentGreen
                              : player.currentPick!.outcome == 'lost'
                                  ? GameTheme.accentRed
                                  : GameTheme.textPrimary.withValues(alpha: 0.6),
                        ),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            player.currentPick!.team,
                            style: TextStyle(
                              fontSize: 13,
                              color: GameTheme.textPrimary.withValues(alpha: 0.8),
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ] else if (player.eliminationPick != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      'Out: Round ${player.eliminationPick!.roundNumber}',
                      style: TextStyle(
                        fontSize: 13,
                        color: GameTheme.textPrimary.withValues(alpha: 0.6),
                      ),
                    ),
                  ],
                ],
              ),
            ),

            // Chevron
            Icon(
              Icons.chevron_right,
              size: 20,
              color: GameTheme.textPrimary.withValues(alpha: 0.5),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHistoryModal(StandingsPlayer player) {
    return _PlayerHistoryModal(
      player: player,
      competitionId: widget.competitionId,
      dataSource: _dataSource,
      currentUserId: _currentUser?.id,
      currentRound: _currentRound,
      roundState: _roundState,
    );
  }
}

/// Player history modal widget
class _PlayerHistoryModal extends StatefulWidget {
  final StandingsPlayer player;
  final String competitionId;
  final StandingsRemoteDataSource dataSource;
  final int? currentUserId;
  final int currentRound;
  final String roundState;

  const _PlayerHistoryModal({
    required this.player,
    required this.competitionId,
    required this.dataSource,
    this.currentUserId,
    required this.currentRound,
    required this.roundState,
  });

  @override
  State<_PlayerHistoryModal> createState() => _PlayerHistoryModalState();
}

class _PlayerHistoryModalState extends State<_PlayerHistoryModal> {
  List<RoundHistory> _history = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  /// Filter history to hide current round pick if not locked and not viewing own history
  List<RoundHistory> get _filteredHistory {
    final isViewingOwnHistory = widget.currentUserId == widget.player.id;

    // If viewing own history, show everything
    if (isViewingOwnHistory) {
      return _history;
    }

    // Filter out current round if it's not locked yet
    return _history.where((round) {
      // Always show past rounds
      if (round.roundNumber < widget.currentRound) {
        return true;
      }

      // For current round, check if it's locked (by checking lock time has passed)
      if (round.roundNumber == widget.currentRound) {
        final lockTime = DateTime.tryParse(round.lockTime);
        if (lockTime != null) {
          final now = DateTime.now();
          final isLocked = now.isAfter(lockTime) || now.isAtSameMomentAs(lockTime);
          return isLocked; // Only show if locked
        }
        return false; // Hide if can't parse lock time
      }

      // Show future rounds (shouldn't exist, but just in case)
      return true;
    }).toList();
  }

  Future<void> _loadHistory() async {
    try {
      final response = await widget.dataSource.getPlayerHistory(
        competitionId: int.parse(widget.competitionId),
        playerId: widget.player.id,
      );

      if (mounted) {
        setState(() {
          _history = response.history;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _history = [];
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.7,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      builder: (context, scrollController) {
        return Container(
          decoration: BoxDecoration(
            color: GameTheme.background,
            borderRadius: const BorderRadius.only(
              topLeft: Radius.circular(20),
              topRight: Radius.circular(20),
            ),
          ),
          child: Column(
            children: [
              // Handle bar
              Container(
                margin: const EdgeInsets.only(top: 12, bottom: 8),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: GameTheme.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),

              // Header
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: GameTheme.cardBackground,
                  border: Border(
                    bottom: BorderSide(color: GameTheme.border),
                  ),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            widget.player.displayName,
                            style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              color: GameTheme.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Complete Pick History',
                            style: TextStyle(
                              fontSize: 14,
                              color: GameTheme.textMuted,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.pop(context),
                      icon: Icon(
                        Icons.close,
                        color: GameTheme.textMuted,
                      ),
                    ),
                  ],
                ),
              ),

              // Content
              Expanded(
                child: _isLoading
                    ? Center(
                        child: CircularProgressIndicator(
                          color: GameTheme.glowCyan,
                        ),
                      )
                    : _filteredHistory.isEmpty
                        ? Center(
                            child: Padding(
                              padding: const EdgeInsets.all(32),
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(
                                    Icons.history,
                                    size: 64,
                                    color: GameTheme.textMuted,
                                  ),
                                  const SizedBox(height: 16),
                                  Text(
                                    'No history available',
                                    style: TextStyle(
                                      fontSize: 16,
                                      color: GameTheme.textMuted,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          )
                        : ListView.separated(
                            controller: scrollController,
                            padding: const EdgeInsets.all(16),
                            itemCount: _filteredHistory.length,
                            separatorBuilder: (context, index) =>
                                const SizedBox(height: 8),
                            itemBuilder: (context, index) {
                              final history = _filteredHistory[index];
                              return _buildHistoryCard(history);
                            },
                          ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildHistoryCard(RoundHistory history) {
    Color borderColor;
    Color backgroundColor;
    Color iconColor;
    IconData resultIcon;
    String resultText;

    switch (history.pickResult.toLowerCase()) {
      case 'win':
        borderColor = GameTheme.accentGreen;
        backgroundColor = GameTheme.accentGreen.withValues(alpha: 0.15);
        iconColor = GameTheme.accentGreen;
        resultIcon = Icons.check_circle;
        resultText = 'WIN';
        break;
      case 'loss':
        borderColor = GameTheme.accentRed;
        backgroundColor = GameTheme.accentRed.withValues(alpha: 0.15);
        iconColor = GameTheme.accentRed;
        resultIcon = Icons.cancel;
        resultText = 'LOSE';
        break;
      case 'pending':
      default:
        borderColor = GameTheme.border;
        backgroundColor = GameTheme.cardBackground;
        iconColor = GameTheme.textMuted;
        resultIcon = Icons.schedule;
        resultText = 'PENDING';
        break;
    }

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(12),
        border: Border(
          left: BorderSide(
            color: borderColor,
            width: 4,
          ),
        ),
      ),
      child: Row(
        children: [
          // Round number badge
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: GameTheme.backgroundLight,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(
                color: GameTheme.border,
              ),
            ),
            child: Center(
              child: Text(
                'R${history.roundNumber}',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: GameTheme.textSecondary,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),

          // Pick details
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  history.pickTeamFullName.isNotEmpty
                      ? history.pickTeamFullName
                      : history.pickTeam.isNotEmpty
                          ? history.pickTeam
                          : 'No Pick',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: GameTheme.textPrimary,
                  ),
                ),
                if (history.fixture != null && history.fixture!.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      history.fixture!,
                      style: TextStyle(
                        fontSize: 13,
                        color: GameTheme.textSecondary,
                      ),
                    ),
                  ),
              ],
            ),
          ),

          // Result badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: iconColor,
              borderRadius: BorderRadius.circular(6),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  resultIcon,
                  size: 16,
                  color: GameTheme.background,
                ),
                const SizedBox(width: 4),
                Text(
                  resultText,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: GameTheme.background,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Player search modal widget
class _PlayerSearchModal extends StatefulWidget {
  final String competitionId;
  final StandingsRemoteDataSource dataSource;
  final int? currentUserId;
  final Function(StandingsPlayer) onPlayerSelected;

  const _PlayerSearchModal({
    required this.competitionId,
    required this.dataSource,
    this.currentUserId,
    required this.onPlayerSelected,
  });

  @override
  State<_PlayerSearchModal> createState() => _PlayerSearchModalState();
}

class _PlayerSearchModalState extends State<_PlayerSearchModal> {
  final TextEditingController _searchController = TextEditingController();
  List<StandingsPlayer> _results = [];
  int _totalResults = 0;
  bool _isLoading = false;
  bool _hasSearched = false;

  @override
  void initState() {
    super.initState();
    // Listen to text changes to update button state
    _searchController.addListener(() {
      setState(() {});
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _performSearch() async {
    final searchTerm = _searchController.text.trim();

    if (searchTerm.length < 2) {
      setState(() {
        _results = [];
        _totalResults = 0;
        _hasSearched = false;
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _hasSearched = true;
    });

    try {
      final response = await widget.dataSource.searchPlayers(
        competitionId: int.parse(widget.competitionId),
        searchTerm: searchTerm,
        limit: 20,
      );

      if (mounted) {
        setState(() {
          _totalResults = response.results.length;
          // Only show first 5 results
          _results = response.results.take(5).toList();
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _results = [];
          _totalResults = 0;
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.7,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      builder: (context, scrollController) {
        return Container(
          decoration: BoxDecoration(
            color: GameTheme.background,
            borderRadius: const BorderRadius.only(
              topLeft: Radius.circular(20),
              topRight: Radius.circular(20),
            ),
          ),
          child: Column(
            children: [
              // Handle bar
              Container(
                margin: const EdgeInsets.only(top: 12, bottom: 8),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: GameTheme.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),

              // Header
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: GameTheme.cardBackground,
                  border: Border(
                    bottom: BorderSide(color: GameTheme.border),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Search Players',
                                style: TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.bold,
                                  color: GameTheme.textPrimary,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'Search by name or email',
                                style: TextStyle(
                                  fontSize: 14,
                                  color: GameTheme.textMuted,
                                ),
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          onPressed: () => Navigator.pop(context),
                          icon: Icon(
                            Icons.close,
                            color: GameTheme.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              // Search input
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  border: Border(
                    bottom: BorderSide(color: GameTheme.border),
                  ),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _searchController,
                        autofocus: true,
                        style: TextStyle(color: GameTheme.textPrimary),
                        decoration: InputDecoration(
                          hintText: 'Enter name or email...',
                          hintStyle: TextStyle(color: GameTheme.textMuted),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: BorderSide(color: GameTheme.border),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: BorderSide(color: GameTheme.border),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: BorderSide(
                              color: GameTheme.glowCyan,
                              width: 2,
                            ),
                          ),
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 12,
                          ),
                        ),
                        onChanged: (value) {
                          // Reset search state when typing
                          if (_hasSearched) {
                            setState(() {
                              _hasSearched = false;
                              _results = [];
                              _totalResults = 0;
                            });
                          }
                        },
                        onSubmitted: (_) {
                          if (_searchController.text.trim().length >= 2) {
                            _performSearch();
                          }
                        },
                      ),
                    ),
                    const SizedBox(width: 8),
                    ElevatedButton(
                      onPressed: _searchController.text.trim().length >= 2 && !_isLoading
                          ? _performSearch
                          : null,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: GameTheme.glowCyan,
                        foregroundColor: GameTheme.background,
                        disabledBackgroundColor: GameTheme.border,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 20,
                          vertical: 12,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                      ),
                      child: _isLoading
                          ? SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: GameTheme.background,
                              ),
                            )
                          : const Icon(Icons.search, size: 20),
                    ),
                  ],
                ),
              ),

              // Results
              Expanded(
                child: _buildResults(scrollController),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildResults(ScrollController scrollController) {
    // Too many results - ask to refine
    if (_totalResults > 5) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: GameTheme.glowCyan.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(32),
                ),
                child: Center(
                  child: Text(
                    _totalResults.toString(),
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: GameTheme.glowCyan,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                '$_totalResults players found',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                  color: GameTheme.textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Please refine your search to see details',
                style: TextStyle(
                  fontSize: 14,
                  color: GameTheme.textMuted,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }

    // Show results
    if (_results.isNotEmpty) {
      return ListView.separated(
        controller: scrollController,
        padding: const EdgeInsets.all(16),
        itemCount: _results.length,
        separatorBuilder: (context, index) => Divider(
          height: 1,
          thickness: 1,
          color: GameTheme.border.withValues(alpha: 0.5),
        ),
        itemBuilder: (context, index) {
          final player = _results[index];
          final isYou = widget.currentUserId == player.id;

          return InkWell(
            onTap: () => widget.onPlayerSelected(player),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Flexible(
                              child: Text(
                                player.displayName,
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w600,
                                  color: GameTheme.textPrimary,
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            if (isYou) ...[
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 2,
                                ),
                                decoration: BoxDecoration(
                                  color: GameTheme.glowCyan,
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Text(
                                  'You',
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w600,
                                    color: GameTheme.background,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                        if (player.groupName != null) ...[
                          const SizedBox(height: 4),
                          Text(
                            player.groupName!,
                            style: TextStyle(
                              fontSize: 13,
                              color: GameTheme.textSecondary,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  Icon(
                    Icons.chevron_right,
                    size: 20,
                    color: GameTheme.textMuted,
                  ),
                ],
              ),
            ),
          );
        },
      );
    }

    // No results found
    if (_hasSearched && !_isLoading) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.search_off,
                size: 64,
                color: GameTheme.textMuted,
              ),
              const SizedBox(height: 16),
              Text(
                'No players found matching "${_searchController.text}"',
                style: TextStyle(
                  fontSize: 14,
                  color: GameTheme.textSecondary,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }

    // Initial state - prompt to search
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.search,
              size: 64,
              color: GameTheme.textMuted,
            ),
            const SizedBox(height: 16),
            Text(
              'Enter a name or email and click Search',
              style: TextStyle(
                fontSize: 14,
                color: GameTheme.textSecondary,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
