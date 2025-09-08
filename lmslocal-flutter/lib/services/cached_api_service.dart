import '../config/app_config.dart';
import '../models/user.dart';
import 'api_service.dart';
import 'cache_service.dart';

/// Cached wrapper around ApiService for smart caching
class CachedApiService {
  static CachedApiService? _instance;
  static CachedApiService get instance => _instance ??= CachedApiService._();
  
  final ApiService _apiService = ApiService.instance;
  final CacheService _cacheService = CacheService.instance;
  
  CachedApiService._();

  /// Helper to execute cached API calls
  Future<T> _cachedCall<T>(
    String cacheKey,
    Duration cacheDuration,
    Future<T> Function() apiCall,
    T Function(Map<String, dynamic>) fromJson,
  ) async {
    // Try cache first
    final cachedData = await _cacheService.getCachedResponse(cacheKey);
    if (cachedData != null) {
      return fromJson(cachedData);
    }

    // Cache miss - make API call
    final result = await apiCall();
    
    // Cache the response if it's successful
    if (result is LoginResponse && result.isSuccess) {
      // Don't cache auth responses (contain sensitive tokens)
    } else {
      // Cache other API responses
      try {
        // Convert result to JSON for caching
        Map<String, dynamic> jsonData;
        if (result is Map<String, dynamic>) {
          jsonData = result;
        } else if (result.toString().contains('return_code')) {
          // This is an API response - we'll need to handle this properly
          // For now, skip caching complex objects
        } else {
          // Skip caching for now - we'll implement per-response type
        }
      } catch (e) {
        // If we can't serialize for caching, just return the result
        if (AppConfig.enableCacheLogging) {
          print('⚠️ Could not cache response for $cacheKey: $e');
        }
      }
    }

    return result;
  }

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

  // TODO: Add cached methods for:
  // - getMyCompetitions() with 4 hour cache
  // - getCurrentRound() with 2 hour cache  
  // - getCompetitionHistory() with 8 hour cache
  // - getAllowedTeams() with 1 hour cache
  
  /// Utility methods
  
  /// Force refresh a specific cache entry
  Future<void> invalidateCache(String cacheKey) {
    return _cacheService.clearCache(cacheKey);
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