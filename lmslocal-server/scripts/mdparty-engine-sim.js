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
    node scripts/mdparty-engine-sim.js game [rounds]   play one whole game (default 6 rounds), round by round
    node scripts/mdparty-engine-sim.js game 6 --seed 42    the same game again
=======================================================================================================================================
*/

const { drawFixtures, playFixtures, playMatch, teamTable, seededRandom, ENGINE } = require('../services/mdPartyEngine');

// PROVISIONAL - see the header. Names match team_list 1 (English Premier League 2026-27).
const TEAMS = [
  ['Man City', 92], ['Arsenal', 90], ['Liverpool', 88], ['Chelsea', 82], ['Newcastle', 78],
  ['Tottenham', 74], ['Aston Villa', 74], ['Man Utd', 70], ['Brighton', 68], ['Nottm Forest', 65],
  ['Crystal Palace', 64], ['Bournemouth', 62], ['Brentford', 60], ['Fulham', 58], ['Everton', 56],
  ['Leeds', 48], ['Sunderland', 44], ['Ipswich', 36], ['Coventry', 30], ['Hull', 20]
].map(([name, rating], i) => ({ id: i + 1, name, rating }));

const pct = (n, of) => `${Math.round((100 * n) / of)}%`.padStart(4);

function matchups() {
  const N = 100000;
  const rand = seededRandom(1);
  const pairs = [
    ['Top v bottom, at home', 92, 20],
    ['Bottom v top, at home', 20, 92],
    ['Top half v bottom half', 74, 48],
    ['Evenly matched', 62, 60],
    ['Hull top after round 1 (+20) v Arsenal 10th (+11)', 40, 101]
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

function playGame(rounds, seed) {
  const rand = seededRandom(seed);
  const results = [];
  const byRound = [];
  for (let r = 1; r <= rounds; r++) {
    const fixtures = drawFixtures(TEAMS, Math.floor(rand() * 2 ** 32));
    const played = playFixtures({ teams: TEAMS, fixtures, results, roundNumber: r, seed: Math.floor(rand() * 2 ** 32) });
    results.push(...played);
    byRound.push(played);
  }
  return { results, byRound };
}

function summary() {
  matchups();

  const GAMES = 5000;
  const ROUNDS = 6;
  const scorelines = new Map();
  let matches = 0, homeWins = 0, draws = 0, goals = 0, favWins = 0, upsets = 0;
  let hullTopHalf = 0, cityBottomHalf = 0;
  for (let g = 0; g < GAMES; g++) {
    const { results } = playGame(ROUNDS, g + 1);
    for (const m of results) {
      matches++;
      goals += m.home_goals + m.away_goals;
      const key = `${Math.max(m.home_goals, m.away_goals)}-${Math.min(m.home_goals, m.away_goals)}`;
      scorelines.set(key, (scorelines.get(key) || 0) + 1);
      if (m.home_goals > m.away_goals) homeWins++;
      if (m.home_goals === m.away_goals) draws++;
      const homeFav = m.home_rating + ENGINE.HOME_ADVANTAGE >= m.away_rating;
      const favWon = homeFav ? m.home_goals > m.away_goals : m.away_goals > m.home_goals;
      const favLost = homeFav ? m.home_goals < m.away_goals : m.away_goals < m.home_goals;
      if (favWon) favWins++;
      if (favLost) upsets++;
    }
    const table = teamTable(TEAMS, results);
    if (table.find((t) => t.name === 'Hull').position <= 10) hullTopHalf++;
    if (table.find((t) => t.name === 'Man City').position > 10) cityBottomHalf++;
  }

  console.log(`\n${GAMES.toLocaleString()} games of ${ROUNDS} rounds (${matches.toLocaleString()} matches)`);
  console.log(`  Goals a match ${(goals / matches).toFixed(2)} · home wins ${pct(homeWins, matches)} · draws ${pct(draws, matches)}`);
  console.log(`  Favourite (by this round's rating) wins ${pct(favWins, matches)} · loses ${pct(upsets, matches)}`);
  console.log(`  Hull (rated 20) finish in the top half ${pct(hullTopHalf, GAMES)} of games`);
  console.log(`  Man City (rated 92) finish in the bottom half ${pct(cityBottomHalf, GAMES)} of games`);
  console.log('\n  Most common scorelines');
  [...scorelines.entries()].sort((x, y) => y[1] - x[1]).slice(0, 10)
    .forEach(([s, n]) => console.log(`    ${s.padEnd(5)} ${pct(n, matches)}`));
  console.log(`\nEngine: ${JSON.stringify(ENGINE)}`);
}

function oneGame(rounds, seed) {
  const name = (id) => TEAMS[id - 1].name.toUpperCase();
  const { results, byRound } = playGame(rounds, seed);
  byRound.forEach((fixtures, i) => {
    console.log(`\nROUND ${i + 1}`);
    for (const f of fixtures) {
      const scorers = f.goals.map((g) => `${g.side === 'home' ? 'H' : 'A'}${g.minute}'`).join(' ');
      console.log(`  ${name(f.home_id).padStart(15)} ${f.home_goals}  ${f.away_goals} ${name(f.away_id).padEnd(15)} (${f.home_rating} v ${f.away_rating})  ${scorers}`);
    }
  });
  console.log('\nTABLE');
  for (const t of teamTable(TEAMS, results)) {
    console.log(`  ${String(t.position).padStart(2)} ${t.name.padEnd(15)} P${t.played} W${t.won} D${t.drawn} L${t.lost}  GD ${String(t.gd).padStart(3)}  ${t.points} pts`);
  }
  console.log(`\nseed ${seed}`);
}

const [mode, roundsArg] = process.argv.slice(2);
if (mode === 'game') {
  const seedAt = process.argv.indexOf('--seed');
  const seed = seedAt > -1 ? Number(process.argv[seedAt + 1]) : Math.floor(Math.random() * 1e6);
  oneGame(Number(roundsArg) > 0 ? Number(roundsArg) : 6, seed);
} else {
  summary();
}
