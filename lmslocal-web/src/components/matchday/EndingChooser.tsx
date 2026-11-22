'use client';

/*
How a Matchday game ends: a points target or a number of rounds, each from a fixed list
(ENDING_CHOICES in src/lib/games.ts, enforced by the server). One component for the create wizard
and the settings screen, so the two always offer the same game.
*/

import type { MatchdayEndRule } from '@/lib/api';
import { LABEL } from '@/lib/design';
import { ENDING_CHOICES, DEFAULT_ENDING } from '@/lib/games';

const CHOSEN = 'border-ink bg-ink text-stock-lit';
const UNCHOSEN = 'border-ink/30 hover:border-ink';
const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

export default function EndingChooser({
  rule,
  value,
  onChange,
}: {
  rule: MatchdayEndRule;
  value: number;
  onChange: (rule: MatchdayEndRule, value: number) => void;
}) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="How it ends">
        {(['points', 'rounds'] as MatchdayEndRule[]).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={rule === option}
            // Switching kind lands on that kind's middle choice rather than keeping a number that
            // means something else: 20 points is not 20 rounds.
            onClick={() => rule !== option && onChange(option, DEFAULT_ENDING[option])}
            className={`border p-3 text-left transition-colors sm:p-4 ${FOCUS} ${rule === option ? CHOSEN : UNCHOSEN}`}
          >
            <p className={LABEL}>{option === 'points' ? 'A points target' : 'A number of rounds'}</p>
            <p className={`mt-1 text-[13px] ${rule === option ? 'text-stock/85' : 'text-ink-fade'}`}>
              {option === 'points' ? 'The first to reach it wins.' : 'Most points when the last round is played wins.'}
            </p>
          </button>
        ))}
      </div>

      <p className={`${LABEL} mb-2 mt-4 text-ink-fade`}>{rule === 'points' ? 'Points to win' : 'Number of rounds'}</p>
      <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label={rule === 'points' ? 'Points to win' : 'Number of rounds'}>
        {ENDING_CHOICES[rule].map((choice) => (
          <button
            key={choice}
            type="button"
            role="radio"
            aria-checked={value === choice}
            onClick={() => onChange(rule, choice)}
            className={`border p-3 text-center transition-colors ${FOCUS} ${value === choice ? CHOSEN : UNCHOSEN}`}
          >
            <span className="font-display text-2xl">{choice}</span>
            <span className={`${LABEL} mt-0.5 block`}>{rule === 'points' ? 'points' : 'rounds'}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
