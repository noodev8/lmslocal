/*
=======================================================================================================================================
services/mdParty.js — Matchday Party rooms: rules, auth and state
=======================================================================================================================================
Purpose: Everything the party routes share. docs/matchday-party.md is the contract; the engine that
         plays the matches is services/mdPartyEngine.js and is not repeated here.

NOT A COMPETITION. Nothing here reads or writes competition, round, fixture, pick or prediction,
and no competition route reads the mdparty_* tables (§1). That separation is the point: neither game
can break the other.

WHO IS WHO (§3, §7):
  - The HOST is a signed-in LMSLocal user (JWT). Host-only actions check mdparty_room.host_user_id.
    The host is also a player, with a player row of their own.
  - PLAYERS are not users. Joining issues a random token for that room only, stored as a SHA-256
    hash. It opens nothing outside the room.
  - The TV reads the room's state by its code alone and can do nothing else.

THE SCORING RULE for a party lives here and nowhere else (and is mirrored for the reveal in
lmslocal-web/src/lib/mdpartyReveal.ts, which must agree). Kept apart from services/matchdayScoring.js
so changing one game's scoring can never change the other's by accident (§1). Since 2026-11-25:
  - a prediction: predicted team wins +3, draw +1, predicted team loses 0;
  - THE BANKER, at most one a round, optional: wins +6, draws or loses -3. The draw is what usually
    bites, which is the point: on a 74% favourite it still fails one time in four;
  - THE BRAVE FEW: the side of a match fewer players predicted (both sides taken, unequal) gets +2
    extra each if it wins, or +3 for a player who is on that side alone. Not doubled by a banker.
    Raised from +1 on 2026-11-25: the brave side is usually the underdog, and +1 did not pay for the
    risk. At +2 a 30% underdog is worth about what a solid favourite is, so backing it is a real choice.
    A brave draw gets +1 extra too (2 rather than 1);
  - a banker is double or bust and nothing else: no brave draw point on top.
  (A "crowd" penalty - the most-predicted side losing a point if it lost - was tried on 2026-11-25 and
  taken out the same day.)
Unlike Matchday, a total can go down.

ROOM STATES (§5): lobby -> open -> revealing -> table -> (open ...) -> finished. Every change bumps
mdparty_room.version, which is what lets a poll that is already up to date skip building the state.
=======================================================================================================================================
*/

const crypto = require('crypto');
const { transaction, query } = require('../database');
const { drawFixtures, playFixtures, teamTable } = require('./mdPartyEngine');

/*
IN PREVIEW (2026-11-24): only these users may host. Launching is setting this to null, in a commit of
its own - the same pattern as MATCHDAY_PREVIEW_ORGANISER_IDS in services/gameType.js. Joining a room
is never gated: a player only ever reaches one through a host who could create it.
*/
const PARTY_PREVIEW_HOST_IDS = [50];

const ROUND_OPTIONS = [4, 6, 8];
// Eight phones, host included (2026-11-25). Enough for a front room, and few enough that the TV's league
// and the names under each team stay readable and nobody waits long for the slowest coupon. Nobody is
// turned away: anyone beyond eight teams up with a player already in, on one phone.
const MAX_PLAYERS = 8;
// 1, so the host can play a game on their own (Andreas, 2026-11-24: play it alone first, to see
// how many points a game gives, before the TV and multiplayer are built).
const MIN_PLAYERS_TO_START = 1;
const NAME_MAX = 20;
const ROOM_LIFETIME_HOURS = 24;
const POINTS = {
  WIN: 3, DRAW: 1, LOSS: 0, BANKER_WIN: 6, BANKER_MISS: -3,
  BRAVE: 2, BRAVE_ALONE: 3, BRAVE_DRAW: 1
};

// No I, L, O or U, and no digits: nothing that reads as another character across a living room.
const CODE_LETTERS = 'ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LENGTH = 5;

function canHostParty(userId) {
  return PARTY_PREVIEW_HOST_IDS === null || PARTY_PREVIEW_HOST_IDS.includes(userId);
}

function newRoomCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_LETTERS[crypto.randomInt(CODE_LETTERS.length)];
  return code;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function newPlayerToken() {
  const token = crypto.randomBytes(24).toString('base64url');
  return { token, hash: hashToken(token) };
}

function newSeed() {
  return crypto.randomInt(0, 2 ** 32);
}

/** A display name as typed, tidied; null if there is nothing usable left. */
function normaliseName(raw) {
  if (typeof raw !== 'string') return null;
  const name = raw.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
  return name.length > 0 ? name : null;
}

function normaliseCode(raw) {
  return typeof raw === 'string' ? raw.trim().toUpperCase() : '';
}

/** A live (unexpired) room by its code. Pass forUpdate inside a transaction that will change it. */
async function findRoom(db, code, { forUpdate = false } = {}) {
  const result = await db.query(
    `SELECT * FROM mdparty_room WHERE code = $1 AND expires_at > NOW() ${forUpdate ? 'FOR UPDATE' : ''}`,
    [normaliseCode(code)]
  );
  return result.rows[0] || null;
}

/** The player holding this token in this room, or null. Removed players hold nothing. */
async function findPlayer(db, roomId, token) {
  if (!token) return null;
  const result = await db.query(
    `SELECT id, display_name, is_host FROM mdparty_player
     WHERE room_id = $1 AND token_hash = $2 AND removed_at IS NULL`,
    [roomId, hashToken(token)]
  );
  return result.rows[0] || null;
}

async function bumpVersion(db, roomId) {
  await db.query('UPDATE mdparty_room SET version = version + 1 WHERE id = $1', [roomId]);
}

async function activeTeams(db) {
  const result = await db.query(
    'SELECT id, name, short_name, rating FROM mdparty_team WHERE is_active ORDER BY id'
  );
  return result.rows;
}

/**
 * Open a round: draw its fixtures (§4.5, first step) and move the room to 'open'. The results do
 * not exist yet and will not until the round locks.
 */
async function openRound(db, room, roundNumber) {
  const teams = await activeTeams(db);
  const drawSeed = newSeed();
  const fixtures = drawFixtures(teams, drawSeed);

  const round = await db.query(
    `INSERT INTO mdparty_round (room_id, round_number, draw_seed) VALUES ($1, $2, $3) RETURNING id`,
    [room.id, roundNumber, drawSeed]
  );
  const roundId = round.rows[0].id;

  const values = [];
  const params = [];
  fixtures.forEach((f, i) => {
    params.push(roundId, i + 1, f.home_id, f.away_id);
    values.push(`($${params.length - 3}, $${params.length - 2}, $${params.length - 1}, $${params.length})`);
  });
  await db.query(
    `INSERT INTO mdparty_fixture (round_id, sort_order, home_team_id, away_team_id) VALUES ${values.join(', ')}`,
    params
  );

  await db.query(
    `UPDATE mdparty_room SET state = 'open', current_round = $2, version = version + 1 WHERE id = $1`,
    [room.id, roundNumber]
  );
}

/** Every played fixture in the room before this round, in the engine's shape. */
async function resultsSoFar(db, roomId) {
  const result = await db.query(
    `SELECT f.home_team_id AS home_id, f.away_team_id AS away_id, f.home_goals, f.away_goals
     FROM mdparty_fixture f JOIN mdparty_round r ON r.id = f.round_id
     WHERE r.room_id = $1 AND f.home_goals IS NOT NULL`,
    [roomId]
  );
  return result.rows;
}

/**
 * Lock the current round and play it (§4.5, second step), then move the room to 'revealing'.
 * The caller holds the room row FOR UPDATE and has checked it is 'open', so this runs once.
 */
