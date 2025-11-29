import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:lmslocal_flutter/core/constants/app_constants.dart';
import 'package:lmslocal_flutter/core/theme/game_theme.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/api_client.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/user_remote_data_source.dart';
import 'package:lmslocal_flutter/domain/repositories/auth_repository.dart';
import 'package:lmslocal_flutter/presentation/bloc/auth/auth_bloc.dart';
import 'package:lmslocal_flutter/presentation/bloc/auth/auth_event.dart';
import 'package:lmslocal_flutter/presentation/bloc/auth/auth_state.dart';
import 'package:package_info_plus/package_info_plus.dart';

/// Profile page
/// Shows user information with editable display name, notifications, password change, and logout
class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  late UserRemoteDataSource _userDataSource;
  late AuthRepository _authRepository;

  // Display name editing
  final _displayNameController = TextEditingController();
  bool _isEditingDisplayName = false;
  bool _isSavingDisplayName = false;

  // Competition display names
  List<dynamic>? _competitions;
  int? _selectedCompetitionId;
  final _competitionNameController = TextEditingController();

  // Password change
  final _currentPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _isChangingPassword = false;
  bool _showCurrentPassword = false;
  bool _showNewPassword = false;
  bool _showConfirmPassword = false;

  // Email preferences
  Map<String, dynamic>? _emailPreferences;
  bool _isLoadingPreferences = false;
  bool _isSavingPreferences = false;
  final Map<String, bool> _pendingPreferenceChanges = {};

  // App version
  String _appVersion = '';

  @override
  void initState() {
    super.initState();
    // Initialize user data source
    final apiClient = context.read<ApiClient>();
    _userDataSource = UserRemoteDataSource(apiClient: apiClient);

    // Initialize auth repository
    _authRepository = context.read<AuthRepository>();

    // Load email preferences
    _loadEmailPreferences();

    // Load app version
    _loadAppVersion();
  }

  Future<void> _loadAppVersion() async {
    final packageInfo = await PackageInfo.fromPlatform();
    setState(() {
      _appVersion = '${packageInfo.version}+${packageInfo.buildNumber}';
    });
  }

  @override
  void dispose() {
    _displayNameController.dispose();
    _competitionNameController.dispose();
    _currentPasswordController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _loadEmailPreferences() async {
    setState(() => _isLoadingPreferences = true);
    try {
      final result = await _userDataSource.getEmailPreferences();
      setState(() {
        _emailPreferences = result['preferences'];
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load notification preferences: $e')),
        );
      }
    } finally {
      setState(() => _isLoadingPreferences = false);
    }
  }

  Future<void> _updateDisplayName(String currentName) async {
    final newName = _displayNameController.text.trim();
    if (newName.isEmpty || newName == currentName) {
      setState(() => _isEditingDisplayName = false);
      return;
    }

    setState(() => _isSavingDisplayName = true);
    try {
      // Update display name on server
      await _userDataSource.updateProfile(displayName: newName);

      // Update cached display name locally to keep cache in sync
      await _authRepository.updateCachedDisplayName(newName);

      if (mounted) {
        setState(() {
          _isEditingDisplayName = false;
          _isSavingDisplayName = false;
        });
        // ignore: use_build_context_synchronously
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Account name updated successfully'),
            backgroundColor: GameTheme.accentGreen,
          ),
        );
        // Trigger auth state refresh to update user data in UI
        // ignore: use_build_context_synchronously
        context.read<AuthBloc>().add(const AuthCheckRequested());
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSavingDisplayName = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to update account name: $e')),
        );
      }
    }
  }

  Future<void> _loadCompetitions() async {
    try {
      // Get competitions from dashboard API directly
      final apiClient = context.read<ApiClient>();
      final dashboardResponse = await apiClient.post('/get-user-dashboard', data: {});

      if (dashboardResponse.data['return_code'] == 'SUCCESS') {
        setState(() {
          _competitions = dashboardResponse.data['competitions'] as List;
        });
      }
    } catch (e) {
      if (mounted) {
        // ignore: use_build_context_synchronously
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load competitions: $e')),
        );
      }
    }
  }

  void _handleManageCompetitionNames(dynamic user) {
    _loadCompetitions().then((_) {
      if (_competitions != null && _competitions!.isNotEmpty) {
        _showCompetitionNamesModal(user);
      } else {
        // ignore: use_build_context_synchronously
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No competitions found')),
        );
      }
    });
  }

  void _handleCompetitionSelect(int? competitionId, dynamic user) {
    if (competitionId == null) return;

    setState(() {
      _selectedCompetitionId = competitionId;
      final competition = _competitions?.firstWhere((c) => c['id'] == competitionId);
      if (competition != null) {
        final playerName = competition['player_display_name'] as String?;
        _competitionNameController.text = playerName ?? user.displayName;
      }
    });
  }

  Future<void> _handleResetToGlobal(dynamic user) async {
    if (_selectedCompetitionId == null) return;

    try {
      await _userDataSource.updatePlayerDisplayName(
        competitionId: _selectedCompetitionId!,
        playerDisplayName: null,
      );

      // Update cached display name locally
      await _authRepository.updateCachedDisplayName(user.displayName);

      if (mounted) {
        _competitionNameController.text = user.displayName;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Reset to profile name'),
            backgroundColor: GameTheme.accentGreen,
          ),
        );
        // Reload competitions to refresh data
        await _loadCompetitions();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to reset name: $e')),
        );
      }
    }
  }

  Future<void> _handleSaveCompetitionName(dynamic user) async {
    if (_selectedCompetitionId == null) return;

    final newName = _competitionNameController.text.trim();
    if (newName.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Name cannot be empty')),
      );
      return;
    }

    try {
      await _userDataSource.updatePlayerDisplayName(
        competitionId: _selectedCompetitionId!,
        playerDisplayName: newName,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Competition name updated'),
            backgroundColor: GameTheme.accentGreen,
          ),
        );
        // Reload competitions to refresh data
        await _loadCompetitions();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to update name: $e')),
        );
      }
    }
  }

  Future<void> _changePassword() async {
    final current = _currentPasswordController.text;
    final newPass = _newPasswordController.text;
    final confirm = _confirmPasswordController.text;

    if (current.isEmpty || newPass.isEmpty || confirm.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please fill in all password fields')),
      );
      return;
    }

    if (newPass.length < 6) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('New password must be at least 6 characters')),
      );
      return;
    }

    if (newPass != confirm) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('New passwords do not match')),
      );
      return;
    }

    setState(() => _isChangingPassword = true);
    try {
      await _userDataSource.changePassword(
        currentPassword: current,
        newPassword: newPass,
      );

      if (mounted) {
        setState(() => _isChangingPassword = false);
        _currentPasswordController.clear();
        _newPasswordController.clear();
        _confirmPasswordController.clear();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Password changed successfully'),
            backgroundColor: GameTheme.accentGreen,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isChangingPassword = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to change password: $e')),
        );
      }
    }
  }

  Future<void> _saveEmailPreferences() async {
    if (_pendingPreferenceChanges.isEmpty) return;

    setState(() => _isSavingPreferences = true);
    try {
      final updates = <Map<String, dynamic>>[];

      _pendingPreferenceChanges.forEach((key, value) {
        if (key == 'global_all') {
          updates.add({'competition_id': 0, 'email_type': 'all', 'enabled': value});
        } else if (key == 'global_pick_reminder') {
          updates.add({'competition_id': 0, 'email_type': 'pick_reminder', 'enabled': value});
        } else if (key == 'global_results') {
          updates.add({'competition_id': 0, 'email_type': 'results', 'enabled': value});
        } else if (key.startsWith('comp_')) {
          final compId = int.parse(key.split('_')[1]);
          updates.add({'competition_id': compId, 'email_type': null, 'enabled': value});
        }
      });

      await _userDataSource.updateEmailPreferencesBatch(updates: updates);

      if (mounted) {
        setState(() {
          _isSavingPreferences = false;
          _pendingPreferenceChanges.clear();
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Notification preferences updated'),
            backgroundColor: GameTheme.accentGreen,
          ),
        );
        // Reload preferences to get fresh state
        await _loadEmailPreferences();
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSavingPreferences = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to update preferences: $e')),
        );
      }
    }
  }

  void _toggleEmailPreference(String key, bool currentValue) {
    setState(() {
      _pendingPreferenceChanges[key] = !currentValue;
    });
  }

  bool _getPreferenceValue(String key, bool defaultValue) {
    return _pendingPreferenceChanges[key] ?? defaultValue;
  }

  void _showDeleteAccountDialog() {
    final confirmController = TextEditingController();

    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Row(
          children: [
            Icon(Icons.warning_amber, color: GameTheme.accentRed),
            const SizedBox(width: 8),
            const Text('Delete Account'),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'This will permanently delete:',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            const Text('• Your account and profile'),
            const Text('• All competitions you organized'),
            const Text('• All your picks and history'),
            const Text('• All associated data'),
            const SizedBox(height: 16),
            const Text(
              'This action cannot be undone.',
              style: TextStyle(
                color: GameTheme.accentRed,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Type DELETE_MY_ACCOUNT to confirm:',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: confirmController,
              decoration: const InputDecoration(
                hintText: 'DELETE_MY_ACCOUNT',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () async {
              if (confirmController.text == 'DELETE_MY_ACCOUNT') {
                Navigator.of(dialogContext).pop();
                await _deleteAccount();
              } else {
                ScaffoldMessenger.of(dialogContext).showSnackBar(
                  const SnackBar(content: Text('Confirmation text does not match')),
                );
              }
            },
            style: TextButton.styleFrom(foregroundColor: GameTheme.accentRed),
            child: const Text('Delete My Account'),
          ),
        ],
      ),
    );
  }

  Future<void> _deleteAccount() async {
    try {
      await _userDataSource.deleteAccount(confirmation: 'DELETE_MY_ACCOUNT');

      if (mounted) {
        // Logout and navigate to login
        context.read<AuthBloc>().add(const AuthLogoutRequested());
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to delete account: $e')),
        );
      }
    }
  }

  void _showLogoutDialog() {
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Logout'),
        content: const Text('Are you sure you want to logout?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(dialogContext).pop();
              context.read<AuthBloc>().add(const AuthLogoutRequested());
            },
            style: TextButton.styleFrom(foregroundColor: GameTheme.accentRed),
            child: const Text('Logout'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<AuthBloc, AuthState>(
      builder: (context, state) {
        if (state is! AuthAuthenticated) {
          return Container(
            color: GameTheme.background,
            child: Center(
              child: CircularProgressIndicator(color: GameTheme.glowCyan),
            ),
          );
        }

        final user = state.user;
        _displayNameController.text = user.displayName;

        return Container(
          color: GameTheme.background,
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(AppConstants.paddingMedium),
            child: Column(
              children: [
                // Profile Header
                _buildProfileHeader(user),
                const SizedBox(height: 16),

                // Display Name Card
                _buildDisplayNameCard(user),
                const SizedBox(height: 12),

                // Competition Display Names Card
                _buildCompetitionNamesCard(user),
                const SizedBox(height: 12),

                // TODO: Notifications feature temporarily hidden - not currently used
                // Uncomment when ready to re-enable notifications
                // // Notifications Card
                // _buildNotificationsCard(),
                // const SizedBox(height: 12),

                // Change Password Card
                _buildChangePasswordCard(),
                const SizedBox(height: 12),

                // Danger Zone Card
                _buildDangerZoneCard(),
                const SizedBox(height: 12),

                // Logout Button
                _buildLogoutButton(),
                const SizedBox(height: 16),

                // App Version
                Text(
                  _appVersion.isNotEmpty ? 'Version $_appVersion' : 'Loading version...',
                  style: TextStyle(
                    fontSize: 12,
                    color: GameTheme.textMuted,
                  ),
                ),
                const SizedBox(height: 60),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildProfileHeader(dynamic user) {
    return Container(
      decoration: BoxDecoration(
        color: GameTheme.cardBackground,
        borderRadius: BorderRadius.circular(AppConstants.radiusMedium),
        border: Border.all(color: GameTheme.border),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppConstants.paddingLarge),
        child: Row(
          children: [
            // Avatar
            CircleAvatar(
              radius: 32,
              backgroundColor: GameTheme.glowCyan,
              child: Text(
                user.displayName.isNotEmpty
                    ? user.displayName[0].toUpperCase()
                    : 'U',
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: GameTheme.background,
                ),
              ),
            ),
            const SizedBox(width: 16),
            // User info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    user.displayName,
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: GameTheme.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    user.email,
                    style: TextStyle(
                      fontSize: 14,
                      color: GameTheme.textMuted,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDisplayNameCard(dynamic user) {
    return Container(
      decoration: BoxDecoration(
        color: GameTheme.cardBackground,
        borderRadius: BorderRadius.circular(AppConstants.radiusMedium),
        border: Border.all(color: GameTheme.border),
      ),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          leading: Icon(Icons.person, color: GameTheme.glowCyan),
          title: Text('Account Name', style: TextStyle(color: GameTheme.textPrimary)),
          subtitle: Text(
            _isEditingDisplayName ? 'Editing...' : user.displayName,
            style: TextStyle(color: GameTheme.textMuted),
          ),
          iconColor: GameTheme.textMuted,
          collapsedIconColor: GameTheme.textMuted,
          children: [
            Padding(
              padding: const EdgeInsets.all(AppConstants.paddingMedium),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TextField(
                    controller: _displayNameController,
                    style: TextStyle(color: GameTheme.textPrimary),
                    decoration: InputDecoration(
                      labelText: 'Account Name',
                      labelStyle: TextStyle(color: GameTheme.textMuted),
                      border: OutlineInputBorder(borderSide: BorderSide(color: GameTheme.border)),
                      enabledBorder: OutlineInputBorder(borderSide: BorderSide(color: GameTheme.border)),
                      focusedBorder: OutlineInputBorder(borderSide: BorderSide(color: GameTheme.glowCyan)),
                    ),
                    enabled: !_isSavingDisplayName,
                  ),
                  const SizedBox(height: 12),
                  ElevatedButton(
                    onPressed: _isSavingDisplayName
                        ? null
                        : () => _updateDisplayName(user.displayName),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: GameTheme.glowCyan,
                      foregroundColor: GameTheme.background,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    child: _isSavingDisplayName
                        ? SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              valueColor: AlwaysStoppedAnimation<Color>(GameTheme.background),
                            ),
                          )
                        : const Text('Save Changes'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCompetitionNamesCard(dynamic user) {
    return Container(
      decoration: BoxDecoration(
        color: GameTheme.cardBackground,
        borderRadius: BorderRadius.circular(AppConstants.radiusMedium),
        border: Border.all(color: GameTheme.border),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppConstants.paddingLarge),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.badge, color: GameTheme.glowCyan),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Competition Display Names',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: GameTheme.textPrimary,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              'Set different display names for each competition you play in',
              style: TextStyle(fontSize: 13, color: GameTheme.textMuted),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () => _handleManageCompetitionNames(user),
                icon: const Icon(Icons.edit, size: 18),
                label: const Text('Manage Competition Names'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: GameTheme.backgroundLight,
                  foregroundColor: GameTheme.textPrimary,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showCompetitionNamesModal(dynamic user) {
    // Reset selection when opening modal
    setState(() {
      _selectedCompetitionId = null;
      _competitionNameController.clear();
    });

    showDialog(
      context: context,
      builder: (BuildContext context) {
        return StatefulBuilder(
          builder: (BuildContext context, StateSetter setModalState) {
            final selectedCompetition = _selectedCompetitionId != null
                ? _competitions?.firstWhere((c) => c['id'] == _selectedCompetitionId)
                : null;
            final currentName = selectedCompetition != null
                ? (selectedCompetition['player_display_name'] as String? ?? user.displayName)
                : null;

            return Dialog(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Header
                    Row(
                      children: [
                        Icon(Icons.badge, color: AppConstants.primaryNavy, size: 24),
                        const SizedBox(width: 12),
                        const Expanded(
                          child: Text(
                            'Competition Names',
                            style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close),
                          onPressed: () => Navigator.pop(context),
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    // Competition Dropdown
                    DropdownButtonFormField<int>(
                      initialValue: _selectedCompetitionId,
                      decoration: const InputDecoration(
                        labelText: 'Select Competition',
                        border: OutlineInputBorder(),
                      ),
                      items: _competitions?.map((comp) {
                        return DropdownMenuItem<int>(
                          value: comp['id'] as int,
                          child: Text(comp['name'] as String),
                        );
                      }).toList(),
                      onChanged: (value) {
                        setModalState(() {
                          _handleCompetitionSelect(value, user);
                        });
                        setState(() {});
                      },
                    ),
                    const SizedBox(height: 16),

                    // Show current name when competition selected
                    if (_selectedCompetitionId != null) ...[
                      Builder(
                        builder: (context) {
                          // Recalculate on every build to show fresh data
                          final comp = _competitions?.firstWhere((c) => c['id'] == _selectedCompetitionId);
                          final displayName = comp != null
                              ? (comp['player_display_name'] as String? ?? user.displayName)
                              : currentName;
                          return Text(
                            'Current name: $displayName',
                            style: const TextStyle(
                              fontSize: 13,
                              color: Colors.grey,
                              fontStyle: FontStyle.italic,
                            ),
                          );
                        },
                      ),
                      const SizedBox(height: 16),

                      // Name input
                      TextField(
                        controller: _competitionNameController,
                        decoration: const InputDecoration(
                          labelText: 'Display Name',
                          border: OutlineInputBorder(),
                          hintText: 'Enter your display name',
                        ),
                      ),
                      const SizedBox(height: 20),

                      // Buttons
                      Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          TextButton(
                            onPressed: () => Navigator.pop(context),
                            child: const Text('Cancel'),
                          ),
                          const SizedBox(width: 8),
                          TextButton(
                            onPressed: () async {
                              await _handleResetToGlobal(user);
                              if (mounted) {
                                // ignore: use_build_context_synchronously
                                Navigator.pop(context);
                              }
                            },
                            child: const Text('Reset'),
                          ),
                          const SizedBox(width: 8),
                          ElevatedButton(
                            onPressed: () async {
                              await _handleSaveCompetitionName(user);
                              if (mounted) {
                                // ignore: use_build_context_synchronously
                                Navigator.pop(context);
                              }
                            },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.grey[600],
                              foregroundColor: Colors.white,
                            ),
                            child: const Text('Save'),
                          ),
                        ],
                      ),
                    ] else ...[
                      // Show message when no competition selected
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 20),
                        child: Text(
                          'Please select a competition to manage its display name',
                          style: TextStyle(
                            fontSize: 14,
                            color: Colors.grey,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                      // Cancel button when nothing selected
                      Align(
                        alignment: Alignment.centerRight,
                        child: TextButton(
                          onPressed: () => Navigator.pop(context),
                          child: const Text('Close'),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildNotificationsCard() {
    final global = _emailPreferences?['global'] as Map<String, dynamic>?;
    final competitionSpecific = _emailPreferences?['competition_specific'] as List?;

    return Container(
      decoration: BoxDecoration(
        color: GameTheme.cardBackground,
        borderRadius: BorderRadius.circular(AppConstants.radiusMedium),
        border: Border.all(color: GameTheme.border),
      ),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          leading: Icon(Icons.notifications, color: GameTheme.glowCyan),
          title: Text('Notifications', style: TextStyle(color: GameTheme.textPrimary)),
          subtitle: Text('Manage your preferences', style: TextStyle(color: GameTheme.textMuted)),
          iconColor: GameTheme.textMuted,
          collapsedIconColor: GameTheme.textMuted,
          children: [
            if (_isLoadingPreferences)
              Padding(
                padding: const EdgeInsets.all(AppConstants.paddingLarge),
                child: Center(child: CircularProgressIndicator(color: GameTheme.glowCyan)),
              )
            else if (global != null) ...[
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppConstants.paddingMedium),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Text(
                        'Global Settings',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                          color: GameTheme.textPrimary,
                        ),
                      ),
                    ),
                    // All Emails
                    SwitchListTile(
                      title: Text('All Email Notifications', style: TextStyle(color: GameTheme.textPrimary)),
                      subtitle: Text('Master switch for all emails', style: TextStyle(color: GameTheme.textMuted)),
                      value: _getPreferenceValue('global_all', global['all_emails'] ?? true),
                      onChanged: (value) => _toggleEmailPreference('global_all', global['all_emails'] ?? true),
                      activeTrackColor: GameTheme.glowCyan,
                    ),
                    // Pick Reminders
                    SwitchListTile(
                      title: Text('Pick Reminders', style: TextStyle(color: GameTheme.textPrimary)),
                      value: _getPreferenceValue('global_pick_reminder', global['pick_reminder'] ?? true),
                      onChanged: (value) => _toggleEmailPreference('global_pick_reminder', global['pick_reminder'] ?? true),
                      activeTrackColor: GameTheme.glowCyan,
                    ),
                    // Results
                    SwitchListTile(
                      title: Text('Results Notifications', style: TextStyle(color: GameTheme.textPrimary)),
                      value: _getPreferenceValue('global_results', global['results'] ?? true),
                      onChanged: (value) => _toggleEmailPreference('global_results', global['results'] ?? true),
                      activeTrackColor: GameTheme.glowCyan,
                    ),

                    // Per-competition
                    if (competitionSpecific != null && competitionSpecific.isNotEmpty) ...[
                      Divider(color: GameTheme.border),
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        child: Text(
                          'Enable competition emails for:',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                            color: GameTheme.textPrimary,
                          ),
                        ),
                      ),
                      ...competitionSpecific.map((comp) {
                        final compId = comp['competition_id'] as int;
                        final compName = comp['personal_name'] ?? comp['competition_name'] ?? 'Competition $compId';
                        final allEmails = comp['all_emails'] ?? true;

                        return SwitchListTile(
                          title: Text(compName, style: TextStyle(color: GameTheme.textPrimary)),
                          value: _getPreferenceValue('comp_$compId', allEmails),
                          onChanged: (value) => _toggleEmailPreference('comp_$compId', allEmails),
                          activeTrackColor: GameTheme.glowCyan,
                        );
                      }),
                    ],

                    // Save button
                    if (_pendingPreferenceChanges.isNotEmpty) ...[
                      Divider(color: GameTheme.border),
                      Padding(
                        padding: const EdgeInsets.all(AppConstants.paddingMedium),
                        child: ElevatedButton(
                          onPressed: _isSavingPreferences ? null : _saveEmailPreferences,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: GameTheme.glowCyan,
                            foregroundColor: GameTheme.background,
                            padding: const EdgeInsets.symmetric(vertical: 12),
                          ),
                          child: _isSavingPreferences
                              ? SizedBox(
                                  height: 20,
                                  width: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    valueColor: AlwaysStoppedAnimation<Color>(GameTheme.background),
                                  ),
                                )
                              : const Text('Update Notifications'),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildChangePasswordCard() {
    return Container(
      decoration: BoxDecoration(
        color: GameTheme.cardBackground,
        borderRadius: BorderRadius.circular(AppConstants.radiusMedium),
        border: Border.all(color: GameTheme.border),
      ),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          leading: Icon(Icons.lock, color: GameTheme.glowCyan),
          title: Text('Change Password', style: TextStyle(color: GameTheme.textPrimary)),
          iconColor: GameTheme.textMuted,
          collapsedIconColor: GameTheme.textMuted,
          children: [
            Padding(
              padding: const EdgeInsets.all(AppConstants.paddingMedium),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Current Password
                  TextField(
                    controller: _currentPasswordController,
                    obscureText: !_showCurrentPassword,
                    style: TextStyle(color: GameTheme.textPrimary),
                    decoration: InputDecoration(
                      labelText: 'Current Password',
                      labelStyle: TextStyle(color: GameTheme.textMuted),
                      border: OutlineInputBorder(borderSide: BorderSide(color: GameTheme.border)),
                      enabledBorder: OutlineInputBorder(borderSide: BorderSide(color: GameTheme.border)),
                      focusedBorder: OutlineInputBorder(borderSide: BorderSide(color: GameTheme.glowCyan)),
                      suffixIcon: IconButton(
                        icon: Icon(_showCurrentPassword ? Icons.visibility_off : Icons.visibility, color: GameTheme.textMuted),
                        onPressed: () => setState(() => _showCurrentPassword = !_showCurrentPassword),
                      ),
                    ),
                    enabled: !_isChangingPassword,
                  ),
                  const SizedBox(height: 12),
                  // New Password
                  TextField(
                    controller: _newPasswordController,
                    obscureText: !_showNewPassword,
                    style: TextStyle(color: GameTheme.textPrimary),
                    decoration: InputDecoration(
                      labelText: 'New Password',
                      labelStyle: TextStyle(color: GameTheme.textMuted),
                      border: OutlineInputBorder(borderSide: BorderSide(color: GameTheme.border)),
                      enabledBorder: OutlineInputBorder(borderSide: BorderSide(color: GameTheme.border)),
                      focusedBorder: OutlineInputBorder(borderSide: BorderSide(color: GameTheme.glowCyan)),
                      suffixIcon: IconButton(
                        icon: Icon(_showNewPassword ? Icons.visibility_off : Icons.visibility, color: GameTheme.textMuted),
                        onPressed: () => setState(() => _showNewPassword = !_showNewPassword),
                      ),
                    ),
                    enabled: !_isChangingPassword,
                  ),
                  const SizedBox(height: 12),
                  // Confirm Password
                  TextField(
                    controller: _confirmPasswordController,
                    obscureText: !_showConfirmPassword,
                    style: TextStyle(color: GameTheme.textPrimary),
                    decoration: InputDecoration(
                      labelText: 'Confirm New Password',
                      labelStyle: TextStyle(color: GameTheme.textMuted),
                      border: OutlineInputBorder(borderSide: BorderSide(color: GameTheme.border)),
                      enabledBorder: OutlineInputBorder(borderSide: BorderSide(color: GameTheme.border)),
                      focusedBorder: OutlineInputBorder(borderSide: BorderSide(color: GameTheme.glowCyan)),
                      suffixIcon: IconButton(
                        icon: Icon(_showConfirmPassword ? Icons.visibility_off : Icons.visibility, color: GameTheme.textMuted),
                        onPressed: () => setState(() => _showConfirmPassword = !_showConfirmPassword),
                      ),
                    ),
                    enabled: !_isChangingPassword,
                  ),
                  const SizedBox(height: 12),
                  ElevatedButton(
                    onPressed: _isChangingPassword ? null : _changePassword,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: GameTheme.glowCyan,
                      foregroundColor: GameTheme.background,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    child: _isChangingPassword
                        ? SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              valueColor: AlwaysStoppedAnimation<Color>(GameTheme.background),
                            ),
                          )
                        : const Text('Change Password'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDangerZoneCard() {
    return Container(
      decoration: BoxDecoration(
        color: GameTheme.accentRed.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(AppConstants.radiusMedium),
        border: Border.all(color: GameTheme.accentRed.withValues(alpha: 0.4)),
      ),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          leading: Icon(Icons.warning_amber, color: GameTheme.accentRed),
          title: Text(
            'Danger Zone',
            style: TextStyle(color: GameTheme.accentRed, fontWeight: FontWeight.bold),
          ),
          iconColor: GameTheme.accentRed,
          collapsedIconColor: GameTheme.accentRed,
          children: [
            Padding(
              padding: const EdgeInsets.all(AppConstants.paddingMedium),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Delete your account and all associated data permanently. This action cannot be undone.',
                    style: TextStyle(color: GameTheme.textSecondary),
                  ),
                  const SizedBox(height: 12),
                  ElevatedButton(
                    onPressed: _showDeleteAccountDialog,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: GameTheme.accentRed,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    child: const Text('Delete My Account'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLogoutButton() {
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton.icon(
        onPressed: _showLogoutDialog,
        style: OutlinedButton.styleFrom(
          padding: const EdgeInsets.symmetric(vertical: 16),
          side: BorderSide(color: GameTheme.glowCyan),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppConstants.radiusMedium),
          ),
        ),
        icon: Icon(Icons.logout, color: GameTheme.glowCyan),
        label: Text(
          'Logout',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: GameTheme.glowCyan,
          ),
        ),
      ),
    );
  }
}
