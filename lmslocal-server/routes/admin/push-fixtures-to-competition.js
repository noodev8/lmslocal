/*
=======================================================================================================================================
API Route: push-fixtures-to-competition
=======================================================================================================================================
Method: POST
Purpose: Pushes the staged batch in fixture_load to ONE competition: creates or fills its round,
         inserts the fixtures, queues the
         round notifications and writes the audit row.

         This is the per-competition replacement for push-fixtures-to-competitions.js (plural),
         which swept every subscribed competition in a single press. That route is deprecated and
         no longer registered.

         Why it changed: the only thing standing between a mis-staged batch and every customer
         was FIXTURE_SERVICE_TEST_MODE, an env var naming one organiser's email that had to be
         set before testing and unset afterwards - and which silently starved real customers of
         fixtures while it was on. Naming the competition on every push makes the blast radius one
         competition, so the env var is gone. Results already worked this way
         (push-results-to-competition); fixtures now match.

         Does NOT touch fixture_load. The other subscribed competitions still need those rows to
         push against, so clearing the batch stays its own step (/admin/clear-staged-batch).
=======================================================================================================================================
Request Payload:
{
  "competition_id": 172                     // integer, required - the competition to push to
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "competition_id": 172,                    // integer, the competition pushed to
  "competition_name": "EKRR AFC",           // string
  "round_number": 4,                        // integer, the round created or filled
  "round_action": "created",                // string, "created" (new round) or "populated" (blank one)
  "fixtures_pushed": 10                     // integer, fixtures inserted
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "NOT_ELIGIBLE",
  "message": "Current round is still being played"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"MISSING_FIELDS"            - competition_id absent or not an integer
"COMPETITION_NOT_FOUND"     - No competition with that id
"NOT_SUBSCRIBED"            - Competition is not on the fixture service
"NOT_ELIGIBLE"              - Cannot take the batch right now; message says why
"UNAUTHORIZED"              - Missing, invalid, expired, or non-admin token
"TOKEN_EXPIRED"             - Admin session has expired
"SERVER_ERROR"              - Database or unexpected error
=======================================================================================================================================
Data Notes:
- Eligibility is re-checked inside the transaction, not trusted from the screen. The admin may
  have loaded the list minutes earlier, and a round can start or a kickoff pass in between.
- NOT_ELIGIBLE is not a failure to retry blindly: reload the list and read the reason. The four
  that matter are "still being played" (wait), "not due to start yet" (wait), "needs 48 hours'
  notice" (stage a later batch) and "already kicked off" (stage a later batch).
=======================================================================================================================================
*/

const express = require('express');
const { transaction } = require('../../database');
const { logApiCall } = require('../../utils/apiLogger');
const { verifyAdminToken } = require('../../middleware/admin-auth');
const { pushFixturesToCompetition } = require('../../services/fixtureService');

const router = express.Router();

router.post('/', verifyAdminToken, async (req, res) => {
  logApiCall('push-fixtures-to-competition');

  try {
    const { competition_id } = req.body;

    if (!competition_id || !Number.isInteger(parseInt(competition_id))) {
      return res.status(200).json({
        return_code: 'MISSING_FIELDS',
        message: 'competition_id is required and must be an integer',
      });
    }

    const competitionId = parseInt(competition_id);

    // One competition, one transaction. Nothing compounds across a batch, and a failure here
    // leaves the other competitions untouched rather than rolling them back with it.
    const result = await transaction(async (client) => {
      return await pushFixturesToCompetition(client, competitionId);
    });

    return res.status(200).json({
      return_code: 'SUCCESS',
      ...result,
    });
  } catch (error) {
    if (error.message === 'COMPETITION_NOT_FOUND') {
      return res.status(200).json({
        return_code: 'COMPETITION_NOT_FOUND',
        message: 'No competition with that id',
      });
    }

    if (error.message === 'NOT_SUBSCRIBED') {
      return res.status(200).json({
        return_code: 'NOT_SUBSCRIBED',
        message: 'This competition is not on the fixture service',
      });
    }

    if (error.message === 'NOT_ELIGIBLE') {
      return res.status(200).json({
        return_code: 'NOT_ELIGIBLE',
        message: error.reason || 'This competition cannot take the staged batch right now',
      });
    }

    console.error('Error in push-fixtures-to-competition:', error);
    return res.status(200).json({
      return_code: 'SERVER_ERROR',
      message: 'Could not push fixtures to this competition',
    });
  }
});

module.exports = router;
