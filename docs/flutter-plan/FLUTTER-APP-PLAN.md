# LMS Local - Flutter Mobile App Plan
**Player-Focused Mobile Application**

---

## 1. Executive Overview

### 1.1 Purpose
Build a robust, secure, and fast Flutter mobile application exclusively for **players** participating in Last Man Standing competitions. The app removes all organizer/admin functionality, focusing solely on the player experience: joining competitions, making picks, viewing results, and tracking standings.

### 1.2 Core Principles
- **Player-Only**: Zero organizer features - streamlined for gameplay
- **Robust**: Comprehensive error handling, offline support, graceful degradation
- **Secure**: JWT authentication, secure storage, API security best practices
- **Fast**: Optimized rendering, caching strategies, minimal API calls
- **Native Feel**: Platform-specific design patterns (Material 3 + Cupertino)
- **Isolated UI/UX**: All UI/UX code kept in individual page files - no global UI settings that could break existing pages

### 1.3 Key Constraints
- No competition creation
- No player management (adding/removing/editing other players)
- No fixture or result management
- No settings/configuration changes
- No billing/subscription management
- Read-only for most data (except personal picks and profile)

### 1.4 Web Platform Access (REQUIREMENT)

**CRITICAL**: All users need easy access to the web platform for organizer functions and exploration.

- **Requirement**: Provide a clear, easy-to-find link to the web platform
- **Purpose**:
  - Allow organizers to seamlessly switch to web for admin tasks
  - Encourage players to explore organizing their own competitions
  - Provide access to features not available in mobile app
- **Constraint**: Must not interfere with core player experience
- **Implementation**: Link should be:
  - Available to ALL users (not conditional on organizer status)
  - Accessible but not overly prominent (avoid cluttering player-focused UI)
  - Clearly labeled: "Web Platform", "Organize Competition", or "Full Website"
  - Opens web browser to the appropriate web page
  - **Seamless Authentication**: Pass JWT token to web for automatic login (no re-authentication required)
- **User Experience**:
  - Players can explore organizing without barriers
  - Organizers can seamlessly switch to web for admin tasks
  - **No login required**: JWT token automatically authenticates user on web
  - Smooth transition: App → Web browser → Already logged in
- **Placement Options** (design TBD):
  - Profile/Settings menu (recommended)
  - Dashboard header/menu
  - Help/FAQ section ("Want to organize?")
  - Floating action button (secondary action)

---

## 2. Screen Inventory

### 2.1 Authentication Flow (Unauthenticated Users)

#### **Screen 1: Welcome/Splash Screen**
- **Purpose**: App branding, initial load, auto-authentication check
- **Key Features**:
  - LMS Local branding and logo
  - Loading animation
  - Automatic token validation (check localStorage/secure storage)
  - Auto-navigate to Dashboard if valid token exists
  - Navigate to Login if no token
- **APIs Required**: None (local token check only)
- **Offline Support**: N/A
- **Design Notes**: Simple, fast, under 2 seconds

#### **Screen 2: Login**
- **Purpose**: Email/password authentication
- **Key Features**:
  - Email input (validation)
  - Password input (obscured with toggle visibility)
  - "Forgot Password?" link
  - "Don't have an account? Register" link
  - Error display for invalid credentials
  - Loading state during authentication
  - Remember me (secure token storage)
- **APIs Required**:
  - `POST /login` - Returns JWT token
- **Offline Support**: Show error message
- **Validation**:
  - Email format validation
  - Required field checks
  - Server-side error handling (INVALID_CREDENTIALS, etc.)

#### **Screen 3: Register**
- **Purpose**: Create new player account
- **Key Features**:
  - Display name input
  - Email input (with format validation)
  - Password input (with strength indicator)
  - Confirm password input
  - Terms & Privacy checkbox/link
  - "Already have an account? Login" link
  - Error display for duplicate email or weak password
- **APIs Required**:
  - `POST /register` - Creates account and returns JWT
- **Offline Support**: Show error message
- **Validation**:
  - Display name: Required, 2-50 characters
  - Email: Valid format, unique (server-side)
  - Password: Min 8 characters, strength validation
  - Confirm password: Must match

#### **Screen 4: Forgot Password**
- **Purpose**: Password recovery
- **Key Features**:
  - Email input
  - Submit button
  - Success message with next steps
  - Return to login link
- **APIs Required**:
  - `POST /forgot-password` - Sends recovery email
- **Offline Support**: Show error message
- **Validation**: Email format

---

### 2.2 Main App Flow (Authenticated Users)

#### **Screen 5: Dashboard (Competition List)**
- **Purpose**: Main hub showing all competitions user is participating in
- **Key Features**:
  - Pull-to-refresh
  - Competition cards showing:
    - Competition name
    - Personal note/alias (editable)
    - Current round number
    - Total player count
    - User status (Active/Eliminated/Winner)
    - Lives remaining (if active)
    - Pick status indicator:
      - "Pick Needed" (red badge) - Round unlocked, no pick made
      - "Up to date" (green badge) - Pick submitted or round locked
    - Organizer contact info (if provided)
  - Floating action button: "Join Competition"
  - Empty state: "No competitions yet - Join one to get started"
  - Profile menu (top-right):
    - View Profile
    - Settings
    - **Web Platform** (available to all users)
      - Opens web browser to web platform login page
      - URL: Based on environment config (dev/staging/prod)
      - Labeled: "Web Platform", "Full Website", or "Organize Competition"
      - Users log in separately on web (tokens last 180 days on each platform)
      - **No JWT token passing for MVP** (simplified approach, can be added in Phase 2)
    - Help
    - Sign Out
  - Edit personal note modal (long-press on competition card)
  - Delete competition from dashboard (with confirmation)
- **APIs Required**:
  - `POST /get-user-dashboard` - Returns all competitions for user
  - `POST /set-competition-note` - Update personal note
  - `POST /remove-competition-from-dashboard` - Remove competition
- **Offline Support**:
  - Cache competition list locally
  - Show cached data with "Offline" indicator
  - Queue note updates for when online
- **State Management**:
  - Cache TTL: 5 minutes
  - Automatic refresh on app resume
  - Manual refresh via pull-to-refresh
- **Navigation**: Tap card → Game Dashboard

#### **Screen 6: Join Competition Modal**
- **Purpose**: Join a competition using invite code or slug
- **Key Features**:
  - Input field for invite code/slug
  - "Join" button
  - Error handling:
    - COMPETITION_NOT_FOUND
    - COMPETITION_FULL
    - ALREADY_JOINED
    - COMPETITION_ENDED
  - Success: Auto-navigate to new competition's Game Dashboard
- **APIs Required**:
  - `POST /join-competition` - Join by code/slug
- **Offline Support**: Show error message
- **Validation**: Required field, trim whitespace

#### **Screen 7: Game Dashboard (Competition Hub)**
- **Purpose**: Main navigation hub for a specific competition
- **Key Features**:
  - Header section:
    - Competition name and logo
    - Organizer contact (phone/email with action buttons)
    - Current round number
    - Active player count
  - Personal Status Card (if participant):
    - User status (In/Out/Eliminated/Winner)
    - Lives remaining
    - Current pick (if made)
  - Round Progress Card:
    - Pick completion: "X of Y players have picked"
    - Previous round results summary
    - "View Unpicked Players" button (shows modal list)
  - Action Buttons (large, prominent):
    - **PLAY** (primary action - large, centered)
      - Enabled if: User is active AND round is unlocked
      - Text changes: "Make Your Pick" or "Change Your Pick"
    - **RESULTS** (view current/previous round results)
    - **STANDINGS** (leaderboard)
  - Invite Friends Section:
    - Competition invite code (copy button)
    - Share button (WhatsApp/SMS/Email with pre-filled message)
  - Winner announcement banner (if competition complete)
  - Pull-to-refresh
- **APIs Required**:
  - `POST /get-competition-detail` - Full competition data
  - `POST /get-current-round` - Round status and fixtures
  - `POST /get-unpicked-players` - List of players who haven't picked
- **Offline Support**:
  - Cache competition detail
  - Show last known state with offline indicator
  - Disable actions requiring server updates
- **Navigation**:
  - PLAY → Make Your Pick screen
  - RESULTS → Player Results screen
  - STANDINGS → Standings screen

