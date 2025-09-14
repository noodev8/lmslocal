/*
=======================================================================================================================================
API Route: update-player-status
=======================================================================================================================================
Method: POST
Purpose: Updates a player's competition status between 'active' and 'eliminated' for admin management.
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123,               // integer, required - ID of the competition
  "player_id": 456,                    // integer, required - ID of the player (user_id)
  "status": "active",                  // string, required - "active" or "eliminated"
  "reason": "Admin override"           // string, optional - reason for the change (for audit log)
}

Success Response:
{
  "return_code": "SUCCESS",
  "player_name": "John Smith",         // string, player display name
  "old_status": "eliminated",          // string, previous status
  "new_status": "active",              // string, new status
  "message": "Player status updated successfully"
}

Error Response:
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"MISSING_FIELDS"
"INVALID_STATUS"
"PLAYER_NOT_FOUND"
"COMPETITION_NOT_FOUND"
"UNAUTHORIZED"
"STATUS_UNCHANGED"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { query, transaction } = require('../database');
const { logApiCall } = require('../utils/apiLogger');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

// POST endpoint with comprehensive authentication and validation for status management
router.post('/', verifyToken, async (req, res) => {
  try {
    // Log the API call for monitoring and debugging
    logApiCall('update-player-status');

    // Extract and validate required fields from request
    const { competition_id, player_id, status, reason } = req.body;
    const admin_id = req.user.id; // Set by verifyToken middleware
    const admin_email = req.user.email; // For audit trail

    // STEP 1: Validate required input parameters with strict type checking
    if (!competition_id || !Number.isInteger(competition_id)) {
      return res.json({
        return_code: "MISSING_FIELDS",
        message: "Competition ID is required and must be an integer"
      });
    }

    if (!player_id || !Number.isInteger(player_id)) {
      return res.json({
        return_code: "MISSING_FIELDS",
        message: "Player ID is required and must be an integer"
      });
    }

    if (!status || typeof status !== 'string') {
      return res.json({
        return_code: "MISSING_FIELDS",
        message: "Status is required and must be a string"
      });
    }

    // Validate status value - only accept 'active' or 'out'
    const validStatuses = ['active', 'out'];
    if (!validStatuses.includes(status)) {
      return res.json({
        return_code: "INVALID_STATUS",
        message: "Status must be 'active' or 'out'"
      });
    }

    // STEP 2: Use transaction wrapper to ensure atomic operations
    // This ensures that either ALL database operations succeed or ALL are rolled back
    const transactionResult = await transaction(async (client) => {

      // Single comprehensive query to get competition info, verify authorization, and get player data
      // This eliminates N+1 query problems by joining all necessary tables in one database call
      const validationQuery = `
        WITH competition_data AS (
          -- Get competition info and verify organiser authorization
          SELECT
            c.id as competition_id,
            c.name as competition_name,
            c.organiser_id
          FROM competition c
          WHERE c.id = $1
        ),
        player_data AS (
          -- Get player info and current status
          SELECT
            cu.user_id,
            u.display_name as player_name,
            cu.status as current_status
          FROM competition_user cu
          INNER JOIN app_user u ON cu.user_id = u.id
          WHERE cu.competition_id = $1 AND cu.user_id = $2
        )
        SELECT
          cd.competition_id,
          cd.competition_name,
          cd.organiser_id,
          pd.user_id as player_user_id,
          pd.player_name,
          pd.current_status
        FROM competition_data cd
        LEFT JOIN player_data pd ON true
      `;

      const validationResult = await client.query(validationQuery, [competition_id, player_id]);

      // Check if competition exists
      if (validationResult.rows.length === 0) {
        throw {
          return_code: "COMPETITION_NOT_FOUND",
          message: "Competition not found or does not exist"
        };
      }

      const data = validationResult.rows[0];

      // Verify user authorization - only competition organiser can update player status
      if (data.organiser_id !== admin_id) {
        throw {
          return_code: "UNAUTHORIZED",
          message: "Only the competition organiser can update player status"
        };
      }

      // Check if player exists in this competition
      if (!data.player_user_id) {
        throw {
          return_code: "PLAYER_NOT_FOUND",
          message: "Player not found in this competition"
        };
      }

      const currentStatus = data.current_status;

      // Business Logic: Check if status is actually changing to prevent unnecessary operations
      if (currentStatus === status) {
        throw {
          return_code: "STATUS_UNCHANGED",
          message: `Player is already ${status}`
        };
      }

      // Atomic status update with timestamp
      const updateQuery = `
        UPDATE competition_user
        SET status = $1
        WHERE competition_id = $2 AND user_id = $3
        RETURNING status
      `;

      const updateResult = await client.query(updateQuery, [
        status,
        competition_id,
        player_id
      ]);

      // Create comprehensive audit log entry for status change transparency
      // This provides full accountability trail for all status modifications
      const auditDetails = {
        action: `STATUS_UPDATE`,
        player: data.player_name,
        competition: data.competition_name,
        previous_status: currentStatus,
        new_status: status,
        reason: reason || 'No reason provided',
        admin_id: admin_id,
        admin_email: admin_email
      };

      const auditQuery = `
        INSERT INTO audit_log (competition_id, user_id, action, details, created_at)
        VALUES ($1, $2, $3, $4, NOW())
      `;

      await client.query(auditQuery, [
        competition_id,
        admin_id, // Admin who performed the action
        `Status changed for player ${data.player_name}: ${currentStatus} → ${status}`,
        JSON.stringify(auditDetails)
      ]);

      // Return comprehensive status update information for frontend display
      return {
        return_code: "SUCCESS",
        message: "Player status updated successfully",
        player_name: data.player_name,
        old_status: currentStatus,
        new_status: status
      };
    });

    // Return transaction result with HTTP 200 status as per API standards
    return res.json(transactionResult);

  } catch (error) {
    // Handle custom business logic errors (thrown from transaction)
    if (error.return_code) {
      return res.json({
        return_code: error.return_code,
        message: error.message
      });
    }

    // Log detailed error information for debugging while protecting sensitive data
    console.error('Update player status error:', {
      error: error.message,
      stack: error.stack?.substring(0, 500), // Truncate stack trace
      competition_id: req.body?.competition_id,
      player_id: req.body?.player_id,
      status: req.body?.status,
      admin_id: req.user?.id,
      timestamp: new Date().toISOString()
    });

    // Return standardized server error response with HTTP 200
    return res.json({
      return_code: "SERVER_ERROR",
      message: "Failed to update player status"
    });
  }
});

module.exports = router;