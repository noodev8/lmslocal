import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/auth_provider.dart';
import '../models/competition.dart';
import '../services/cached_api_service.dart';
import 'login_screen.dart';
import 'profile_screen.dart';
import 'competition_dashboard_screen.dart';

class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  List<Competition> competitions = [];
  bool isLoading = true;
  String? errorMessage;
  int _currentIndex = 0;

  @override
  void initState() {
    super.initState();
    _loadCompetitions();
  }

  Future<void> _loadCompetitions() async {
    try {
      setState(() {
        isLoading = true;
        errorMessage = null;
      });

      final response = await CachedApiService.instance.getMyCompetitions();
      
      if (response.isSuccess) {
        setState(() {
          competitions = response.competitions;
          isLoading = false;
        });
      } else {
        setState(() {
          errorMessage = response.message ?? 'Failed to load competitions';
          isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        errorMessage = 'Unexpected error: $e';
        isLoading = false;
      });
    }
  }

  Future<void> _refreshCompetitions() async {
    try {
      // Clear cache first to force fresh data
      await CachedApiService.instance.invalidateCompetitionsCache();
      
      // Then reload competitions
      await _loadCompetitions();
    } catch (e) {
      setState(() {
        errorMessage = 'Refresh failed: $e';
        isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('LMS Local'),
        backgroundColor: theme.colorScheme.surface,
        actions: [
          PopupMenuButton<String>(
            onSelected: (value) {
              if (value == 'profile') {
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (context) => const ProfileScreen()),
                );
              } else if (value == 'logout') {
                _showLogoutDialog(context, ref);
              }
            },
            itemBuilder: (context) => [
              const PopupMenuItem(
                value: 'profile',
                child: Row(
                  children: [
                    Icon(Icons.person),
                    SizedBox(width: 8),
                    Text('Profile'),
                  ],
                ),
              ),
              PopupMenuItem(
                value: 'logout',
                child: Row(
                  children: [
                    Icon(Icons.logout, color: theme.colorScheme.error),
                    const SizedBox(width: 8),
                    Text(
                      'Logout',
                      style: TextStyle(color: theme.colorScheme.error),
                    ),
                  ],
                ),
              ),
            ],
            child: CircleAvatar(
              backgroundColor: theme.colorScheme.primary,
              child: Text(
                authState.user?.displayName.substring(0, 1).toUpperCase() ?? 'U',
                style: TextStyle(
                  color: theme.colorScheme.onPrimary,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
          const SizedBox(width: 16),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refreshCompetitions,
        child: _buildCurrentTab(theme, authState),
      ),
      bottomNavigationBar: _buildBottomNavigation(theme),
    );
  }

  Widget _buildCurrentTab(ThemeData theme, AuthState authState) {
    switch (_currentIndex) {
      case 0:
        return _buildBody(theme, authState);
      case 1:
        return _buildNotificationsTab(theme);
      case 2:
        return _buildSearchTab(theme);
      case 3:
        return _buildSettingsTab(theme, authState);
      default:
        return _buildBody(theme, authState);
    }
  }

  Widget _buildBody(ThemeData theme, AuthState authState) {
    if (isLoading) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 16),
            Text('Loading your competitions...'),
          ],
        ),
      );
    }

    if (errorMessage != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.error_outline,
              size: 64,
              color: theme.colorScheme.error,
            ),
            const SizedBox(height: 16),
            Text(
              'Oops! Something went wrong',
              style: theme.textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              errorMessage!,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.error,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: _refreshCompetitions,
              icon: const Icon(Icons.refresh),
              label: const Text('Try Again'),
            ),
          ],
        ),
      );
    }

    if (competitions.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.sports_soccer,
              size: 80,
              color: theme.colorScheme.primary.withValues(alpha: 0.6),
            ),
            const SizedBox(height: 24),
            Text(
              authState.user?.displayName ?? 'Player',
              style: theme.textTheme.headlineLarge?.copyWith(
                fontWeight: FontWeight.w300,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            Text(
              'No competitions yet',
              style: theme.textTheme.titleLarge?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Join a competition using an invite code\nor ask your organizer to add you!',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 32),
            FilledButton.icon(
              onPressed: () {
                // TODO: Navigate to join competition screen
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Join competition feature coming soon!')),
                );
              },
              icon: const Icon(Icons.add),
              label: const Text('Join Competition'),
            ),
          ],
        ),
      );
    }

    // Show competitions list
    return CustomScrollView(
      slivers: [
        SliverPadding(
          padding: const EdgeInsets.all(16.0),
          sliver: SliverToBoxAdapter(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  authState.user?.displayName ?? 'Player',
                  style: theme.textTheme.headlineLarge?.copyWith(
                    fontWeight: FontWeight.w300,
                  ),
                ),
                const SizedBox(height: 16),
              ],
            ),
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0),
          sliver: SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, index) => Padding(
                padding: const EdgeInsets.only(bottom: 20.0),
                child: _buildCompetitionCard(competitions[index], theme),
              ),
              childCount: competitions.length,
            ),
          ),
        ),
        const SliverPadding(padding: EdgeInsets.only(bottom: 32)),
      ],
    );
  }

  Widget _buildCompetitionCard(Competition competition, ThemeData theme) {
    return Card(
      elevation: 2,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => _onCompetitionTap(competition),
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              // Competition name and status badge
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Expanded(
                    child: Text(
                      competition.name,
                      style: theme.textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: theme.colorScheme.onSurface,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 12),
                  // Status Badge - more muted like in screenshot
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: theme.colorScheme.surfaceContainerHighest,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          _getStatusIcon(competition),
                          size: 14,
                          color: _getStatusIconColor(competition, theme),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          competition.userStatus != null 
                              ? competition.userStatusDisplayText.toLowerCase()
                              : (competition.isOrganiser ? 'organizer' : 'active'),
                          style: theme.textTheme.labelMedium?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              
              const SizedBox(height: 16),
              
              // Stats row - centered like in screenshot
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  // Players column
                  Column(
                    children: [
                      Icon(
                        Icons.people,
                        size: 20,
                        color: theme.colorScheme.primary.withValues(alpha: 0.8),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${competition.playerCount}',
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                          color: theme.colorScheme.primary,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Players',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                  
                  // Round column
                  if (competition.currentRound != null)
                    Column(
                      children: [
                        Icon(
                          Icons.timeline,
                          size: 20,
                          color: theme.colorScheme.secondary.withValues(alpha: 0.8),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${competition.currentRound}',
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w600,
                            color: theme.colorScheme.secondary,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Round',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatusChip(Competition competition, ThemeData theme) {
    Color backgroundColor;
    Color textColor;
    IconData icon;

    switch (competition.status) {
      case 'OPEN':
        backgroundColor = theme.colorScheme.secondaryContainer;
        textColor = theme.colorScheme.onSecondaryContainer;
        icon = Icons.door_front_door;
        break;
      case 'LOCKED':
        backgroundColor = theme.colorScheme.tertiaryContainer;
        textColor = theme.colorScheme.onTertiaryContainer;
        icon = Icons.lock;
        break;
      case 'ACTIVE':
        backgroundColor = theme.colorScheme.primaryContainer;
        textColor = theme.colorScheme.onPrimaryContainer;
        icon = Icons.play_arrow;
        break;
      case 'COMPLETE':
        backgroundColor = theme.colorScheme.surfaceContainerHighest;
        textColor = theme.colorScheme.onSurfaceVariant;
        icon = Icons.check_circle;
        break;
      default:
        backgroundColor = theme.colorScheme.surfaceContainerHighest;
        textColor = theme.colorScheme.onSurfaceVariant;
        icon = Icons.info;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            size: 12,
            color: textColor,
          ),
          const SizedBox(width: 4),
          Text(
            competition.statusDisplayText,
            style: theme.textTheme.labelSmall?.copyWith(
              color: textColor,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  IconData _getStatusIcon(Competition competition) {
    if (competition.userStatus == 'OUT') {
      return Icons.close;
    } else if (competition.isOrganiser) {
      return Icons.admin_panel_settings;
    } else {
      return Icons.check;
    }
  }
  
  Color _getStatusIconColor(Competition competition, ThemeData theme) {
    if (competition.userStatus == 'OUT') {
      return theme.colorScheme.error;
    } else if (competition.isOrganiser) {
      return theme.colorScheme.primary;
    } else {
      return Colors.green.shade600;
    }
  }
  
  Color _getStatusColor(Competition competition, ThemeData theme) {
    if (competition.userStatus == 'OUT') {
      return theme.colorScheme.errorContainer;
    } else if (competition.isOrganiser) {
      return theme.colorScheme.primaryContainer;
    } else {
      // Active status - green
      return Colors.green.shade100;
    }
  }
  
  Color _getStatusTextColor(Competition competition, ThemeData theme) {
    if (competition.userStatus == 'OUT') {
      return theme.colorScheme.onErrorContainer;
    } else if (competition.isOrganiser) {
      return theme.colorScheme.onPrimaryContainer;
    } else {
      // Active status - dark green
      return Colors.green.shade800;
    }
  }

  void _onCompetitionTap(Competition competition) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => CompetitionDashboardScreen(competition: competition),
      ),
    );
  }

  Widget _buildNotificationsTab(ThemeData theme) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.notifications,
            size: 80,
            color: theme.colorScheme.primary.withValues(alpha: 0.6),
          ),
          const SizedBox(height: 24),
          Text(
            'Notifications',
            style: theme.textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'Coming soon!\nGet notified about round updates and results',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildSearchTab(ThemeData theme) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.search,
            size: 80,
            color: theme.colorScheme.primary.withValues(alpha: 0.6),
          ),
          const SizedBox(height: 24),
          Text(
            'Find Competitions',
            style: theme.textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'Coming soon!\nSearch for competitions to join',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildSettingsTab(ThemeData theme, AuthState authState) {
    return SingleChildScrollView(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // User Profile Card
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 30,
                      backgroundColor: theme.colorScheme.primary,
                      child: Text(
                        authState.user?.displayName.substring(0, 1).toUpperCase() ?? 'U',
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                          color: theme.colorScheme.onPrimary,
                        ),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            authState.user?.displayName ?? 'Unknown User',
                            style: theme.textTheme.titleLarge?.copyWith(
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            authState.user?.email ?? 'No email',
                            style: theme.textTheme.bodyMedium?.copyWith(
                              color: theme.colorScheme.onSurfaceVariant,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(builder: (context) => const ProfileScreen()),
                        );
                      },
                      icon: const Icon(Icons.edit),
                    ),
                  ],
                ),
              ),
            ),
            
            const SizedBox(height: 24),
            
            // Settings Options
            Text(
              'Settings',
              style: theme.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            
            Card(
              child: Column(
                children: [
                  ListTile(
                    leading: const Icon(Icons.person),
                    title: const Text('Profile'),
                    subtitle: const Text('Manage your account'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(builder: (context) => const ProfileScreen()),
                      );
                    },
                  ),
                  const Divider(height: 1),
                  ListTile(
                    leading: const Icon(Icons.notifications),
                    title: const Text('Notifications'),
                    subtitle: const Text('Manage notification preferences'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Notification settings coming soon!')),
                      );
                    },
                  ),
                  const Divider(height: 1),
                  ListTile(
                    leading: const Icon(Icons.help),
                    title: const Text('Help & Support'),
                    subtitle: const Text('Get help with the app'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Help section coming soon!')),
                      );
                    },
                  ),
                  const Divider(height: 1),
                  ListTile(
                    leading: Icon(Icons.logout, color: theme.colorScheme.error),
                    title: Text(
                      'Logout', 
                      style: TextStyle(color: theme.colorScheme.error),
                    ),
                    subtitle: const Text('Sign out of your account'),
                    onTap: () => _showLogoutDialog(context, ref),
                  ),
                ],
              ),
            ),
            
            const SizedBox(height: 32),
            
            // App Info
            Center(
              child: Column(
                children: [
                  Text(
                    'LMS Local',
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: theme.colorScheme.primary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Version 1.0.0',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            
            const SizedBox(height: 80), // Space for bottom navigation
          ],
        ),
      ),
    );
  }

  Widget _buildBottomNavigation(ThemeData theme) {
    return BottomNavigationBar(
      currentIndex: _currentIndex,
      onTap: (index) => setState(() => _currentIndex = index),
      type: BottomNavigationBarType.fixed,
      selectedItemColor: theme.colorScheme.primary,
      unselectedItemColor: theme.colorScheme.onSurfaceVariant,
      items: const [
        BottomNavigationBarItem(
          icon: Icon(Icons.home),
          label: 'Home',
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.notifications),
          label: 'Notifications',
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.search),
          label: 'Find',
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.settings),
          label: 'Settings',
        ),
      ],
    );
  }

void _showLogoutDialog(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Logout'),
        content: const Text('Are you sure you want to logout?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () async {
              Navigator.of(context).pop();
              await ref.read(authProvider.notifier).logout();
              if (context.mounted) {
                Navigator.of(context).pushReplacement(
                  MaterialPageRoute(builder: (context) => const LoginScreen()),
                );
              }
            },
            child: const Text('Logout'),
          ),
        ],
      ),
    );
  }
}