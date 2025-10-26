/*
=======================================================================================================================================
API Route: search-players
=======================================================================================================================================
Method: POST
Purpose: Search for players in a competition by name and return their current status
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123,                  // integer, required - ID of the competition
  "search_term": "John",                  // string, required - Name to search for (partial match)
  "limit": 10                             // integer, optional - Max results (default: 10, max: 50)
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "results": [
    {
      "id": 456,                          // integer, player user ID
      "display_name": "John Doe",         // string, player name
      "lives_remaining": 2,               // integer, remaining lives
      "status": "active",                 // string, player status
      "group_key": "2_pending",           // string, group identifier
      "group_name": "❤️ 2 • Game Pending", // string, group display name
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
"COMPETITION_NOT_FOUND"
"UNAUTHORIZED"              - User is not a participant or organizer
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../database');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  logApiCall('search-players');

  try {
    const { competition_id, search_term, limit = 10 } = req.body;
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

    if (!search_term || typeof search_term !== 'string' || search_term.trim().length === 0) {
      return res.status(200).json({
        return_code: "MISSING_FIELDS",
        message: "search_term is required and must be a non-empty string"
      });
    }

    // Validate limit
    const maxResults = Math.min(50, Math.max(1, parseInt(limit) || 10));

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
    let roundState = "PENDING";

    if (roundResult.rows.length > 0) {
      currentRound = roundResult.rows[0];
      const now = new Date();
      const lockTime = new Date(currentRound.lock_time);
      isRoundLocked = now >= lockTime;

      if (isRoundLocked) {
        // Check if all fixtures are processed to determine if round is complete
        const fixturesResult = await query(`
          SELECT
            COUNT(*) as total_fixtures,
            COUNT(processed) as processed_fixtures
          FROM fixture
          WHERE round_id = $1
        `, [currentRound.id]);

        const { total_fixtures, processed_fixtures } = fixturesResult.rows[0];

        if (total_fixtures > 0 && parseInt(total_fixtures) === parseInt(processed_fixtures)) {
          roundState = "COMPLETE"; // Between rounds - all fixtures processed
        } else {
          roundState = "ACTIVE"; // Mid-round - fixtures still being processed
        }
      }
    }

    // ========================================
    // STEP 4: SEARCH FOR PLAYERS
    // ========================================

    const searchPattern = `%${search_term.trim()}%`;

    const searchQuery = `
      SELECT
        cu.user_id as id,
        au.display_name,
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
        CASE
          WHEN p.id IS NULL THEN 'no_pick'
          WHEN f.result IS NOT NULL THEN 'played'
          ELSE 'pending'
        END as fixture_status,

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
      LEFT JOIN pick p ON p.user_id = cu.user_id AND p.round_id = $2
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

      WHERE cu.competition_id = $1
        AND au.display_name ILIKE $3
      ORDER BY au.display_name ASC
      LIMIT $4
    `;

    const searchResult = await query(searchQuery, [
      competition_id,
      currentRound?.id || null,
      searchPattern,
      maxResults
    ]);

    // ========================================
    // STEP 5: FORMAT RESULTS
    // ========================================

    const results = searchResult.rows.map(row => {
      // Determine group key and name
      let groupKey = "eliminated";
      let groupName = "Eliminated";

      if (row.status === 'active') {
        if (roundState === "ACTIVE") {
          // Mid-round: split by fixture status
          const fixtureStatus = row.fixture_status;
          groupKey = `${row.lives_remaining}_${fixtureStatus}`;

          const livesLabel = `${row.lives_remaining} ${row.lives_remaining === 1 ? 'life' : 'lives'}`;
          const statusLabel = fixtureStatus === 'played' ? 'Game Played' : fixtureStatus === 'pending' ? 'Game Pending' : 'No Pick';

          groupName = `❤️ ${row.lives_remaining} • ${statusLabel}`;
        } else {
          // Between rounds or before lock: just by lives
          groupKey = `${row.lives_remaining}`;
          groupName = `❤️ ${row.lives_remaining} ${row.lives_remaining === 1 ? 'life' : 'lives'}`;
        }
      }

      const player = {
        id: row.id,
        display_name: row.display_name,
        lives_remaining: row.lives_remaining,
        status: row.status,
        group_key: groupKey,
        group_name: groupName,
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
    // STEP 6: RETURN RESPONSE
    // ========================================

    return res.status(200).json({
      return_code: "SUCCESS",
      results
    });

  } catch (error) {
    console.error('Error in search-players:', error);
    return res.status(200).json({
      return_code: "SERVER_ERROR",
      message: "An error occurred while searching for players"
    });
  }
});

module.exports = router;
