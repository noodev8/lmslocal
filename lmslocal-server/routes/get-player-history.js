/*
=======================================================================================================================================
API Route: get-player-history
=======================================================================================================================================
Method: POST
Purpose: Fetch complete pick history for a single player in a competition. Used when user clicks "View Full History" modal.
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123,               // integer, required - Competition ID
  "player_id": 456                     // integer, required - Player user ID to fetch history for
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "player": {
    "id": 456,                         // integer, player user ID
    "display_name": "John Doe",        // string, player display name
    "lives_remaining": 1,              // integer, current lives remaining
    "status": "active"                 // string, player status (active/out)
  },
  "history": [                         // array, complete pick history (all rounds)
    {
      "round_id": 789,                 // integer, round ID for unique keys
      "round_number": 3,               // integer, round number
      "pick_team": "MCI",              // string, team short code picked
      "pick_team_full_name": "Man City", // string, full team name for display
      "fixture": "Man City vs Arsenal", // string, fixture description
      "fixture_result": "2-1",         // string, match result (null if not played)
      "pick_result": "win",            // string, pick outcome: win/loss/pending/loss(no_pick)
      "lock_time": "2025-01-15T15:00:00Z" // string, when round locked
    }
  ]
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "MISSING_FIELDS",
  "message": "competition_id and player_id are required"
}

{
  "return_code": "COMPETITION_NOT_FOUND",
  "message": "Competition not found"
}

{
  "return_code": "PLAYER_NOT_FOUND",
  "message": "Player not found in this competition"
}

{
  "return_code": "UNAUTHORIZED",
  "message": "You do not have access to this competition"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"MISSING_FIELDS"
"COMPETITION_NOT_FOUND"
"PLAYER_NOT_FOUND"
"UNAUTHORIZED"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../database');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  try {
    // Extract request parameters and authenticated user
    const { competition_id, player_id } = req.body;
    const user_id = req.user.id;

    // ========================================
    // STEP 1: VALIDATE INPUT
    // ========================================
    if (!competition_id || !player_id) {
      return res.status(200).json({
        return_code: "MISSING_FIELDS",
        message: "competition_id and player_id are required"
      });
    }

    // Parse to integers for safety
    const competition_id_int = parseInt(competition_id);
    const player_id_int = parseInt(player_id);

    if (isNaN(competition_id_int) || isNaN(player_id_int)) {
      return res.status(200).json({
        return_code: "MISSING_FIELDS",
        message: "competition_id and player_id must be valid numbers"
      });
    }

    // ========================================
    // STEP 2: VERIFY USER ACCESS TO COMPETITION
    // ========================================
    // User must be either a participant OR organizer of this competition
    const accessCheck = await query(`
      SELECT
        c.id as competition_id,
        c.organiser_id,
        cu.user_id as is_participant
      FROM competition c
      LEFT JOIN competition_user cu ON cu.competition_id = c.id AND cu.user_id = $1
      WHERE c.id = $2
    `, [user_id, competition_id_int]);

    // Check if competition exists
    if (accessCheck.rows.length === 0) {
      return res.status(200).json({
        return_code: "COMPETITION_NOT_FOUND",
        message: "Competition not found"
      });
    }

    const comp = accessCheck.rows[0];
    const isOrganiser = comp.organiser_id === user_id;
    const isParticipant = comp.is_participant !== null;
    const hasAccess = isOrganiser || isParticipant;

    // Verify user has access to view standings
    if (!hasAccess) {
      return res.status(200).json({
        return_code: "UNAUTHORIZED",
        message: "You do not have access to this competition"
      });
    }

    // ========================================
    // STEP 3: GET PLAYER INFO
    // ========================================
    const playerResult = await query(`
      SELECT
        u.id,
        u.display_name,
        cu.lives_remaining,
        cu.status
      FROM competition_user cu
      JOIN app_user u ON u.id = cu.user_id
      WHERE cu.competition_id = $1 AND cu.user_id = $2
    `, [competition_id_int, player_id_int]);

    // Check if player exists in this competition
    if (playerResult.rows.length === 0) {
      return res.status(200).json({
        return_code: "PLAYER_NOT_FOUND",
        message: "Player not found in this competition"
      });
    }

    const player = playerResult.rows[0];

    // ========================================
    // STEP 4: GET COMPLETE PICK HISTORY FOR THIS PLAYER
    // ========================================
    // Fetch rounds where player actually participated (has pick or player_progress entry)
    // This prevents showing "No Pick" for rounds after elimination
    const historyResult = await query(`
      SELECT DISTINCT
        -- === ROUND INFO ===
        r.id as round_id,
        r.round_number,
        r.lock_time,

        -- === PICK INFO ===
        p.team as pick_team,
        p.outcome,
        t.name as pick_team_full_name,

        -- === FIXTURE INFO ===
        f.home_team,
        f.away_team,
        f.result as fixture_result

      FROM round r
      LEFT JOIN pick p ON p.round_id = r.id AND p.user_id = $2
      LEFT JOIN team t ON t.short_name = p.team AND t.is_active = true
      LEFT JOIN fixture f ON p.fixture_id = f.id
      WHERE r.competition_id = $1
        AND r.round_number IS NOT NULL
        AND (
          -- Only include rounds where player has a pick
          p.id IS NOT NULL
          OR
          -- Or where player has a player_progress entry (participated in that round)
          EXISTS (
            SELECT 1 FROM player_progress pp
            WHERE pp.round_id = r.id
              AND pp.player_id = $2
              AND pp.competition_id = $1
          )
        )
      ORDER BY r.round_number DESC
    `, [competition_id_int, player_id_int]);

    // ========================================
    // STEP 5: FORMAT HISTORY DATA
    // ========================================
    const history = historyResult.rows.map(round => ({
      round_id: round.round_id,
      round_number: round.round_number,
      pick_team: round.pick_team,
      pick_team_full_name: round.pick_team_full_name || round.pick_team, // Full name with fallback to short
      fixture: round.home_team && round.away_team
        ? `${round.home_team} vs ${round.away_team}`
        : null,
      fixture_result: round.fixture_result,
      pick_result: round.outcome === 'WIN' ? 'win' :
                  round.outcome === 'LOSE' ? 'loss' :
                  round.outcome === 'NO_PICK' ? 'loss' :
                  !round.pick_team ? 'loss' : 'pending', // Map outcomes to display format
      lock_time: round.lock_time
    }));

    // ========================================
    // STEP 6: RETURN SUCCESS RESPONSE
    // ========================================
    return res.status(200).json({
      return_code: "SUCCESS",
      player: {
        id: player.id,
        display_name: player.display_name,
        lives_remaining: player.lives_remaining,
        status: player.status
      },
      history: history
    });

  } catch (error) {
    // ========================================
    // ERROR HANDLING
    // ========================================
    console.error('Get player history error:', error);
    return res.status(200).json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;
