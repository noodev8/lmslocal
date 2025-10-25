/*
=======================================================================================================================================
API Route: get-round-results-breakdown
=======================================================================================================================================
Method: POST
Purpose: Fetches detailed fixture-by-fixture results breakdown for a completed round, including pick counts and
         survivor/elimination statistics per fixture. Used for organizer marketing/promotion messaging.
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123,               // integer, required - ID of the competition
  "round_number": 5                    // integer, optional - Specific round (defaults to latest completed round)
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "round_number": 5,                   // integer, the round number for this data
  "fixture_results": [                 // array, fixtures with pick statistics
    {
      "fixture_id": 456,               // integer, fixture ID
      "home_team": "Arsenal",          // string, home team full name
      "away_team": "Chelsea",          // string, away team full name
      "home_team_short": "ARS",        // string, home team short code
      "away_team_short": "CHE",        // string, away team short code
      "result": "2-1",                 // string, match result (null if not completed)
      "outcome": "home_win",           // string, outcome: 'home_win', 'away_win', 'draw', or null
      "kickoff_time": "2025-01-24T15:00:00Z", // string ISO timestamp
      "home_picks": 12,                // integer, players who picked home team
      "away_picks": 7,                 // integer, players who picked away team
      "survivors": 12,                 // integer, players who survived this fixture
      "eliminated": 7                  // integer, players eliminated by this fixture
    }
  ],
  "summary": {                         // object, round totals
    "total_fixtures": 10,              // integer, total fixtures in round
    "completed_fixtures": 10,          // integer, fixtures with results
    "total_survivors": 27,             // integer, total players who survived
    "total_eliminated": 20,            // integer, total players eliminated
    "total_picks": 47                  // integer, total picks made this round
  }
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "MISSING_FIELDS",
  "message": "competition_id is required"
}

{
  "return_code": "NOT_FOUND",
  "message": "Competition not found"
}

{
  "return_code": "NO_COMPLETED_ROUNDS",
  "message": "No completed rounds with results available"
}

{
  "return_code": "UNAUTHORIZED",
  "message": "You are not the organizer of this competition"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"MISSING_FIELDS"
"NOT_FOUND"
"NO_COMPLETED_ROUNDS"
"UNAUTHORIZED"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const router = express.Router();
const { query } = require('../database');
const verifyToken = require('../middleware/verifyToken');
const { canManageResults } = require('../utils/permissions'); // Permission helper

router.post('/', verifyToken, async (req, res) => {
  try {
    const { competition_id, round_number } = req.body;
    const user_id = req.user.id;

    // Validate required fields
    if (!competition_id) {
      return res.status(200).json({
        return_code: 'MISSING_FIELDS',
        message: 'competition_id is required'
      });
    }

    // Fetch competition details and verify organizer
    const competitionResult = await query(
      `SELECT id, name, organiser_id
       FROM competition
       WHERE id = $1`,
      [competition_id]
    );

    if (competitionResult.rows.length === 0) {
      return res.status(200).json({
        return_code: 'NOT_FOUND',
        message: 'Competition not found'
      });
    }

    const competition = competitionResult.rows[0];

    // Verify user is the organizer or has delegated manage_results permission
    const permission = await canManageResults(user_id, competition_id);
    if (!permission.authorized) {
      return res.status(200).json({
        return_code: 'UNAUTHORIZED',
        message: 'You do not have permission to view results for this competition'
      });
    }

    // Determine which round to fetch
    let targetRound;
    if (round_number) {
      // Specific round requested
      const roundResult = await query(
        `SELECT id, round_number
         FROM round
         WHERE competition_id = $1 AND round_number = $2`,
        [competition_id, round_number]
      );

      if (roundResult.rows.length === 0) {
        return res.status(200).json({
          return_code: 'NOT_FOUND',
          message: `Round ${round_number} not found`
        });
      }

      targetRound = roundResult.rows[0];
    } else {
      // Get latest completed round (round with at least one result)
      const latestRoundResult = await query(
        `SELECT DISTINCT r.id, r.round_number
         FROM round r
         INNER JOIN fixture f ON r.id = f.round_id
         WHERE r.competition_id = $1 AND f.result IS NOT NULL
         ORDER BY r.round_number DESC
         LIMIT 1`,
        [competition_id]
      );

      if (latestRoundResult.rows.length === 0) {
        return res.status(200).json({
          return_code: 'NO_COMPLETED_ROUNDS',
          message: 'No completed rounds with results available'
        });
      }

      targetRound = latestRoundResult.rows[0];
    }

    // Get all fixtures for this round with results
    const fixturesResult = await query(
      `SELECT
         f.id as fixture_id,
         f.home_team,
         f.away_team,
         f.home_team_short,
         f.away_team_short,
         f.result,
         f.kickoff_time
       FROM fixture f
       WHERE f.round_id = $1
       ORDER BY f.kickoff_time ASC`,
      [targetRound.id]
    );

    const fixtures = fixturesResult.rows;

    // Get pick counts per fixture (convert team short codes to home/away)
    const pickCountsResult = await query(
      `SELECT
         p.fixture_id,
         CASE
           WHEN p.team = f.home_team_short THEN 'home'
           WHEN p.team = f.away_team_short THEN 'away'
           ELSE p.team
         END as team,
         COUNT(*) as pick_count
       FROM pick p
       JOIN fixture f ON p.fixture_id = f.id
       WHERE p.round_id = $1
       GROUP BY p.fixture_id, CASE
         WHEN p.team = f.home_team_short THEN 'home'
         WHEN p.team = f.away_team_short THEN 'away'
         ELSE p.team
       END`,
      [targetRound.id]
    );

    // Build pick counts map: fixture_id -> { home: count, away: count }
    const pickCountsMap = {};
    pickCountsResult.rows.forEach(row => {
      if (!pickCountsMap[row.fixture_id]) {
        pickCountsMap[row.fixture_id] = { home: 0, away: 0 };
      }
      if (row.team === 'home') {
        pickCountsMap[row.fixture_id].home = parseInt(row.pick_count);
      } else if (row.team === 'away') {
        pickCountsMap[row.fixture_id].away = parseInt(row.pick_count);
      }
    });

    // Calculate outcome for each fixture
    const fixture_results = fixtures.map(fixture => {
      const pickCounts = pickCountsMap[fixture.fixture_id] || { home: 0, away: 0 };

      // Determine outcome from result
      let outcome = null;
      let survivors = 0;
      let eliminated = 0;

      if (fixture.result) {
        // Result field contains: winner's short code (e.g., "AVL"), "DRAW", or NULL
        if (fixture.result === 'DRAW') {
          outcome = 'draw';
          survivors = 0;
          eliminated = pickCounts.home + pickCounts.away; // Both teams eliminated on draw
        } else if (fixture.result === fixture.home_team_short) {
          outcome = 'home_win';
          survivors = pickCounts.home;
          eliminated = pickCounts.away;
        } else if (fixture.result === fixture.away_team_short) {
          outcome = 'away_win';
          survivors = pickCounts.away;
          eliminated = pickCounts.home;
        }
      }

      return {
        fixture_id: fixture.fixture_id,
        home_team: fixture.home_team,
        away_team: fixture.away_team,
        home_team_short: fixture.home_team_short,
        away_team_short: fixture.away_team_short,
        result: fixture.result,
        outcome,
        kickoff_time: fixture.kickoff_time,
        home_picks: pickCounts.home,
        away_picks: pickCounts.away,
        survivors,
        eliminated
      };
    });

    // Calculate summary statistics
    const summary = {
      total_fixtures: fixtures.length,
      completed_fixtures: fixtures.filter(f => f.result).length,
      total_survivors: fixture_results.reduce((sum, f) => sum + f.survivors, 0),
      total_eliminated: fixture_results.reduce((sum, f) => sum + f.eliminated, 0),
      total_picks: fixture_results.reduce((sum, f) => sum + f.home_picks + f.away_picks, 0)
    };

    // Return success response
    return res.status(200).json({
      return_code: 'SUCCESS',
      round_number: targetRound.round_number,
      fixture_results,
      summary
    });

  } catch (error) {
    console.error('Error in get-round-results-breakdown:', error);
    return res.status(200).json({
      return_code: 'SERVER_ERROR',
      message: 'An unexpected error occurred'
    });
  }
});

module.exports = router;
