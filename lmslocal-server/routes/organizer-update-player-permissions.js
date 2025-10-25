/*
=======================================================================================================================================
API Route: organizer-update-player-permissions
=======================================================================================================================================
Method: POST
Purpose: Allow main competition organiser to grant or revoke delegated permissions for managing results, fixtures, or players
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123,                    // integer, required - Competition ID
  "player_id": 456,                         // integer, required - Player ID to update permissions for
  "manage_results": true,                   // boolean, required - Permission to enter and process results
  "manage_fixtures": false,                 // boolean, required - Permission to add and modify fixtures
  "manage_players": true                    // boolean, required - Permission to add, remove, and manage players
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Permissions updated successfully",
  "player": {
    "id": 456,                              // integer, player ID
    "display_name": "Sarah Jones",          // string, player name
    "manage_results": true,                 // boolean, updated permission
    "manage_fixtures": false,               // boolean, updated permission
    "manage_players": true                  // boolean, updated permission
  }
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"       - Missing or invalid parameters
"UNAUTHORIZED"           - User is not the main organiser (only main organiser can grant permissions)
"COMPETITION_NOT_FOUND"  - Competition doesn't exist
"PLAYER_NOT_FOUND"       - Player is not in this competition
"CANNOT_MODIFY_SELF"     - Cannot modify own permissions (organiser has all permissions implicitly)
"SERVER_ERROR"           - Database or unexpected error
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../database');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');
const { isMainOrganiser } = require('../utils/permissions');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  logApiCall('organizer-update-player-permissions');

  try {
    const { competition_id, player_id, manage_results, manage_fixtures, manage_players, manage_promote } = req.body;
    const user_id = req.user.id;

    // ========================================
    // STEP 1: VALIDATE INPUT
    // ========================================

    // Check all required fields are present
    if (!competition_id || !player_id) {
      return res.status(200).json({
        return_code: "VALIDATION_ERROR",
        message: "Missing required fields: competition_id and player_id are required"
      });
    }

    // Validate permission booleans
    if (typeof manage_results !== 'boolean' || typeof manage_fixtures !== 'boolean' || typeof manage_players !== 'boolean' || typeof manage_promote !== 'boolean') {
      return res.status(200).json({
        return_code: "VALIDATION_ERROR",
        message: "Permission fields must be boolean values (true or false)"
      });
    }

    // Parse to integers
    const competition_id_int = parseInt(competition_id);
    const player_id_int = parseInt(player_id);

    if (isNaN(competition_id_int) || isNaN(player_id_int)) {
      return res.status(200).json({
        return_code: "VALIDATION_ERROR",
        message: "competition_id and player_id must be valid numbers"
      });
    }

    // ========================================
    // STEP 2: VERIFY AUTHORIZATION
    // ========================================

    // Only main organiser can grant/revoke permissions (not delegates)
    const is_organiser = await isMainOrganiser(user_id, competition_id_int);
    if (!is_organiser) {
      return res.status(200).json({
        return_code: "UNAUTHORIZED",
        message: "Only the main competition organiser can modify permissions"
      });
    }

    // Prevent organiser from modifying their own permissions (they have all permissions implicitly)
    if (player_id_int === user_id) {
      return res.status(200).json({
        return_code: "CANNOT_MODIFY_SELF",
        message: "Cannot modify your own permissions. As the organiser, you already have all permissions."
      });
    }

    // ========================================
    // STEP 3: VERIFY PLAYER EXISTS IN COMPETITION
    // ========================================

    const playerCheck = await query(`
      SELECT
        cu.user_id,
        u.display_name,
        c.name as competition_name
      FROM competition_user cu
      JOIN app_user u ON u.id = cu.user_id
      JOIN competition c ON c.id = cu.competition_id
      WHERE cu.competition_id = $1 AND cu.user_id = $2
    `, [competition_id_int, player_id_int]);

    if (playerCheck.rows.length === 0) {
      return res.status(200).json({
        return_code: "PLAYER_NOT_FOUND",
        message: "Player is not a member of this competition"
      });
    }

    const player = playerCheck.rows[0];

    // ========================================
    // STEP 4: UPDATE PERMISSIONS
    // ========================================

    await query(`
      UPDATE competition_user
      SET
        manage_results = $1,
        manage_fixtures = $2,
        manage_players = $3,
        manage_promote = $4
      WHERE competition_id = $5 AND user_id = $6
    `, [manage_results, manage_fixtures, manage_players, manage_promote, competition_id_int, player_id_int]);

    // ========================================
    // STEP 5: AUDIT LOGGING
    // ========================================

    // Build permission summary for audit log
    const granted_permissions = [];
    if (manage_results) granted_permissions.push('manage_results');
    if (manage_fixtures) granted_permissions.push('manage_fixtures');
    if (manage_players) granted_permissions.push('manage_players');
    if (manage_promote) granted_permissions.push('manage_promote');

    const permission_summary = granted_permissions.length > 0
      ? `Granted ${player.display_name}: ${granted_permissions.join(', ')}`
      : `Revoked all permissions from ${player.display_name}`;

    await query(`
      INSERT INTO audit_log (competition_id, user_id, action, details)
      VALUES ($1, $2, 'Permissions Updated', $3)
    `, [competition_id_int, user_id, permission_summary]);

    // ========================================
    // STEP 6: RETURN SUCCESS
    // ========================================

    res.status(200).json({
      return_code: "SUCCESS",
      message: "Permissions updated successfully",
      player: {
        id: player_id_int,
        display_name: player.display_name,
        manage_results: manage_results,
        manage_fixtures: manage_fixtures,
        manage_players: manage_players,
        manage_promote: manage_promote
      }
    });

  } catch (error) {
    console.error('Update player permissions error:', error);
    res.status(200).json({
      return_code: "SERVER_ERROR",
      message: "An error occurred while updating permissions"
    });
  }
});

module.exports = router;
