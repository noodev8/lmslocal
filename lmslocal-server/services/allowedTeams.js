/*
=======================================================================================================================================
Service: Allowed Teams
=======================================================================================================================================
Purpose: Rebuild a player's allowed_teams rows from scratch - every active team in the
         competition's list, minus the ones they have already picked.

Extracted from get-allowed-teams.js, which has run this on read since long before bots existed:
a player whose allowed_teams is empty gets it rebuilt the moment they open the pick screen. That
self-healing is why real players never notice the table drifting.

Bots never open the pick screen, so they never healed - competition 199's two oldest bots have
no allowed_teams rows at all while the humans beside them do. Sharing this rather than
reimplementing it is what keeps a bot's answer to "what can I pick" identical to a person's.
=======================================================================================================================================
*/

/**
 * Rebuild allowed_teams for one player in one competition.
 *
 * Must be called inside a transaction - the delete and insert are one operation, and a failure
 * between them would leave the player with nothing to pick.
 *
 * @param {Object} client - PostgreSQL client within an active transaction
 * @param {number} competitionId
 * @param {number} userId
 * @param {number} teamListId - the competition's team list
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

module.exports = { resetAllowedTeams };
