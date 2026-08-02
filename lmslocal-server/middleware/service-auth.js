/*
=======================================================================================================================================
Service Token Authentication Middleware
=======================================================================================================================================
Purpose: Protect routes that are invoked by machines - schedulers, cron, or an operator running
         curl - rather than by a logged-in user. These have no user context, so JWT auth does
         not apply; they authenticate with a shared secret from the environment.

Used by the email pipeline (/load-pick-reminder, /load-results-email, /send-email). Those
routes queue and dispatch real email to real players, so they must not be callable by anyone
who knows the URL.

Why a header rather than a body field:
  - The existing bot routes pass `bot_manage` in the JSON body with the value hardcoded in
    source. A header keeps the credential out of request bodies, out of anything that logs
    payloads, and out of the repository.
  - It also means the routes' own payload contracts stay unchanged.

IMPORTANT: this is a shared secret, not a user identity. It must never be embedded in a
browser bundle. If the admin tool ever needs to trigger these from the UI, give the route an
admin-token path (see middleware/admin-auth.js) rather than shipping SERVICE_TOKEN to the
client - anything a browser can read is public.
=======================================================================================================================================
Usage (applied at mount time in server.js so the protection is visible in the route table):
  app.use('/send-email', verifyServiceToken, sendEmailRoute);

Callers send:
  X-Service-Token: <value of SERVICE_TOKEN>
=======================================================================================================================================
*/

const crypto = require('crypto');

/**
 * Compare two strings without leaking their contents through timing.
 * Hashing both sides first keeps the compared buffers the same length, which
 * crypto.timingSafeEqual requires and which also avoids revealing the secret's length.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
const safeEqual = (a, b) => {
  const hashA = crypto.createHash('sha256').update(String(a)).digest();
  const hashB = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(hashA, hashB);
};

const verifyServiceToken = (req, res, next) => {
  const expected = process.env.SERVICE_TOKEN;

  // Fail closed. An unset secret must never mean "allow everyone" - that is exactly the
  // state these routes were in before, and it is invisible until someone abuses it.
  if (!expected || expected.trim().length === 0) {
    console.error(`service-auth: SERVICE_TOKEN is not set - refusing ${req.path}`);
    return res.json({
      return_code: 'SERVER_ERROR',
      message: 'Service authentication is not configured'
    });
  }

  const provided = req.headers['x-service-token'];

  if (!provided || !safeEqual(provided, expected)) {
    console.warn(`service-auth: rejected call to ${req.path} from ${req.ip || 'unknown ip'}`);
    return res.json({
      return_code: 'UNAUTHORIZED',
      message: 'Missing or invalid service token'
    });
  }

  next();
};

module.exports = { verifyServiceToken };
