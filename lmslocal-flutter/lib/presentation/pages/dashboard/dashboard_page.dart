import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:lmslocal_flutter/core/config/app_config.dart';
import 'package:lmslocal_flutter/core/constants/app_constants.dart';
import 'package:lmslocal_flutter/core/game/round_state.dart';
import 'package:lmslocal_flutter/core/theme/game_theme.dart';
import 'package:lmslocal_flutter/core/theme/coupon_theme.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/api_client.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/competition_remote_data_source.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/dashboard_remote_data_source.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/user_remote_data_source.dart';
import 'package:lmslocal_flutter/domain/entities/competition.dart';
import 'package:lmslocal_flutter/domain/entities/promoted_competition.dart';
import 'package:lmslocal_flutter/presentation/widgets/common/competition_logo.dart';

/// The competitions half of [HomeShellPage] — a body, not a screen.
///
/// It has no app bar and no bottom bar of its own; the shell supplies both so
/// that they survive a switch to Profile.
class DashboardPage extends StatefulWidget {
  const DashboardPage({super.key});

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
          // Was a hardcoded navy, which survived the palette remap and left the
          // dialog as the one dark surface in a light app.
          backgroundColor: CouponTheme.stockLit,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.zero,
            side: CouponTheme.rule(),
          ),
          titlePadding: const EdgeInsets.fromLTRB(24, 24, 24, 0),
          title: Text('JOIN A COMPETITION', style: CouponTheme.heading(30)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Enter the invite code the organiser gave you.',
                style: CouponTheme.bodyText,
              ),
              const SizedBox(height: 20),
              Text('INVITE CODE', style: CouponTheme.label),
              const SizedBox(height: 8),
              TextField(
                controller: codeController,
                // An access code is something a person was handed and types in,
                // which is exactly what font-data is for (design-system.md §3).
                style: CouponTheme.dataText.copyWith(
                  fontSize: 20,
                  letterSpacing: 2,
                ),
                decoration: InputDecoration(
                  hintText: 'ABC123',
                  hintStyle: CouponTheme.dataText.copyWith(
                    fontSize: 20,
                    letterSpacing: 2,
                    color: CouponTheme.inkFade.withValues(alpha: 0.7),
                  ),
                  errorText: errorMessage,
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
          actionsPadding: const EdgeInsets.fromLTRB(24, 8, 24, 20),
          actions: [
            TextButton(
              onPressed: isLoading ? null : () => Navigator.of(dialogContext).pop(),
              child: const Text('Cancel'),
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
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                textStyle: TextStyle(
                  fontFamily: CouponTheme.display,
                  fontSize: 20,
                  letterSpacing: 20 * 0.06,
                  fontVariations: CouponTheme.weight(600),
                ),
              ),
              child: Text(isLoading ? 'JOINING…' : 'JOIN'),
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
    // The masthead and the bottom bar belong to HomeShellPage, which is the
    // only thing that builds this page. Owning them here as well is what let
    // Home carry two Profile controls, and what made the bar disappear the
    // moment Profile was opened.
    //
    // The logout redirect belongs to the shell too, for the same reason: only
    // the visible tab is mounted, so a listener here was deaf to the logout it
    // was meant to catch — it is fired from the Profile tab, with this page
    // gone from the tree.
    return Scaffold(
      backgroundColor: GameTheme.background,
      body: _buildBody(),
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
                    borderRadius: BorderRadius.zero,
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
                    borderRadius: BorderRadius.zero,
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
      // Same shared formatter as every other kickoff in the app. It was
      // formatting a UTC DateTime without converting, so a promoted
      // competition's deadline read an hour early right through BST.
      deadline = formatShort(lockTime, reference: now);
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
        borderRadius: BorderRadius.zero,
        border: Border.all(
          color: GameTheme.glowCyan.withValues(alpha: 0.3),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: GameTheme.glowCyan.withValues(alpha: 0.2),
            blurRadius: 0,
            spreadRadius: 0,
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => _showCompetitionInfoModal(promo),
          borderRadius: BorderRadius.zero,
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
                    borderRadius: BorderRadius.zero,
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
          borderRadius: BorderRadius.zero,
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

  /// Edit the player's own name for a competition.
  ///
  /// Prefilled with the name currently shown so an edit starts from what is on
  /// screen; emptying the field clears the nickname and leaves the organiser's
  /// name on its own.
  void _showRenameDialog(Competition competition) {
    final controller = TextEditingController(
      text: competition.personalName ?? competition.name,
    );

    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: GameTheme.cardBackground,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.zero,
        ),
        title: Text(
          'Rename for yourself',
          style: TextStyle(
            color: GameTheme.textPrimary,
            fontWeight: FontWeight.bold,
          ),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Not "everyone else sees X" — anyone can rename it for themselves,
            // so the organiser's name is not what the next player is looking at
            // either, and we cannot say what is on their screen.
            Text(
              'Only you see this name. Everyone else sees what they chose.',
              style: TextStyle(color: GameTheme.textSecondary),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: controller,
              autofocus: true,
              maxLength: 100,
              textInputAction: TextInputAction.done,
              style: TextStyle(color: GameTheme.textPrimary),
              decoration: const InputDecoration(
                labelText: 'Your name for it',
              ),
              onSubmitted: (_) {
                Navigator.of(dialogContext).pop();
                _savePersonalName(competition, controller.text);
              },
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: Text(
              'Cancel',
              style: TextStyle(color: GameTheme.textMuted),
            ),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(dialogContext).pop();
              _savePersonalName(competition, controller.text);
            },
            child: Text(
              'Save',
              style: TextStyle(color: GameTheme.glowCyan),
            ),
          ),
        ],
      ),
    );
  }

  /// Save the nickname, showing it straight away and putting it back if the
  /// server refuses — a rename is not worth a blocking spinner.
  Future<void> _savePersonalName(Competition competition, String value) async {
    final trimmed = value.trim();
    // Typing the organiser's name back is the same as having no nickname.
    final newName =
        (trimmed.isEmpty || trimmed == competition.name) ? null : trimmed;
    final previousName = competition.personalName;

    if (newName == previousName) return;

    void apply(String? name) {
      if (!mounted) return;
      setState(() {
        _competitions = _competitions
            .map((c) =>
                c.id == competition.id ? c.copyWithPersonalName(name) : c)
            .toList();
      });
    }

    apply(newName);

    try {
      final saved = await _dashboardDataSource.updatePersonalName(
        competitionId: competition.id,
        personalName: newName,
      );
      apply(saved);
    } catch (e) {
      apply(previousName);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Could not save that name. Please try again.'),
          backgroundColor: GameTheme.accentRed,
        ),
      );
    }
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
          borderRadius: BorderRadius.zero,
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
                            borderRadius: BorderRadius.zero,
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
                        borderRadius: BorderRadius.zero,
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

    // The same machine the web dashboard card runs, off the same three counts,
    // so the two surfaces cannot describe one round differently.
    final roundState = deriveDashboardRoundState(
      currentRound: competition.currentRound,
      currentRoundLockTime: competition.currentRoundLockTime,
      competitionComplete: isComplete,
      now: DateTime.now(),
      totalFixtures: competition.totalFixtures,
      fixturesWithResults: competition.fixturesWithResults,
      fixturesProcessed: competition.fixturesProcessed,
    );

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
        borderRadius: BorderRadius.zero,
        boxShadow: [
          BoxShadow(
            color: glowColor,
            blurRadius: 0,
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
          borderRadius: BorderRadius.zero,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header: Name and delete button
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Small on purpose. In a list of competitions the badge's
                    // only job is telling them apart at a glance; the join
                    // screen is where it is asked to prove one is real.
                    CompetitionLogo(
                      name: competition.name,
                      logoUrl: competition.logoUrl,
                      size: 40,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // The player's own name is the heading once they
                          // set one — they renamed it because the organiser's
                          // name did not tell them which competition this was.
                          // The organiser's name stays underneath, smaller, so
                          // they can still say which competition they mean to
                          // anyone else.
                          Text(
                            competition.personalName ?? competition.name,
                            style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              color: GameTheme.textPrimary,
                            ),
                          ),
                          if (competition.personalName != null) ...[
                            const SizedBox(height: 2),
                            Text(
                              competition.name,
                              style: CouponTheme.bodyText.copyWith(
                                fontSize: 13,
                                color: CouponTheme.inkFade,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    // Rename for yourself only
                    GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: () => _showRenameDialog(competition),
                      child: Padding(
                        padding: const EdgeInsets.all(8),
                        child: Icon(
                          Icons.edit_outlined,
                          size: 20,
                          color: GameTheme.textMuted,
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
                const SizedBox(height: 12),

                // Two separate facts, and the card was previously showing
                // neither: what the player owes, and where the round has got
                // to. The web card carries the first, the web game screen the
                // second — a phone card is the only thing a player sees before
                // deciding whether to open anything, so it carries both.
                if (competition.isParticipant) ...[
                  if (needsPick)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        border: Border.all(color: CouponTheme.overprint),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            Icons.warning_amber_outlined,
                            size: 16,
                            color: CouponTheme.overprint,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              pickDeadlineText(roundState),
                              style: CouponTheme.label.copyWith(
                                color: CouponTheme.ink,
                              ),
                            ),
                          ),
                        ],
                      ),
                    )
                  else ...[
                    Text(
                      '✓ UP TO DATE',
                      style: CouponTheme.label.copyWith(color: CouponTheme.moss),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      playerRoundStatus(roundState),
                      style: CouponTheme.bodyText.copyWith(
                        fontSize: 15,
                        color: CouponTheme.inkFade,
                      ),
                    ),
                  ],
                  const SizedBox(height: 16),
                ] else
                  const SizedBox(height: 4),

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
                      borderRadius: BorderRadius.zero,
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

                // No invite code here. It used to sit on every card while
                // joining was open, back when this was the only place the app
                // showed one — a bare code with nothing to do with it, on the
                // screen you pass through rather than the one you act on. The
                // competition screen now has the whole invitation: the link,
                // the QR, and a share sheet. One place, one step further in.

                // Action button
                const SizedBox(height: 16),
                // A tint of an ink is never the answer — moss at 20% and ink at
                // 15% both read as grey murk over the stock, which is the
                // failure design-system.md §8 calls out by name. An outstanding
                // pick is the one thing on this screen worth acting on, so it
                // takes the solid overprint; entering an up-to-date competition
                // is secondary and outlined.
                Builder(builder: (context) {
                  void open() => context.go(
                        needsPick
                            ? '/competition/${competition.id}?tab=play'
                            : '/competition/${competition.id}',
                        extra: competition,
                      );
                  final label = Text(needsPick ? 'MAKE PICK' : 'ENTER');
                  return SizedBox(
                    width: double.infinity,
                    child: needsPick
                        ? ElevatedButton(onPressed: open, child: label)
                        : OutlinedButton(onPressed: open, child: label),
                  );
                }),
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
          borderRadius: BorderRadius.zero,
          boxShadow: GameTheme.borderGlowShadow,
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: _openWebPlatform,
            borderRadius: BorderRadius.zero,
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
