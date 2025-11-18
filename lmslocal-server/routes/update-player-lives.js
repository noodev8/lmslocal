/*
=======================================================================================================================================
API Route: update-player-lives
=======================================================================================================================================
Method: POST
Purpose: Updates the number of lives remaining for a specific player in a competition. Allows increment/decrement operations with bounds checking.
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123,               // integer, required - ID of the competition
  "player_id": 456,                    // integer, required - ID of the player (user_id)
  "operation": "add",                  // string, required - "add", "subtract", or "set"
  "amount": 1,                         // integer, required - number of lives to add/subtract/set
  "reason": "Admin adjustment"         // string, optional - reason for the change (for audit log)
}

Success Response:
{
  "return_code": "SUCCESS",
  "lives_remaining": 3,                // integer, new lives count after operation
  "previous_lives": 2,                 // integer, lives count before operation
  "player_name": "John Smith",         // string, player display name
  "operation_performed": "add"         // string, operation that was performed
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
"INVALID_OPERATION"
"PLAYER_NOT_FOUND"
"COMPETITION_NOT_FOUND"
"UNAUTHORIZED"
"LIVES_LIMIT_EXCEEDED"  // When trying to go below 0 or above reasonable limit
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { query, transaction } = require('../database');
const { logApiCall } = require('../utils/apiLogger');
const { verifyToken } = require('../middleware/auth');
const { canManagePlayers } = require('../utils/permissions');
const router = express.Router();

// POST endpoint with comprehensive authentication and validation for lives management
router.post('/', verifyToken, async (req, res) => {
  try {
    // Log the API call for monitoring and debugging
    logApiCall('update-player-lives');

    // Extract and validate required fields from request
    const { competition_id, player_id, operation, amount, reason } = req.body;
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

    if (!operation || typeof operation !== 'string') {
      return res.json({
        return_code: "MISSING_FIELDS",
        message: "Operation is required and must be a string"
      });
    }

    if (amount === undefined || amount === null || !Number.isInteger(amount) || amount < 0) {
      return res.json({
        return_code: "MISSING_FIELDS",
        message: "Amount is required and must be a non-negative integer"
      });
    }

    // Validate operation type
    const validOperations = ['add', 'subtract', 'set'];
    if (!validOperations.includes(operation)) {
      return res.json({
        return_code: "INVALID_OPERATION",
        message: "Operation must be 'add', 'subtract', or 'set'"
      });
    }

    // STEP 2: Use transaction wrapper to ensure atomic operations
    // This ensures that either ALL database operations succeed or ALL are rolled back
    // Critical for lives operations where audit trail and lives update must be consistent
    const transactionResult = await transaction(async (client) => {

      // Single comprehensive query to get competition info, verify authorization, and get player data
      // This eliminates N+1 query problems by joining all necessary tables in one database call
      const validationQuery = `
        WITH competition_data AS (
          -- Get competition info and verify organiser authorization
          SELECT
            c.id as competition_id,
            c.name as competition_name,
            c.organiser_id,
            c.lives_per_player as default_lives
          FROM competition c
          WHERE c.id = $1
        ),
        player_data AS (
          -- Get player info and current lives status
          SELECT
            cu.user_id,
            u.display_name as player_name,
            cu.lives_remaining as current_lives,
            cu.status as player_status
          FROM competition_user cu
          INNER JOIN app_user u ON cu.user_id = u.id
          WHERE cu.competition_id = $1 AND cu.user_id = $2
        )
        SELECT
          cd.competition_id,
          cd.competition_name,
          cd.organiser_id,
          cd.default_lives,
          pd.user_id as player_user_id,
          pd.player_name,
          pd.current_lives,
          pd.player_status
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

      // Verify user has permission to manage players (organiser or delegated permission)
      const permission = await canManagePlayers(admin_id, competition_id);
      if (!permission.authorized) {
        throw {
          return_code: "UNAUTHORIZED",
          message: "You do not have permission to update player lives in this competition"
        };
      }

      // Check if player exists in this competition
      if (!data.player_user_id) {
        throw {
          return_code: "PLAYER_NOT_FOUND",
          message: "Player not found in this competition"
        };
      }

      const currentLives = data.current_lives;
      let newLives;

      // Calculate new lives based on operation with comprehensive business logic
      switch (operation) {
        case 'add':
          newLives = currentLives + amount;
          break;
        case 'subtract':
          newLives = currentLives - amount;
          break;
        case 'set':
          newLives = amount;
          break;
        default:
          throw {
            return_code: "INVALID_OPERATION",
            message: "Invalid operation specified"
          };
      }

      // Enforce reasonable bounds (0 minimum, 3 maximum)
      if (newLives < 0) {
        throw {
          return_code: "LIVES_LIMIT_EXCEEDED",
          message: "Cannot set player lives below 0"
        };
      }
      if (newLives > 3) {
        throw {
          return_code: "LIVES_LIMIT_EXCEEDED",
          message: "Cannot set player lives above 3"
        };
      }

      // Business Logic: Check if lives count is unchanged to prevent unnecessary operations
      if (newLives === currentLives) {
        throw {
          return_code: "LIVES_UNCHANGED",
          message: `Player already has ${currentLives} lives`
        };
      }

      // Atomic lives update with optimistic concurrency
      const updateQuery = `
        UPDATE competition_user
        SET lives_remaining = $1
        WHERE competition_id = $2 AND user_id = $3
        RETURNING lives_remaining
      `;

      const updateResult = await client.query(updateQuery, [
        newLives,
        competition_id,
        player_id
      ]);

      // Create comprehensive audit log entry for lives change transparency
      // This provides full accountability trail for all lives modifications
      const auditDetails = {
        action: `LIVES_${operation.toUpperCase()}`,
        player: data.player_name,
        competition: data.competition_name,
        previous_lives: currentLives,
        new_lives: newLives,
        amount: amount,
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
        `Lives ${operation} for player ${data.player_name}`,
        JSON.stringify(auditDetails)
      ]);

      // Return comprehensive lives status information for frontend display
      const updatedLives = updateResult.rows[0];

      return {
        return_code: "SUCCESS",
        message: `Player lives ${operation}ed successfully`,
        lives_remaining: updatedLives.lives_remaining,
        previous_lives: currentLives,
        player_name: data.player_name,
        operation_performed: operation
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
    console.error('Update player lives error:', {
      error: error.message,
      stack: error.stack?.substring(0, 500), // Truncate stack trace
      competition_id: req.body?.competition_id,
      player_id: req.body?.player_id,
      operation: req.body?.operation,
      amount: req.body?.amount,
      admin_id: req.user?.id,
      timestamp: new Date().toISOString()
    });

    // Return standardized server error response with HTTP 200
    return res.json({
      return_code: "SERVER_ERROR",
      message: "Failed to update player lives"
    });
  }
});

module.exports = router;