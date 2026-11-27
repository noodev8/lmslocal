/*
=======================================================================================================================================
Script: mdparty-engine-sim.js   (Matchday Party engine — NO DATABASE, nothing written anywhere)
=======================================================================================================================================
Purpose: Tune the Matchday Party engine (services/mdPartyEngine.js, docs/matchday-party.md §4) before any
         screen exists. Plays the engine thousands of times and reports what a room would feel: how
         often the favourite wins, how many goals, the common scorelines, how far form moves a team.

The ratings below are PROVISIONAL, set 2026-11-24 to get the engine running. They are a judgement
for Andreas to make; when they are agreed they move into the mdparty_team table (§7) and this script
should read them from there.

Usage (from lmslocal-server/):
    node scripts/mdparty-engine-sim.js                 the summary: match-ups, scorelines, form
    node scripts/mdparty-engine-sim.js game [rounds]   play one whole game (default 3 rounds), round by round
    node scripts/mdparty-engine-sim.js game 3 --seed 42    the same game again
=======================================================================================================================================
*/

const { pickTeams, drawFixtures, playFixtures, playMatch, teamTable, seededRandom, ENGINE } = require('../services/mdPartyEngine');

// PROVISIONAL - see the header. Names match team_list 1 (English Premier League 2026-27).
const TEAMS = [
  ['Man City', 92], ['Arsenal', 90], ['Liverpool', 88], ['Chelsea', 82], ['Newcastle', 78],
  ['Tottenham', 74], ['Aston Villa', 74], ['Man Utd', 70], ['Brighton', 68], ['Nottm Forest', 65],
  ['Crystal Palace', 64], ['Bournemouth', 62], ['Brentford', 60], ['Fulham', 58], ['Everton', 56],
  ['Leeds', 48], ['Sunderland', 44], ['Ipswich', 36], ['Coventry', 30], ['Hull', 20]
].map(([name, rating], i) => ({ id: i + 1, name, rating }));
const FULL_LEAGUE = [...TEAMS];

const pct = (n, of) => `${Math.round((100 * n) / of)}%`.padStart(4);

function matchups() {
  const N = 100000;
  const rand = seededRandom(1);
  const pairs = [
    ['Top v bottom, at home', 92, 20],
    ['Bottom v top, at home', 20, 92],
    ['Top half v bottom half', 74, 48],
    ['Evenly matched', 62, 60],
    ['Hull top after round 1 (+12) v Arsenal 6th (+7), at home', 32, 97]
  ];
  console.log(`\nSingle matches, ${N.toLocaleString()} each        home  draw  away  goals`);
  for (const [label, h, a] of pairs) {
    let w = 0, d = 0, l = 0, g = 0;
    for (let i = 0; i < N; i++) {
      const m = playMatch(h, a, rand);
      g += m.home_goals + m.away_goals;
      if (m.home_goals > m.away_goals) w++; else if (m.home_goals === m.away_goals) d++; else l++;
    }
    console.log(`  ${`${label} (${h} v ${a})`.padEnd(56)}${pct(w, N)}  ${pct(d, N)}  ${pct(l, N)}  ${(g / N).toFixed(2)}`);
  }
}

function playGame(rounds, seed, pool = TEAMS) {
  const rand = seededRandom(seed);
  const teams = pool === TEAMS ? pickTeams(TEAMS, Math.floor(rand() * 2 ** 32)) : pool;
  const results = [];
  const byRound = [];
  for (let r = 1; r <= rounds; r++) {
    const fixtures = drawFixtures(teams, Math.floor(rand() * 2 ** 32));
    const played = playFixtures({ teams, fixtures, results, roundNumber: r, seed: Math.floor(rand() * 2 ** 32) });
    results.push(...played);
    byRound.push(played);
  }
  return { teams, results, byRound };
}

