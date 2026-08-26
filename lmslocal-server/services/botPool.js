/*
=======================================================================================================================================
Service: Bot Pool
=======================================================================================================================================
Purpose: The rules about what a bot is and where one is allowed to go, in one place, shared by
         every /admin/*-bot* route so they cannot drift apart.

Bots are ordinary app_user accounts that admin drives from the Bots screen, used to seed a
competition so it is not empty when a real player joins.

Two rules live here: what counts as a bot, and where one is allowed to go. A third - that a bot
is never chargeable - falls out of the first, and is expressed as SQL below so the billing
queries cannot disagree with this file about it.
=======================================================================================================================================
*/

const { query } = require('../database');

/*
Where bots are allowed.

This list used to exist for billing reasons: bots were counted and charged for exactly like
people, so letting one into a customer's competition spent their credits and could make
get-competition-by-code answer FULL to the real players the seeding existed to attract.

That is no longer true - bots cost nothing anywhere (see chargeableMemberFilter below) - and the
restriction is NOT therefore obsolete. The reason is simply a different one now, and it is the
stronger of the two:

  A customer's competition filling with fake entrants is bad on its own terms. Real players would
  see phantom names in the standings, play against opponents who are not people, and be
  eliminated in a field padded with accounts we drive.

That survives the billing change intact. Adding an id to this list is a decision about whether
someone's players are competing against real opponents - which is why it lives here in code with
this comment attached rather than in an environment variable.
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

/*
Display names for newly created bots start with this. It is no longer what discloses a bot to
players - competitions strip it from competition_user.player_display_name and the web app renders
a "Bot" chip beside the name instead (components/BotChip.tsx), driven by the is_bot flag the
player-facing routes derive from the email pattern above. The prefix survives on the app_user
account so the admin Bots screen and the pool stay readable.
*/
const BOT_NAME_PREFIX = 'Bot ';

/**
 * Whether an email address belongs to a bot.
 *
 * The one definition, so a screen deciding whether to badge a row cannot disagree with the routes
 * that decide what a bot is. Mirrors BOT_EMAIL_LIKE, which is the SQL form of the same test.
 *
 * @param {string|null|undefined} email
 * @returns {boolean}
 */
function isBotEmail(email) {
  if (!email) return false;
  return email.startsWith('bot_') && email.endsWith('@lms-guest.com');
}

/*
=======================================================================================================================================
Chargeable members
=======================================================================================================================================
A bot never costs a credit and never consumes one of the organiser's free places. Not a carve-out
for one route - the rule is the same in every counting query in the system, which is what makes
it possible to state plainly to an organiser.

The PAYG counting queries - join-competition-by-code, get-competition-by-code, deduct-credit,
add-offline-player, get-user-credits, remove-player and get-reset-quote - all ask the same
question: how many chargeable memberships does this organiser have? Six copies of that question
is six chances to drift, so the definition lives here, next to the definition of what a bot is.

No schema change and no migration: every count is live, so the numbers simply become correct.

Note there is no is_bot column to key off. The email pattern IS the definition (see
BOT_EMAIL_LIKE above), so the filter has to join app_user to see it.
=======================================================================================================================================
*/

/**
 * SQL predicate that excludes bots from a membership count.
 *
 * BOT_EMAIL_LIKE is interpolated rather than parameterised on purpose: it is a module constant
 * with a fixed value, never anything a caller or a user supplies, and inlining it is what lets
 * these fragments drop into queries whose $n numbering is not known here.
 *
 * @param {string} userAlias - alias of the joined app_user row, e.g. 'u'
 * @returns {string}
 */
function chargeableMemberFilter(userAlias = 'u') {
  return `${userAlias}.email NOT LIKE '${BOT_EMAIL_LIKE}'`;
}

/*
=======================================================================================================================================
Re-buys
=======================================================================================================================================
A membership is worth one place, plus one more for every time that player has bought back in
after being knocked out. Both counts below therefore add competition_user.re_buys.

The reason it is a column and not an event: this count is LIVE. Nothing anywhere stores "this
organiser has used 24 places" - the number is recomputed by recounting rows every time it is
needed. Bringing a player back creates no row, so without something on the row to add, the count
cannot see it happening and a rebuilt field is free. That is a reset by another door, which
docs/reset-billing.md §2 already priced. See docs/re-buys.md §3.

Consequence worth expecting rather than debugging: a re-buy can be what pushes an organiser past
FREE_PLAYER_LIMIT, so it can make the NEXT ordinary joiner chargeable, and can tip
get-competition-by-code into answering FULL. Both are correct - a place is a place, whoever is
sitting in it.
=======================================================================================================================================
*/

