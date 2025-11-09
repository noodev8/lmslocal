/*
=======================================================================================================================================
API Route: get-round-history
=======================================================================================================================================
Method: POST
Purpose: Get complete historical data for a specific round including all teams, results, player pick, and pick counts
=======================================================================================================================================
Request Payload:
{
  "round_id": 123                          // number, required - The round ID to get history for
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "round_data": {
    "round_number": 2,                     // number, round number
    "fixtures": [                          // array, all fixtures for this round
      {
        "id": 456,
        "home_team": "Arsenal",
        "away_team": "Chelsea", 
        "home_team_short": "ARS",
        "away_team_short": "CHE",
        "result": "ARS"                    // team_short that won, "DRAW", or null
      }
    ],
    "player_pick": "ARS",                  // string, team short player picked, or null
    "player_outcome": "won",               // "won", "lost", "no_pick", or null
    "pick_counts": {                       // object, pick counts by team short name
      "ARS": 12,
      "CHE": 8
    }
  }
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"NOT_FOUND"
"UNAUTHORIZED"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../database');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  logApiCall('get-round-history');

  try {
    const { round_id } = req.body;

    // Validation
    if (!round_id || typeof round_id !== 'number') {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "round_id is required and must be a number"
      });
    }

    // Get user ID from JWT token (set by verifyToken middleware)
    const user_id = req.user.id;
    // Get round info
    const roundQuery = `
      SELECT round_number, competition_id
      FROM round
      WHERE id = $1
    `;
    const roundResult = await query(roundQuery, [round_id]);

    if (roundResult.rows.length === 0) {
      return res.json({
        return_code: "NOT_FOUND",
        message: "Round not found"
      });
    }

    const { round_number, competition_id } = roundResult.rows[0];

    // Get all fixtures for this round
    const fixturesQuery = `
      SELECT id, home_team, away_team, home_team_short, away_team_short, result
      FROM fixture
      WHERE round_id = $1
      ORDER BY home_team, away_team
    `;
    const fixturesResult = await query(fixturesQuery, [round_id]);

    // Get player's pick for this round
    const playerPickQuery = `
      SELECT team
      FROM pick
      WHERE round_id = $1 AND user_id = $2
    `;
    const playerPickResult = await query(playerPickQuery, [round_id, user_id]);
    const player_pick = playerPickResult.rows.length > 0 ? playerPickResult.rows[0].team : null;

    // Determine player outcome (simplified for now)
    let player_outcome = null;
    if (player_pick) {
      // TODO: This logic may need refinement based on your pick outcome calculation
      const playerFixture = fixturesResult.rows.find(f => 
        f.home_team_short === player_pick || f.away_team_short === player_pick
      );
      if (playerFixture && playerFixture.result) {
        if (playerFixture.result === player_pick) {
          player_outcome = "won";
        } else if (playerFixture.result === "DRAW") {
          player_outcome = "lost"; // or "draw" if you handle draws differently
        } else {
          player_outcome = "lost";
        }
      }
    } else {
      player_outcome = "no_pick";
    }

    // Get pick counts for each team in this round
    const pickCountQuery = `
      SELECT 
        CASE 
          WHEN p.team = 'home' THEN f.home_team_short
          WHEN p.team = 'away' THEN f.away_team_short
          ELSE p.team
        END as team_short,
        COUNT(*) as pick_count
      FROM pick p
      JOIN fixture f ON p.fixture_id = f.id
      WHERE f.round_id = $1
      GROUP BY 
        CASE 
          WHEN p.team = 'home' THEN f.home_team_short
          WHEN p.team = 'away' THEN f.away_team_short
          ELSE p.team
        END
    `;
    const pickCountResult = await query(pickCountQuery, [round_id]);

    // Convert pick counts to object format
    const pick_counts = {};
    pickCountResult.rows.forEach(row => {
      pick_counts[row.team_short] = parseInt(row.pick_count);
    });

    return res.json({
      return_code: "SUCCESS",
      round_data: {
        round_number: round_number,
        fixtures: fixturesResult.rows,
        player_pick: player_pick,
        player_outcome: player_outcome,
        pick_counts: pick_counts
      }
    });

  } catch (error) {
    console.error('Error in get-round-history:', error);
    return res.json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;