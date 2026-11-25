'use client';

/*
  The reveal on the TV, one match at a time, with the players' league moving beside it
  (docs/matchday-party.md §6).

  SHARED AND NEUTRAL: the screen the whole room watches. Two columns:
    - THE MATCH. Who predicted each side, then the ninety minutes on a clock with a pause at half
      time, the score dead centre, turning red for a moment as a goal goes in, then full time and who scored from it.
    - THE LEAGUE of the players in the room. It moves at every full time: points go on, names slide
      up or down, and an arrow shows who rose or fell. This is where a player sees how they are doing,
      all the way through the round, without adding anything up (2026-11-25: following one's own round
      points was the thing that got lost).
  The teams' league and the teleprinter lines are not here: they added numbers without adding anything.

  Everything comes from the room's one clock (lib/mdpartyReveal.ts), so it agrees with every phone.
  Sound plays here and nowhere else: a chime as each goal goes in.
*/

import { useEffect, useRef, useState } from 'react';
import { LABEL } from '@/lib/design';
import type { PartyFixture, PartyPlayersRow } from '@/lib/api';
import {
  LEAGUE_MOVES_ON_GOALS, braveIsAlone, goalMoment, liveStandings, revealedCount, scoreAt, useRevealPosition, useTeleprinterSound, type Crowd,
} from '@/lib/mdpartyReveal';

const SOUND_KEY = 'mdparty_sound';
const ROW_REM = 3.6;          // the height of one league row, for sliding rows into their places
const GOAL_LIT_MS = 1200;     // how long the score stays lit after a goal