/**
 * Scalar subquery counting an organiser's chargeable places across ALL their competitions.
 *
 * This is the number FREE_PLAYER_LIMIT is compared against everywhere.
 *
 * @param {string} organiserExpr - how the caller names the organiser: a placeholder like '$1',
 *                                 or a correlated column like 'c.organiser_id'
 * @returns {string} a parenthesised subquery, ready to drop into a SELECT list or comparison
 */
function organiserChargeableCountSql(organiserExpr) {
  /*
  Guard rather than trust. Everything passed here today is a literal written in a route file, but
  a fragment builder that splices its argument into SQL is one careless call away from being an
  injection point, and the cost of making that impossible is one regex.
  */
  if (!/^(\$\d+|[a-z_]+\.[a-z_]+)$/.test(organiserExpr)) {
    throw new Error(`organiserChargeableCountSql: unsafe organiser expression "${organiserExpr}"`);
  }

  /*
  The aliases are deliberately ugly. This subquery gets dropped into other people's queries, and
  a correlated caller writes something like organiserChargeableCountSql('c.organiser_id') - if
  this fragment also aliased competition as `c`, the inner one would shadow the outer and the
  correlation would silently become `c.organiser_id = c.organiser_id`: true for every row, so the
  count comes back as every membership on the platform. It reads as a working query and answers
  a completely different question.
  */
  return `(
    SELECT COUNT(chg_cu.id) + COALESCE(SUM(chg_cu.re_buys), 0)
      FROM competition chg_c
      INNER JOIN competition_user chg_cu ON chg_cu.competition_id = chg_c.id
      INNER JOIN app_user chg_u ON chg_u.id = chg_cu.user_id
     WHERE chg_c.organiser_id = ${organiserExpr}
       AND ${chargeableMemberFilter('chg_u')}
  )`;
}

/**
 * An organiser's chargeable places across all their competitions - memberships plus re-buys.
 *
 * @param {Object} client - a pg client inside a transaction, or the shared query helper's caller
 * @param {number} organiserId
 * @returns {Promise<number>}
 */
async function countOrganiserChargeableMembers(client, organiserId) {
  const result = await client.query(
    `SELECT ${organiserChargeableCountSql('$1')} AS chargeable_count`,
    [organiserId]
  );
  return parseInt(result.rows[0].chargeable_count, 10) || 0;
}

/**
 * Chargeable places in ONE competition - members plus their re-buys.
 *
 * @param {Object} client - a pg client inside a transaction
 * @param {number} competitionId
 * @returns {Promise<number>}
 */
async function countCompetitionChargeableMembers(client, competitionId) {
  const result = await client.query(`
    SELECT COUNT(cu.id) + COALESCE(SUM(cu.re_buys), 0) AS chargeable_count
      FROM competition_user cu
      INNER JOIN app_user u ON u.id = cu.user_id
     WHERE cu.competition_id = $1
       AND ${chargeableMemberFilter('u')}
  `, [competitionId]);

  return parseInt(result.rows[0].chargeable_count, 10) || 0;
}

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
 * What each of these bots is allowed to pick, derived from its own picks - the same rule
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

  // Derived from each bot's own picks - see docs/allowed-teams.md. The rebuild step this used to
  // run is gone with the table: an empty set can now only mean the bot has genuinely used every
  // team, never that rows were never written for it. That ambiguity was the reason bots needed
  // healing here at all.
  const result = await query(`
    SELECT cu.user_id, t.short_name
    FROM competition_user cu
    INNER JOIN competition c ON c.id = cu.competition_id
    INNER JOIN team t ON t.team_list_id = $2 AND t.is_active = true
    WHERE cu.competition_id = $1
      AND cu.user_id = ANY($3)
      AND (c.no_team_twice = false OR NOT EXISTS (
            SELECT 1 FROM pick p
            WHERE p.competition_id = $1
              AND p.user_id        = cu.user_id
              AND p.round_number   > cu.teams_reset_round
              AND p.team           = t.short_name
          ))
  `, [competitionId, teamListId, userIds]);

  const map = new Map(userIds.map((id) => [id, new Set()]));
  for (const row of result.rows) {
    map.get(row.user_id)?.add(row.short_name);
  }

  for (const [userId, set] of map) byUser.set(userId, set);

  return byUser;
}

/**
 * Teams a player has already picked in this competition.
 *
 * The second of the two checks set-pick.js makes on a human's pick: the derived list says what is
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
 * Short name -> team id for one team list. No longer used by the pick routes (nothing needs a
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
  isBotEmail,
  chargeableMemberFilter,
  organiserChargeableCountSql,
  countOrganiserChargeableMembers,
  countCompetitionChargeableMembers,
  loadBotCompetition,
  assertCompetitionNotStarted,
  nextBotNames,
  loadAllowedTeams,
  loadCurrentRound,
  loadRoundFixtures,
  loadUsedTeams,
  loadTeamIdsByShortName
};
