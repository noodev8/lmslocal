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
 * How soon a block may be offered as a competition's start.
 *
 * This replaces the 48 hours the old Ready button needed. That existed because Ready was a
 * standing order with no date attached: an organiser pressing it on Friday could be handed
 * Saturday's matches before they had told anybody. Choosing a dated block up front removes the
 * surprise - the date is picked deliberately and every player sees it the moment they join - so
 * all that is left is enough time to actually get a pick in.
 *
 * One hour, because three friends deciding on a Saturday morning to play that afternoon is a
 * real thing we should not be in the way of.
 */
const START_LEAD_TIME_HOURS = 1;
const START_LEAD_TIME_MS = START_LEAD_TIME_HOURS * 60 * 60 * 1000;

/** How many start dates a new organiser is offered. Three is a decision; a calendar is homework. */
const MAX_START_OPTIONS = 3;

/**
 * How close the soonest option may be and still be the DEFAULT.
 *
 * Distinct from START_LEAD_TIME_HOURS, which decides what is offered at all. An organiser who
 * deliberately picks a round starting tonight should be able to; one who accepts whatever was
 * preselected should not find they have two hours to get everybody in. So the soonest date is
 * offered, and defaulted to, unless it is inside this - then the default moves out one.
 */
const DEFAULT_MIN_HOURS = 48;

/*
Whether a block may still be offered as a start date.

Two kinds qualify, and this is why hand-staged batches now get a block of their own
(routes/admin/add-staged-fixtures.js):

  - not yet promoted - a future calendar block, the ordinary case
  - promoted, still sitting in fixture_load, and no results entered against it. That is the batch
    going out right now, and it is the SOONEST round a new competition could join. Leaving it out
    meant an organiser was offered dates two and three weeks away while a round starting this
    Friday was already staged and invisible to them.

A batch with any result entered is excluded: that round is being played, and a competition created
onto it would receive a round that arrived already decided.
*/
const OFFERABLE_BLOCK_SQL = `(
  b.staged_at IS NULL
  OR (
    EXISTS (SELECT 1 FROM fixture_load fl WHERE fl.source_block_id = b.id)
    AND NOT EXISTS (
      SELECT 1 FROM fixture_load fl WHERE fl.source_block_id = b.id AND fl.home_score IS NOT NULL
    )
  )
)`;

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

/**
 * The blocks a new competition on this team list could start on, soonest first.
 *
 * Three conditions, and each one is a rule that would otherwise bite later:
 *   - offerable (see OFFERABLE_BLOCK_SQL) - a future calendar block, or the batch staged right
 *     now with no results against it, which is the soonest round anybody could join.
 *   - opens_gameweek. A real gameweek staged as several blocks must not start anybody on its
 *     Sunday slice, or their round 1 is two matches while everyone else plays ten.
 *   - lock time beyond the lead time. Below that there is not enough time to make a pick.
 *
 * Deliberately returns no fixtures. The organiser is choosing WHEN their competition starts, not
 * which matches are in it - showing ten fixtures invites them to shop between gameweeks, a choice
 * they have no basis to make. The players see the fixtures, on the pick screen.
 *
 * @param {object} client - a transaction client, or the shared query helper's caller
 * @param {number} teamListId
 * @returns {Promise<Array<{id, label, lock_time, fixture_count, staged}>>} up to MAX_START_OPTIONS
 */
async function getStartOptions(client, teamListId) {
  const result = await client.query(`
    SELECT
      b.id,
      b.label,
      b.staged_at IS NOT NULL AS staged,
      MIN(i.kickoff_time) AS lock_time,
      COUNT(i.id) AS fixture_count
    FROM fixture_block b
    JOIN fixture_block_item i ON i.block_id = b.id
    WHERE b.team_list_id = $1
      AND b.opens_gameweek = true
      AND ${OFFERABLE_BLOCK_SQL}
    GROUP BY b.id
    HAVING MIN(i.kickoff_time) > NOW() + ($2 || ' hours')::interval
    ORDER BY lock_time
    LIMIT $3
  `, [teamListId, START_LEAD_TIME_HOURS, MAX_START_OPTIONS]);

  return result.rows.map((row) => ({
    id: row.id,
    label: row.label,
    lock_time: row.lock_time,
    fixture_count: parseInt(row.fixture_count, 10),
    // True for the batch already staged - its fixtures are confirmed rather than provisional.
    staged: row.staged
  }));
}

