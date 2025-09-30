/*
=======================================================================================================================================
API Route: push-results-to-competitions
=======================================================================================================================================
Method: POST
Purpose: Admin-only route that pushes results from fixture_load to competition fixtures.
         Updates fixture.result field with winning team short name or "DRAW".
         Only updates fixtures where result is NULL (never overrides existing results).
=======================================================================================================================================
Request Payload:
{
  // No parameters required - processes all unpushed results from fixture_load
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "fixtures_updated": 15,                 // integer, number of competition fixtures updated with results
  "results_marked_pushed": 15,            // integer, number of fixture_load records marked as pushed
  "message": "15 results pushed to competitions successfully"
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"NO_RESULTS_TO_PUSH"
"UNAUTHORIZED"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { transaction } = require('../../database');       // Destructured database import from central pooling (using transaction for atomicity)
const { verifyToken, requireAdmin } = require('../../middleware/auth');  // JWT authentication middleware
const { logApiCall } = require('../../utils/apiLogger');  // API logging utility
const router = express.Router();

// POST endpoint - requires JWT authentication and admin privileges
router.post('/', verifyToken, requireAdmin, async (req, res) => {
  // Log this API call for monitoring and debugging
  logApiCall('push-results-to-competitions');

  try {
    // Execute all operations in a single atomic transaction
    // This ensures either ALL changes succeed or ALL are rolled back
    const result = await transaction(async (client) => {

      // === STEP 1: GET UNPUSHED RESULTS FROM FIXTURE_LOAD ===
      // Find all results that are ready to push to competitions
      // Criteria:
      // 1. fixtures_pushed = true (fixtures have already been pushed to competitions)
      // 2. results_pushed = false (results have NOT been pushed yet)
      // 3. home_score IS NOT NULL (result data is available)
      // 4. away_score IS NOT NULL (result data is available)
      const unpushedResults = await client.query(`
        SELECT
          fixture_id,
          home_team_short,
          away_team_short,
          home_score,
          away_score
        FROM fixture_load
        WHERE fixtures_pushed = true
        AND results_pushed = false
        AND home_score IS NOT NULL
        AND away_score IS NOT NULL
      `);

      // If no results to push, return early with specific message
      if (unpushedResults.rows.length === 0) {
        throw new Error('NO_RESULTS_TO_PUSH');
      }

      const resultsData = unpushedResults.rows;

      // === STEP 2: UPDATE COMPETITION FIXTURES WITH RESULTS ===
      // For each result from fixture_load, find matching fixtures in competitions
      // and update their result field with the winning team or "DRAW"
      //
      // Match criteria:
      // - home_team_short matches
      // - away_team_short matches
      // - result IS NULL (NEVER override existing results)
      //
      // Result value logic:
      // - If home_score > away_score → result = home_team_short (home team won)
      // - If away_score > home_score → result = away_team_short (away team won)
      // - If home_score = away_score → result = "DRAW"
      let totalFixturesUpdated = 0;

      for (const resultData of resultsData) {
        // Calculate the winner or draw from the scores
        let resultValue;
        if (resultData.home_score > resultData.away_score) {
          resultValue = resultData.home_team_short;  // Home team won
        } else if (resultData.away_score > resultData.home_score) {
          resultValue = resultData.away_team_short;  // Away team won
        } else {
          resultValue = 'DRAW';  // It's a draw
        }

        // Update all matching fixtures across all competitions
        // Only updates fixtures where result is currently NULL
        const fixtureUpdateResult = await client.query(`
          UPDATE fixture
          SET result = $1
          WHERE home_team_short = $2
          AND away_team_short = $3
          AND result IS NULL
        `, [resultValue, resultData.home_team_short, resultData.away_team_short]);

        // Track how many fixtures were updated
        totalFixturesUpdated += fixtureUpdateResult.rowCount || 0;
      }

      // === STEP 3: MARK RESULTS AS PUSHED IN FIXTURE_LOAD ===
      // Now that we've successfully updated all competition fixtures,
      // mark these results as pushed in the fixture_load table
      // This prevents them from being processed again on the next run
      const markPushedResult = await client.query(`
        UPDATE fixture_load
        SET results_pushed = true, results_pushed_at = NOW()
        WHERE fixtures_pushed = true
        AND results_pushed = false
        AND home_score IS NOT NULL
        AND away_score IS NOT NULL
        RETURNING fixture_id
      `);

      const resultsMarkedPushed = markPushedResult.rows.length;

      // Return all data needed for response
      return {
        fixtures_updated: totalFixturesUpdated,
        results_marked_pushed: resultsMarkedPushed
      };
    });

    // === STEP 4: SUCCESS RESPONSE ===
    // Transaction completed successfully - send response with counts
    // Always return HTTP 200 with return_code for consistency
    res.json({
      return_code: "SUCCESS",
      fixtures_updated: result.fixtures_updated,
      results_marked_pushed: result.results_marked_pushed,
      message: `${result.fixtures_updated} result${result.fixtures_updated === 1 ? '' : 's'} pushed to competitions successfully`
    });

  } catch (error) {
    console.error('Push results error:', error);

    // === ERROR HANDLING ===
    // Handle specific business logic errors with appropriate return codes
    if (error.message === 'NO_RESULTS_TO_PUSH') {
      return res.json({
        return_code: "NO_RESULTS_TO_PUSH",
        message: "No results available to push"
      });
    }

    // Database or unexpected errors
    // Always return HTTP 200 with return_code for consistency
    res.json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;
