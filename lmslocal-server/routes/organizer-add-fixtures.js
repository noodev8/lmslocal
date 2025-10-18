/*
=======================================================================================================================================
API Route: organizer-add-fixtures
=======================================================================================================================================
Method: POST
Purpose: Allows competition organizers to add/replace fixtures for their competition. Only works for manual competitions
         (fixture_service = false). Auto-creates rounds as needed.
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123,                      // integer, required - Competition ID
  "kickoff_time": "2025-10-25T15:00:00Z",     // string, required - ISO datetime for all fixtures
  "fixtures": [                               // array, required - List of fixtures to add
    {
      "home_team_short": "ARS",               // string, required - Home team short code
      "away_team_short": "CHE"                // string, required - Away team short code
    }
  ]
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "round_id": 5,                              // integer, ID of round where fixtures were added
  "round_number": 5,                          // integer, Round number
  "fixtures_added": 10,                       // integer, Count of fixtures added
  "message": "10 fixtures added to Round 5"   // string, Confirmation message
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "UNAUTHORIZED",
  "message": "Only the competition organiser can manage fixtures"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"MISSING_FIELDS"           - Required fields are missing
"UNAUTHORIZED"             - User is not the organiser of this competition
"COMPETITION_NOT_FOUND"    - Competition doesn't exist
"AUTOMATED_COMPETITION"    - Competition uses fixture_service (automated mode)
"COMPETITION_COMPLETE"     - Competition has already ended
"SERVER_ERROR"             - Database or unexpected error
=======================================================================================================================================
*/

