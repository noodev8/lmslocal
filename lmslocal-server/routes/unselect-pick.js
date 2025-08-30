/*
=======================================================================================================================================
Unselect Pick Route - Remove player's pick for current round
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
      return res.status(401).json({
        return_code: "UNAUTHORIZED",
        message: "No token provided"
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const userId = decoded.user_id || decoded.userId; // Handle both formats
    const result = await query('SELECT id, email, display_name, email_verified FROM app_user WHERE id = $1', [userId]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({
        return_code: "UNAUTHORIZED",
        message: "Invalid token"
      });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    return res.status(401).json({
      return_code: "UNAUTHORIZED",
      message: "Invalid token"
    });
  }
};

/*
=======================================================================================================================================
API Route: /unselect-pick
=======================================================================================================================================
Method: POST
Purpose: Remove player's pick for a round and restore team to allowed_teams
=======================================================================================================================================
Request Payload:
{
  "round_id": 5
}

Success Response:
{
  "return_code": "SUCCESS",
  "message": "Pick removed successfully",
  "warning": "You have 0 lives remaining - be careful!" // only if lives_remaining <= 0
}
=======================================================================================================================================
*/
router.post('/', verifyToken, async (req, res) => {
  try {
    const { round_id } = req.body;
    const user_id = req.user.id;

    // Basic validation
    if (!round_id || !Number.isInteger(round_id)) {
      return res.status(400).json({
        return_code: "VALIDATION_ERROR",
        message: "Round ID is required and must be a number"
      });
    }

    // Get round and competition info
    const roundCheck = await query(`
      SELECT r.id, r.competition_id, r.lock_time, r.round_number,
             c.organiser_id, c.name as competition_name
      FROM round r
      JOIN competition c ON r.competition_id = c.id
      WHERE r.id = $1
    `, [round_id]);

    if (roundCheck.rows.length === 0) {
      return res.status(404).json({
        return_code: "ROUND_NOT_FOUND",
        message: "Round not found"
      });
    }

    const roundInfo = roundCheck.rows[0];
    const competition_id = roundInfo.competition_id;
    const isAdmin = roundInfo.organiser_id === user_id;

    // Check if round is locked (admins can override)
    if (!isAdmin) {
      const now = new Date();
      const lockTime = new Date(roundInfo.lock_time);
      if (now >= lockTime) {
        return res.status(400).json({
          return_code: "ROUND_LOCKED",
          message: "This round is locked and picks cannot be changed"
        });
      }
    }

    // Get current pick for this round
    const pickResult = await query(`
      SELECT p.id, p.team
      FROM pick p
      WHERE p.round_id = $1 AND p.user_id = $2
    `, [round_id, user_id]);

    if (pickResult.rows.length === 0) {
      return res.status(400).json({
        return_code: "NO_PICK_FOUND",
        message: "No pick found for this round"
      });
    }

    const pick = pickResult.rows[0];
    const teamShortCode = pick.team;

    // Get team ID to restore to allowed_teams
    const teamResult = await query(`
      SELECT id FROM team WHERE short_name = $1
    `, [teamShortCode]);

    if (teamResult.rows.length === 0) {
      return res.status(400).json({
        return_code: "TEAM_NOT_FOUND",
        message: "Team not found"
      });
    }

    const teamId = teamResult.rows[0].id;

    // Get user's lives remaining for warning
    const livesResult = await query(`
      SELECT lives_remaining FROM competition_user
      WHERE competition_id = $1 AND user_id = $2
    `, [competition_id, user_id]);

    const livesRemaining = livesResult.rows.length > 0 ? livesResult.rows[0].lives_remaining : 0;

    // Delete the pick
    await query(`
      DELETE FROM pick
      WHERE round_id = $1 AND user_id = $2
    `, [round_id, user_id]);

    // Restore team to allowed_teams (unless admin)
    if (!isAdmin) {
      await query(`
        INSERT INTO allowed_teams (competition_id, user_id, team_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (competition_id, user_id, team_id) DO NOTHING
      `, [competition_id, user_id, teamId]);
    }

    // Log the unselect action
    await query(`
      INSERT INTO audit_log (competition_id, user_id, action, details)
      VALUES ($1, $2, 'Pick Removed', $3)
    `, [
      competition_id,
      user_id,
      `Player removed pick ${teamShortCode} for Round ${roundInfo.round_number}`
    ]);

    const response = {
      return_code: "SUCCESS",
      message: "Pick removed successfully"
    };

    // Add warning if low lives
    if (livesRemaining <= 0) {
      response.warning = "You have 0 lives remaining - be careful!";
    } else if (livesRemaining === 1) {
      response.warning = "You only have 1 life remaining - choose wisely!";
    }

    res.json(response);

  } catch (error) {
    console.error('Unselect pick error:', error);
    res.status(500).json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;