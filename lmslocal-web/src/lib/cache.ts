/**
 * Simple in-memory cache with TTL (Time To Live) functionality
 * Reduces redundant API calls by caching responses based on data update frequency
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class SimpleCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();

  // Cache durations based on data update frequency (from FRONTEND_OPTIMIZATION.md)
  static readonly TTL = {
    STATIC: 365 * 24 * 60 * 60 * 1000,      // 1 year (teams, team lists)
    SEMI_STATIC: 7 * 24 * 60 * 60 * 1000,   // 1 week (competitions list)
    DYNAMIC: 5 * 60 * 1000,                  // 5 minutes (players, rounds, fixtures)
    REAL_TIME: 30 * 1000,                    // 30 seconds (picks, standings)
  };

  /**
   * Get cached data if still valid
   * @param key - Cache key
   * @returns Cached data or null if expired/missing
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    const now = Date.now();
    const isExpired = now - entry.timestamp > entry.ttl;
    
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set cached data with TTL
   * @param key - Cache key
   * @param data - Data to cache
   * @param ttl - Time to live in milliseconds
   */
  set<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
    // TTL logging removed for production

  }

  /**
   * Delete specific cache entry
   * @param key - Cache key to delete
   */
  delete(key: string): void {
    const deleted = this.cache.delete(key);
    if (deleted) {
    }
  }

  /**
   * Delete cache entries that match a pattern
   * @param pattern - Pattern to match against keys (supports wildcards with *)
   */
  deletePattern(pattern: string): void {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    const keysToDelete: string[] = [];
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => {
      this.cache.delete(key);
    });
    
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics for diagnostics
   */
  getStats(): { size: number; entries: Array<{ key: string; age: number; ttl: number }> } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      age: Math.floor((now - entry.timestamp) / 1000),
      ttl: Math.floor(entry.ttl / 1000)
    }));

    return {
      size: this.cache.size,
      entries
    };
  }

  /**
   * Remove expired entries manually (automatic on get)
   */
  cleanup(): void {
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

// Export singleton instance
export const apiCache = new SimpleCache();

// Promise deduplication map to prevent thundering herd
const pendingRequests = new Map<string, Promise<unknown>>();

/**
 * Higher-order function to wrap API calls with caching and promise deduplication
 * @param key - Cache key
 * @param ttl - Time to live in milliseconds
 * @param apiCall - Function that returns a Promise with the API call
 * @returns Cached data or fresh API call result
 */
export async function withCache<T>(
  key: string,
  ttl: number,
  apiCall: () => Promise<T>
): Promise<T> {
  // Try to get from cache first
  const cached = apiCache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Check if there's already a pending request for this key
  const existingRequest = pendingRequests.get(key) as Promise<T> | undefined;
  if (existingRequest) {
    return await existingRequest;
  }

  // Cache miss - make API call with deduplication
  const requestPromise = apiCall().then((data) => {
    // Cache the result and clean up pending request
    apiCache.set(key, data, ttl);
    pendingRequests.delete(key);
    return data;
  }).catch((error) => {
    // Clean up pending request on error
    pendingRequests.delete(key);
    throw error;
  });

  // Store the promise to deduplicate concurrent requests
  pendingRequests.set(key, requestPromise);

  return await requestPromise;
}

/**
 * Debug function to log all current cache entries and their TTLs
 * Call this in browser console: window.debugCache()
 */
export function debugCache(): void {
  // Debug output removed for production
}

/**
 * Utility functions for cache management
 * Simplified approach: Clear all cache on login for clean slate
 */
export const cacheUtils = {
  // Clear all cache - used on login for fresh start
  clearAll: () => {
    apiCache.clear();
  },
  
  // Individual cache operations
  invalidateKey: (key: string) => apiCache.delete(key),
  invalidatePattern: (pattern: string) => apiCache.deletePattern(pattern),
  
  // Competition-specific cleanup (still useful during session)
  invalidateCompetition: (id: number) => apiCache.deletePattern(`competition-${id}-*`),
  
  // Current user's competitions (for manual refresh)
  invalidateCompetitions: () => {
    const userId = getCurrentUserId();
    if (userId) {
      apiCache.delete(`competitions-user-${userId}`);
    }
  },
  
  // Debug utilities
  getStats: () => apiCache.getStats(),
  debug: () => debugCache()
};

// Helper to get current user ID for cache keys
function getCurrentUserId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      return user.id?.toString() || null;
    }
  } catch {
    // Failed to get current user ID
  }
  return null;
}

// Legacy export for backward compatibility
export const invalidateCache = cacheUtils;

// Make debugCache available globally for browser console debugging
if (typeof window !== 'undefined') {
  (window as typeof window & { debugCache: typeof debugCache }).debugCache = debugCache;
}