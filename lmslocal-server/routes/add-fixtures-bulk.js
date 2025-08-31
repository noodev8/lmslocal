/*
=======================================================================================================================================
API Route: add-fixtures-bulk
=======================================================================================================================================
Method: POST
Purpose: Adds multiple fixtures to a round by replacing all existing fixtures with new ones (organiser only)
=======================================================================================================================================
Request Payload:
{
  "round_id": 1,                               // integer, required - ID of the round to add fixtures to
  "fixtures": [                                // array, required - List of fixtures to create
    {
      "home_team": "ARS",                      // string, required - Home team short name
      "away_team": "CHE",                      // string, required - Away team short name  
      "kickoff_time": "2025-08-25T15:00:00Z"  // string, required - ISO datetime for fixture kickoff
    }
  ]
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "5 fixtures replaced successfully",    // string, confirmation message with count
  "fixtures": [                                    // array, created fixture objects
    {
      "id": 1,                                     // integer, unique fixture ID
      "home_team": "Arsenal",                      // string, full home team name
      "away_team": "Chelsea",                      // string, full away team name
      "home_team_short": "ARS",                    // string, abbreviated home team name
      "away_team_short": "CHE",                    // string, abbreviated away team name
      "kickoff_time": "2025-08-25T15:00:00Z",     // string, ISO datetime for kickoff
      "created_at": "2025-08-31T10:00:00Z"        // string, ISO datetime when fixture was created
    }
  ]
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"           // string, user-friendly error description
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
const { query, transaction } = require('../database');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  try {
    // Extract request parameters and authenticated user ID
    const { round_id, fixtures } = req.body;
    const user_id = req.user.id;

    // === INPUT VALIDATION ===
    // Validate round_id is provided and can be converted to integer
    if (!round_id || !Number.isInteger(parseInt(round_id))) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Round ID is required and must be a number"
      });
    }

    const roundIdInt = parseInt(round_id);

    // Validate fixtures array is provided and is actually an array
    if (!fixtures || !Array.isArray(fixtures)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Fixtures array is required"
      });
    }

    // === FIXTURE VALIDATION ===
    // Validate each fixture has required fields (home_team, away_team, kickoff_time)
    // Frontend sends short team names (e.g., "ARS", "CHE") which we'll convert to full names
    for (let i = 0; i < fixtures.length; i++) {
      const fixture = fixtures[i];
      if (!fixture.home_team || !fixture.away_team || !fixture.kickoff_time) {
        return res.json({
          return_code: "VALIDATION_ERROR",
          message: `Fixture ${i + 1}: Home team, away team, and kickoff time are required`
        });
      }
    }

    // === AUTHORIZATION CHECK ===
    // Verify round exists and get competition ownership details
    // This single query gets round info AND checks if user is the organiser
    const verifyResult = await query(`
      SELECT c.organiser_id, c.name as competition_name, r.round_number, r.competition_id
      FROM competition c
      JOIN round r ON c.id = r.competition_id
      WHERE r.id = $1
    `, [roundIdInt]);

    // Check if round exists in database
    if (verifyResult.rows.length === 0) {
      return res.json({
        return_code: "NOT_FOUND",
        message: "Competition or round not found"
      });
    }

    // Verify authenticated user is the competition organiser (only organisers can manage fixtures)
    if (verifyResult.rows[0].organiser_id !== user_id) {
      return res.json({
        return_code: "UNAUTHORIZED",
        message: "Only the competition organiser can add fixtures"
      });
    }

    // === TEAM NAME RESOLUTION ===
    // Extract all unique team short names from fixtures to perform bulk lookup
    // This prevents N+1 queries by getting all team names in one query
    const allShortNames = [...new Set(fixtures.flatMap(f => [f.home_team, f.away_team]))];
    const teamLookupResult = await query(`
      SELECT name, short_name
      FROM team 
      WHERE short_name = ANY($1) AND is_active = true
    `, [allShortNames]);
    
    // Create team short_name -> full_name lookup map for efficient conversion
    // Frontend sends "ARS" but database stores full name "Arsenal"
    const teamMap = {};
    teamLookupResult.rows.forEach(team => {
      teamMap[team.short_name] = team.name;
    });

    // === ATOMIC TRANSACTION EXECUTION ===
    // Execute all database operations in single transaction to ensure data consistency
    // If any operation fails, all changes are rolled back automatically
    await transaction(async (client) => {
      // Step 1: Delete all existing fixtures for this round (replace operation)
      // This ensures we start with a clean slate for the round
      await client.query('DELETE FROM fixture WHERE round_id = $1', [roundIdInt]);

      // Step 2: Insert new fixtures with both full and short team names
      // Store both formats for different UI display needs (full names for admin, short for space-constrained views)
      for (const fixture of fixtures) {
        await client.query(`
          INSERT INTO fixture (
            round_id,
            home_team,                    -- Full team name (e.g., "Arsenal")
            away_team,                    -- Full team name (e.g., "Chelsea") 
            home_team_short,              -- Short team name (e.g., "ARS")
            away_team_short,              -- Short team name (e.g., "CHE")
            kickoff_time,
            created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
        `, [
          roundIdInt,
          teamMap[fixture.home_team] || fixture.home_team, // Full name from lookup or fallback to input
          teamMap[fixture.away_team] || fixture.away_team, // Full name from lookup or fallback to input
          fixture.home_team,                               // Short name from frontend input
          fixture.away_team,                               // Short name from frontend input
          fixture.kickoff_time
        ]);
      }

      // Step 3: Add audit log for administrative tracking
      // Record this bulk fixture creation for competition audit trail
      await client.query(`
        INSERT INTO audit_log (competition_id, user_id, action, details)
        VALUES ($1, $2, 'Fixtures Created', $3)
      `, [
        verifyResult.rows[0].competition_id,
        user_id,
        `Created all fixtures in Round ${verifyResult.rows[0].round_number} with ${fixtures.length} new fixtures`
      ]);
    });

    // === POST-TRANSACTION VERIFICATION ===
    // Retrieve the newly created fixtures to return to frontend for immediate UI updates
    const finalResult = await query(`
      SELECT *
      FROM fixture
      WHERE round_id = $1
      ORDER BY kickoff_time ASC           -- Order by kickoff time for logical display
    `, [roundIdInt]);

    // === SUCCESS RESPONSE ===
    // Return complete fixture data for frontend consumption (results page, fixture management)
    res.json({
      return_code: "SUCCESS",
      message: `${fixtures.length} fixtures replaced successfully`,
      fixtures: finalResult.rows           // Array of complete fixture objects with IDs
    });

  } catch (error) {
    // === ERROR HANDLING ===
    // Log detailed error for debugging but return generic message to client for security
    console.error('Bulk replace fixtures error:', error);
    res.json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;