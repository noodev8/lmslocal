/*
=======================================================================================================================================
Delete Account Route - Complete user data deletion for GDPR/App Store compliance
=======================================================================================================================================
Method: POST
Purpose: Delete all user data from ALL tables (irreversible data deletion)
=======================================================================================================================================
Request Payload:
{
  "confirmation": "DELETE_MY_ACCOUNT"     // string, required for safety
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Account and all associated data deleted successfully"
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE", 
  "message": "User-friendly error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"UNAUTHORIZED"
"MANAGED_PLAYER_ERROR"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../database');
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
    
    const userId = decoded.user_id || decoded.userId;
    const result = await db.query('SELECT id, email, display_name, is_managed, created_by_user_id FROM app_user WHERE id = $1', [userId]);
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
    const { confirmation } = req.body;
    const user = req.user;

    // Validate confirmation text
    if (confirmation !== 'DELETE_MY_ACCOUNT') {
      return res.status(200).json({
        return_code: "VALIDATION_ERROR",
        message: "Please type 'DELETE_MY_ACCOUNT' exactly to confirm deletion"
      });
    }

    // Prevent deletion of managed players (only their organiser should delete them)
    if (user.is_managed) {
      return res.status(200).json({
        return_code: "MANAGED_PLAYER_ERROR",
        message: "Managed player accounts can only be deleted by the competition organiser"
      });
    }

    // Use transaction to ensure complete deletion or rollback
    const client = await db.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Log the deletion before removing data
      await client.query(`
        INSERT INTO audit_log (user_id, action, details)
        VALUES ($1, 'Account Deletion', $2)
      `, [user.id, `User "${user.display_name}" (${user.email}) requested complete account deletion`]);

      // Delete in correct order to handle foreign key constraints
      // 1. User's picks
      await client.query('DELETE FROM pick WHERE user_id = $1', [user.id]);
      
      // 2. User's allowed teams
      await client.query('DELETE FROM allowed_teams WHERE user_id = $1', [user.id]);
      
      // 3. User's competition memberships
      await client.query('DELETE FROM competition_user WHERE user_id = $1', [user.id]);
      
      // 4. User's player progress
      await client.query('DELETE FROM player_progress WHERE player_id = $1', [user.id]);
      
      // 5. User activities
      await client.query('DELETE FROM user_activity WHERE user_id = $1', [user.id]);
      
      // 6. Invitations sent to this user
      await client.query('DELETE FROM invitation WHERE email = $1', [user.email]);
      
      // 7. Any competitions they organized (this will cascade delete related data)
      const organizedCompetitions = await client.query('SELECT id FROM competition WHERE organiser_id = $1', [user.id]);
      
      if (organizedCompetitions.rows.length > 0) {
        // For each competition they organized, we need to delete all related data
        for (const comp of organizedCompetitions.rows) {
          const competitionId = comp.id;
          
          // Delete fixtures and their picks
          await client.query('DELETE FROM pick WHERE round_id IN (SELECT id FROM round WHERE competition_id = $1)', [competitionId]);
          await client.query('DELETE FROM fixture WHERE round_id IN (SELECT id FROM round WHERE competition_id = $1)', [competitionId]);
          
          // Delete rounds
          await client.query('DELETE FROM round WHERE competition_id = $1', [competitionId]);
          
          // Delete competition users
          await client.query('DELETE FROM competition_user WHERE competition_id = $1', [competitionId]);
          
          // Delete allowed teams
          await client.query('DELETE FROM allowed_teams WHERE competition_id = $1', [competitionId]);
          
          // Delete player progress
          await client.query('DELETE FROM player_progress WHERE competition_id = $1', [competitionId]);
          
          // Delete user activities for this competition
          await client.query('DELETE FROM user_activity WHERE competition_id = $1', [competitionId]);
          
          // Delete audit logs for this competition
          await client.query('DELETE FROM audit_log WHERE competition_id = $1', [competitionId]);
          
          // Delete invitations for this competition
          await client.query('DELETE FROM invitation WHERE competition_id = $1', [competitionId]);
        }
        
        // Finally delete the competitions
        await client.query('DELETE FROM competition WHERE organiser_id = $1', [user.id]);
      }
      
      // 8. Delete audit logs for this user (except the deletion log we just created)
      await client.query('DELETE FROM audit_log WHERE user_id = $1 AND action != $2', [user.id, 'Account Deletion']);
      
      // 9. Finally, delete the user record
      await client.query('DELETE FROM app_user WHERE id = $1', [user.id]);

      await client.query('COMMIT');
      
      res.status(200).json({
        return_code: "SUCCESS",
        message: "Account and all associated data deleted successfully"
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Delete account error:', error);
    res.status(200).json({
      return_code: "SERVER_ERROR",
      message: "Internal server error during account deletion"
    });
  }
});

module.exports = router;