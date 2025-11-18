/*
=======================================================================================================================================
API Route: get-unpicked-players
=======================================================================================================================================
Method: POST
Purpose: Returns list of active players who have not made their pick for the current/specified round.
         Used to display stragglers when organizers/participants check round progress.
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123,               // integer, required - Competition ID
  "round_id": 456                      // integer, optional - Specific round (defaults to current round)
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "round_number": 5,                   // integer, round number for context
  "unpicked_players": [                // array, players who haven't picked (alphabetical by display_name)
    {
      "user_id": 10,                   // integer, user ID
      "display_name": "John Smith"     // string, player's display name
    },
    ...
  ],
  "total_unpicked": 2                  // integer, count of unpicked players
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR" - Missing or invalid competition_id
"COMPETITION_NOT_FOUND" - Competition does not exist
"ROUND_NOT_FOUND" - No rounds exist for this competition
"UNAUTHORIZED" - User is not organiser or participant of this competition
"SERVER_ERROR" - Database error or unexpected server failure
=======================================================================================================================================
*/

const express = require('express');
const router = express.Router();
const { query } = require('../database'); // Use central database with destructured import
const { verifyToken } = require('../middleware/auth'); // JWT authentication middleware
const { logApiCall } = require('../utils/apiLogger'); // API logging utility

/**
 * POST /get-unpicked-players
 * Returns active players who haven't made picks for current/specified round
 */
router.post('/', verifyToken, async (req, res) => {
  try {
    // Extract user ID from JWT token (set by verifyToken middleware)
    const userId = req.user.id;

    // Log the API call for monitoring and debugging
    logApiCall('get-unpicked-players');

    // Extract and validate request payload
    const { competition_id, round_id } = req.body;

    // Validate required competition_id parameter
    if (!competition_id || !Number.isInteger(competition_id)) {
      return res.status(200).json({
        return_code: 'VALIDATION_ERROR',
        message: 'Competition ID is required and must be a number'
      });
    }

    // Step 1: Verify competition exists and user is authorized (organiser or participant)
    const competitionCheck = await query(`
      SELECT
        c.id,
        c.organiser_id,
        EXISTS (
          SELECT 1 FROM competition_user cu
          WHERE cu.competition_id = c.id AND cu.user_id = $2
        ) as is_participant
      FROM competition c
      WHERE c.id = $1
    `, [competition_id, userId]);

    // Check if competition exists
    if (competitionCheck.rows.length === 0) {
      return res.status(200).json({
        return_code: 'COMPETITION_NOT_FOUND',
        message: 'Competition not found'
      });
    }

    const competition = competitionCheck.rows[0];

    // Verify user authorization - must be organiser OR participant
    const isOrganiser = competition.organiser_id === userId;
    const isParticipant = competition.is_participant;

    if (!isOrganiser && !isParticipant) {
      return res.status(200).json({
        return_code: 'UNAUTHORIZED',
        message: 'Only competition organisers and participants can view unpicked players'
      });
    }

    // Step 2: Determine which round to check (use provided round_id or get current round)
    let targetRoundId = round_id;
    let roundNumber = null;

    if (!targetRoundId) {
      // No round_id provided - get current round (latest by round_number)
      const currentRoundQuery = await query(`
        SELECT id, round_number
        FROM round
        WHERE competition_id = $1
        ORDER BY round_number DESC
        LIMIT 1
      `, [competition_id]);

      // Check if any rounds exist for this competition
      if (currentRoundQuery.rows.length === 0) {
        return res.status(200).json({
          return_code: 'ROUND_NOT_FOUND',
          message: 'No rounds found for this competition'
        });
      }

      targetRoundId = currentRoundQuery.rows[0].id;
      roundNumber = currentRoundQuery.rows[0].round_number;
    } else {
      // round_id was provided - get its round_number for response
      const roundQuery = await query(`
        SELECT round_number
        FROM round
        WHERE id = $1 AND competition_id = $2
      `, [targetRoundId, competition_id]);

      if (roundQuery.rows.length === 0) {
        return res.status(200).json({
          return_code: 'ROUND_NOT_FOUND',
          message: 'Specified round not found for this competition'
        });
      }

      roundNumber = roundQuery.rows[0].round_number;
    }

    // Step 3: Get all active players who have NOT made picks for the target round
    // Uses LEFT JOIN to find active players without matching picks
    const unpickedQuery = await query(`
      SELECT
        au.id as user_id,
        cu.player_display_name as display_name
      FROM competition_user cu
      INNER JOIN app_user au ON cu.user_id = au.id
      LEFT JOIN pick p ON p.round_id = $2 AND p.user_id = au.id
      WHERE cu.competition_id = $1
        AND cu.status = 'active'
        AND p.id IS NULL
      ORDER BY cu.player_display_name ASC
    `, [competition_id, targetRoundId]);

    // Build unpicked players array from query results
    const unpickedPlayers = unpickedQuery.rows.map(row => ({
      user_id: row.user_id,
      display_name: row.display_name
    }));

    // Return success response with unpicked players list
    return res.status(200).json({
      return_code: 'SUCCESS',
      round_number: roundNumber,
      unpicked_players: unpickedPlayers,
      total_unpicked: unpickedPlayers.length
    });

  } catch (error) {
    // Log error for debugging and monitoring
    console.error('Error in get-unpicked-players:', error);

    // Return standardized server error response
    return res.status(200).json({
      return_code: 'SERVER_ERROR',
      message: 'An unexpected error occurred while retrieving unpicked players'
    });
  }
});

module.exports = router;
