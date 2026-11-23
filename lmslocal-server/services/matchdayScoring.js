/*
=======================================================================================================================================
services/matchdayScoring.js — settling Matchday predictions, and deciding when the game is over
=======================================================================================================================================
Purpose: The Matchday half of step 3 of routes/admin/push-results-to-competition.js. That route
         does everything game-agnostic - writes fixture.result from the staged batch, refuses an
         unlocked round, claims the unprocessed fixtures - and then hands the claimed fixtures
         here instead of to the Last Man Standing elimination code. docs/matchday.md §5.

THE SCORING RULE LIVES HERE AND NOWHERE ELSE: predicted team wins +3, draw +1, predicted team loses 0.
3 / 1 / 0 since 2026-11-23 (it was 3 / 1 / -1): no score is ever negative, so a total only ever
goes up and the table needs no floor. docs/matchday.md §1.
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

// For the record and for anyone reading a points column: the values settling writes. A loss
// and the hand fix of a postponed match are both 0; won / drew / lost is read from the result,
// never from the points (matchdayTable.js).
const POINTS = { WIN: 3, DRAW: 1, LOSS: 0 };

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

/*
THE ENDING IS A NUMBER OF ROUNDS, from a fixed list (decided 2026-11-22). Points targets were
withdrawn the same day, for two reasons:

  - They were far too short. Simulated with ten matches a round, twelve players and a mix of
    favourite-pickers and coin-flippers, one player's round scores a median of about 11, so
    "first to 10" and "first to 20" ended in round 1 and "first to 40" in round 3. A target long
    enough to matter (about 100 for six rounds) is a number nobody can picture.
  - A race to a target has a length nobody can tell players in advance, and a runaway leader
    ends it early for everyone. A number of rounds is a date in the diary, like a season.

Last Man Standing usually lasts about six rounds, so six is the default, with four and eight
either side. The web offers the same list from lmslocal-web/src/lib/games.ts - change both together.

end_rule 'points' is still valid in the column, and settleMatchdayRound still ends such a game,
for the two test competitions created before this. Nothing new can choose it.
*/
const ENDING_CHOICES = {
  rounds: [4, 6, 8]
};

/**
 * What is wrong with a proposed ending, or null if nothing is. The one definition, used by
 * create-competition and update-competition so the two cannot accept different games.
 *
 * @param {any} endRule - must be 'rounds'
 * @param {any} endValue - one of ENDING_CHOICES.rounds
 * @returns {string|null} a message an organiser can act on
 */
function endingProblem(endRule, endValue) {
  const choices = ENDING_CHOICES.rounds;
  if (endRule !== 'rounds' || !choices.includes(Number(endValue))) {
    // "4, 6 or 8"
    return `Choose how many rounds the game lasts: ${choices.slice(0, -1).join(', ')} or ${choices[choices.length - 1]}`;
  }
  return null;
}

module.exports = { settleMatchdayRound, endingProblem, ENDING_CHOICES, POINTS };
