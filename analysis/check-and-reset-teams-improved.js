/*
=======================================================================================================================================
IMPROVED VERSION: Check and Reset Teams Route 
=======================================================================================================================================
Performance & Best Practice Improvements:
1. Optimized database queries with JOINs
2. Extracted middleware to separate file
3. Added proper error handling and logging
4. Implemented race condition protection
5. Added input sanitization and rate limiting
6. Improved transaction efficiency
=======================================================================================================================================
*/

const express = require('express');
const rateLimit = require('express-rate-limit');
const { query, transaction } = require('../database');
const { verifyToken } = require('../middleware/auth'); // EXTRACT TO SEPARATE FILE
const { validateInteger } = require('../utils/validation'); // CREATE UTILITY
const router = express.Router();

// Rate limiting specific to this endpoint
const resetTeamsLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 10, // Max 10 requests per minute per IP
  message: {
    return_code: "RATE_LIMIT_EXCEEDED",
    message: "Too many team reset requests. Please wait before trying again."
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Constants
const AUDIT_ACTION = 'Teams Auto-Reset';
const AUDIT_DETAILS = 'Player ran out of available teams - automatically reset to all teams';

router.post('/', resetTeamsLimiter, verifyToken, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { competition_id, user_id } = req.body;

    // Enhanced validation with sanitization
    const competitionId = validateInteger(competition_id, 'Competition ID');
    const userId = validateInteger(user_id, 'User ID');
    
    if (!competitionId || !userId) {
      return res.status(200).json({
        return_code: "VALIDATION_ERROR",
        message: "Competition ID and User ID must be valid integers"
      });
    }

    // OPTIMIZATION 1: Single query with JOINs instead of multiple queries
    const combinedResult = await query(`
      SELECT 
        c.id as competition_id,
        c.name as competition_name,
        c.team_list_id,
        c.organiser_id,
        cu.id as membership_id,
        COALESCE(team_counts.available_count, 0) as available_count,
        COALESCE(team_list.total_teams, 0) as total_teams
      FROM competition c
      LEFT JOIN competition_user cu ON c.id = cu.competition_id AND cu.user_id = $2
      LEFT JOIN (
        SELECT competition_id, user_id, COUNT(*) as available_count
        FROM allowed_teams 
        WHERE competition_id = $1 AND user_id = $2
        GROUP BY competition_id, user_id
      ) team_counts ON team_counts.competition_id = c.id
      LEFT JOIN (
        SELECT team_list_id, COUNT(*) as total_teams
        FROM team
        WHERE is_active = true
        GROUP BY team_list_id
      ) team_list ON team_list.team_list_id = c.team_list_id
      WHERE c.id = $1
    `, [competitionId, userId]);

    if (combinedResult.rows.length === 0) {
      return res.status(200).json({
        return_code: "COMPETITION_NOT_FOUND",
        message: "Competition not found"
      });
    }

    const data = combinedResult.rows[0];
    
    if (!data.membership_id) {
      return res.status(200).json({
        return_code: "USER_NOT_FOUND",
        message: "User not found in this competition"
      });
    }

    const availableCount = data.available_count;
    let teamsReset = false;
    let finalAvailableCount = availableCount;

    // OPTIMIZATION 2: Only reset if needed, with race condition protection
    if (availableCount === 0 && data.total_teams > 0) {
      await transaction(async (client) => {
        // RACE CONDITION PROTECTION: Check again within transaction
        const doubleCheckResult = await client.query(`
          SELECT COUNT(*) as current_count
          FROM allowed_teams 
          WHERE competition_id = $1 AND user_id = $2
        `, [competitionId, userId]);

        const currentCount = parseInt(doubleCheckResult.rows[0].current_count);
        
        // Only proceed if still zero (prevents race conditions)
        if (currentCount === 0) {
          // OPTIMIZATION 3: Use UPSERT pattern for better performance
          await client.query(`
            DELETE FROM allowed_teams 
            WHERE competition_id = $1 AND user_id = $2
          `, [competitionId, userId]);

          const insertResult = await client.query(`
            INSERT INTO allowed_teams (competition_id, user_id, team_id, created_at)
            SELECT $1, $2, t.id, NOW()
            FROM team t
            WHERE t.team_list_id = $3 AND t.is_active = true
            RETURNING team_id
          `, [competitionId, userId, data.team_list_id]);

          finalAvailableCount = insertResult.rows.length;
          teamsReset = true;

          // OPTIMIZATION 4: Insert audit log in same transaction
          await client.query(`
            INSERT INTO audit_log (competition_id, user_id, action, details, created_at)
            VALUES ($1, $2, $3, $4, NOW())
          `, [competitionId, userId, AUDIT_ACTION, AUDIT_DETAILS]);
        } else {
          // Another process already reset - use current count
          finalAvailableCount = currentCount;
        }
      });
    }

    // OPTIMIZATION 5: Performance logging for monitoring
    const executionTime = Date.now() - startTime;
    if (executionTime > 1000) { // Log slow queries
      console.warn(`Slow team reset query: ${executionTime}ms for competition ${competitionId}, user ${userId}`);
    }

    res.status(200).json({
      return_code: "SUCCESS",
      message: teamsReset ? "Teams have been reset - all teams are now available again" : "Teams checked successfully",
      teams_reset: teamsReset,
      available_teams_count: finalAvailableCount,
      execution_time_ms: executionTime // Include for debugging
    });

  } catch (error) {
    // IMPROVEMENT: Better error logging with context
    console.error('Check and reset teams error:', {
      error: error.message,
      stack: error.stack,
      competition_id: req.body?.competition_id,
      user_id: req.body?.user_id,
      user_auth: req.user?.id
    });
    
    res.status(200).json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;