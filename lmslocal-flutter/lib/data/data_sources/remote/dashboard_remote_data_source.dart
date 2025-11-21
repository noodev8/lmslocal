import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:lmslocal_flutter/core/constants/app_constants.dart';
import 'package:lmslocal_flutter/core/errors/failures.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/api_client.dart';
import 'package:lmslocal_flutter/data/models/competition_model.dart';

/// Remote data source for dashboard-related API calls
/// Includes caching for offline support and performance
class DashboardRemoteDataSource {
  final ApiClient _apiClient;
  final SharedPreferences _prefs;

  static const String _cacheKey = 'dashboard_competitions';
  static const String _cacheTimeKey = 'dashboard_cache_time';
  static const int _cacheDurationMinutes = 5; // Cache for 5 minutes

  DashboardRemoteDataSource({
    required ApiClient apiClient,
    required SharedPreferences prefs,
  })  : _apiClient = apiClient,
        _prefs = prefs;

  /// Get user dashboard data
  /// Returns cached data if fresh, otherwise fetches from API
  /// Throws ServerFailure, NetworkFailure, or UpdateRequiredException on error
  Future<List<CompetitionModel>> getUserDashboard({
    bool forceRefresh = false,
  }) async {
    // Check cache first unless force refresh
    if (!forceRefresh) {
      final cachedData = await _getCachedDashboard();
      if (cachedData != null) {
        return cachedData;
      }
    }

    // Fetch from API
    try {
      final response = await _apiClient.post(
        '/get-user-dashboard',
        data: {},
      );

      final data = response.data as Map<String, dynamic>;
      final returnCode = data['return_code'] as String;

      if (returnCode == AppConstants.successCode) {
        final competitions = (data['competitions'] as List)
            .map((e) => CompetitionModel.fromJson(e as Map<String, dynamic>))
            .toList();

        // Cache the response
        await _cacheDashboard(competitions);

        return competitions;
      } else {
        final message = data['message'] as String? ?? 'Failed to fetch dashboard';
        throw ServerFailure(message);
      }
    } catch (e) {
      if (e is Failure) rethrow;

      // If network error, try to return stale cache
      final cachedData = await _getCachedDashboard(ignoreExpiry: true);
      if (cachedData != null) {
        return cachedData;
      }

      throw NetworkFailure('Failed to fetch dashboard: ${e.toString()}');
    }
  }

  /// Get cached dashboard data if available and fresh
  Future<List<CompetitionModel>?> _getCachedDashboard({
    bool ignoreExpiry = false,
  }) async {
    try {
      final cachedJson = _prefs.getString(_cacheKey);
      final cacheTime = _prefs.getInt(_cacheTimeKey);

      if (cachedJson == null || cacheTime == null) {
        return null;
      }

      // Check if cache is still fresh
      if (!ignoreExpiry) {
        final cacheAge = DateTime.now().millisecondsSinceEpoch - cacheTime;
        final cacheExpired = cacheAge > (_cacheDurationMinutes * 60 * 1000);

        if (cacheExpired) {
          return null;
        }
      }

      // Decode cached data
      final List<dynamic> decoded = jsonDecode(cachedJson);
      final competitions = decoded
          .map((e) => CompetitionModel.fromJson(e as Map<String, dynamic>))
          .toList();

      return competitions;
    } catch (e) {
      // If cache is corrupted, clear it
      await clearCache();
      return null;
    }
  }

  /// Cache dashboard data
  Future<void> _cacheDashboard(List<CompetitionModel> competitions) async {
    try {
      final encoded = jsonEncode(
        competitions.map((e) => e.toJson()).toList(),
      );
      await _prefs.setString(_cacheKey, encoded);
      await _prefs.setInt(_cacheTimeKey, DateTime.now().millisecondsSinceEpoch);
    } catch (e) {
      // Silently fail - caching is optional
    }
  }

  /// Clear cached dashboard data
  Future<void> clearCache() async {
    await _prefs.remove(_cacheKey);
    await _prefs.remove(_cacheTimeKey);
  }
}
