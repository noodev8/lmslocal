import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/api_client.dart';
import 'package:package_info_plus/package_info_plus.dart';

/// Remote data source for app version checking
class VersionRemoteDataSource {
  final ApiClient apiClient;

  VersionRemoteDataSource({required this.apiClient});

  /// Check if app version meets minimum requirements
  /// Returns null if update not required, otherwise returns VersionCheckResult
  Future<VersionCheckResult?> checkAppVersion() async {
    try {
      // Get current app version from package info
      final packageInfo = await PackageInfo.fromPlatform();
      final currentVersion = packageInfo.version; // e.g., "1.1.1"

      // Detect platform
      final platform = Platform.isIOS ? 'ios' : 'android';

      // Call version check API
      final response = await apiClient.post(
        '/check-app-version',
        data: {
          'current_version': currentVersion,
          'platform': platform,
        },
      );

      // Check response
      if (response.data['return_code'] == 'SUCCESS') {
        final updateRequired = response.data['update_required'] as bool;
        final minimumVersion = response.data['minimum_version'] as String;
        final storeUrl = response.data['store_url'] as String;

        if (updateRequired) {
          return VersionCheckResult(
            updateRequired: true,
            minimumVersion: minimumVersion,
            storeUrl: storeUrl,
          );
        }
      }

      // No update required or error occurred
      return null;
    } on DioException catch (e) {
      // Network error - don't block the app, just log and continue
      debugPrint('Version check network error: ${e.message}');
      return null;
    } catch (e) {
      // Other errors - don't block the app
      debugPrint('Version check error: $e');
      return null;
    }
  }
}

/// Result of version check
class VersionCheckResult {
  final bool updateRequired;
  final String minimumVersion;
  final String storeUrl;

  VersionCheckResult({
    required this.updateRequired,
    required this.minimumVersion,
    required this.storeUrl,
  });
}
