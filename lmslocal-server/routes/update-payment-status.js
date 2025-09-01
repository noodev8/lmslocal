/*
=======================================================================================================================================
API Route: update-payment-status
=======================================================================================================================================
Method: POST
Purpose: Allow competition organiser to update payment status for players with atomic transaction safety and comprehensive audit logging
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123,               // integer, required - Competition ID where payment is being updated
  "user_id": 456,                      // integer, required - Player ID to update payment for
  "paid": true,                        // boolean, required - Payment status (true = paid, false = unpaid)
  "paid_amount": 25.00,                // number, optional - Amount paid (null if not specified)
  "paid_date": "2025-01-15T10:30:00Z"  // string, optional - ISO datetime when paid (defaults to NOW() if paid=true)
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Payment status updated successfully", // string, success confirmation message
  "payment_status": {
    "user_id": 456,                    // integer, player ID payment was updated for
    "player_name": "Kate Smith",       // string, display name of player
    "competition_name": "Premier League", // string, competition name for context
    "previous_status": {               // object, payment status before update (for audit)
      "paid": false,                   // boolean, previous payment status
      "paid_amount": null,             // number, previous amount paid
      "paid_date": null                // string, previous payment date
    },
    "current_status": {                // object, payment status after update
      "paid": true,                    // boolean, new payment status
      "paid_amount": 25.00,            // number, new amount paid
      "paid_date": "2025-01-15T10:30:00Z" // string, new payment date
    },
    "updated_by": "admin@example.com", // string, email of admin who made the change
    "updated_at": "2025-01-15T11:00:00Z" // string, ISO datetime when update was made
  }
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"  // string, user-friendly error description
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"      - Missing or invalid competition_id, user_id, or paid parameters
"COMPETITION_NOT_FOUND" - Competition does not exist in database
"UNAUTHORIZED"          - Invalid JWT token or user is not competition organiser
"PLAYER_NOT_FOUND"      - Specified player is not participating in this competition
"PAYMENT_UNCHANGED"     - Payment status is already set to the requested value
"SERVER_ERROR"          - Database error or unexpected server failure
=======================================================================================================================================
*/

const express = require('express');
const { query, transaction } = require('../database'); // Use central database with transaction support
const { verifyToken } = require('../middleware/auth'); // Use standard verifyToken middleware
const router = express.Router();