const express = require('express');
const { query, transaction } = require('../database');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  logApiCall('organizer-add-fixtures');

  try {
    const { competition_id, kickoff_time, fixtures } = req.body;
    const user_id = req.user.id;

    // ========================================
    // STEP 1: VALIDATE REQUEST PAYLOAD
    // ========================================

    // Validate competition_id
    if (!competition_id || !Number.isInteger(parseInt(competition_id))) {
      return res.status(200).json({
        return_code: "MISSING_FIELDS",
        message: "competition_id is required and must be an integer"
      });
    }

    // Validate kickoff_time
    if (!kickoff_time || typeof kickoff_time !== 'string') {
      return res.status(200).json({
        return_code: "MISSING_FIELDS",
        message: "kickoff_time is required and must be a valid ISO datetime string"
      });
    }

    // Validate fixtures array
    if (!fixtures || !Array.isArray(fixtures) || fixtures.length === 0) {
      return res.status(200).json({
        return_code: "MISSING_FIELDS",
        message: "fixtures array is required and must contain at least one fixture"
      });
    }

    // Validate each fixture has required fields
    for (let i = 0; i < fixtures.length; i++) {
      const fixture = fixtures[i];
      if (!fixture.home_team_short || !fixture.away_team_short) {
        return res.status(200).json({
          return_code: "MISSING_FIELDS",
          message: `Fixture ${i + 1}: Both home_team_short and away_team_short are required`
        });
      }
    }

    const competitionIdInt = parseInt(competition_id);

    // ========================================
    // STEP 2: VERIFY COMPETITION AND AUTHORIZATION
    // ========================================

    // Get competition details and verify user is organiser
    const competitionResult = await query(`
      SELECT
        id,
        name,
        organiser_id,
        status,
        fixture_service,
        team_list_id
      FROM competition
      WHERE id = $1
    `, [competitionIdInt]);

    // Check if competition exists
    if (competitionResult.rows.length === 0) {
      return res.status(200).json({
        return_code: "COMPETITION_NOT_FOUND",
        message: "Competition not found"
      });
    }

    const competition = competitionResult.rows[0];

    // Verify user is the organiser
    if (competition.organiser_id !== user_id) {
      return res.status(200).json({
        return_code: "UNAUTHORIZED",
        message: "Only the competition organiser can manage fixtures"
      });
    }

    // Check if competition uses automated fixture service
    if (competition.fixture_service === true) {
      return res.status(200).json({
        return_code: "AUTOMATED_COMPETITION",
        message: "This competition uses automated fixture service. Contact admin to manage fixtures."
      });
    }

    // Check if competition is already complete
    if (competition.status === 'COMPLETE') {
      return res.status(200).json({
        return_code: "COMPETITION_COMPLETE",
        message: "Cannot add fixtures - competition has ended"
      });
    }

    // ========================================
    // STEP 3: GET TEAM NAMES
    // ========================================

    // Extract all unique team short names from fixtures
    const allShortNames = [...new Set(fixtures.flatMap(f => [f.home_team_short, f.away_team_short]))];

    // Get full team names from database
    const teamLookupResult = await query(`
      SELECT name, short_name
      FROM team
      WHERE short_name = ANY($1) AND is_active = true
    `, [allShortNames]);

    // Create lookup map: short_name -> full_name
    const teamMap = {};
    teamLookupResult.rows.forEach(team => {
      teamMap[team.short_name] = team.name;
    });

    // ========================================
    // STEP 4: EXECUTE DATABASE TRANSACTION
    // ========================================

    const result = await transaction(async (client) => {
      // Find or create current round
      // Strategy: Get the latest incomplete round, or create new one
      const roundResult = await client.query(`
        SELECT id, round_number, lock_time
        FROM round
        WHERE competition_id = $1
        ORDER BY round_number DESC
        LIMIT 1
      `, [competitionIdInt]);

      let roundId;
      let roundNumber;

      if (roundResult.rows.length === 0) {
        // No rounds exist - create Round 1
        const newRoundResult = await client.query(`
          INSERT INTO round (
            competition_id,
            round_number,
            lock_time,
            created_at
          )
          VALUES ($1, 1, $2, CURRENT_TIMESTAMP)
          RETURNING id, round_number
        `, [competitionIdInt, kickoff_time]);

        roundId = newRoundResult.rows[0].id;
        roundNumber = newRoundResult.rows[0].round_number;
      } else {
        // Use existing latest round
        roundId = roundResult.rows[0].id;
        roundNumber = roundResult.rows[0].round_number;

        // Update lock_time to match new kickoff_time
        await client.query(`
          UPDATE round
          SET lock_time = $1
          WHERE id = $2
        `, [kickoff_time, roundId]);
      }

      // Delete all existing fixtures in this round (replace operation)
      await client.query(`
        DELETE FROM fixture
        WHERE round_id = $1
      `, [roundId]);

      // Insert new fixtures
      for (const fixture of fixtures) {
        const homeTeamFull = teamMap[fixture.home_team_short] || fixture.home_team_short;
        const awayTeamFull = teamMap[fixture.away_team_short] || fixture.away_team_short;

        await client.query(`
          INSERT INTO fixture (
            round_id,
            competition_id,
            home_team,
            away_team,
            home_team_short,
            away_team_short,
            kickoff_time,
            created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
        `, [
          roundId,
          competitionIdInt,
          homeTeamFull,
          awayTeamFull,
          fixture.home_team_short,
          fixture.away_team_short,
          kickoff_time
        ]);
      }

      // Add audit log entry
      await client.query(`
        INSERT INTO audit_log (competition_id, user_id, action, details)
        VALUES ($1, $2, 'Organiser Added Fixtures', $3)
      `, [
        competitionIdInt,
        user_id,
        `Added ${fixtures.length} fixtures to Round ${roundNumber}`
      ]);

      return {
        round_id: roundId,
        round_number: roundNumber,
        fixtures_added: fixtures.length
      };
    });

    // ========================================
    // STEP 5: RETURN SUCCESS RESPONSE
    // ========================================

    return res.status(200).json({
      return_code: "SUCCESS",
      round_id: result.round_id,
      round_number: result.round_number,
      fixtures_added: result.fixtures_added,
      message: `${result.fixtures_added} fixtures added to Round ${result.round_number}`
    });

  } catch (error) {
    // ========================================
    // ERROR HANDLING
    // ========================================
    console.error('Error in organizer-add-fixtures:', error);
    return res.status(200).json({
      return_code: "SERVER_ERROR",
      message: "An error occurred while adding fixtures"
    });
  }
});

module.exports = router;
