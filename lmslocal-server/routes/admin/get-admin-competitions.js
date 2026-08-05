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
      "organiser_id": 1003,                      // integer, may be null if organiser account was removed
      "organiser_name": "Paul Lavelle",          // string, may be null
      "organiser_email": "landlord@pub.com",     // string, may be null if organiser account was removed
      "organiser_competitions": 2,               // integer, competitions this organiser has started
      "organiser_lifetime_spend": 80,            // number, total paid across all credit purchases (0 if never paid)
      "organiser_credit": 19,                    // integer, current credit balance
      "player_count": 24,                        // integer, rows in competition_user
      "bot_count": 4,                            // integer, of which are bots
      "bots_allowed": true,                      // boolean, organiser may use bots - see services/botPool.js
      "created_at": "2026-01-04T12:00:00.000Z",  // string, ISO datetime
      "last_activity": "2026-08-01T09:00:00.000Z",// string or null, most recent pick, falls back to created_at
      "fixture_service": true,                   // boolean, opted into the automated fixture service
      "team_list_id": 1,                         // integer, which staged fixtures it receives
      "team_list_name": "English Premier League 2026-27" // string, may be null if the list was removed
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
- competition.status is uppercase ('SETUP', 'ACTIVE', 'COMPLETE'). It used to be mixed; the data
  was normalised on 2026-08-04. The filter and the returned field still lowercase it, which is
  harmless and keeps this screen's API contract unchanged.
- "last_activity" is the most recent pick.created_at across the competition's rounds, or the
  competition's created_at if it has never had a pick.
- "fixture_service" is the flag every push reads. The fixtures screen filters this list by it to
  show which competitions a push will actually reach, and the opt-in toggle writes it through
  /admin/set-fixture-service.
- Paid status comes from "organiser_lifetime_spend" (SUM over credit_purchases), NOT from
  app_user.paid_credit. paid_credit is a current balance that can be granted without any money
  changing hands, so a badge driven off it would call non-paying accounts customers. Credit is
  still returned separately as "organiser_credit" because a paying organiser at zero balance is
  worth spotting.
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../../database');
const { logApiCall } = require('../../utils/apiLogger');
const { verifyAdminToken } = require('../../middleware/admin-auth');
const { BOT_EMAIL_LIKE, BOT_ORGANISER_IDS } = require('../../services/botPool');
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
    // The organiser subselects repeat per competition, but the whole table is a few dozen rows
    // and the alternative is a second round trip to assemble the same thing client-side.
    const competitionsQuery = `
      SELECT
        c.id,
        c.name,
        LOWER(c.status)                                                       AS status,
        u.id                                                                  AS organiser_id,
        u.display_name                                                        AS organiser_name,
        u.email                                                               AS organiser_email,
        u.paid_credit                                                         AS organiser_credit,
        (SELECT COUNT(*) FROM competition oc WHERE oc.organiser_id = u.id)    AS organiser_competitions,
        (SELECT COALESCE(SUM(cp.paid_amount), 0)
           FROM credit_purchases cp
          WHERE cp.user_id = u.id)                                            AS organiser_lifetime_spend,
        (SELECT COUNT(*) FROM competition_user cu WHERE cu.competition_id = c.id) AS player_count,
        (SELECT COUNT(*)
           FROM competition_user cu
           JOIN app_user bu ON bu.id = cu.user_id
          WHERE cu.competition_id = c.id
            AND bu.email LIKE $2)                                             AS bot_count,
        c.created_at,
        COALESCE(
          (SELECT MAX(p.created_at)
             FROM pick p
             JOIN round r ON r.id = p.round_id
            WHERE r.competition_id = c.id),
          c.created_at
        )                                                                     AS last_activity,
        COALESCE(c.fixture_service, false)                                    AS fixture_service,
        c.team_list_id,
        tl.name                                                               AS team_list_name
      FROM competition c
      LEFT JOIN app_user u ON u.id = c.organiser_id
      LEFT JOIN team_list tl ON tl.id = c.team_list_id
      WHERE ($1::text IS NULL OR LOWER(c.status) = $1)
      ORDER BY last_activity DESC
    `;

    const result = await query(competitionsQuery, [statusFilter, BOT_EMAIL_LIKE]);

    const competitions = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      organiser_id: row.organiser_id,
      organiser_name: row.organiser_name,
      organiser_email: row.organiser_email,
      organiser_competitions: parseInt(row.organiser_competitions, 10) || 0,
      // NUMERIC comes back as a string from pg; the UI formats it as currency.
      organiser_lifetime_spend: parseFloat(row.organiser_lifetime_spend) || 0,
      organiser_credit: parseInt(row.organiser_credit, 10) || 0,
      player_count: parseInt(row.player_count, 10) || 0,
      bot_count: parseInt(row.bot_count, 10) || 0,
      // Whether the Bots screen would accept this competition at all, so the list can link
      // to it rather than offering a page that will refuse.
      bots_allowed: BOT_ORGANISER_IDS.includes(row.organiser_id),
      created_at: row.created_at,
      last_activity: row.last_activity,
      fixture_service: row.fixture_service === true,
      team_list_id: row.team_list_id,
      team_list_name: row.team_list_name
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
