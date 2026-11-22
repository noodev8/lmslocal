'use client';

/*
How long a Matchday game lasts: a number of rounds, from a fixed list (ROUND_CHOICES in
src/lib/games.ts, enforced by the server). Most points after the last round wins. One component
for the create wizard and the settings screen, so the two always offer the same game.

There used to be a second kind of ending, a points target. It was withdrawn 2026-11-22 - the
reasoning is in lmslocal-server/services/matchdayScoring.js.
*/

import { LABEL } from '@/lib/design';
import { ROUND_CHOICES } from '@/lib/games';

const CHOSEN = 'border-ink bg-ink text-stock-lit';
const UNCHOSEN = 'border-ink/30 hover:border-ink';
const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

export default function EndingChooser({
  value,
  onChange,
}: {
  value: number;
  onChange: (rounds: number) => void;
}) {
  return (
    <div>
      <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Number of rounds">
        {ROUND_CHOICES.map((choice) => (
          <button
            key={choice}
            type="button"
            role="radio"
            aria-checked={value === choice}
            onClick={() => onChange(choice)}
            className={`border p-3 text-center transition-colors ${FOCUS} ${value === choice ? CHOSEN : UNCHOSEN}`}
          >
            <span className="font-display text-2xl">{choice}</span>
            <span className={`${LABEL} mt-0.5 block`}>rounds</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[13px] text-ink-fade">Most points after the last round wins.</p>
    </div>
  );
}