async function lockAndPlayRound(db, room) {
  const round = (await db.query(
    'SELECT id FROM mdparty_round WHERE room_id = $1 AND round_number = $2',
    [room.id, room.current_round]
  )).rows[0];

  const teams = await activeTeams(db);
  const fixtures = (await db.query(
    'SELECT id, home_team_id AS home_id, away_team_id AS away_id FROM mdparty_fixture WHERE round_id = $1 ORDER BY sort_order',
    [round.id]
  )).rows;
  const results = await resultsSoFar(db, room.id);
  const playSeed = newSeed();

  const played = playFixtures({ teams, fixtures, results, roundNumber: room.current_round, seed: playSeed });

  // One statement for all ten results.
  const params = [];
  const values = played.map((f) => {
    params.push(f.id, f.home_rating, f.away_rating, f.home_goals, f.away_goals, JSON.stringify(f.goals));
    const n = params.length;
    return `($${n - 5}::int, $${n - 4}::int, $${n - 3}::int, $${n - 2}::int, $${n - 1}::int, $${n}::jsonb)`;
  });
  await db.query(
    `UPDATE mdparty_fixture f SET home_rating = v.hr, away_rating = v.ar, home_goals = v.hg, away_goals = v.ag, goals = v.goals
     FROM (VALUES ${values.join(', ')}) AS v (id, hr, ar, hg, ag, goals)
     WHERE f.id = v.id`,
    params
  );

  await db.query('UPDATE mdparty_round SET play_seed = $2, locked_at = NOW() WHERE id = $1', [round.id, playSeed]);
  await db.query(`UPDATE mdparty_room SET state = 'revealing', version = version + 1 WHERE id = $1`, [room.id]);
}

/** True when every player still in the room has sent a coupon for the current round. */
async function everyoneSubmitted(db, room) {
  const result = await db.query(
    `SELECT COUNT(*) FILTER (WHERE s.player_id IS NULL) AS waiting
     FROM mdparty_player p
     JOIN mdparty_round r ON r.room_id = p.room_id AND r.round_number = $2
     LEFT JOIN mdparty_submission s ON s.round_id = r.id AND s.player_id = p.id
     WHERE p.room_id = $1 AND p.removed_at IS NULL`,
    [room.id, room.current_round]
  );
  return Number(result.rows[0].waiting) === 0;
}

/**
 * The side of a fixture fewer players in the room predicted - "the brave few" - or null when one side
 * was not taken at all or the room split evenly. `crowd` is { home: [ids], away: [ids] }.
 */
function braveSide(crowd) {
  const h = crowd.home.length;
  const a = crowd.away.length;
  if (h === 0 || a === 0 || h === a) return null;
  return h < a ? 'home' : 'away';
}

/**
 * Points for one prediction on a played fixture. `banker`: it was the player's banker. `brave`: the
 * side of the fixture that was the brave few, or null.
 */
function pointsFor(prediction, { banker = false, brave = null, braveAlone = false } = {}) {
  const { team_id: team, home_team_id: home, away_team_id: away, home_goals: hg, away_goals: ag } = prediction;
  const won = hg !== ag && team === (hg > ag ? home : away);
  const drew = hg === ag;
  const side = team === home ? 'home' : 'away';
  if (banker) return won ? POINTS.BANKER_WIN + (brave === side ? (braveAlone ? POINTS.BRAVE_ALONE : POINTS.BRAVE) : 0) : POINTS.BANKER_MISS;
  if (won) return POINTS.WIN + (brave === side ? (braveAlone ? POINTS.BRAVE_ALONE : POINTS.BRAVE) : 0);
  if (drew) return POINTS.DRAW + (brave === side ? POINTS.BRAVE_DRAW : 0);
  return POINTS.LOSS;
}

/**
 * The players' table (§2): points, then winning predictions, then predictions made. Players level
 * on all three share a position. round_points is the current round's, for the reveal.
 */
