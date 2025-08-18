const jwt = require('jsonwebtoken');

// JWT Authentication middleware
const requireAuth = (req, res, next) => {
    try {
        console.log('🔐 Checking authentication');
        
        // Check for JWT in Authorization header
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log('❌ No authorization header or invalid format');
            return res.status(401).json({
                return_code: 'AUTHENTICATION_REQUIRED',
                message: 'Missing or invalid authorization header. Use: Authorization: Bearer <jwt_token>'
            });
        }

        // Extract token
        const token = authHeader.split(' ')[1];
        
        if (!token) {
            console.log('❌ No JWT token provided');
            return res.status(401).json({
                return_code: 'AUTHENTICATION_REQUIRED',
                message: 'JWT token required'
            });
        }

        // Verify JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Add user info to request object
        req.user = {
            id: decoded.user_id,
            email: decoded.email,
            display_name: decoded.display_name
        };

        console.log(`✅ Authenticated user: ${decoded.display_name} (ID: ${decoded.user_id})`);
        next();

    } catch (error) {
        console.error('❌ Authentication failed:', error.message);
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                return_code: 'TOKEN_EXPIRED',
                message: 'JWT token has expired. Please log in again.'
            });
        }
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                return_code: 'TOKEN_INVALID',
                message: 'Invalid JWT token'
            });
        }

        res.status(500).json({
            return_code: 'SERVER_ERROR',
            message: 'Authentication error',
            error: error.message
        });
    }
};

// Optional authentication middleware (doesn't fail if no token)
const optionalAuth = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            // No auth provided, continue without user info
            req.user = null;
            return next();
        }

        const token = authHeader.split(' ')[1];
        
        if (!token) {
            req.user = null;
            return next();
        }

        // Try to verify JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        req.user = {
            id: decoded.user_id,
            email: decoded.email,
            display_name: decoded.display_name
        };

        console.log(`✅ Optional auth - user: ${decoded.display_name}`);
        next();

    } catch (error) {
        // If JWT is invalid, continue without user info (optional auth)
        console.log('⚠️ Optional auth failed, continuing without user info');
        req.user = null;
        next();
    }
};

module.exports = {
    requireAuth,
    optionalAuth
};