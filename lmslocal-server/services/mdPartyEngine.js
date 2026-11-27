/*
=======================================================================================================================================
services/mdPartyEngine.js — the Matchday Party match engine
=======================================================================================================================================
Purpose: Plays a game of Matchday Party: picks the game's twelve teams from the twenty, draws six
         made-up fixtures from them when each round opens, and simulates their results when it locks. docs/matchday-party.md §4 is the contract; this file is the only
         place the engine lives.

PURE: no database, no clock, no Math.random. Everything comes in as arguments and the only source
of chance is the seeded generator, so the same seed always plays the same round (§4.5). That makes
a disputed result checkable and lets scripts/mdparty-engine-sim.js tune the engine without a game.

THE MATCH, AS A PAPER GAME (§4.2, agreed 2026-11-24):
  A match is 9 blocks of ten minutes. In each block both teams roll a number from 0 to 100; a roll
  that lands inside the team's window is a goal, at a minute inside that block. Both teams can
  score in the same block, so a draw is simply level counts.

  A team's window = WINDOW x its share of the chances. A share, not the bare rating, so that two
  strong sides do not trade six goals each and two weak ones do not draw 0-0 every time. The two
  windows always add up to WINDOW, which is why every match averages the same number of goals.

  WINDOW = 22, about 2.0 goals a match (lowered from 31, ~2.8, on 2026-11-25). The goal is the
  excitement, so each should be rarer than real football's: about 20 in a round of ten rather than 28.
  The cost is more draws (~29%, against 23%) and more 0-0s (~12%), which Andreas chose knowingly.
  Upsets are no more frequent than before (top v bottom ~5%).

  THE SHARE COMES FROM THE GAP between the ratings (a logistic curve, SPREAD wide), not their
  ratio. Changed 2026-11-24: as a ratio, 92 v 62 gave the stronger side only 60% of the chances,
  so a gap of 30 counted for less at the top of the league than at the bottom, and Man City
  finished a 6-round game in the bottom half 24% of the time. On the gap, 30 points is 30 points
  anywhere: 14%, with top v bottom unchanged at ~5% upsets. Over a full 38 rounds it is ~1%; a short
  game is meant to allow a story.

  The home side adds HOME_ADVANTAGE to its rating before the gap is taken. +10 (raised from +5 on
  2026-11-24) gives home 44% / draw 23% / away 33%, close to real Premier League seasons.

  Retune with scripts/mdparty-engine-sim.js, not by eye.

THE LEAGUE-POSITION BONUS (§4.3, agreed 2026-11-24):
  From round 2, each team adds (teams + 1 - its position) x POSITION_BONUS to its rating, from
  the teams' own table in this game: top of twelve +12, bottom +1. It lives only in the game and
  never changes a stored rating. Round 1 has no table, so no bonus. x1, not the x2 first floated:
  after one or two rounds the table is mostly goal difference, and x2 let a lucky first weekend
  count for more than the club.
=======================================================================================================================================
*/

const BLOCKS = 9;
const WINDOW = 22;
const SPREAD = 48;
const HOME_ADVANTAGE = 10;
const POSITION_BONUS = 1;
// Twelve of the twenty play in a game (2026-11-27): six fixtures a round, every team in each one,
// so form still counts and the reveal is ~2 minutes, not ~3m40. A random twelve, not the top
// twelve, so there are still underdogs for the scoring to reward and each game has its own cast.
const TEAMS_PER_GAME = 12;

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
  const gap = homeRating + HOME_ADVANTAGE - awayRating;
  const homeShare = 1 / (1 + Math.exp(-gap / SPREAD));
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
 * Pick a game's teams: TEAMS_PER_GAME of the pool at random, once, when the game starts (§2).
 * Every round of that game is drawn from the same twelve.
 * @returns the chosen teams, in pool order
 */
function pickTeams(teams, seed, count = TEAMS_PER_GAME) {
  if (count > teams.length || count % 2 !== 0) throw new Error('partyEngine: bad team count');
  const rand = seededRandom(seed);
  const order = [...teams];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const chosen = new Set(order.slice(0, count));
  return teams.filter((t) => chosen.has(t));
}

/**
 * Draw a round's fixtures: every team once, paired at random, home side at random (§2: six
 * fixtures, the game's twelve teams). Done when the round OPENS, so players can see what to predict.
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
  pickTeams,
  drawFixtures,
  playFixtures,
  playMatch,
  teamTable,
  effectiveRating,
  seededRandom,
  ENGINE: { BLOCKS, WINDOW, SPREAD, HOME_ADVANTAGE, POSITION_BONUS, TEAMS_PER_GAME }
};
