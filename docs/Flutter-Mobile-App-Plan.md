# LMSLocal Flutter Mobile App - Technical Plan

## Project Overview
LMSLocal is a "Last Man Standing" competition platform. This document outlines the technical approach for building a **player-focused mobile app** that connects to the existing Node.js/PostgreSQL backend.

## Architecture Decisions

### Core Technology Stack
```yaml
dependencies:
  flutter: sdk
  dio: ^5.4.0                     # HTTP client with interceptors
  dio_cache_interceptor: ^3.4.0   # Smart caching layer
  shared_preferences: ^2.2.0      # JWT token storage
  riverpod: ^2.4.0               # State management
  flutter_riverpod: ^2.4.0       # Flutter integration
  json_annotation: ^4.8.0        # JSON serialization
  material_color_utilities: ^0.5.0 # Material 3 colors

dev_dependencies:
  json_serializable: ^6.7.0      # Code generation
  build_runner: ^2.4.0           # Build tools
```

### Project Structure
```
lib/
├── main.dart                   # App entry point
├── models/                     # Data classes (Competition, Pick, User)
├── services/                   # API service + caching layer
├── providers/                  # Riverpod state providers
├── screens/                    # Complete UI screens (one per file)
│   ├── login_screen.dart
│   ├── dashboard_screen.dart
│   ├── competition_screen.dart
│   └── pick_team_screen.dart
├── widgets/                    # Reusable components
└── utils/                      # Helpers, constants
```

## Player Features (Mobile App Scope)

### Essential Features Only
1. **Authentication** - Email/password login using existing `/login` API
2. **My Competitions** - List competitions user participates in (`/player-dashboard`)
3. **Competition View** - Current round, fixtures, my pick (`/get-player-current-round`)
4. **Make Pick** - Select team from allowed teams (`/set-pick`, `/get-allowed-teams`)
5. **Competition History** - Past rounds and results (via existing APIs)

### Admin Features → Web App
- Competition creation, fixture management, player management
- **Seamless handoff**: Mobile detects admin needs → redirect to web app with JWT context
- **Shared authentication**: Same JWT tokens work across mobile and web

## API Integration Strategy

### HTTP Client Setup (Dio)
```dart
final dio = Dio(BaseOptions(
  baseUrl: 'http://localhost:3015',  # Your existing Node.js server
  connectTimeout: Duration(seconds: 5),
  receiveTimeout: Duration(seconds: 3),
));

// Automatic JWT injection
dio.interceptors.add(InterceptorsWrapper(
  onRequest: (options, handler) {
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  },
));
```

### Caching Strategy (Server-Friendly)
- **User competitions**: Cache for **4 hours** (weekly changes)
- **Current round data**: Cache for **2 hours** (fixtures rarely change)
- **Competition history**: Cache for **8 hours** (stable historical data)
- **Allowed teams**: Cache for **1 hour** (changes after picks made)
- **Pick submission**: No cache (always fresh)
- **Pull-to-refresh**: Manual cache invalidation on user request

### Key API Endpoints Used
```dart
// Authentication
POST /login                     # Standard email/password
POST /register                  # New user registration

// Player Dashboard  
POST /player-dashboard          # List user's competitions

// Competition Play
POST /get-player-current-round  # Current round + fixtures + user's pick
POST /get-allowed-teams         # Teams user can pick (with auto-reset)
POST /set-pick                  # Make team selection
POST /get-current-pick          # View current pick
POST /unselect-pick             # Remove pick before round locks

// Competition Access
POST /join-competition-by-code  # Join via invite codes/slugs
```

## UI/UX Approach

### Material 3 Setup
```dart
MaterialApp(
  theme: ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: Colors.blue,     # Brand color
      brightness: Brightness.light,
    ),
  ),
  darkTheme: ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: Colors.blue,
      brightness: Brightness.dark,
    ),
  ),
)
```

### Screen-Per-File Strategy
- **One complete screen per file** - UI + logic together
- **Iterate safely** - redesign screens without breaking others
- **Easy A/B testing** - try different approaches per screen
- **Simple rollback** - revert individual files

### Navigation Strategy
- **Phase 1**: Basic `Navigator.push/pop` (simple, reliable)
- **Phase 2**: Easy upgrade to `go_router` for deep linking when needed
- **Same screens work with both** - no refactoring required

## Game Rules (Critical for Mobile Implementation)

### Pick System
- **One team per round** - Cannot reuse teams across rounds
- **Lives system** - Configurable lives per player (default 1)
- **Pick timing** - Picks lock when round locks or 1hr before kickoff
- **Results** - Based on regulation time (90 minutes + stoppage)
- **Win/Draw/Loss** logic determines elimination

### Database Schema Key Tables
- `app_user` - User accounts with JWT authentication
- `competition` - Competition settings and status  
- `competition_user` - Player membership and lives remaining
- `round` - Competition rounds with lock times
- `fixture` - Individual matches within rounds
- `pick` - Player team selections
- `allowed_teams` - Teams available to each player (auto-reset when exhausted)

## Development Approach

### Start Simple, Iterate
1. **Basic screens** - Functional UI with Material 3 defaults
2. **Core functionality** - Login, view competitions, make picks
3. **Polish incrementally** - Animations, custom styling, brand colors
4. **Add features** - History, notifications, web handoffs

### Quality Principles
- **Robust but not over-engineered** - Working model first
- **Server-friendly** - Long caches, efficient API usage
- **User-friendly** - Pull-to-refresh, clear feedback, offline grace

## Future Enhancements

### Seamless Web Integration
- **Context sharing** - Pass JWT tokens and competition state
- **Smart redirects** - Mobile → Web for admin features
- **Deep linking** - Web → Mobile for specific competitions
- **Feature detection** - Show web handoff hints for organizers

### Advanced Features (Later)
- Push notifications for pick reminders
- Offline mode with sync
- Social features (player chat, leaderboards)
- Advanced caching strategies

---

## Ready to Build!
This plan provides a solid foundation for a player-focused mobile app that integrates seamlessly with your existing LMSLocal backend. The architecture supports iterative development and easy future enhancements.