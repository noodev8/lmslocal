/*
=======================================================================================================================================
Script: season-end-close.js
=======================================================================================================================================
Purpose: At the end of a season, finish every fixture-service competition that is still running, so
         none of them is carried into next season. docs/matchday.md §5.5.

WHY IT IS NEEDED. A competition finishes when its own rules say so - a Matchday game after its
number of rounds, an LMS game when one player is left. When the real season runs out first, nothing
finishes it: it sits "in progress" all summer, and when the first gameweek of the new season is
staged the push sees a competition ready for its next round and gives it one. Closing it here,
between the last results and that first Stage, is what keeps next season clean -
evaluateCompetition refuses a COMPLETE competition.

HOW EACH GAME ENDS (decided 2026-11-23, no organiser involved):
  - Matchday: on the table as it stands, by the same rule as a game that ran its course
    (completeMatchday in services/matchdayScoring.js). A tie at the top is a shared win.
  - LMS: a draw between everyone still in. winner_id stays NULL unless exactly one player is
    left, and the game_complete email already words 2+ survivors as a draw (services/gameComplete.js).
    The organiser is not asked: the terms say a game still running at the end of the season ends
    this way.

WHAT IT LEAVES ALONE:
  - A competition with no rounds yet. That is one waiting for next season, not one left over.
  - A competition whose latest round has a fixture without a processed result: it is still being
    played, and closing it would throw that round away. Reported, so the results can be pushed
    first and the script run again.
  - Organiser-run competitions (fixture_service = false). Their organiser supplies the fixtures
    and decides when the game is over.
  - Archived competitions are closed like any other - they still get fixtures, so they would be
    carried over too. They get no email either way (notArchivedSql).

Usage (from lmslocal-server/):
  node scripts/season-end-close.js --team-list 1                  # list what would be closed
  node scripts/season-end-close.js --team-list 1 --apply          # close them
  node scripts/season-end-close.js --competition 512 [--apply]    # one competition, e.g. a test

A dry run is the default and writes nothing. Each competition is closed in its own transaction,
so one failure does not undo the rest; run it again and the closed ones are no longer listed.
=======================================================================================================================================
*/

require('dotenv').config();
const { query, transaction, closePool } = require('../database');
const { completeMatchday } = require('../services/matchdayScoring');
const { getMatchdayTable } = require('../services/matchdayTable');

const args = process.argv.slice(2);
const apply = args.includes('--apply');

function option(name) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] !== undefined ? parseInt(args[index + 1], 10) : null;
}

const teamListId = option('--team-list');
const competitionId = option('--competition');

/**
 * The competitions still running, with what the close needs to know about each. One query: the
 * latest round's fixture counts and the survivors come from grouped subqueries, not per-row reads.
 */
async function findOpenCompetitions() {
  const filter = competitionId
    ? { sql: 'c.id = $1', params: [competitionId] }
    : { sql: 'c.team_list_id = $1 AND c.fixture_service = true', params: [teamListId] };

  const result = await query(`
    SELECT c.id, c.name, c.game_type, c.status, c.archived_at, c.end_value,
           u.display_name AS organiser_name,
           lr.round_number AS latest_round,
           COALESCE(lf.total, 0) AS latest_fixtures,
           COALESCE(lf.processed, 0) AS latest_processed,
           COALESCE(cu.active, 0) AS active_players
    FROM competition c
    JOIN app_user u ON u.id = c.organiser_id
    LEFT JOIN LATERAL (
      SELECT r.id, r.round_number FROM round r
      WHERE r.competition_id = c.id
      ORDER BY r.round_number DESC LIMIT 1
    ) lr ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS total, COUNT(f.processed) AS processed
      FROM fixture f WHERE f.round_id = lr.id
    ) lf ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*) FILTER (WHERE status = 'active') AS active
      FROM competition_user WHERE competition_id = c.id
    ) cu ON true
    WHERE ${filter.sql}
      AND UPPER(c.status) <> 'COMPLETE'
    ORDER BY c.game_type, c.id
  `, filter.params);

  return result.rows.map(row => ({
    ...row,
    latest_fixtures: parseInt(row.latest_fixtures, 10),
    latest_processed: parseInt(row.latest_processed, 10),
    active_players: parseInt(row.active_players, 10)
  }));
}

