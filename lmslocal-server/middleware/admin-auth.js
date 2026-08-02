/*
=======================================================================================================================================
Admin Authentication Middleware
=======================================================================================================================================
Purpose: Gate the /admin/* namespace used by the lmslocal-admin tool.

Deliberately separate from middleware/auth.js. Three independent things must hold before a
request is allowed through, so that compromising any one of them is not enough:

  1. The token is signed with JWT_ADMIN_SECRET, not JWT_SECRET. A token minted by the normal
     player login therefore fails signature verification here, and vice versa.
  2. The token carries scope: 'admin'. Belt and braces against the secrets ever being unified.
  3. app_user.is_admin is still true *right now*. Revoking admin is immediate - it does not
     wait for an outstanding token to expire.

Note there is no user cache here, unlike auth.js. Admin traffic is one person clicking around,
so the per-request lookup costs nothing, and it is what makes point 3 above true.
=======================================================================================================================================
Usage:
  const { verifyAdminToken } = require('../../middleware/admin-auth');
  router.post('/', verifyAdminToken, async (req, res) => { ... req.admin.id ... });
=======================================================================================================================================
*/

const jwt = require('jsonwebtoken');
const { query } = require('../database');

// Token scope claim. Present on every token admin-login issues, required by every admin route.
const ADMIN_SCOPE = 'admin';

/**
 * Sign an admin-scoped JWT. Used by admin-login so the scope claim and secret are
 * chosen in exactly one place.
 * @param {Object} user - app_user row with id, email, display_name
 * @returns {string} signed JWT
 */
const signAdminToken = (user) => {
  return jwt.sign(
    {
      user_id: user.id,
      email: user.email,
      display_name: user.display_name,
      scope: ADMIN_SCOPE
    },
    process.env.JWT_ADMIN_SECRET,
    { expiresIn: process.env.ADMIN_TOKEN_EXPIRES_IN || '12h' }
  );
};

/**
 * Express middleware - rejects anything that is not a live admin.
 * Populates req.admin with the current app_user row on success.
 */
const verifyAdminToken = async (req, res, next) => {
  try {
    // Fail loudly at request time rather than silently accepting unsigned tokens if the
    // secret was never configured in this environment.
    if (!process.env.JWT_ADMIN_SECRET) {
      console.error('admin-auth: JWT_ADMIN_SECRET is not set - refusing all admin requests');
      return res.json({
        return_code: 'SERVER_ERROR',
        message: 'Admin authentication is not configured'
      });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.json({
        return_code: 'UNAUTHORIZED',
        message: 'No token provided'
      });
    }

    // CHECK 1: signature. Throws for a token signed with the player secret.
    const decoded = jwt.verify(authHeader.substring(7), process.env.JWT_ADMIN_SECRET);

    // CHECK 2: scope claim.
    if (decoded.scope !== ADMIN_SCOPE) {
      return res.json({
        return_code: 'UNAUTHORIZED',
        message: 'Token is not valid for admin access'
      });
    }

    // CHECK 3: the flag is still set on the account.
    const result = await query(
      'SELECT id, email, display_name, is_admin FROM app_user WHERE id = $1',
      [decoded.user_id]
    );

    if (result.rows.length === 0 || result.rows[0].is_admin !== true) {
      return res.json({
        return_code: 'UNAUTHORIZED',
        message: 'Admin access has been revoked'
      });
    }

    req.admin = result.rows[0];
    next();

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.json({
        return_code: 'TOKEN_EXPIRED',
        message: 'Your admin session has expired. Please sign in again.'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.json({
        return_code: 'UNAUTHORIZED',
        message: 'Invalid token'
      });
    }

    console.error('admin-auth error:', { error: error.message, route: req.path });
    return res.json({
      return_code: 'UNAUTHORIZED',
      message: 'Authentication failed'
    });
  }
};

module.exports = {
  verifyAdminToken,
  signAdminToken,
  ADMIN_SCOPE
};
