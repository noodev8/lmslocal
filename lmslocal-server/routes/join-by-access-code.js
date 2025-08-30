/*
=======================================================================================================================================
Join by Access Code Route - Join competition using just the access code
=======================================================================================================================================
*/

const express = require('express');
const { query, populateAllowedTeams } = require('../database');
const verifyToken = require('../middleware/verifyToken');
const router = express.Router();

/*
=======================================================================================================================================
API Route: /join-by-access-code
=======================================================================================================================================
Method: POST
Purpose: Join a competition using just the access code
=======================================================================================================================================
Request Payload:
{
  "access_code": "ABC123"              // string, required - competition access code
}

Request Headers:
Authorization: Bearer JWT_TOKEN        // Required for user authentication

Success Response:
{
  "return_code": "SUCCESS",
  "message": "Successfully joined competition",
  "competition_name": "Premier League",
  "competition_id": 22,
  "slug": "10001"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"UNAUTHORIZED"
"COMPETITION_NOT_FOUND" 
"INVALID_ACCESS_CODE"
"ALREADY_JOINED"
"SERVER_ERROR"
=======================================================================================================================================
*/
router.post('/', verifyToken, async (req, res) => {
  try {
    const { access_code } = req.body;
    const user_id = req.user.id;

    // Basic validation
    if (!access_code || typeof access_code !== 'string') {
      return res.status(400).json({
        return_code: "VALIDATION_ERROR",
        message: "Access code is required"
      });
    }

    // Find competition by access code
    const competitionResult = await query(`
      SELECT id, name, slug, status, invite_code, lives_per_player
      FROM competition
      WHERE invite_code = $1
    `, [access_code.trim()]);

    if (competitionResult.rows.length === 0) {
      return res.status(404).json({
        return_code: "INVALID_ACCESS_CODE",
        message: "Invalid access code"
      });
    }

    const competition = competitionResult.rows[0];

    // Check if user already joined this competition
    const existingMemberResult = await query(`
      SELECT id FROM competition_user
      WHERE competition_id = $1 AND user_id = $2
    `, [competition.id, user_id]);

    if (existingMemberResult.rows.length > 0) {
      return res.status(400).json({
        return_code: "ALREADY_JOINED",
        message: "You have already joined this competition"
      });
    }

    // Join user to competition
    await query(`
      INSERT INTO competition_user (competition_id, user_id, status, lives_remaining, joined_at)
      VALUES ($1, $2, 'active', $3, CURRENT_TIMESTAMP)
    `, [competition.id, user_id, competition.lives_per_player]);

    // Populate allowed teams for this player
    await populateAllowedTeams(competition.id, user_id);

    res.json({
      return_code: "SUCCESS",
      message: "Successfully joined competition",
      competition_name: competition.name,
      competition_id: competition.id,
      slug: competition.slug
    });

  } catch (error) {
    console.error('Join by access code error:', error);
    res.status(500).json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;