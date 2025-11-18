import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:lmslocal_flutter/core/constants/app_constants.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/api_client.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/user_remote_data_source.dart';
import 'package:lmslocal_flutter/domain/repositories/auth_repository.dart';
import 'package:lmslocal_flutter/presentation/bloc/auth/auth_bloc.dart';
import 'package:lmslocal_flutter/presentation/bloc/auth/auth_event.dart';
import 'package:lmslocal_flutter/presentation/bloc/auth/auth_state.dart';

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
            content: Text('Display name updated successfully'),
            backgroundColor: AppConstants.successGreen,
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
          SnackBar(content: Text('Failed to update display name: $e')),
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
            backgroundColor: AppConstants.successGreen,
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
            backgroundColor: AppConstants.successGreen,
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
            backgroundColor: AppConstants.successGreen,
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
            backgroundColor: AppConstants.successGreen,
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
            Icon(Icons.warning_amber, color: AppConstants.errorRed),
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
                color: AppConstants.errorRed,
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
            style: TextButton.styleFrom(foregroundColor: AppConstants.errorRed),
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
            style: TextButton.styleFrom(foregroundColor: AppConstants.errorRed),
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
          return const Center(child: CircularProgressIndicator());
        }

        final user = state.user;
        _displayNameController.text = user.displayName;

        return SingleChildScrollView(
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

              // Notifications Card
              _buildNotificationsCard(),
              const SizedBox(height: 12),

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
                'Version ${AppConstants.appVersion}',
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.grey[400],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildProfileHeader(dynamic user) {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppConstants.radiusMedium),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppConstants.paddingLarge),
        child: Row(
          children: [
            // Avatar
            CircleAvatar(
              radius: 32,
              backgroundColor: AppConstants.primaryNavy,
              child: Text(
                user.displayName.isNotEmpty
                    ? user.displayName[0].toUpperCase()
                    : 'U',
                style: const TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
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
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    user.email,
                    style: TextStyle(
                      fontSize: 14,
                      color: Colors.grey[600],
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
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppConstants.radiusMedium),
      ),
      child: ExpansionTile(
        leading: Icon(Icons.person, color: AppConstants.primaryNavy),
        title: const Text('Display Name'),
        subtitle: Text(_isEditingDisplayName ? 'Editing...' : user.displayName),
        children: [
          Padding(
            padding: const EdgeInsets.all(AppConstants.paddingMedium),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(
                  controller: _displayNameController,
                  decoration: const InputDecoration(
                    labelText: 'Display Name',
                    border: OutlineInputBorder(),
                  ),
                  enabled: !_isSavingDisplayName,
                ),
                const SizedBox(height: 12),
                ElevatedButton(
                  onPressed: _isSavingDisplayName
                      ? null
                      : () => _updateDisplayName(user.displayName),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppConstants.primaryNavy,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  child: _isSavingDisplayName
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        )
                      : const Text('Save Changes'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCompetitionNamesCard(dynamic user) {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppConstants.radiusMedium),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppConstants.paddingLarge),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.badge, color: AppConstants.primaryNavy),
                const SizedBox(width: 12),
                const Expanded(
                  child: Text(
                    'Competition Display Names',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            const Text(
              'Set different display names for each competition you play in',
              style: TextStyle(fontSize: 13, color: Colors.grey),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () => _handleManageCompetitionNames(user),
                icon: const Icon(Icons.edit, size: 18),
                label: const Text('Manage Competition Names'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.grey[600],
                  foregroundColor: Colors.white,
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

    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppConstants.radiusMedium),
      ),
      child: ExpansionTile(
        leading: Icon(Icons.notifications, color: AppConstants.primaryNavy),
        title: const Text('Notifications'),
        subtitle: const Text('Manage your preferences'),
        children: [
          if (_isLoadingPreferences)
            const Padding(
              padding: EdgeInsets.all(AppConstants.paddingLarge),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (global != null) ...[
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppConstants.paddingMedium),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 8),
                    child: Text(
                      'Global Settings',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                      ),
                    ),
                  ),
                  // All Emails
                  SwitchListTile(
                    title: const Text('All Email Notifications'),
                    subtitle: const Text('Master switch for all emails'),
                    value: _getPreferenceValue('global_all', global['all_emails'] ?? true),
                    onChanged: (value) => _toggleEmailPreference('global_all', global['all_emails'] ?? true),
                    activeTrackColor: AppConstants.primaryNavy,
                  ),
                  // Pick Reminders
                  SwitchListTile(
                    title: const Text('Pick Reminders'),
                    value: _getPreferenceValue('global_pick_reminder', global['pick_reminder'] ?? true),
                    onChanged: (value) => _toggleEmailPreference('global_pick_reminder', global['pick_reminder'] ?? true),
                    activeTrackColor: AppConstants.primaryNavy,
                  ),
                  // Results
                  SwitchListTile(
                    title: const Text('Results Notifications'),
                    value: _getPreferenceValue('global_results', global['results'] ?? true),
                    onChanged: (value) => _toggleEmailPreference('global_results', global['results'] ?? true),
                    activeTrackColor: AppConstants.primaryNavy,
                  ),

                  // Per-competition
                  if (competitionSpecific != null && competitionSpecific.isNotEmpty) ...[
                    const Divider(),
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 8),
                      child: Text(
                        'Enable competition emails for:',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                        ),
                      ),
                    ),
                    ...competitionSpecific.map((comp) {
                      final compId = comp['competition_id'] as int;
                      final compName = comp['personal_name'] ?? comp['competition_name'] ?? 'Competition $compId';
                      final allEmails = comp['all_emails'] ?? true;

                      return SwitchListTile(
                        title: Text(compName),
                        value: _getPreferenceValue('comp_$compId', allEmails),
                        onChanged: (value) => _toggleEmailPreference('comp_$compId', allEmails),
                        activeTrackColor: AppConstants.primaryNavy,
                      );
                    }),
                  ],

                  // Save button
                  if (_pendingPreferenceChanges.isNotEmpty) ...[
                    const Divider(),
                    Padding(
                      padding: const EdgeInsets.all(AppConstants.paddingMedium),
                      child: ElevatedButton(
                        onPressed: _isSavingPreferences ? null : _saveEmailPreferences,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppConstants.primaryNavy,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                        child: _isSavingPreferences
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
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
    );
  }

  Widget _buildChangePasswordCard() {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppConstants.radiusMedium),
      ),
      child: ExpansionTile(
        leading: Icon(Icons.lock, color: AppConstants.primaryNavy),
        title: const Text('Change Password'),
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
                  decoration: InputDecoration(
                    labelText: 'Current Password',
                    border: const OutlineInputBorder(),
                    suffixIcon: IconButton(
                      icon: Icon(_showCurrentPassword ? Icons.visibility_off : Icons.visibility),
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
                  decoration: InputDecoration(
                    labelText: 'New Password',
                    border: const OutlineInputBorder(),
                    suffixIcon: IconButton(
                      icon: Icon(_showNewPassword ? Icons.visibility_off : Icons.visibility),
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
                  decoration: InputDecoration(
                    labelText: 'Confirm New Password',
                    border: const OutlineInputBorder(),
                    suffixIcon: IconButton(
                      icon: Icon(_showConfirmPassword ? Icons.visibility_off : Icons.visibility),
                      onPressed: () => setState(() => _showConfirmPassword = !_showConfirmPassword),
                    ),
                  ),
                  enabled: !_isChangingPassword,
                ),
                const SizedBox(height: 12),
                ElevatedButton(
                  onPressed: _isChangingPassword ? null : _changePassword,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppConstants.primaryNavy,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  child: _isChangingPassword
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        )
                      : const Text('Change Password'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDangerZoneCard() {
    return Card(
      elevation: 2,
      color: Colors.red[50],
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppConstants.radiusMedium),
        side: BorderSide(color: AppConstants.errorRed.withValues(alpha: 0.3)),
      ),
      child: ExpansionTile(
        leading: Icon(Icons.warning_amber, color: AppConstants.errorRed),
        title: const Text(
          'Danger Zone',
          style: TextStyle(color: AppConstants.errorRed, fontWeight: FontWeight.bold),
        ),
        children: [
          Padding(
            padding: const EdgeInsets.all(AppConstants.paddingMedium),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Delete your account and all associated data permanently. This action cannot be undone.',
                  style: TextStyle(color: AppConstants.errorRed),
                ),
                const SizedBox(height: 12),
                ElevatedButton(
                  onPressed: _showDeleteAccountDialog,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppConstants.errorRed,
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
    );
  }

  Widget _buildLogoutButton() {
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton.icon(
        onPressed: _showLogoutDialog,
        style: OutlinedButton.styleFrom(
          padding: const EdgeInsets.symmetric(vertical: 16),
          side: BorderSide(color: AppConstants.primaryNavy),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppConstants.radiusMedium),
          ),
        ),
        icon: Icon(Icons.logout, color: AppConstants.primaryNavy),
        label: Text(
          'Logout',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: AppConstants.primaryNavy,
          ),
        ),
      ),
    );
  }
}
