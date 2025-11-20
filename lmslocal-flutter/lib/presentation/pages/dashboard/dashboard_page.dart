import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:lmslocal_flutter/core/config/app_config.dart';
import 'package:lmslocal_flutter/core/constants/app_constants.dart';
import 'package:lmslocal_flutter/core/errors/failures.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/api_client.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/dashboard_remote_data_source.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/user_remote_data_source.dart';
import 'package:lmslocal_flutter/domain/entities/competition.dart';
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
      final competitions = await _dashboardDataSource.getUserDashboard(
        forceRefresh: forceRefresh,
      );

      if (mounted) {
        setState(() {
          _competitions = competitions;
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
          title: const Row(
            children: [
              Icon(Icons.group_add, color: AppConstants.primaryNavy),
              SizedBox(width: 12),
              Text('Join Competition'),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Enter the invite code shared by the competition organiser',
                style: TextStyle(fontSize: 14, color: Colors.grey),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: codeController,
                decoration: InputDecoration(
                  labelText: 'Invite Code',
                  hintText: 'ABC123',
                  border: const OutlineInputBorder(),
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
                backgroundColor: AppConstants.primaryNavy,
                foregroundColor: Colors.white,
              ),
              child: isLoading
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                      ),
                    )
                  : const Text('Join Competition'),
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
          backgroundColor: AppConstants.successGreen,
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
        backgroundColor: const Color(0xFFF5F7FA),
        appBar: widget.showAppBar
            ? AppBar(
                title: Text(
                  'LMS Local',
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 0.5,
                    color: AppConstants.primaryNavy,
                  ),
                ),
                backgroundColor: Colors.white,
                foregroundColor: AppConstants.primaryNavy,
                automaticallyImplyLeading: false,
                elevation: 0.5,
                shadowColor: Colors.black.withValues(alpha: 0.1),
                actions: [
                  Container(
                    margin: const EdgeInsets.only(right: 8),
                    decoration: BoxDecoration(
                      color: AppConstants.primaryNavy.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: AppConstants.primaryNavy.withValues(alpha: 0.15),
                        width: 1,
                      ),
                    ),
                    child: IconButton(
                      icon: Icon(
                        Icons.person_outline,
                        size: 22,
                        color: AppConstants.primaryNavy,
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
      return const Center(
        child: CircularProgressIndicator(),
      );
    }

    if (_error != null) {
      return Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              const Color(0xFFF5F7FA),  // Light blue-gray
              const Color(0xFFFFFFFF),  // White
            ],
          ),
        ),
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.error_outline,
                size: 64,
                color: Colors.grey[400],
              ),
              const SizedBox(height: 16),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 32),
                child: Text(
                  'Failed to load dashboard',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Colors.grey[800],
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
                    color: Colors.grey[600],
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
                    fontSize: 15,
                  ),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppConstants.primaryNavy,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 24,
                    vertical: 16,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 2,
                ),
              ),
            ],
          ),
        ),
      );
    }

    if (_competitions.isEmpty) {
      return Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              const Color(0xFFF5F7FA),  // Light blue-gray
              const Color(0xFFFFFFFF),  // White
            ],
          ),
        ),
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.sports_soccer,
                size: 80,
                color: Colors.grey[300],
              ),
              const SizedBox(height: 24),
              Text(
                'No Competitions Yet',
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: Colors.grey[800],
                ),
              ),
              const SizedBox(height: 8),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 48),
                child: Text(
                  'Join a competition to get started with Last Man Standing!',
                  style: TextStyle(
                    fontSize: 16,
                    color: Colors.grey[600],
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
                    fontSize: 15,
                  ),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppConstants.primaryNavy,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 24,
                    vertical: 16,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 2,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _onRefresh,
      color: Colors.white,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: Container(
          constraints: BoxConstraints(
            minHeight: MediaQuery.of(context).size.height,
          ),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                const Color(0xFFF5F7FA),  // Light blue-gray
                const Color(0xFFFFFFFF),  // White
              ],
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(AppConstants.paddingMedium),
            child: Column(
              children: [
                // Competition cards
                ..._competitions.map((competition) => _buildCompetitionCard(competition)),

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
                          color: AppConstants.primaryNavy,
                          fontWeight: FontWeight.w500,
                          decoration: TextDecoration.underline,
                          decorationColor: AppConstants.primaryNavy,
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

  Widget _buildCompetitionCard(Competition competition) {
    final needsPick = competition.needsPick ?? false;
    final isComplete = competition.status == 'COMPLETE';
    final hasWinner = isComplete && competition.winnerName != null;

    return Container(
      margin: const EdgeInsets.only(bottom: 32),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: needsPick
              ? const Color(0xFF4CAF50)
              : Colors.grey[300]!,
          width: needsPick ? 3 : 2,
        ),
        boxShadow: [
          BoxShadow(
            color: needsPick
                ? const Color(0xFF4CAF50).withValues(alpha: 0.25)
                : Colors.black.withValues(alpha: 0.15),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 8,
            offset: const Offset(0, 3),
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
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header: Name and Role
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        competition.name,
                        style: TextStyle(
                          fontSize: 19,
                          fontWeight: FontWeight.bold,
                          color: Colors.grey[900],
                        ),
                      ),
                    ),
                    if (competition.isOrganiser)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: AppConstants.primaryNavy.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(
                            color: AppConstants.primaryNavy.withValues(alpha: 0.2),
                            width: 1,
                          ),
                        ),
                        child: Text(
                          'Organiser',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: AppConstants.primaryNavy,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 14),

                // Pick status (if participant)
                if (competition.isParticipant) ...[
                  if (needsPick)
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.25),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.5),
                          width: 1.5,
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            Icons.notification_important,
                            color: Colors.grey[900],
                            size: 20,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            'Pick Needed',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              color: Colors.grey[900],
                              fontSize: 15,
                            ),
                          ),
                        ],
                      ),
                    )
                  else
                    Row(
                      children: [
                        Icon(
                          Icons.check_circle,
                          color: Colors.grey[700],
                          size: 16,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          'Up to date',
                          style: TextStyle(
                            fontSize: 14,
                            color: Colors.grey[700],
                          ),
                        ),
                      ],
                    ),
                  const SizedBox(height: 12),
                ],

                // Competition info
                Row(
                  children: [
                    Icon(
                      Icons.people,
                      size: 16,
                      color: Colors.grey[700],
                    ),
                    const SizedBox(width: 4),
                    Text(
                      '${competition.playerCount} active',
                      style: TextStyle(
                        fontSize: 14,
                        color: Colors.grey[700],
                      ),
                    ),
                    const SizedBox(width: 16),
                    Icon(
                      Icons.bar_chart,
                      size: 16,
                      color: Colors.grey[700],
                    ),
                    const SizedBox(width: 4),
                    Text(
                      'Round ${competition.currentRound}',
                      style: TextStyle(
                        fontSize: 14,
                        color: Colors.grey[700],
                      ),
                    ),
                  ],
                ),

                // Player invite code (if organiser)
                if (competition.isOrganiser && competition.inviteCode != null) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          const Color(0xFF64B5F6).withValues(alpha: 0.3),
                          const Color(0xFF42A5F5).withValues(alpha: 0.2),
                        ],
                      ),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: const Color(0xFF64B5F6).withValues(alpha: 0.5),
                        width: 1.5,
                      ),
                    ),
                    child: Row(
                      children: [
                        Text(
                          'Player Invite Code',
                          style: TextStyle(
                            fontSize: 11,
                            color: Colors.grey[700],
                            fontWeight: FontWeight.w500,
                            letterSpacing: 0.5,
                          ),
                        ),
                        const Spacer(),
                        Text(
                          competition.inviteCode!,
                          style: TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 3,
                            color: Colors.grey[900],
                            fontFamily: 'monospace',
                          ),
                        ),
                        const SizedBox(width: 10),
                        Icon(
                          Icons.copy,
                          size: 18,
                          color: Colors.grey[700],
                        ),
                      ],
                    ),
                  ),
                ],

                // Winner/Draw display for completed competitions
                if (isComplete) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 14),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: hasWinner
                            ? [
                                const Color(0xFFFFD700).withValues(alpha: 0.35),
                                const Color(0xFFFFA500).withValues(alpha: 0.25),
                              ]
                            : [
                                Colors.white.withValues(alpha: 0.2),
                                Colors.white.withValues(alpha: 0.12),
                              ],
                      ),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: hasWinner
                            ? const Color(0xFFFFD700).withValues(alpha: 0.5)
                            : Colors.white.withValues(alpha: 0.3),
                        width: 1.5,
                      ),
                    ),
                    child: Row(
                      children: [
                        if (hasWinner)
                          Icon(
                            Icons.emoji_events,
                            color: Colors.grey[900],
                            size: 18,
                          ),
                        if (hasWinner) const SizedBox(width: 8),
                        Text(
                          hasWinner ? 'Winner:' : 'Result:',
                          style: TextStyle(
                            fontSize: 13,
                            color: Colors.grey[700],
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
                              color: Colors.grey[900],
                              letterSpacing: 0.3,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],

                // Action button
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: () {
                      context.go('/competition/${competition.id}', extra: competition);
                    },
                    icon: const Icon(Icons.bar_chart, size: 18),
                    label: Text(
                      competition.isOrganiser ? 'Manage Competition' : 'View Competition',
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 15,
                      ),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppConstants.primaryNavy,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      elevation: 2,
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
      padding: const EdgeInsets.only(top: 16, bottom: 64),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: Colors.grey[300]!,
            width: 1,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: _openWebPlatform,
            borderRadius: BorderRadius.circular(12),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Icon(
                    Icons.language,
                    size: 20,
                    color: AppConstants.primaryNavy,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Want to organize your own competition?',
                          style: TextStyle(
                            fontSize: 14,
                            color: Colors.grey[800],
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Visit our web platform',
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.grey[600],
                          ),
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    Icons.arrow_forward_ios,
                    size: 14,
                    color: Colors.grey[500],
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
