/*
=======================================================================================================================================
API Route: set-fixture-result
=======================================================================================================================================
Method: POST
Purpose: Set match result for a fixture with organiser authorization and atomic transaction safety
=======================================================================================================================================
Request Payload:
{
  "fixture_id": 16,                    // integer, required - ID of fixture to set result for
  "result": "home_win"                 // string, required - Result: "home_win", "away_win", or "draw"
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Fixture result set successfully", // string, success confirmation message
  "fixture": {
    "id": 16,                          // integer, fixture database ID
    "home_team": "Arsenal",            // string, home team full name
    "away_team": "Aston Villa",        // string, away team full name  
    "home_team_short": "ARS",          // string, home team short code
    "away_team_short": "AVL",          // string, away team short code
    "result": "ARS",                   // string, winning team short code or "DRAW"
    "kickoff_time": "2025-08-26T15:00:00Z", // string, ISO datetime of kickoff
    "round_number": 1,                 // integer, round this fixture belongs to
    "competition_name": "Premier League"  // string, competition name for context
  }
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"  // string, user-friendly error description
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"      - Missing or invalid fixture_id or result parameters
"FIXTURE_NOT_FOUND"     - Fixture does not exist in database
"UNAUTHORIZED"          - Invalid JWT token or user is not competition organiser
"ROUND_NOT_LOCKED"      - Cannot set results before round lock time
"RESULT_ALREADY_SET"    - Fixture result has already been set (if business rules require)
"SERVER_ERROR"          - Database error or unexpected server failure
=======================================================================================================================================
*/

