/*
=======================================================================================================================================
Admin Set Pick Route
=======================================================================================================================================
Method: POST
Purpose: Allow admin to set a pick for any player in their competition
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123,
  "user_id": 456,        // Player to set pick for
  "team": "Arsenal"      // Team name
}

Success Response:
{
  "return_code": "SUCCESS",
  "message": "Pick set successfully for player",
  "pick": {
    "id": 789,
    "user_id": 456,
    "team": "Arsenal",
    "player_name": "Old Bill"
  }
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR" 
"UNAUTHORIZED"
"COMPETITION_NOT_FOUND"
"ROUND_LOCKED"
"TEAM_NOT_ALLOWED"
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
    const { competition_id, user_id, team } = req.body;
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

    if (!team || typeof team !== 'string' || team.trim().length === 0) {
      return res.status(200).json({
        return_code: "VALIDATION_ERROR",
        message: "Team is required and must be a valid string"
      });
    }

    // Verify admin is organiser of this competition
    const competitionResult = await query(`
      SELECT c.id, c.name, c.organiser_id,
             (SELECT MAX(round_number) FROM round WHERE competition_id = c.id) as current_round
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
        message: "Only the competition organiser can set picks for players"
      });
    }

    // Verify user is participating in this competition
    const participantResult = await query(`
      SELECT cu.id, cu.status, u.display_name
      FROM competition_user cu
      JOIN app_user u ON cu.user_id = u.id
      WHERE cu.competition_id = $1 AND cu.user_id = $2
    `, [competition_id, user_id]);

    if (participantResult.rows.length === 0) {
      return res.status(200).json({
        return_code: "VALIDATION_ERROR",
        message: "User is not participating in this competition"
      });
    }

    const participant = participantResult.rows[0];

    if (participant.status === 'OUT') {
      return res.status(200).json({
        return_code: "VALIDATION_ERROR",
        message: "Cannot set pick for eliminated player"
      });
    }

    // Get current round details
    const currentRoundResult = await query(`
      SELECT r.id, r.round_number, r.lock_time
      FROM round r
      WHERE r.competition_id = $1 AND r.round_number = $2
    `, [competition_id, competition.current_round]);

    if (currentRoundResult.rows.length === 0) {
      return res.status(200).json({
        return_code: "VALIDATION_ERROR",
        message: "No current round found for this competition"
      });
    }

    const currentRound = currentRoundResult.rows[0];

    // Check if round is locked
    const now = new Date();
    const isLocked = currentRound.lock_time && now >= new Date(currentRound.lock_time);

    if (isLocked) {
      return res.status(200).json({
        return_code: "ROUND_LOCKED",
        message: "Cannot set pick - round is already locked"
      });
    }

    // Verify team is allowed for this user
    const allowedTeamResult = await query(`
      SELECT at.id
      FROM allowed_teams at
      JOIN team t ON at.team_id = t.id
      WHERE at.competition_id = $1 AND at.user_id = $2 AND t.name = $3
    `, [competition_id, user_id, team.trim()]);

    if (allowedTeamResult.rows.length === 0) {
      return res.status(200).json({
        return_code: "TEAM_NOT_ALLOWED",
        message: "Team not allowed for this player or team does not exist"
      });
    }

    // Convert full team name to short code (to match normal pick storage)
    const teamShortResult = await query(`
      SELECT short_name FROM team WHERE name = $1
    `, [team.trim()]);

    if (teamShortResult.rows.length === 0) {
      return res.status(200).json({
        return_code: "VALIDATION_ERROR",
        message: "Team not found in system"
      });
    }

    const teamShortCode = teamShortResult.rows[0].short_name;

    // Get fixture for this team in current round
    const fixtureResult = await query(`
      SELECT id FROM fixture 
      WHERE round_id = $1 
        AND (home_team = $2 OR away_team = $2)
    `, [currentRound.id, team.trim()]);

    // Check if player already has a pick for this round
    const existingPickResult = await query(`
      SELECT id FROM pick
      WHERE round_id = $1 AND user_id = $2
    `, [currentRound.id, user_id]);

    let pickResult;

    if (existingPickResult.rows.length > 0) {
      // Update existing pick (use short code to match normal picks)
      pickResult = await query(`
        UPDATE pick
        SET team = $1, fixture_id = $2, set_by_admin = $3, created_at = CURRENT_TIMESTAMP
        WHERE round_id = $4 AND user_id = $5
        RETURNING id, team, user_id
      `, [teamShortCode, fixtureResult.rows.length > 0 ? fixtureResult.rows[0].id : null, admin_id, currentRound.id, user_id]);
    } else {
      // Create new pick (use short code to match normal picks)
      pickResult = await query(`
        INSERT INTO pick (round_id, user_id, fixture_id, team, set_by_admin)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, team, user_id
      `, [currentRound.id, user_id, fixtureResult.rows.length > 0 ? fixtureResult.rows[0].id : null, teamShortCode, admin_id]);
    }

    // Log the action (user_id = player it was done FOR, admin_id in details)
    await query(`
      INSERT INTO audit_log (competition_id, user_id, action, details)
      VALUES ($1, $2, 'Admin Set Pick', $3)
    `, [
      competition_id,
      user_id, // Player the action was done FOR
      `Admin ${admin_id} set pick "${team.trim()}" for player "${participant.display_name}" in Round ${currentRound.round_number}`
    ]);

    res.status(200).json({
      return_code: "SUCCESS",
      message: "Pick set successfully for player",
      pick: {
        id: pickResult.rows[0].id,
        user_id: user_id,
        team: team.trim(),
        player_name: participant.display_name,
        round_number: currentRound.round_number
      }
    });

  } catch (error) {
    console.error('Admin set pick error:', error);
    res.status(200).json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;