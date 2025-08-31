/*
=======================================================================================================================================
EXTRACTED MIDDLEWARE: Authentication Token Verification
=======================================================================================================================================
This should be extracted to lmslocal-server/middleware/auth.js to avoid duplication
across 50+ route files
=======================================================================================================================================
*/

const jwt = require('jsonwebtoken');
const { query } = require('../database');

// Cache user lookups to reduce database hits
const userCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const verifyToken = async (req, res, next) => {
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
    const cacheKey = `user_${userId}`;
    
    // Check cache first
    if (userCache.has(cacheKey)) {
      const cached = userCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        req.user = cached.user;
        return next();
      }
      // Cache expired, remove it
      userCache.delete(cacheKey);
    }
    
    // Database lookup
    const result = await query('SELECT id, email, display_name, email_verified FROM app_user WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
      return res.status(200).json({
        return_code: "UNAUTHORIZED",
        message: "Invalid token"
      });
    }

    const user = result.rows[0];
    
    // Cache the result
    userCache.set(cacheKey, {
      user,
      timestamp: Date.now()
    });
    
    // Clean cache periodically (prevent memory leaks)
    if (userCache.size > 1000) {
      const now = Date.now();
      for (const [key, value] of userCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
          userCache.delete(key);
        }
      }
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(200).json({
      return_code: "UNAUTHORIZED",
      message: "Invalid token"
    });
  }
};

module.exports = { verifyToken };