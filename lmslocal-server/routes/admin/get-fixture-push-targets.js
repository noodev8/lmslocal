/*
=======================================================================================================================================
API Route: get-fixture-push-targets
=======================================================================================================================================
Method: GET
Purpose: Lists every competition subscribed to a team list, with a verdict on whether the staged
         batch may be pushed to it, so the admin can push them one at a time.

         Not the same question as get-push-targets. That one asks "which competitions already
         HOLD this batch", matching on home team + away team + kickoff, because results are
         written onto fixtures that are already there. This asks "which competitions may RECEIVE
         it" - a competition appears here before it has any of these fixtures.

         Blocked competitions are listed too, with the reason, rather than filtered out. A
         competition that simply vanishes from the screen looks like a bug, and "why didn't that
         one get its fixtures?" is exactly what this list is for.
=======================================================================================================================================
Request Payload:
  None (GET). Query string:
    team_list_id=1                          // integer, required - which staged batch to report on
  Authentication is by admin token in the Authorization header.

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "staged_total": 10,                       // integer, fixtures staged for this team list
  "earliest_kickoff": "2026-08-21T19:00:00.000Z", // string or null, the batch's deadline
  "competitions": [
    {
      "competition_id": 172,                // integer
      "name": "EKRR AFC",                   // string
      "organiser_email": "jo@example.com",  // string
      "organiser_name": "Jo",               // string
      "players": 24,                        // integer, total members
      "active_players": 20,                 // integer, members still in
      "round_number": 3,                    // integer or null, latest round (null = none yet)
      "round_state": "round_complete",      // string, no_round|blank_round|round_complete|round_in_progress
      "eligible": true,                     // boolean, may be pushed to right now
      "reason": null                        // string or null, why not, in words for a person
    }
  ]
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"MISSING_FIELDS"            - team_list_id absent or not an integer
"UNAUTHORIZED"              - Missing, invalid, expired, or non-admin token
"TOKEN_EXPIRED"             - Admin session has expired
"SERVER_ERROR"              - Database or unexpected error
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../../database');
const { logApiCall } = require('../../utils/apiLogger');
const { verifyAdminToken } = require('../../middleware/admin-auth');
const { getFixturePushCandidates } = require('../../services/fixtureService');

const router = express.Router();

router.get('/', verifyAdminToken, async (req, res) => {
  logApiCall('get-fixture-push-targets');

  try {
    const teamListId = parseInt(req.query.team_list_id, 10);

    if (!Number.isInteger(teamListId)) {
      return res.status(200).json({
        return_code: 'MISSING_FIELDS',
        message: 'team_list_id is required and must be an integer',
      });
    }

    // Read-only, so it runs on the pool rather than in a transaction.
    const result = await getFixturePushCandidates({ query }, teamListId);

    return res.status(200).json({
      return_code: 'SUCCESS',
      staged_total: result.staged_total,
      earliest_kickoff: result.earliest_kickoff,
      competitions: result.competitions,
    });
  } catch (error) {
    console.error('Error in get-fixture-push-targets:', error);
    return res.status(200).json({
      return_code: 'SERVER_ERROR',
      message: 'Could not load the competitions waiting for this batch',
    });
  }
});

module.exports = router;
