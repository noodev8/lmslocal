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
      'SELECT id, email, display_name, email_verified FROM app_user WHERE id = $1', 
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(200).json({
        return_code: "UNAUTHORIZED",
        message: "Invalid token - user not found"
      });
    }

    const user = result.rows[0];
    
    // Cache the result with timestamp
    userCache.set(cacheKey, {
      user,
      timestamp: Date.now()
    });
    
    // Prevent memory leaks by cleaning expired cache entries
    cleanExpiredCache();

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
 * Clean expired cache entries to prevent memory leaks
 * Called periodically when cache size grows
 */
const cleanExpiredCache = () => {
  if (userCache.size <= MAX_CACHE_SIZE) return;
  
  const now = Date.now();
  const keysToDelete = [];
  
  for (const [key, value] of userCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      keysToDelete.push(key);
    }
  }
  
  keysToDelete.forEach(key => userCache.delete(key));
  
  // Log cache cleanup for monitoring
  if (keysToDelete.length > 0) {
    console.log(`Auth cache cleaned: ${keysToDelete.length} expired entries removed, ${userCache.size} entries remain`);
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
  
  for (const [key, value] of userCache.entries()) {
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