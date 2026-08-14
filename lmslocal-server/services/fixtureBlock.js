/*
=======================================================================================================================================
Service: fixtureBlock
=======================================================================================================================================
Purpose: The one definition of what a block of fixtures is and when it is valid.

See docs/competition-start.md for why blocks exist at all. The short version: fixture_load is
the batch going out NOW and may only hold one at a time, so it cannot also be the calendar of
what is coming. fixture_block is the calendar. A block is promoted into fixture_load when its
kickoffs are confirmed, and everything downstream of that point is unchanged.

Used by:
  - routes/admin/get-fixture-blocks.js
  - routes/admin/add-fixture-block.js
  - routes/admin/update-fixture-block.js
  - routes/admin/delete-fixture-block.js
  - routes/admin/promote-fixture-block.js
  - routes/admin/add-staged-fixtures.js   (validation only - the same rule, one definition)
=======================================================================================================================================
Two things live here rather than in the routes

validateFixtures is shared with add-staged-fixtures deliberately. "Every code is a real team in
this list, each team appears once, nobody plays themselves" is one rule, and a block that passes
it must still pass it when promoted into fixture_load - otherwise promotion could fail on data
the calendar screen had already accepted.

loadBlocks derives lock_time as MIN(kickoff_time) over a block's items, the same derivation
services/fixtureService.js:248-251 uses for a staged batch. Deliberately not a stored column: a
lock time that can disagree with the fixtures it locks is worse than no lock time at all.
=======================================================================================================================================
*/

const { query } = require('../database');

/** Longest label the organiser-facing start options can carry, e.g. 'Sat 29 Aug'. */
const LABEL_MAX = 60;

/**
 * Check a set of home/away pairs against a team list.
 *
 * @param {number} teamListId
 * @param {Array<{home_team_short: string, away_team_short: string}>} pairs
 * @param {string} teamListName - for the error messages
 * @returns {Promise<{ok: true} | {ok: false, message: string}>}
 */
async function validateFixtures(teamListId, pairs, teamListName) {
  if (!Array.isArray(pairs) || pairs.length === 0) {
    return { ok: false, message: 'Add at least one fixture' };
  }

  const teamsResult = await query(
    'SELECT short_name FROM team WHERE team_list_id = $1 AND is_active = true',
    [teamListId]
  );
  const validShortNames = new Set(teamsResult.rows.map((row) => row.short_name));

  const seen = new Set();
  for (let i = 0; i < pairs.length; i++) {
    const { home_team_short: home, away_team_short: away } = pairs[i] || {};

    if (!home || !away) {
      return { ok: false, message: `Fixture ${i + 1} is missing a home or away team` };
    }

    if (home === away) {
      return { ok: false, message: `Fixture ${i + 1} has ${home} playing itself` };
    }

    for (const code of [home, away]) {
      if (!validShortNames.has(code)) {
        return { ok: false, message: `"${code}" is not a team in ${teamListName}` };
      }
      // Two fixtures for the same team in one round would give a player an unresolvable pick.
      if (seen.has(code)) {
        return { ok: false, message: `${code} appears more than once` };
      }
      seen.add(code);
    }
  }

  return { ok: true };
}

/**
 * Blocks for one team list, soonest lock time first, each with its fixtures.
 *
 * Ordered by lock time rather than created_at because that is the order the operator thinks in
 * and the order the organiser's start options are offered in. A block keyed out of sequence
 * should still appear where its fixtures put it.
 *
 * @param {number} teamListId
 * @returns {Promise<Array>} blocks, each with fixtures[], lock_time, and competition_count
 */
async function loadBlocks(teamListId) {
  const blocksResult = await query(`
    SELECT
      b.id,
      b.label,
      b.opens_gameweek,
      b.staged_at,
      b.created_at,
      (SELECT MIN(i.kickoff_time) FROM fixture_block_item i WHERE i.block_id = b.id) AS lock_time,
      -- Competitions whose round 1 came from this block. Deleting a block with any is refused:
      -- their round would lose its fixtures.
      (SELECT COUNT(*) FROM round r WHERE r.source_block_id = b.id) AS competition_count
    FROM fixture_block b
    WHERE b.team_list_id = $1
    ORDER BY lock_time NULLS LAST, b.id
  `, [teamListId]);

  if (blocksResult.rows.length === 0) return [];

  // One query for every block's fixtures rather than one per block, then grouped in JS.
  const blockIds = blocksResult.rows.map((row) => row.id);
  const itemsResult = await query(`
    SELECT
      i.id,
      i.block_id,
      i.home_team_short,
      i.away_team_short,
      i.kickoff_time,
      home.name AS home_team_name,
      away.name AS away_team_name
    FROM fixture_block_item i
    LEFT JOIN team home ON home.short_name = i.home_team_short AND home.team_list_id = $2
    LEFT JOIN team away ON away.short_name = i.away_team_short AND away.team_list_id = $2
    WHERE i.block_id = ANY($1::int[])
    ORDER BY i.kickoff_time, i.id
  `, [blockIds, teamListId]);

  const itemsByBlock = new Map(blockIds.map((id) => [id, []]));
  for (const item of itemsResult.rows) {
    itemsByBlock.get(item.block_id).push({
      id: item.id,
      home_team_short: item.home_team_short,
      away_team_short: item.away_team_short,
      // Falls back to the code so a team retired from the list still renders as something.
      home_team_name: item.home_team_name || item.home_team_short,
      away_team_name: item.away_team_name || item.away_team_short,
      kickoff_time: item.kickoff_time
    });
  }

  return blocksResult.rows.map((row) => ({
    id: row.id,
    label: row.label,
    opens_gameweek: row.opens_gameweek,
    staged_at: row.staged_at,
    created_at: row.created_at,
    lock_time: row.lock_time,
    competition_count: parseInt(row.competition_count, 10),
    fixtures: itemsByBlock.get(row.id) || []
  }));
}

/**
 * The team list a block belongs to, with the list's name, or null if the block does not exist.
 *
 * @param {number} blockId
 * @returns {Promise<{block_id: number, team_list_id: number, team_list_name: string,
 *                    opens_gameweek: boolean, staged_at: string|null,
 *                    competition_count: number} | null>}
 */
async function loadBlockContext(blockId) {
  const result = await query(`
    SELECT
      b.id AS block_id,
      b.team_list_id,
      b.opens_gameweek,
      b.staged_at,
      tl.name AS team_list_name,
      (SELECT COUNT(*) FROM round r WHERE r.source_block_id = b.id) AS competition_count
    FROM fixture_block b
    JOIN team_list tl ON tl.id = b.team_list_id
    WHERE b.id = $1
  `, [blockId]);

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    block_id: row.block_id,
    team_list_id: row.team_list_id,
    team_list_name: row.team_list_name,
    opens_gameweek: row.opens_gameweek,
    staged_at: row.staged_at,
    competition_count: parseInt(row.competition_count, 10)
  };
}

module.exports = { LABEL_MAX, validateFixtures, loadBlocks, loadBlockContext };
