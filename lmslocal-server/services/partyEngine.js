/*
=======================================================================================================================================
services/partyEngine.js — the Matchday Party match engine
=======================================================================================================================================
Purpose: Plays a round of Matchday Party: draws ten made-up fixtures from the twenty teams when the
         round opens, and simulates their results when it locks. docs/matchday-party.md §4 is the contract; this file is the only
         place the engine lives.

PURE: no database, no clock, no Math.random. Everything comes in as arguments and the only source
of chance is the seeded generator, so the same seed always plays the same round (§4.5). That makes
a disputed result checkable and lets scripts/party-engine-sim.js tune the engine without a game.

THE MATCH, AS A PAPER GAME (§4.2, agreed 2026-11-24):
  A match is 9 blocks of ten minutes. In each block both teams roll a number from 0 to 100; a roll
  that lands inside the team's window is a goal, at a minute inside that block. Both teams can
  score in the same block, so a draw is simply level counts.

  A team's window = WINDOW x its share of the two ratings. Sharing, not the bare rating, so that
  two strong sides do not trade six goals each and two weak ones do not draw 0-0 every time. The
  home side adds HOME_ADVANTAGE to its rating before the share is taken.

  WINDOW = 31 puts an even match at ~2.8 goals, the Premier League average, and top v bottom at
  roughly 82% / 13% / 5% (simulated 2026-11-24). Retune with the sim script, not by eye.

THE LEAGUE-POSITION BONUS (§4.3, agreed 2026-11-24):
  From round 2, each team adds (teams + 1 - its position) x POSITION_BONUS to its rating, from
  the teams' own table in this game: top of twenty +20, bottom +1. It lives only in the game and
  never changes a stored rating. Round 1 has no table, so no bonus. x1, not the x2 first floated:
  after one or two rounds the table is mostly goal difference, and x2 let a lucky first weekend
  count for more than the club.
=======================================================================================================================================
*/

const BLOCKS = 9;
const WINDOW = 31;
const HOME_ADVANTAGE = 5;
const POSITION_BONUS = 1;

/**
 * Seeded random numbers in [0, 1). mulberry32: tiny, fast, and good enough for dice. Not for
 * anything secret - room codes and player tokens use crypto, not this.
 */
function seededRandom(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Play one match.
 * @returns {{ home_goals: number, away_goals: number, goals: { side: 'home'|'away', minute: number }[] }}
 *          goals in minute order, for the vidiprinter (§4.4).
 */
function playMatch(homeRating, awayRating, rand) {
  const home = homeRating + HOME_ADVANTAGE;
  const homeShare = home / (home + awayRating);
  const windows = { home: WINDOW * homeShare, away: WINDOW * (1 - homeShare) };

  const goals = [];
  for (let block = 0; block < BLOCKS; block++) {
    for (const side of ['home', 'away']) {
      if (rand() * 100 < windows[side]) {
        goals.push({ side, minute: block * 10 + 1 + Math.floor(rand() * 10) });
      }
    }
  }
  goals.sort((x, y) => x.minute - y.minute);

  return {
    home_goals: goals.filter((g) => g.side === 'home').length,
    away_goals: goals.filter((g) => g.side === 'away').length,
    goals
  };
}

/**
 * The teams' table from the results so far: points, then goal difference, then goals scored,
 * then name, so every team has exactly one position and the bonus is never ambiguous.
 * @param teams    [{ id, name }]
 * @param results  [{ home_id, away_id, home_goals, away_goals }]
 * @returns rows in position order: { id, name, position, played, won, drawn, lost, gf, ga, gd, points }
 */
function teamTable(teams, results) {
  const rows = new Map(teams.map((t) => [t.id, { id: t.id, name: t.name, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0 }]));
  for (const r of results) {
    const h = rows.get(r.home_id);
    const a = rows.get(r.away_id);
    h.played++; a.played++;
    h.gf += r.home_goals; h.ga += r.away_goals;
    a.gf += r.away_goals; a.ga += r.home_goals;
    if (r.home_goals > r.away_goals) { h.won++; a.lost++; }
    else if (r.home_goals < r.away_goals) { a.won++; h.lost++; }
    else { h.drawn++; a.drawn++; }
  }
  return [...rows.values()]
    .map((row) => ({ ...row, gd: row.gf - row.ga, points: row.won * 3 + row.drawn }))
    .sort((x, y) => y.points - x.points || y.gd - x.gd || y.gf - x.gf || x.name.localeCompare(y.name))
    .map((row, i) => ({ ...row, position: i + 1 }));
}

/** A team's rating for this round: its stored rating plus the position bonus from round 2. */
function effectiveRating(rating, position, teamCount, roundNumber) {
  if (roundNumber < 2) return rating;
  return rating + (teamCount + 1 - position) * POSITION_BONUS;
}

/**
 * Draw a round's fixtures: every team once, paired at random, home side at random (§2: ten
 * fixtures, all twenty teams). Done when the round OPENS, so players can see what to predict.
 * @returns [{ home_id, away_id }]
 */
function drawFixtures(teams, seed) {
  if (teams.length % 2 !== 0) throw new Error('partyEngine: needs an even number of teams');
  const rand = seededRandom(seed);
  const order = [...teams];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const fixtures = [];
  for (let i = 0; i < order.length; i += 2) fixtures.push({ home_id: order[i].id, away_id: order[i + 1].id });
  return fixtures;
}

/**
 * Play a round's fixtures. Done when the round LOCKS and never before (§2), with its own seed,
 * so no result exists while predictions can still change.
 * @param teams        [{ id, name, rating }]
 * @param fixtures     from drawFixtures
 * @param results      every result before this round, for the table and so the bonus
 * @param roundNumber  1-based
 * @param seed         stored with the round (§4.5)
 * @returns fixtures with { home_rating, away_rating, home_goals, away_goals, goals }. The effective
 *          ratings are for checking and tuning; they are never shown to players (§2).
 */
function playFixtures({ teams, fixtures, results, roundNumber, seed }) {
  const rand = seededRandom(seed);
  const byId = new Map(teams.map((t) => [t.id, t]));
  const positions = new Map(teamTable(teams, results).map((row) => [row.id, row.position]));
  const rating = (id) => effectiveRating(byId.get(id).rating, positions.get(id), teams.length, roundNumber);

  return fixtures.map((f) => {
    const homeRating = rating(f.home_id);
    const awayRating = rating(f.away_id);
    return { ...f, home_rating: homeRating, away_rating: awayRating, ...playMatch(homeRating, awayRating, rand) };
  });
}

module.exports = {
  drawFixtures,
  playFixtures,
  playMatch,
  teamTable,
  effectiveRating,
  seededRandom,
  ENGINE: { BLOCKS, WINDOW, HOME_ADVANTAGE, POSITION_BONUS }
};
