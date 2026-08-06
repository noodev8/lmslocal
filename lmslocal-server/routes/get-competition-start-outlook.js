/*
=======================================================================================================================================
API Route: get-competition-start-outlook
=======================================================================================================================================
Method: GET
Purpose: Tells an organiser on the fixture service when their first round will start - or that it
         is waiting on them, or on the next set of fixtures.
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123                    // integer, required - query string parameter
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "ready_at": "2026-08-06T10:30:00.000Z",  // string|null, when the organiser pressed Ready
  "starts_at": "2026-08-15T14:00:00.000Z", // string|null, kickoff their first round would have
  "waiting_for_fixtures": false            // boolean, no batch they could start on yet
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"COMPETITION_NOT_FOUND"
"UNAUTHORIZED"
"SERVER_ERROR"
=======================================================================================================================================
starts_at is answered **as though the organiser were already ready**, so it is available before
they press the button as well as after. An organiser deciding whether to start their competition
is asking one question - "what happens if I press this?" - and the answer is a date. Making them
commit first and find out afterwards is the thing this feature exists to avoid.

  starts_at set              -> name the date, before or after they press
  waiting_for_fixtures true  -> no batch they could start on; say so plainly, promise nothing

Both come from services/fixtureService.js rather than a second reading of the rules, so the date
the organiser is shown cannot drift from the date they get.
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../database');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');
const { getCompetitionStartOutlook } = require('../services/fixtureService');
const router = express.Router();

router.get('/', verifyToken, async (req, res) => {
  logApiCall('get-competition-start-outlook');

  try {
    const competitionId = parseInt(req.query.competition_id);
    const user_id = req.user.id;

    if (!competitionId || Number.isNaN(competitionId)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Competition ID is required"
      });
    }

    const accessResult = await query(
      'SELECT organiser_id FROM competition WHERE id = $1',
      [competitionId]
    );

    if (accessResult.rows.length === 0) {
      return res.json({
        return_code: "COMPETITION_NOT_FOUND",
        message: "Competition not found"
      });
    }

    if (accessResult.rows[0].organiser_id !== user_id) {
      return res.json({
        return_code: "UNAUTHORIZED",
        message: "Only the competition organiser can see this"
      });
    }

    // The service takes a client; the shared pool object answers query() the same way, and this
    // is a read with no transaction to hold open.
    const outlook = await getCompetitionStartOutlook({ query }, competitionId);

    res.json({
      return_code: "SUCCESS",
      ready_at: outlook.ready_at,
      starts_at: outlook.starts_at,
      waiting_for_fixtures: outlook.waiting_for_fixtures
    });

  } catch (error) {
    console.error('get-competition-start-outlook error:', error.message);
    res.json({
      return_code: "SERVER_ERROR",
      message: "Failed to load the competition's start details"
    });
  }
});

module.exports = router;
