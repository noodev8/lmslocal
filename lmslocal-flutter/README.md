# LMSLocal Flutter Mobile App

A mobile app for Last Man Standing competitions, connecting to the LMSLocal backend.

## Setup

### Prerequisites
- Flutter SDK (>=3.10.0)
- Dart SDK (>=3.8.0)
- Your LMSLocal backend running on `http://localhost:3015`

### Installation

1. Install dependencies:
```bash
flutter pub get
```

2. Generate JSON serialization code:
```bash
dart run build_runner build --delete-conflicting-outputs
```

3. Run the app:
```bash
flutter run
```

## Features (Current)

### ✅ Implemented
- **Authentication** - Login and registration
- **Material 3 UI** - Modern, responsive design
- **State Management** - Riverpod for reactive state
- **API Integration** - Dio HTTP client with smart caching
- **Caching System** - In-memory + persistent cache for weekly data
- **Error Handling** - User-friendly error messages

### 🚧 Coming Soon
- **Dashboard** - View your competitions
- **Competition View** - Current round, fixtures, picks
- **Team Selection** - Make picks from allowed teams
- **History** - Past rounds and results

## Architecture

```
lib/
├── main.dart              # App entry point with Material 3
├── models/               # Data classes
│   └── user.dart         # User model with JSON serialization
├── services/            # API and business logic
│   └── api_service.dart  # HTTP client with auth and caching
├── providers/           # State management
│   └── auth_provider.dart # Authentication state
└── screens/            # UI screens
    ├── login_screen.dart    # Login/register form
    └── dashboard_screen.dart # Main app screen (WIP)
```

## API Integration

The app connects to your existing LMSLocal Node.js backend:
- **Base URL**: `http://localhost:3015`
- **Authentication**: JWT tokens stored securely
- **Caching**: Smart caching with pull-to-refresh
- **Error Handling**: Graceful handling of network issues

## Development

### Generate Code
When you modify models with JSON serialization:
```bash
dart run build_runner build --delete-conflicting-outputs
```

### Debug Mode
Run with hot reload for development:
```bash
flutter run --debug
```

### Production Build
Build release APK:
```bash
flutter build apk --release
```

## Configuration

### Backend URL
The server URL is configured in `lib/config/app_config.dart`. Simply uncomment the line you need:

```dart
class AppConfig {
  // Development - Local server
  static const String baseUrl = 'http://localhost:3015';
  
  // Development - Home network (replace with your home IP)
  // static const String baseUrl = 'http://192.168.1.88:3015';
  
  // Development - Work network (replace with your work IP)  
  // static const String baseUrl = 'http://192.168.1.108:3015';
  
  // Development - Mobile testing (replace with your computer's IP)
  // static const String baseUrl = 'http://10.0.2.2:3015'; // Android emulator
  // static const String baseUrl = 'http://192.168.1.100:3015'; // Real device
  
  // Production - Your live server
  // static const String baseUrl = 'https://api.lmslocal.com';
}
```

**Quick Setup:**
1. **Local development**: Use `http://localhost:3015` (default)
2. **Mobile testing**: Replace with your computer's IP address
3. **Production**: Use your live server URL

The current server URL is displayed in the debug console when the app starts.

### App Settings
- Theme: Material 3 with adaptive light/dark mode
- State: Riverpod for reactive state management
- Storage: SharedPreferences for JWT tokens and user data