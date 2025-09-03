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
  private cache: Map<string, CacheEntry<any>> = new Map();

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

    console.log(`📦 Cache HIT: ${key} (age: ${Math.floor((now - entry.timestamp) / 1000)}s)`);
    return entry.data;
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
    console.log(`💾 Cache SET: ${key} (TTL: ${Math.floor(ttl / 1000)}s)`);
  }

  /**
   * Delete specific cache entry
   * @param key - Cache key to delete
   */
  delete(key: string): void {
    const deleted = this.cache.delete(key);
    if (deleted) {
      console.log(`🗑️ Cache DELETE: ${key}`);
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const count = this.cache.size;
    this.cache.clear();
    console.log(`🧹 Cache CLEAR: ${count} entries removed`);
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
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧼 Cache CLEANUP: ${cleanedCount} expired entries removed`);
    }
  }
}

// Export singleton instance
export const apiCache = new SimpleCache();

/**
 * Higher-order function to wrap API calls with caching
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

  // Cache miss - make API call
  console.log(`🌐 Cache MISS: ${key} - Making API call`);
  const data = await apiCall();
  
  // Cache the result
  apiCache.set(key, data, ttl);
  
  return data;
}