/*
=======================================================================================================================================
API Route: set-competition-stalled
=======================================================================================================================================
Method: POST
Purpose: Override the derived tyre-kicker judgement for one competition, so an admin can rescue a
         genuine slow-burner the rule has written off, or condemn an obvious write-off before the
         rule's quiet window has elapsed.
=======================================================================================================================================
Request Payload:
{
  "competition_id": 176,      // integer, required
  "stalled": true             // boolean or null, required (null clears the override)
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "competition_id": 176,
  "stalled_override": true     // boolean or null - what is now stored
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"MISSING_FIELDS"            - competition_id absent, or "stalled" not supplied at all
"INVALID_STALLED"           - "stalled" was neither true, false, nor null
"COMPETITION_NOT_FOUND"     - No competition with that id
"UNAUTHORIZED"              - Missing, invalid, expired, or non-admin token
"TOKEN_EXPIRED"             - Admin session has expired
"SERVER_ERROR"              - Database error or unexpected server failure
=======================================================================================================================================
Data Notes:
- competition.stalled_override is a tri-state and this route is the only thing that writes it:
  NULL trusts the calculation, true forces stalled, false forces real. The route deliberately
  never writes the DERIVED answer into the column - that would freeze today's verdict on a
  competition that might yet come alive, and the screen could no longer tell an admin's decision
  apart from the rule's.
- Passing null is the "stop overriding" case, not a missing field, so the payload must
  distinguish "stalled": null from stalled being absent. Hence MISSING_FIELDS checks for the
  key's presence rather than its truthiness.
- Nothing here deletes anything. Marking a competition stalled only moves it out of the headline
  counts and into the Stalled tab; removing it is still the separate, name-typed step on
  /admin/delete-admin-competition.
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../../database');
const { logApiCall } = require('../../utils/apiLogger');
const { verifyAdminToken } = require('../../middleware/admin-auth');
const router = express.Router();

router.post('/', verifyAdminToken, async (req, res) => {
  logApiCall('set-competition-stalled');

  try {
    const { competition_id, stalled } = req.body;

    if (!competition_id || !Object.prototype.hasOwnProperty.call(req.body, 'stalled')) {
      return res.json({
        return_code: 'MISSING_FIELDS',
        message: 'competition_id and stalled are required'
      });
    }

    if (stalled !== true && stalled !== false && stalled !== null) {
      return res.json({
        return_code: 'INVALID_STALLED',
        message: 'stalled must be true, false, or null to clear the override'
      });
    }

    const result = await query(
      `UPDATE competition
          SET stalled_override = $2
        WHERE id = $1
        RETURNING id, stalled_override`,
      [competition_id, stalled]
    );

    if (result.rows.length === 0) {
      return res.json({
        return_code: 'COMPETITION_NOT_FOUND',
        message: 'No competition with that id'
      });
    }

    return res.json({
      return_code: 'SUCCESS',
      competition_id: result.rows[0].id,
      stalled_override: result.rows[0].stalled_override
    });

  } catch (error) {
    console.error('set-competition-stalled error:', error.message);
    return res.json({
      return_code: 'SERVER_ERROR',
      message: 'Could not update the competition'
    });
  }
});

module.exports = router;
