/*
=======================================================================================================================================
Shared Authentication Middleware - Centralized JWT token verification
=======================================================================================================================================
Purpose: Eliminate middleware duplication across 50+ routes, implement caching for performance
Created: As part of Code Quality Improvement Plan
=======================================================================================================================================
*/

const jwt = require('jsonwebtoken');
const { query } = require('../database');

// In-memory cache for user lookups to reduce database hits
const userCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 1000; // Prevent unbounded memory growth

/**
 * Middleware to verify JWT token and populate req.user
 * Implements caching to reduce database load
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object  
 * @param {Function} next - Express next function
 */
const verifyToken = async (req, res, next) => {
  const startTime = Date.now();
  
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(200).json({
        return_code: "UNAUTHORIZED",
        message: "No token provided"
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const userId = decoded.user_id || decoded.userId;
    if (!userId) {
      return res.status(200).json({
        return_code: "UNAUTHORIZED",
        message: "Invalid token format"
      });
    }

    const cacheKey = `user_${userId}`;
    
    // Check cache first to reduce database load
    if (userCache.has(cacheKey)) {
      const cached = userCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        req.user = cached.user;
        req.authExecutionTime = Date.now() - startTime;
        return next();
      }
      // Cache expired, remove it
      userCache.delete(cacheKey);
    }
    
    // Database lookup - only when not cached
    const result = await query(
      'SELECT id, email, display_name, email_verified, password_hash FROM app_user WHERE id = $1', 
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(200).json({
        return_code: "UNAUTHORIZED",
        message: "Invalid token - user not found"
      });
    }

    const user = result.rows[0];

    // Delete before set so the key moves to the end of the Map's insertion
    // order. That keeps "first key" meaning "oldest entry" for the eviction below.
    userCache.delete(cacheKey);
    userCache.set(cacheKey, {
      user,
      timestamp: Date.now()
    });

    // Hard cap the cache so it cannot grow without bound under load
    evictOldestEntries();

    req.user = user;
    req.authExecutionTime = Date.now() - startTime;
    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(200).json({
        return_code: "UNAUTHORIZED",
        message: "Invalid token format"
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(200).json({
        return_code: "UNAUTHORIZED",
        message: "Token expired"
      });
    }

    console.error('Auth middleware error:', {
      error: error.message,
      userId: req.body?.user_id,
      route: req.path,
      method: req.method
    });
    
    return res.status(200).json({
      return_code: "UNAUTHORIZED",
      message: "Authentication failed"
    });
  }
};

/**
 * Hold the cache at MAX_CACHE_SIZE by discarding the oldest entries.
 *
 * This used to delete only entries past CACHE_TTL, which meant the size limit
 * was a threshold for *attempting* a clean rather than a cap: if more than
 * MAX_CACHE_SIZE users authenticated inside one TTL window there was nothing
 * expired to remove, so the Map grew without bound and every subsequent request
 * paid a full scan that freed nothing.
 *
 * A Map iterates in insertion order, so the first key is always the oldest
 * entry. Evicting from the front is O(1) and the size is now a real ceiling.
 * Entries still expire on read via CACHE_TTL - this only bounds memory.
 */
const evictOldestEntries = () => {
  while (userCache.size > MAX_CACHE_SIZE) {
    const oldestKey = userCache.keys().next().value;
    userCache.delete(oldestKey);
  }
};

/**
 * Admin-only authorization middleware
 * Use after verifyToken to ensure user has admin privileges
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(200).json({
      return_code: "UNAUTHORIZED",
      message: "Authentication required"
    });
  }

  // Add admin check logic here when user roles are implemented
  // For now, all authenticated users can perform admin actions
  next();
};

/**
 * Get cache statistics for monitoring
 * @returns {Object} Cache statistics
 */
const getCacheStats = () => {
  const now = Date.now();
  let activeEntries = 0;
  let expiredEntries = 0;
  
  for (const [, value] of userCache.entries()) {
    if (now - value.timestamp < CACHE_TTL) {
      activeEntries++;
    } else {
      expiredEntries++;
    }
  }
  
  return {
    totalEntries: userCache.size,
    activeEntries,
    expiredEntries,
    cacheHitRate: userCache.size > 0 ? (activeEntries / userCache.size * 100).toFixed(2) + '%' : '0%'
  };
};

module.exports = {
  verifyToken,
  requireAdmin,
  getCacheStats
};