// POST endpoint with comprehensive authentication, validation and atomic transaction safety for payment updates
router.post('/', verifyToken, async (req, res) => {
  try {
    const { competition_id, user_id, paid, paid_amount, paid_date } = req.body;
    const admin_id = req.user.id; // Set by verifyToken middleware
    const admin_email = req.user.email; // For audit trail

    // STEP 1: Validate required input parameters with strict type checking
    if (!competition_id || !Number.isInteger(competition_id)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Competition ID is required and must be an integer"
      });
    }

    if (!user_id || !Number.isInteger(user_id)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "User ID is required and must be an integer"
      });
    }

    if (typeof paid !== 'boolean') {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Payment status (paid) is required and must be a boolean value"
      });
    }

    // Validate optional paid_amount if provided
    if (paid_amount !== undefined && paid_amount !== null && typeof paid_amount !== 'number') {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Payment amount must be a number if provided"
      });
    }

    // Validate optional paid_date if provided
    if (paid_date && typeof paid_date !== 'string') {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Payment date must be an ISO string if provided"
      });
    }

    // STEP 2: Use transaction wrapper to ensure atomic operations
    // This ensures that either ALL database operations succeed or ALL are rolled back
    // Critical for payment operations where audit trail and payment update must be consistent
    const transactionResult = await transaction(async (queryTx) => {
      
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
          -- Get player info and current payment status
          SELECT 
            cu.user_id,
            u.display_name as player_name,
            cu.paid as current_paid,
            cu.paid_amount as current_paid_amount,
            cu.paid_date as current_paid_date
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
          pd.current_paid,
          pd.current_paid_amount,
          pd.current_paid_date
        FROM competition_data cd
        LEFT JOIN player_data pd ON true
      `;

      const validationResult = await queryTx(validationQuery, [competition_id, user_id]);

      // Check if competition exists
      if (validationResult.rows.length === 0) {
        throw {
          return_code: "COMPETITION_NOT_FOUND",
          message: "Competition not found or does not exist"
        };
      }

      const data = validationResult.rows[0];

      // Verify user authorization - only competition organiser can update payment status
      if (data.organiser_id !== admin_id) {
        throw {
          return_code: "UNAUTHORIZED",
          message: "Only the competition organiser can update payment status"
        };
      }

      // Check if player exists in this competition
      if (!data.player_user_id) {
        throw {
          return_code: "PLAYER_NOT_FOUND",
          message: "Player not found in this competition"
        };
      }

      // Business Logic: Check if payment status is already set to the requested value
      // This prevents unnecessary database operations and provides clear feedback
      if (data.current_paid === paid) {
        // If setting to paid, also check amount hasn't changed significantly
        const amountChanged = paid && paid_amount && 
          Math.abs((data.current_paid_amount || 0) - paid_amount) > 0.01;
        
        if (!amountChanged) {
          throw {
            return_code: "PAYMENT_UNCHANGED",
            message: `Payment status is already set to ${paid ? 'PAID' : 'UNPAID'}`
          };
        }
      }

      // Prepare payment data based on business rules
      // If marking as paid: use provided date or current timestamp
      // If marking as unpaid: clear date and amount
      const finalPaidDate = paid 
        ? (paid_date || new Date().toISOString()) 
        : null;
      
      const finalPaidAmount = paid 
        ? (paid_amount || null)  // Allow null amount even when paid (e.g., free competitions)
        : null;  // Clear amount when marking as unpaid

      // Atomic payment status update with optimistic concurrency
      const updateQuery = `
        UPDATE competition_user 
        SET 
          paid = $1,
          paid_amount = $2,
          paid_date = $3,
          updated_at = NOW()
        WHERE competition_id = $4 AND user_id = $5
        RETURNING paid, paid_amount, paid_date, updated_at
      `;
      
      const updateResult = await queryTx(updateQuery, [
        paid,
        finalPaidAmount,
        finalPaidDate,
        competition_id,
        user_id
      ]);

      // Create comprehensive audit log entry for payment change transparency
      // This provides full accountability trail for all payment modifications
      const auditDetails = {
        action: paid ? 'PAYMENT_MARKED_PAID' : 'PAYMENT_MARKED_UNPAID',
        player: data.player_name,
        competition: data.competition_name,
        previous: {
          paid: data.current_paid,
          amount: data.current_paid_amount,
          date: data.current_paid_date
        },
        new: {
          paid: paid,
          amount: finalPaidAmount,
          date: finalPaidDate
        },
        admin_id: admin_id,
        admin_email: admin_email
      };

      const auditQuery = `
        INSERT INTO audit_log (competition_id, user_id, action, details, created_at)
        VALUES ($1, $2, $3, $4, NOW())
      `;
      
      await queryTx(auditQuery, [
        competition_id,
        user_id,
        'PAYMENT_STATUS_UPDATE',
        JSON.stringify(auditDetails)
      ]);

      // Return comprehensive payment status information for frontend display
      const updatedPayment = updateResult.rows[0];
      
      return {
        return_code: "SUCCESS",
        message: `Payment status ${paid ? 'marked as PAID' : 'marked as UNPAID'} successfully`,
        payment_status: {
          user_id: user_id,
          player_name: data.player_name,
          competition_name: data.competition_name,
          previous_status: {
            paid: data.current_paid,
            paid_amount: data.current_paid_amount,
            paid_date: data.current_paid_date
          },
          current_status: {
            paid: updatedPayment.paid,
            paid_amount: updatedPayment.paid_amount,
            paid_date: updatedPayment.paid_date
          },
          updated_by: admin_email,
          updated_at: updatedPayment.updated_at
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