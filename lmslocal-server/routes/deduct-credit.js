/*
=======================================================================================================================================
API Route: deduct-credit
=======================================================================================================================================
Method: POST
Purpose: Deduct 1 credit from organizer when player joins competition (if beyond 20 free players)
=======================================================================================================================================
Request Payload:
{
  "organiser_id": 123,              // integer, required - competition organizer's user ID
  "competition_id": 456,            // integer, required - competition being joined
  "player_id": 789                  // integer, required - player joining the competition
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "credit_deducted": true,          // boolean, whether credit was deducted
  "new_balance": 46,                // integer, organizer's new paid_credit balance
  "total_players": 67,              // integer, organizer's total player count after this join
  "message": "Credit deducted successfully"
}

OR (if within free tier):
{
  "return_code": "SUCCESS",
  "credit_deducted": false,         // boolean, no credit deducted (within free 20)
  "new_balance": 47,                // integer, organizer's paid_credit (unchanged)
  "total_players": 19,              // integer, organizer's total player count after this join
  "message": "Player added within free tier"
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "INSUFFICIENT_CREDITS",
  "message": "Organizer has no credits remaining. Please purchase more credits.",
  "total_players": 67,              // integer, current player count
  "credits_available": 0            // integer, organizer's paid_credit balance
}
=======================================================================================================================================
Return Codes:
"SUCCESS"                 - Credit deducted successfully (or player within free tier)
"VALIDATION_ERROR"        - Missing or invalid parameters
"INSUFFICIENT_CREDITS"    - Organizer needs to buy more credits
"ORGANISER_NOT_FOUND"     - Organizer user not found
"SERVER_ERROR"            - Unexpected server error
=======================================================================================================================================
Business Logic:
1. Count organizer's CURRENT total players (before adding this new player)
2. If count < 20: Allow join, no credit deduction (free tier)
3. If count >= 20: Check paid_credit >= 1, deduct 1 credit, log transaction
4. Count includes ALL players in ALL competitions (any status)
5. Each player in each competition counts separately (e.g., 15 in Comp A + 10 in Comp B = 25 total)
=======================================================================================================================================
*/

const express = require('express');
const { query, transaction } = require('../database');
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    // Extract and validate request parameters
    const { organiser_id, competition_id, player_id } = req.body;

    // === STEP 1: VALIDATE INPUT PARAMETERS ===
    if (!organiser_id || !Number.isInteger(organiser_id)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "organiser_id is required and must be an integer"
      });
    }

    if (!competition_id || !Number.isInteger(competition_id)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "competition_id is required and must be an integer"
      });
    }

    if (!player_id || !Number.isInteger(player_id)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "player_id is required and must be an integer"
      });
    }

    // === STEP 2: COUNT ORGANIZER'S CURRENT PLAYERS (BEFORE THIS NEW PLAYER) ===
    // This count includes ALL players in ALL competitions owned by this organizer
    // Any status, any competition - total count determines if we're in free tier or paid tier
    const playerCountQuery = `
      SELECT COUNT(cu.id) as current_player_count
      FROM competition c
      LEFT JOIN competition_user cu ON cu.competition_id = c.id
      WHERE c.organiser_id = $1
    `;

    const countResult = await query(playerCountQuery, [organiser_id]);
    const currentPlayerCount = parseInt(countResult.rows[0].current_player_count) || 0;

    // After adding this player, total will be currentPlayerCount + 1
    const totalPlayersAfterJoin = currentPlayerCount + 1;

    // === STEP 3: DETERMINE IF CREDIT DEDUCTION IS NEEDED ===
    // Free tier limit from environment variable (defaults to 20 if not set)
    const FREE_PLAYER_LIMIT = parseInt(process.env.FREE_PLAYER_LIMIT) || 20;

    if (currentPlayerCount < FREE_PLAYER_LIMIT) {
      // Still within free tier - no credit deduction needed
      // Get current balance (for response only, not modified)
      const balanceQuery = `SELECT paid_credit FROM app_user WHERE id = $1`;
      const balanceResult = await query(balanceQuery, [organiser_id]);

      if (balanceResult.rows.length === 0) {
        return res.json({
          return_code: "ORGANISER_NOT_FOUND",
          message: "Organizer user not found"
        });
      }

      const currentBalance = balanceResult.rows[0].paid_credit;

      return res.json({
        return_code: "SUCCESS",
        credit_deducted: false,
        new_balance: currentBalance,
        total_players: totalPlayersAfterJoin,
        message: "Player added within free tier (no credit deducted)"
      });
    }

    // === STEP 4: PLAYER IS BEYOND FREE TIER - DEDUCT 1 CREDIT ===
    // Use transaction to ensure atomic credit deduction + transaction logging
    const result = await transaction(async (client) => {

      // Check current balance and deduct 1 credit atomically
      // This query will fail if paid_credit < 1 (prevents going negative)
      const deductQuery = `
        UPDATE app_user
        SET paid_credit = paid_credit - 1
        WHERE id = $1 AND paid_credit >= 1
        RETURNING paid_credit as new_balance
      `;

      const deductResult = await client.query(deductQuery, [organiser_id]);

      // If no rows updated, organizer has insufficient credits
      if (deductResult.rows.length === 0) {
        // Get current balance to include in error response
        const checkBalanceQuery = `SELECT paid_credit FROM app_user WHERE id = $1`;
        const checkResult = await client.query(checkBalanceQuery, [organiser_id]);

        const currentBalance = checkResult.rows.length > 0
          ? checkResult.rows[0].paid_credit
          : 0;

        throw {
          return_code: "INSUFFICIENT_CREDITS",
          message: "Organizer has no credits remaining. Please purchase more credits.",
          total_players: totalPlayersAfterJoin,
          credits_available: currentBalance
        };
      }

      const newBalance = deductResult.rows[0].new_balance;

      // Log the credit deduction to credit_transactions table for audit trail
      const logQuery = `
        INSERT INTO credit_transactions (
          user_id,
          transaction_type,
          amount,
          competition_id,
          description,
          created_at
        )
        VALUES ($1, 'deduction', -1, $2, $3, CURRENT_TIMESTAMP)
      `;

      const description = `Credit deducted for player ${player_id} joining competition ${competition_id}. Total players: ${totalPlayersAfterJoin}`;

      await client.query(logQuery, [organiser_id, competition_id, description]);

      return {
        return_code: "SUCCESS",
        credit_deducted: true,
        new_balance: newBalance,
        total_players: totalPlayersAfterJoin,
        message: "Credit deducted successfully"
      };
    });

    return res.json(result);

  } catch (error) {
    // Handle custom business logic errors (thrown from transaction)
    if (error.return_code) {
      return res.json({
        return_code: error.return_code,
        message: error.message,
        total_players: error.total_players,
        credits_available: error.credits_available
      });
    }

    // Log detailed error for debugging
    console.error('Deduct credit error:', {
      error: error.message,
      stack: error.stack?.substring(0, 500),
      organiser_id: req.body?.organiser_id,
      competition_id: req.body?.competition_id,
      player_id: req.body?.player_id,
      timestamp: new Date().toISOString()
    });

    // Return generic error to client
    return res.json({
      return_code: "SERVER_ERROR",
      message: "Failed to process credit deduction"
    });
  }
});

module.exports = router;
