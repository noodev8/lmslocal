/*
=======================================================================================================================================
API Route: get-promote-data
=======================================================================================================================================
Method: POST
Purpose: Fetches all data needed for organizer promotion/marketing features including competition details, round status,
         player statistics, and template visibility logic. Returns structured data for template variable replacement.
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123                // integer, required - ID of the competition
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "competition": {
    "id": 123,                         // integer, competition ID
    "name": "Red Barn LMS",            // string, competition name
    "status": "active",                // string, competition status (setup/active/COMPLETE)
    "invite_code": "RED-BARN",         // string, competition invite code
    "join_url": "https://lmslocal.co.uk/join/RED-BARN",  // string, full join URL
    "total_players": 35                // integer, total players ever in competition
  },
  "current_round": {
    "round_number": 5,                 // integer, current round number (null if no rounds)
    "lock_time": "2025-01-24T19:00:00Z", // string ISO timestamp (null if not set)
    "lock_time_formatted": "Friday 7pm", // string, human-readable lock time
    "is_locked": false,                // boolean, whether round is currently locked
    "fixture_count": 10,               // integer, number of fixtures in round
    "completed_fixtures": 0,           // integer, fixtures with results
    "next_round_start": "Saturday 25th Jan" // string, formatted next round date (null if unknown)
  },
  "player_stats": {
    "total_active_players": 23,        // integer, players still in competition
    "players_eliminated_this_round": 8, // integer, players eliminated in latest completed round
    "pick_percentage": 65,             // integer, percentage of active players who have picked
    "players_with_picks": 15,          // integer, count of players who have picked
    "players_without_picks": 8         // integer, count of players who haven't picked
  },
  "top_players": [                     // array, top 3 active players by lives remaining
    {
      "display_name": "John",          // string, player name
      "lives_remaining": 3             // integer, lives left
    }
  ],
  "template_context": {                // object, boolean flags for which template categories to show
    "show_pre_launch": true,           // boolean, show pre-launch templates
    "show_weekly_update": false,       // boolean, show weekly update templates
    "show_pick_reminder": true,        // boolean, show pick reminder templates
    "show_results": false,             // boolean, show results announcement templates
    "show_elimination": false,         // boolean, show elimination alert templates
    "show_final_hype": false,          // boolean, show final round hype templates
    "show_winner": false               // boolean, show winner announcement templates
  }
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "MISSING_FIELDS",
  "message": "competition_id is required"
}

{
  "return_code": "NOT_FOUND",
  "message": "Competition not found"
}

{
  "return_code": "UNAUTHORIZED",
  "message": "You are not the organizer of this competition"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"MISSING_FIELDS"
"NOT_FOUND"
"UNAUTHORIZED"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const router = express.Router();
const { query } = require('../database');
const verifyToken = require('../middleware/verifyToken');

router.post('/', verifyToken, async (req, res) => {
  try {
    const { competition_id } = req.body;
    const user_id = req.user.id; // verifyToken middleware sets req.user to the DB row (has 'id', not 'userId')

    // Validate required fields
    if (!competition_id) {
      return res.status(200).json({
        return_code: 'MISSING_FIELDS',
        message: 'competition_id is required'
      });
    }

    // Fetch competition details and verify organizer
    const competitionResult = await query(
      `SELECT id, name, status, invite_code, slug, organiser_id
       FROM competition
       WHERE id = $1`,
      [competition_id]
    );

    if (competitionResult.rows.length === 0) {
      return res.status(200).json({
        return_code: 'NOT_FOUND',
        message: 'Competition not found'
      });
    }

    const competition = competitionResult.rows[0];

    // Verify user is the organizer
    if (competition.organiser_id !== user_id) {
      return res.status(200).json({
        return_code: 'UNAUTHORIZED',
        message: 'You are not the organizer of this competition'
      });
    }

    // Build join URL (prefer slug, fallback to invite code)
    const join_url = competition.slug
      ? `https://lmslocal.co.uk/join/${competition.slug}`
      : `https://lmslocal.co.uk/join/${competition.invite_code}`;

    // Get total player count (all players who ever joined)
    const totalPlayersResult = await query(
      `SELECT COUNT(*) as count
       FROM competition_user
       WHERE competition_id = $1`,
      [competition_id]
    );
    const total_players = parseInt(totalPlayersResult.rows[0].count);

    // Get current round information
    const roundResult = await query(
      `SELECT id, round_number, lock_time
       FROM round
       WHERE competition_id = $1
       ORDER BY round_number DESC
       LIMIT 1`,
      [competition_id]
    );

    let current_round = null;
    if (roundResult.rows.length > 0) {
      const round = roundResult.rows[0];
      const now = new Date();
      const lockTime = round.lock_time ? new Date(round.lock_time) : null;
      const is_locked = lockTime && now >= lockTime;

      // Get fixture count for this round
      const fixtureResult = await query(
        `SELECT COUNT(*) as count,
                COUNT(CASE WHEN result IS NOT NULL THEN 1 END) as completed
         FROM fixture
         WHERE round_id = $1`,
        [round.id]
      );

      const fixture_count = parseInt(fixtureResult.rows[0].count);
      const completed_fixtures = parseInt(fixtureResult.rows[0].completed);

      // Format lock time (e.g., "Friday 7pm")
      let lock_time_formatted = null;
      if (lockTime) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayName = days[lockTime.getDay()];
        const hour = lockTime.getHours();
        const ampm = hour >= 12 ? 'pm' : 'am';
        const displayHour = hour % 12 || 12;
        lock_time_formatted = `${dayName} ${displayHour}${ampm}`;
      }

      // Calculate next round start (approximate - could be enhanced with actual fixture data)
      let next_round_start = null;
      if (lockTime && !is_locked) {
        const nextDay = new Date(lockTime);
        nextDay.setDate(nextDay.getDate() + 1);
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        next_round_start = `${days[nextDay.getDay()]} ${nextDay.getDate()} ${months[nextDay.getMonth()]}`;
      }

      current_round = {
        round_number: round.round_number,
        lock_time: round.lock_time,
        lock_time_formatted,
        is_locked,
        fixture_count,
        completed_fixtures,
        next_round_start
      };
    }

    // Get player statistics
    const activePlayersResult = await query(
      `SELECT COUNT(*) as count
       FROM competition_user
       WHERE competition_id = $1 AND status = 'active'`,
      [competition_id]
    );
    const total_active_players = parseInt(activePlayersResult.rows[0].count);

    // Get pick statistics for current round
    let pick_stats = {
      players_with_picks: 0,
      players_without_picks: total_active_players,
      pick_percentage: 0
    };

    if (current_round) {
      const pickStatsResult = await query(
        `SELECT COUNT(DISTINCT p.user_id) as picked_count
         FROM pick p
         INNER JOIN competition_user cu ON p.user_id = cu.user_id AND p.competition_id = cu.competition_id
         WHERE p.round_id = (SELECT id FROM round WHERE competition_id = $1 ORDER BY round_number DESC LIMIT 1)
           AND cu.status = 'active'`,
        [competition_id]
      );

      const players_with_picks = parseInt(pickStatsResult.rows[0].picked_count) || 0;
      const players_without_picks = total_active_players - players_with_picks;
      const pick_percentage = total_active_players > 0
        ? Math.round((players_with_picks / total_active_players) * 100)
        : 0;

      pick_stats = {
        players_with_picks,
        players_without_picks,
        pick_percentage
      };
    }

    // Get eliminations from most recent completed round
    let players_eliminated_this_round = 0;
    if (current_round && current_round.is_locked) {
      const eliminationsResult = await query(
        `SELECT COUNT(*) as count
         FROM player_progress
         WHERE competition_id = $1
           AND round_id = (SELECT id FROM round WHERE competition_id = $1 ORDER BY round_number DESC LIMIT 1)
           AND outcome IN ('eliminated', 'lost')`,
        [competition_id]
      );
      players_eliminated_this_round = parseInt(eliminationsResult.rows[0].count) || 0;
    }

    // Get top 3 players by lives remaining
    const topPlayersResult = await query(
      `SELECT u.display_name, cu.lives_remaining
       FROM competition_user cu
       INNER JOIN app_user u ON cu.user_id = u.id
       WHERE cu.competition_id = $1 AND cu.status = 'active'
       ORDER BY cu.lives_remaining DESC, u.display_name ASC
       LIMIT 3`,
      [competition_id]
    );

    const top_players = topPlayersResult.rows.map(row => ({
      display_name: row.display_name,
      lives_remaining: row.lives_remaining
    }));

    // Calculate template visibility logic
    const template_context = {
      // Pre-launch: Show if competition is in setup OR round 1 has no fixtures
      show_pre_launch: competition.status === 'setup' ||
                       (!current_round || (current_round.round_number === 1 && current_round.fixture_count === 0)),

      // Weekly update: Show if competition is active and round is locked
      show_weekly_update: competition.status === 'active' && current_round && current_round.is_locked,

      // Pick reminder: Show if competition is active, round is NOT locked, and pick percentage < 80%
      show_pick_reminder: competition.status === 'active' &&
                         current_round &&
                         !current_round.is_locked &&
                         pick_stats.pick_percentage < 80,

      // Results: Show if round is locked and has completed fixtures
      show_results: current_round &&
                   current_round.is_locked &&
                   current_round.completed_fixtures > 0,

      // Elimination: Show if there were eliminations in the latest round
      show_elimination: players_eliminated_this_round > 0,

      // Final hype: Show if 5 or fewer active players remain and round is not locked
      show_final_hype: total_active_players > 0 &&
                       total_active_players <= 5 &&
                       current_round &&
                       !current_round.is_locked,

      // Winner: Show if competition is complete
      show_winner: competition.status === 'COMPLETE'
    };

    // Return success response
    return res.status(200).json({
      return_code: 'SUCCESS',
      competition: {
        id: competition.id,
        name: competition.name,
        status: competition.status,
        invite_code: competition.invite_code,
        join_url,
        total_players
      },
      current_round,
      player_stats: {
        total_active_players,
        players_eliminated_this_round,
        pick_percentage: pick_stats.pick_percentage,
        players_with_picks: pick_stats.players_with_picks,
        players_without_picks: pick_stats.players_without_picks
      },
      top_players,
      template_context
    });

  } catch (error) {
    console.error('Error in get-promote-data:', error);
    return res.status(200).json({
      return_code: 'SERVER_ERROR',
      message: 'An unexpected error occurred'
    });
  }
});

module.exports = router;
