/*
=======================================================================================================================================
API Route: get-admin-competitions
=======================================================================================================================================
Method: GET
Purpose: List every competition on the platform for the lmslocal-admin dashboard drill-down,
         with organiser, player count, and activity so an admin can spot what needs attention
         without querying the database directly.
=======================================================================================================================================
Request Payload:
  None (GET). Optional query string:
    ?status=active|setup|complete   - filter to one status (case-insensitive). Omit for all.

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "competitions": [
    {
      "id": 12,                                  // integer
      "name": "Friday Night LMS",                // string
      "status": "active",                        // string, lowercased
      "organiser_email": "landlord@pub.com",     // string, may be null if organiser account was removed
      "player_count": 24,                        // integer, rows in competition_user
      "created_at": "2026-01-04T12:00:00.000Z",  // string, ISO datetime
      "last_activity": "2026-08-01T09:00:00.000Z" // string or null, most recent pick, falls back to created_at
    }
  ],
  "generated_at": "2026-08-02T14:00:00.000Z"
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
  'active'). The filter and the returned field both lowercase it.
- "last_activity" is the most recent pick.created_at across the competition's rounds, or the
  competition's created_at if it has never had a pick.
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../../database');
const { logApiCall } = require('../../utils/apiLogger');
const { verifyAdminToken } = require('../../middleware/admin-auth');
const router = express.Router();

const VALID_STATUSES = ['setup', 'active', 'complete'];

router.get('/', verifyAdminToken, async (req, res) => {
  logApiCall('get-admin-competitions');

  try {
    const statusFilter = typeof req.query.status === 'string'
      ? req.query.status.toLowerCase()
      : null;

    if (statusFilter && !VALID_STATUSES.includes(statusFilter)) {
      return res.json({
        return_code: 'VALIDATION_ERROR',
        message: `status must be one of: ${VALID_STATUSES.join(', ')}`
      });
    }

    // One query - organiser via LEFT JOIN (organiser account may have been removed), player
    // count via a scalar subselect, last activity via a scalar subselect over pick/round.
    const competitionsQuery = `
      SELECT
        c.id,
        c.name,
        LOWER(c.status)                                                       AS status,
        u.email                                                               AS organiser_email,
        (SELECT COUNT(*) FROM competition_user cu WHERE cu.competition_id = c.id) AS player_count,
        c.created_at,
        COALESCE(
          (SELECT MAX(p.created_at)
             FROM pick p
             JOIN round r ON r.id = p.round_id
            WHERE r.competition_id = c.id),
          c.created_at
        )                                                                     AS last_activity
      FROM competition c
      LEFT JOIN app_user u ON u.id = c.organiser_id
      WHERE ($1::text IS NULL OR LOWER(c.status) = $1)
      ORDER BY last_activity DESC
    `;

    const result = await query(competitionsQuery, [statusFilter]);

    const competitions = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      organiser_email: row.organiser_email,
      player_count: parseInt(row.player_count, 10) || 0,
      created_at: row.created_at,
      last_activity: row.last_activity
    }));

    return res.json({
      return_code: 'SUCCESS',
      competitions,
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('get-admin-competitions error:', error.message);
    return res.json({
      return_code: 'SERVER_ERROR',
      message: 'Could not load competitions'
    });
  }
});

module.exports = router;
