import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:lmslocal_flutter/core/config/app_config.dart';
import 'package:flutter/services.dart';
import 'package:lmslocal_flutter/core/constants/app_constants.dart';
import 'package:lmslocal_flutter/core/theme/game_theme.dart';
import 'package:lmslocal_flutter/core/errors/failures.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/api_client.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/dashboard_remote_data_source.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/user_remote_data_source.dart';
import 'package:lmslocal_flutter/domain/entities/competition.dart';
import 'package:lmslocal_flutter/domain/entities/promoted_competition.dart';
import 'package:lmslocal_flutter/presentation/bloc/auth/auth_bloc.dart';
import 'package:lmslocal_flutter/presentation/bloc/auth/auth_state.dart';
import 'package:lmslocal_flutter/presentation/widgets/update_required_dialog.dart';

/// Dashboard page - Home screen
/// Shows user's competitions with status, picks, and navigation
class DashboardPage extends StatefulWidget {
  final bool showAppBar;

  const DashboardPage({super.key, this.showAppBar = true});

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  late DashboardRemoteDataSource _dashboardDataSource;
  List<Competition> _competitions = [];
  List<PromotedCompetition> _promotedCompetitions = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _initializeDashboard();
  }

  Future<void> _initializeDashboard() async {
    // Initialize dashboard data source
    final apiClient = context.read<ApiClient>();
    final prefs = await SharedPreferences.getInstance();
    _dashboardDataSource = DashboardRemoteDataSource(
      apiClient: apiClient,
      prefs: prefs,
    );

    // Load dashboard data
    await _loadDashboard();
  }

  Future<void> _loadDashboard({bool forceRefresh = false}) async {
    if (!forceRefresh) {
      setState(() {
        _isLoading = true;
        _error = null;
      });
    }

    try {
      final dashboardData = await _dashboardDataSource.getUserDashboard(
        forceRefresh: forceRefresh,
      );

      if (mounted) {
        setState(() {
          _competitions = _sortCompetitions(dashboardData.competitions);
          _promotedCompetitions = dashboardData.promotedCompetitions;
          _isLoading = false;
          _error = null;
        });
      }
    } on UpdateRequiredException catch (e) {
      // App update is required - show blocking dialog
      if (mounted) {
        showDialog(
          context: context,
          barrierDismissible: false,
          builder: (context) => UpdateRequiredDialog(
            minimumVersion: e.minimumVersion,
            storeUrl: e.storeUrl,
          ),
        );
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

  /// Sort competitions by priority:
  /// 1. Needs pick (by lock time ASC - most urgent first)
  /// 2. Active, already picked
  /// 3. Organizer-only (not participating)
  /// 4. Eliminated (user is out)
  /// 5. Completed
  List<Competition> _sortCompetitions(List<Competition> competitions) {
    return List<Competition>.from(competitions)..sort((a, b) {
      final aPriority = _getCompetitionPriority(a);
      final bPriority = _getCompetitionPriority(b);

      if (aPriority != bPriority) {
        return aPriority.compareTo(bPriority);
      }

      // For same priority, sort by created_at DESC (newest first)
      return b.createdAt.compareTo(a.createdAt);
    });
  }

  /// Get sort priority for a competition (lower = higher priority)
  int _getCompetitionPriority(Competition comp) {
    // Completed competitions always last
    if (comp.status == 'COMPLETE') return 5;

    // User is eliminated
    if (comp.isParticipant && comp.userStatus == 'out') return 4;

    // Organizer-only (not participating)
    if (comp.isOrganiser && !comp.isParticipant) return 3;

    // Active and already picked
    if (comp.isParticipant && comp.userStatus == 'active' && !(comp.needsPick ?? false)) return 2;

    // Needs pick - highest priority
    if (comp.needsPick ?? false) return 1;

    // Default
    return 3;
  }

  Future<void> _onRefresh() async {
    await _loadDashboard(forceRefresh: true);
  }

  void _showJoinCompetitionDialog() {
    final TextEditingController codeController = TextEditingController();
    bool isLoading = false;
    String? errorMessage;

    showDialog(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          backgroundColor: const Color(0xFF2A3F5F),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: BorderSide(color: GameTheme.glowCyan.withValues(alpha: 0.3)),
          ),
          title: Row(
            children: [
              Icon(Icons.group_add_outlined, color: GameTheme.glowCyan),
              const SizedBox(width: 16),
              Text(
                'Join Competition',
                style: TextStyle(
                  color: GameTheme.textPrimary,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Enter the invite code shared by the competition organiser',
                style: TextStyle(fontSize: 14, color: GameTheme.textSecondary),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: codeController,
                style: TextStyle(
                  color: GameTheme.textPrimary,
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                ),
                decoration: InputDecoration(
                  labelText: 'Invite Code',
                  labelStyle: TextStyle(color: GameTheme.textSecondary),
                  hintText: 'ABC123',
                  hintStyle: TextStyle(color: GameTheme.textMuted),
                  filled: true,
                  fillColor: GameTheme.background,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: BorderSide(color: GameTheme.textMuted),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: BorderSide(color: GameTheme.textMuted),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: BorderSide(color: GameTheme.glowCyan, width: 2),
                  ),
                  errorText: errorMessage,
                  errorStyle: TextStyle(color: GameTheme.accentRed),
                ),
                textCapitalization: TextCapitalization.characters,
                enabled: !isLoading,
                autofocus: true,
                onChanged: (value) {
                  setState(() {
                    if (errorMessage != null) {
                      errorMessage = null;
                    }
                  });
                },
                onSubmitted: (value) {
                  if (value.trim().isNotEmpty && !isLoading) {
                    _handleJoinCompetition(
                      dialogContext,
                      codeController.text,
                      setState,
                      (loading) => isLoading = loading,
                      (error) => errorMessage = error,
                    );
                  }
                },
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: isLoading ? null : () => Navigator.of(dialogContext).pop(),
              child: Text('Cancel', style: TextStyle(color: GameTheme.textSecondary)),
            ),
            ElevatedButton(
              onPressed: (isLoading || codeController.text.trim().isEmpty)
                  ? null
                  : () => _handleJoinCompetition(
                        dialogContext,
                        codeController.text,
                        setState,
                        (loading) => isLoading = loading,
                        (error) => errorMessage = error,
                      ),
              style: ElevatedButton.styleFrom(
                backgroundColor: GameTheme.glowBlue,
                foregroundColor: Colors.white,
                disabledBackgroundColor: GameTheme.cardBackground,
                disabledForegroundColor: GameTheme.textSecondary,
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              ),
              child: isLoading
                  ? SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(GameTheme.background),
                      ),
                    )
                  : const Text(
                      'Join Competition',
                      style: TextStyle(fontWeight: FontWeight.w600),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _handleJoinCompetition(
    BuildContext dialogContext,
    String code,
    StateSetter setDialogState,
    Function(bool) setLoading,
    Function(String?) setError,
  ) async {
    setDialogState(() {
      setLoading(true);
      setError(null);
    });

    try {
      final apiClient = context.read<ApiClient>();
      final userDataSource = UserRemoteDataSource(apiClient: apiClient);
      final messenger = ScaffoldMessenger.of(context);

      final result = await userDataSource.joinCompetitionByCode(
        competitionCode: code.trim(),
      );

      if (!mounted) return;

      // Close dialog
      if (dialogContext.mounted) {
        Navigator.of(dialogContext).pop();
      }

      // Show success message
      final competitionName = result['competition']?['name'] ?? 'competition';
      messenger.showSnackBar(
        SnackBar(
          content: Text('Successfully joined $competitionName!'),
          backgroundColor: GameTheme.accentGreen,
        ),
      );

      // Refresh dashboard to show newly joined competition
      await _loadDashboard(forceRefresh: true);
    } catch (e) {
      setDialogState(() {
        setLoading(false);
        setError('Invalid code');
      });
    }
  }

  Future<void> _openWebPlatform() async {
    final webUrl = Config.instance.webBaseUrl;
    final uri = Uri.parse(webUrl);

    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not open web platform')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<AuthBloc, AuthState>(
      listener: (context, state) {
        // Navigate to login when logged out
        if (state is AuthUnauthenticated) {
          context.go('/login');
        }
      },
      child: Scaffold(
        backgroundColor: GameTheme.background,
        appBar: widget.showAppBar
            ? AppBar(
                title: Text(
                  'LMS Local',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 0.5,
                    color: GameTheme.textPrimary,
                  ),
                ),
                backgroundColor: GameTheme.background,
                foregroundColor: GameTheme.textPrimary,
                automaticallyImplyLeading: false,
                elevation: 0,
                systemOverlayStyle: const SystemUiOverlayStyle(
                  statusBarColor: Colors.transparent,
                  statusBarIconBrightness: Brightness.light,
                  statusBarBrightness: Brightness.dark,
                  systemNavigationBarColor: Colors.transparent,
                  systemNavigationBarIconBrightness: Brightness.light,
                ),
                actions: [
                  Container(
                    margin: const EdgeInsets.only(right: 16),
                    decoration: BoxDecoration(
                      color: GameTheme.cardBackground,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: IconButton(
                      icon: Icon(
                        Icons.person_outline,
                        size: 24,
                        color: GameTheme.textPrimary,
                      ),
                      onPressed: () => context.push('/profile'),
                      tooltip: 'Profile',
                    ),
                  ),
                ],
              )
            : null,
        body: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return Center(
        child: CircularProgressIndicator(color: GameTheme.glowCyan),
      );
    }

    if (_error != null) {
      return Container(
        color: GameTheme.background,
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.error_outline,
                size: 64,
                color: GameTheme.textMuted,
              ),
              const SizedBox(height: 16),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 32),
                child: Text(
                  'Failed to load dashboard',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: GameTheme.textPrimary,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
              const SizedBox(height: 8),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 32),
                child: Text(
                  _error!,
                  style: TextStyle(
                    fontSize: 14,
                    color: GameTheme.textMuted,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: () => _loadDashboard(forceRefresh: true),
                icon: const Icon(Icons.refresh),
                label: const Text(
                  'Retry',
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: GameTheme.glowCyan,
                  foregroundColor: GameTheme.background,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 24,
                    vertical: 16,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                  elevation: 0,
                ),
              ),
            ],
          ),
        ),
      );
    }

    // Show empty state only if no competitions AND no promoted competitions
    if (_competitions.isEmpty && _promotedCompetitions.isEmpty) {
      return Container(
        color: GameTheme.background,
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.sports_soccer_outlined,
                size: 64,
                color: GameTheme.textMuted,
              ),
              const SizedBox(height: 24),
              Text(
                'No Competitions Yet',
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: GameTheme.textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 32),
                child: Text(
                  'Join a competition to get started with Last Man Standing!',
                  style: TextStyle(
                    fontSize: 14,
                    color: GameTheme.textMuted,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
              const SizedBox(height: 32),
              ElevatedButton.icon(
                onPressed: _showJoinCompetitionDialog,
                icon: const Icon(Icons.add),
                label: const Text(
                  'Join Competition',
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: GameTheme.glowCyan,
                  foregroundColor: GameTheme.background,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 24,
                    vertical: 16,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                  elevation: 0,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _onRefresh,
      color: GameTheme.glowCyan,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: Container(
          constraints: BoxConstraints(
            minHeight: MediaQuery.of(context).size.height,
          ),
          color: GameTheme.background,
          child: Padding(
            padding: const EdgeInsets.all(AppConstants.paddingMedium),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Featured Competitions section (promoted)
                if (_promotedCompetitions.isNotEmpty) ...[
                  _buildSectionHeader('Featured', Icons.star_outline),
                  const SizedBox(height: 12),
                  ..._promotedCompetitions.map((promo) => _buildPromotedCard(promo)),
                  const SizedBox(height: 24),
                ],

                // Your Competitions section
                if (_competitions.isNotEmpty) ...[
                  _buildSectionHeader('Your Competitions', Icons.emoji_events_outlined),
                  const SizedBox(height: 12),
                  ..._competitions.map((competition) => _buildCompetitionCard(competition)),
                ],

                // "Join Competition" button
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 24),
                  child: Center(
                    child: TextButton(
                      onPressed: _showJoinCompetitionDialog,
                      child: Text(
                        'Join Competition',
                        style: TextStyle(
                          fontSize: 16,
                          color: GameTheme.glowCyan,
                          fontWeight: FontWeight.w500,
                          decoration: TextDecoration.underline,
                          decorationColor: GameTheme.glowCyan,
                        ),
                      ),
                    ),
                  ),
                ),

                // Web platform card
                _buildWebPlatformCard(),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String title, IconData icon) {
    return Row(
      children: [
        Icon(
          icon,
          size: 20,
          color: GameTheme.glowCyan,
        ),
        const SizedBox(width: 8),
        Text(
          title,
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: GameTheme.textPrimary,
          ),
        ),
      ],
    );
  }

  Widget _buildPromotedCard(PromotedCompetition promo) {
    // Format the lock time
    final lockTime = promo.lockTime;
    final now = DateTime.now();
    final difference = lockTime.difference(now);

    String deadline;
    if (difference.inDays > 0) {
      deadline = DateFormat('EEE d MMM, h:mm a').format(lockTime);
    } else if (difference.inHours > 0) {
      deadline = '${difference.inHours}h ${difference.inMinutes % 60}m left';
    } else if (difference.inMinutes > 0) {
      deadline = '${difference.inMinutes}m left';
    } else {
      deadline = 'Closing soon!';
    }

    // Build location string
    String? location;
    if (promo.venueName != null || promo.city != null) {
      final parts = [promo.venueName, promo.city].where((p) => p != null).toList();
      location = parts.join(', ');
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            GameTheme.glowCyan.withValues(alpha: 0.15),
            GameTheme.cardBackground,
          ],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: GameTheme.glowCyan.withValues(alpha: 0.3),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: GameTheme.glowCyan.withValues(alpha: 0.2),
            blurRadius: 16,
            spreadRadius: 0,
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => _joinPromotedCompetition(promo),
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Competition name
                Text(
                  promo.name,
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: GameTheme.textPrimary,
                  ),
                ),

                // Location
                if (location != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    location,
                    style: TextStyle(
                      fontSize: 14,
                      color: GameTheme.textMuted,
                    ),
                  ),
                ],

                const SizedBox(height: 16),

                // Info row
                Wrap(
                  spacing: 16,
                  runSpacing: 8,
                  children: [
                    // Prize
                    if (promo.prizeStructure != null)
                      _buildInfoChip(Icons.emoji_events, promo.prizeStructure!),

                    // Entry fee
                    if (promo.entryFee != null)
                      _buildInfoChip(Icons.payments_outlined, '\u00A3${promo.entryFee}'),

                    // Player count
                    _buildInfoChip(Icons.people_outline, '${promo.playerCount} joined'),
                  ],
                ),

                const SizedBox(height: 12),

                // Deadline
                Row(
                  children: [
                    Icon(
                      Icons.schedule,
                      size: 16,
                      color: GameTheme.accentOrange,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      'Closes: $deadline',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: GameTheme.accentOrange,
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 16),

                // Join button - matches "Enter >" style
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(8),
                    color: GameTheme.glowCyan.withValues(alpha: 0.15),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        'Join',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: GameTheme.glowCyan,
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Icon(
                        Icons.arrow_forward_rounded,
                        size: 20,
                        color: GameTheme.glowCyan,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildInfoChip(IconData icon, String text) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          icon,
          size: 16,
          color: GameTheme.textMuted,
        ),
        const SizedBox(width: 4),
        Text(
          text,
          style: TextStyle(
            fontSize: 13,
            color: GameTheme.textSecondary,
          ),
        ),
      ],
    );
  }

  Future<void> _joinPromotedCompetition(PromotedCompetition promo) async {
    // Show loading
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => Center(
        child: CircularProgressIndicator(color: GameTheme.glowCyan),
      ),
    );

    try {
      final apiClient = context.read<ApiClient>();
      final userDataSource = UserRemoteDataSource(apiClient: apiClient);

      await userDataSource.joinCompetitionByCode(
        competitionCode: promo.inviteCode,
      );

      if (!mounted) return;

      // Close loading dialog
      Navigator.of(context).pop();

      // Show success message
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Successfully joined ${promo.name}!'),
          backgroundColor: GameTheme.accentGreen,
        ),
      );

      // Refresh dashboard
      await _loadDashboard(forceRefresh: true);
    } catch (e) {
      if (!mounted) return;

      // Close loading dialog
      Navigator.of(context).pop();

      // Show error message
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to join competition: ${e.toString()}'),
          backgroundColor: GameTheme.accentRed,
        ),
      );
    }
  }

  Widget _buildCompetitionCard(Competition competition) {
    final needsPick = competition.needsPick ?? false;
    final isComplete = competition.status == 'COMPLETE';
    final hasWinner = isComplete && competition.winnerName != null;
    final isOut = competition.isParticipant && competition.userStatus == 'out';

    // Determine glow color based on status
    Color glowColor;
    if (isOut) {
      glowColor = GameTheme.textMuted.withValues(alpha: 0.2);
    } else if (needsPick) {
      glowColor = GameTheme.accentGreen.withValues(alpha: 0.35);
    } else {
      glowColor = GameTheme.glowCyan.withValues(alpha: 0.3);
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 24),
      decoration: BoxDecoration(
        color: GameTheme.cardBackground,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: glowColor,
            blurRadius: needsPick ? 16 : 12,
            spreadRadius: needsPick ? 1.5 : 1,
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {
            context.go('/competition/${competition.id}', extra: competition);
          },
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header: Name
                Text(
                  competition.name,
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: GameTheme.textPrimary,
                  ),
                ),
                const SizedBox(height: 16),


                // Competition info
                Row(
                  children: [
                    Icon(
                      Icons.people,
                      size: 16,
                      color: GameTheme.textMuted,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      '${competition.playerCount} active',
                      style: TextStyle(
                        fontSize: 14,
                        color: GameTheme.textSecondary,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Icon(
                      Icons.bar_chart,
                      size: 16,
                      color: GameTheme.textMuted,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      'Round ${competition.currentRound}',
                      style: TextStyle(
                        fontSize: 14,
                        color: GameTheme.textSecondary,
                      ),
                    ),
                    // Status indicator - hide if needs pick (obvious they're in)
                    if (!needsPick) ...[
                      const SizedBox(width: 16),
                      Icon(
                        isOut || !competition.isParticipant
                            ? Icons.cancel_outlined
                            : Icons.check_circle_outline,
                        size: 16,
                        color: GameTheme.textMuted,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        isOut || !competition.isParticipant ? 'Out' : 'In',
                        style: TextStyle(
                          fontSize: 14,
                          color: GameTheme.textSecondary,
                        ),
                      ),
                    ],
                  ],
                ),

                // Winner/Draw display for completed competitions
                if (isComplete) ...[
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: GameTheme.glowCyan.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      children: [
                        if (hasWinner)
                          Icon(
                            Icons.emoji_events_outlined,
                            color: GameTheme.glowCyan,
                            size: 20,
                          ),
                        if (hasWinner) const SizedBox(width: 8),
                        Text(
                          hasWinner ? 'Winner:' : 'Result:',
                          style: TextStyle(
                            fontSize: 12,
                            color: GameTheme.textMuted,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            hasWinner ? competition.winnerName! : 'Draw',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: GameTheme.textPrimary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],

                // Action button
                const SizedBox(height: 16),
                GestureDetector(
                  onTap: () {
                    context.go('/competition/${competition.id}', extra: competition);
                  },
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(8),
                      color: needsPick
                          ? GameTheme.accentGreen.withValues(alpha: 0.2)
                          : GameTheme.glowCyan.withValues(alpha: 0.15),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          needsPick ? 'Make Pick' : 'Enter',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: needsPick ? GameTheme.accentGreen : GameTheme.glowCyan,
                            letterSpacing: 0.5,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Icon(
                          Icons.arrow_forward_rounded,
                          size: 20,
                          color: needsPick ? GameTheme.accentGreen : GameTheme.glowCyan,
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildWebPlatformCard() {
    return Padding(
      padding: const EdgeInsets.only(top: 16, bottom: 48),
      child: Container(
        decoration: BoxDecoration(
          color: GameTheme.cardBackground,
          borderRadius: BorderRadius.circular(8),
          boxShadow: GameTheme.borderGlowShadow,
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: _openWebPlatform,
            borderRadius: BorderRadius.circular(8),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Icon(
                    Icons.language_outlined,
                    size: 24,
                    color: GameTheme.glowCyan,
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Want to organize your own competition?',
                          style: TextStyle(
                            fontSize: 14,
                            color: GameTheme.textPrimary,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Visit our web platform',
                          style: TextStyle(
                            fontSize: 12,
                            color: GameTheme.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    Icons.arrow_forward_ios,
                    size: 16,
                    color: GameTheme.textMuted,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
