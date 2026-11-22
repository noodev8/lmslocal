/*
=======================================================================================================================================
Script: sandbox-round.js
=======================================================================================================================================
Purpose: Play rounds in a TEST competition without the fixture service - open a round of made-up
         fixtures, lock it, give it results, and process them through the real results push.

WHY THIS EXISTS. Testing a game end to end needs fixtures, a lock and results, and the real way
those arrive - the calendar, Stage, fixture_load and the admin Results screen - is shared by every
customer on the team list. One staged batch at a time, pushed to every eligible competition,
closed for all of them at once: there is no way to give a test competition its own gameweek
without putting it in front of real players or holding up their close. This gives a test
competition rounds of its own instead, touching nothing else.

WHAT IT TOUCHES, AND ONLY THAT: round and fixture rows belonging to the named competition, and
fixture.result on them. Never fixture_load, fixture_block, another competition, or a player's
predictions or picks - those are made through the app or the API, as a player would.

THE KICKOFF TIMES HAVE ODD SECONDS (hh:mm:17.017), on purpose. Every real kickoff is on a whole
minute, and the admin screens find a competition's place in the live batch by matching teams AND
kickoff_time against fixture_load (get-push-targets, clear-staged-batch). An odd-second kickoff
can never match, so a test round never appears in the Results push list and can never hold the
real gameweek's close open.

FENCED TWICE. The competition must be organised by an account in BOT_ORGANISER_IDS (organiser 50)
AND be named with the TEST prefix below. Organiser 50 also owns real competitions
(docs/testing-rules.md), so ownership alone is not enough; the name is the test competition
saying so itself.

ONE THING IT CANNOT STOP: a test competition on the fixture service is a real competition to the
push. Once its sandbox round is processed, the next time the operator presses Stage - or a
calendar block is pushed - it is eligible for the real batch like any other, and gets that round.
Harmless, since it only affects the test competition, but expect it, and delete test competitions
when done.

PROCESSING GOES THROUGH THE REAL ROUTE. `result` writes the results and then POSTs to
/admin/push-results-to-competition on a running server (default http://localhost:3015), with an
admin token signed as the testing account 1088 (docs/testing-rules.md). That route writes nothing
from fixture_load here - no staged row matches an odd-second kickoff - and settles the round from
the results already on the fixtures, which is the path it keeps for exactly that case. So the code
that settles a test round is the code that settles a real one. The server must be running the
code being tested.

Usage (from lmslocal-server/):
  node scripts/sandbox-round.js status <competition_id>
  node scripts/sandbox-round.js open   <competition_id> [--fixtures 10] [--lock-minutes 30]
  node scripts/sandbox-round.js lock   <competition_id>
  node scripts/sandbox-round.js result <competition_id> [HADH...] [--only 3] [--api http://localhost:3015]

  result takes one letter per fixture, in the order `status` lists them: H (home win), A (away
  win), D (draw). Omitted, or shorter than the round, the rest are random. --only N results just
  the first N still unresulted - a Friday night's push, with the rest of the round to come.
=======================================================================================================================================
*/

require('dotenv').config();
const { query, transaction, closePool } = require('../database');
const { BOT_ORGANISER_IDS } = require('../services/botPool');
const { signAdminToken } = require('../middleware/admin-auth');
const { getMatchdayTable } = require('../services/matchdayTable');

// A test competition's name starts with this. Case-sensitive on purpose: it is a label someone
// typed deliberately, not one a customer will arrive at by accident.
const TEST_NAME_PREFIX = 'TEST ';

// docs/testing-rules.md: the identity admin tokens are signed as during testing, so audit_log
// tells test writes from real ones.
const TESTING_ADMIN = { id: 1088, email: 'claude@lmslocal.invalid', display_name: 'Claude (test)' };

function fail(message) {
  console.error(`\n  ${message}\n`);
  process.exitCode = 1;
}

function option(args, name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] !== undefined ? args[index + 1] : fallback;
}

// A time with odd seconds - never a whole minute, so never a match for a real staged kickoff.
function sandboxTime(msFromNow) {
  const time = new Date(Date.now() + msFromNow);
  time.setSeconds(17, 17);
  return time;
}

async function loadTestCompetition(competitionId) {
  const result = await query(`
    SELECT id, name, organiser_id, game_type, team_list_id, fixture_service, status
    FROM competition WHERE id = $1
  `, [competitionId]);

  const competition = result.rows[0];
  if (!competition) {
    throw new Error(`No competition ${competitionId}`);
  }
  if (!BOT_ORGANISER_IDS.includes(competition.organiser_id) || !competition.name.startsWith(TEST_NAME_PREFIX)) {
    throw new Error(
      `Competition ${competitionId} ("${competition.name}") is not a test competition. `
      + `It must be organised by ${BOT_ORGANISER_IDS.join('/')} and named "${TEST_NAME_PREFIX}...".`
    );
  }
  return competition;
}

