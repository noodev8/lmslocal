/*
=======================================================================================================================================
Set Pick Route
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
API Route: /set-pick
=======================================================================================================================================
Method: POST
Purpose: Make or update a pick for a round (player picks own team, admin can pick for any player)
=======================================================================================================================================
Request Payload (Player):
{
  "fixture_id": 24,
  "team": "home"
}

Request Payload (Admin setting for another player):
{
  "fixture_id": 24,
  "team": "away",
  "user_id": 12
}

Success Response:
{
  "return_code": "SUCCESS",
  "message": "Pick saved successfully",
  "pick": {
    "id": 1,
    "team": "CHE",
    "fixture_id": 24,
    "created_at": "2025-08-25T21:00:00Z"
  }
}
=======================================================================================================================================
*/
router.post('/', verifyToken, async (req, res) => {
  try {
    const { fixture_id, team, user_id } = req.body;
    const authenticated_user_id = req.user.id;
    const target_user_id = user_id || authenticated_user_id; // Default to own pick if no user_id provided

    // Basic validation
    if (!fixture_id || !Number.isInteger(fixture_id)) {
      return res.status(400).json({
        return_code: "VALIDATION_ERROR",
        message: "Fixture ID is required and must be a number"
      });
    }

    if (!team || !['home', 'away'].includes(team)) {
      return res.status(400).json({
        return_code: "VALIDATION_ERROR",
        message: "Team must be 'home' or 'away'"
      });
    }

    // Get fixture details and related competition/round info
    const fixtureCheck = await query(`
      SELECT f.id, f.home_team, f.away_team, f.home_team_short, f.away_team_short, f.round_id,
             r.competition_id, r.lock_time, r.round_number,
             c.organiser_id, c.name as competition_name
      FROM fixture f
      JOIN round r ON f.round_id = r.id
      JOIN competition c ON r.competition_id = c.id
      WHERE f.id = $1
    `, [fixture_id]);

    if (fixtureCheck.rows.length === 0) {
      return res.status(404).json({
        return_code: "FIXTURE_NOT_FOUND",
        message: "Fixture not found"
      });
    }

    const fixtureInfo = fixtureCheck.rows[0];
    const competition_id = fixtureInfo.competition_id;
    const round_id = fixtureInfo.round_id;

    // Check if user is admin (organiser) of this competition
    const isAdmin = fixtureInfo.organiser_id === authenticated_user_id;
    const isOwnPick = target_user_id === authenticated_user_id;

    // Players can only set their own picks, admins can set any pick
    if (!isAdmin && !isOwnPick) {
      return res.status(403).json({
        return_code: "UNAUTHORIZED",
        message: "You can only set your own pick unless you are the competition organiser"
      });
    }

    // Convert home/away to team short code
    const teamShortCode = team === 'home' ? fixtureInfo.home_team_short : fixtureInfo.away_team_short;

    // Get team ID from short code for allowed teams check
    const teamResult = await query(`
      SELECT id FROM team WHERE short_name = $1
    `, [teamShortCode]);

    if (teamResult.rows.length === 0) {
      return res.status(400).json({
        return_code: "INVALID_TEAM",
        message: "Team not found"
      });
    }

    const teamId = teamResult.rows[0].id;

    // Check if team is in user's allowed teams (unless admin override)
    if (!isAdmin) {
      const allowedTeamCheck = await query(`
        SELECT id FROM allowed_teams 
        WHERE competition_id = $1 AND user_id = $2 AND team_id = $3
      `, [competition_id, target_user_id, teamId]);

      if (allowedTeamCheck.rows.length === 0) {
        return res.status(400).json({
          return_code: "TEAM_NOT_ALLOWED",
          message: "You are not allowed to pick this team"
        });
      }
    }

    // Verify target user is part of this competition
    const memberCheck = await query(`
      SELECT cu.status
      FROM competition_user cu
      WHERE cu.competition_id = $1 AND cu.user_id = $2
    `, [competition_id, target_user_id]);
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({
        return_code: "UNAUTHORIZED",
        message: "Target user is not part of this competition"
      });
    }

    // Check if round is locked (admins can override)
    if (!isAdmin) {
      const now = new Date();
      const lockTime = new Date(fixtureInfo.lock_time);
      if (now >= lockTime) {
        return res.status(400).json({
          return_code: "ROUND_LOCKED",
          message: "This round is locked and picks cannot be changed"
        });
      }
    }

    // Check if team was already picked in previous rounds (no team twice rule)
    const previousPickCheck = await query(`
      SELECT p.team
      FROM pick p
      JOIN round r ON p.round_id = r.id
      WHERE r.competition_id = $1 AND p.user_id = $2 AND p.team = $3
    `, [competition_id, target_user_id, teamShortCode]);

    if (previousPickCheck.rows.length > 0) {
      return res.status(400).json({
        return_code: "TEAM_ALREADY_PICKED",
        message: "You have already picked this team in a previous round"
      });
    }

    // Check if user already has a pick for this round (for change handling)
    let oldTeamId = null;
    if (!isAdmin) {
      const existingPickResult = await query(`
        SELECT p.team
        FROM pick p
        WHERE p.round_id = $1 AND p.user_id = $2
      `, [round_id, target_user_id]);

      if (existingPickResult.rows.length > 0) {
        const oldTeamShortCode = existingPickResult.rows[0].team;
        // Get the old team ID to restore it to allowed_teams
        const oldTeamResult = await query(`
          SELECT id FROM team WHERE short_name = $1
        `, [oldTeamShortCode]);
        
        if (oldTeamResult.rows.length > 0) {
          oldTeamId = oldTeamResult.rows[0].id;
        }
      }
    }

    // Insert or update the pick
    const result = await query(`
      INSERT INTO pick (round_id, user_id, team, fixture_id, created_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT (round_id, user_id)
      DO UPDATE SET team = $3, fixture_id = $4, created_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [round_id, target_user_id, teamShortCode, fixture_id]);

    const pick = result.rows[0];

    // Handle allowed_teams changes (unless admin - they can override rules)
    if (!isAdmin) {
      // If this was a change, restore the old team to allowed_teams
      if (oldTeamId) {
        await query(`
          INSERT INTO allowed_teams (competition_id, user_id, team_id)
          VALUES ($1, $2, $3)
          ON CONFLICT (competition_id, user_id, team_id) DO NOTHING
        `, [competition_id, target_user_id, oldTeamId]);
      }

      // Remove the new team from allowed_teams
      await query(`
        DELETE FROM allowed_teams 
        WHERE competition_id = $1 AND user_id = $2 AND team_id = $3
      `, [competition_id, target_user_id, teamId]);
    }

    // Log the pick
    const actionType = oldTeamId ? 'Pick Changed' : 'Pick Made';
    const logDetails = isAdmin && !isOwnPick 
      ? `Admin set pick: ${teamShortCode} for User ${target_user_id} in Round ${fixtureInfo.round_number}${oldTeamId ? ' (changed)' : ''}`
      : oldTeamId 
        ? `Player changed pick from previous selection to ${teamShortCode} for Round ${fixtureInfo.round_number}`
        : `Player picked ${teamShortCode} for Round ${fixtureInfo.round_number}`;
      
    await query(`
      INSERT INTO audit_log (competition_id, user_id, action, details)
      VALUES ($1, $2, $3, $4)
    `, [
      competition_id,
      authenticated_user_id,
      actionType,
      logDetails
    ]);

    res.json({
      return_code: "SUCCESS",
      message: "Pick saved successfully",
      pick: {
        id: pick.id,
        team: pick.team,
        fixture_id: pick.fixture_id,
        created_at: pick.created_at
      }
    });

  } catch (error) {
    console.error('Set pick error:', error);
    res.status(500).json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;