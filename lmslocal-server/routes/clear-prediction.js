/*
=======================================================================================================================================
API Route: clear-prediction
=======================================================================================================================================
Method: POST
Purpose: Take back a Matchday prediction, leaving that fixture skipped (it scores 0). Matchday only
         - the Last Man Standing equivalent is unselect-pick. docs/matchday.md.

         Idempotent: clearing a fixture with no prediction succeeds with "cleared": false, so the
         card deck's Skip can call this without first asking whether there is anything to clear.
=======================================================================================================================================
Request Payload:
{
  "fixture_id": 5012                        // integer, required - the fixture to clear
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "cleared": true                           // boolean, false when there was nothing to clear
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"MISSING_FIELDS"            - fixture_id not an integer
"FIXTURE_NOT_FOUND"         - No fixture with that id
"FORBIDDEN"                 - Not a Matchday competition, or the caller is not a player in it
"ROUND_LOCKED"              - The round has locked; predictions can no longer change
"UNAUTHORIZED"              - Missing or invalid token
"SERVER_ERROR"              - Database or unexpected error
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../database');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  logApiCall('clear-prediction');

  try {
    const { fixture_id } = req.body;
    const userId = req.user.id;

    if (!Number.isInteger(fixture_id)) {
      return res.json({ return_code: 'MISSING_FIELDS', message: 'fixture_id (integer) is required' });
    }

    const contextResult = await query(`
      SELECT c.game_type, r.lock_time, cu.user_id AS member_id,
             (r.lock_time IS NULL OR r.lock_time > NOW()) AS open
      FROM fixture f
      JOIN round r ON r.id = f.round_id
      JOIN competition c ON c.id = r.competition_id
      LEFT JOIN competition_user cu ON cu.competition_id = c.id AND cu.user_id = $2
      WHERE f.id = $1
    `, [fixture_id, userId]);

    if (contextResult.rows.length === 0) {
      return res.json({ return_code: 'FIXTURE_NOT_FOUND', message: 'Fixture not found' });
    }

    const context = contextResult.rows[0];

    if (context.game_type !== 'matchday') {
      return res.json({ return_code: 'FORBIDDEN', message: 'This competition is not a Matchday game' });
    }

    if (context.member_id === null) {
      return res.json({ return_code: 'FORBIDDEN', message: 'You are not a player in this competition' });
    }

    if (!context.open) {
      return res.json({ return_code: 'ROUND_LOCKED', message: 'This round has locked' });
    }

    // The lock again in the delete itself, for the same reason as set-prediction: the round can
    // lock between the check above and this statement, and a cleared prediction after kickoff is
    // as wrong as a new one.
    const deleteResult = await query(`
      DELETE FROM prediction p
      USING round r
      WHERE p.fixture_id = $1
        AND p.user_id = $2
        AND r.id = p.round_id
        AND (r.lock_time IS NULL OR r.lock_time > NOW())
    `, [fixture_id, userId]);

    return res.json({
      return_code: 'SUCCESS',
      cleared: deleteResult.rowCount > 0
    });

  } catch (error) {
    console.error('clear-prediction error:', error);
    return res.json({ return_code: 'SERVER_ERROR', message: 'Internal server error' });
  }
});

module.exports = router;