async function latestRound(competitionId) {
  const result = await query(`
    SELECT r.id, r.round_number, r.lock_time,
           COUNT(f.id) AS fixtures, COUNT(f.result) AS resulted, COUNT(f.processed) AS processed
    FROM round r
    LEFT JOIN fixture f ON f.round_id = r.id
    WHERE r.competition_id = $1
    GROUP BY r.id
    ORDER BY r.round_number DESC
    LIMIT 1
  `, [competitionId]);
  const round = result.rows[0];
  if (round) {
    round.fixtures = parseInt(round.fixtures, 10);
    round.resulted = parseInt(round.resulted, 10);
    round.processed = parseInt(round.processed, 10);
  }
  return round || null;
}

async function status(competition) {
  // Read fresh: a push run by this same command has usually just moved it.
  const current = (await query(`SELECT status FROM competition WHERE id = $1`, [competition.id])).rows[0];
  console.log(`\n  ${competition.name}  (id ${competition.id}, ${competition.game_type}, ${current.status})`);

  const round = await latestRound(competition.id);
  if (!round) {
    console.log('  No rounds yet. `open` creates round 1.\n');
    return;
  }

  const locked = round.lock_time && new Date(round.lock_time) <= new Date();
  console.log(`  Round ${round.round_number} - locks ${new Date(round.lock_time).toISOString()} `
    + `(${locked ? 'LOCKED' : 'open'}), ${round.processed}/${round.fixtures} processed\n`);

  const fixtures = await query(`
    SELECT f.id, f.home_team_short, f.away_team_short, f.result, f.processed IS NOT NULL AS processed,
           (SELECT COUNT(*) FROM prediction p WHERE p.fixture_id = f.id) AS predictions,
           (SELECT COUNT(*) FROM pick pk WHERE pk.fixture_id = f.id) AS picks
    FROM fixture f WHERE f.round_id = $1 ORDER BY f.kickoff_time, f.id
  `, [round.id]);

  fixtures.rows.forEach((f, index) => {
    const backed = competition.game_type === 'matchday' ? `${f.predictions} predictions` : `${f.picks} picks`;
    console.log(`  ${String(index + 1).padStart(2)}. ${f.home_team_short.padEnd(4)} v ${f.away_team_short.padEnd(4)}`
      + `  ${(f.result || '-').padEnd(5)} ${f.processed ? 'processed' : '         '}  ${backed}`);
  });

  if (competition.game_type === 'matchday') {
    const table = await getMatchdayTable(competition.id);
    console.log('\n  Pos  Player                Pts   W  D  L  Pred');
    table.rows.forEach(row => {
      console.log(`  ${String(row.position).padStart(3)}  ${row.display_name.slice(0, 20).padEnd(20)}  `
        + `${String(row.total).padStart(3)}${row.provisional ? '*' : ' '} ${String(row.wins).padStart(2)} `
        + `${String(row.draws).padStart(2)} ${String(row.losses).padStart(2)}  ${String(row.predictions).padStart(4)}`);
    });
    if (table.rows.some(row => row.provisional)) console.log('  * provisional - round still being played');
  }
  console.log('');
}

