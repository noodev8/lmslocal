/*
=======================================================================================================================================
API Route: get-admin-organisers
=======================================================================================================================================
Method: GET
Purpose: List every organiser on the platform for the lmslocal-admin Organisers screen - who
         they are, how to email them, and enough commercial and engagement context to decide
         who is worth contacting.

         An organiser is anyone who owns at least one competition. People who only help run
         someone else's competition (competition_user permission flags) are deliberately not
         included - they did not create anything, and this screen is about the people whose
         accounts the business relationship sits with.
=======================================================================================================================================
Request Payload:
  None (GET). Authentication is by admin token in the Authorization header.

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "organisers": [
    {
      "id": 1003,                                   // integer, app_user.id
      "name": "Paul Lavelle",                       // string, may be null
      "email": "landlord@pub.com",                  // string, may be null on very old accounts
      "email_verified": true,                       // boolean
      "competitions_total": 2,                      // integer, competitions they own
      "competitions_active": 1,                     // integer, of those, currently running
      "competitions_setup": 1,                      // integer, of those, created but not started
      "competitions_complete": 0,                   // integer, of those, finished
      "competitions_on_fixture_service": 1,         // integer, of those, opted into the fixture service
      "players_total": 22,                          // integer, memberships across their competitions
      "players_unique": 21,                         // integer, of those, distinct people
      "lifetime_spend": 80,                         // number, total ever paid across credit_purchases
      "credit": 19,                                 // integer, current credit balance
      "signed_up_at": "2026-01-04T12:00:00.000Z",   // string, ISO datetime, account created
      "last_active_at": "2026-08-01T09:00:00.000Z", // string or null, ISO datetime, last seen by the player app
      "first_competition_at": "2026-01-05T...",     // string, ISO datetime, oldest competition they created
      "last_player_activity": "2026-08-01T..."      // string or null, most recent pick across their competitions
    }
  ],
  "generated_at": "2026-08-03T14:00:00.000Z"
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
  was normalised on 2026-08-04. Every comparison here still lowercases the column first, which is
  now belt-and-braces rather than load-bearing.
- "players_total" counts competition_user rows, exactly like "player_count" in
  get-admin-competitions, so an organiser's total is the sum of the numbers shown against their
  competitions on the other screen. That matters more than it sounds: the two screens sit one
  click apart and a discrepancy of even one reads as a bug.

  It therefore includes the organiser, who is inserted into competition_user when they create a
  competition. Most of them then play, so this is not padding - but it does mean a competition
  nobody has joined reports 1, not 0.

  "players_unique" is the same set deduplicated, which is lower whenever someone plays in two of
  the same organiser's competitions. Reported separately rather than instead: the totals are what
  reconcile with the competitions screen, the distinct count is the honest reach figure.
- "lifetime_spend" is SUM over credit_purchases, NOT app_user.paid_credit. Credit can be granted
  without money changing hands, so only a purchase proves a paying customer. The current balance
  is returned separately as "credit" - a paying organiser sitting at zero is worth spotting.
- "last_active_at" is the organiser's own last session; "last_player_activity" is the newest pick
  by anyone in their competitions. An organiser who has gone quiet while their players have not
  reads very differently from one whose whole competition has stalled.
- No pagination. This is a per-account roll-up over a table in the low hundreds; the admin screen
  sorts and filters the full list client-side.
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../../database');
const { logApiCall } = require('../../utils/apiLogger');
const { verifyAdminToken } = require('../../middleware/admin-auth');
const router = express.Router();

router.get('/', verifyAdminToken, async (req, res) => {
  logApiCall('get-admin-organisers');

  try {
    // One query. Scalar subselects per organiser rather than a pile of GROUP BY joins, which
    // would multiply rows against each other - there are a few dozen organisers, so the repeated
    // subselects cost nothing and the shape stays readable.
    const organisersQuery = `
      SELECT
        u.id,
        u.display_name                                                       AS name,
        u.email,
        COALESCE(u.email_verified, false)                                    AS email_verified,
        u.paid_credit                                                        AS credit,
        u.created_at                                                         AS signed_up_at,
        u.last_active_at,

        (SELECT COUNT(*) FROM competition c WHERE c.organiser_id = u.id)     AS competitions_total,
        (SELECT COUNT(*) FROM competition c
          WHERE c.organiser_id = u.id AND LOWER(c.status) = 'active')        AS competitions_active,
        (SELECT COUNT(*) FROM competition c
          WHERE c.organiser_id = u.id AND LOWER(c.status) = 'setup')         AS competitions_setup,
        (SELECT COUNT(*) FROM competition c
          WHERE c.organiser_id = u.id AND LOWER(c.status) = 'complete')      AS competitions_complete,
        (SELECT COUNT(*) FROM competition c
          WHERE c.organiser_id = u.id
            AND COALESCE(c.fixture_service, false) = true)                   AS competitions_on_fixture_service,

        -- Memberships, counted the same way as get-admin-competitions so the two screens agree,
        -- plus the deduplicated figure (see Data Notes)
        (SELECT COUNT(*)
           FROM competition_user cu
           JOIN competition c ON c.id = cu.competition_id
          WHERE c.organiser_id = u.id)                                       AS players_total,
        (SELECT COUNT(DISTINCT cu.user_id)
           FROM competition_user cu
           JOIN competition c ON c.id = cu.competition_id
          WHERE c.organiser_id = u.id)                                       AS players_unique,

        (SELECT COALESCE(SUM(cp.paid_amount), 0)
           FROM credit_purchases cp
          WHERE cp.user_id = u.id)                                           AS lifetime_spend,

        (SELECT MIN(c.created_at) FROM competition c
          WHERE c.organiser_id = u.id)                                       AS first_competition_at,

        (SELECT MAX(p.created_at)
           FROM pick p
           JOIN round r ON r.id = p.round_id
           JOIN competition c ON c.id = r.competition_id
          WHERE c.organiser_id = u.id)                                       AS last_player_activity

      FROM app_user u
      WHERE EXISTS (SELECT 1 FROM competition c WHERE c.organiser_id = u.id)
      ORDER BY u.display_name NULLS LAST
    `;

    const result = await query(organisersQuery);

    // COUNT() arrives as a string from node-postgres (bigint), NUMERIC likewise
    const n = (value) => parseInt(value, 10) || 0;

    const organisers = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      email_verified: row.email_verified === true,
      competitions_total: n(row.competitions_total),
      competitions_active: n(row.competitions_active),
      competitions_setup: n(row.competitions_setup),
      competitions_complete: n(row.competitions_complete),
      competitions_on_fixture_service: n(row.competitions_on_fixture_service),
      players_total: n(row.players_total),
      players_unique: n(row.players_unique),
      lifetime_spend: parseFloat(row.lifetime_spend) || 0,
      credit: n(row.credit),
      signed_up_at: row.signed_up_at,
      last_active_at: row.last_active_at,
      first_competition_at: row.first_competition_at,
      last_player_activity: row.last_player_activity
    }));

    return res.json({
      return_code: 'SUCCESS',
      organisers,
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('get-admin-organisers error:', error.message);
    return res.json({
      return_code: 'SERVER_ERROR',
      message: 'Could not load organisers'
    });
  }
});

module.exports = router;
