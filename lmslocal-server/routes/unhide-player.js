/*
=======================================================================================================================================
API Route: unhide-player
=======================================================================================================================================
Method: POST
Purpose: Allows competition admin to unhide a competition for a specific player by setting the hidden flag to false
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123,                // integer, required - Competition ID to unhide
  "player_id": 456                      // integer, required - Player ID to unhide for
}

Success Response:
{
  "return_code": "SUCCESS",
  "message": "Competition unhidden for player successfully"  // string, confirmation message
}

Error Response:
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"                     // string, user-friendly error description
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"MISSING_FIELDS"
"INVALID_COMPETITION_ID"
"INVALID_PLAYER_ID"
"UNAUTHORIZED"
"NOT_ORGANISER"
"PLAYER_NOT_MEMBER"
"ALREADY_VISIBLE"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../database');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');
const { canManagePlayers } = require('../utils/permissions');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  // Log API call for monitoring
  logApiCall('unhide-player');

  try {
    // Extract authenticated admin user ID from JWT token
    const admin_user_id = req.user.id;

    // Extract request payload
    const { competition_id, player_id } = req.body;

    // === VALIDATION ===
    // Check if required fields are provided
    if (!competition_id || !player_id) {
      return res.status(200).json({
        return_code: "MISSING_FIELDS",
        message: "Both competition_id and player_id are required"
      });
    }

    // Validate competition_id is a valid integer
    if (!Number.isInteger(competition_id) || competition_id <= 0) {
      return res.status(200).json({
        return_code: "INVALID_COMPETITION_ID",
        message: "competition_id must be a valid positive integer"
      });
    }

    // Validate player_id is a valid integer
    if (!Number.isInteger(player_id) || player_id <= 0) {
      return res.status(200).json({
        return_code: "INVALID_PLAYER_ID",
        message: "player_id must be a valid positive integer"
      });
    }

    // === VERIFY ADMIN IS ORGANISER ===
    // Check that the authenticated user is the organiser of this competition
    const organiserCheckQuery = `
      SELECT
        id,
        name,
        organiser_id
      FROM competition
      WHERE id = $1
    `;

    const organiserResult = await query(organiserCheckQuery, [competition_id]);

    // Competition doesn't exist
    if (organiserResult.rows.length === 0) {
      return res.status(200).json({
        return_code: "INVALID_COMPETITION_ID",
        message: "Competition not found"
      });
    }

    const competition = organiserResult.rows[0];

    // Verify user has permission to manage players (organiser or delegated permission)
    const permission = await canManagePlayers(admin_user_id, competition_id);
    if (!permission.authorized) {
      return res.status(200).json({
        return_code: "UNAUTHORIZED",
        message: "You do not have permission to manage players for this competition"
      });
    }

    // === VERIFY PLAYER MEMBERSHIP AND CURRENT HIDDEN STATUS ===
    // Check if the target player is actually a member of this competition and their hidden status
    const playerMembershipQuery = `
      SELECT
        id,
        status,
        hidden,
        user_id,
        competition_id
      FROM competition_user
      WHERE competition_id = $1 AND user_id = $2
    `;

    const membershipResult = await query(playerMembershipQuery, [competition_id, player_id]);

    // Player is not a member of this competition
    if (membershipResult.rows.length === 0) {
      return res.status(200).json({
        return_code: "PLAYER_NOT_MEMBER",
        message: "The specified player is not a member of this competition"
      });
    }

    const playerMembership = membershipResult.rows[0];

    // Check if competition is already visible for this player (not hidden)
    if (playerMembership.hidden !== true) {
      return res.status(200).json({
        return_code: "ALREADY_VISIBLE",
        message: "Competition is already visible for this player"
      });
    }

    // === UPDATE HIDDEN FLAG TO MAKE COMPETITION VISIBLE ===
    // Set hidden flag to false (or null) for this player in this competition
    const unhideQuery = `
      UPDATE competition_user
      SET hidden = false
      WHERE competition_id = $1 AND user_id = $2
      RETURNING id, hidden
    `;

    const unhideResult = await query(unhideQuery, [competition_id, player_id]);

    // Verify update was successful
    if (unhideResult.rows.length === 0) {
      return res.status(200).json({
        return_code: "SERVER_ERROR",
        message: "Failed to unhide competition - update returned no rows"
      });
    }

    // === SUCCESS RESPONSE ===
    return res.status(200).json({
      return_code: "SUCCESS",
      message: "Competition unhidden for player successfully"
    });

  } catch (error) {
    // Log error for debugging
    console.error('Unhide player error:', error);

    // Return generic server error
    return res.status(200).json({
      return_code: "SERVER_ERROR",
      message: "Internal server error occurred while unhiding competition for player"
    });
  }
});

module.exports = router;