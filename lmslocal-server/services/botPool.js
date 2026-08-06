/*
=======================================================================================================================================
Service: Bot Pool
=======================================================================================================================================
Purpose: The rules about what a bot is and where one is allowed to go, in one place, shared by
         every /admin/*-bot* route so they cannot drift apart.

Bots are ordinary app_user accounts that admin drives from the Bots screen, used to seed a
competition so it is not empty when a real player joins.

The important constraint here is billing, and it is the reason BOT_ORGANISER_IDS exists.
=======================================================================================================================================
*/

const { query, transaction } = require('../database');
const { resetAllowedTeams } = require('./allowedTeams');

/*
Bots occupy paid player slots.

The PAYG counting queries - join-competition-by-code, get-competition-by-code, deduct-credit,
add-offline-player, get-user-credits and remove-player - all count competition_user rows for an
organiser against FREE_PLAYER_LIMIT with no exclusion for bots. So a bot is charged for exactly
like a person: it uses up one of the 20 free places, and past that it costs the organiser a
credit. Worse, get-competition-by-code answers FULL and turns real players away once an
organiser is at the limit with no credit left.

Rather than put a bot exclusion into live billing code, bots are confined to organisers who are
us. Adding an id to this list is therefore a decision about someone's credit balance and their
players' ability to join, not a config tweak - which is why it lives here in code with this
comment attached rather than in an environment variable.
*/
const BOT_ORGANISER_IDS = [50];

/*
What makes an account a bot. Load-bearing twice over:

  - the bot_ prefix is how every bot route finds its population
  - the @lms-guest.com suffix is what already keeps email away from them, because the send
    routes (load-pick-reminder, load-results-email, load-welcome-competition and others) all
    skip that domain

A bot created outside this pattern would silently start receiving player email.
*/
const BOT_EMAIL_LIKE = 'bot_%@lms-guest.com';

/* Display names all start with this, so a player can tell what they are looking at. */
const BOT_NAME_PREFIX = 'Bot ';

/*
First names for new bots, continuing the A-T series the original 20 used. Ordinary given names
rather than robot-sounding ones: the "Bot " prefix is what does the disclosing, and it does it
on every screen the name appears on.
*/
const BOT_FIRST_NAMES = [
  'Alice', 'Bob', 'Charlie', 'Diana', 'Eddie', 'Fiona', 'George', 'Hannah', 'Ivan', 'Julia',
  'Kevin', 'Laura', 'Mike', 'Nina', 'Oscar', 'Paula', 'Quinn', 'Ryan', 'Sophie', 'Tyler',
  'Uma', 'Victor', 'Wendy', 'Xavier', 'Yasmin', 'Zach', 'Amber', 'Bruno', 'Cara', 'Dexter',
  'Elena', 'Felix', 'Greta', 'Hugo', 'Iris', 'Jonah', 'Kira', 'Leo', 'Mara', 'Nolan',
  'Opal', 'Pedro', 'Rosa', 'Simon', 'Tessa', 'Vera', 'Wyatt', 'Yara', 'Zane', 'Ada'
];

/**
 * Fetch a competition and refuse it unless bots are allowed there.
 *
 * Throws in the shape the routes already catch - see the error handler in any admin route -
 * so a caller does not have to remember to check a return value.
 *
 * @param {number} competitionId
 * @returns {Promise<Object>} competition row: id, name, status, organiser_id, team_list_id,
 *                            lives_per_player, no_team_twice
 */
async function loadBotCompetition(competitionId) {
  const result = await query(`
    SELECT id, name, status, organiser_id, team_list_id, lives_per_player, no_team_twice
    FROM competition
    WHERE id = $1
  `, [competitionId]);

  if (result.rows.length === 0) {
    throw {
      return_code: 'COMPETITION_NOT_FOUND',
      message: 'No competition with that id'
    };
  }

  const competition = result.rows[0];

  if (!BOT_ORGANISER_IDS.includes(competition.organiser_id)) {
    throw {
      return_code: 'COMPETITION_NOT_ELIGIBLE',
      message: 'Bots can only be used in competitions run by an approved organiser'
    };
  }

  return competition;
}

