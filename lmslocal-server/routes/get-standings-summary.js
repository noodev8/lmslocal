/*
=======================================================================================================================================
API Route: get-standings-summary
=======================================================================================================================================
Method: POST
Purpose: Returns lightweight standings overview with group structure, counts, and user's current position
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123                   // integer, required - ID of the competition
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "competition": {
    "id": 123,                            // integer, competition ID
    "name": "Premier League LMS",         // string, competition name
    "current_round": 5,                   // integer, current round number
    "status": "active"                    // string, competition status
  },
  "round_state": "ACTIVE",                // string, "ACTIVE" (mid-round), "COMPLETE" (between rounds), or "PENDING" (before lock)
  "your_position": {                      // object, authenticated user's current position
    "lives": 2,                           // integer, user's remaining lives
    "status": "active",                   // string, user's status
    "has_picked": true,                   // boolean, has user picked in current round
    "group_key": "2_picked",              // string, key identifying user's group
    "group_name": "In Contention (2 lives, picked)" // string, display name for user's group
  },
  "groups": [                             // array, ordered list of groups from best to worst
    {
      "key": "3_picked",                  // string, unique identifier for this group
      "name": "Leaders (3 lives, picked)", // string, display name
      "lives": 3,                         // integer, lives for this group
      "has_picked": true,                 // boolean, whether this group has picked (null for eliminated)
      "count": 12,                        // integer, number of players in this group
      "icon": "trophy"                    // string, suggested icon: "trophy", "clock", "heart", "warning", "eliminated"
    },
    {
      "key": "3_not_picked",
      "name": "Pending (3 lives, not picked)",
      "lives": 3,
      "has_picked": false,
      "count": 8,
      "icon": "clock"
    },
    {
      "key": "eliminated",
      "name": "Eliminated",
      "lives": null,
      "has_picked": null,
      "count": 34,
      "icon": "eliminated"
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
"UNAUTHORIZED"              - User is not a participant in this competition
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../database');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  logApiCall('get-standings-summary');

  try {
    const { competition_id } = req.body;
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

    // ========================================
    // STEP 2: GET COMPETITION INFO AND VERIFY ACCESS
    // ========================================

    const competitionResult = await query(`
      SELECT
        c.id,
        c.name,
        c.status,
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

    // Verify user is a participant
    if (!competition.user_status) {
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
    let roundState = "PENDING";

    if (roundResult.rows.length > 0) {
      currentRound = roundResult.rows[0];
      const now = new Date();
      const lockTime = new Date(currentRound.lock_time);
      const isLocked = now >= lockTime;

      if (isLocked) {
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
      } else {
        roundState = "PENDING"; // Before round starts
      }
    }

    // ========================================
    // STEP 4: GET USER'S CURRENT POSITION
    // ========================================

    const userPositionResult = await query(`
      SELECT
        cu.lives_remaining,
        cu.status,
        CASE
          WHEN p.id IS NOT NULL THEN true
          ELSE false
        END as has_picked
      FROM competition_user cu
      LEFT JOIN pick p ON p.user_id = cu.user_id
        AND p.round_id = $2
      WHERE cu.competition_id = $1 AND cu.user_id = $3
    `, [competition_id, currentRound?.id, user_id]);

    const userPosition = userPositionResult.rows[0] || {
      lives_remaining: 0,
      status: 'out',
      has_picked: false
    };

    // Determine user's group
    let userGroupKey = "eliminated";
    let userGroupName = "Eliminated";

    if (userPosition.status === 'active') {
      if (roundState === "ACTIVE") {
        // Mid-round: split by picked/not picked
        const pickedStatus = userPosition.has_picked ? "picked" : "not_picked";
        userGroupKey = `${userPosition.lives_remaining}_${pickedStatus}`;

        const livesLabel = `${userPosition.lives_remaining} ${userPosition.lives_remaining === 1 ? 'life' : 'lives'}`;
        const pickedLabel = userPosition.has_picked ? 'picked' : 'not picked';

        if (userPosition.lives_remaining >= 2) {
          userGroupName = userPosition.has_picked ?
            `Leaders (${livesLabel}, ${pickedLabel})` :
            `Pending (${livesLabel}, ${pickedLabel})`;
        } else {
          userGroupName = `In Contention (${livesLabel}, ${pickedLabel})`;
        }
      } else {
        // Between rounds or before lock: just by lives
        userGroupKey = `${userPosition.lives_remaining}`;
        const livesLabel = `${userPosition.lives_remaining} ${userPosition.lives_remaining === 1 ? 'life' : 'lives'}`;

        if (userPosition.lives_remaining >= 2) {
          userGroupName = `Leaders (${livesLabel})`;
        } else {
          userGroupName = `In Contention (${livesLabel})`;
        }
      }
    }

    // ========================================
    // STEP 5: BUILD GROUP STRUCTURE WITH COUNTS
    // ========================================

    const groups = [];

    if (roundState === "ACTIVE") {
      // Mid-round: split by lives AND picked status
      const groupCountsResult = await query(`
        SELECT
          cu.lives_remaining,
          CASE
            WHEN p.id IS NOT NULL THEN true
            ELSE false
          END as has_picked,
          COUNT(*) as player_count
        FROM competition_user cu
        LEFT JOIN pick p ON p.user_id = cu.user_id AND p.round_id = $2
        WHERE cu.competition_id = $1 AND cu.status = 'active'
        GROUP BY cu.lives_remaining, has_picked
        ORDER BY
          cu.lives_remaining DESC,
          has_picked DESC
      `, [competition_id, currentRound?.id]);

      // Process active players
      for (const row of groupCountsResult.rows) {
        if (row.lives_remaining !== null) {
          const livesLabel = `${row.lives_remaining} ${row.lives_remaining === 1 ? 'life' : 'lives'}`;
          const pickedStatus = row.has_picked ? "picked" : "not_picked";
          const pickedLabel = row.has_picked ? 'picked' : 'not picked';
          const groupKey = `${row.lives_remaining}_${pickedStatus}`;

          let groupName, icon;
          if (row.lives_remaining >= 2) {
            groupName = row.has_picked ?
              `Leaders (${livesLabel}, ${pickedLabel})` :
              `Pending (${livesLabel}, ${pickedLabel})`;
            icon = row.has_picked ? 'trophy' : 'clock';
          } else {
            groupName = `In Contention (${livesLabel}, ${pickedLabel})`;
            icon = row.has_picked ? 'heart' : 'clock';
          }

          groups.push({
            key: groupKey,
            name: groupName,
            lives: row.lives_remaining,
            has_picked: row.has_picked,
            count: parseInt(row.player_count),
            icon
          });
        }
      }

      // Add eliminated group
      const eliminatedCount = await query(`
        SELECT COUNT(*) as count
        FROM competition_user
        WHERE competition_id = $1 AND status = 'out'
      `, [competition_id]);

      if (parseInt(eliminatedCount.rows[0].count) > 0) {
        groups.push({
          key: "eliminated",
          name: "Eliminated",
          lives: null,
          has_picked: null,
          count: parseInt(eliminatedCount.rows[0].count),
          icon: "eliminated"
        });
      }

    } else {
      // Between rounds or before lock: just by lives
      const groupCountsResult = await query(`
        SELECT
          lives_remaining,
          COUNT(*) as player_count
        FROM competition_user
        WHERE competition_id = $1 AND status = 'active'
        GROUP BY lives_remaining
        ORDER BY lives_remaining DESC
      `, [competition_id]);

      for (const row of groupCountsResult.rows) {
        const livesLabel = `${row.lives_remaining} ${row.lives_remaining === 1 ? 'life' : 'lives'}`;
        const groupKey = `${row.lives_remaining}`;

        let groupName, icon;
        if (row.lives_remaining >= 2) {
          groupName = `Leaders (${livesLabel})`;
          icon = 'trophy';
        } else {
          groupName = `In Contention (${livesLabel})`;
          icon = 'heart';
        }

        groups.push({
          key: groupKey,
          name: groupName,
          lives: row.lives_remaining,
          has_picked: null,
          count: parseInt(row.player_count),
          icon
        });
      }

      // Add eliminated group
      const eliminatedCount = await query(`
        SELECT COUNT(*) as count
        FROM competition_user
        WHERE competition_id = $1 AND status = 'out'
      `, [competition_id]);

      if (parseInt(eliminatedCount.rows[0].count) > 0) {
        groups.push({
          key: "eliminated",
          name: "Eliminated",
          lives: null,
          has_picked: null,
          count: parseInt(eliminatedCount.rows[0].count),
          icon: "eliminated"
        });
      }
    }

    // ========================================
    // STEP 6: RETURN RESPONSE
    // ========================================

    return res.status(200).json({
      return_code: "SUCCESS",
      competition: {
        id: competition.id,
        name: competition.name,
        current_round: currentRound?.round_number || 0,
        status: competition.status
      },
      round_state: roundState,
      your_position: {
        lives: userPosition.lives_remaining,
        status: userPosition.status,
        has_picked: userPosition.has_picked,
        group_key: userGroupKey,
        group_name: userGroupName
      },
      groups
    });

  } catch (error) {
    console.error('Error in get-standings-summary:', error);
    return res.status(200).json({
      return_code: "SERVER_ERROR",
      message: "An error occurred while retrieving standings summary"
    });
  }
});

module.exports = router;
