/*
=======================================================================================================================================
Update Payment Status Route
=======================================================================================================================================
Method: POST
Purpose: Allow admin to update payment status for players in their competition
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123,
  "user_id": 456,
  "paid": true,
  "paid_amount": 25.00,    // optional
  "paid_date": "2025-01-15T10:30:00Z"  // optional, defaults to now if paid=true
}

Success Response:
{
  "return_code": "SUCCESS",
  "message": "Payment status updated successfully",
  "payment_status": {
    "user_id": 456,
    "player_name": "Kate Smith",
    "paid": true,
    "paid_amount": 25.00,
    "paid_date": "2025-01-15T10:30:00Z"
  }
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR" 
"UNAUTHORIZED"
"COMPETITION_NOT_FOUND"
"PLAYER_NOT_FOUND"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const jwt = require('jsonwebtoken');
const { query } = require('../database');
const router = express.Router();

// Middleware to verify JWT token
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(200).json({
        return_code: "UNAUTHORIZED",
        message: "No token provided"
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const result = await query('SELECT id, email, display_name, email_verified FROM app_user WHERE id = $1', [decoded.user_id || decoded.userId]);
    if (result.rows.length === 0) {
      return res.status(200).json({
        return_code: "UNAUTHORIZED",
        message: "Invalid token"
      });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    return res.status(200).json({
      return_code: "UNAUTHORIZED", 
      message: "Invalid token"
    });
  }
};

router.post('/', verifyToken, async (req, res) => {
  try {
    const { competition_id, user_id, paid, paid_amount, paid_date } = req.body;
    const admin_id = req.user.id;

    // Basic validation
    if (!competition_id || !Number.isInteger(competition_id)) {
      return res.status(200).json({
        return_code: "VALIDATION_ERROR",
        message: "Competition ID is required and must be a number"
      });
    }

    if (!user_id || !Number.isInteger(user_id)) {
      return res.status(200).json({
        return_code: "VALIDATION_ERROR",
        message: "User ID is required and must be a number"
      });
    }

    if (typeof paid !== 'boolean') {
      return res.status(200).json({
        return_code: "VALIDATION_ERROR",
        message: "Paid status is required and must be boolean"
      });
    }

    // Verify admin is organiser of this competition
    const competitionResult = await query(`
      SELECT c.id, c.name, c.organiser_id
      FROM competition c
      WHERE c.id = $1
    `, [competition_id]);

    if (competitionResult.rows.length === 0) {
      return res.status(200).json({
        return_code: "COMPETITION_NOT_FOUND",
        message: "Competition not found"
      });
    }

    const competition = competitionResult.rows[0];

    if (competition.organiser_id !== admin_id) {
      return res.status(200).json({
        return_code: "UNAUTHORIZED",
        message: "Only the competition organiser can update payment status"
      });
    }

    // Verify player is in this competition
    const playerResult = await query(`
      SELECT cu.id, cu.user_id, u.display_name, cu.paid, cu.paid_amount, cu.paid_date
      FROM competition_user cu
      JOIN app_user u ON cu.user_id = u.id
      WHERE cu.competition_id = $1 AND cu.user_id = $2
    `, [competition_id, user_id]);

    if (playerResult.rows.length === 0) {
      return res.status(200).json({
        return_code: "PLAYER_NOT_FOUND",
        message: "Player not found in this competition"
      });
    }

    const player = playerResult.rows[0];

    // Prepare update values
    const finalPaidDate = paid 
      ? (paid_date || new Date().toISOString()) 
      : null;

    // Update payment status
    const updateResult = await query(`
      UPDATE competition_user 
      SET paid = $1, 
          paid_amount = $2, 
          paid_date = $3
      WHERE competition_id = $4 AND user_id = $5
      RETURNING paid, paid_amount, paid_date
    `, [paid, paid_amount || null, finalPaidDate, competition_id, user_id]);

    // Log the action
    const actionDetails = paid 
      ? `Marked payment as PAID for "${player.display_name}"${paid_amount ? ` (£${paid_amount})` : ''} by Admin ${admin_id}`
      : `Marked payment as UNPAID for "${player.display_name}" by Admin ${admin_id}`;

    await query(`
      INSERT INTO audit_log (competition_id, user_id, action, details)
      VALUES ($1, $2, 'Payment Status Update', $3)
    `, [competition_id, user_id, actionDetails]);

    const updatedPayment = updateResult.rows[0];

    res.status(200).json({
      return_code: "SUCCESS",
      message: "Payment status updated successfully",
      payment_status: {
        user_id: user_id,
        player_name: player.display_name,
        paid: updatedPayment.paid,
        paid_amount: updatedPayment.paid_amount,
        paid_date: updatedPayment.paid_date
      }
    });

  } catch (error) {
    console.error('Update payment status error:', error);
    res.status(200).json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;