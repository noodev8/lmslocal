/*
=======================================================================================================================================
API Route: join-competition
=======================================================================================================================================
Method: POST
Purpose: Join a competition using an invite code
=======================================================================================================================================
Request Payload:
{
  "invite_code": "1.4567"                  // string, required - format: organiser_id.4digit_pin
}

Success Response:
{
  "return_code": "SUCCESS",
  "message": "Successfully joined competition",
  "competition": {
    "id": 123,                             // number, competition ID
    "name": "Premier League LMS 2025",     // string, competition name
    "description": "Annual competition",    // string, competition description
    "status": "UNLOCKED",                  // string, competition status
    "lives_per_player": 1,                 // number, lives allocated per player
    "no_team_twice": true,                 // boolean, can't pick same team twice
    "team_list_name": "Premier League"     // string, name of team list used
  }
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"COMPETITION_NOT_FOUND"
"ALREADY_JOINED"
"COMPETITION_STARTED"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { query, populateAllowedTeams } = require('../database');
const verifyToken = require('../middleware/verifyToken');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  try {
    const { invite_code } = req.body;
    const user_id = req.user.id;

    // Basic validation
    if (!invite_code || !invite_code.trim()) {
      return res.status(400).json({
        return_code: "VALIDATION_ERROR",
        message: "Invite code is required"
      });
    }

    // Validate invite code format (should be organiser_id.4digit_pin)
    const codePattern = /^\d+\.\d{4}$/;
    if (!codePattern.test(invite_code.trim())) {
      return res.status(400).json({
        return_code: "VALIDATION_ERROR",
        message: "Invalid invite code format"
      });
    }

    // Find competition by invite code
    const competitionResult = await query(`
      SELECT 
        c.id,
        c.name,
        c.description,
        c.status,
        c.lives_per_player,
        c.no_team_twice,
        c.organiser_id,
        tl.name as team_list_name
      FROM competition c
      JOIN team_list tl ON c.team_list_id = tl.id
      WHERE c.invite_code = $1
    `, [invite_code.trim()]);

    if (competitionResult.rows.length === 0) {
      return res.status(404).json({
        return_code: "COMPETITION_NOT_FOUND",
        message: "Competition not found with this invite code"
      });
    }

    const competition = competitionResult.rows[0];

    // Check if competition has started by looking for any fixtures with past kickoff times
    const competitionStartedCheck = await query(`
      SELECT f.kickoff_time
      FROM round r
      JOIN fixture f ON r.id = f.round_id
      WHERE r.competition_id = $1 
        AND f.kickoff_time < CURRENT_TIMESTAMP
      LIMIT 1
    `, [competition.id]);

    if (competitionStartedCheck.rows.length > 0) {
      return res.status(400).json({
        return_code: "COMPETITION_STARTED",
        message: "Cannot join - competition has already started"
      });
    }

    // Check if user is already in this competition
    const existingParticipation = await query(`
      SELECT id, status FROM competition_user 
      WHERE competition_id = $1 AND user_id = $2
    `, [competition.id, user_id]);

    if (existingParticipation.rows.length > 0) {
      return res.status(400).json({
        return_code: "ALREADY_JOINED",
        message: "You are already a member of this competition"
      });
    }

    // Add user to competition
    await query(`
      INSERT INTO competition_user (
        competition_id,
        user_id,
        status,
        lives_remaining,
        joined_at
      )
      VALUES ($1, $2, 'active', $3, CURRENT_TIMESTAMP)
    `, [
      competition.id,
      user_id,
      competition.lives_per_player
    ]);

    // Populate allowed teams for this player
    await populateAllowedTeams(competition.id, user_id);

    // Log the join action
    await query(`
      INSERT INTO audit_log (competition_id, user_id, action, details)
      VALUES ($1, $2, 'Player Joined', $3)
    `, [
      competition.id,
      user_id,
      `Joined competition "${competition.name}" using invite code ${invite_code}`
    ]);

    res.json({
      return_code: "SUCCESS",
      message: "Successfully joined competition",
      competition: {
        id: competition.id,
        name: competition.name,
        description: competition.description,
        status: competition.status,
        lives_per_player: competition.lives_per_player,
        no_team_twice: competition.no_team_twice,
        team_list_name: competition.team_list_name
      }
    });

  } catch (error) {
    console.error('Join competition error:', error);
    res.status(500).json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;