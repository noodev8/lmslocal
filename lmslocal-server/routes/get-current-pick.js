/*
=======================================================================================================================================
API Route: get-current-pick
=======================================================================================================================================
Method: POST
Purpose: Retrieves player's current pick for a specific round with authorization validation and fixture context
=======================================================================================================================================
Request Payload:
{
  "round_id": 5,                               // integer, required - ID of the round to get pick for
  "user_id": 123                               // integer, optional - ID of user to check (admin feature)
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "pick": {                                    // object, player's pick details or null if no pick made
    "team": "AVL",                             // string, short team name that was picked
    "team_full_name": "Aston Villa",           // string, full team name for display
    "fixture_id": 15,                          // integer, ID of the fixture containing the picked team
    "fixture": "Aston Villa v Manchester City", // string, fixture description for display
    "created_at": "2025-08-28T12:00:00Z"       // string, ISO datetime when pick was made
  }
}

No Pick Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "pick": null                                 // null, indicates no pick has been made for this round
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"       // string, user-friendly error description
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"UNAUTHORIZED"
"ROUND_NOT_FOUND"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../database');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');
const router = express.Router();
router.post('/', verifyToken, async (req, res) => {
  logApiCall('get-current-pick');
  
  try {
    // Extract request parameters and authenticated user ID
    const { round_id, user_id: requested_user_id } = req.body;
    const authenticated_user_id = req.user.id;

    // === INPUT VALIDATION ===
    // Validate round_id is provided and is a valid integer
    if (!round_id || !Number.isInteger(round_id)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Round ID is required and must be a number"
      });
    }

    // Determine target user: use requested user_id if provided (admin feature), otherwise authenticated user
    const target_user_id = requested_user_id || authenticated_user_id;

    // === SINGLE COMPREHENSIVE QUERY WITH AUTHORIZATION ===
    // This secure query performs multiple operations in one efficient database call:
    // 1. Validates user has access to the round (either as participant or organiser)
    // 2. Gets pick details with complete fixture context
    // 3. Includes team full names for rich display information
    // Prevents unauthorized access to picks from competitions user doesn't belong to
    const result = await query(`
      SELECT 
        -- === AUTHORIZATION INFO ===
        c.id as competition_id,               -- Competition identifier for validation
        c.organiser_id,                       -- Competition organiser (for admin permission check)
        c.name as competition_name,           -- Competition name for audit purposes
        r.round_number,                       -- Round number for display context
        
        -- === PICK DETAILS (IF EXISTS) ===
        p.team,                               -- Short team name that was picked (e.g., "AVL")
        p.fixture_id,                         -- ID of fixture containing the picked team
        p.created_at as pick_created_at,      -- When pick was made (ISO datetime)
        
        -- === TEAM AND FIXTURE CONTEXT ===
        t.name as team_full_name,             -- Full team name for display (e.g., "Aston Villa")
        f.home_team,                          -- Home team in picked fixture
        f.away_team,                          -- Away team in picked fixture
        f.kickoff_time,                       -- When fixture kicks off (for context)
        
        -- === USER ACCESS VALIDATION ===
        CASE 
          WHEN cu.user_id IS NOT NULL THEN true -- User participates in competition
          WHEN c.organiser_id = $2 THEN true     -- User is organiser (admin access)
          ELSE false                             -- User has no access
        END as has_access
        
      FROM round r
      INNER JOIN competition c ON r.competition_id = c.id
      
      -- === USER ACCESS CHECK ===
      -- Verify user either participates in competition OR is the organiser
      LEFT JOIN competition_user cu ON c.id = cu.competition_id 
                                    AND cu.user_id = $2 
                                    AND cu.user_id = $3  -- Only check access for authenticated user
      
      -- === PICK DATA (TARGET USER SPECIFIC) ===
      -- Get pick made by target user (could be different from authenticated user for admin feature)
      LEFT JOIN pick p ON r.id = p.round_id AND p.user_id = $3
      
      -- === TEAM DETAILS ===
      -- Get full team name for display purposes
      LEFT JOIN team t ON p.team = t.short_name AND t.is_active = true
      
      -- === FIXTURE CONTEXT ===
      -- Get complete fixture information for the picked team
      LEFT JOIN fixture f ON p.fixture_id = f.id
      
      WHERE r.id = $1                         -- Filter to requested round only
    `, [round_id, authenticated_user_id, target_user_id]);

    // === AUTHORIZATION VALIDATION ===
    // Check if round exists and user has permission to access it
    if (result.rows.length === 0) {
      return res.json({
        return_code: "ROUND_NOT_FOUND",
        message: "Round not found or access denied"
      });
    }

    const roundData = result.rows[0];

    // Verify user has access to this round's picks
    if (!roundData.has_access) {
      return res.json({
        return_code: "UNAUTHORIZED",
        message: "You don't have permission to view picks for this round"
      });
    }

    // === ADMIN PERMISSION CHECK ===
    // If requesting another user's pick, verify admin permissions
    if (requested_user_id && requested_user_id !== authenticated_user_id) {
      if (roundData.organiser_id !== authenticated_user_id) {
        return res.json({
          return_code: "UNAUTHORIZED",
          message: "Only competition organiser can view other players' picks"
        });
      }
    }

    // === PICK RESPONSE FORMATTING ===
    // Build pick object with complete context or null if no pick made
    let pick = null;
    if (roundData.team) {
      pick = {
        team: roundData.team,                               // Short team name for API consistency
        team_full_name: roundData.team_full_name,           // Full team name for rich display
        fixture_id: roundData.fixture_id,                   // For additional fixture operations
        fixture: `${roundData.home_team} v ${roundData.away_team}`, // Human-readable fixture description
        created_at: roundData.pick_created_at               // ISO datetime when pick was made
      };
    }

    // === SUCCESS RESPONSE ===
    // Return pick data with complete context or null if no pick made
    res.json({
      return_code: "SUCCESS",
      pick: pick                              // Complete pick object or null
    });

  } catch (error) {
    // === ERROR HANDLING ===
    // Log detailed error for debugging but return generic message to client for security
    console.error('Get current pick error:', error);
    res.json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;