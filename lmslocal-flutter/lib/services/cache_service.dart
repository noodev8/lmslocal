import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../config/app_config.dart';

class CacheService {
  static CacheService? _instance;
  static CacheService get instance => _instance ??= CacheService._();
  
  CacheService._();

  // In-memory cache for fast access
  final Map<String, CacheItem> _memoryCache = {};

  /// Cache an API response with TTL (time to live)
  Future<void> cacheResponse(String key, Map<String, dynamic> data, Duration ttl) async {
    final cacheItem = CacheItem(
      data: data,
      cachedAt: DateTime.now(),
      ttl: ttl,
    );

    // Store in memory for fast access
    _memoryCache[key] = cacheItem;

    // Persist to SharedPreferences for app restarts
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('cache_$key', jsonEncode(cacheItem.toJson()));

    if (AppConfig.enableCacheLogging) {
      print('📦 Cached: $key (TTL: ${ttl.inHours}h)');
    }
  }

  /// Get cached response if still valid
  Future<Map<String, dynamic>?> getCachedResponse(String key) async {
    // Check memory cache first (fastest)
    if (_memoryCache.containsKey(key)) {
      final item = _memoryCache[key]!;
      if (item.isValid) {
        if (AppConfig.enableCacheLogging) {
          print('🚀 Cache HIT (memory): $key');
        }
        return item.data;
      } else {
        // Remove expired item from memory
        _memoryCache.remove(key);
      }
    }

    // Check persistent cache (SharedPreferences)
    final prefs = await SharedPreferences.getInstance();
    final cachedString = prefs.getString('cache_$key');
    
    if (cachedString != null) {
      try {
        final cacheItem = CacheItem.fromJson(jsonDecode(cachedString));
        if (cacheItem.isValid) {
          // Restore to memory cache
          _memoryCache[key] = cacheItem;
          if (AppConfig.enableCacheLogging) {
            print('💾 Cache HIT (persistent): $key');
          }
          return cacheItem.data;
        } else {
          // Remove expired persistent cache
          await prefs.remove('cache_$key');
        }
      } catch (e) {
        // Remove corrupted cache
        await prefs.remove('cache_$key');
        if (AppConfig.enableCacheLogging) {
          print('🗑️ Removed corrupted cache: $key');
        }
      }
    }

    if (AppConfig.enableCacheLogging) {
      print('❌ Cache MISS: $key');
    }
    return null;
  }

  /// Check if cache exists and is valid
  Future<bool> isCacheValid(String key) async {
    final cachedData = await getCachedResponse(key);
    return cachedData != null;
  }

  /// Clear specific cache entry
  Future<void> clearCache(String key) async {
    _memoryCache.remove(key);
    
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('cache_$key');

    if (AppConfig.enableCacheLogging) {
      print('🗑️ Cleared cache: $key');
    }
  }

  /// Clear all cached data
  Future<void> clearAllCache() async {
    _memoryCache.clear();

    final prefs = await SharedPreferences.getInstance();
    final keys = prefs.getKeys().where((key) => key.startsWith('cache_'));
    
    for (final key in keys) {
      await prefs.remove(key);
    }

    if (AppConfig.enableCacheLogging) {
      print('🧹 Cleared all cache');
    }
  }

  /// Get cache statistics
  Map<String, dynamic> getStats() {
    final memoryCount = _memoryCache.length;
    final validMemoryCount = _memoryCache.values.where((item) => item.isValid).length;
    
    return {
      'memory_entries': memoryCount,
      'valid_entries': validMemoryCount,
      'expired_entries': memoryCount - validMemoryCount,
    };
  }
}

/// Cache item with expiration logic
class CacheItem {
  final Map<String, dynamic> data;
  final DateTime cachedAt;
  final Duration ttl;

  CacheItem({
    required this.data,
    required this.cachedAt,
    required this.ttl,
  });

  bool get isValid => DateTime.now().difference(cachedAt) < ttl;

  Duration get timeUntilExpiry => ttl - DateTime.now().difference(cachedAt);

  Map<String, dynamic> toJson() => {
    'data': data,
    'cachedAt': cachedAt.millisecondsSinceEpoch,
    'ttlMs': ttl.inMilliseconds,
  };

  factory CacheItem.fromJson(Map<String, dynamic> json) => CacheItem(
    data: Map<String, dynamic>.from(json['data']),
    cachedAt: DateTime.fromMillisecondsSinceEpoch(json['cachedAt']),
    ttl: Duration(milliseconds: json['ttlMs']),
  );
}