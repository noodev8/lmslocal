/*
=======================================================================================================================================
Script: mdparty-bots.js   (Matchday Party test players — TESTING ONLY)
=======================================================================================================================================
Purpose: Fill a Matchday Party room with made-up players so a game can be judged alone: the live league moving, names under
         each side on the TV, who called what. Added 2026-11-25 because a league of one tells you nothing.

         NOT PART OF THE GAME. It goes through the same public routes a player's phone does (join-mdparty-room,
         get-mdparty-state, set-mdparty-predictions) and nothing else, so the game code knows nothing about it. Its players
         are ordinary mdparty_player rows in that one room, deleted with the room after 24 hours like everyone else's.

How the made-up players predict: most matches, not all (a few blanks, as people leave them), leaning towards the team with
the better form and a little towards the home side, with enough chance in it that they disagree with each other. Most take a
banker on the match they feel surest of.

Usage (from lmslocal-server/, with the API running):
    node scripts/mdparty-bots.js --code KXBRT                 5 players join, then play every round until the game ends
    node scripts/mdparty-bots.js --code KXBRT --players 3     how many (1 to 7; the host makes the eighth)
    node scripts/mdparty-bots.js --code KXBRT --api https://...   another API (default http://localhost:3015)

The room must still be in its lobby: joining closes when the host starts. Start the game once they have joined.
Stop with Ctrl+C at any time; the players stay in the room but stop sending coupons, and the round waits for them, so lock it
from the host's screen.
=======================================================================================================================================
*/

const NAMES = ['Nan', 'Grandad', 'Uncle Pete', 'Auntie Sue', 'Jack', 'Priya', 'Tom', 'Ellie', 'Mo', 'Hannah',
  'Leo', 'Dave', 'Sian', 'Raj', 'Megan', 'Ollie', 'Fran', 'Kofi', 'Beth', 'Sam'];

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const code = String(arg('code', '')).trim().toUpperCase();
const count = Math.max(1, Math.min(7, Number(arg('players', 5))));
const API = String(arg('api', 'http://localhost:3015')).replace(/\/$/, '');

if (!/^[A-Z]{5}$/.test(code)) {
  console.error('Give the room code: node scripts/mdparty-bots.js --code KXBRT [--players 5]');
  process.exit(1);
}

async function post(path, body) {
  const res = await fetch(`${API}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return res.json();
}

const formPoints = (form) => form.reduce((n, f) => n + (f === 'W' ? 3 : f === 'D' ? 1 : 0), 0);

/**
 * A plausible coupon: mostly predicted, leaning on form and home, never quite the same twice. Most
 * players (70%) also take a banker, on the prediction they feel surest of.
 */
function coupon(fixtures) {
  const picks = fixtures
    .filter(() => Math.random() < 0.9)
    .map((f) => {
      const home = formPoints(f.home.form) + 1.5 + Math.random() * 5;
      const away = formPoints(f.away.form) + Math.random() * 5;
      return { fixture_id: f.id, team_id: home >= away ? f.home.id : f.away.id, sureness: Math.abs(home - away) };
    });
  const surest = [...picks].sort((a, b) => b.sureness - a.sureness)[0];
  return {
    predictions: picks.map(({ fixture_id, team_id }) => ({ fixture_id, team_id })),
    banker: surest && Math.random() < 0.7 ? surest.fixture_id : null,
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const bots = [];
  const names = [...NAMES].sort(() => Math.random() - 0.5);
  for (const name of names) {
    if (bots.length >= count) break;
    const r = await post('join-mdparty-room', { code, name });
    if (r.return_code === 'SUCCESS') {
      bots.push({ id: r.player_id, name: r.name, token: r.player_token, sentRound: 0 });
      console.log(`joined: ${r.name}`);
    } else if (r.return_code === 'NAME_TAKEN') {
      continue;
    } else {
      console.error(`could not join: ${r.return_code} ${r.message || ''}`);
      if (bots.length === 0) process.exit(1);
      break;
    }
  }
  console.log(`${bots.length} test player(s) in ${code}. Start the game from the host's screen; Ctrl+C to stop.`);

  for (;;) {
    await sleep(2000);
    let state;
    try {
      state = await post('get-mdparty-state', { code });
    } catch {
      continue;
    }
    if (state.return_code !== 'SUCCESS') {
      console.log(`room gone (${state.return_code}); stopping.`);
      return;
    }
    const { room, round, players } = state;
    if (room.state === 'finished') {
      console.log('game finished; stopping.');
      return;
    }
    if (room.state !== 'open' || !round) continue;

    for (const bot of bots) {
      if (bot.sentRound === round.number) continue;
      const me = players.find((p) => p.id === bot.id);
      if (!me) { bot.sentRound = round.number; continue; } // removed by the host
      if (me.submitted) { bot.sentRound = round.number; continue; }
      // Spread over a few seconds, so the TV's "Sent" list fills in like a room rather than at once.
      await sleep(400 + Math.random() * 1600);
      const c = coupon(round.fixtures);
      const r = await post('set-mdparty-predictions', { code, player_token: bot.token, round: round.number, predictions: c.predictions, banker_fixture_id: c.banker });
      bot.sentRound = round.number;
      console.log(`round ${round.number}: ${bot.name} sent (${r.return_code}${r.everyone_sent ? ', everyone in - kick off' : ''})`);
    }
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
