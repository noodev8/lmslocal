/*
=======================================================================================================================================
Replace Fixtures Bulk Route
=======================================================================================================================================
Method: POST
Purpose: Replace all fixtures in a round with new fixtures (organiser only)
=======================================================================================================================================
Request Payload:
{
  "round_id": 1,
  "fixtures": [
    {
      "home_team": "Arsenal",
      "away_team": "Chelsea", 
      "home_team_short": "ARS",
      "away_team_short": "CHE",
      "kickoff_time": "2025-08-25T15:00:00Z"
    },
    {
      "home_team": "Liverpool",
      "away_team": "Manchester United",
      "home_team_short": "LIV", 
      "away_team_short": "MAN",
      "kickoff_time": "2025-08-25T15:00:00Z"
    }
  ]
}

Success Response:
{
  "return_code": "SUCCESS",
  "message": "5 fixtures replaced successfully",
  "fixtures": [
    {
      "id": 1,
      "home_team": "Arsenal",
      "away_team": "Chelsea",
      "home_team_short": "ARS",
      "away_team_short": "CHE",
      "kickoff_time": "2025-08-25T15:00:00Z"
    },
    ...
  ]
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"UNAUTHORIZED"
"NOT_FOUND"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const jwt = require('jsonwebtoken');
const { query, transaction } = require('../database');
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

router.post('/', verifyToken, async (req, res) => {
  try {
    const { round_id, fixtures } = req.body;
    const user_id = req.user.id;

    // Basic validation
    if (!round_id || !Number.isInteger(parseInt(round_id))) {
      return res.status(400).json({
        return_code: "VALIDATION_ERROR",
        message: "Round ID is required and must be a number"
      });
    }

    const roundIdInt = parseInt(round_id);

    if (!fixtures || !Array.isArray(fixtures)) {
      return res.status(400).json({
        return_code: "VALIDATION_ERROR",
        message: "Fixtures array is required"
      });
    }

    // Validate each fixture
    for (let i = 0; i < fixtures.length; i++) {
      const fixture = fixtures[i];
      if (!fixture.home_team || !fixture.away_team || !fixture.kickoff_time) {
        return res.status(400).json({
          return_code: "VALIDATION_ERROR",
          message: `Fixture ${i + 1}: Home team, away team, and kickoff time are required`
        });
      }
    }

    // Verify user is the organiser and round exists
    const verifyResult = await query(`
      SELECT c.organiser_id, c.name as competition_name, r.round_number, r.competition_id
      FROM competition c
      JOIN round r ON c.id = r.competition_id
      WHERE r.id = $1
    `, [roundIdInt]);

    if (verifyResult.rows.length === 0) {
      return res.status(404).json({
        return_code: "NOT_FOUND",
        message: "Competition or round not found"
      });
    }

    if (verifyResult.rows[0].organiser_id !== user_id) {
      return res.status(403).json({
        return_code: "UNAUTHORIZED",
        message: "Only the competition organiser can add fixtures"
      });
    }

    // Prepare transaction queries
    const queries = [];
    
    // Delete all existing fixtures for this round
    queries.push({
      text: 'DELETE FROM fixture WHERE round_id = $1',
      params: [roundIdInt]
    });

    // Get team names from short names
    const allShortNames = [...new Set(fixtures.flatMap(f => [f.home_team, f.away_team]))];
    const teamLookupResult = await query(`
      SELECT name, short_name
      FROM team 
      WHERE short_name = ANY($1) AND is_active = true
    `, [allShortNames]);
    
    // Create team lookup map
    const teamMap = {};
    teamLookupResult.rows.forEach(team => {
      teamMap[team.short_name] = team.name;
    });

    // Insert new fixtures with correct team names
    for (const fixture of fixtures) {
      queries.push({
        text: `
          INSERT INTO fixture (
            round_id,
            home_team,
            away_team,
            home_team_short,
            away_team_short,
            kickoff_time,
            created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
        `,
        params: [
          roundIdInt,
          teamMap[fixture.home_team] || fixture.home_team, // Full name from lookup
          teamMap[fixture.away_team] || fixture.away_team, // Full name from lookup
          fixture.home_team, // Short name (what frontend sends)
          fixture.away_team, // Short name (what frontend sends)
          fixture.kickoff_time
        ]
      });
    }

    // Add audit log
    queries.push({
      text: `
        INSERT INTO audit_log (competition_id, user_id, action, details)
        VALUES ($1, $2, 'Fixtures Created', $3)
      `,
      params: [
        verifyResult.rows[0].competition_id,
        user_id,
        `Created all fixtures in Round ${verifyResult.rows[0].round_number} with ${fixtures.length} new fixtures`
      ]
    });

    // Execute all queries in transaction
    await transaction(queries);

    // Get the final fixtures to return
    const finalResult = await query(`
      SELECT *
      FROM fixture
      WHERE round_id = $1
      ORDER BY kickoff_time ASC
    `, [roundIdInt]);

    res.json({
      return_code: "SUCCESS",
      message: `${fixtures.length} fixtures replaced successfully`,
      fixtures: finalResult.rows
    });

  } catch (error) {
    console.error('Bulk replace fixtures error:', error);
    res.status(500).json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;