/** Why a competition is left open, or null if it is to be closed. */
function skipReason(competition) {
  if (!competition.latest_round) return 'no rounds yet - waiting for next season';
  if (competition.latest_fixtures === 0) return `round ${competition.latest_round} has no fixtures`;
  if (competition.latest_processed < competition.latest_fixtures) {
    return `round ${competition.latest_round} still has ${competition.latest_fixtures - competition.latest_processed} unprocessed fixture(s) - push results first`;
  }
  return null;
}

/** What the close will say happened, for the dry run and the audit log alike. */
async function describeOutcome(competition) {
  if (competition.game_type === 'matchday') {
    const table = await getMatchdayTable(competition.id);
    const top = table.rows.filter(row => row.position === 1);
    if (top.length === 0) return 'no players - closes with no winner';
    const names = top.map(row => row.display_name).join(', ');
    return `${top.length > 1 ? 'shared win' : 'won by'} ${names} on ${top[0].total} pts`;
  }
  if (competition.active_players === 1) return 'one player left - won';
  return `draw between the ${competition.active_players} still in`;
}

async function closeCompetition(competition, outcome) {
  await transaction(async (client) => {
    // Re-checked inside the transaction: a results push between the listing and here could have
    // finished it already, and must not be overwritten.
    const current = await client.query(
      `SELECT status FROM competition WHERE id = $1 FOR UPDATE`, [competition.id]
    );
    if (current.rows[0].status.toUpperCase() === 'COMPLETE') return;

    if (competition.game_type === 'matchday') {
      await completeMatchday(client, competition.id);
    } else {
      // Exactly one survivor is a winner; anything else is the draw. Survivors stay 'active',
      // which is how game_complete tells a draw from a win.
      await client.query(`
        UPDATE competition c
        SET status = 'COMPLETE',
            winner_id = (SELECT CASE WHEN COUNT(*) = 1 THEN MIN(user_id) END
                         FROM competition_user
                         WHERE competition_id = c.id AND status = 'active')
        WHERE c.id = $1
      `, [competition.id]);
    }

    await client.query(`
      INSERT INTO audit_log (competition_id, user_id, action, details)
      VALUES ($1, NULL, 'Season End Close', $2)
    `, [competition.id, `Closed at the end of the season after round ${competition.latest_round}: ${outcome}`]);
  });
}

const run = async () => {
  if (!teamListId && !competitionId) {
    console.error('\n  Give --team-list <id> (the season to close) or --competition <id>.\n');
    process.exitCode = 1;
    return;
  }

  console.log(`=== season-end-close ${apply ? '(APPLY)' : '(DRY RUN - nothing is written)'} ===\n`);

  const competitions = await findOpenCompetitions();
  if (competitions.length === 0) {
    console.log('Nothing open. Nothing to do.');
    return;
  }

  let closed = 0;
  let skipped = 0;

  for (const competition of competitions) {
    const label = `#${competition.id} ${competition.name} (${competition.game_type}, ${competition.organiser_name}`
      + `${competition.archived_at ? ', archived' : ''})`;
    const reason = skipReason(competition);

    if (reason) {
      skipped++;
      console.log(`  LEAVE  ${label}\n         ${reason}`);
      continue;
    }

    const outcome = await describeOutcome(competition);
    if (apply) {
      await closeCompetition(competition, outcome);
      console.log(`  CLOSED ${label}\n         after round ${competition.latest_round}: ${outcome}`);
    } else {
      console.log(`  CLOSE  ${label}\n         after round ${competition.latest_round}: ${outcome}`);
    }
    closed++;
  }

  console.log(`\n${apply ? 'Closed' : 'Would close'} ${closed}, left ${skipped}.`);
  if (!apply && closed > 0) console.log('Run again with --apply to close them.');
};

run()
  .catch((error) => {
    console.error('season-end-close failed:', error);
    process.exitCode = 1;
  })
  .finally(() => closePool({ quiet: true }));