/**
 * Which option to preselect.
 *
 * **The soonest, unless it is inside DEFAULT_MIN_HOURS** - then the next one out. An organiser who
 * accepts the default should always have a couple of days to get people in; one who deliberately
 * picks tonight's round still can, because every option remains selectable.
 *
 * Falls back to the last option when every one is inside the window, since that is the most notice
 * available. Null for an empty list.
 *
 * @param {Array<{id, lock_time}>} options - as returned by getStartOptions, soonest first
 * @returns {number|null} block id to preselect
 */
function recommendedFrom(options, now = new Date()) {
  if (!options || options.length === 0) return null;

  const floor = now.getTime() + DEFAULT_MIN_HOURS * 60 * 60 * 1000;
  const comfortable = options.find((option) => new Date(option.lock_time).getTime() >= floor);

  return (comfortable ?? options[options.length - 1]).id;
}

/**
 * Re-check one chosen block at the moment a competition is created, and hand back its fixtures.
 *
 * Separate from getStartOptions because the two answer different questions. That one asks "what
 * could be offered", minutes ago, to build a form. This asks "is this exact block still a legal
 * start, right now" - the block could have been promoted, edited or deleted in between, and the
 * id arrives from a browser either way.
 *
 * @returns {Promise<{ok: true, block: object, fixtures: Array, lockTime: string}
 *                 | {ok: false, code: string, message: string}>}
 */
async function loadBlockForStart(client, blockId, teamListId) {
  const blockResult = await client.query(
    `SELECT b.id, b.team_list_id, b.label, b.opens_gameweek, b.staged_at,
            ${OFFERABLE_BLOCK_SQL} AS offerable
     FROM fixture_block b WHERE b.id = $1`,
    [blockId]
  );

  if (blockResult.rows.length === 0) {
    return { ok: false, code: 'START_BLOCK_UNAVAILABLE', message: 'That start date is no longer available. Choose another.' };
  }

  const block = blockResult.rows[0];

  // Wrong team list would give the competition fixtures full of teams its players cannot pick.
  if (block.team_list_id !== teamListId) {
    return { ok: false, code: 'START_BLOCK_UNAVAILABLE', message: 'That start date is not available for this team list.' };
  }

  // Same rule getStartOptions offers on, so a date that was on the form is still a legal answer.
  // It stops being one once the batch is resulted or cleared, which is what this re-check catches.
  if (block.offerable !== true || block.opens_gameweek !== true) {
    return { ok: false, code: 'START_BLOCK_UNAVAILABLE', message: 'That start date is no longer available. Choose another.' };
  }

  const itemsResult = await client.query(
    `SELECT home_team_short, away_team_short, kickoff_time
     FROM fixture_block_item WHERE block_id = $1 ORDER BY kickoff_time`,
    [blockId]
  );

  if (itemsResult.rows.length === 0) {
    return { ok: false, code: 'START_BLOCK_UNAVAILABLE', message: 'That start date has no fixtures. Choose another.' };
  }

  // Ordered by kickoff, so the first row carries the lock time.
  const lockTime = itemsResult.rows[0].kickoff_time;

  if (new Date(lockTime).getTime() - Date.now() < START_LEAD_TIME_MS) {
    return {
      ok: false,
      code: 'START_BLOCK_TOO_SOON',
      message: `That round kicks off too soon to start a competition on. Pick a later date.`
    };
  }

  return { ok: true, block, fixtures: itemsResult.rows, lockTime };
}

