/*
=======================================================================================================================================
Stage Block Service: copy a calendar block into fixture_load, then push it to every eligible competition
=======================================================================================================================================
Purpose: The one implementation of Stage, used by two callers:

           - promote-fixture-block - the operator pressing Stage on the calendar
           - clear-staged-batch    - closing a gameweek stages the next block itself

         Both used to stop at fixture_load and leave the push to the operator, one competition at
         a time. Each press was a formality - see docs/competition-start.md §7 - so the push now
         follows the stage, each competition in its own transaction after the copy has committed.
         The stage stands whatever the pushes do.

         findNextBlock() is the server's copy of the calendar screen's "which block offers Stage"
         rule (stageableId in lmslocal-admin/.../fixtures/calendar/page.tsx). Change both.
=======================================================================================================================================
*/

const { query, transaction } = require('../database');
const { loadBlockContext } = require('./fixtureBlock');
const { getFixturePushCandidates, pushFixturesToCompetition } = require('./fixtureService');

/**
 * The block a close should stage next: the soonest not yet staged, with fixtures, whose first
 * kickoff is still ahead. "Soonest that could take it" rather than literally the first, so one
 * stale block whose kickoff passed unstaged cannot stop the calendar.
 *
 * @returns {Promise<{block_id: number, label: string}|null>}
 */
async function findNextBlock(teamListId) {
  const result = await query(`
    SELECT b.id AS block_id, b.label
    FROM fixture_block b
    JOIN LATERAL (
      SELECT MIN(i.kickoff_time) AS lock_time FROM fixture_block_item i WHERE i.block_id = b.id
    ) k ON TRUE
    WHERE b.team_list_id = $1
      AND b.staged_at IS NULL
      AND k.lock_time > NOW()
    ORDER BY k.lock_time, b.id
    LIMIT 1
  `, [teamListId]);

  return result.rows[0] || null;
}

/**
 * Pushes the staged batch to every competition the candidate list calls eligible, one
 * transaction each. Never throws per competition: each comes back pushed, skipped or failed.
 */
async function pushToEligible(teamListId) {
  const { competitions: candidates } = await getFixturePushCandidates({ query }, teamListId);
  const outcomes = [];

  // Sequential, not Promise.all - they share the pool with every live request, and the whole
  // run is a dozen short transactions.
  for (const candidate of candidates) {
    const row = {
      competition_id: candidate.competition_id,
      name: candidate.name,
      outcome: 'skipped',
      round_number: null,
      round_action: null,
      reason: candidate.reason,
    };

    if (candidate.eligible) {
      try {
        const pushed = await transaction((client) => pushFixturesToCompetition(client, candidate.competition_id));
        row.outcome = 'pushed';
        row.round_number = pushed.round_number;
        row.round_action = pushed.round_action;
      } catch (error) {
        // NOT_ELIGIBLE here means something changed since the list was read - a round started
        // through Ready a moment ago - which is a skip with a reason, not a failure.
        if (error.message === 'NOT_ELIGIBLE') {
          row.reason = error.reason || 'No longer eligible';
        } else {
          console.error('stageBlock push failed:', candidate.competition_id, error.message);
          row.outcome = 'failed';
          row.reason = 'Push failed - try it from the Fixtures screen';
        }
      }
    }

    outcomes.push(row);
  }

  return outcomes;
}

/**
 * Stages one block and pushes it. Returns a response body for promote-fixture-block - every
 * refusal as its return_code - so both callers report the same words.
 *
 * Throws only on an unexpected database error before the stage commits.
 */
async function stageBlock(blockId) {
  // The block must exist and not already be out.
  const context = await loadBlockContext(blockId);

  if (!context) {
    return { return_code: 'BLOCK_NOT_FOUND', message: 'That block no longer exists' };
  }

  if (context.staged_at) {
    return { return_code: 'ALREADY_PROMOTED', message: 'This block has already been staged' };
  }

  // One batch at a time - the same rule add-staged-fixtures enforces.
  const pendingResult = await query(
    'SELECT COUNT(*) AS count FROM fixture_load WHERE team_list_id = $1',
    [context.team_list_id]
  );

  if (parseInt(pendingResult.rows[0].count, 10) > 0) {
    return {
      return_code: 'PENDING_BATCH',
      message: `${context.team_list_name} already has a staged batch. Push it to every competition and clear it before staging this one.`
    };
  }

  // The block must have fixtures, and they must still be ahead of us.
  const itemsResult = await query(`
    SELECT home_team_short, away_team_short, kickoff_time
    FROM fixture_block_item
    WHERE block_id = $1
    ORDER BY kickoff_time
  `, [blockId]);

  if (itemsResult.rows.length === 0) {
    return { return_code: 'VALIDATION_ERROR', message: 'That block has no fixtures in it' };
  }

  // Ordered by kickoff, so the first row carries the lock time.
  const lockTime = itemsResult.rows[0].kickoff_time;

  if (new Date(lockTime) <= new Date()) {
    return {
      return_code: 'KICKOFF_PASSED',
      message: 'The first kick off in this block has already passed, so it would create a round nobody could pick in.'
    };
  }

  // Copy into fixture_load and mark the block as gone, together.
  await transaction(async (client) => {
    for (const item of itemsResult.rows) {
      await client.query(`
        INSERT INTO fixture_load
          (team_list_id, league, home_team_short, away_team_short, kickoff_time, opens_gameweek,
           source_block_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        context.team_list_id,
        context.team_list_name,       // league - the list's own name, as add-staged-fixtures does
        item.home_team_short,
        item.away_team_short,
        item.kickoff_time,
        // Carried from the block rather than re-asked. Whoever keyed the block already
        // answered this, and answering it twice invites the two disagreeing.
        context.opens_gameweek,
        // What lets the push find the provisional rounds already created against this block
        // and reconcile them, instead of giving those competitions a second round 1.
        blockId
      ]);
    }

    await client.query(
      'UPDATE fixture_block SET staged_at = NOW() WHERE id = $1',
      [blockId]
    );
  });

  // A failure reading the candidate list must not turn a committed stage into an error - the
  // operator would try again and be told it is already staged. null, not [], so the screen can
  // tell "the push never ran" from "nobody was eligible".
  let competitions = null;
  try {
    competitions = await pushToEligible(context.team_list_id);
  } catch (error) {
    console.error('stageBlock candidate list failed:', error.message);
  }

  return {
    return_code: 'SUCCESS',
    block_id: blockId,
    fixtures_staged: itemsResult.rows.length,
    team_list_id: context.team_list_id,
    lock_time: lockTime,
    pushed_count: competitions ? competitions.filter((c) => c.outcome === 'pushed').length : 0,
    competitions
  };
}

module.exports = {
  findNextBlock,
  stageBlock
};