function playersTable(players, predictions, currentRound, bankers = new Set()) {
  const rows = new Map(players.map((p) => [p.id, {
    player_id: p.id, name: p.display_name, points: 0, wins: 0, predictions_made: 0, round_points: 0
  }]));
  // The brave side of each fixture, from the predictions of the players still in the room.
  const sides = new Map();
  for (const pr of predictions) {
    if (!rows.has(pr.player_id)) continue;
    if (!sides.has(pr.fixture_id)) sides.set(pr.fixture_id, { home: [], away: [] });
    sides.get(pr.fixture_id)[pr.team_id === pr.home_team_id ? 'home' : 'away'].push(pr.player_id);
  }
  for (const pr of predictions) {
    const row = rows.get(pr.player_id);
    if (!row || pr.home_goals === null) continue;
    const fixtureSides = sides.get(pr.fixture_id);
    const brave = braveSide(fixtureSides);
    const pts = pointsFor(pr, {
      banker: bankers.has(`${pr.player_id}:${pr.fixture_id}`),
      brave,
      braveAlone: brave !== null && fixtureSides[brave].length === 1
    });
    row.points += pts;
    row.predictions_made += 1;
    const won = pr.home_goals !== pr.away_goals
      && pr.team_id === (pr.home_goals > pr.away_goals ? pr.home_team_id : pr.away_team_id);
    if (won) row.wins += 1;
    if (pr.round_number === currentRound) row.round_points += pts;
  }
  const sorted = [...rows.values()].sort((a, b) =>
    b.points - a.points || b.wins - a.wins || b.predictions_made - a.predictions_made || a.name.localeCompare(b.name));
  let position = 0;
  return sorted.map((row, i) => {
    const prev = sorted[i - 1];
    if (!prev || prev.points !== row.points || prev.wins !== row.wins || prev.predictions_made !== row.predictions_made) {
      position = i + 1;
    }
    return { ...row, position };
  });
}

/**
 * The teams' table for the TV (§4.3), from played fixtures. The engine orders every team (it needs
 * one position each for the bonus); here teams level on points, goal difference and goals scored
 * share a position, so the TV never ranks two identical records by their names.
 */
function sharedTeamTable(teams, results) {
  const table = teamTable(teams, results);
  let position = 0;
  return table.map((row, i) => {
    const prev = table[i - 1];
    if (!prev || prev.points !== row.points || prev.gd !== row.gd || prev.gf !== row.gf) position = i + 1;
    const team = teams.find((t) => t.id === row.id);
    return {
      team_id: row.id, name: row.name, short_name: team.short_name, position,
      played: row.played, won: row.won, drawn: row.drawn, lost: row.lost, gf: row.gf, ga: row.ga, gd: row.gd, points: row.points
    };
  });
}

/** W / D / L for each team from played fixtures before this round, oldest first, last five. */
function formByTeam(results) {
  const form = new Map();
  const add = (id, mark) => form.set(id, [...(form.get(id) || []), mark].slice(-5));
  for (const r of results) {
    if (r.home_goals > r.away_goals) { add(r.home_id, 'W'); add(r.away_id, 'L'); }
    else if (r.home_goals < r.away_goals) { add(r.home_id, 'L'); add(r.away_id, 'W'); }
    else { add(r.home_id, 'D'); add(r.away_id, 'D'); }
  }
  return form;
}

/** Per fixture, the ids of the players still in the room who predicted each side. */
function crowdFor(fixtures, predictions, players, bankers) {
  const inRoom = new Set(players.map((p) => p.id));
  return fixtures.map((f) => {
    const onFixture = predictions.filter((pr) => pr.fixture_id === f.id && inRoom.has(pr.player_id));
    const crowd = {
      fixture_id: f.id,
      home: onFixture.filter((pr) => pr.team_id === f.home_team_id).map((pr) => pr.player_id),
      away: onFixture.filter((pr) => pr.team_id === f.away_team_id).map((pr) => pr.player_id),
      // Whose banker this match is, and which side is the brave few (null if none).
      bankers: onFixture.filter((pr) => bankers.has(`${pr.player_id}:${f.id}`)).map((pr) => pr.player_id)
    };
    return { ...crowd, brave: braveSide(crowd) };
  });
}

/**
 * The room as one screen should see it. `player` is the caller's player row, or null for the TV.
 * Results appear only for a round that has been played; nothing is ever sent before it exists, and
 * effective ratings are never sent at all (§2).
 */
