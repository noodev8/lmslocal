/*
=======================================================================================================================================
API Route: set-competition-archived
=======================================================================================================================================
Method: POST
Purpose: Archive a competition, or bring it back. Archiving takes it out of every count and tab on
         the admin screens and puts it in the Archived tab — an admin saying "this one is done,
         get it out of my way".
=======================================================================================================================================
Request Payload:
{
  "competition_id": 176,      // integer, required
  "archived": true            // boolean, required (false un-archives)
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "competition_id": 176,
  "archived_at": "2026-09-04T10:22:00.000Z"   // string or null - null when not archived
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"MISSING_FIELDS"            - competition_id absent, or "archived" not supplied at all
"INVALID_ARCHIVED"          - "archived" was not a boolean
"COMPETITION_NOT_FOUND"     - No competition with that id
"UNAUTHORIZED"              - Missing, invalid, expired, or non-admin token
"TOKEN_EXPIRED"             - Admin session has expired
"SERVER_ERROR"              - Database error or unexpected server failure
=======================================================================================================================================
Data Notes:
- competition.archived_at is a timestamp or NULL, and this route is the only thing that writes it.
  It replaced competition.stalled_override (2026-09-04), a tri-state that overrode a DERIVED
  "tyre kicker" rule. The rule is gone: archived now means somebody pressed this, and nothing
  else. See services/competitionEngagement.js for why that swap was worth making.
- ARCHIVING IS A JUDGEMENT, NOT A CALCULATION, so this route stores the moment it was made rather
  than a bare boolean. Nothing reads the timestamp's value yet; it costs a column type to have it
  and there is no recovering it later.
- Un-archiving is the same route with false, which nulls the column. That is a real case, not a
  courtesy: the counts move when it happens, so an archive pressed by mistake has to be reversible
  without going near the database.
- Nothing here deletes anything. Archiving only moves a competition out of the headline counts and
  into the Archived tab; removing it is still the separate, name-typed step on
  /admin/delete-admin-competition.
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../../database');
const { logApiCall } = require('../../utils/apiLogger');
const { verifyAdminToken } = require('../../middleware/admin-auth');
const router = express.Router();

router.post('/', verifyAdminToken, async (req, res) => {
  logApiCall('set-competition-archived');

  try {
    const { competition_id, archived } = req.body;

    if (!competition_id || !Object.prototype.hasOwnProperty.call(req.body, 'archived')) {
      return res.json({
        return_code: 'MISSING_FIELDS',
        message: 'competition_id and archived are required'
      });
    }

    if (archived !== true && archived !== false) {
      return res.json({
        return_code: 'INVALID_ARCHIVED',
        message: 'archived must be true or false'
      });
    }

    /*
    NOW() only when archiving. Re-archiving something already archived would otherwise move the
    timestamp, quietly rewriting when the decision was actually taken.
    */
    const result = await query(
      `UPDATE competition
          SET archived_at = CASE WHEN $2 THEN COALESCE(archived_at, NOW()) ELSE NULL END
        WHERE id = $1
        RETURNING id, archived_at`,
      [competition_id, archived]
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
      archived_at: result.rows[0].archived_at
    });

  } catch (error) {
    console.error('set-competition-archived error:', error.message);
    return res.json({
      return_code: 'SERVER_ERROR',
      message: 'Could not update the competition'
    });
  }
});

module.exports = router;
