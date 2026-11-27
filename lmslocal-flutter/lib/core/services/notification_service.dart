import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/api_client.dart';

/// Service for handling push notifications via Firebase Cloud Messaging
class NotificationService {
  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final ApiClient _apiClient;

  NotificationService({required this._apiClient});

  /// Initialize notifications - request permissions and register token
  /// Call this after user logs in
  Future<void> initialize() async {
    // Request permission (required for iOS and Android 13+)
    final settings = await _requestPermission();

    if (settings.authorizationStatus == AuthorizationStatus.authorized ||
        settings.authorizationStatus == AuthorizationStatus.provisional) {
      debugPrint('🔔 Notification permission granted');

      // Get and register FCM token
      await _getAndRegisterToken();

      // Listen for token refresh. Deprecated with getToken below; see there.
      // ignore: deprecated_member_use
      _messaging.onTokenRefresh.listen((newToken) {
        debugPrint('🔔 FCM token refreshed');
        _registerTokenWithBackend(newToken);
      });
    } else {
      debugPrint('🔔 Notification permission denied');
    }
  }

  /// Request notification permissions
  Future<NotificationSettings> _requestPermission() async {
    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );

    debugPrint('🔔 Permission status: ${settings.authorizationStatus}');
    return settings;
  }

  /// How long to wait for iOS to hand over the APNs token before giving up.
  static const _apnsWaitAttempts = 10;
  static const _apnsWaitInterval = Duration(seconds: 1);

  /// iOS only: the APNs token, waiting for it to arrive, or null if it never
  /// does.
  ///
  /// Firebase cannot issue a token on iOS until Apple has issued one, and
  /// getToken() throws rather than waits. Asked straight after the permission
  /// prompt, Apple's token is often not there yet — so this waits up to ten
  /// seconds. A null here after that long is not a race but a build that
  /// cannot receive push at all: almost always the aps-environment entitlement
  /// missing from ios/Runner/Runner.entitlements, which is exactly how every
  /// iOS build from August to November 2026 registered nobody without a
  /// single visible error. See docs/mobile-notifications.md §5.
  Future<String?> _waitForApnsToken() async {
    for (var attempt = 0; attempt < _apnsWaitAttempts; attempt++) {
      final apnsToken = await _messaging.getAPNSToken();
      if (apnsToken != null) return apnsToken;
      await Future<void>.delayed(_apnsWaitInterval);
    }
    return null;
  }

  /// Get FCM token and register with backend
  Future<void> _getAndRegisterToken() async {
    try {
      if (Platform.isIOS && await _waitForApnsToken() == null) {
        // Loud on purpose: this is the failure that went unnoticed for months.
        // onTokenRefresh (set up in initialize) still registers the token if
        // Apple's arrives later.
        debugPrint(
          '🔔 PUSH NOT AVAILABLE: no APNs token after '
          '${_apnsWaitAttempts * _apnsWaitInterval.inSeconds}s. Check the '
          'aps-environment entitlement and the Push Notifications capability.',
        );
        return;
      }

      // Deprecated in firebase_messaging 17 for register()/onRegistered, which
      // is not a drop-in: it yields a Firebase Installation ID, not an FCM
      // token, and the server (fcmService.js) sends to stored FCM tokens.
      // Moving over means changing /register-device-token, device_tokens and
      // the send together, with old app versions still posting tokens — so it
      // is its own piece of work, not part of a version bump.
      // ignore: deprecated_member_use
      final token = await _messaging.getToken();

      if (token != null) {
        await _registerTokenWithBackend(token);
      } else {
        debugPrint('🔔 Failed to get FCM token');
      }
    } catch (e) {
      debugPrint('🔔 Error getting FCM token: $e');
    }
  }

  /// Register token with backend API
  Future<void> _registerTokenWithBackend(String token) async {
    try {
      final platform = Platform.isIOS ? 'ios' : 'android';

      final response = await _apiClient.post(
        '/register-device-token',
        data: {
          'fcm_token': token,
          'platform': platform,
        },
      );

      final returnCode = response.data['return_code'];
      if (returnCode != 'SUCCESS') {
        debugPrint('🔔 Failed to register token: $returnCode');
      }
    } catch (e) {
      debugPrint('🔔 Error registering token with backend: $e');
    }
  }

  /// Setup foreground notification handling
  /// Call this in main.dart or app initialization
  void setupForegroundHandler() {
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      debugPrint('🔔 Foreground message received:');
      debugPrint('   Title: ${message.notification?.title}');
      debugPrint('   Body: ${message.notification?.body}');

      // Foreground notifications are handled by the system on iOS
      // On Android, you might want to show a local notification or snackbar
      // For now, we just log it - the user is already in the app
    });
  }

  /// Setup background/terminated notification tap handling
  /// Returns the initial message if app was opened from a notification
  Future<RemoteMessage?> getInitialMessage() async {
    // Check if app was opened from a terminated state via notification
    final initialMessage = await _messaging.getInitialMessage();

    if (initialMessage != null) {
      debugPrint('🔔 App opened from terminated state via notification');
    }

    return initialMessage;
  }

  /// Setup handler for when notification is tapped while app is in background
  void setupBackgroundTapHandler(Function(RemoteMessage) onTap) {
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      debugPrint('🔔 Notification tapped (app was in background)');
      onTap(message);
    });
  }
}