/**
 * Refuse anything that changes who is in a competition once it has started.
 *
 * The window is the one real players get in join-competition-by-code: before round 1 exists,
 * and during round 1 until it locks. Adding a bot after that drops a full-lives entrant into a
 * field that has already lost people; removing one deletes picks that a locked round is about
 * to be scored on.
 *
 * Throws COMPETITION_STARTED in the shape the admin routes already catch.
 *
 * @param {number} competitionId
 */
async function assertCompetitionNotStarted(competitionId) {
  const result = await query(`
    SELECT
      MAX(round_number) AS latest_round,
      MAX(lock_time) AS latest_lock_time
    FROM round
    WHERE competition_id = $1
  `, [competitionId]);

  const latestRound = result.rows[0].latest_round;
  const latestLockTime = result.rows[0].latest_lock_time;

  if (latestRound !== null && Number(latestRound) > 1) {
    throw {
      return_code: 'COMPETITION_STARTED',
      message: 'Competition has progressed beyond round 1'
    };
  }

  if (latestLockTime && new Date() >= new Date(latestLockTime)) {
    throw {
      return_code: 'COMPETITION_STARTED',
      message: 'Round 1 has locked'
    };
  }
}

/**
 * Pick display names for new bots, skipping any already taken.
 *
 * @param {number} count - how many names are needed
 * @param {string[]} existingNames - display names already in app_user, e.g. ['Bot Alice']
 * @returns {{ display_name: string, email: string }[]}
 */
function nextBotNames(count, existingNames) {
  const taken = new Set(existingNames);
  const names = [];

  for (const first of BOT_FIRST_NAMES) {
    if (names.length === count) break;
    const displayName = `${BOT_NAME_PREFIX}${first}`;
    if (taken.has(displayName)) continue;
    taken.add(displayName);
    names.push({
      display_name: displayName,
      email: `bot_${first.toLowerCase()}@lms-guest.com`
    });
  }

  /*
  The curated list is finite. Rather than fail once it runs out, fall back to numbered names
  that still read as bots and still match BOT_EMAIL_LIKE.
  */
  let n = 1;
  while (names.length < count) {
    const displayName = `${BOT_NAME_PREFIX}Player ${n}`;
    if (!taken.has(displayName)) {
      taken.add(displayName);
      names.push({
        display_name: displayName,
        email: `bot_player${n}@lms-guest.com`
      });
    }
    n++;
  }

  return names;
}

/**
 * The competition's latest round, which is the one picks are made for.
 *
 * Throws NO_ROUNDS or ROUND_LOCKED rather than returning a state the caller has to remember to
 * check, so the two pick routes cannot disagree about when picking is allowed.
 *
 * @param {number} competitionId
 * @returns {Promise<{round_id: number, round_number: number, lock_time: Date}>}
 */
async function loadCurrentRound(competitionId) {
  const result = await query(`
    SELECT
      id AS round_id,
      round_number,
      lock_time,
      CASE WHEN lock_time IS NOT NULL AND NOW() >= lock_time THEN true ELSE false END AS is_locked
    FROM round
    WHERE competition_id = $1
    ORDER BY round_number DESC
    LIMIT 1
  `, [competitionId]);

  const round = result.rows[0];

  if (!round) {
    throw {
      return_code: 'NO_ROUNDS',
      message: 'This competition has no rounds yet'
    };
  }

  if (round.is_locked) {
    throw {
      return_code: 'ROUND_LOCKED',
      message: `Round ${round.round_number} has locked`
    };
  }

  return round;
}

/**
 * Fixtures for a round, in kickoff order. Throws NO_FIXTURES if the round is empty - there is
 * nothing to pick from, which is a different problem to a locked round.
 *
 * @param {number} roundId
 * @returns {Promise<{fixture_id: number, home_team_short: string, away_team_short: string}[]>}
 */
async function loadRoundFixtures(roundId) {
  const result = await query(`
    SELECT id AS fixture_id, home_team_short, away_team_short
    FROM fixture
    WHERE round_id = $1
    ORDER BY kickoff_time ASC, id ASC
  `, [roundId]);

  if (result.rows.length === 0) {
    throw {
      return_code: 'NO_FIXTURES',
      message: 'This round has no fixtures yet'
    };
  }

  return result.rows;
}

