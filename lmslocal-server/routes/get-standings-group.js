/*
=======================================================================================================================================
API Route: get-standings-group
=======================================================================================================================================
Method: POST
Purpose: Returns detailed player list for a specific standings group with pagination
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123,                  // integer, required - ID of the competition
  "group_key": "2_picked",                // string, required - Group identifier from summary API
  "page": 1,                              // integer, optional - Page number (default: 1)
  "page_size": 20                         // integer, optional - Players per page (default: 20, max: 50)
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "group": {
    "key": "2_picked",                    // string, group identifier
    "name": "In Contention (2 lives, picked)" // string, display name
  },
  "pagination": {
    "current_page": 1,                    // integer, current page
    "page_size": 20,                      // integer, players per page
    "total_players": 15,                  // integer, total players in this group
    "total_pages": 1                      // integer, total pages
  },
  "players": [
    {
      "id": 456,                          // integer, player user ID
      "display_name": "John Doe",         // string, player name
      "lives_remaining": 2,               // integer, remaining lives
      "status": "active",                 // string, player status
      "current_pick": {                   // object|null, current round pick
        "team": "CHE",                    // string, team short code
        "team_full_name": "Chelsea",      // string, full team name
        "fixture": "Chelsea vs Arsenal",  // string, fixture description
        "outcome": "pending"              // string, outcome: "pending", "WIN", "LOSE", "NO_PICK"
      },
      "elimination_pick": null            // object|null, only for eliminated players
    }
  ]
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"MISSING_FIELDS"
"INVALID_GROUP"             - Group key not recognized
"COMPETITION_NOT_FOUND"
"UNAUTHORIZED"              - User is not a participant
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../database');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  logApiCall('get-standings-group');

  try {
    const { competition_id, group_key, page = 1, page_size = 20 } = req.body;
    const user_id = req.user.id;

    // ========================================
    // STEP 1: VALIDATE REQUEST
    // ========================================

    if (!competition_id || !Number.isInteger(competition_id)) {
      return res.status(200).json({
        return_code: "MISSING_FIELDS",
        message: "competition_id is required and must be an integer"
      });
    }

    if (!group_key || typeof group_key !== 'string') {
      return res.status(200).json({
        return_code: "MISSING_FIELDS",
        message: "group_key is required and must be a string"
      });
    }

    // Validate pagination
    const currentPage = Math.max(1, parseInt(page) || 1);
    const itemsPerPage = Math.min(50, Math.max(1, parseInt(page_size) || 20));
    const offset = (currentPage - 1) * itemsPerPage;

    // ========================================
    // STEP 2: VERIFY COMPETITION EXISTS AND USER ACCESS
    // ========================================

    const competitionResult = await query(`
      SELECT
        c.id,
        c.name,
        c.organiser_id,
        cu.status as user_status
      FROM competition c
      LEFT JOIN competition_user cu ON c.id = cu.competition_id AND cu.user_id = $2
      WHERE c.id = $1
    `, [competition_id, user_id]);

    if (competitionResult.rows.length === 0) {
      return res.status(200).json({
        return_code: "COMPETITION_NOT_FOUND",
        message: "Competition not found"
      });
    }

    const competition = competitionResult.rows[0];

    // Verify user is a participant OR organizer
    const isOrganizer = competition.organiser_id === user_id;
    if (!competition.user_status && !isOrganizer) {
      return res.status(200).json({
        return_code: "UNAUTHORIZED",
        message: "You are not a participant in this competition"
      });
    }

    // ========================================
    // STEP 3: GET CURRENT ROUND INFO
    // ========================================

    const roundResult = await query(`
      SELECT
        id,
        round_number,
        lock_time
      FROM round
      WHERE competition_id = $1
      ORDER BY round_number DESC
      LIMIT 1
    `, [competition_id]);

    let currentRound = null;
    let isRoundLocked = false;

    if (roundResult.rows.length > 0) {
      currentRound = roundResult.rows[0];
      const now = new Date();
      const lockTime = new Date(currentRound.lock_time);
      isRoundLocked = now >= lockTime;
    }

    // ========================================
    // STEP 4: PARSE GROUP KEY AND BUILD QUERY
    // ========================================

    let groupName = "";
    let whereClause = "";
    let queryParams = [competition_id];
    let paramIndex = 2;

    if (group_key === "eliminated") {
      // Eliminated group
      groupName = "Eliminated";
      whereClause = "cu.status = 'out'";
    } else {
      // Parse group key (e.g., "2_picked", "3_not_picked", "2", "1")
      const parts = group_key.split('_');

      if (parts.length === 1) {
        // Just lives (between rounds mode): "2", "1", "0"
        const lives = parseInt(parts[0]);
        if (isNaN(lives)) {
          return res.status(200).json({
            return_code: "INVALID_GROUP",
            message: "Invalid group key format"
          });
        }

        whereClause = `cu.status = 'active' AND cu.lives_remaining = $${paramIndex}`;
        queryParams.push(lives);
        paramIndex++;

        const livesLabel = `${lives} ${lives === 1 ? 'life' : 'lives'}`;
        groupName = livesLabel;

      } else if (parts.length === 2) {
        // Lives + fixture status (mid-round mode): "2_played", "3_pending", "2_no_pick"
        const lives = parseInt(parts[0]);
        const fixtureStatus = parts[1]; // "played", "pending", or "no_pick"

        if (isNaN(lives) || !['played', 'pending', 'no_pick'].includes(fixtureStatus)) {
          return res.status(200).json({
            return_code: "INVALID_GROUP",
            message: "Invalid group key format"
          });
        }

        whereClause = `cu.status = 'active' AND cu.lives_remaining = $${paramIndex}`;
        queryParams.push(lives);
        paramIndex++;

        // Add fixture status condition
        if (fixtureStatus === 'played') {
          whereClause += ` AND p.id IS NOT NULL AND f.result IS NOT NULL`;
        } else if (fixtureStatus === 'pending') {
          whereClause += ` AND p.id IS NOT NULL AND f.result IS NULL`;
        } else {
          // no_pick
          whereClause += ` AND p.id IS NULL`;
        }

        const livesLabel = `${lives} ${lives === 1 ? 'life' : 'lives'}`;
        const statusLabel = fixtureStatus === 'played' ? 'Game Played' : fixtureStatus === 'pending' ? 'Game Pending' : 'No Pick';

        groupName = `${livesLabel}, ${statusLabel}`;

      } else {
        return res.status(200).json({
          return_code: "INVALID_GROUP",
          message: "Invalid group key format"
        });
      }
    }

    // ========================================
    // STEP 5: GET TOTAL COUNT FOR PAGINATION
    // ========================================

    let countQuery;
    if (currentRound) {
      countQuery = `
        SELECT COUNT(*) as total
        FROM competition_user cu
        LEFT JOIN pick p ON p.user_id = cu.user_id AND p.round_id = $${paramIndex}
        LEFT JOIN fixture f ON p.fixture_id = f.id
        WHERE cu.competition_id = $1 AND ${whereClause}
      `;
      queryParams.push(currentRound.id);
    } else {
      countQuery = `
        SELECT COUNT(*) as total
        FROM competition_user cu
        LEFT JOIN pick p ON p.user_id = cu.user_id AND p.round_id IS NULL
        LEFT JOIN fixture f ON p.fixture_id = f.id
        WHERE cu.competition_id = $1 AND ${whereClause}
      `;
    }

    const countResult = await query(countQuery, queryParams);
    const totalPlayers = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalPlayers / itemsPerPage);

    // ========================================
    // STEP 6: GET PLAYERS FOR THIS GROUP (PAGINATED)
    // ========================================

    // Reset query params for player query
    queryParams = [competition_id];
    paramIndex = 2;

    // Rebuild params for main query
    if (group_key !== "eliminated") {
      const parts = group_key.split('_');
      if (parts.length >= 1) {
        queryParams.push(parseInt(parts[0])); // lives
        paramIndex++;
      }
    }

    let roundParamIndex = null;
    if (currentRound) {
      roundParamIndex = paramIndex;
      queryParams.push(currentRound.id);
      paramIndex++;
    }

    const limitParamIndex = paramIndex;
    queryParams.push(itemsPerPage);
    const offsetParamIndex = paramIndex + 1;
    queryParams.push(offset);

    // Build the pick join clause based on whether we have a round
    const pickJoinClause = currentRound
      ? `LEFT JOIN pick p ON p.user_id = cu.user_id AND p.round_id = $${roundParamIndex}`
      : `LEFT JOIN pick p ON p.user_id = cu.user_id AND p.round_id IS NULL`;

    const playersQuery = `
      SELECT
        cu.user_id as id,
        cu.player_display_name as display_name,
        cu.lives_remaining,
        cu.status,

        -- Current pick info
        p.team as pick_team,
        t.name as pick_team_full_name,
        CONCAT(
          COALESCE(t_home.name, f.home_team_short), ' vs ',
          COALESCE(t_away.name, f.away_team_short)
        ) as pick_fixture,
        CASE
          WHEN p.outcome IS NOT NULL THEN p.outcome
          WHEN p.id IS NULL THEN 'NO_PICK'
          ELSE 'pending'
        END as pick_outcome,

        -- Elimination info (for eliminated players only)
        pp_elim.round_id as elim_round_id,
        r_elim.round_number as elim_round_number,
        pp_elim.chosen_team as elim_team,
        CONCAT(
          COALESCE(t_home_elim.name, f_elim.home_team_short), ' vs ',
          COALESCE(t_away_elim.name, f_elim.away_team_short)
        ) as elim_fixture,
        f_elim.result as elim_result

      FROM competition_user cu
      INNER JOIN app_user au ON cu.user_id = au.id
      ${pickJoinClause}
      LEFT JOIN team t ON p.team = t.short_name
      LEFT JOIN fixture f ON p.fixture_id = f.id
      LEFT JOIN team t_home ON f.home_team_short = t_home.short_name
      LEFT JOIN team t_away ON f.away_team_short = t_away.short_name

      -- Elimination info subquery (only for eliminated players)
      LEFT JOIN player_progress pp_elim ON cu.user_id = pp_elim.player_id
        AND cu.competition_id = pp_elim.competition_id
        AND pp_elim.outcome = 'LOSE'
        AND pp_elim.round_id = (
          SELECT MAX(round_id) FROM player_progress
          WHERE player_id = cu.user_id AND competition_id = cu.competition_id
        )
      LEFT JOIN round r_elim ON pp_elim.round_id = r_elim.id
      LEFT JOIN fixture f_elim ON pp_elim.fixture_id = f_elim.id
      LEFT JOIN team t_home_elim ON f_elim.home_team_short = t_home_elim.short_name
      LEFT JOIN team t_away_elim ON f_elim.away_team_short = t_away_elim.short_name

      WHERE cu.competition_id = $1 AND ${whereClause}
      ORDER BY cu.player_display_name ASC
      LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
    `;

    const playersResult = await query(playersQuery, queryParams);

    // Format players
    const players = playersResult.rows.map(row => {
      const player = {
        id: row.id,
        display_name: row.display_name,
        lives_remaining: row.lives_remaining,
        status: row.status,
        current_pick: null,
        elimination_pick: null
      };

      // Add current pick if exists and round is locked OR it's the user's own pick
      const canSeePick = isRoundLocked || row.id === user_id;
      if (canSeePick && row.pick_outcome !== 'NO_PICK' && row.pick_team) {
        player.current_pick = {
          team: row.pick_team,
          team_full_name: row.pick_team_full_name,
          fixture: row.pick_fixture,
          outcome: row.pick_outcome
        };
      }

      // Add elimination info for eliminated players
      if (row.status === 'out' && row.elim_round_number) {
        player.elimination_pick = {
          round_number: row.elim_round_number,
          team: row.elim_team,
          fixture: row.elim_fixture,
          result: row.elim_result
        };
      }

      return player;
    });

    // ========================================
    // STEP 7: RETURN RESPONSE
    // ========================================

    return res.status(200).json({
      return_code: "SUCCESS",
      group: {
        key: group_key,
        name: groupName
      },
      pagination: {
        current_page: currentPage,
        page_size: itemsPerPage,
        total_players: totalPlayers,
        total_pages: totalPages
      },
      players
    });

  } catch (error) {
    console.error('Error in get-standings-group:', error);
    return res.status(200).json({
      return_code: "SERVER_ERROR",
      message: "An error occurred while retrieving group standings"
    });
  }
});

module.exports = router;