/**
 * Build a competition's round 1 from a calendar block, fixtures and all.
 *
 * The one implementation, shared by create-competition and reset-competition. A reset empties a
 * competition back to nothing, which is the same problem as creating one: an empty screen, and
 * players who have to be told when it starts. Both therefore ask the same question and build the
 * round the same way.
 *
 * Caller must be inside a transaction - this writes a round and its fixtures and they must
 * arrive together.
 *
 * @throws {Error} `START_BLOCK_UNAVAILABLE: message` or `START_BLOCK_TOO_SOON: message`
 * @returns {Promise<{roundId: number, label: string, lockTime: string, fixtureCount: number}>}
 */
async function createRoundFromBlock(client, competitionId, teamListId, blockId) {
  // Re-checked here, not trusted from the form: the block could have been promoted, edited or
  // deleted since the options were loaded, and the id arrives from a browser.
  const start = await loadBlockForStart(client, blockId, teamListId);
  if (!start.ok) {
    throw new Error(`${start.code}: ${start.message}`);
  }

  /*
  source_block_id marks the round PROVISIONAL - "these fixtures are a copy of a calendar entry,
  replace them when the confirmed batch arrives". The fixtures push finds a round by it, rebuilds
  the fixtures and clears it (services/fixtureService.js).

  An already-staged block has no unconfirmed self to be replaced by: its fixtures ARE the batch
  sitting in fixture_load, so the copy taken below is the confirmed one from the moment it is
  written. Marking it provisional was wrong twice over - the push would delete and rebuild ten
  identical fixtures, needlessly clearing and re-pointing every pick made in the meantime, and if
  no push ever came (the ordinary case - results arrive and the round is simply resolved) the mark
  stayed on the round forever. Nine rounds from the 21 Aug batch are still carrying it.

  With no mark the push sees an ordinary round_in_progress and skips the competition, which is the
  honest answer: the round already holds this exact batch, so there is nothing to push into it.
  Results still reach it - push-results-to-competition matches on teams and kickoff, never blocks.
  */
  const provisional = start.block.staged_at === null;

  const roundResult = await client.query(`
    INSERT INTO round (competition_id, round_number, lock_time, source_block_id, created_at)
    VALUES ($1, 1, $2, $3, CURRENT_TIMESTAMP)
    RETURNING id
  `, [competitionId, start.lockTime, provisional ? blockId : null]);

  const roundId = roundResult.rows[0].id;

  // Full team names are resolved now rather than at push time, because these fixtures are shown
  // to players from this moment on - that is the whole point of creating the round early.
  const teamsResult = await client.query(
    `SELECT short_name, name FROM team WHERE team_list_id = $1 AND is_active = true`,
    [teamListId]
  );
  const teamNames = {};
  teamsResult.rows.forEach((team) => { teamNames[team.short_name] = team.name; });

  for (const fixture of start.fixtures) {
    await client.query(`
      INSERT INTO fixture (
        round_id, competition_id, home_team, away_team,
        home_team_short, away_team_short, kickoff_time, round_number, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 1, CURRENT_TIMESTAMP)
    `, [
      roundId,
      competitionId,
      teamNames[fixture.home_team_short] || fixture.home_team_short,
      teamNames[fixture.away_team_short] || fixture.away_team_short,
      fixture.home_team_short,
      fixture.away_team_short,
      fixture.kickoff_time
    ]);
  }

  return {
    roundId,
    label: start.block.label,
    lockTime: start.lockTime,
    fixtureCount: start.fixtures.length
  };
}

module.exports = {
  LABEL_MAX,
  START_LEAD_TIME_HOURS,
  DEFAULT_MIN_HOURS,
  MAX_START_OPTIONS,
  recommendedFrom,
  validateFixtures,
  loadBlocks,
  loadBlockContext,
  getStartOptions,
  loadBlockForStart,
  createRoundFromBlock
};
