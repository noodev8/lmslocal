'use client';

import { useEffect, useState } from 'react';

/**
 * The signature element of the landing page: a filled-in competition sheet that
 * plays itself out. Each round strikes more names through in overprint red and
 * the "still in" count falls, so a visitor understands the game without reading
 * a word of explanation. Illustrative example, not real player data.
 *
 * The typewriter face is used here deliberately — these are the entries someone
 * wrote onto the form. It is not used for interface labels, where it is far too
 * hard to read at small sizes.
 */

type Entrant = {
  name: string;
  team: string;
  /** Round they went out in, or null if still standing at the end. */
  out: number | null;
};

const TOTAL_ROUNDS = 7;

const ENTRANTS: Entrant[] = [
  { name: 'Dave R.', team: 'Arsenal', out: null },
  { name: 'Sam T.', team: 'Spurs', out: 1 },
  { name: 'Priya K.', team: 'Everton', out: 2 },
  { name: 'Mo A.', team: 'Newcastle', out: null },
  { name: 'James W.', team: 'Wolves', out: 3 },
  { name: 'Ellie B.', team: 'Brighton', out: 7 },
  { name: 'Gaz', team: 'Chelsea', out: 4 },
  { name: 'Big Kev', team: 'Leeds', out: 5 },
  { name: 'Sue P.', team: 'Everton', out: 4 },
  { name: 'Tomasz L.', team: 'Man Utd', out: 5 },
  { name: 'Nia H.', team: 'Sunderland', out: 4 },
  { name: 'Deano', team: 'Leeds', out: 1 },
  { name: 'Fiona M.', team: 'Brentford', out: 3 },
  { name: 'Raj S.', team: 'Villa', out: 6 },
  { name: 'Chloe D.', team: 'Wolves', out: 5 },
  { name: 'Bez', team: 'Forest', out: 2 },
  { name: 'Aisha N.', team: 'Palace', out: 6 },
  { name: 'Pat Q.', team: 'Villa', out: 3 },
  { name: 'Liam O.', team: 'Spurs', out: 4 },
  { name: 'Marge', team: 'Burnley', out: 1 },
  { name: 'Stu', team: 'Fulham', out: 2 },
  { name: 'Yusuf A.', team: 'Bournemouth', out: 3 },
  { name: 'Karen L.', team: 'Palace', out: 2 },
  { name: 'Rob T.', team: 'West Ham', out: 1 },
];

export default function SurvivalSheet() {
  // Rest at the finished sheet, so the completed competition is what renders on
  // the server, without JavaScript, in a throttled background tab, and in any
  // screenshot. The play-through is an enhancement on top of a state that
  // already reads correctly — it is never the only thing that makes sense.
  const [round, setRound] = useState(TOTAL_ROUNDS);
  const [playing, setPlaying] = useState(false);
  const [replay, setReplay] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let timer: ReturnType<typeof setTimeout>;

    // requestAnimationFrame does not fire in a background tab, so an unseen tab
    // simply keeps the finished sheet rather than rewinding and sticking there.
    const frame = requestAnimationFrame(() => {
      setRound(0);
      setPlaying(true);
      let current = 0;

      const step = () => {
        current += 1;
        setRound(current);
        if (current < TOTAL_ROUNDS) {
          timer = setTimeout(step, 620);
        } else {
          setPlaying(false);
        }
      };

      timer = setTimeout(step, 700);
    });

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [replay]);

  const stillIn = ENTRANTS.filter((e) => e.out === null || e.out > round).length;

  return (
    <figure className="border border-ink/35 bg-stock-lit shadow-[4px_4px_0_0_rgba(28,38,32,0.16)]">
      {/* Sheet head */}
      <figcaption className="flex items-baseline justify-between gap-3 border-b border-ink/35 px-5 py-3 sm:px-6">
        <span className="font-display text-xl font-semibold uppercase tracking-[0.1em] text-ink sm:text-2xl">
          The Crown &amp; Anchor
        </span>
        <span className="whitespace-nowrap font-body text-xs font-semibold uppercase tracking-[0.1em] text-ink-fade">
          Round {Math.max(round, 1)}/{TOTAL_ROUNDS}
        </span>
      </figcaption>

      {/* The names */}
      <ul className="grid grid-cols-2 gap-x-5 px-5 py-4 sm:gap-x-7 sm:px-6 sm:py-5">
        {ENTRANTS.map((entrant) => {
          const struck = entrant.out !== null && entrant.out <= round;
          return (
            <li key={entrant.name} className="flex items-baseline gap-2 py-[5px]">
              <span
                className={`relative whitespace-nowrap font-data text-[14px] transition-colors duration-300 sm:text-[15px] ${
                  struck ? 'text-ink-fade' : 'text-ink'
                }`}
              >
                {entrant.name}
                <span
                  aria-hidden="true"
                  className="absolute left-0 right-0 top-1/2 h-[1.5px] origin-left bg-overprint transition-transform duration-300 ease-out"
                  style={{ transform: struck ? 'scaleX(1)' : 'scaleX(0)' }}
                />
              </span>
              <span
                aria-hidden="true"
                className="min-w-[0.5rem] flex-1 translate-y-[-3px] border-b border-dotted border-ink/30"
              />
              <span
                className={`whitespace-nowrap font-data text-[12px] transition-colors duration-300 sm:text-[13px] ${
                  struck ? 'text-overprint' : 'text-ink-fade'
                }`}
              >
                {entrant.team}
              </span>
              {struck && <span className="sr-only">— out</span>}
            </li>
          );
        })}
      </ul>

      {/* Sheet foot */}
      <div className="flex items-center justify-between gap-3 border-t border-ink/35 px-5 py-3.5 sm:px-6">
        <p
          aria-live="polite"
          className="font-display text-lg uppercase tracking-[0.08em] text-ink sm:text-xl"
        >
          <span className="text-overprint">{stillIn}</span> of 24 still in
        </p>
        {!playing ? (
          <button
            type="button"
            onClick={() => setReplay((n) => n + 1)}
            className="font-body text-xs font-semibold uppercase tracking-[0.1em] text-ink-fade underline decoration-dotted underline-offset-4 transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-overprint"
          >
            Play again
          </button>
        ) : (
          <span className="font-body text-xs font-semibold uppercase tracking-[0.1em] text-ink-fade">
            Playing…
          </span>
        )}
      </div>
    </figure>
  );
}
