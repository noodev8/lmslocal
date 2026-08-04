/*
=======================================================================================================================================
API Route: clear-staged-batch
=======================================================================================================================================
Method: POST
Purpose: Empties fixture_load for one team list, which is what allows the next batch to be staged.

         This used to be the final step of push-results-to-competitions.js (plural), which
         deleted the pushed rows once it had finished every competition in one pass. Pushing one
         competition at a time cannot do that - the competitions still to be pushed need the same
         staged rows to match against - so clearing the batch is now its own deliberate step,
         pressed once the admin is satisfied every competition is done.

         The model is otherwise unchanged: only one staged batch at a time per team list, and
         add-staged-fixtures stays blocked until this route empties the table.
=======================================================================================================================================
Request Payload:
{
  "team_list_id": 1,                        // integer, required - whose batch to clear
  "force": false                            // boolean, optional - clear despite outstanding competitions
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "rows_cleared": 10,                       // integer, fixture_load rows deleted
  "forced": false,                          // boolean, whether the outstanding-work guard was overridden
  "message": "Staged batch cleared"
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "OUTSTANDING_COMPETITIONS",
  "message": "2 competitions have not been fully pushed yet",
  "competitions": [                         // array, so the screen can name them rather than just refuse
    { "competition_id": 149, "name": "Lakers LMS", "fixtures_pending": 10, "fixtures_unprocessed": 0 }
  ]
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"MISSING_FIELDS"            - team_list_id absent or not an integer
"NOTHING_STAGED"            - No rows in fixture_load for that team list
"OUTSTANDING_COMPETITIONS"  - At least one competition still has unpushed or unprocessed fixtures
"UNAUTHORIZED"              - Missing, invalid, expired, or non-admin token
"TOKEN_EXPIRED"             - Admin session has expired
"SERVER_ERROR"              - Database or unexpected error
=======================================================================================================================================
Why the guard, and why it can be overridden:

  Clearing early is recoverable but confusing. A competition with fixtures still unresulted
  (fixtures_pending) loses its only source of results and the round stalls until the same batch
  is staged again. A competition that was pushed but not processed (fixtures_unprocessed) is
  actually fine - push-results-to-competition deliberately still finishes those with an empty
  staging table - but it is worth naming rather than silently leaving behind.

  force exists because the admin can legitimately know better: a competition may have been taken
  off the fixture service mid-batch, or its round resolved by hand.
=======================================================================================================================================
*/

const express = require('express');
const { transaction } = require('../../database');
const { logApiCall } = require('../../utils/apiLogger');
const { verifyAdminToken } = require('../../middleware/admin-auth');
const router = express.Router();

router.post('/', verifyAdminToken, async (req, res) => {
  logApiCall('clear-staged-batch');

  try {
    const { team_list_id, force } = req.body;
    const teamListId = parseInt(team_list_id);

    if (!team_list_id || !Number.isInteger(teamListId)) {
      return res.json({
        return_code: 'MISSING_FIELDS',
        message: 'team_list_id is required and must be an integer'
      });
    }

    const testModeEmail = process.env.FIXTURE_SERVICE_TEST_MODE || null;
    const forced = force === true;

    const result = await transaction(async (client) => {
      // Competitions still holding unfinished fixtures from this batch. Same three-column match
      // as the push, so this asks the same question the push would.
      const outstandingResult = await client.query(`
        SELECT
          c.id AS competition_id,
          c.name,
          COUNT(*) FILTER (WHERE f.result IS NULL) AS fixtures_pending,
          COUNT(*) FILTER (WHERE f.result IS NOT NULL AND f.processed IS NULL) AS fixtures_unprocessed
        FROM fixture_load fl
        JOIN fixture f
          ON f.home_team_short = fl.home_team_short
         AND f.away_team_short = fl.away_team_short
         AND f.kickoff_time = fl.kickoff_time
        JOIN competition c ON c.id = f.competition_id AND c.fixture_service = true
        JOIN app_user u ON u.id = c.organiser_id
        WHERE fl.team_list_id = $1
          AND ($2::text IS NULL OR u.email = $2)
        GROUP BY c.id, c.name
        HAVING COUNT(*) FILTER (WHERE f.result IS NULL) > 0
            OR COUNT(*) FILTER (WHERE f.result IS NOT NULL AND f.processed IS NULL) > 0
        ORDER BY c.name
      `, [teamListId, testModeEmail]);

      if (outstandingResult.rows.length > 0 && !forced) {
        const error = new Error('OUTSTANDING_COMPETITIONS');
        error.competitions = outstandingResult.rows.map((row) => ({
          competition_id: row.competition_id,
          name: row.name,
          fixtures_pending: parseInt(row.fixtures_pending, 10),
          fixtures_unprocessed: parseInt(row.fixtures_unprocessed, 10)
        }));
        throw error;
      }

      const deleteResult = await client.query(`
        DELETE FROM fixture_load
        WHERE team_list_id = $1
        RETURNING fixture_id
      `, [teamListId]);

      if (deleteResult.rowCount === 0) {
        throw new Error('NOTHING_STAGED');
      }

      return { rows_cleared: deleteResult.rowCount };
    });

    return res.json({
      return_code: 'SUCCESS',
      rows_cleared: result.rows_cleared,
      forced,
      message: 'Staged batch cleared'
    });

  } catch (error) {
    if (error.message === 'OUTSTANDING_COMPETITIONS') {
      const count = error.competitions.length;
      return res.json({
        return_code: 'OUTSTANDING_COMPETITIONS',
        message: `${count} competition${count === 1 ? ' has' : 's have'} not been fully pushed yet`,
        competitions: error.competitions
      });
    }

    if (error.message === 'NOTHING_STAGED') {
      return res.json({
        return_code: 'NOTHING_STAGED',
        message: 'There is no staged batch for that team list'
      });
    }

    console.error('clear-staged-batch error:', error.message);
    return res.json({
      return_code: 'SERVER_ERROR',
      message: 'Could not clear the staged batch'
    });
  }
});

module.exports = router;
