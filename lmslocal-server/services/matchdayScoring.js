/*
=======================================================================================================================================
services/matchdayScoring.js — settling Matchday predictions, and deciding when the game is over
=======================================================================================================================================
Purpose: The Matchday half of step 3 of routes/admin/push-results-to-competition.js. That route
         does everything game-agnostic - writes fixture.result from the staged batch, refuses an
         unlocked round, claims the unprocessed fixtures - and then hands the claimed fixtures
         here instead of to the Last Man Standing elimination code. docs/matchday.md §5.

THE SCORING RULE LIVES HERE AND NOWHERE ELSE: backed team wins +3, draw +1, backed team loses -1.
The rework the user has asked for later (docs/matchday.md §1.3, nobody pulling out of reach) is a
change to this file and matchdayTable.js, not a hunt through routes.

ONE STATEMENT PER PUSH, not a loop. LMS settles pick by pick because each one can move a player's
lives; a prediction's points depend only on its own fixture's result, so the whole batch is one
UPDATE ... FROM fixture.

THERE IS NO NO-PICK STEP. A skipped fixture has no prediction row and scores 0. Unlike LMS, not
taking part in a match costs nothing, so there is nothing to apply when the round closes.

A postponed match is not handled here yet (docs/matchday.md §5.4): it is fixed by hand in the
database, by setting its predictions to 0 and stamping the fixture processed.
=======================================================================================================================================
*/

const { getMatchdayTable } = require('./matchdayTable');

// For the record and for anyone reading a points column: the values settling writes. 0 is
// allowed by the table's CHECK as well, for the hand fix of a postponed match.
const POINTS = { WIN: 3, DRAW: 1, LOSS: -1 };

/**
 * Settle the predictions on fixtures the caller has just claimed, then end the game if this
 * round finished it.
 *
 * Runs inside the push's transaction, after its claim (UPDATE fixture SET processed = NOW()
 * ... WHERE processed IS NULL). That claim is what makes a concurrent second push a no-op; the
 * `points IS NULL` below is a second fence, not the first.
 *
 * @param {object} client - the push's open transaction
 * @param {object} args
 * @param {number} args.competitionId
 * @param {number} args.roundId
 * @param {number} args.roundNumber
 * @param {number[]} args.fixtureIds - the fixtures claimed by this push
 * @returns {Promise<{predictions_settled: number, round_settled: boolean,
 *   competition_status: string, leader: {display_name: string, total: number}|null,
 *   winners: string[]}>}
 */
async function settleMatchdayRound(client, { competitionId, roundId, roundNumber, fixtureIds }) {
  const settleResult = await client.query(`
    UPDATE prediction p
    SET points = CASE
                   WHEN f.result = 'DRAW' THEN ${POINTS.DRAW}
                   WHEN f.result = p.team THEN ${POINTS.WIN}
                   ELSE ${POINTS.LOSS}
                 END,
        updated_at = NOW()
    FROM fixture f
    WHERE p.fixture_id = f.id
      AND f.id = ANY($1::integer[])
      AND f.result IS NOT NULL
      AND p.points IS NULL
  `, [fixtureIds]);

  // Completion is only ever judged on a whole round, the same gate LMS uses: with half the
  // weekend's results in, a total that crosses the target could still be overtaken.
  const roundResult = await client.query(`
    SELECT COUNT(*) AS total, COUNT(processed) AS processed
    FROM fixture
    WHERE round_id = $1
  `, [roundId]);
  const total = parseInt(roundResult.rows[0].total, 10);
  const roundSettled = total > 0 && total === parseInt(roundResult.rows[0].processed, 10);

  const table = await getMatchdayTable(competitionId, { client });
  const leaderRow = table.rows[0] || null;

  let competitionStatus = 'active';
  let winners = [];

  if (roundSettled) {
    const competitionResult = await client.query(
      `SELECT end_rule, end_value FROM competition WHERE id = $1`,
      [competitionId]
    );
    const { end_rule: endRule, end_value: endValue } = competitionResult.rows[0];

    const finished = endRule === 'rounds'
      ? roundNumber >= endValue
      : Boolean(leaderRow) && leaderRow.total >= endValue;

    if (finished) {
      // Everyone in first place, after the tie-breaks. More than one is a shared win, recorded
      // as winner_id NULL - which already means "no single winner" for LMS - with the names
      // carried by the table rather than by the column.
      const firstPlace = table.rows.filter(row => row.position === 1);
      winners = firstPlace.map(row => row.display_name);

      await client.query(`
        UPDATE competition
        SET status = 'COMPLETE', winner_id = $2
        WHERE id = $1
      `, [competitionId, firstPlace.length === 1 ? firstPlace[0].user_id : null]);

      competitionStatus = 'COMPLETE';
    }
  }

  return {
    predictions_settled: settleResult.rowCount || 0,
    round_settled: roundSettled,
    competition_status: competitionStatus,
    leader: leaderRow ? { display_name: leaderRow.display_name, total: leaderRow.total } : null,
    winners
  };
}

module.exports = { settleMatchdayRound, POINTS };
