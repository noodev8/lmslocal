/*
=======================================================================================================================================
API Route: update-payment-status
=======================================================================================================================================
Method: POST
Purpose: Updates the payment status for a specific player in a competition. Allows organizers to mark players as paid/unpaid with timestamp tracking.
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123,               // integer, required - ID of the competition
  "user_id": 456,                      // integer, required - ID of the player (user_id)
  "paid": true,                        // boolean, required - payment status (true = paid, false = unpaid)
  "paid_date": "2025-01-15T10:30:00Z"  // string, optional - ISO timestamp when payment was made
}

Success Response:
{
  "return_code": "SUCCESS",
  "message": "Payment status updated successfully",
  "payment_status": {
    "user_id": 456,                    // integer, player user ID
    "player_name": "John Smith",       // string, player display name
    "paid": true,                      // boolean, updated payment status
    "paid_date": "2025-01-15T10:30:00Z" // string, payment timestamp (null if unpaid)
  }
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
"INVALID_PAID_STATUS"
"PLAYER_NOT_FOUND"
"COMPETITION_NOT_FOUND"
"UNAUTHORIZED"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { query, transaction } = require('../database');
const { logApiCall } = require('../utils/apiLogger');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

// POST endpoint to update player payment status with authentication and validation
router.post('/', verifyToken, async (req, res) => {
  try {
    // Log the API call for monitoring and debugging
    logApiCall('update-payment-status');

    // Extract and validate required fields from request
    const { competition_id, user_id, paid, paid_date } = req.body;
    const admin_id = req.user.id; // Set by verifyToken middleware
    const admin_email = req.user.email; // For audit trail

    // STEP 1: Validate required input parameters with strict type checking
    if (!competition_id || !Number.isInteger(competition_id)) {
      return res.json({
        return_code: "MISSING_FIELDS",
        message: "Competition ID is required and must be an integer"
      });
    }

    if (!user_id || !Number.isInteger(user_id)) {
      return res.json({
        return_code: "MISSING_FIELDS",
        message: "User ID is required and must be an integer"
      });
    }

    // Validate paid status - must be explicitly true or false
    if (typeof paid !== 'boolean') {
      return res.json({
        return_code: "INVALID_PAID_STATUS",
        message: "Paid status is required and must be a boolean (true or false)"
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
        admin_permissions AS (
          -- Get admin's permissions in this competition
          SELECT
            cu.manage_players
          FROM competition_user cu
          WHERE cu.competition_id = $1 AND cu.user_id = $3
        ),
        player_data AS (
          -- Get player info and current payment status
          SELECT
            cu.user_id,
            u.display_name as player_name,
            cu.paid as current_paid,
            cu.paid_date as current_paid_date
          FROM competition_user cu
          INNER JOIN app_user u ON cu.user_id = u.id
          WHERE cu.competition_id = $1 AND cu.user_id = $2
        )
        SELECT
          cd.competition_id,
          cd.competition_name,
          cd.organiser_id,
          ap.manage_players,
          pd.user_id as player_user_id,
          pd.player_name,
          pd.current_paid,
          pd.current_paid_date
        FROM competition_data cd
        LEFT JOIN admin_permissions ap ON true
        LEFT JOIN player_data pd ON true
      `;

      const validationResult = await client.query(validationQuery, [competition_id, user_id, admin_id]);

      // Check if competition exists
      if (validationResult.rows.length === 0) {
        throw {
          return_code: "COMPETITION_NOT_FOUND",
          message: "Competition not found or does not exist"
        };
      }

      const data = validationResult.rows[0];

      // Verify user authorization - competition organiser OR users with 'manage_players' permission can update payment status
      const isOrganiser = data.organiser_id === admin_id;
      const hasPlayersPermission = data.manage_players === true;

      if (!isOrganiser && !hasPlayersPermission) {
        throw {
          return_code: "UNAUTHORIZED",
          message: "You must be the competition organiser or have 'Players' permission to update player payment status"
        };
      }

      // Check if player exists in this competition
      if (!data.player_user_id) {
        throw {
          return_code: "PLAYER_NOT_FOUND",
          message: "Player not found in this competition"
        };
      }

      // Determine the paid_date value based on business logic:
      // - If marking as paid and no date provided, use current timestamp
      // - If marking as paid and date provided, use that date
      // - If marking as unpaid, set to null
      let finalPaidDate;
      if (paid) {
        finalPaidDate = paid_date || new Date().toISOString();
      } else {
        finalPaidDate = null;
      }

      // Update payment status in database
      const updateQuery = `
        UPDATE competition_user
        SET
          paid = $1,
          paid_date = $2
        WHERE competition_id = $3 AND user_id = $4
        RETURNING paid, paid_date
      `;

      const updateResult = await client.query(updateQuery, [
        paid,
        finalPaidDate,
        competition_id,
        user_id
      ]);

      // Create comprehensive audit log entry for payment status change
      // This provides full accountability trail for all payment modifications
      const auditDetails = {
        action: 'PAYMENT_STATUS_UPDATE',
        player: data.player_name,
        competition: data.competition_name,
        previous_paid: data.current_paid,
        new_paid: paid,
        previous_paid_date: data.current_paid_date,
        new_paid_date: finalPaidDate,
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
        `Payment status ${paid ? 'marked as paid' : 'marked as unpaid'} for player ${data.player_name}`,
        JSON.stringify(auditDetails)
      ]);

      // Return comprehensive payment status information for frontend display
      const updatedStatus = updateResult.rows[0];

      return {
        return_code: "SUCCESS",
        message: "Payment status updated successfully",
        payment_status: {
          user_id: user_id,
          player_name: data.player_name,
          paid: updatedStatus.paid,
          paid_date: updatedStatus.paid_date
        }
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
    console.error('Update payment status error:', {
      error: error.message,
      stack: error.stack?.substring(0, 500), // Truncate stack trace
      competition_id: req.body?.competition_id,
      user_id: req.body?.user_id,
      paid: req.body?.paid,
      admin_id: req.user?.id,
      timestamp: new Date().toISOString()
    });

    // Return standardized server error response with HTTP 200
    return res.json({
      return_code: "SERVER_ERROR",
      message: "Failed to update payment status"
    });
  }
});

module.exports = router;
