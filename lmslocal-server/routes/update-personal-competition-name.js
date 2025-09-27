/*
=======================================================================================================================================
API Route: update-personal-competition-name
=======================================================================================================================================
Method: POST
Purpose: Updates user's personal nickname for a specific competition
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123,                    // integer, required - ID of competition to update
  "personal_name": "My Sunday League"       // string, optional - Personal nickname (null/empty to clear)
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Personal competition name updated successfully",
  "personal_name": "My Sunday League"       // string or null, updated personal name
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
*/

const express = require('express');
const { query } = require('../database');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  // Log API call if enabled
  logApiCall('update-personal-competition-name');

  try {
    const { competition_id, personal_name } = req.body;
    const user_id = req.user.id;

    // Validate required competition_id parameter
    if (!competition_id || !Number.isInteger(competition_id)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Competition ID is required and must be a valid integer"
      });
    }

    // Validate personal_name if provided (allow null/empty to clear)
    if (personal_name !== undefined && personal_name !== null && personal_name !== '') {
      if (typeof personal_name !== 'string') {
        return res.json({
          return_code: "VALIDATION_ERROR",
          message: "Personal name must be a string"
        });
      }

      if (personal_name.trim().length > 100) {
        return res.json({
          return_code: "VALIDATION_ERROR",
          message: "Personal name must be 100 characters or less"
        });
      }
    }

    // Check if user is a participant OR organizer of this competition
    const accessCheck = await query(
      `SELECT cu.id as participant_id, c.organiser_id
       FROM competition c
       LEFT JOIN competition_user cu ON c.id = cu.competition_id AND cu.user_id = $2
       WHERE c.id = $1`,
      [competition_id, user_id]
    );

    if (accessCheck.rows.length === 0) {
      return res.json({
        return_code: "COMPETITION_NOT_FOUND",
        message: "Competition not found"
      });
    }

    const { participant_id, organiser_id } = accessCheck.rows[0];
    const isParticipant = participant_id !== null;
    const isOrganiser = organiser_id === user_id;

    if (!isParticipant && !isOrganiser) {
      return res.json({
        return_code: "UNAUTHORIZED",
        message: "You are not a participant or organizer of this competition"
      });
    }

    // If user is organizer but not participant, we need to create a participant record first
    if (isOrganiser && !isParticipant) {
      await query(
        'INSERT INTO competition_user (competition_id, user_id, status, personal_name) VALUES ($1, $2, $3, $4)',
        [competition_id, user_id, 'active', (personal_name && personal_name.trim()) ? personal_name.trim() : null]
      );
    }

    // Prepare the personal name value (null for empty strings)
    const nameValue = (personal_name && personal_name.trim()) ? personal_name.trim() : null;

    // Update the personal name (only if we didn't just create the record above)
    let updateResult;
    if (isOrganiser && !isParticipant) {
      // We already inserted the record with the personal name, just return it
      updateResult = { rows: [{ personal_name: nameValue }] };
    } else {
      // Update existing participant record
      updateResult = await query(
        'UPDATE competition_user SET personal_name = $1 WHERE competition_id = $2 AND user_id = $3 RETURNING personal_name',
        [nameValue, competition_id, user_id]
      );
    }

    if (updateResult.rows.length === 0) {
      return res.json({
        return_code: "COMPETITION_NOT_FOUND",
        message: "Competition participation not found"
      });
    }

    // Success response
    res.json({
      return_code: "SUCCESS",
      message: "Personal competition name updated successfully",
      personal_name: updateResult.rows[0].personal_name
    });

  } catch (error) {
    console.error('Update personal competition name error:', error);

    res.json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;