export default function TvReveal({
  fixtures,
  crowd,
  players,
  table,
  lockedAt,
  offsetMs,
}: {
  fixtures: PartyFixture[];
  crowd: Crowd[] | null;
  players: { id: number; name: string }[];
  /** The players' table from the server, which already counts this round in full. */
  table: PartyPlayersRow[];
  lockedAt: string | null;
  offsetMs: number;
}) {
  const pos = useRevealPosition(lockedAt, offsetMs, fixtures.length, false, 50);
  const [sound, setSound] = useState(true);
  useEffect(() => { setSound(localStorage.getItem(SOUND_KEY) !== 'off'); }, []);
  const { chime } = useTeleprinterSound(sound);

  const nameOf = (id: number) => players.find((p) => p.id === id)?.name ?? '';
  const match = fixtures[pos.index];
  const here = crowd?.find((c) => c.fixture_id === match?.id);
  const bankers = new Set(here?.bankers ?? []);
  // Names stay plain. Bankers get a tag of their own on their team's row: a star mixed into the
  // names was not always read as a banker (2026-11-25).
  const homeNames = (here?.home ?? []).map(nameOf).filter(Boolean);
  const awayNames = (here?.away ?? []).map(nameOf).filter(Boolean);
  const bankerNames = (side: 'home' | 'away') =>
    ((side === 'home' ? here?.home : here?.away) ?? []).filter((id) => bankers.has(id)).map(nameOf).filter(Boolean);

  const brave = here?.brave ?? null;
  const alone = braveIsAlone(here);

  const score = match ? scoreAt(match, pos.minute) : { home: 0, away: 0 };
  const goalsSoFar = (match?.result?.goals ?? []).filter((g) => g.minute <= pos.minute);
  const lastGoalAt = goalsSoFar.length ? goalMoment(pos.index, goalsSoFar[goalsSoFar.length - 1].minute) : -Infinity;
  const lit = pos.phase === 'play' && pos.elapsed - lastGoalAt < GOAL_LIT_MS;
  // Which team's number lights up: the side that just scored.
  const litSide = lit ? goalsSoFar[goalsSoFar.length - 1].side : null;

  // A chime as each goal goes in - only goals that happen while this screen is watching.
  const heard = useRef({ index: -1, goals: 0 });
  useEffect(() => {
    if (heard.current.index !== pos.index) heard.current = { index: pos.index, goals: goalsSoFar.length };
    if (goalsSoFar.length > heard.current.goals && pos.elapsed - lastGoalAt < 400) chime();
    heard.current.goals = goalsSoFar.length;
  });

  const revealed = revealedCount(pos, fixtures.length);
  // During a match the league moves on every goal; at full time it settles (lib/mdpartyReveal.ts).
  const inPlay = LEAGUE_MOVES_ON_GOALS && (pos.phase === 'play' || pos.phase === 'halftime');
  const standings = liveStandings(table, fixtures, crowd, revealed, inPlay && match ? { index: pos.index, score } : null);
  // Arrows show for the match just finished, until the next one kicks off.
  const showMoves = pos.phase === 'result' || pos.phase === 'intro' || pos.phase === 'done';

  const toggleSound = () => {
    setSound((on) => {
      localStorage.setItem(SOUND_KEY, on ? 'off' : 'on');
      return !on;
    });
  };


  // Once every result is in, the league is all anyone looks at: it takes the whole screen.
  const allIn = pos.phase === 'done';

  return (
    <div className={`grid gap-[3vw] pt-[2vh] ${allIn ? '' : 'lg:grid-cols-[1.4fr_1fr]'}`}>
      {/* ---------------------------------------------------------------- the match */}
      {!allIn && <div>
        <div className="flex items-baseline justify-between">
          <p className={`${LABEL} text-ink-fade`}>
            {pos.phase === 'countdown'
              ? `${fixtures.length} matches, one at a time`
              : pos.phase === 'done' ? 'All the results are in' : `Match ${pos.index + 1} of ${fixtures.length}`}
          </p>
          <button type="button" onClick={toggleSound} className={`${LABEL} text-ink-fade underline decoration-dotted underline-offset-4 hover:text-ink`}>
            Sound {sound ? 'on' : 'off'}
          </button>
        </div>

        {pos.phase === 'countdown' && (
          <p className="mt-[12vh] text-center font-display text-[clamp(3.5rem,9vw,8rem)] uppercase leading-none">Kick-off in {pos.countdown}</p>
        )}

        {match && pos.phase !== 'countdown' && pos.phase !== 'done' && (
          <section className="mt-4 border border-ink/30 bg-stock-lit px-[2.5vw] py-[4vh] shadow-[4px_4px_0_0_rgba(28,38,32,0.16)]">
            <p className="text-center font-data text-[clamp(1.4rem,2.6vw,2.2rem)] text-ink-fade">
              {pos.phase === 'intro' ? 'Kick-off' : pos.phase === 'halftime' ? 'Half time' : pos.phase === 'result' ? 'Full time' : `${pos.minute}'`}
            </p>

            {/* A scoreboard: each team on a full-width row of its own with its goals at the end, and
                under it the people who predicted it. Side by side either side of the score, long names
                (Crystal Palace, Nottm Forest) had a third of the card and squashed (2026-11-25). The two
                numbers share one column, so the score reads straight down. */}
            <div className="mt-5 divide-y divide-ink/20 border-y border-ink/30">
              {([
                { team: match.home, goals: score.home, names: homeNames, side: 'home' as const },
                { team: match.away, goals: score.away, names: awayNames, side: 'away' as const },
              ]).map((row) => (
                <div key={row.side} className="grid grid-cols-[1fr_auto] items-center gap-6 py-[2vh]">
                  <div className="min-w-0">
                    <p className="font-display text-[clamp(2.2rem,5vw,4.6rem)] uppercase leading-[0.95]">{row.team.name}</p>
                    <p className="mt-2 text-[clamp(1.05rem,1.8vw,1.6rem)]">
                      {row.names.length ? row.names.join(', ') : <span className="text-ink-fade">Nobody</span>}
                      {/* What this side's backers get if it wins, as a total - "what we are hoping for",
                          shown from the intro, not only once it has happened (2026-11-25). The brave few
                          and "on their own" say so in the same tag. Bankers have their own tag below. */}
                      {row.names.length > 0 && (
                        <span className={`${LABEL} ml-3 border px-2 py-0.5 align-middle ${brave === row.side ? 'border-overprint text-overprint' : 'border-ink/40 text-ink'}`}>
                          {brave === row.side ? (alone ? 'On their own · win +6' : 'Brave few · win +5') : 'Win +3'}
                        </span>
                      )}
                    </p>
                    {/* The banker, on a tag of its own: outlined while the team is winning, solid red
                        while it is not - the danger, in view of the room - then +6, or BUST at full time. */}
                    {(() => {
                      const names = bankerNames(row.side);
                      if (names.length === 0) return null;
                      const other = row.side === 'home' ? score.away : score.home;
                      const winning = pos.phase !== 'intro' && row.goals > other;
                      const settled = pos.phase === 'result';
                      const word = names.length > 1 ? 'Bankers' : 'Banker';
                      const text = !settled
                        ? `${word} · ${names.join(', ')} · +6 or \u22123`
                        : winning ? `${word} · ${names.join(', ')} +6` : `${word} bust · ${names.join(', ')} \u22123`;
                      const danger = pos.phase !== 'intro' && !winning;
                      return (
                        <p className={`mt-2 inline-block px-3 py-1 font-display text-[clamp(1rem,1.7vw,1.5rem)] uppercase tracking-[0.04em] transition-colors ${
                          danger ? 'bg-overprint text-stock-lit' : 'border-2 border-overprint text-overprint'
                        }`}>
                          {text}
                        </p>
                      );
                    })()}
                  </div>
                  <p className={`w-[1.6em] text-center font-data text-[clamp(3rem,7.5vw,7rem)] leading-none tabular-nums transition-[color,transform] duration-300 ${
                    litSide === row.side ? 'scale-110 text-overprint' : pos.phase === 'intro' ? 'text-ink-fade/40' : 'text-ink'
                  }`}>
                    {pos.phase === 'intro' ? '–' : row.goals}
                  </p>
                </div>
              ))}
            </div>

            {/* The draw is +1 for everyone, always, so it is not said (2026-11-25). Only the brave few's
                draw differs, and only then is there a line. */}
            {brave && (
              <p className={`${LABEL} mt-4 text-center text-ink-fade`}>
                Draw &middot; {alone ? 'on their own' : 'brave few'} +2
              </p>
            )}

            {/* No list of who scored what at full time ("+7 Dad · +3 Nan"): it was gone before anyone
                could read it, and the league beside it says the same thing (2026-11-25). */}
          </section>
        )}

        {/* No list of finished results: nobody looks back at them; the league is what is watched
            (2026-11-25). */}
      </div>}

      {/* ---------------------------------------------------------------- the league */}
      <div className={allIn ? 'mx-auto w-full max-w-4xl' : ''}>
        {allIn && <p className="mb-6 font-display text-[clamp(2.5rem,5vw,4.5rem)] uppercase leading-none">All the results are in</p>}
        <div className={`flex items-baseline gap-4 ${LABEL} text-ink-fade`}>
          <span className="flex-1">The league{inPlay && standings.some((r) => r.live !== 0) ? ' · as it stands' : ''}</span>
          <span className="w-[4.5ch] text-right font-data text-[clamp(0.9rem,1.4vw,1.3rem)] normal-case tracking-normal"><span className={LABEL}>Round</span></span>
          <span className="w-[3.5ch] text-right font-data text-[clamp(1.4rem,2.4vw,2.3rem)] normal-case tracking-normal"><span className={LABEL}>Total</span></span>
        </div>
        {/* Rows are placed by position and slide when it changes. */}
        <ol className="relative mt-4" style={{ height: `${standings.length * ROW_REM}rem` }}>
          {standings.map((r, i) => (
            <li
              key={r.player_id}
              className="absolute inset-x-0 flex items-center gap-4 border-b border-ink/20 transition-[top] duration-700 ease-out"
              style={{ top: `${i * ROW_REM}rem`, height: `${ROW_REM}rem` }}
            >
              {/* The name has the row: position, then the name with its arrow straight after it, then
                two narrow number columns. Five fixed columns had left a name "And..." (2026-11-25). */}
              <span className="w-8 shrink-0 font-data text-[clamp(1rem,1.6vw,1.5rem)] text-ink-fade">{r.position}</span>
              <span className="flex min-w-0 flex-1 items-baseline gap-2">
                <span className="truncate font-display text-[clamp(1.4rem,2.4vw,2.3rem)] uppercase">{r.name}</span>
                {showMoves && r.move !== 0 && (
                  <span className={`shrink-0 font-data text-[clamp(0.9rem,1.4vw,1.3rem)] ${r.move > 0 ? 'text-moss' : 'text-overprint'}`}>
                    {r.move > 0 ? '▲' : '▼'}
                  </span>
                )}
              </span>
              {/* The numbers are the ones the league is ordered by: as it stands, the match being
                  played included, never "48 +3" above a 50 (2026-11-25). Round first - who is having
                  the better round is the rivalry in the room - then the total. The live part is not
                  shown as a number of its own: it was one number too many (2026-11-25). */}
              {/* The round figure is always the lesser one: smaller, and in the moss green the game uses
                  for points won, so it reads as "what this round added" and never competes with the
                  total that decides the league. (A bold, larger total was tried and rejected.) */}
              <span className="w-[4.5ch] shrink-0 text-right font-data text-[clamp(0.9rem,1.4vw,1.3rem)] tabular-nums text-moss">
                {r.round_points + r.live < 0 ? `−${-(r.round_points + r.live)}` : `+${r.round_points + r.live}`}
              </span>
              <span className="flex w-[3.5ch] shrink-0 flex-col items-end font-data text-[clamp(1.4rem,2.4vw,2.3rem)] leading-none">
                <span className="tabular-nums">{r.points + r.live}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