const express = require('express');
const { query, transaction } = require('../database'); // Use central database with transaction support
const { verifyToken } = require('../middleware/auth'); // Use standard verifyToken middleware
const { logApiCall } = require('../utils/apiLogger'); // API call logging utility
const router = express.Router();
// POST endpoint with comprehensive authentication, validation and atomic transaction safety
router.post('/', verifyToken, async (req, res) => {
  logApiCall('set-fixture-result');
  
  try {
    const { fixture_id, result } = req.body;
    const user_id = req.user.id; // Set by verifyToken middleware

    // STEP 1: Validate required input parameters with strict type checking
    if (!fixture_id || !Number.isInteger(fixture_id)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Fixture ID is required and must be an integer"
      });
    }

    if (!result || typeof result !== 'string' || !['home_win', 'away_win', 'draw', 'clear'].includes(result)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Result is required and must be one of: 'home_win', 'away_win', 'draw', 'clear'"
      });
    }

    // STEP 2: Use transaction wrapper to ensure atomic operations
    // This ensures that either ALL database operations succeed or ALL are rolled back
    const transactionResult = await transaction(async (client) => {
      
      // Get fixture details, verify existence, and check organiser authorization in single query
      // This optimized query joins all necessary tables to avoid N+1 query problems
      const fixtureQuery = `
        SELECT 
          f.id,
          f.home_team,
          f.away_team,
          f.home_team_short,
          f.away_team_short,
          f.kickoff_time,
          f.result as current_result,
          f.processed,
          f.round_id,
          r.competition_id,
          r.round_number,
          r.lock_time,
          c.organiser_id,
          c.name as competition_name,
          -- Get current time for lock calculation
          NOW() as current_time
        FROM fixture f
        INNER JOIN round r ON f.round_id = r.id
        INNER JOIN competition c ON r.competition_id = c.id
        WHERE f.id = $1
      `;

      const fixtureResult = await client.query(fixtureQuery, [fixture_id]);

      // Check if fixture exists
      if (fixtureResult.rows.length === 0) {
        throw {
          return_code: "FIXTURE_NOT_FOUND",
          message: "Fixture not found or has been deleted"
        };
      }

      const fixture = fixtureResult.rows[0];

      // Verify user authorization - only competition organiser can set fixture results
      if (fixture.organiser_id !== user_id) {
        throw {
          return_code: "UNAUTHORIZED",
          message: "Only the competition organiser can set fixture results"
        };
      }

      // Business rule: Can only set results after round lock time (when picks are closed)
      // This prevents results being set before all players have made their picks
      const now = new Date(fixture.current_time);
      const lockTime = new Date(fixture.lock_time);
      
      if (now < lockTime) {
        throw {
          return_code: "ROUND_NOT_LOCKED",
          message: `Cannot set fixture results before round lock time. Round locks at ${lockTime.toISOString()}`
        };
      }

      // Business rule: Cannot modify results that have already been processed
      // This prevents changing results after eliminations have been calculated
      if (fixture.processed) {
        throw {
          return_code: "RESULT_ALREADY_PROCESSED",
          message: "Cannot modify results that have already been processed"
        };
      }

      // Convert human-readable result to database storage format
      // Database stores winning team short code or "DRAW" for consistency with pick logic
      let resultString;
      if (result === 'home_win') {
        resultString = fixture.home_team_short; // Store winning team short code (e.g., "ARS")
      } else if (result === 'away_win') {
        resultString = fixture.away_team_short; // Store winning team short code (e.g., "CHE")
      } else if (result === 'draw') {
        resultString = 'DRAW'; // Store literal "DRAW" string
      } else { // result === 'clear'
        resultString = null; // Clear the result by setting to null
      }

      // Update fixture with result using atomic transaction
      const updateQuery = `
        UPDATE fixture 
        SET 
          result = $1
        WHERE id = $2
        RETURNING *
      `;
      
      const updateResult = await client.query(updateQuery, [resultString, fixture_id]);
      const updatedFixture = updateResult.rows[0];

      // Log the administrative action for audit trail (optional - only if audit_log table exists)
      // This provides transparency and accountability for result changes
      try {
        const auditQuery = `
          INSERT INTO audit_log (competition_id, user_id, action, details, created_at)
          VALUES ($1, $2, $3, $4, NOW())
        `;
        
        const auditDetails = `Set result for ${fixture.home_team} vs ${fixture.away_team} in Round ${fixture.round_number}: ${resultString}`;
        
        await client.query(auditQuery, [
          fixture.competition_id,
          user_id,
          'FIXTURE_RESULT_SET',
          auditDetails
        ]);
      } catch (auditError) {
        // If audit logging fails, we don't want to rollback the main operation
        // Just log the error and continue (audit is nice-to-have, not critical)
        console.warn('Audit logging failed for fixture result:', {
          fixture_id,
          error: auditError.message,
          user_id,
          timestamp: new Date().toISOString()
        });
      }

      // Return comprehensive fixture information for frontend display
      return {
        return_code: "SUCCESS",
        message: "Fixture result set successfully",
        fixture: {
          id: updatedFixture.id,
          home_team: updatedFixture.home_team,
          away_team: updatedFixture.away_team,
          home_team_short: updatedFixture.home_team_short,
          away_team_short: updatedFixture.away_team_short,
          result: updatedFixture.result,
          kickoff_time: updatedFixture.kickoff_time,
          round_number: fixture.round_number,
          competition_name: fixture.competition_name
        }
      };
    });

    // Return transaction result with HTTP 200 status as per API standards
    return res.json(transactionResult);

  } catch (error) {
    // Handle custom business logic errors (thrown from transaction)
    if (error.return_code) {
      return res.json({
        return_code: error.return_code,
        message: error.message
      });
    }

    // Log detailed error information for debugging while protecting sensitive data
    console.error('Set fixture result error:', {
      error: error.message,
      stack: error.stack?.substring(0, 500), // Truncate stack trace
      fixture_id: req.body?.fixture_id,
      result: req.body?.result,
      user_id: req.user?.id,
      timestamp: new Date().toISOString()
    });
    
    // Return standardized server error response with HTTP 200
    return res.json({
      return_code: "SERVER_ERROR", 
      message: "Failed to set fixture result"
    });
  }
});

module.exports = router;