/**
 * What each of these bots is allowed to pick, read from allowed_teams - the same table
 * get-allowed-teams.js serves the player pick screen from, and the same table set-pick.js
 * validates a human's pick against.
 *
 * Any bot sitting on an empty set is rebuilt first, which is exactly what happens to a real
 * player who opens the pick screen with nothing left (get-allowed-teams.js). Without this a bot
 * would never heal, because nothing else ever reads on its behalf.
 *
 * @param {number} competitionId
 * @param {number} teamListId
 * @param {number[]} userIds
 * @returns {Promise<Map<number, Set<string>>>} user_id -> set of allowed team short names
 */
async function loadAllowedTeams(competitionId, teamListId, userIds) {
  const byUser = new Map();

  if (userIds.length === 0) return byUser;

  const read = async () => {
    const result = await query(`
      SELECT at.user_id, t.short_name
      FROM allowed_teams at
      INNER JOIN team t ON t.id = at.team_id
      WHERE at.competition_id = $1 AND at.user_id = ANY($2)
    `, [competitionId, userIds]);

    const map = new Map(userIds.map((id) => [id, new Set()]));
    for (const row of result.rows) {
      map.get(row.user_id)?.add(row.short_name);
    }
    return map;
  };

  let teams = await read();

  const empty = userIds.filter((id) => teams.get(id).size === 0);

  if (empty.length > 0) {
    await transaction(async (client) => {
      for (const userId of empty) {
        await resetAllowedTeams(
          client,
          competitionId,
          userId,
          teamListId,
          'Bot had no allowed teams - automatically reset to all teams not yet picked'
        );
      }
    });

    teams = await read();
  }

  for (const [userId, set] of teams) byUser.set(userId, set);

  return byUser;
}

/**
 * Teams a player has already picked in this competition.
 *
 * The second of the two checks set-pick.js makes on a human's pick: allowed_teams says what is
 * on the table, this says whether the no-team-twice rule has already been spent on it. Both are
 * needed to match, because the two can disagree.
 *
 * @param {number} competitionId
 * @param {number[]} userIds
 * @param {number} [excludeRoundId] - a round to ignore, so a player's current pick does not
 *                                    count as a team they have used up
 * @returns {Promise<Map<number, Set<string>>>} user_id -> set of team short names
 */
async function loadUsedTeams(competitionId, userIds, excludeRoundId = null) {
  const byUser = new Map();

  if (userIds.length === 0) return byUser;

  const result = await query(`
    SELECT DISTINCT p.user_id, p.team
    FROM pick p
    INNER JOIN round r ON r.id = p.round_id
    WHERE r.competition_id = $1
      AND p.user_id = ANY($2)
      AND p.team IS NOT NULL
      AND ($3::int IS NULL OR p.round_id <> $3)
  `, [competitionId, userIds, excludeRoundId]);

  for (const row of result.rows) {
    if (!byUser.has(row.user_id)) byUser.set(row.user_id, new Set());
    byUser.get(row.user_id).add(row.team);
  }

  return byUser;
}

/**
 * Short name -> team id for one team list, so allowed_teams can be kept in step without a
 * lookup per pick.
 *
 * Scoped to the competition's own team list: short names are not unique across lists, so an
 * unscoped lookup can return another sport's team with the same abbreviation.
 *
 * @param {number} teamListId
 * @returns {Promise<Map<string, number>>}
 */
async function loadTeamIdsByShortName(teamListId) {
  const result = await query(
    'SELECT id, short_name FROM team WHERE team_list_id = $1 AND is_active = true',
    [teamListId]
  );

  return new Map(result.rows.map((row) => [row.short_name, row.id]));
}

module.exports = {
  BOT_ORGANISER_IDS,
  BOT_EMAIL_LIKE,
  BOT_NAME_PREFIX,
  loadBotCompetition,
  assertCompetitionNotStarted,
  nextBotNames,
  loadAllowedTeams,
  loadCurrentRound,
  loadRoundFixtures,
  loadUsedTeams,
  loadTeamIdsByShortName
};
