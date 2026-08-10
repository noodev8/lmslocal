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
MIGRATION STATE: step 2 of 4 (see docs/allowed-teams.md §5)
---------------------------------------------------------------------------------------------------------------------------------------
The derivation below is live and is what get-allowed-teams now serves. The `allowed_teams` table
is still written by the old paths and still read by botPool, so the two run in parallel and
compareWithStoredTable() reports any disagreement to the log. Nothing has been deleted yet.

resetAllowedTeams() is the old table rebuild, kept only for those remaining callers. It is
deliberately NOT the definition any more - deriveAllowedTeams() is. Do not add callers to it.

Why the table is going: it duplicated state that `pick` already holds, and it had three separate
rebuild implementations carrying two different definitions - this file excluded already-picked
teams, while database.js:143 and fixtureService.js:319 handed back every team unconditionally.
Which one a player got depended on whichever code path noticed their empty set first.
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

/**
 * Step 3 verification only - compare the derivation against the still-maintained table and log
 * any disagreement. Delete this along with the table at step 4.
 *
 * Never throws. A verification aid must not be able to break the read path it is verifying.
 *
 * @param {number} competitionId
 * @param {number} userId
 * @param {Array<{team_id: number}>} derivedTeams
 */
async function compareWithStoredTable(competitionId, userId, derivedTeams) {
  try {
    const stored = await query(
      'SELECT team_id FROM allowed_teams WHERE competition_id = $1 AND user_id = $2',
      [competitionId, userId]
    );

    const storedIds = new Set(stored.rows.map((r) => r.team_id));
    const derivedIds = new Set(derivedTeams.map((t) => t.team_id));

    const onlyStored = [...storedIds].filter((id) => !derivedIds.has(id));
    const onlyDerived = [...derivedIds].filter((id) => !storedIds.has(id));

    if (onlyStored.length > 0 || onlyDerived.length > 0) {
      console.warn(
        `[allowed-teams-diff] competition=${competitionId} user=${userId} ` +
        `stored=${storedIds.size} derived=${derivedIds.size} ` +
        `only_stored=[${onlyStored.join(',')}] only_derived=[${onlyDerived.join(',')}]`
      );
    }
  } catch (error) {
    console.error('[allowed-teams-diff] comparison failed:', error.message);
  }
}

/**
 * LEGACY - the old `allowed_teams` table rebuild. Retained only for botPool, which still reads
 * the table. Removed at step 4. Do not add callers.
 *
 * Must be called inside a transaction - the delete and insert are one operation, and a failure
 * between them would leave the player with nothing to pick.
 *
 * @param {Object} client - PostgreSQL client within an active transaction
 * @param {number} competitionId
 * @param {number} userId
 * @param {number} teamListId
 * @param {string} reason - what to record on the audit row
 * @returns {Promise<number>} how many teams the player now has
 */
async function resetAllowedTeams(client, competitionId, userId, teamListId, reason) {
  // Clear first: a partial set is what got us here, and topping it up would keep whatever is
  // already wrong about it.
  await client.query(
    'DELETE FROM allowed_teams WHERE competition_id = $1 AND user_id = $2',
    [competitionId, userId]
  );

  const inserted = await client.query(`
    INSERT INTO allowed_teams (competition_id, user_id, team_id, created_at)
    SELECT $1, $2, t.id, NOW()
    FROM team t
    WHERE t.team_list_id = $3 AND t.is_active = true
      AND t.short_name NOT IN (
        SELECT DISTINCT p.team
        FROM pick p
        JOIN round r ON p.round_id = r.id
        WHERE r.competition_id = $1 AND p.user_id = $2
          AND p.team IS NOT NULL
      )
    ON CONFLICT (competition_id, user_id, team_id) DO NOTHING
  `, [competitionId, userId, teamListId]);

  await client.query(`
    INSERT INTO audit_log (competition_id, user_id, action, details, created_at)
    VALUES ($1, $2, 'Teams Auto-Reset', $3, NOW())
  `, [competitionId, userId, reason]);

  return inserted.rowCount;
}

module.exports = {
  deriveAllowedTeams,
  getAllowedTeams,
  compareWithStoredTable,
  resetAllowedTeams,
};
