/*
=======================================================================================================================================
Service: Allowed Teams
=======================================================================================================================================
Purpose: The single definition of what a player may still pick.

  allowed = every active team in the competition's team list
            minus every team this player has picked since their last reset

It is derived from `pick` on every read. The only stored state is the reset boundary,
`competition_user.teams_reset_round` - the round number after which picks still count against
the player. Zero means "all of them", which is the correct starting state.

Read `docs/allowed-teams.md` before changing any of this, and change the doc first. It carries
the reasoning, the decisions already closed, and the landmines.

---------------------------------------------------------------------------------------------------------------------------------------
THIS FILE IS THE ONLY DEFINITION. There is no `allowed_teams` table any more.
---------------------------------------------------------------------------------------------------------------------------------------
It was dropped in Aug 2026 along with its seven indexes. It had duplicated state `pick` already
held, and had grown THREE rebuild implementations carrying TWO different definitions: this file
excluded already-picked teams, while database.js and fixtureService.js handed back every team
unconditionally. Which one a player got depended on whichever code path noticed their empty set
first - a rule nobody chose.

If a caller needs to know what a player may pick, call deriveAllowedTeams() or getAllowedTeams().
Do not reintroduce a stored copy: the drift it caused in production was a stored `team_id` that
outlived the team row it pointed at, which a derivation from `pick.team` cannot suffer.
=======================================================================================================================================
*/

const { query, transaction } = require('../database');

/**
 * Derive the teams a player may still pick.
 *
 * Pure read - never writes, never advances the boundary. Safe to call inside or outside a
 * transaction: pass a client to join one, or null to use the pool.
 *
 * @param {Object|null} client - PostgreSQL client within an active transaction, or null
 * @param {Object} params
 * @param {number} params.competitionId
 * @param {number} params.userId
 * @param {number} params.teamListId - the competition's team list
 * @param {number} params.resetRound - competition_user.teams_reset_round
 * @param {boolean} params.noTeamTwice - competition.no_team_twice
 * @returns {Promise<Array<{team_id: number, name: string, short_name: string}>>}
 */
async function deriveAllowedTeams(client, { competitionId, userId, teamListId, resetRound, noTeamTwice }) {
  const run = client ? (sql, params) => client.query(sql, params) : query;

  // pick.team holds a short code, not a team id and not a full name - matching on t.id here
  // silently returns every team as allowed. pick.competition_id and pick.round_number are both
  // denormalised and fully populated, so this needs no join to `round`.
  const result = await run(`
    SELECT t.id AS team_id, t.name, t.short_name
    FROM team t
    WHERE t.team_list_id = $1
      AND t.is_active = true
      AND ($2::boolean = false OR NOT EXISTS (
            SELECT 1
            FROM pick p
            WHERE p.competition_id = $3
              AND p.user_id        = $4
              AND p.round_number   > $5
              AND p.team           = t.short_name
          ))
    ORDER BY t.name ASC
  `, [teamListId, noTeamTwice, competitionId, userId, resetRound]);

  return result.rows;
}

/**
 * Derive a player's allowed teams, resetting the list if they have used every team.
 *
 * This is the one entry point callers should use. The reset is lazy - it happens on the read
 * that discovers the empty set, which is how a player learns about it anyway.
 *
 * @param {Object} params
 * @param {number} params.competitionId
 * @param {number} params.userId
 * @param {number} params.teamListId
 * @param {boolean} params.noTeamTwice
 * @param {number|null} params.currentRoundNumber - the round they are picking for; null if none
 * @returns {Promise<{teams: Array, teamsReset: boolean, resetRound: number}>}
 */
async function getAllowedTeams({ competitionId, userId, teamListId, noTeamTwice, currentRoundNumber }) {
  const membership = await query(
    'SELECT teams_reset_round FROM competition_user WHERE competition_id = $1 AND user_id = $2',
    [competitionId, userId]
  );

  if (membership.rows.length === 0) {
    return { teams: [], teamsReset: false, resetRound: 0 };
  }

  let resetRound = membership.rows[0].teams_reset_round;
  let teams = await deriveAllowedTeams(null, { competitionId, userId, teamListId, resetRound, noTeamTwice });
  let teamsReset = false;

  // An empty set can only mean "used everything" - there is no write to have missed, which is
  // exactly the ambiguity the stored table had and the reason it grew three rebuild paths.
  //
  // Moving the boundary to the end of the previous round makes every team pickable again while
  // keeping this round's own picks counted, so a player who has already picked in the current
  // round cannot pick that same team a second time within it.
  if (teams.length === 0 && noTeamTwice && currentRoundNumber > 0) {
    const newBoundary = currentRoundNumber - 1;

    // Refuse to move the boundary backwards or sideways. Without this, a competition whose team
    // list is empty or entirely inactive derives empty forever and would rewrite the row and
    // append an audit entry on every single read.
    if (newBoundary > resetRound) {
      await transaction(async (client) => {
        await client.query(
          'UPDATE competition_user SET teams_reset_round = $3 WHERE competition_id = $1 AND user_id = $2',
          [competitionId, userId, newBoundary]
        );

        await client.query(`
          INSERT INTO audit_log (competition_id, user_id, action, details, created_at)
          VALUES ($1, $2, 'Teams Auto-Reset', $3, NOW())
        `, [
          competitionId,
          userId,
          `Player used every team - list reset for round ${currentRoundNumber} (picks up to round ${newBoundary} no longer count)`
        ]);
      });

      resetRound = newBoundary;
      teams = await deriveAllowedTeams(null, { competitionId, userId, teamListId, resetRound, noTeamTwice });
      teamsReset = true;
    }
  }

  return { teams, teamsReset, resetRound };
}



module.exports = {
  deriveAllowedTeams,
  getAllowedTeams,
};
