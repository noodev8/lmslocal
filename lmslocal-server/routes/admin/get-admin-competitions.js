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
      "still_in_count": 18,                      // integer, of which not yet eliminated
      "bot_count": 4,                            // integer, of which are bots
      "bots_allowed": true,                      // boolean, organiser may use bots - see services/botPool.js
      "created_at": "2026-01-04T12:00:00.000Z",  // string, ISO datetime
      "start_date": "2026-08-28T19:00:00.000Z", // string or null, Round 1 lock time - null if no round yet
      "last_activity": "2026-08-01T09:00:00.000Z",// string or null, most recent pick, falls back to created_at
      "fixture_service": true,                   // boolean, opted into the automated fixture service
      "team_list_id": 1,                         // integer, which staged fixtures it receives
      "team_list_name": "English Premier League 2026-27", // string, may be null if the list was removed
      "real_player_count": 23,                   // integer, members who are neither the organiser nor a bot
      "pick_count": 41,                          // integer, picks ever made across every round
      "quiet_days": 3,                           // integer, whole days since last_activity
      "is_stalled": false,                       // boolean, the tyre-kicker verdict the screen counts by
      "stalled_source": "derived",               // string, "derived" (the rule) or "admin" (marked by hand)
      "stalled_override": null,                  // boolean or null - the admin's override, null when unset
      "stalled_reason": null                     // string or null, why it was called stalled
    }
  ],
  "quiet_days_threshold": 7,
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
- "last_activity" is the most recent thing that happened INSIDE this competition: the latest of
  its picks, its joins, its rounds being created, and its own created_at. It was picks alone,
  which showed a competition in SETUP as untouched since the day it was made however many people
  had joined since - comp 173 read "29 June" on a day somebody joined it.
  It is deliberately NOT the latest app_user.last_active_at across its members. That is a fact
  about a person, and a person carries it into every competition they are in: a COMPLETE
  competition whose organiser was on the site today working on a different one would read as
  active today. "Last seen" per person is the organisers screen's column, and belongs there.
- "fixture_service" is the flag every push reads. The fixtures screen filters this list by it to
  show which competitions a push will actually reach, and the opt-in toggle writes it through
  /admin/set-fixture-service.
- "is_stalled" is the tyre-kicker verdict: nobody but the organiser ever did anything and it has
  gone quiet. The rule, the exemptions and the manual override all live in
  services/competitionEngagement.js - this route only reports it. It matters because a
  competition can reach ACTIVE with a round pushed and no pick ever made, so it sat in the
  screen's "Active" tile forever; seven of thirty rows were like that.
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
const {
  QUIET_DAYS,
  realPlayerCountSql,
  pickCountSql,
  classifyCompetition
} = require('../../services/competitionEngagement');
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
        -- Memberships not yet eliminated. competition_user.status is only ever 'active' or
        -- 'out', so this is simply "still in" - it is NOT the "active players" the people cards
        -- above the list count, which mean a member of a live competition whether or not they
        -- have been knocked out.
        (SELECT COUNT(*)
           FROM competition_user cu
          WHERE cu.competition_id = c.id
            AND cu.status = 'active')                                         AS still_in_count,
        (SELECT COUNT(*)
           FROM competition_user cu
           JOIN app_user bu ON bu.id = cu.user_id
          WHERE cu.competition_id = c.id
            AND bu.email LIKE $2)                                             AS bot_count,
        -- The two facts the stalled rule turns on. Kept as their own columns rather than
        -- folded into a boolean here so the screen can show the working, not just the verdict.
        ${realPlayerCountSql('c', '$2')}                                       AS real_player_count,
        ${pickCountSql('c')}                                                   AS pick_count,
        c.stalled_override,
        c.created_at,
        -- Round 1's lock time is the competition's start: the moment picks close and it is
        -- under way. Only meaningful while status is 'setup' - once it has started, the date
        -- is in the past and last_activity is the more useful column - so the screen shows it
        -- for setup rows only. NULL for a competition with no round yet, which is every
        -- manual competition still waiting on its organiser to press Ready.
        (SELECT r.lock_time
           FROM round r
          WHERE r.competition_id = c.id
            AND r.round_number = 1)                                           AS start_date,
        -- Anything that happened IN this competition, not anything that happened to its members.
        -- GREATEST ignores NULLs, and c.created_at is NOT NULL, so this always resolves.
        GREATEST(
          (SELECT MAX(p.created_at)
             FROM pick p
             JOIN round r ON r.id = p.round_id
            WHERE r.competition_id = c.id),
          (SELECT MAX(cu.joined_at)
             FROM competition_user cu
            WHERE cu.competition_id = c.id),
          (SELECT MAX(r.created_at)
             FROM round r
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

    const competitions = result.rows.map((row) => {
      const engagement = classifyCompetition(row);
      return {
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
        still_in_count: parseInt(row.still_in_count, 10) || 0,
        real_player_count: parseInt(row.real_player_count, 10) || 0,
        pick_count: parseInt(row.pick_count, 10) || 0,
        bot_count: parseInt(row.bot_count, 10) || 0,
        // Whether the Bots screen would accept this competition at all, so the list can link
        // to it rather than offering a page that will refuse.
        bots_allowed: BOT_ORGANISER_IDS.includes(row.organiser_id),
        created_at: row.created_at,
        start_date: row.start_date,
        last_activity: row.last_activity,
        fixture_service: row.fixture_service === true,
        team_list_id: row.team_list_id,
        team_list_name: row.team_list_name,
        stalled_override: row.stalled_override,
        ...engagement
      };
    });

    return res.json({
      return_code: 'SUCCESS',
      competitions,
      quiet_days_threshold: QUIET_DAYS,
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