async function buildState(db, room, player) {
  const [teams, playersRes, roundsRes, predictionsRes, clockRes, bankersRes] = await Promise.all([
    activeTeams(db),
    db.query(
      `SELECT p.id, p.display_name, p.is_host,
              EXISTS (SELECT 1 FROM mdparty_submission s JOIN mdparty_round r ON r.id = s.round_id
                      WHERE s.player_id = p.id AND r.room_id = p.room_id AND r.round_number = $2) AS submitted
       FROM mdparty_player p WHERE p.room_id = $1 AND p.removed_at IS NULL ORDER BY p.joined_at, p.id`,
      [room.id, room.current_round]
    ),
    db.query(
      `SELECT r.round_number, r.locked_at, f.id, f.sort_order, f.home_team_id, f.away_team_id,
              f.home_goals, f.away_goals, f.goals
       FROM mdparty_round r JOIN mdparty_fixture f ON f.round_id = r.id
       WHERE r.room_id = $1 ORDER BY r.round_number, f.sort_order`,
      [room.id]
    ),
    db.query(
      `SELECT pr.player_id, pr.fixture_id, pr.team_id, r.round_number,
              f.home_team_id, f.away_team_id, f.home_goals, f.away_goals
       FROM mdparty_prediction pr
       JOIN mdparty_fixture f ON f.id = pr.fixture_id
       JOIN mdparty_round r ON r.id = f.round_id
       WHERE r.room_id = $1`,
      [room.id]
    ),
    // The database's clock, the same one that stamped locked_at, so every screen can work out the
    // reveal's minute from one clock whatever its own says (§6).
    db.query('SELECT NOW() AS now'),
    // Each coupon's banker, if it had one.
    db.query(
      `SELECT s.player_id, s.banker_fixture_id, r.round_number
       FROM mdparty_submission s JOIN mdparty_round r ON r.id = s.round_id
       WHERE r.room_id = $1 AND s.banker_fixture_id IS NOT NULL`,
      [room.id]
    )
  ]);
  const bankers = new Set(bankersRes.rows.map((b) => `${b.player_id}:${b.banker_fixture_id}`));

  const teamById = new Map(teams.map((t) => [t.id, t]));
  const allFixtures = roundsRes.rows;
  const played = allFixtures
    .filter((f) => f.home_goals !== null)
    .map((f) => ({ home_id: f.home_team_id, away_id: f.away_team_id, home_goals: f.home_goals, away_goals: f.away_goals, round_number: f.round_number }));

  // Form shown beside a fixture is the form going into it: earlier rounds only.
  const form = formByTeam(played.filter((r) => r.round_number < room.current_round));
  const teamView = (id) => {
    const t = teamById.get(id);
    return { id, name: t.name, short_name: t.short_name, form: form.get(id) || [] };
  };

  let round = null;
  if (room.current_round > 0) {
    const fixtures = allFixtures.filter((f) => f.round_number === room.current_round);
    const roundLocked = fixtures.length > 0 && fixtures[0].locked_at !== null;
    const myPredictions = {};
    if (player) {
      for (const pr of predictionsRes.rows) {
        if (pr.player_id === player.id && pr.round_number === room.current_round) myPredictions[pr.fixture_id] = pr.team_id;
      }
    }
    round = {
      number: room.current_round,
      locked: roundLocked,
      // When the round locked and its reveal began. Every screen plays the reveal from this moment,
      // so the TV and the phones show a goal together (§6).
      locked_at: fixtures.length > 0 ? fixtures[0].locked_at : null,
      fixtures: fixtures.map((f) => ({
        id: f.id,
        home: teamView(f.home_team_id),
        away: teamView(f.away_team_id),
        result: f.home_goals === null ? null : { home_goals: f.home_goals, away_goals: f.away_goals, goals: f.goals }
      })),
      my_predictions: myPredictions,
      // This player's banker this round, a fixture id or null.
      my_banker: player
        ? (bankersRes.rows.find((b) => b.player_id === player.id && b.round_number === room.current_round)?.banker_fixture_id ?? null)
        : null,
      // Who predicted what, per match - only once the round has locked, never while a coupon can
      // still change (as in Matchday, docs/matchday.md §8.6). The TV names them during the
      // one-match-at-a-time reveal (§6). Removed players are left out.
      crowd: roundLocked ? crowdFor(fixtures, predictionsRes.rows, playersRes.rows, bankers) : null
    };
  }

  const players = playersRes.rows;
  return {
    room: {
      code: room.code,
      state: room.state,
      rounds_total: room.rounds_total,
      current_round: room.current_round,
      version: room.version,
      ended_early: room.ended_early
    },
    me: player ? { player_id: player.id, name: player.display_name, is_host: player.is_host } : null,
    players: players.map((p) => ({ id: p.id, name: p.display_name, is_host: p.is_host, submitted: p.submitted })),
    round,
    server_now: clockRes.rows[0].now,
    players_table: playersTable(players, predictionsRes.rows, room.current_round, bankers),
    teams_table: played.length > 0 ? sharedTeamTable(teams, played) : []
  };
}

