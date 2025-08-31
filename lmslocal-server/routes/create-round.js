/*
=======================================================================================================================================
API Route: create-round
=======================================================================================================================================
Method: POST
Purpose: Creates a new round for a specific competition (organiser only)
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123,                 // integer, required - ID of the competition
  "lock_time": "2025-08-25T14:00:00Z"    // string, required - ISO datetime when picks lock
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Round created successfully",         // string, success message
  "round": {
    "id": 1,                            // integer, unique round ID
    "round_number": 1,                  // integer, sequential round number
    "lock_time": "2025-08-25T14:00:00Z", // string, ISO datetime when picks lock
    "status": "LOCKED",                 // string, round status
    "created_at": "2025-08-23T10:00:00Z" // string, ISO datetime when round created
  }
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"          // string, user-friendly error description
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR" 
"UNAUTHORIZED"
"COMPETITION_NOT_FOUND"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { transaction } = require('../database');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  try {
    const { competition_id, lock_time } = req.body;
    const user_id = req.user.id;

    // Basic validation
    if (!competition_id || !Number.isInteger(competition_id)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Competition ID is required and must be a number"
      });
    }

    if (!lock_time) {
      return res.json({
        return_code: "VALIDATION_ERROR", 
        message: "Lock time is required"
      });
    }

    // Execute all operations in a single atomic transaction
    const result = await transaction(async (client) => {
      
      // 1. Verify competition exists, get organiser and team list (with row lock to prevent race conditions)
      const competitionResult = await client.query(`
        SELECT organiser_id, name, team_list_id 
        FROM competition 
        WHERE id = $1 
        FOR UPDATE
      `, [competition_id]);

      if (competitionResult.rows.length === 0) {
        throw new Error('COMPETITION_NOT_FOUND');
      }

      const competition = competitionResult.rows[0];

      // 2. Verify user is the organiser
      if (competition.organiser_id !== user_id) {
        throw new Error('UNAUTHORIZED');
      }

      // 3. Create round with atomic round number generation (prevents race conditions)
      const roundResult = await client.query(`
        INSERT INTO round (
          competition_id,
          round_number,
          lock_time,
          created_at
        )
        SELECT 
          $1,
          COALESCE(MAX(r.round_number), 0) + 1,
          $2,
          CURRENT_TIMESTAMP
        FROM competition c
        LEFT JOIN round r ON r.competition_id = c.id
        WHERE c.id = $1
        GROUP BY c.id
        RETURNING *
      `, [competition_id, lock_time]);

      const round = roundResult.rows[0];

      // 4. Create audit log entry (same transaction ensures consistency)
      await client.query(`
        INSERT INTO audit_log (competition_id, user_id, action, details)
        VALUES ($1, $2, 'Round Created', $3)
      `, [
        competition_id,
        user_id,
        `Created Round ${round.round_number} for "${competition.name}" with lock time ${lock_time}`
      ]);

      // 5. Auto-reset teams for players with no remaining teams (atomic with round creation)
      if (competition.team_list_id) {
        
        // Insert all active teams for players who have zero allowed_teams
        const teamResetResult = await client.query(`
          INSERT INTO allowed_teams (competition_id, user_id, team_id, created_at)
          SELECT $1, cu.user_id, t.id, NOW()
          FROM competition_user cu
          CROSS JOIN team t
          WHERE cu.competition_id = $1 
          AND cu.status = 'active'
          AND t.team_list_id = $2
          AND t.is_active = true
          AND NOT EXISTS (
            SELECT 1 FROM allowed_teams at 
            WHERE at.competition_id = $1 AND at.user_id = cu.user_id
          )
          RETURNING user_id
        `, [competition_id, competition.team_list_id]);

        // Log team resets for affected players
        if (teamResetResult.rows.length > 0) {
          const uniqueUserIds = [...new Set(teamResetResult.rows.map(row => row.user_id))];
          
          for (const userId of uniqueUserIds) {
            // Get user display name for audit log
            const userResult = await client.query(
              'SELECT display_name FROM app_user WHERE id = $1',
              [userId]
            );
            
            const displayName = userResult.rows[0]?.display_name || `User ${userId}`;
            
            await client.query(`
              INSERT INTO audit_log (competition_id, user_id, action, details)
              VALUES ($1, $2, 'Teams Auto-Reset', $3)
            `, [
              competition_id,
              userId,
              `Teams automatically reset for ${displayName} at start of Round ${round.round_number}`
            ]);
          }

          console.log(`Auto-reset teams for ${uniqueUserIds.length} players in competition ${competition_id} for Round ${round.round_number}`);
        }
      }

      // Return all data needed for response
      return {
        round,
        competition_name: competition.name
      };
    });

    // Transaction completed successfully - send response
    res.json({
      return_code: "SUCCESS",
      message: "Round created successfully",
      round: {
        id: result.round.id,
        round_number: result.round.round_number,
        lock_time: result.round.lock_time,
        status: result.round.status,
        created_at: result.round.created_at
      }
    });

  } catch (error) {
    console.error('Create round error:', error);
    
    // Handle specific business logic errors with appropriate return codes
    if (error.message === 'COMPETITION_NOT_FOUND') {
      return res.json({
        return_code: "COMPETITION_NOT_FOUND",
        message: "Competition not found"
      });
    }
    
    if (error.message === 'UNAUTHORIZED') {
      return res.json({
        return_code: "UNAUTHORIZED", 
        message: "Only the competition organiser can create rounds"
      });
    }

    // Database or unexpected errors
    res.json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;