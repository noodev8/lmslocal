/*
=======================================================================================================================================
API Route: get-dashboard-stats
=======================================================================================================================================
Method: POST
Purpose: Retrieves comprehensive dashboard statistics for a competition including player status, pick completion, and round information.
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123                // integer, required - Competition ID to get stats for
}

Success Response:
{
  "return_code": "SUCCESS",
  "data": {
    "competition_info": {
      "total_players": 40,               // integer, total registered players
      "current_round": {
        "round_number": 12,              // integer, current active round
        "round_id": 45,                  // integer, round database ID
        "lock_time": "2024-01-15T15:00:00Z", // string, when picks lock
        "is_locked": false               // boolean, whether picks are currently locked
      }
    },
    "player_status": {
      "still_active": 24,                // integer, players still in competition
      "eliminated": 16,                  // integer, eliminated players
      "completion_percentage": 60.0,     // number, percentage still active
      "total_registered": 40             // integer, total players who joined
    },
    "pick_status": {
      "picks_made": 18,                  // integer, picks made for current round
      "picks_required": 24,              // integer, picks needed (active players)
      "completion_percentage": 75.0,     // number, percentage of picks completed
      "missing_picks_count": 6           // integer, how many players haven't picked
    }
  }
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"MISSING_FIELDS"
"COMPETITION_NOT_FOUND"
"UNAUTHORIZED"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { query, transaction } = require('../database');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');

const router = express.Router();

/**
 * POST /get-dashboard-stats
 * Retrieves comprehensive dashboard statistics for a competition
 */
router.post('/', verifyToken, async (req, res) => {
  // Log API call if enabled
  logApiCall('get-dashboard-stats');
  
  try {
    // Extract and validate request data
    const { competition_id } = req.body;

    // Validate required fields
    if (!competition_id) {
      return res.status(200).json({
        return_code: 'MISSING_FIELDS',
        message: 'Competition ID is required'
      });
    }

    // Validate competition_id is a number
    const competitionId = parseInt(competition_id);
    if (isNaN(competitionId)) {
      return res.status(200).json({
        return_code: 'MISSING_FIELDS',
        message: 'Competition ID must be a valid number'
      });
    }

    // Execute all queries in a transaction for consistency
    const result = await transaction(async (client) => {
      // 1. Verify competition exists and user has access
      const competitionResult = await client.query(
        `SELECT id, name, status, organiser_id, lives_per_player
         FROM competition 
         WHERE id = $1`,
        [competitionId]
      );

      if (competitionResult.rows.length === 0) {
        return { error: 'COMPETITION_NOT_FOUND' };
      }

      const competition = competitionResult.rows[0];

      // Verify user is the organiser (basic authorization)
      if (competition.organiser_id !== req.user.id) {
        return { error: 'UNAUTHORIZED' };
      }

      // 2. Get current round information
      const currentRoundResult = await client.query(
        `SELECT id, round_number, lock_time,
                CASE 
                  WHEN lock_time IS NULL THEN false
                  WHEN lock_time <= NOW() THEN true
                  ELSE false
                END as is_locked
         FROM round 
         WHERE competition_id = $1 
         ORDER BY round_number DESC 
         LIMIT 1`,
        [competitionId]
      );

      let currentRound = null;
      if (currentRoundResult.rows.length > 0) {
        const round = currentRoundResult.rows[0];
        currentRound = {
          round_id: round.id,
          round_number: round.round_number,
          lock_time: round.lock_time,
          is_locked: round.is_locked
        };
      }

      // 3. Get total registered players count will be updated from competition_user query
      let totalPlayers = 0;

      // 4. Get player status breakdown (active vs eliminated) using competition_user status
      const playerStatusResult = await client.query(
        `SELECT 
           COUNT(*) FILTER (WHERE status = 'active') as still_active,
           COUNT(*) FILTER (WHERE status = 'OUT') as eliminated
         FROM competition_user
         WHERE competition_id = $1`,
        [competitionId]
      );

      let stillActive = 0;
      let eliminated = 0;

      if (playerStatusResult.rows.length > 0) {
        stillActive = parseInt(playerStatusResult.rows[0].still_active) || 0;
        eliminated = parseInt(playerStatusResult.rows[0].eliminated) || 0;
      }
      
      // Calculate total players in memory (more efficient)
      totalPlayers = stillActive + eliminated;

      // 5. Get pick completion status for current round
      let picksMade = 0;
      let picksRequired = stillActive; // Only active players need to make picks
      
      if (currentRound) {
        const pickStatusResult = await client.query(
          `SELECT COUNT(*) as picks_made
           FROM pick p
           WHERE p.round_id = $1`,
          [currentRound.round_id]
        );
        
        picksMade = parseInt(pickStatusResult.rows[0].picks_made) || 0;
      }

      // Calculate percentages
      const playerCompletionPercentage = totalPlayers > 0 ? (stillActive / totalPlayers) * 100 : 0;
      const pickCompletionPercentage = picksRequired > 0 ? (picksMade / picksRequired) * 100 : 0;

      // Return comprehensive dashboard data
      return {
        competition_info: {
          total_players: totalPlayers,
          current_round: currentRound
        },
        player_status: {
          still_active: stillActive,
          eliminated: eliminated,
          completion_percentage: Math.round(playerCompletionPercentage * 10) / 10, // Round to 1 decimal
          total_registered: totalPlayers
        },
        pick_status: {
          picks_made: picksMade,
          picks_required: picksRequired,
          completion_percentage: Math.round(pickCompletionPercentage * 10) / 10, // Round to 1 decimal
          missing_picks_count: Math.max(0, picksRequired - picksMade)
        }
      };
    });

    // Check for errors returned from transaction
    if (result && result.error) {
      if (result.error === 'COMPETITION_NOT_FOUND') {
        return res.status(200).json({
          return_code: 'COMPETITION_NOT_FOUND',
          message: 'Competition not found'
        });
      }
      if (result.error === 'UNAUTHORIZED') {
        return res.status(200).json({
          return_code: 'UNAUTHORIZED',
          message: 'You do not have permission to access this competition'
        });
      }
    }

    // Return success response
    return res.status(200).json({
      return_code: 'SUCCESS',
      data: result
    });

  } catch (error) {
    console.error('Error in get-dashboard-stats:', error);

    // Handle specific error types
    if (error.message === 'COMPETITION_NOT_FOUND') {
      return res.status(200).json({
        return_code: 'COMPETITION_NOT_FOUND',
        message: 'Competition not found'
      });
    }

    if (error.message === 'UNAUTHORIZED') {
      return res.status(200).json({
        return_code: 'UNAUTHORIZED',
        message: 'You do not have permission to access this competition'
      });
    }

    // Generic server error
    return res.status(200).json({
      return_code: 'SERVER_ERROR',
      message: 'An error occurred while retrieving dashboard statistics'
    });
  }
});

module.exports = router;