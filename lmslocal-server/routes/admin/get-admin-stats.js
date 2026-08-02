/*
=======================================================================================================================================
API Route: get-admin-stats
=======================================================================================================================================
Method: GET
Purpose: Platform-wide counts for the lmslocal-admin dashboard. Aggregates across every
         competition regardless of who organises it.

         This is deliberately a separate route rather than a privileged mode of
         /get-user-dashboard. That route is scoped to "competitions this user belongs to",
         and adding an admin bypass to it would put a hole in the security model the player
         app depends on. Admin reads get their own queries.
=======================================================================================================================================
Request Payload:
  None. Authentication is by admin token in the Authorization header.

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "competitions": {
    "total": 33,                            // integer, all competitions ever created
    "setup": 25,                            // integer, created but not started
    "active": 4,                            // integer, currently running
    "complete": 4,                          // integer, finished
    "inactive": 12                          // integer, no player activity in the last 30 days
  },
  "players": {
    "total_memberships": 180,               // integer, rows in competition_user (a person in 2 comps counts twice)
    "unique_players": 140,                  // integer, distinct people taking part in a competition
    "still_in": 95,                         // integer, memberships not yet eliminated
    "eliminated": 85                        // integer, memberships knocked out
  },
  "users": {
    "total": 239,                           // integer, registered accounts
    "verified": 210,                        // integer, accounts with a verified email
    "new_last_30_days": 18                  // integer, accounts created in the last 30 days
  },
  "generated_at": "2026-08-02T14:00:00.000Z" // string, ISO datetime this snapshot was taken
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"UNAUTHORIZED"              - Missing, invalid, expired, or non-admin token
"TOKEN_EXPIRED"             - Admin session has expired
"SERVER_ERROR"              - Database error or unexpected server failure
=======================================================================================================================================
Data Notes:
- competition.status casing is inconsistent in production ('SETUP', 'COMPLETE', but lowercase
  'active'). Every comparison here lowercases the column first - do not remove that.
- "inactive" means no pick has been made in any of the competition's rounds for 30 days. It
  counts only competitions that are supposed to be running, so a SETUP or COMPLETE competition
  is never reported as inactive.
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../../database');
const { logApiCall } = require('../../utils/apiLogger');
const { verifyAdminToken } = require('../../middleware/admin-auth');
const router = express.Router();

// A competition running with no picks for this long is considered to have gone quiet
const INACTIVE_AFTER_DAYS = 30;

router.get('/', verifyAdminToken, async (req, res) => {
  logApiCall('get-admin-stats');

  try {
    // One round trip. These are small aggregates over small tables, so a single query with
    // scalar subselects beats four sequential ones.
    const statsQuery = `
      SELECT
        -- Competition counts. LOWER() guards the known status casing inconsistency.
        (SELECT COUNT(*) FROM competition)                                        AS comp_total,
        (SELECT COUNT(*) FROM competition WHERE LOWER(status) = 'setup')          AS comp_setup,
        (SELECT COUNT(*) FROM competition WHERE LOWER(status) = 'active')         AS comp_active,
        (SELECT COUNT(*) FROM competition WHERE LOWER(status) = 'complete')       AS comp_complete,

        -- Running competitions whose most recent pick is older than the cutoff, plus those
        -- that are running but have never had a pick at all.
        (SELECT COUNT(*)
           FROM competition c
          WHERE LOWER(c.status) = 'active'
            AND COALESCE(
                  (SELECT MAX(p.created_at)
                     FROM pick p
                     JOIN round r ON r.id = p.round_id
                    WHERE r.competition_id = c.id),
                  c.created_at
                ) < NOW() - ($1 || ' days')::interval
        )                                                                         AS comp_inactive,

        -- Player participation
        (SELECT COUNT(*) FROM competition_user)                                   AS memberships_total,
        (SELECT COUNT(DISTINCT user_id) FROM competition_user)                    AS players_unique,
        (SELECT COUNT(*) FROM competition_user WHERE LOWER(status) = 'active')    AS memberships_active,
        (SELECT COUNT(*) FROM competition_user WHERE LOWER(status) = 'out')       AS memberships_out,

        -- Account totals
        (SELECT COUNT(*) FROM app_user)                                           AS users_total,
        (SELECT COUNT(*) FROM app_user WHERE email_verified = true)               AS users_verified,
        (SELECT COUNT(*) FROM app_user
          WHERE created_at > NOW() - INTERVAL '30 days')                          AS users_new
    `;

    const result = await query(statsQuery, [INACTIVE_AFTER_DAYS]);
    const row = result.rows[0];

    // COUNT() comes back as a string from node-postgres (bigint), so coerce for the client
    const n = (value) => parseInt(value, 10) || 0;

    return res.json({
      return_code: 'SUCCESS',
      competitions: {
        total: n(row.comp_total),
        setup: n(row.comp_setup),
        active: n(row.comp_active),
        complete: n(row.comp_complete),
        inactive: n(row.comp_inactive)
      },
      players: {
        total_memberships: n(row.memberships_total),
        unique_players: n(row.players_unique),
        still_in: n(row.memberships_active),
        eliminated: n(row.memberships_out)
      },
      users: {
        total: n(row.users_total),
        verified: n(row.users_verified),
        new_last_30_days: n(row.users_new)
      },
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('get-admin-stats error:', error.message);
    return res.json({
      return_code: 'SERVER_ERROR',
      message: 'Could not load dashboard statistics'
    });
  }
});

module.exports = router;