/**
 * The shape of every host control: in one transaction, find the room FOR UPDATE, check the caller
 * hosts it and it is in a state the action allows, then run the action. Returns the response body.
 *
 * @param userId    from the JWT (req.user.id)
 * @param code      the room code from the body
 * @param allowed   the room states this action may run in
 * @param action    async (client, room) => optional extra fields for the response
 */
async function hostAction(userId, code, allowed, action) {
  if (!code) return { return_code: 'MISSING_FIELDS', message: 'code is required' };
  return transaction(async (client) => {
    const room = await findRoom(client, code, { forUpdate: true });
    if (!room) return { return_code: 'PARTY_NOT_FOUND', message: 'No game with that code' };
    if (room.host_user_id !== userId) return { return_code: 'FORBIDDEN', message: 'Only the host can do that' };
    if (!allowed.includes(room.state)) {
      return { return_code: 'INVALID_STATE', message: `Not possible while the game is ${room.state}` };
    }
    const extra = (await action(client, room)) || {};
    if (extra.return_code) return extra;
    const after = (await client.query('SELECT state, current_round, version FROM mdparty_room WHERE id = $1', [room.id])).rows[0];
    return { return_code: 'SUCCESS', room: after, ...extra };
  });
}

/**
 * Room counts for the admin tool, and the prune itself. One DELETE: every mdparty_ table below
 * mdparty_room cascades from it, so a room takes everything under it. mdparty_team is never
 * touched. Used by scripts/prune-mdparty-rooms.js (nightly) and /admin/prune-mdparty-rooms (a button).
 */
async function roomCounts() {
  const r = await query(
    `SELECT COUNT(*) FILTER (WHERE expires_at > NOW())::int AS live,
            COUNT(*) FILTER (WHERE expires_at > NOW() AND state <> 'finished')::int AS in_play,
            COUNT(*) FILTER (WHERE expires_at <= NOW())::int AS expired
     FROM mdparty_room`
  );
  return r.rows[0];
}

async function pruneExpiredRooms() {
  const result = await query('DELETE FROM mdparty_room WHERE expires_at <= NOW()');
  return result.rowCount;
}

module.exports = {
  PARTY_PREVIEW_HOST_IDS,
  ROUND_OPTIONS,
  MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
  NAME_MAX,
  ROOM_LIFETIME_HOURS,
  POINTS,
  canHostParty,
  newRoomCode,
  newPlayerToken,
  hashToken,
  normaliseName,
  normaliseCode,
  findRoom,
  findPlayer,
  bumpVersion,
  openRound,
  lockAndPlayRound,
  everyoneSubmitted,
  buildState,
  hostAction,
  roomCounts,
  pruneExpiredRooms,
  // Exported for scripts and checks.
  playersTable,
  sharedTeamTable,
  formByTeam,
  pointsFor,
  braveSide
};
