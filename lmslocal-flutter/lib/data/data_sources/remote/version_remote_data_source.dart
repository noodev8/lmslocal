import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/api_client.dart';
import 'package:package_info_plus/package_info_plus.dart';

/// Asks the server whether this build is still allowed to run.
///
/// Every failure path returns null — the gate fails open on purpose. A check
/// that blocks when it cannot reach the server would turn a backend blip into
/// an app nobody can open, which is worse than the stale build it guards
/// against.
class VersionRemoteDataSource {
  final ApiClient apiClient;

  VersionRemoteDataSource({required this.apiClient});

  /// Returns null when the build is current, or the check could not be made.
  Future<VersionCheckResult?> checkAppVersion() async {
    try {
      final packageInfo = await PackageInfo.fromPlatform();
      final currentVersion = packageInfo.version; // e.g. "2.0.0"
      final platform = Platform.isIOS ? 'ios' : 'android';

      final response = await apiClient.post(
        '/check-app-version',
        data: {
          'current_version': currentVersion,
          'platform': platform,
        },
      );

      if (response.data['return_code'] == 'SUCCESS' &&
          response.data['update_required'] == true) {
        return VersionCheckResult(
          storeUrl: response.data['store_url'] as String,
        );
      }

      return null;
    } on DioException catch (e) {
      debugPrint('Version check network error: ${e.message}');
      return null;
    } catch (e) {
      debugPrint('Version check error: $e');
      return null;
    }
  }
}

class VersionCheckResult {
  /// Where to send the user. Comes from the server rather than being compiled
  /// in, so a store listing can move without shipping a build to the very
  /// people who cannot receive one.
  final String storeUrl;

  VersionCheckResult({required this.storeUrl});
}
