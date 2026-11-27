'use client';

/*
  The reveal on the TV - and, since 2026-11-27, on every phone too, identically (`onPhone` only
  sizes it down and keeps it silent) - one match at a time, with the players' league moving beside it
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
import MatchBoard from './MatchBoard';
import type { PartyFixture, PartyPlayersRow } from '@/lib/api';
import {
  LEAGUE_MOVES_ON_GOALS, goalMoment, liveStandings, revealedCount, scoreAt, useRevealPosition, useTeleprinterSound, type Crowd,
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
  onPhone = false,
}: {
  fixtures: PartyFixture[];
  crowd: Crowd[] | null;
  players: { id: number; name: string }[];
  /** The players' table from the server, which already counts this round in full. */
  table: PartyPlayersRow[];
  lockedAt: string | null;
  offsetMs: number;
  /** The same screen on a phone (2026-11-27): smaller scoreboard, and silent - sound is the TV's. */
  onPhone?: boolean;
}) {
  const pos = useRevealPosition(lockedAt, offsetMs, fixtures.length, false, 50);
  const [sound, setSound] = useState(true);
  useEffect(() => { setSound(localStorage.getItem(SOUND_KEY) !== 'off'); }, []);
  const { chime } = useTeleprinterSound(sound && !onPhone);

  const nameOf = (id: number) => players.find((p) => p.id === id)?.name ?? '';
  const match = fixtures[pos.index];



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


  // WHERE IT IS SEEN (2026-11-27). The TV page fills a screen, so its type is sized to the window
  // (vw). The phone page is a narrow column wherever it is opened - a phone, or the host's laptop -
  // so on it everything is a fixed size and stacked: the match, then the league. Sizing the phone
  // page by the window gave a laptop the TV's two columns in a column too narrow for them, and the
  // league's names shrank to a letter.
  const S = onPhone
    ? { grid: 'grid gap-6', two: '', countdown: 'mt-10 text-5xl', allIn: 'text-4xl', pos: 'text-[15px]', name: 'text-2xl', small: 'text-[15px]', big: 'text-2xl', rowRem: 2.75 }
    : { grid: 'grid gap-[3vw] pt-[2vh]', two: 'lg:grid-cols-[1.4fr_1fr]', countdown: 'mt-[12vh] text-[clamp(3.5rem,9vw,8rem)]', allIn: 'text-[clamp(2.5rem,5vw,4.5rem)]', pos: 'text-[clamp(1rem,1.6vw,1.5rem)]', name: 'text-[clamp(1.4rem,2.4vw,2.3rem)]', small: 'text-[clamp(0.9rem,1.4vw,1.3rem)]', big: 'text-[clamp(1.4rem,2.4vw,2.3rem)]', rowRem: ROW_REM };

  // Once every result is in, the league is all anyone looks at: it takes the whole screen.
  const allIn = pos.phase === 'done';

  return (
    <div className={`${S.grid} ${allIn ? '' : S.two}`}>
      {/* ---------------------------------------------------------------- the match */}
      {!allIn && <div>
        <div className="flex items-baseline justify-between">
          <p className={`${LABEL} text-ink-fade`}>
            {pos.phase === 'countdown'
              ? `${fixtures.length} matches, one at a time`
              : pos.phase === 'done' ? 'All the results are in' : `Match ${pos.index + 1} of ${fixtures.length}`}
          </p>
          {!onPhone && <button type="button" onClick={toggleSound} className={`${LABEL} text-ink-fade underline decoration-dotted underline-offset-4 hover:text-ink`}>
            Sound {sound ? 'on' : 'off'}
          </button>}
        </div>

        {pos.phase === 'countdown' && (
          <p className={`${S.countdown} text-center font-display uppercase leading-none`}>Kick-off in {pos.countdown}</p>
        )}

        {match && pos.phase !== 'countdown' && pos.phase !== 'done' && (
          <div className="mt-4">
            <MatchBoard match={match} score={score} pos={pos} crowd={crowd} nameOf={nameOf} litSide={litSide} compact={onPhone} />
          </div>
        )}

        {/* No list of finished results: nobody looks back at them; the league is what is watched
            (2026-11-25). */}
      </div>}

      {/* ---------------------------------------------------------------- the league */}
      <div className={allIn ? 'mx-auto w-full max-w-4xl' : ''}>
        {allIn && <p className={`mb-6 font-display ${S.allIn} uppercase leading-none`}>All the results are in</p>}
        <div className={`flex items-baseline gap-4 ${LABEL} text-ink-fade`}>
          <span className="flex-1">The league{inPlay && standings.some((r) => r.live !== 0) ? ' · as it stands' : ''}</span>
          <span className={`w-[4.5ch] text-right font-data ${S.small} normal-case tracking-normal`}><span className={LABEL}>Round</span></span>
          <span className={`w-[3.5ch] text-right font-data ${S.big} normal-case tracking-normal`}><span className={LABEL}>Total</span></span>
        </div>
        {/* Rows are placed by position and slide when it changes. */}
        <ol className="relative mt-4" style={{ height: `${standings.length * S.rowRem}rem` }}>
          {standings.map((r, i) => (
            <li
              key={r.player_id}
              className="absolute inset-x-0 flex items-center gap-4 border-b border-ink/20 transition-[top] duration-700 ease-out"
              style={{ top: `${i * S.rowRem}rem`, height: `${S.rowRem}rem` }}
            >
              {/* The name has the row: position, then the name with its arrow straight after it, then
                two narrow number columns. Five fixed columns had left a name "And..." (2026-11-25). */}
              <span className={`w-8 shrink-0 font-data ${S.pos} text-ink-fade`}>{r.position}</span>
              <span className="flex min-w-0 flex-1 items-baseline gap-2">
                <span className={`truncate font-display ${S.name} uppercase`}>{r.name}</span>
                {showMoves && r.move !== 0 && (
                  <span className={`shrink-0 font-data ${S.small} ${r.move > 0 ? 'text-moss' : 'text-overprint'}`}>
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
              <span className={`w-[4.5ch] shrink-0 text-right font-data ${S.small} tabular-nums text-moss`}>
                {r.round_points + r.live < 0 ? `−${-(r.round_points + r.live)}` : `+${r.round_points + r.live}`}
              </span>
              <span className={`flex w-[3.5ch] shrink-0 flex-col items-end font-data ${S.big} leading-none`}>
                <span className="tabular-nums">{r.points + r.live}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
