/*
=======================================================================================================================================
services/gameType.js — which game a competition is, and which games a client can show
=======================================================================================================================================
Purpose: The one definition of competition.game_type for the server. Read docs/matchday.md first;
         this file implements its §3 (keeping the games apart) and §7 (clients).

Three things live here, and nowhere else:

  isLmsSql(alias)       - the SQL guard for every LMS-only query (emails above all). Composed like
                          notArchivedSql(), never written by hand.
  clientGameTypes(req)  - the games the calling client says it can show, from X-Game-Types.
  isLmsCompetition(ids) - the guard for LMS-only routes, from whichever id the route was given.

WHY GUARDS NAME THE GAME THEY ALLOW. Every guard here asks "is this LMS?", never "is this not
Matchday?". A third game is then kept out of LMS emails, LMS rules and the app by default, instead
of leaking into all of them until somebody remembers to add it to a list of exclusions.

WHY THE CLIENT HAS TO SAY. The Flutter app is live, has no forced-update gate, and no version of
it knows any game but LMS - so every version ever shipped stays in use, and none will be changed
for this. A client that sends nothing is therefore an LMS-only client, which is exactly what every
app in the wild is. The web sends the header from its axios client; a future app version opts in
the same way. The header also has to be in CORS allowedHeaders in server.js, or a browser's
preflight fails every request the web makes, not just this one.
=======================================================================================================================================
*/

const { query } = require('../database');

/*
Every game the server knows, with the name players see. The keys are the stored values of
competition.game_type and match its CHECK constraint; change the two together.
*/
const GAME_TYPES = {
  lms: 'Last Man Standing',
  matchday: 'Matchday'
};

/*
LMS-ONLY. Compose into the WHERE clause of any query whose rules or words are Last Man Standing's:
every scoped email's candidate query, above all, since their copy talks about picks and lives.

  @param {string} comp - the caller's competition alias, e.g. 'c'
*/
const isLmsSql = (comp) => `${comp}.game_type = 'lms'`;

/*
The games this request's client can show. LMS is always included - every client renders it - so
the absent header, which is every app version in the wild, comes out as ['lms'] and nothing more.
Unknown names are dropped rather than trusted: the result is bound straight into SQL as an array.

  @param {object} req - the Express request
  @returns {string[]}
*/
function clientGameTypes(req) {
  const declared = String(req.get('X-Game-Types') || '')
    .split(',')
    .map(name => name.trim().toLowerCase())
    .filter(name => Object.prototype.hasOwnProperty.call(GAME_TYPES, name));

  return Array.from(new Set(['lms', ...declared]));
}

/*
Whether the competition behind a route's input is LMS. Routes are given a competition, a round or
a fixture depending on what they do, so this takes whichever it has and resolves it in one query.

Returns true when there is nothing to resolve - a missing id, or no such row. Those are the
route's own MISSING_FIELDS / NOT_FOUND cases with their own wording, and a refusal here would
answer them with the wrong code. This only ever says no to a competition that exists and is
another game.

  @param {{competitionId?: any, roundId?: any, fixtureId?: any}} ids
  @returns {Promise<boolean>}
*/
async function isLmsCompetition({ competitionId, roundId, fixtureId } = {}) {
  const asId = (value) => (Number.isInteger(parseInt(value)) ? parseInt(value) : null);
  const ids = [asId(competitionId), asId(roundId), asId(fixtureId)];

  if (ids.every(id => id === null)) {
    return true;
  }

  const result = await query(`
    SELECT c.game_type
    FROM competition c
    WHERE c.id = COALESCE(
      $1::integer,
      (SELECT r.competition_id FROM round r WHERE r.id = $2::integer),
      (SELECT f.competition_id FROM fixture f WHERE f.id = $3::integer)
    )
  `, ids);

  return result.rows.length === 0 || result.rows[0].game_type === 'lms';
}

/*
What an LMS-only route returns for another game's competition. FORBIDDEN because the caller is
authenticated and the competition exists - this route is simply not the one for it.
*/
const NOT_LMS_RESPONSE = {
  return_code: 'FORBIDDEN',
  message: 'This competition is not a Last Man Standing game'
};

module.exports = {
  GAME_TYPES,
  isLmsSql,
  clientGameTypes,
  isLmsCompetition,
  NOT_LMS_RESPONSE
};
