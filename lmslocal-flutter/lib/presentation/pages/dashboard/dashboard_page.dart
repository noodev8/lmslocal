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
import 'package:lmslocal_flutter/data/data_sources/remote/competition_remote_data_source.dart';
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

      // Filter out dismissed promotions and cleanup stale entries
      final prefs = await SharedPreferences.getInstance();
      final dismissed = prefs.getStringList('dismissed_promotions') ?? [];

      // Get current promotion IDs
      final currentPromoIds = dashboardData.promotedCompetitions
          .map((p) => p.id.toString())
          .toSet();

      // Filter out dismissed promotions
      final filteredPromotions = dashboardData.promotedCompetitions
          .where((p) => !dismissed.contains(p.id.toString()))
          .toList();

      // Cleanup: remove dismissed IDs that are no longer in current list
      final cleanedDismissed = dismissed
          .where((id) => currentPromoIds.contains(id))
          .toList();

      if (cleanedDismissed.length != dismissed.length) {
        await prefs.setStringList('dismissed_promotions', cleanedDismissed);
      }

      if (mounted) {
        setState(() {
          _competitions = _sortCompetitions(dashboardData.competitions);
          _promotedCompetitions = filteredPromotions;
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

  /// Sort competitions by creation date (newest first)
  List<Competition> _sortCompetitions(List<Competition> competitions) {
    return List<Competition>.from(competitions)
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
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

      await userDataSource.joinCompetitionByCode(
        competitionCode: code.trim(),
      );

      if (!mounted) return;

      // Close dialog
      if (dialogContext.mounted) {
        Navigator.of(dialogContext).pop();
      }

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
          onTap: () => _showCompetitionInfoModal(promo),
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Competition name and delete button
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        promo.name,
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: GameTheme.textPrimary,
                        ),
                      ),
                    ),
                    GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: () => _showDismissPromotionConfirmation(promo),
                      child: Padding(
                        padding: const EdgeInsets.all(8),
                        child: Icon(
                          Icons.delete_outline,
                          size: 22,
                          color: GameTheme.textMuted,
                        ),
                      ),
                    ),
                  ],
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

                // Prize structure - full width, no truncation
                if (promo.prizeStructure != null) ...[
                  const SizedBox(height: 12),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(
                        Icons.emoji_events,
                        size: 18,
                        color: GameTheme.glowCyan,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          promo.prizeStructure!,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                            color: GameTheme.textPrimary,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],

                const SizedBox(height: 12),

                // Info row - entry fee and player count
                Wrap(
                  spacing: 16,
                  runSpacing: 8,
                  children: [
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

                // View Details button - prominent styling
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
                      Icon(
                        Icons.info_outline,
                        size: 20,
                        color: GameTheme.glowCyan,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'View Details',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: GameTheme.glowCyan,
                          letterSpacing: 0.5,
                        ),
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
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 200),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            size: 16,
            color: GameTheme.textMuted,
          ),
          const SizedBox(width: 4),
          Flexible(
            child: Text(
              text,
              style: TextStyle(
                fontSize: 13,
                color: GameTheme.textSecondary,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
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

  void _showDismissPromotionConfirmation(PromotedCompetition promo) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: GameTheme.cardBackground,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        title: Text(
          'Remove Competition',
          style: TextStyle(
            color: GameTheme.textPrimary,
            fontWeight: FontWeight.bold,
          ),
        ),
        content: Text(
          'Are you sure you want to remove "${promo.name}" from your dashboard?',
          style: TextStyle(
            color: GameTheme.textSecondary,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text(
              'Cancel',
              style: TextStyle(color: GameTheme.textMuted),
            ),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              _dismissPromotion(promo);
            },
            child: Text(
              'Remove',
              style: TextStyle(color: GameTheme.accentRed),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _dismissPromotion(PromotedCompetition promo) async {
    final prefs = await SharedPreferences.getInstance();
    final dismissed = prefs.getStringList('dismissed_promotions') ?? [];

    if (!dismissed.contains(promo.id.toString())) {
      dismissed.add(promo.id.toString());
      await prefs.setStringList('dismissed_promotions', dismissed);
    }

    // Update state to remove from display
    setState(() {
      _promotedCompetitions.removeWhere((p) => p.id == promo.id);
    });
  }

  void _showDeleteConfirmation(Competition competition) {
    final hasNotStarted = competition.status == 'SETUP';
    final message = hasNotStarted
        ? 'Are you sure you want to remove "${competition.name}"?\n\nThis competition has not started yet, so you will also be removed as a participant.'
        : 'Are you sure you want to remove "${competition.name}" from your dashboard?';

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: GameTheme.cardBackground,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        title: Text(
          'Remove Competition',
          style: TextStyle(
            color: GameTheme.textPrimary,
            fontWeight: FontWeight.bold,
          ),
        ),
        content: Text(
          message,
          style: TextStyle(
            color: GameTheme.textSecondary,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text(
              'Cancel',
              style: TextStyle(color: GameTheme.textMuted),
            ),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              _hideCompetition(competition);
            },
            child: Text(
              'Remove',
              style: TextStyle(color: GameTheme.accentRed),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _hideCompetition(Competition competition) async {
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
      final prefs = await SharedPreferences.getInstance();
      final competitionDataSource = CompetitionRemoteDataSource(
        apiClient: apiClient,
        prefs: prefs,
      );

      await competitionDataSource.hideCompetition(
        competitionId: competition.id,
      );

      if (!mounted) return;

      // Close loading dialog
      Navigator.of(context).pop();

      // Refresh dashboard
      await _loadDashboard(forceRefresh: true);
    } catch (e) {
      if (!mounted) return;

      // Close loading dialog
      Navigator.of(context).pop();
    }
  }

  void _showCompetitionInfoModal(PromotedCompetition promo) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.5,
        minChildSize: 0.3,
        maxChildSize: 0.85,
        builder: (context, scrollController) => Container(
          decoration: BoxDecoration(
            color: GameTheme.cardBackground,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
            border: Border.all(
              color: GameTheme.glowCyan.withValues(alpha: 0.3),
              width: 1,
            ),
          ),
          child: Column(
            children: [
              // Handle bar
              Container(
                margin: const EdgeInsets.only(top: 12),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: GameTheme.textMuted,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              // Header
              Padding(
                padding: const EdgeInsets.all(20),
                child: Row(
                  children: [
                    Icon(
                      Icons.info_outline,
                      color: GameTheme.glowCyan,
                      size: 24,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        promo.name,
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: GameTheme.textPrimary,
                        ),
                      ),
                    ),
                    IconButton(
                      icon: Icon(
                        Icons.close,
                        color: GameTheme.textMuted,
                      ),
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
              ),
              Divider(color: GameTheme.border, height: 1),
              // Content
              Expanded(
                child: SingleChildScrollView(
                  controller: scrollController,
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Prize structure as headline
                      if (promo.prizeStructure != null && promo.prizeStructure!.isNotEmpty) ...[
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: GameTheme.glowCyan.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: GameTheme.glowCyan.withValues(alpha: 0.3),
                            ),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                Icons.emoji_events,
                                size: 24,
                                color: GameTheme.glowCyan,
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                  promo.prizeStructure!,
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w600,
                                    color: GameTheme.textPrimary,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 20),
                      ],
                      // Details section
                      Text(
                        'Details',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: GameTheme.textMuted,
                        ),
                      ),
                      const SizedBox(height: 12),
                      // Description
                      if (promo.description != null && promo.description!.isNotEmpty) ...[
                        Text(
                          promo.description!,
                          style: TextStyle(
                            fontSize: 16,
                            color: GameTheme.textPrimary,
                            height: 1.5,
                          ),
                        ),
                        const SizedBox(height: 16),
                      ],
                      // Info items
                      if (promo.venueName != null || promo.city != null)
                        _buildInfoRow(
                          Icons.location_on_outlined,
                          [promo.venueName, promo.city].where((p) => p != null).join(', '),
                        ),
                      if (promo.entryFee != null)
                        _buildInfoRow(Icons.payments_outlined, '\u00A3${promo.entryFee}'),
                      _buildInfoRow(Icons.people_outline, '${promo.playerCount} players joined'),
                    ],
                  ),
                ),
              ),
              // Join button at bottom
              Padding(
                padding: const EdgeInsets.all(20),
                child: SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () {
                      Navigator.of(context).pop();
                      _joinPromotedCompetition(promo);
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: GameTheme.glowCyan,
                      foregroundColor: GameTheme.background,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: const Text(
                      'Join Competition',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildInfoRow(IconData icon, String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Icon(icon, size: 20, color: GameTheme.textMuted),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                fontSize: 15,
                color: GameTheme.textSecondary,
              ),
            ),
          ),
        ],
      ),
    );
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
                // Header: Name and delete button
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        competition.name,
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: GameTheme.textPrimary,
                        ),
                      ),
                    ),
                    // Allow hiding any competition from dashboard
                    GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: () => _showDeleteConfirmation(competition),
                      child: Padding(
                        padding: const EdgeInsets.all(8),
                        child: Icon(
                          Icons.delete_outline,
                          size: 22,
                          color: GameTheme.textMuted,
                        ),
                      ),
                    ),
                  ],
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
