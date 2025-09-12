import '../config/app_config.dart';
import '../models/user.dart';
import '../models/competition.dart';
import 'api_service.dart';
import 'cache_service.dart';

/// Cached wrapper around ApiService for smart caching
class CachedApiService {
  static CachedApiService? _instance;
  static CachedApiService get instance => _instance ??= CachedApiService._();
  
  final ApiService _apiService = ApiService.instance;
  final CacheService _cacheService = CacheService.instance;
  
  CachedApiService._();


  /// Authentication - no caching (security sensitive)
  Future<LoginResponse> login(String email, String password) {
    return _apiService.login(email, password);
  }

  Future<LoginResponse> register(String email, String password, String displayName) {
    return _apiService.register(email, password, displayName);
  }

  Future<void> logout() {
    return _apiService.logout();
  }

  Future<bool> isLoggedIn() {
    return _apiService.isLoggedIn();
  }

  Future<User?> getCurrentUser() {
    return _apiService.getCurrentUser();
  }

  Future<LoginResponse> forgotPassword(String email) {
    return _apiService.forgotPassword(email);
  }

  Future<LoginResponse> changePassword(String currentPassword, String newPassword) {
    return _apiService.changePassword(currentPassword, newPassword);
  }

  Future<LoginResponse> updateProfile(String displayName) {
    return _apiService.updateProfile(displayName);
  }

  Future<LoginResponse> deleteAccount(String confirmation) {
    return _apiService.deleteAccount(confirmation);
  }

  /// Get user's competitions with smart caching using unified API
  /// Uses /get-user-dashboard for all competition data
  Future<CompetitionsResponse> getMyCompetitions() async {
    const cacheKey = 'my_competitions_hybrid';
    const cacheDuration = Duration(hours: AppConfig.competitionsCacheHours);
    
    // Try cache first
    final cachedData = await _cacheService.getCachedResponse(cacheKey);
    if (cachedData != null) {
      try {
        return CompetitionsResponse.fromJson(cachedData);
      } catch (e) {
        // Clear corrupted cache and continue to API call
        await _cacheService.clearCache(cacheKey);
      }
    }

    // Cache miss - make hybrid API calls
    try {
      // Get competitions where user is organizer (without player status)
      final organizedResult = await _apiService.getMyCompetitions();
      
      // Get competitions where user is participant (with player status)
      final participantResult = await _apiService.getPlayerDashboard();
      
      if (!organizedResult.isSuccess && !participantResult.isSuccess) {
        // Both calls failed
        return CompetitionsResponse(
          returnCode: 'SERVER_ERROR',
          competitions: [],
          message: organizedResult.message ?? participantResult.message ?? 'Failed to load competitions',
        );
      }
      
      // Merge results with participant data taking precedence for dual-role users
      final allCompetitions = <Competition>[];
      final participantCompIds = participantResult.competitions.map((c) => c.id).toSet();
      
      // Add participant competitions (these have user_status)
      if (participantResult.isSuccess) {
        allCompetitions.addAll(participantResult.competitions);
      }
      
      // Add organizer-only competitions (not already included as participant)
      if (organizedResult.isSuccess) {
        for (final comp in organizedResult.competitions) {
          if (!participantCompIds.contains(comp.id)) {
            allCompetitions.add(comp);
          }
        }
      }
      
      // Sort by creation date (most recent first)
      allCompetitions.sort((a, b) => b.createdAt.compareTo(a.createdAt));
      
      final result = CompetitionsResponse(
        returnCode: 'SUCCESS',
        competitions: allCompetitions,
        message: null,
      );
      
      // Cache the merged response
      try {
        await _cacheService.cacheResponse(cacheKey, result.toJson(), cacheDuration);
      } catch (e) {
        // Silently handle caching errors
      }
      
      return result;
      
    } catch (e) {
      return CompetitionsResponse(
        returnCode: 'CLIENT_ERROR',
        competitions: [],
        message: 'Unexpected error: $e',
      );
    }
  }

  // TODO: Add cached methods for:
  // - getCurrentRound() with 2 hour cache  
  // - getCompetitionHistory() with 8 hour cache
  // - getAllowedTeams() with 1 hour cache
  
  /// Utility methods
  
  /// Force refresh a specific cache entry
  Future<void> invalidateCache(String cacheKey) {
    return _cacheService.clearCache(cacheKey);
  }
  
  /// Force refresh competitions cache
  Future<void> invalidateCompetitionsCache() {
    return _cacheService.clearCache('my_competitions_hybrid');
  }

  /// Clear all cached data (for logout or manual refresh)
  Future<void> clearAllCache() {
    return _cacheService.clearAllCache();
  }

  /// Get cache statistics for debugging
  Map<String, dynamic> getCacheStats() {
    return _cacheService.getStats();
  }

  /// Check if specific data is cached and valid
  Future<bool> isCached(String cacheKey) {
    return _cacheService.isCacheValid(cacheKey);
  }
}