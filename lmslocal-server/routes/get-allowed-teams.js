/*
=======================================================================================================================================
API Route: get-allowed-teams
=======================================================================================================================================
Method: POST
Purpose: Returns the teams a player may still pick in the current round, resetting their list if
         they have used every team.
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123,                       // integer, required - ID of the competition
  "user_id": 456                               // integer, optional - ID of user to check (admin feature)
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "allowed_teams": [                           // array, teams user can pick that have fixtures
    {
      "team_id": 1,                            // integer, unique team identifier
      "name": "Arsenal",                       // string, full team name for display
      "short_name": "ARS"                      // string, abbreviated team name for compact UI
    }
  ],
  "teams_reset": false,                        // boolean, true if the list was reset on this read
  "reset_message": null                        // string, message about reset action (null if no reset)
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
"COMPETITION_NOT_FOUND"
"USER_NOT_IN_COMPETITION"
"SERVER_ERROR"
=======================================================================================================================================
Allowed teams are DERIVED, not stored - see docs/allowed-teams.md and services/allowedTeams.js.
This route composes two separate rules and they must not be confused:

  1. what the player may still pick  - services/allowedTeams.js, from their own pick history
  2. which of those play this round  - the fixture filter below

Only rule 1 can exhaust. A player holding Arsenal alone, in a round where Arsenal is not playing,
has NOT run out of teams and must not be reset - doing so would hand back teams they have used.
The old single-query version tested the two together and would have reset in that case; the
rebuild it then ran happened to be a no-op, which is the only reason nobody noticed.
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../database');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');
const { canManagePlayers } = require('../utils/permissions');
const { getAllowedTeams, compareWithStoredTable } = require('../services/allowedTeams');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  logApiCall('get-allowed-teams');

  try {
    const { competition_id, user_id: requested_user_id } = req.body;
    const authenticated_user_id = req.user.id;

    if (!competition_id || !Number.isInteger(competition_id)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Competition ID is required and must be a number"
      });
    }

    // Use requested user_id if provided (admin feature), otherwise the authenticated user
    const target_user_id = requested_user_id || authenticated_user_id;

    if (requested_user_id && requested_user_id !== authenticated_user_id) {
      const permission = await canManagePlayers(authenticated_user_id, competition_id);
      if (!permission.authorized) {
        return res.json({
          return_code: "UNAUTHORIZED",
          message: "You do not have permission to view other players' allowed teams"
        });
      }
    }

    // === COMPETITION, MEMBERSHIP AND CURRENT ROUND ===
    const contextResult = await query(`
      SELECT
        c.id AS competition_id,
        c.team_list_id,
        c.no_team_twice,
        cu.user_id AS is_participant,
        latest_round.round_id,
        latest_round.round_number
      FROM competition c
      LEFT JOIN competition_user cu ON c.id = cu.competition_id AND cu.user_id = $2
      LEFT JOIN (
        SELECT r.competition_id,
               r.id AS round_id,
               r.round_number,
               ROW_NUMBER() OVER (PARTITION BY r.competition_id ORDER BY r.round_number DESC) AS rn
        FROM round r
      ) latest_round ON c.id = latest_round.competition_id AND latest_round.rn = 1
      WHERE c.id = $1
    `, [competition_id, target_user_id]);

    if (contextResult.rows.length === 0) {
      return res.json({
        return_code: "COMPETITION_NOT_FOUND",
        message: "Competition not found"
      });
    }

    const context = contextResult.rows[0];

    if (!context.is_participant) {
      return res.json({
        return_code: "USER_NOT_IN_COMPETITION",
        message: "User is not participating in this competition"
      });
    }

    // No round yet, or no team list - nothing to offer and nothing to reset against.
    if (!context.round_id || !context.team_list_id) {
      return res.json({
        return_code: "SUCCESS",
        allowed_teams: [],
        teams_reset: false,
        reset_message: null
      });
    }

    // === RULE 1: WHAT THEY MAY STILL PICK ===
    const { teams, teamsReset } = await getAllowedTeams({
      competitionId: competition_id,
      userId: target_user_id,
      teamListId: context.team_list_id,
      noTeamTwice: context.no_team_twice,
      currentRoundNumber: context.round_number
    });

    // Step 3 of the migration: prove the derivation matches the table still being maintained
    // beside it. Fire-and-forget - it can log, it can never break this response.
    compareWithStoredTable(competition_id, target_user_id, teams);

    // === RULE 2: WHICH OF THOSE PLAY THIS ROUND ===
    const fixtureResult = await query(`
      SELECT home_team_short AS short_name FROM fixture WHERE round_id = $1
      UNION
      SELECT away_team_short FROM fixture WHERE round_id = $1
    `, [context.round_id]);

    const playingThisRound = new Set(fixtureResult.rows.map((row) => row.short_name));

    const allowedTeams = teams
      .filter((team) => playingThisRound.has(team.short_name))
      .map((team) => ({
        team_id: team.team_id,
        name: team.name,
        short_name: team.short_name
      }));

    res.json({
      return_code: "SUCCESS",
      allowed_teams: allowedTeams,
      teams_reset: teamsReset,
      reset_message: teamsReset
        ? "You ran out of teams! All teams have been reset and are now available again."
        : null
    });

  } catch (error) {
    console.error('Get allowed teams error:', error);
    res.json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;
