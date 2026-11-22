/*
=======================================================================================================================================
services/matchdayTable.js — the Matchday league table, the one place running totals are calculated
=======================================================================================================================================
Purpose: Every player's total, position and tie-break figures for one Matchday competition.
         Read by the table route, the completion check in matchdayScoring.js and, later, the
         dashboard and emails - so a total on one screen is the total on every other.

TOTALS ARE DERIVED, NEVER STORED. The stored allowed_teams copy is why (docs/allowed-teams.md):
it drifted from the picks it was copied from. prediction.points records what happened to each
prediction; a total is a fold over them, recalculated on every read. One query, players x rounds,
which is small.

THE FLOOR IS APPLIED PER ROUND (docs/matchday.md §1.1):

    total = max(0, total + round score)            for each SETTLED round, in round order

A round is settled when every one of its fixtures is processed. The round still being played -
results arriving in pushes on a Friday night and a Saturday - is added the same way but marked
provisional, so the table shows max(0, settled total + points so far) and says it may move.
Per-fixture flooring was rejected because the answer would depend on which push carried which
result; flooring only the displayed total was rejected because it hides a debt below zero.

TIE-BREAK (docs/matchday.md §1): total, then wins, then predictions made. Equal on all three is
a shared position, and at the end of the game a shared win.

"Predictions made" counts SETTLED predictions - those with points. At the end of the game every
prediction is settled except one whose match was never played (fixture_id cleared by a
reconcile, or a postponement fixed by hand to 0), so the count is the number of matches the
player backed that counted. Mid-round it is the number counted so far, which is what the table is
showing alongside it.
=======================================================================================================================================
*/

const { query } = require('../database');

/**
 * The table for one competition, best first.
 *
 * @param {number} competitionId
 * @param {object} [opts]
 * @param {object} [opts.client] - an open pg client, to read inside the caller's transaction.
 *   The completion check needs this: it must see the predictions it has just settled.
 * @returns {Promise<{rows: Array<{position: number, user_id: number, display_name: string,
 *   total: number, wins: number, draws: number, losses: number, predictions: number,
 *   provisional: boolean}>, rounds_settled: number, latest_round_number: number|null,
 *   latest_round_settled: boolean}>}
 */
async function getMatchdayTable(competitionId, { client } = {}) {
  const run = client ? (text, params) => client.query(text, params) : query;

  /*
  Every member crossed with every round, so a player with no predictions in a round still gets a
  row for it (and a round score of 0), and a member with no predictions at all still appears on
  the table on 0. The LEFT JOIN to rounds keeps members of a competition with no rounds yet.
  */
  const result = await run(`
    WITH rounds AS (
      SELECT r.id, r.round_number,
             COUNT(f.id) AS fixtures,
             COUNT(f.processed) AS processed
      FROM round r
      LEFT JOIN fixture f ON f.round_id = r.id
      WHERE r.competition_id = $1
      GROUP BY r.id, r.round_number
    ),
    scores AS (
      SELECT p.user_id, p.round_id,
             COALESCE(SUM(p.points), 0)                AS points,
             COUNT(*) FILTER (WHERE p.points = 3)      AS wins,
             COUNT(*) FILTER (WHERE p.points = 1)      AS draws,
             COUNT(*) FILTER (WHERE p.points = -1)     AS losses,
             COUNT(p.points)                           AS settled
      FROM prediction p
      WHERE p.competition_id = $1
      GROUP BY p.user_id, p.round_id
    )
    SELECT cu.user_id,
           COALESCE(cu.player_display_name, u.display_name, 'Player') AS display_name,
           r.round_number,
           (r.fixtures > 0 AND r.fixtures = r.processed)    AS round_settled,
           COALESCE(s.points, 0)  AS points,
           COALESCE(s.wins, 0)    AS wins,
           COALESCE(s.draws, 0)   AS draws,
           COALESCE(s.losses, 0)  AS losses,
           COALESCE(s.settled, 0) AS settled
    FROM competition_user cu
    JOIN app_user u ON u.id = cu.user_id
    LEFT JOIN rounds r ON true
    LEFT JOIN scores s ON s.user_id = cu.user_id AND s.round_id = r.id
    WHERE cu.competition_id = $1
    ORDER BY cu.user_id, r.round_number
  `, [competitionId]);

  const players = new Map();
  let latestRoundNumber = null;
  let latestRoundSettled = false;
  const settledRounds = new Set();

  for (const row of result.rows) {
    if (!players.has(row.user_id)) {
      players.set(row.user_id, {
        user_id: row.user_id,
        display_name: row.display_name,
        total: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        predictions: 0,
        provisional: false
      });
    }

    // A member of a competition with no rounds yet: one row, round columns null. They stay on 0.
    if (row.round_number === null) continue;

    const player = players.get(row.user_id);
    const settled = parseInt(row.settled, 10);

    // Rows arrive in round order per player (ORDER BY above), which is what makes the per-round
    // floor a straight fold.
    player.total = Math.max(0, player.total + parseInt(row.points, 10));
    player.wins += parseInt(row.wins, 10);
    player.draws += parseInt(row.draws, 10);
    player.losses += parseInt(row.losses, 10);
    player.predictions += settled;

    if (!row.round_settled && settled > 0) {
      player.provisional = true;
    }

    if (latestRoundNumber === null || row.round_number > latestRoundNumber) {
      latestRoundNumber = row.round_number;
      latestRoundSettled = row.round_settled;
    }
    if (row.round_settled) settledRounds.add(row.round_number);
  }

  return {
    rows: rankTable(Array.from(players.values())),
    rounds_settled: settledRounds.size,
    latest_round_number: latestRoundNumber,
    latest_round_settled: latestRoundSettled
  };
}

/**
 * Order the table and give each row its position. Pure, so the tie-break can be checked without
 * a database.
 *
 * Standard competition ranking (1, 2, 2, 4): a position is shared only when total, wins and
 * predictions are all equal. The name orders rows that share a position, and is never a
 * tie-break.
 *
 * @param {Array<{display_name: string, total: number, wins: number, predictions: number}>} players
 * @returns {Array} the same objects, sorted, each with `position` set
 */
function rankTable(players) {
  const rows = players.slice().sort((a, b) =>
    b.total - a.total
    || b.wins - a.wins
    || b.predictions - a.predictions
    || a.display_name.localeCompare(b.display_name)
  );

  rows.forEach((row, index) => {
    const previous = rows[index - 1];
    const tied = previous
      && previous.total === row.total
      && previous.wins === row.wins
      && previous.predictions === row.predictions;
    row.position = tied ? previous.position : index + 1;
  });

  return rows;
}

module.exports = { getMatchdayTable, rankTable };
