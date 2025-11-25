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
    "join_url": "https://lmslocal.co.uk/join/RED-BARN",  // string, full join URL (for pre-launch)
    "game_url": "https://lmslocal.co.uk/game/123",       // string, direct game URL (for active competitions)
    "total_players": 35,               // integer, total players ever in competition
    "entry_fee": 10.00,                // decimal, suggested entry fee (null if not set)
    "prize_structure": "50% Winner / 50% Charity", // string, prize distribution (null if not set)
    "start_date": "Friday 24 Jan at 7pm" // string, formatted start date from round 1 lock_time (or "Check with organiser" if not set)
  },
  "current_round": {
    "round_number": 5,                 // integer, current round number (null if no rounds)
    "lock_time": "2025-01-24T19:00:00Z", // string ISO timestamp (null if not set)
    "lock_time_formatted": "Friday 7pm", // string, human-readable lock time
    "is_locked": false,                // boolean, whether round is currently locked
    "fixture_count": 10,               // integer, number of fixtures in round
    "completed_fixtures": 0,           // integer, fixtures with results
    "next_round_info": {               // object, information about next round
      "exists": true,                  // boolean, whether next round exists
      "round_number": 6,               // integer, next round number (if exists)
      "has_fixtures": true,            // boolean, whether next round has fixtures loaded
      "message": "Saturday 15 Jan at 3:00pm" // string, formatted message ("Fixtures coming soon" if no fixtures, null if no next round)
    }
  },
  "player_stats": {
    "total_active_players": 23,        // integer, players still in competition
    "players_eliminated_this_round": 8, // integer, players eliminated in latest completed round
    "pick_percentage": 65,             // integer, percentage of active players who have picked
    "players_with_picks": 15,          // integer, count of players who have picked
    "players_without_picks": 8         // integer, count of players who haven't picked
  },
  "top_players": [                     // array, top 5 active players by lives remaining
    {
      "display_name": "John",          // string, player name
      "lives_remaining": 3             // integer, lives left
    }
  ],
  "template_context": {                // object, boolean flags for which template categories to show
    "show_pre_launch": true,           // boolean, show pre-launch templates
    "show_round_update": false,        // boolean, show round update templates
    "show_pick_reminder": true,        // boolean, show pick reminder templates
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
const { canManagePromote } = require('../utils/permissions'); // Permission helper
const { logApiCall } = require('../utils/apiLogger');

router.post('/', verifyToken, async (req, res) => {
  logApiCall('get-promote-data');

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
      `SELECT id, name, description, status, invite_code, slug, organiser_id, logo_url, entry_fee, prize_structure, lives_per_player
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

    // Verify user is the organizer or has delegated manage_promote permission
    const permission = await canManagePromote(user_id, competition_id);
    if (!permission.authorized) {
      return res.status(200).json({
        return_code: 'UNAUTHORIZED',
        message: 'You do not have permission to access promotion features for this competition'
      });
    }

    // Build join URL (prefer slug, fallback to invite code) - for pre-launch invitations
    const join_url = competition.slug
      ? `https://lmslocal.co.uk/join/${competition.slug}`
      : `https://lmslocal.co.uk/join/${competition.invite_code}`;

    // Build game URL - for players to view active competition
    const game_url = `https://lmslocal.co.uk/game/${competition_id}`;

    // Get total player count (all players who ever joined)
    const totalPlayersResult = await query(
      `SELECT COUNT(*) as count
       FROM competition_user
       WHERE competition_id = $1`,
      [competition_id]
    );
    const total_players = parseInt(totalPlayersResult.rows[0].count);

    // Get round 1 lock_time for start date
    const round1Result = await query(
      `SELECT lock_time
       FROM round
       WHERE competition_id = $1 AND round_number = 1
       LIMIT 1`,
      [competition_id]
    );

    let start_date_formatted = 'Check with organiser';
    if (round1Result.rows.length > 0 && round1Result.rows[0].lock_time) {
      const startLockTime = new Date(round1Result.rows[0].lock_time);
      const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/London',
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        hour12: false
      });

      const parts = formatter.formatToParts(startLockTime);
      const weekday = parts.find(p => p.type === 'weekday').value;
      const day = parts.find(p => p.type === 'day').value;
      const month = parts.find(p => p.type === 'month').value;
      const hour24 = parseInt(parts.find(p => p.type === 'hour').value);
      const hour12 = hour24 % 12 || 12;
      const ampm = hour24 >= 12 ? 'pm' : 'am';

      start_date_formatted = `${weekday} ${day} ${month} at ${hour12}${ampm}`;
    }

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

      // Format lock time in UK timezone (e.g., "Friday 25 Oct at 3pm")
      let lock_time_formatted = null;
      if (lockTime) {
        // Convert UTC to UK time using Intl.DateTimeFormat (handles BST/GMT automatically)
        const formatter = new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Europe/London',
          weekday: 'long',
          day: 'numeric',
          month: 'short',
          hour: 'numeric',
          hour12: false
        });

        const parts = formatter.formatToParts(lockTime);
        const weekday = parts.find(p => p.type === 'weekday').value;
        const day = parts.find(p => p.type === 'day').value;
        const month = parts.find(p => p.type === 'month').value;
        const hour24 = parseInt(parts.find(p => p.type === 'hour').value);
        const hour12 = hour24 % 12 || 12;
        const ampm = hour24 >= 12 ? 'pm' : 'am';

        lock_time_formatted = `${weekday} ${day} ${month} at ${hour12}${ampm}`;
      }

      // Get NEXT round information (for "Next round starts..." messaging)
      let next_round_info = null;
      const nextRoundResult = await query(
        `SELECT id, round_number, lock_time
         FROM round
         WHERE competition_id = $1 AND round_number = $2
         LIMIT 1`,
        [competition_id, round.round_number + 1]
      );

      if (nextRoundResult.rows.length > 0) {
        const nextRound = nextRoundResult.rows[0];

        // Check if next round has fixtures and get earliest kick-off time
        const nextFixturesResult = await query(
          `SELECT MIN(kick_off_time) as earliest_kickoff, COUNT(*) as fixture_count
           FROM fixture
           WHERE round_id = $1`,
          [nextRound.id]
        );

        const nextFixtureCount = parseInt(nextFixturesResult.rows[0].fixture_count) || 0;
        const earliestKickoff = nextFixturesResult.rows[0].earliest_kickoff;

        if (nextFixtureCount > 0 && earliestKickoff) {
          // Format the earliest kick-off time
          const kickoffDate = new Date(earliestKickoff);
          const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const dayName = days[kickoffDate.getDay()];
          const date = kickoffDate.getDate();
          const month = months[kickoffDate.getMonth()];
          const hour = kickoffDate.getHours();
          const minute = kickoffDate.getMinutes();
          const ampm = hour >= 12 ? 'pm' : 'am';
          const displayHour = hour % 12 || 12;
          const displayMinute = minute.toString().padStart(2, '0');

          next_round_info = {
            exists: true,
            round_number: nextRound.round_number,
            has_fixtures: true,
            message: `${dayName} ${date} ${month} at ${displayHour}:${displayMinute}${ampm}`
          };
        } else {
          // Next round exists but no fixtures yet
          next_round_info = {
            exists: true,
            round_number: nextRound.round_number,
            has_fixtures: false,
            message: 'Fixtures coming soon - stay tuned!'
          };
        }
      } else {
        // No next round - competition may be ending
        next_round_info = {
          exists: false,
          message: null
        };
      }

      current_round = {
        round_number: round.round_number,
        lock_time: round.lock_time,
        lock_time_formatted,
        is_locked,
        fixture_count,
        completed_fixtures,
        next_round_info
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

    // Get top 5 players by lives remaining (randomized for tied players)
    const topPlayersResult = await query(
      `SELECT cu.player_display_name as display_name, cu.lives_remaining
       FROM competition_user cu
       INNER JOIN app_user u ON cu.user_id = u.id
       WHERE cu.competition_id = $1 AND cu.status = 'active'
       ORDER BY cu.lives_remaining DESC, RANDOM()
       LIMIT 5`,
      [competition_id]
    );

    const top_players = topPlayersResult.rows.map(row => ({
      display_name: row.display_name,
      lives_remaining: row.lives_remaining
    }));

    // Check if any round has completed fixtures (for round update templates)
    const completedRoundCheck = await query(
      `SELECT COUNT(*) as count
       FROM round r
       INNER JOIN fixture f ON f.round_id = r.id
       WHERE r.competition_id = $1
         AND f.result IS NOT NULL
         AND f.processed IS NOT NULL`,
      [competition_id]
    );
    const hasAnyCompletedRound = parseInt(completedRoundCheck.rows[0].count) > 0;

    // Calculate template visibility logic
    const template_context = {
      // Pre-launch: Show if competition is in SETUP OR no round exists OR round 1 is not locked
      show_pre_launch: competition.status === 'SETUP' ||
                       (!current_round) ||
                       (current_round.round_number === 1 && !current_round.is_locked),

      // Round update: Show if competition is active and ANY round has completed fixtures
      show_round_update: competition.status === 'active' && hasAnyCompletedRound,

      // Pick reminder: Show if round is NOT locked and has fixtures
      // Allow for both 'active' and 'SETUP' status to support Round 1 fixture sharing
      show_pick_reminder: current_round &&
                         !current_round.is_locked &&
                         current_round.fixture_count > 0 &&
                         (competition.status === 'active' || competition.status === 'SETUP'),

      // Winner: Show if competition is complete
      show_winner: competition.status === 'COMPLETE'
    };

    // Return success response
    return res.status(200).json({
      return_code: 'SUCCESS',
      competition: {
        id: competition.id,
        name: competition.name,
        description: competition.description,
        status: competition.status,
        invite_code: competition.invite_code,
        join_url,
        game_url,
        total_players,
        logo_url: competition.logo_url,
        entry_fee: competition.entry_fee,
        prize_structure: competition.prize_structure,
        start_date: start_date_formatted,
        lives_per_player: competition.lives_per_player
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