async function open(competition, args) {
  // The real push refuses a finished competition (evaluateCompetition, COMPETITION_COMPLETE), so
  // a round here would be one no real competition can ever have.
  const current = (await query(`SELECT status FROM competition WHERE id = $1`, [competition.id])).rows[0];
  if (String(current.status).toUpperCase() === 'COMPLETE') {
    throw new Error(`Competition ${competition.id} is COMPLETE - the game is over. Reset it, or create another.`);
  }

  const round = await latestRound(competition.id);
  if (round && (round.fixtures === 0 || round.processed < round.fixtures)) {
    throw new Error(`Round ${round.round_number} is not finished (${round.processed}/${round.fixtures} processed). Finish it first.`);
  }

  const teams = await query(
    `SELECT short_name, name FROM team WHERE team_list_id = $1 AND is_active = true`,
    [competition.team_list_id]
  );
  const wanted = parseInt(option(args, '--fixtures', '10'), 10);
  const count = Math.min(wanted, Math.floor(teams.rows.length / 2));
  const lockMinutes = parseFloat(option(args, '--lock-minutes', '30'));

  // Shuffle, then pair off: every team plays at most once in the round, as in a real gameweek.
  const shuffled = teams.rows.slice().sort(() => Math.random() - 0.5);
  const kickoff = sandboxTime(lockMinutes * 60 * 1000);

  const created = await transaction(async (client) => {
    const roundResult = await client.query(`
      INSERT INTO round (competition_id, round_number, lock_time, created_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING id, round_number
    `, [competition.id, round ? round.round_number + 1 : 1, kickoff]);
    const newRound = roundResult.rows[0];

    for (let i = 0; i < count; i++) {
      const home = shuffled[2 * i];
      const away = shuffled[2 * i + 1];
      // The same columns pushFixturesToCompetition writes.
      await client.query(`
        INSERT INTO fixture (round_id, competition_id, home_team, away_team,
                             home_team_short, away_team_short, kickoff_time, round_number, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      `, [newRound.id, competition.id, home.name, away.name, home.short_name, away.short_name, kickoff, newRound.round_number]);
    }

    await client.query(`
      INSERT INTO audit_log (competition_id, user_id, action, details)
      VALUES ($1, $2, 'Sandbox Round Opened', $3)
    `, [competition.id, TESTING_ADMIN.id, `scripts/sandbox-round.js: round ${newRound.round_number}, ${count} fixtures`]);

    return newRound;
  });

  console.log(`\n  Round ${created.round_number} opened with ${count} fixtures, locking ${kickoff.toISOString()}.`);
  await status(competition);
}

async function lock(competition) {
  const round = await latestRound(competition.id);
  if (!round) throw new Error('No round to lock.');
  if (round.lock_time && new Date(round.lock_time) <= new Date()) {
    console.log(`\n  Round ${round.round_number} is already locked.\n`);
    return;
  }

  // A minute ago, so the push's "has the round locked" check passes at once. The fixtures move
  // with it: lock_time doubles as kickoff, and a result before kickoff is not one the real
  // staging would accept either.
  const lockedAt = sandboxTime(-60 * 1000);
  await transaction(async (client) => {
    await client.query(`UPDATE round SET lock_time = $1 WHERE id = $2`, [lockedAt, round.id]);
    await client.query(`UPDATE fixture SET kickoff_time = $1 WHERE round_id = $2`, [lockedAt, round.id]);
  });

  console.log(`\n  Round ${round.round_number} locked at ${lockedAt.toISOString()}.\n`);
}

async function result(competition, args) {
  const round = await latestRound(competition.id);
  if (!round) throw new Error('No round to result.');
  if (!round.lock_time || new Date(round.lock_time) > new Date()) {
    throw new Error(`Round ${round.round_number} has not locked. Run \`lock\` first - results before kickoff are refused.`);
  }

  const letters = (args.find(arg => /^[HADhad]+$/.test(arg)) || '').toUpperCase();
  const api = option(args, '--api', 'http://localhost:3015');
  const only = parseInt(option(args, '--only', String(Number.MAX_SAFE_INTEGER)), 10);

  const fixtures = await query(`
    SELECT id, home_team_short, away_team_short, result
    FROM fixture WHERE round_id = $1 ORDER BY kickoff_time, id
  `, [round.id]);

  let written = 0;
  await transaction(async (client) => {
    for (const [index, fixture] of fixtures.rows.entries()) {
      if (fixture.result !== null) continue;
      if (written >= only) break;
      const letter = letters[index] || 'HAD'[Math.floor(Math.random() * 3)];
      const value = letter === 'H' ? fixture.home_team_short : letter === 'A' ? fixture.away_team_short : 'DRAW';
      await client.query(`UPDATE fixture SET result = $1 WHERE id = $2 AND result IS NULL`, [value, fixture.id]);
      written++;
    }
  });
  console.log(`\n  ${written} result(s) written. Processing through ${api}/admin/push-results-to-competition ...`);

  const response = await fetch(`${api}/admin/push-results-to-competition`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${signAdminToken(TESTING_ADMIN)}`
    },
    body: JSON.stringify({ competition_id: competition.id })
  });
  console.log('  ' + JSON.stringify(await response.json(), null, 2).split('\n').join('\n  '));

  await status(competition);
}

async function main() {
  const [command, idArg, ...args] = process.argv.slice(2);
  const commands = { status, open, lock, result };

  if (!commands[command] || !Number.isInteger(parseInt(idArg, 10))) {
    fail('Usage: node scripts/sandbox-round.js <status|open|lock|result> <competition_id> [options] - see the header.');
    return;
  }

  const competition = await loadTestCompetition(parseInt(idArg, 10));
  await commands[command](competition, args);
}

main()
  .catch(error => fail(error.message))
  .finally(() => closePool());