#### **Screen 8: Make Your Pick (Core Gameplay)**
- **Purpose**: Select a team for the current round
- **Key Features**:
  - Round information header:
    - Round number
    - Lock time countdown (live updates)
    - Time until lock in human-readable format ("2 days, 5 hours")
  - Fixture list:
    - Home vs Away for each fixture
    - Kickoff date/time for each fixture
    - Visual indicators for team eligibility:
      - **Allowed teams**: Full color, clickable
      - **Disallowed teams**: Grayed out, disabled (user already picked this team in previous round)
      - **Current pick**: Highlighted with checkmark
      - **Selected (not confirmed)**: Different highlight color
  - Team selection interaction:
    - Tap team → Shows in selected state
    - Confirmation banner appears: "You've selected [Team Name] - Confirm?"
    - "Confirm Pick" button (large, prominent)
    - "Cancel" button (secondary)
  - Pick removal:
    - If pick already confirmed, show "Remove Pick" option
    - Allows user to reselect
  - Help section (collapsible):
    - Rules reminder: "One team per round, can't reuse teams"
    - Lock timing explanation
    - Win/Loss/Draw rules
  - Auto-refresh:
    - Check lock status every 60 seconds
    - If round locks after pick, auto-navigate to Results
  - Error handling:
    - PICK_ALREADY_SET (allow change)
    - ROUND_LOCKED (redirect to Results)
    - TEAM_NOT_ALLOWED (shouldn't happen with client-side filtering)
- **APIs Required**:
  - `POST /get-current-round` - Fixtures and user's current pick
  - `POST /set-pick` - Submit/change pick
  - `POST /remove-pick` - Remove pick to reselect
  - `POST /get-allowed-teams` - Which teams user can pick (haven't used yet)
- **Offline Support**:
  - Show error: "You must be online to make a pick"
  - Cache allowed teams list
  - Show last known fixture data with offline indicator
- **State Management**:
  - Live countdown timer (local calculation from lock_time)
  - Optimistic UI updates (show pick immediately, rollback on error)
- **Validation**:
  - Client-side: Only allow selection of eligible teams
  - Server-side: Validate team eligibility, round lock status

#### **Screen 9: Player Results (Round Results View)**
- **Purpose**: View results after round lock, see how user's pick performed
- **Key Features**:
  - Round selector dropdown (view any past round)
  - Current round results (default view):
    - Match results with scores (if available)
    - Win/Loss/Draw indicators (green/red/yellow)
  - Team list (sorted by outcome, then pick count):
    - **Winning teams** (green background)
    - **Losing teams** (red background)
    - **Drawing teams** (yellow background)
    - **User's pick** (highlighted with blue border)
    - Pick count for each team: "X players picked [Team]"
  - User's pick outcome banner:
    - Large, prominent at top
    - "Your pick: [Team Name] - WON!" (green)
    - "Your pick: [Team Name] - LOST" (red)
    - "Your pick: [Team Name] - DREW" (yellow)
  - Fixture result status:
    - Pending (gray) - Results not yet in
    - Final (green/red) - Results confirmed
  - Pull-to-refresh
- **APIs Required**:
  - `POST /get-round-results` - Results for specific round
  - `POST /get-player-pick-for-round` - User's pick and outcome
- **Offline Support**:
  - Cache results for viewed rounds
  - Show cached data with offline indicator
- **Navigation**: Round selector updates view (no navigation)

#### **Screen 10: Standings (Leaderboard)**
- **Purpose**: View competition standings and player progress
- **Key Features**:
  - Grouped player display (collapsible sections):
    - **Champion** (1 player remaining - gold trophy icon)
    - **Active Players** (green - sorted by lives descending)
    - **Slipped Players** (yellow - lost but still have lives)
    - **Eliminated Players** (red - 0 lives remaining)
  - Each player card shows:
    - Display name
    - Lives remaining (hearts icon × count)
    - Current round pick (if made): Team name + outcome icon
    - "You" badge (for current user)
  - Search functionality:
    - Search icon in app bar
    - Opens search modal
    - Search by display name or email
    - Results list with same card format
    - Tap player → View Player History
  - Player History Modal:
    - Full name and email
    - Round-by-round picks:
      - Round number
      - Team picked
      - Fixture (Home vs Away)
      - Outcome (Win/Loss/Draw/Pending)
    - Sorted newest to oldest
    - Close button
  - "View My Pick History" button (quick access to own history)
  - Pull-to-refresh
  - Lazy loading/pagination for large player lists
- **APIs Required**:
  - `POST /get-competition-standings` - All players grouped by status
  - `POST /search-players` - Search by name/email
  - `POST /get-player-history` - Full pick history for specific player
- **Offline Support**:
  - Cache standings data
  - Show cached data with offline indicator
  - Disable search when offline
- **State Management**:
  - Collapsible sections: Persist expanded/collapsed state
  - Search: Debounce input (300ms)

#### **Screen 11: Waiting for Fixtures**
- **Purpose**: Holding screen when competition has no rounds yet
- **Key Features**:
  - Loading animation (spinner or custom)
  - Message: "Waiting for Round 1 fixtures..."
  - Sub-message: "Your organizer is setting up the competition. Check back soon!"
  - Auto-refresh every 30 seconds
  - Auto-navigate to Game Dashboard when fixtures detected
  - "Refresh" button (manual)
  - "Back to Dashboard" button
- **APIs Required**:
  - `POST /get-current-round` - Check if round exists (returns NOT_FOUND until created)
- **Offline Support**:
  - Show offline message
  - Disable auto-refresh
- **State Management**: Timer for auto-refresh, cancel on screen exit

---

### 2.3 User Profile & Settings

#### **Screen 12: Profile**
- **Purpose**: View and edit user account information
- **Key Features**:
  - Display name (editable)
  - Email (read-only, show with label)
  - Change password section:
    - Current password input
    - New password input (with strength indicator)
    - Confirm new password input
    - "Update Password" button
  - Email preferences:
    - Receive pick reminders (toggle)
    - Receive result notifications (toggle)
    - Receive competition updates (toggle)
  - **"Web Platform" button** (available to all users)
    - Opens web browser to web platform login page
    - URL: Environment-specific (dev/staging/prod)
    - Icon: Globe or external link icon
    - Label: "Open Web Platform" or "Full Website"
    - Users log in separately on web (no token passing for MVP)
    - Subtitle: "Organize competitions, manage settings, and more"
  - "Delete Account" button (with confirmation dialog)
  - "Sign Out" button
  - App version number (footer)
- **APIs Required**:
  - `POST /get-user-profile` - User data
  - `POST /update-display-name` - Change display name
  - `POST /change-password` - Update password
  - `POST /update-email-preferences` - Notification settings
  - `POST /delete-account` - Account deletion (requires confirmation)
- **Offline Support**:
  - Show cached profile data
  - Queue updates for when online
- **Validation**:
  - Display name: 2-50 characters
  - Password: Min 8 characters, strength validation
  - Confirm password: Must match

#### **Screen 13: Help & FAQ**
- **Purpose**: Player guidance and rules
- **Key Features**:
  - Searchable FAQ list
  - Categories:
    - Getting Started
    - Making Picks
    - Rules & Scoring
    - Account & Profile
    - Troubleshooting
  - Expandable answers
  - "Contact Support" button (email/web form)
  - Game rules summary:
    - One team per round
    - Can't reuse teams
    - Win = advance, Draw/Loss = life lost
    - Regulation time only (90 minutes)
- **APIs Required**: None (static content, can be bundled with app)
- **Offline Support**: Fully available offline

---

## 3. API Requirements

### 3.1 Authentication APIs
- `POST /login` - Email/password authentication → JWT token
- `POST /register` - Create account → JWT token
- `POST /forgot-password` - Send password recovery email

### 3.2 Competition APIs
- `POST /get-user-dashboard` - All competitions for user (organizer + participant)
- `POST /join-competition` - Join by invite code/slug
- `POST /get-competition-detail` - Full competition data
- `POST /set-competition-note` - Update personal note/alias
- `POST /remove-competition-from-dashboard` - Remove from view

### 3.3 Round & Pick APIs
- `POST /get-current-round` - Current round fixtures and status
- `POST /get-allowed-teams` - Teams user can pick (haven't used)
- `POST /set-pick` - Submit/change pick
- `POST /remove-pick` - Remove pick to reselect
- `POST /get-round-results` - Results for specific round
- `POST /get-player-pick-for-round` - User's pick and outcome

### 3.4 Standings & Player APIs
- `POST /get-competition-standings` - All players grouped by status
- `POST /get-unpicked-players` - Players who haven't picked current round
- `POST /search-players` - Search by name/email
- `POST /get-player-history` - Full pick history for player

### 3.5 Profile APIs
- `POST /get-user-profile` - User account data
- `POST /update-display-name` - Change display name
- `POST /change-password` - Update password
- `POST /update-email-preferences` - Notification settings
- `POST /delete-account` - Delete account

### 3.6 API Response Contract
**ALL APIs follow this pattern**:
- **HTTP Status**: Always 200 (even for errors)
- **Response Format**:
  ```json
  {
    "return_code": "SUCCESS" | "ERROR_TYPE",
    "message": "Optional user-friendly message",
    "data": { /* Response payload */ }
  }
  ```
- **Error Handling**: Client checks `return_code`, not HTTP status

---

## 4. Architecture & Technical Design

### 4.1 Flutter Architecture Pattern: **BLoC (Business Logic Component)**

#### Why BLoC?
- **Separation of Concerns**: UI, business logic, and data clearly separated
- **Testability**: Business logic can be tested independently
- **Reactive**: Stream-based state management (perfect for real-time updates)
- **Scalability**: Easy to add features without coupling
- **Flutter Best Practice**: Recommended by Flutter team for complex apps

#### Layer Structure:
```
lib/
├── main.dart                    # App entry point
├── app.dart                     # App widget with routing
│
├── config/                      # Environment configuration
│   ├── app_config.dart          # Config model and loader
│   ├── env_dev.dart             # Development environment
│   ├── env_staging.dart         # Staging environment (optional)
│   └── env_prod.dart            # Production environment
│
├── core/                        # Core utilities and constants
│   ├── constants/
│   │   ├── app_constants.dart   # App-wide constants (non-env specific)
│   │   └── colors.dart          # Color palette
│   ├── errors/
│   │   ├── exceptions.dart      # Custom exceptions
│   │   └── failures.dart        # Failure classes
│   ├── network/
│   │   ├── api_client.dart      # HTTP client (dio) with interceptors
│   │   └── network_info.dart    # Connectivity checking
│   └── utils/
│       ├── date_formatter.dart  # Date/time utilities
│       ├── validators.dart      # Input validation
│       └── secure_storage.dart  # JWT token storage
│
├── features/                    # Feature-based organization
│   ├── auth/
│   │   ├── data/
│   │   │   ├── models/          # Data models (from/to JSON)
│   │   │   ├── datasources/     # API calls
│   │   │   └── repositories/    # Repository implementation
│   │   ├── domain/
│   │   │   ├── entities/        # Business entities
│   │   │   ├── repositories/    # Repository interface
│   │   │   └── usecases/        # Business logic (login, register, etc.)
│   │   └── presentation/
│   │       ├── blocs/           # BLoC classes (state management)
│   │       ├── pages/           # Screen widgets
│   │       └── widgets/         # Reusable widgets
│   │
│   ├── dashboard/               # Competition list
│   │   ├── data/
│   │   ├── domain/
│   │   └── presentation/
│   │
│   ├── game/                    # Game dashboard, pick, results
│   │   ├── data/
│   │   ├── domain/
│   │   └── presentation/
│   │
│   ├── standings/               # Leaderboard
│   │   ├── data/
│   │   ├── domain/
│   │   └── presentation/
│   │
│   └── profile/                 # User profile
│       ├── data/
│       ├── domain/
│       └── presentation/
│
└── shared/                      # Shared widgets and utilities
    ├── widgets/
    │   ├── loading_indicator.dart
    │   ├── error_display.dart
    │   └── empty_state.dart
    └── theme/
        └── app_theme.dart       # Material 3 theme
```

### 4.2 Environment Configuration (CRITICAL)

**REQUIREMENT**: Never hardcode IP addresses or API URLs. Use environment-specific configuration files.

#### Configuration Architecture

The app uses a simple, effective environment configuration system that allows switching between development, staging, and production environments without code changes.

#### File Structure

**1. Config Model (`lib/config/app_config.dart`)**

```dart
/// Environment configuration model
/// Contains all environment-specific settings (API URLs, timeouts, features)
class AppConfig {
  final String apiBaseUrl;
  final String webBaseUrl;  // For organizer web platform access
  final String environment;
  final int apiTimeout;
  final bool enableLogging;
  final bool enableCertificatePinning;

  const AppConfig({
    required this.apiBaseUrl,
    required this.webBaseUrl,
    required this.environment,
    this.apiTimeout = 10000,
    this.enableLogging = false,
    this.enableCertificatePinning = false,
  });

  // Helper getters
  bool get isDevelopment => environment == 'development';
  bool get isStaging => environment == 'staging';
  bool get isProduction => environment == 'production';
}

/// Global singleton access to current configuration
class Config {
  static late AppConfig instance;

  static void initialize(AppConfig config) {
    instance = config;
  }
}
```

**2. Development Environment (`lib/config/env_dev.dart`)**

```dart
import 'app_config.dart';

/// Development environment configuration
/// Use this for local development and testing
const devConfig = AppConfig(
  apiBaseUrl: 'http://192.168.1.100:3015',  // Your local machine IP (API server)
  webBaseUrl: 'http://192.168.1.100:3000',  // Your local machine IP (Web app)
  environment: 'development',
  apiTimeout: 30000,  // Longer timeout for debugging
  enableLogging: true,  // Verbose logging in dev
  enableCertificatePinning: false,  // Disabled for local development
);

// Common development IP configurations (uncomment as needed):
// Local machine (Windows): 'http://192.168.1.100:3015'
// Local machine (Mac): 'http://192.168.1.50:3015'
// Android emulator accessing host: 'http://10.0.2.2:3015'
// iOS simulator accessing host: 'http://localhost:3015'
// Physical device on same network: 'http://192.168.1.XXX:3015'
```

**3. Staging Environment (`lib/config/env_staging.dart`)** - Optional

```dart
import 'app_config.dart';

/// Staging environment configuration
/// Use this for testing with staging server
const stagingConfig = AppConfig(
  apiBaseUrl: 'https://staging-api.lmslocal.co.uk',
  webBaseUrl: 'https://staging.lmslocal.co.uk',
  environment: 'staging',
  apiTimeout: 15000,
  enableLogging: true,
  enableCertificatePinning: false,  // Optional for staging
);
```

**4. Production Environment (`lib/config/env_prod.dart`)**

```dart
import 'app_config.dart';

/// Production environment configuration
/// Use this for production builds
const prodConfig = AppConfig(
  apiBaseUrl: 'https://api.lmslocal.co.uk',
  webBaseUrl: 'https://www.lmslocal.co.uk',
  environment: 'production',
  apiTimeout: 10000,
  enableLogging: false,  // No logging in production
  enableCertificatePinning: true,  // Security: Enable certificate pinning
);
```

#### Switching Environments

**Method 1: main.dart Switch (Recommended for Development)**

**File**: `lib/main.dart`

```dart
import 'package:flutter/material.dart';
import 'config/app_config.dart';
import 'config/env_dev.dart';
import 'config/env_staging.dart';
import 'config/env_prod.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // ========================================
  // ENVIRONMENT SELECTION
  // Change this line to switch environments
  // ========================================
  Config.initialize(devConfig);       // Development (local)
  // Config.initialize(stagingConfig);  // Staging server
  // Config.initialize(prodConfig);     // Production server

  // Initialize dependency injection
  await configureDependencies();

  runApp(const LMSLocalApp());
}
```

**Method 2: Compile-Time Environment Variables (Recommended for Production)**

```dart
import 'package:flutter/material.dart';
import 'config/app_config.dart';
import 'config/env_dev.dart';
import 'config/env_prod.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Use compile-time environment variable to determine config
  const environment = String.fromEnvironment('ENV', defaultValue: 'dev');

  final config = environment == 'prod' ? prodConfig : devConfig;
  Config.initialize(config);

  await configureDependencies();
  runApp(const LMSLocalApp());
}
```

**Build Commands**:
```bash
# Development build
flutter run

# Production build (iOS)
flutter build ios --dart-define=ENV=prod

# Production build (Android)
flutter build apk --dart-define=ENV=prod --release
```

#### Using Configuration Throughout the App

**In API Client (`lib/core/network/api_client.dart`)**

```dart
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:injectable/injectable.dart';
import '../../config/app_config.dart';  // Import config

@singleton
class ApiClient {
  final Dio _dio;
  final FlutterSecureStorage _secureStorage;

  ApiClient(this._dio, this._secureStorage) {
    // ✅ CORRECT: Use config, never hardcode
    _dio.options.baseUrl = Config.instance.apiBaseUrl;
    _dio.options.connectTimeout = Duration(milliseconds: Config.instance.apiTimeout);
    _dio.options.receiveTimeout = Duration(milliseconds: Config.instance.apiTimeout);

    // Enable logging only in development
    if (Config.instance.enableLogging) {
      _dio.interceptors.add(LogInterceptor(
        requestBody: true,
        responseBody: true,
      ));
    }

    // Request/Response interceptors...
  }
}
```

**In Other Files**

```dart
// Access anywhere in the app
import 'package:lmslocal/config/app_config.dart';
import 'package:url_launcher/url_launcher.dart';

// Get current API URL
final apiUrl = Config.instance.apiBaseUrl;

// Get web platform URL (for organizer tools)
final webUrl = Config.instance.webBaseUrl;

// Check environment
if (Config.instance.isDevelopment) {
  print('Running in development mode');
}

// Use timeout value
final timeout = Config.instance.apiTimeout;
```

#### JWT Token Passing for Seamless Web Authentication

**CRITICAL**: Users should not have to log in again when opening the web platform from the mobile app.

**Implementation Strategy**:

```dart
import 'package:url_launcher/url_launcher.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../config/app_config.dart';

/// Opens web platform with automatic authentication via JWT token
/// Users will be seamlessly logged in without re-entering credentials
Future<void> openWebPlatform({String? path}) async {
  final secureStorage = FlutterSecureStorage();

  // Get JWT token from secure storage
  final token = await secureStorage.read(key: 'jwt_token');

  if (token == null) {
    // User not authenticated - shouldn't happen, but handle gracefully
    print('[WebPlatform] No token found - user not authenticated');
    return;
  }

  // Build URL with JWT token as query parameter
  // Web app will read this token and store in localStorage for session
  final baseUrl = Config.instance.webBaseUrl;
  final targetPath = path ?? '/dashboard';

  // Option 1: Pass token via URL parameter (simple but exposes token in URL)
  final url = Uri.parse('$baseUrl$targetPath?token=$token');

  // Option 2: Use custom URL scheme for more secure token passing (advanced)
  // final url = Uri.parse('lmslocal://auth?token=$token&redirect=$targetPath');

  if (await canLaunchUrl(url)) {
    await launchUrl(
      url,
      mode: LaunchMode.externalApplication,  // Opens in external browser
      // mode: LaunchMode.inAppWebView,  // Alternative: In-app WebView with WebViewController for JS injection
    );
  } else {
    print('[WebPlatform] Could not launch URL: $url');
  }
}

/// Example usage: Open web dashboard
Future<void> openWebDashboard() async {
  await openWebPlatform(path: '/dashboard');
}

/// Example usage: Open competition management
Future<void> openWebCompetition(String competitionId) async {
  await openWebPlatform(path: '/competition/$competitionId/manage');
}

/// Example usage: Open create competition
Future<void> openCreateCompetition() async {
  await openWebPlatform(path: '/competition/create');
}
```

**Web Application Implementation (Frontend)**:

The web app needs to handle the incoming token:

```javascript
// On web app load (e.g., in _app.tsx or layout component)
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  if (token) {
    // Store token in localStorage
    localStorage.setItem('token', token);

    // Clean URL (remove token from address bar for security)
    const cleanUrl = window.location.pathname + window.location.hash;
    window.history.replaceState({}, document.title, cleanUrl);

    // Redirect to dashboard or intended page
    // User is now authenticated!
  }
}, []);
```

**Alternative: In-App WebView with JavaScript Injection** (More Secure):

```dart
import 'package:webview_flutter/webview_flutter.dart';

Future<void> openWebPlatformSecure({String? path}) async {
  final secureStorage = FlutterSecureStorage();
  final token = await secureStorage.read(key: 'jwt_token');

  if (token == null) return;

  final baseUrl = Config.instance.webBaseUrl;
  final targetPath = path ?? '/dashboard';

  // Open in-app WebView
  Navigator.push(
    context,
    MaterialPageRoute(
      builder: (context) => WebViewScreen(
        url: '$baseUrl$targetPath',
        token: token,
      ),
    ),
  );
}

class WebViewScreen extends StatefulWidget {
  final String url;
  final String token;

  const WebViewScreen({required this.url, required this.token});

  @override
  State<WebViewScreen> createState() => _WebViewScreenState();
}

class _WebViewScreenState extends State<WebViewScreen> {
  late final WebViewController _controller;

  @override
  void initState() {
    super.initState();

    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageFinished: (String url) {
            // Inject token into localStorage via JavaScript
            _controller.runJavaScript(
              "localStorage.setItem('token', '${widget.token}');"
            );
          },
        ),
      )
      ..loadRequest(Uri.parse(widget.url));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('LMS Local'),
        actions: [
          IconButton(
            icon: Icon(Icons.open_in_browser),
            onPressed: () async {
              // Open current page in external browser
              final url = await _controller.currentUrl();
              if (url != null) {
                launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
              }
            },
          ),
        ],
      ),
      body: WebViewWidget(controller: _controller),
    );
  }
}
```

**Recommended Approach**:

1. **Development/Testing**: Use URL parameter method (simple, fast iteration)
2. **Production**: Use In-App WebView with JavaScript injection (more secure, token not exposed in URL)
3. **Alternative**: Implement custom URL scheme handler on web app (most secure)

**Security Considerations**:

- **URL Parameter Method**: Token visible in browser history/logs - acceptable for short-lived tokens
- **In-App WebView**: Token never exposed in URL - preferred for production
- **Token Expiration**: Ensure JWT tokens have reasonable expiration (e.g., 24 hours)
- **HTTPS Only**: Always use HTTPS in production to encrypt token transmission

---

#### Quick IP Address Changes During Development

**Common Scenarios**:

1. **Testing on Physical Device (Same WiFi)**:
   ```dart
   // env_dev.dart
   apiBaseUrl: 'http://192.168.1.100:3015',  // Your PC's local IP
   ```

2. **Testing on Android Emulator**:
   ```dart
   // env_dev.dart
   apiBaseUrl: 'http://10.0.2.2:3015',  // Special Android emulator IP
   ```

3. **Testing on iOS Simulator**:
   ```dart
   // env_dev.dart
   apiBaseUrl: 'http://localhost:3015',  // iOS simulator can use localhost
   ```

4. **Testing with Remote Server**:
   ```dart
   // env_dev.dart
   apiBaseUrl: 'https://dev.lmslocal.co.uk',  // Remote dev server
   ```

**To switch**: Simply change the IP address in `env_dev.dart` and hot reload/restart the app. No code changes needed anywhere else!

#### Best Practices

1. **Never commit sensitive data**: If using API keys, add them to `.gitignore`
2. **Use descriptive comments**: Document what each IP address is for
3. **Keep config DRY**: Don't duplicate configuration values
4. **Default to safe values**: Default to dev/staging, never production
5. **Validate config on startup**: Add assertions to ensure config is loaded

#### .gitignore Considerations

If you have sensitive configuration (API keys, secrets), create a local override:

```
# .gitignore (add this line)
lib/config/env_local.dart
```

Then developers can create their own `env_local.dart` with their specific IP addresses.

#### Configuration Validation (Optional but Recommended)

Add to `main.dart`:

```dart
void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  Config.initialize(devConfig);

  // Validate configuration on startup
  _validateConfig();

  await configureDependencies();
  runApp(const LMSLocalApp());
}

void _validateConfig() {
  final config = Config.instance;

  assert(config.apiBaseUrl.isNotEmpty, 'API base URL cannot be empty');
  assert(config.apiTimeout > 0, 'API timeout must be positive');

  // Log current configuration (dev only)
  if (config.isDevelopment) {
    print('===========================================');
    print('Environment: ${config.environment}');
    print('API Base URL: ${config.apiBaseUrl}');
    print('API Timeout: ${config.apiTimeout}ms');
    print('Logging: ${config.enableLogging}');
    print('===========================================');
  }
}
```

---

### 4.3 State Management Details

#### BLoC Pattern for Each Feature:
```dart
// Example: Dashboard BLoC

// Events (user actions)
abstract class DashboardEvent {}
class LoadDashboard extends DashboardEvent {}
class RefreshDashboard extends DashboardEvent {}
class UpdateCompetitionNote extends DashboardEvent {
  final String competitionId;
  final String note;
}

// States (UI states)
abstract class DashboardState {}
class DashboardInitial extends DashboardState {}
class DashboardLoading extends DashboardState {}
class DashboardLoaded extends DashboardState {
  final List<Competition> competitions;
}
class DashboardError extends DashboardState {
  final String message;
}

// BLoC (business logic)
class DashboardBloc extends Bloc<DashboardEvent, DashboardState> {
  final GetUserDashboard getUserDashboard;
  final UpdateNote updateNote;

  DashboardBloc({
    required this.getUserDashboard,
    required this.updateNote,
  }) : super(DashboardInitial()) {
    on<LoadDashboard>(_onLoadDashboard);
    on<RefreshDashboard>(_onRefreshDashboard);
    on<UpdateCompetitionNote>(_onUpdateNote);
  }

  // Event handlers with business logic
}
```

### 4.4 Data Layer (Repository Pattern)

#### Repository Interface (Domain Layer):
```dart
abstract class CompetitionRepository {
  Future<Either<Failure, List<Competition>>> getUserCompetitions();
  Future<Either<Failure, Competition>> getCompetitionDetail(String id);
  Future<Either<Failure, void>> updateCompetitionNote(String id, String note);
}
```

#### Repository Implementation (Data Layer):
```dart
class CompetitionRepositoryImpl implements CompetitionRepository {
  final CompetitionRemoteDataSource remoteDataSource;
  final CompetitionLocalDataSource localDataSource;
  final NetworkInfo networkInfo;

  @override
  Future<Either<Failure, List<Competition>>> getUserCompetitions() async {
    if (await networkInfo.isConnected) {
      try {
        final result = await remoteDataSource.getUserCompetitions();
        await localDataSource.cacheCompetitions(result);
        return Right(result);
      } catch (e) {
        return Left(ServerFailure());
      }
    } else {
      try {
        final cached = await localDataSource.getCachedCompetitions();
        return Right(cached);
      } catch (e) {
        return Left(CacheFailure());
      }
    }
  }
}
```

### 4.5 Navigation

#### GoRouter for Declarative Routing:
```dart
final router = GoRouter(
  routes: [
    GoRoute(
      path: '/',
      builder: (context, state) => SplashScreen(),
    ),
    GoRoute(
      path: '/login',
      builder: (context, state) => LoginScreen(),
    ),
    GoRoute(
      path: '/dashboard',
      builder: (context, state) => DashboardScreen(),
    ),
    GoRoute(
      path: '/game/:id',
      builder: (context, state) {
        final id = state.pathParameters['id']!;
        return GameDashboardScreen(competitionId: id);
      },
      routes: [
        GoRoute(
          path: 'pick',
          builder: (context, state) {
            final id = state.pathParameters['id']!;
            return MakePickScreen(competitionId: id);
          },
        ),
        GoRoute(
          path: 'results',
          builder: (context, state) {
            final id = state.pathParameters['id']!;
            return ResultsScreen(competitionId: id);
          },
        ),
        GoRoute(
          path: 'standings',
          builder: (context, state) {
            final id = state.pathParameters['id']!;
            return StandingsScreen(competitionId: id);
          },
        ),
      ],
    ),
  ],
  redirect: (context, state) {
    // Auth guard logic
    final authBloc = context.read<AuthBloc>();
    final isAuthenticated = authBloc.state is AuthAuthenticated;

    if (!isAuthenticated && !state.matchedLocation.startsWith('/login')) {
      return '/login';
    }
    return null;
  },
);
```

### 4.6 API Client Implementation (401 Handling)

#### Dio HTTP Client with JWT Interceptors

The API client is the critical component that handles JWT token injection and automatic 401 redirect logic.

**File**: `lib/core/network/api_client.dart`

```dart
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:injectable/injectable.dart';
import '../../config/app_config.dart';  // Import config

@singleton
class ApiClient {
  final Dio _dio;
  final FlutterSecureStorage _secureStorage;

  // Callback for navigation - set by app initialization
  Function(String)? onUnauthorized;

  ApiClient(this._dio, this._secureStorage) {
    // ✅ CORRECT: Use config, never hardcode
    _dio.options.baseUrl = Config.instance.apiBaseUrl;
    _dio.options.connectTimeout = Duration(milliseconds: Config.instance.apiTimeout);
    _dio.options.receiveTimeout = Duration(milliseconds: Config.instance.apiTimeout);

    // Request interceptor - inject JWT token
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          // Get token from secure storage
          final token = await _secureStorage.read(key: 'jwt_token');

          if (token != null) {
            // Inject token into Authorization header
            options.headers['Authorization'] = 'Bearer $token';
          }

          return handler.next(options);
        },

        // Response interceptor - handle 401 automatically
        onError: (DioException error, handler) async {
          if (error.response?.statusCode == 401) {
            // Token expired or invalid - perform cleanup
            await _handleUnauthorized();

            // Don't propagate 401 error to UI
            // Instead, navigation callback will redirect to login
            return handler.reject(
              DioException(
                requestOptions: error.requestOptions,
                error: 'Session expired',
                type: DioExceptionType.cancel,
              ),
            );
          }

          return handler.next(error);
        },
      ),
    );
  }

  Future<void> _handleUnauthorized() async {
    try {
      // 1. Clear JWT token
      await _secureStorage.delete(key: 'jwt_token');

      // 2. Clear cached user data (handled by cache service)
      // Note: This will be called via dependency injection

      // 3. Trigger navigation to login page
      if (onUnauthorized != null) {
        onUnauthorized!('Your session has expired. Please log in again.');
      }

      print('[ApiClient] 401 Unauthorized - User logged out and redirected');
    } catch (e) {
      print('[ApiClient] Error during unauthorized cleanup: $e');
    }
  }

  // Public API methods
  Future<Response> post(String path, {Map<String, dynamic>? data}) async {
    return await _dio.post(path, data: data);
  }

  Future<Response> get(String path, {Map<String, dynamic>? queryParameters}) async {
    return await _dio.get(path, queryParameters: queryParameters);
  }
}
```

#### Integration with Auth BLoC

**File**: `lib/features/auth/presentation/blocs/auth_bloc.dart`

```dart
class AuthBloc extends Bloc<AuthEvent, AuthState> {
  final ApiClient apiClient;
  final SecureStorage secureStorage;
  final GoRouter router;

  AuthBloc({
    required this.apiClient,
    required this.secureStorage,
    required this.router,
  }) : super(AuthInitial()) {
    // Register 401 callback during initialization
    apiClient.onUnauthorized = _handleSessionExpired;

    on<CheckAuthStatus>(_onCheckAuthStatus);
    on<LoginRequested>(_onLoginRequested);
    on<LogoutRequested>(_onLogoutRequested);
    on<SessionExpired>(_onSessionExpired);
  }

  void _handleSessionExpired(String message) {
    // Emit session expired event
    add(SessionExpired(message: message));

    // Navigate to login
    router.go('/login');
  }

  Future<void> _onSessionExpired(
    SessionExpired event,
    Emitter<AuthState> emit,
  ) async {
    // Clear any cached data
    await secureStorage.deleteAll();

    // Emit unauthenticated state with message
    emit(AuthUnauthenticated(message: event.message));
  }
}
```

#### App Initialization with 401 Handling

**File**: `lib/main.dart`

```dart
void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize dependency injection
  await configureDependencies();

  runApp(const LMSLocalApp());
}

class LMSLocalApp extends StatelessWidget {
  const LMSLocalApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider<AuthBloc>(
          create: (context) => getIt<AuthBloc>()
            ..add(CheckAuthStatus()),
        ),
        // Other BLoCs...
      ],
      child: BlocListener<AuthBloc, AuthState>(
        listener: (context, state) {
          // Show toast when session expires
          if (state is AuthUnauthenticated && state.message != null) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(state.message!),
                backgroundColor: Colors.orange,
                duration: const Duration(seconds: 3),
              ),
            );
          }
        },
        child: MaterialApp.router(
          title: 'LMS Local',
          theme: AppTheme.lightTheme,
          routerConfig: getIt<GoRouter>(),
        ),
      ),
    );
  }
}
```

#### Key Implementation Details

1. **Automatic Token Injection**: Every API request automatically includes JWT token (if exists)
2. **401 Interception**: Dio interceptor catches 401 responses before they reach the UI
3. **Cleanup Sequence**: Token deleted → Cache cleared → Auth state reset → Navigate to login
4. **User Feedback**: Toast notification explains why they were logged out
5. **No Error Propagation**: 401 errors never bubble up to BLoC/UI layer - handled silently
6. **Thread-Safe**: Async/await pattern ensures proper cleanup order
7. **Testable**: Callback pattern allows mocking in unit tests

---

## 5. Security Considerations

### 5.1 Token Management

#### Storage & Lifecycle
- **Storage**: Use `flutter_secure_storage` for JWT token (encrypted at rest)
- **Injection**: Automatic token injection via Dio interceptors (all authenticated requests)
- **Lifecycle**: Token stored on successful login/register, cleared on logout/401

#### Expiration Handling (CRITICAL)
**REQUIREMENT**: Never show 401 errors to users. Instead, automatically redirect to login page.

- **401 Detection**: Dio response interceptor catches all 401 Unauthorized responses
- **Automatic Cleanup**:
  1. Clear JWT token from secure storage
  2. Clear all cached user data (Hive)
  3. Reset auth state (BLoC emits Unauthenticated state)
  4. Navigate to login screen with session expired message
- **User Experience**: Show toast: "Your session has expired. Please log in again."
- **No Error Screens**: Users never see "401" or "Unauthorized" - seamless redirect instead

#### Token Expiration Scenarios
- **API Response**: Server returns 401 when token expired/invalid
- **Client-Side Check**: Optional - decode JWT and check expiration before API calls
- **Refresh Token**: If implemented, attempt silent refresh before redirecting to login

### 5.2 API Security
- **HTTPS Only**: Enforce SSL certificate validation
- **Certificate Pinning**: Pin server certificate to prevent MITM attacks (production only)
- **Request Validation**: Validate all user inputs client-side before sending
- **Sensitive Data**: Never log tokens, passwords, or PII in production

### 5.3 Input Validation
- **Client-Side**: Immediate feedback for user (email format, password strength)
- **Server-Side**: Trust server validation as source of truth
- **Sanitization**: Trim whitespace, escape special characters where needed

### 5.4 Permissions
- **Minimal Permissions**: Only request necessary permissions (internet, storage)
- **No Sensitive Permissions**: No camera, location, contacts, etc.
- **Runtime Permissions**: Handle gracefully on Android 6.0+

---

## 6. Performance Optimization

### 6.1 Caching Strategy

#### Local Database: **Hive** (Fast, lightweight NoSQL)
```dart
// Cache structure
@HiveType(typeId: 0)
class CompetitionCache {
  @HiveField(0)
  String id;

  @HiveField(1)
  String data; // JSON string

  @HiveField(2)
  DateTime cachedAt;

  @HiveField(3)
  int ttl; // Time to live in seconds

  bool get isExpired => DateTime.now().difference(cachedAt).inSeconds > ttl;
}
```

#### Cache Strategy by Screen:
| Screen | Cache TTL | Refresh Strategy |
|--------|----------|------------------|
| Dashboard | 5 minutes | Pull-to-refresh + app resume |
| Game Dashboard | 2 minutes | Pull-to-refresh + periodic (60s) |
| Make Pick | 1 minute | Periodic (60s) + manual |
| Results | 10 minutes | Pull-to-refresh + round change |
| Standings | 5 minutes | Pull-to-refresh |
| Profile | 30 minutes | Manual refresh only |

### 6.2 Image Optimization
- **Caching**: Use `cached_network_image` package
- **Compression**: Compress uploaded images (logo, etc.)
- **Lazy Loading**: Load images as user scrolls (standings, player lists)
- **Placeholders**: Show skeleton/shimmer while loading

### 6.3 List Rendering
- **Lazy Loading**: Use `ListView.builder` for large lists
- **Pagination**: Load standings/player lists in chunks (20-50 per page)
- **Virtual Scrolling**: Only render visible items

### 6.4 Network Optimization
- **Request Batching**: Combine related API calls where possible
- **Debouncing**: Search inputs (300ms delay)
- **Throttling**: Limit rapid-fire requests (pull-to-refresh)
- **Compression**: Enable gzip compression (Dio supports automatically)

### 6.5 Build Optimization
- **Code Splitting**: Lazy load features not needed at startup
- **Tree Shaking**: Remove unused code (enabled by default in release builds)
- **Minification**: Enable in release build
- **ProGuard**: Obfuscate code (Android release)

---

## 7. Offline Capabilities

### 7.1 Offline-First Features
- **View Cached Data**: Dashboard, game details, standings, results
- **Read-Only Mode**: All view screens work offline with cached data
- **Offline Indicator**: Clear visual indicator when offline (top banner)

### 7.2 Offline Limitations
- **No Picks**: Cannot make/change picks offline (requires server validation)
- **No Authentication**: Cannot login/register offline
- **No Updates**: Profile updates, note changes queued until online
- **No Search**: Player search disabled offline

### 7.3 Sync Strategy
- **On Reconnect**: Auto-refresh dashboard + current game
- **Queue Writes**: Store failed write operations, retry on reconnect
- **Conflict Resolution**: Server wins (no client-side conflicts expected)

### 7.4 Connectivity Detection
```dart
class NetworkInfo {
  final Connectivity connectivity;

  Future<bool> get isConnected async {
    final result = await connectivity.checkConnectivity();
    return result != ConnectivityResult.none;
  }

  Stream<bool> get onConnectivityChanged {
    return connectivity.onConnectivityChanged.map(
      (result) => result != ConnectivityResult.none,
    );
  }
}
```

---

## 8. UI/UX Design Guidelines

### 8.1 Design System

#### Material 3 Theme (Primary)
- **Color Palette**:
  - Primary: #1E40AF (Blue 800) - Matches web app
  - Secondary: #10B981 (Green 500)
  - Error: #EF4444 (Red 500)
  - Warning: #F59E0B (Amber 500)
  - Surface: #FFFFFF
  - Background: #F9FAFB
- **Typography**:
  - Headlines: Roboto Bold
  - Body: Roboto Regular
  - Captions: Roboto Light
- **Spacing**: 4px base unit (4, 8, 12, 16, 24, 32, 48)
- **Border Radius**: 8px (cards), 24px (buttons)

#### iOS Cupertino Adaptations (Secondary)
- Use `CupertinoApp` wrapper for iOS-specific widgets
- Navigation: Cupertino style on iOS, Material on Android
- Switches/Toggles: Platform-specific

### 8.2 Component Library (Shared Widgets)

**CRITICAL ARCHITECTURE RULE**: Keep UI/UX code isolated in individual page files. Avoid global UI settings that could break existing pages.

#### What CAN Be Shared (Generic Utilities Only):

**✅ Safe to Share**:
- **LoadingIndicator**: Generic circular progress with optional message
- **ErrorDisplay**: Generic error icon + message + retry button
- **EmptyState**: Generic icon + message + call-to-action
- **ConfirmationDialog**: Generic reusable confirmation modal

These are **dumb components** - they receive data/callbacks and render UI, but contain no business logic or page-specific styling.

#### What SHOULD NOT Be Shared (Page-Specific UI):

**❌ Do NOT Share**:
- **CompetitionCard**: Keep in Dashboard page file (competition-specific logic)
- **PlayerCard**: Keep in Standings page file (player-specific logic)
- **FixtureCard**: Keep in Make Pick page file (fixture-specific logic)
- **StatusBadge**: Keep in individual pages where used (context-specific)
- **PickStatusIndicator**: Keep in individual pages where used (context-specific)

**Why?**: Page-specific components contain business logic, context-specific styling, and behavior that's unique to one screen. Sharing them creates:
- ❌ Tight coupling between pages
- ❌ Risk of breaking changes when updating one page
- ❌ Difficulty maintaining and debugging
- ❌ Unexpected side effects from "global" UI changes

#### Component Development Guidelines:

1. **Start Local**: Always build UI components directly in the page file first
2. **Only Extract When Truly Generic**: Only move to shared folder if component is:
   - Used in 3+ different pages
   - Completely generic (no page-specific logic)
   - Stable (unlikely to change based on page requirements)
3. **No Global UI State**: Avoid global settings for:
   - Text sizes (use theme, but override in pages as needed)
   - Colors (use theme, but override in pages as needed)
   - Spacing/padding (define per-page)
   - Layout logic (keep in individual pages)
4. **Pass Everything as Props**: Shared components should receive all data and callbacks as parameters
5. **No Side Effects**: Shared components should not modify global state or make API calls

#### Example: CompetitionCard (KEEP IN DASHBOARD PAGE)

```dart
// ❌ WRONG: Don't create as shared widget
// File: lib/shared/widgets/competition_card.dart

// ✅ CORRECT: Keep in Dashboard page
// File: lib/features/dashboard/presentation/pages/dashboard_page.dart

class DashboardPage extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: ListView(
        children: competitions.map((comp) =>
          // CompetitionCard defined right here in this file
          _buildCompetitionCard(comp)
        ).toList(),
      ),
    );
  }

  Widget _buildCompetitionCard(Competition competition) {
    // All competition card UI and logic stays in this page
    return Card(
      child: ListTile(
        title: Text(competition.name),
        subtitle: Text('Round ${competition.currentRound}'),
        trailing: _buildPickStatusBadge(competition),
        onTap: () => _navigateToGame(competition.id),
      ),
    );
  }

  Widget _buildPickStatusBadge(Competition competition) {
    // Badge logic specific to dashboard context
    // ...
  }
}
```

#### Example: LoadingIndicator (SAFE TO SHARE)

```dart
// ✅ CORRECT: Generic utility component
// File: lib/shared/widgets/loading_indicator.dart

class LoadingIndicator extends StatelessWidget {
  final String? message;

  const LoadingIndicator({this.message});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          CircularProgressIndicator(),
          if (message != null) ...[
            SizedBox(height: 16),
            Text(message!),
          ],
        ],
      ),
    );
  }
}

// Used in any page:
// LoadingIndicator(message: 'Loading competitions...')
```

**Summary**: Default to keeping UI code in individual page files. Only extract truly generic, reusable components to shared folder. This prevents cross-page dependencies and ensures changes to one page never break another.

---

### 8.3 Accessibility
- **Screen Reader Support**: All interactive elements have semantic labels
- **Contrast Ratios**: WCAG AA compliance (4.5:1 minimum)
- **Touch Targets**: Minimum 48x48 dp
- **Font Scaling**: Support dynamic type/font scaling
- **Haptic Feedback**: Subtle feedback on actions (iOS)

### 8.4 Animations & Transitions
- **Page Transitions**: Slide (Android), Cupertino (iOS)
- **Loading States**: Shimmer effect for skeletons
- **Success Actions**: Checkmark animation (pick submitted)
- **Error States**: Shake animation (validation errors)
- **Duration**: 200-300ms (fast, responsive feel)

---

## 9. Error Handling & User Feedback

### 9.1 Error Categories

#### Authentication/Session Errors:
- **401 Unauthorized (Token Expired)**: **NEVER** shown to user
  - **Handling**: Automatic silent logout + redirect to login
  - **User Message**: Toast notification: "Your session has expired. Please log in again."
  - **Implementation**: Dio interceptor catches 401 before reaching UI (see Section 4.6)
- **Invalid Credentials**: "Invalid email or password"
- **Account Not Found**: "No account found with this email"

#### Network Errors:
- **No Internet**: "You're offline. Some features are unavailable."
- **Timeout**: "Request timed out. Please try again."
- **Server Error**: "Something went wrong. We're working on it."

#### Validation Errors:
- **Invalid Input**: Show inline error below field (red text)
- **Required Field**: "This field is required"
- **Format Error**: "Please enter a valid email address"

#### Business Logic Errors (from API):
- **COMPETITION_NOT_FOUND**: "Competition not found. Check your invite code."
- **ROUND_LOCKED**: "This round is locked. You can no longer make picks."
- **TEAM_NOT_ALLOWED**: "You've already picked this team in a previous round."
- **COMPETITION_FULL**: "This competition is full."

### 9.2 User Feedback Mechanisms

#### Toast Messages (Temporary):
- Success: "Pick submitted successfully!"
- Info: "Competition note updated"
- Warning: "Round locks in 1 hour"
- Session Expired: "Your session has expired. Please log in again." (orange background)

#### Snackbars (Actionable):
- Error with retry: "Failed to load data" [Retry]
- Undo actions: "Removed from dashboard" [Undo]

#### Dialogs (Confirmation):
- Delete account: "Are you sure? This cannot be undone."
- Sign out: "Sign out of LMS Local?"

#### Loading States:
- Inline spinners: Small actions (submit pick)
- Full-screen overlay: Major actions (login, registration)
- Skeleton screens: Data loading (dashboard, standings)

---

## 10. Testing Strategy

### 10.1 Unit Tests
- **Coverage Target**: 80%+
- **Test Scope**:
  - BLoC event handlers
  - Use cases (business logic)
  - Repositories
  - Utilities (validators, formatters)
- **Tools**: `flutter_test`, `mocktail`

### 10.2 Widget Tests
- **Coverage Target**: 60%+
- **Test Scope**:
  - Screen rendering
  - User interactions (tap, scroll, input)
  - State changes (loading, error, success)
- **Tools**: `flutter_test`, `golden_toolkit` (visual regression)

### 10.3 Integration Tests
- **Coverage Target**: Key user flows
- **Test Scenarios**:
  - Login → Dashboard → Game → Make Pick
  - Join Competition flow
  - View Results → View Standings
- **Tools**: `integration_test` package

### 10.4 Manual Testing Checklist
- [ ] Environment configuration (verify dev/staging/prod configs work correctly)
- [ ] Authentication flows (login, register, logout, session expiration)
- [ ] 401 handling (force token expiration, verify auto-redirect to login with toast)
- [ ] Dashboard CRUD (view, refresh, join, delete)
- [ ] Web platform link (opens web login page based on environment - dev/staging/prod)
- [ ] Pick flow (select team, confirm, remove, change)
- [ ] Results viewing (current round, past rounds)
- [ ] Standings (groups, search, player history)
- [ ] Profile updates (name, password, preferences)
- [ ] Offline mode (cached data, sync on reconnect)
- [ ] Error scenarios (no internet, server errors)
- [ ] Performance (smooth scrolling, fast navigation)

---

## 11. Development Phases

### Phase 1: Foundation (Weeks 1-2)
**Goal**: Setup + Authentication

**CRITICAL**: Establish UI isolation pattern from the start - keep all UI/UX code in individual page files (see Section 8.2)

- [ ] Project setup (Flutter SDK, dependencies)
- [ ] Folder structure (BLoC architecture)
- [ ] Environment configuration:
  - [ ] Create config/ directory
  - [ ] app_config.dart (config model)
  - [ ] env_dev.dart (development config with local IP)
  - [ ] env_prod.dart (production config)
  - [ ] Integration in main.dart
- [ ] Core utilities (API client with config integration, secure storage, network info)
- [ ] Design system (theme, colors, typography)
- [ ] Splash screen
- [ ] Login screen + API integration
- [ ] Register screen + API integration
- [ ] Forgot password screen
- [ ] JWT token management:
  - [ ] Secure storage (flutter_secure_storage)
  - [ ] Automatic injection via Dio interceptors
  - [ ] 401 handler (auto-logout + redirect to login)
  - [ ] Session expired toast notification
- [ ] Unit tests for auth

### Phase 2: Dashboard & Navigation (Weeks 3-4)
**Goal**: Main hub + competition joining
- [ ] Dashboard screen (competition list)
- [ ] Competition card widget
- [ ] Pull-to-refresh
- [ ] Join competition modal
- [ ] Web platform link (available to all users):
  - [ ] Profile menu integration
  - [ ] url_launcher implementation
  - [ ] Environment-based URL (uses Config.instance.webBaseUrl)
  - [ ] Simple link to web login page (no token passing for MVP)
  - [ ] Optional Phase 2: JWT token passing for seamless authentication
- [ ] Navigation setup (GoRouter)
- [ ] Caching layer (Hive setup)
- [ ] Offline indicator
- [ ] Unit + widget tests

### Phase 3: Game Screens (Weeks 5-7)
**Goal**: Core gameplay functionality
- [ ] Game Dashboard screen
- [ ] Make Your Pick screen
  - [ ] Fixture list
  - [ ] Team selection
  - [ ] Allowed/disallowed teams logic
  - [ ] Pick submission
  - [ ] Lock time countdown
- [ ] Player Results screen
  - [ ] Round selector
  - [ ] Match results display
  - [ ] User pick outcome
- [ ] Waiting for Fixtures screen
- [ ] API integrations for all game screens
- [ ] Offline caching for game data
- [ ] Unit + widget tests

### Phase 4: Standings & Player Features (Week 8)
**Goal**: Leaderboard and player insights
- [ ] Standings screen
  - [ ] Grouped player display
  - [ ] Collapsible sections
  - [ ] Player cards
- [ ] Search functionality
- [ ] Player history modal
- [ ] API integrations
- [ ] Pagination/lazy loading
- [ ] Unit + widget tests

### Phase 5: Profile & Settings (Week 9)
**Goal**: User account management
- [ ] Profile screen
- [ ] Update display name
- [ ] Change password
- [ ] Email preferences
- [ ] Web platform button (available to all users, seamless JWT authentication)
- [ ] Delete account
- [ ] Sign out
- [ ] API integrations
- [ ] Unit + widget tests

### Phase 6: Polish & Optimization (Week 10)
**Goal**: Performance, UX, error handling
- [ ] Image optimization (caching, compression)
- [ ] List performance (lazy loading, pagination)
- [ ] Error handling (comprehensive coverage)
- [ ] Loading states (skeletons, shimmer)
- [ ] Empty states
- [ ] Animations & transitions
- [ ] Accessibility audit
- [ ] Performance profiling (DevTools)

### Phase 7: Testing & QA (Week 11)
**Goal**: Comprehensive testing
- [ ] Integration tests (key user flows)
- [ ] Manual testing (all screens, all scenarios)
- [ ] Offline mode testing
- [ ] Error scenario testing
- [ ] Performance testing (large data sets)
- [ ] Security audit (token management, HTTPS)
- [ ] Bug fixes

### Phase 8: Deployment Prep (Week 12)
**Goal**: Release readiness
- [ ] App icons (iOS + Android)
- [ ] Splash screens (iOS + Android)
- [ ] App store assets (screenshots, descriptions)
- [ ] Privacy policy integration
- [ ] Terms of service integration
- [ ] Build release APK (Android)
- [ ] Build release IPA (iOS)
- [ ] App store submission (Google Play + Apple App Store)
- [ ] Beta testing (TestFlight, Google Play Beta)

---

## 12. Dependencies & Packages

### 12.1 Core Dependencies
```yaml
dependencies:
  flutter:
    sdk: flutter

  # State Management
  flutter_bloc: ^8.1.3
  equatable: ^2.0.5

  # Networking
  dio: ^5.4.0
  connectivity_plus: ^5.0.2

  # Storage
  flutter_secure_storage: ^9.0.0
  hive: ^2.2.3
  hive_flutter: ^1.1.0

  # Navigation
  go_router: ^13.0.0

  # UI
  cached_network_image: ^3.3.0
  flutter_svg: ^2.0.9
  shimmer: ^3.0.0

  # Utilities
  intl: ^0.18.1  # Date formatting
  dartz: ^0.10.1  # Either type (functional programming)
  url_launcher: ^6.2.2  # Open web URLs (for web platform)

  # Error Tracking & Monitoring
  firebase_core: ^2.24.2  # Firebase core (required for Crashlytics)
  firebase_crashlytics: ^3.4.8  # Crash reporting and error tracking

  # Dependency Injection
  get_it: ^7.6.4
  injectable: ^2.3.2

dev_dependencies:
  flutter_test:
    sdk: flutter

  # Testing
  mocktail: ^1.0.1
  bloc_test: ^9.1.5
  integration_test:
    sdk: flutter

  # Code Generation
  build_runner: ^2.4.6
  hive_generator: ^2.0.1
  injectable_generator: ^2.4.1

  # Linting
  flutter_lints: ^3.0.1
```

### 12.2 Platform-Specific Configuration

#### Android (android/app/build.gradle):
```gradle
android {
    compileSdkVersion 34

    defaultConfig {
        minSdkVersion 21  // Android 5.0+
        targetSdkVersion 34
    }
}
```

#### iOS (ios/Podfile):
```ruby
platform :ios, '12.0'  # iOS 12.0+
```

---

## 13. Metrics & Analytics (Optional Future Enhancement)

### 13.1 Key Metrics to Track
- **User Engagement**:
  - Daily Active Users (DAU)
  - Session duration
  - Picks per user per week
- **Performance**:
  - App launch time
  - API response times
  - Crash rate
- **Feature Usage**:
  - Most viewed screens
  - Join competition success rate
  - Pick submission success rate

### 13.2 Suggested Tools
- **Firebase Analytics**: Free, comprehensive
- **Sentry**: Error tracking and crash reporting
- **Firebase Crashlytics**: Crash reporting

**Note**: Analytics implementation deferred to Phase 2 of development (post-MVP).

---

## 14. Phase 2 Features (Post-MVP)

**Note**: The following features are planned for Phase 2 but should be **kept in mind during initial architecture** to ensure easy implementation later.

### 14.1 Push Notifications (PRIORITY: High)

**Status**: Phase 2 - Keep in requirements

**Implementation**: Firebase Cloud Messaging (FCM) for both iOS and Android

**Features**:
- **Pick Reminders**: "Round X locks in 2 hours - make your pick!"
- **Result Notifications**: "Round X results are in - see how you did"
- **Competition Updates**: Organizer announcements
- **Status Changes**: "You've been eliminated" or "You've won!"

**Architecture Preparation**:
- Design notification preferences data model (store in profile)
- Plan notification token storage (device tokens table)
- Consider notification scheduling logic on backend

### 14.2 Biometric Authentication (PRIORITY: Medium)

**Status**: Phase 2 - Keep in requirements

**Implementation**: Flutter `local_auth` package (Face ID, Touch ID, Fingerprint)

**Features**:
- Quick login with biometric instead of password
- Optional: Require biometric for sensitive actions (delete account)
- Fallback to password if biometric fails

**Architecture Preparation**:
- Ensure JWT token storage strategy supports biometric unlock
- Plan user preference for enabling/disabling biometric auth

### 14.3 Dark Mode (PRIORITY: Medium)

**Status**: Phase 2 - Keep in requirements

**Implementation**: Flutter ThemeData with dark theme variant

**Features**:
- Manual toggle in settings
- Optional: Follow system preference (iOS/Android auto dark mode)
- Smooth theme switching without app restart

**Architecture Preparation**:
- Design with dark mode in mind (avoid hardcoded colors)
- Use theme-aware color references throughout app
- Test contrast ratios for both themes

### 14.4 Social Features (PRIORITY: Low)

**Status**: Future consideration (post Phase 2)

- **Friends System**: Add friends, see their picks (after lock)
- **Mini Leagues**: Private leaderboards within competition
- **Activity Feed**: Recent picks, results, standings changes
- **Chat/Comments**: Competition-specific discussions

### 14.5 Advanced Features (PRIORITY: Low)

**Status**: Future consideration (post Phase 2)

- **Multi-Language**: Internationalization (i18n) for global markets
- **Widgets**: Home screen widgets (iOS 14+, Android 12+)
  - Quick view: Upcoming pick deadline
  - Live standings widget
  - Competition status widget
- **Offline Mode Improvements**: Enhanced caching and sync
- **Custom Themes**: User-selectable color schemes beyond dark mode

---

## 15. Success Criteria

### 15.1 Technical Criteria
- [ ] Zero crashes (99.9% crash-free rate)
- [ ] App size < 20MB
- [ ] Launch time < 2 seconds (cold start)
- [ ] API response handling < 500ms (perceived)
- [ ] 80%+ unit test coverage
- [ ] Passes all manual testing scenarios
- [ ] 401 handling works correctly (never shows 401 error, always redirects to login)
- [ ] Environment configuration works (no hardcoded IPs, easy dev/prod switching)

### 15.2 User Experience Criteria
- [ ] Intuitive navigation (no user confusion)
- [ ] Fast, responsive interactions
- [ ] Clear error messages with recovery options
- [ ] Offline mode works seamlessly
- [ ] Accessible to users with disabilities
- [ ] Web platform link easy to find and use (encourages exploration without cluttering UI)

### 15.3 Business Criteria
- [ ] Feature parity with web app (player features only)
- [ ] Ready for App Store submission (iOS + Android)
- [ ] Positive beta tester feedback
- [ ] No security vulnerabilities

---

## 16. Decisions & Remaining Questions

### 16.1 Design Decisions

#### ✅ Decided:
- [x] **App Icon**: Not yet finalized - to be designed
- [x] **Splash Screen**: **Animation** (not static image)
- [x] **Color Scheme**: **Adapt for mobile** (don't exactly match web app)
- [x] **Typography**: **System fonts** (safest, most performant)
  - iOS: San Francisco (default)
  - Android: Roboto (default)
  - No custom font loading required

#### 🔄 New Questions:
- [ ] **Splash Screen Animation**: What type of animation?
  - Simple fade in/out?
  - Logo animation (zoom, pulse, reveal)?
  - Loading indicator (spinner, progress bar)?
  - Duration preference (1-2 seconds recommended)?
- [ ] **Mobile Color Adaptations**: Any specific changes from web app?
  - Adjust contrast for mobile screens?
  - Different accent colors for CTAs?
  - Use platform-specific colors (iOS blue, Material Design)?
- [ ] **Icon Design**: Do you have a designer, or need recommendations?

---

### 16.2 Feature Decisions

#### ✅ Decided:
- [x] **Onboarding Tutorial**: **Yes, but very basic**
  - "Join competition and press play for fixtures" concept
  - Keep it minimal and non-intrusive
- [x] **Push Notifications**: **Phase 2** (keep in requirements for future)
- [x] **Biometric Auth**: **Phase 2** (keep in requirements for future)
- [x] **Dark Mode**: **Phase 2** (keep in requirements for future)

#### 🔄 New Questions:
- [ ] **Basic Onboarding Flow**: Which approach?
  - Option 1: One-time tooltip overlay on first dashboard visit?
  - Option 2: Optional 3-step tutorial (skip button available)?
  - Option 3: Just a welcome message with "Here's how it works" link to help?
- [ ] **Onboarding Content**: What to show?
  - How to join a competition (enter code)
  - How to make a pick (tap fixture, select team)
  - Where to view standings
  - How to access web platform (for organizing)
- [ ] **Skip Onboarding**: Allow users to skip and access tutorial later from Help menu?

---

### 16.3 Technical Decisions

#### ✅ Decided:
- [x] **Analytics**: **None** (rely on server-side logging with PostgreSQL)
  - All user behavior tracked via existing Node.js/Express APIs
  - No third-party analytics SDKs needed
- [x] **Error Tracking**: **Firebase Crashlytics** (free, simple, Google-hosted)
  - Automatically captures app crashes and sends crash reports
  - Tracks non-fatal errors (API failures, exceptions)
  - Shows which device/OS version caused crashes
  - Provides stack traces for debugging
  - Alerts when new errors occur
- [x] **Backend Changes**: **APIs available as needed**
  - Current APIs use JSON and should support all features
  - New endpoints can be created on case-by-case basis if needed
  - Discuss implementation requirements as they arise
- [x] **Certificate Pinning**: **Production only**
  - Easier development workflow (no SSL pinning during dev)
  - Enhanced security for production builds
- [x] **JWT Token Passing (Mobile → Web)**: **Start simple, revisit later**
  - Initial approach: Simple web platform link (no token passing)
  - **Rationale**: Tokens last 180 days on each platform anyway
  - Users can log in separately on mobile and web
  - Token sharing can be added later if needed (not critical for MVP)
  - **Simplified Implementation**: Web platform button opens web login page
- [x] **Web App Changes**: **Minimal changes for MVP**
  - Token URL parameter handler: Optional, discuss at implementation time
  - Can be done in parallel with Flutter Phase 2 if decided
  - Keep mobile and web authentication separate for now (simpler, less risk)

### 16.4 Backend/Web Implementation Requirements

**DECISION**: Token sharing between mobile and web is **OPTIONAL** for MVP.

**Simplified Approach**:
- Mobile app "Web Platform" button opens web login page (no token passing)
- Users log in separately on mobile and web (tokens last 180 days each)
- Simpler implementation, less risk of breaking changes
- Token sharing can be added in Phase 2 if user feedback shows it's needed

**If Token Sharing Implemented Later (Phase 2)**:

The web application (lmslocal-web) would need these changes:

1. **Token URL Parameter Handler** (See Section 4.2 for JavaScript code example):
   - Detect `?token=XXX` in URL on app load
   - Store token in localStorage
   - Clean URL to remove token from address bar
   - Auto-redirect to dashboard or intended page

2. **Existing Token Validation**:
   - Verify existing JWT token validation works with tokens from mobile app
   - Ensure axios interceptor properly reads token from localStorage
   - Confirm 401 handling redirects to login (or shows appropriate message)

3. **No Breaking Changes**:
   - Web app should continue to work for direct browser access
   - Login page should still function normally
   - Token parameter is optional (graceful degradation)

**Implementation Priority**: Low (Phase 2 enhancement, not critical for MVP)

### 16.5 App Store & Deployment Decisions

#### ✅ Decided:
- [x] **Apple Developer Account**: **Already have one** - will handle deployment
- [x] **Google Play Developer Account**: **Already have one** - will handle deployment
- [x] **App Store Assets**: **Will create as needed at deployment time**
- [x] **Beta Testing Strategy**: **Local mobile device testing**
  - Test on physical device during development
  - Skip formal TestFlight/Google Play Beta for initial release
  - Release directly to app stores
- [x] **Release Strategy**: **Direct release with rapid iteration**
  - Release directly to App Store and Google Play
  - Test in production ("wild") with rapid releasing
  - Quick iteration cycle for bug fixes and improvements
  - No phased rollout - full launch
- [x] **App Store Submission**: **Handled by LMS Local team**
  - Team will handle submission process
  - Familiar with both iOS and Android submission workflows

### 16.6 Development & Maintenance

#### ✅ Decided:
- [x] **Developer Selection**: **In-house development**
  - Built collaboratively by LMS Local team
  - Same team that built the APIs and web version
  - Ensures deep understanding of existing architecture
- [x] **Development Timeline**: **12 weeks is acceptable**
  - No hard deadlines
  - Phased approach allows for quality over speed
- [x] **Post-Launch Support**: **LMS Local team**
  - Team will handle all maintenance:
    - Bug fixes
    - OS updates (iOS/Android new versions)
    - Feature updates
    - App store review updates
- [x] **Version Control**: **Add to existing Git repository**
  - Repository structure:
    - `lmslocal/lmslocal-server` (existing)
    - `lmslocal/lmslocal-web` (existing)
    - `lmslocal/lmslocal-flutter` (**NEW**)
  - Same repo as web app and server
  - Shared version control and issue tracking

---

## 17. Conclusion

This plan provides a comprehensive blueprint for building a robust, secure, and fast Flutter mobile app for LMS Local players. The architecture is scalable, testable, and follows Flutter best practices. The phased approach allows for iterative development with clear milestones.

**Next Steps**:
1. Review and approve this plan
2. Answer open questions (Section 16)
3. Set up development environment
4. Begin Phase 1 (Foundation)

**Estimated Timeline**: 12 weeks (3 months) for full MVP
**Developer Effort**: 1 full-time developer (or equivalent)

---

**Document Version**: 1.3
**Last Updated**: 2025-11-13
**Author**: LMS Local Development Team
**Status**: Ready for Development

**Changelog**:
- v1.3 (2025-11-13):
  - **ALL DECISIONS FINALIZED** - Document ready for development
  - Added critical UI/UX isolation requirement (Section 8.2)
  - **Technical Decisions**:
    - Error tracking: Firebase Crashlytics
    - Certificate pinning: Production only
    - JWT token passing: Simplified for MVP (no token sharing between mobile/web)
    - Backend APIs: Available as needed on case-by-case basis
  - **Deployment Decisions**:
    - In-house development by LMS Local team
    - Direct release to app stores with rapid iteration
    - Testing on local mobile device
    - Code in existing Git repo: `lmslocal/lmslocal-flutter`
  - **Simplified Web Platform Integration**:
    - Web platform button opens web login page (no token passing)
    - Users log in separately (tokens last 180 days each)
    - Token sharing can be added in Phase 2 if needed
  - Updated Section 16.4: Token sharing now optional (Phase 2 enhancement)
- v1.2 (2025-11-13):
  - Incorporated decisions from stakeholder feedback (Section 16)
  - **Design**: Animation splash screen, mobile-adapted colors, system fonts
  - **Features**: Basic onboarding tutorial, Phase 2 for push notifications/biometric/dark mode
  - **Technical**: No third-party analytics, error tracking TBD
  - Reorganized Section 16 with decided items and new questions
  - Updated Section 14 to emphasize Phase 2 features kept in requirements
  - Added comprehensive deployment and maintenance questions
- v1.1 (2025-11-13): Updated web platform access to be available to all users (not just organizers). Added comprehensive JWT token passing implementation for seamless authentication between mobile app and web platform.
- v1.0 (2025-11-13): Initial version