// One length of game, many times over. `pool` is TEAMS for the game as played (a random twelve);
// FULL_LEAGUE is the old all-twenty game, kept as the yardstick.
function lengthStats(rounds, games, pool) {
  let matches = 0, goals = 0, favWins = 0, upsets = 0, draws = 0;
  let cityIn = 0, cityBottom = 0, hullIn = 0, hullTop = 0, bestBottom = 0, worstTop = 0;
  for (let g = 0; g < games; g++) {
    const { teams, results } = playGame(rounds, g + 1, pool);
    const half = teams.length / 2;
    for (const m of results) {
      matches++;
      goals += m.home_goals + m.away_goals;
      if (m.home_goals === m.away_goals) draws++;
      const homeFav = m.home_rating + ENGINE.HOME_ADVANTAGE >= m.away_rating;
      if (homeFav ? m.home_goals > m.away_goals : m.away_goals > m.home_goals) favWins++;
      if (homeFav ? m.home_goals < m.away_goals : m.away_goals < m.home_goals) upsets++;
    }
    const table = teamTable(teams, results);
    const pos = (id) => table.find((t) => t.id === id).position;
    const byRating = [...teams].sort((a, b) => b.rating - a.rating);
    if (pos(byRating[0].id) > half) bestBottom++;
    if (pos(byRating[byRating.length - 1].id) <= half) worstTop++;
    const city = teams.find((t) => t.name === 'Man City');
    const hull = teams.find((t) => t.name === 'Hull');
    if (city) { cityIn++; if (pos(city.id) > half) cityBottom++; }
    if (hull) { hullIn++; if (pos(hull.id) <= half) hullTop++; }
  }
  return {
    rounds, teams: pool === TEAMS ? ENGINE.TEAMS_PER_GAME : pool.length,
    goalsPerRound: goals / matches * (pool === TEAMS ? ENGINE.TEAMS_PER_GAME : pool.length) / 2,
    draws: draws / matches, favWins: favWins / matches, upsets: upsets / matches,
    bestBottom: bestBottom / games, worstTop: worstTop / games,
    cityIn: cityIn / games, cityBottom: cityIn ? cityBottom / cityIn : 0, hullTop: hullIn ? hullTop / hullIn : 0
  };
}

function summary() {
  matchups();

  const GAMES = 20000;
  const f = (x) => `${Math.round(100 * x)}%`.padStart(5);
  console.log(`
${GAMES.toLocaleString()} games of each length`);
  console.log('  teams rounds  goals/rd  draws  fav wins  upsets | strongest in game  weakest in game | City plays  City bottom  Hull top');
  console.log('                                                   | in bottom half     in top half     |            half         half');
  for (const pool of [TEAMS, FULL_LEAGUE]) {
    for (const rounds of [2, 3, 4]) {
      const r = lengthStats(rounds, GAMES, pool);
      console.log(`  ${String(r.teams).padStart(5)} ${String(rounds).padStart(6)}  ${r.goalsPerRound.toFixed(1).padStart(8)}  ${f(r.draws)}  ${f(r.favWins).padStart(8)}  ${f(r.upsets).padStart(6)} | ${f(r.bestBottom).padStart(17)}  ${f(r.worstTop).padStart(15)} | ${f(r.cityIn).padStart(10)}  ${f(r.cityBottom).padStart(11)}  ${f(r.hullTop).padStart(8)}`);
    }
  }

  // Who the random twelve tends to be: how often the gap between the best and worst team is small.
  const rand = seededRandom(7);
  const gaps = [];
  for (let g = 0; g < GAMES; g++) {
    const t = pickTeams(TEAMS, Math.floor(rand() * 2 ** 32)).map((x) => x.rating);
    gaps.push(Math.max(...t) - Math.min(...t));
  }
  gaps.sort((a, b) => a - b);
  console.log(`
The random twelve: best-to-worst rating gap, median ${gaps[GAMES / 2]}, 10th percentile ${gaps[GAMES / 10]}, smallest ${gaps[0]} (full league: 72)`);
  console.log(`
Engine: ${JSON.stringify(ENGINE)}`);
}

function oneGame(rounds, seed) {
  const name = (id) => TEAMS[id - 1].name.toUpperCase();
  const { teams, results, byRound } = playGame(rounds, seed);
  byRound.forEach((fixtures, i) => {
    console.log(`\nROUND ${i + 1}`);
    for (const f of fixtures) {
      const scorers = f.goals.map((g) => `${g.side === 'home' ? 'H' : 'A'}${g.minute}'`).join(' ');
      console.log(`  ${name(f.home_id).padStart(15)} ${f.home_goals}  ${f.away_goals} ${name(f.away_id).padEnd(15)} (${f.home_rating} v ${f.away_rating})  ${scorers}`);
    }
  });
  console.log('\nTABLE');
  for (const t of teamTable(teams, results)) {
    console.log(`  ${String(t.position).padStart(2)} ${t.name.padEnd(15)} P${t.played} W${t.won} D${t.drawn} L${t.lost}  GD ${String(t.gd).padStart(3)}  ${t.points} pts`);
  }
  console.log(`\nseed ${seed}`);
}

const [mode, roundsArg] = process.argv.slice(2);
if (mode === 'game') {
  const seedAt = process.argv.indexOf('--seed');
  const seed = seedAt > -1 ? Number(process.argv[seedAt + 1]) : Math.floor(Math.random() * 1e6);
  oneGame(Number(roundsArg) > 0 ? Number(roundsArg) : 3, seed);
} else {
  summary();
}
