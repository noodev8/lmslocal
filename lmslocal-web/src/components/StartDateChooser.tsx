'use client';

/*
=======================================================================================================================================
StartDateChooser
=======================================================================================================================================
Purpose: The start-date question, asked identically when a competition is created and when one is
         reset. Both are the same situation from a player's point of view - an empty competition
         that people are about to be invited into - so both get the same three dates and the same
         warning about what the deadline means.

See docs/competition-start.md. The short version: round 1 is built from whichever block is chosen,
there and then, so the competition has real fixtures and a real deadline from the moment it
exists. Nobody is ever looking at an empty screen wondering when it starts.

Dates only, no fixtures. The organiser is choosing WHEN they start, not which matches they get -
listing ten fixtures invites them to shop between gameweeks, a choice they have no basis to make,
and quietly makes them feel responsible for the football.

An empty list is a legitimate answer, not an error: the calendar has nothing far enough ahead.
The caller must still let the competition be created - it falls back to the older Ready button -
which is why this renders an explanation rather than blocking.
=======================================================================================================================================
*/

import { useState, useEffect } from 'react';
import { CalendarDaysIcon } from '@heroicons/react/24/outline';
import { competitionApi, StartOption } from '@/lib/api';
import { LABEL } from '@/lib/design';

/** A lock time, in UK time - e.g. "Fri 28 Aug, 8:00pm". */
export function formatLockTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/*
How long they have to recruit, which is the number the choice actually turns on. A date alone
makes the organiser count on their fingers, and "Fri 28 Aug" reads the same whether it is
tomorrow or a fortnight off.

Counted in calendar days rather than 24-hour blocks: an organiser choosing a Friday round on a
Wednesday thinks "two days", not "one and a half".
*/
export function daysUntil(iso: string, now: Date = new Date()): string {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(new Date(iso)) - startOfDay(now)) / 86400000);

  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

export default function StartDateChooser({
  teamListId,
  value,
  onChange,
  disabled = false,
  compact = false,
}: {
  teamListId: number | undefined;
  /* The chosen option, or null for "none available" / not yet loaded. The whole option rather
     than its id, so a caller can show the date it has chosen without re-fetching the list. */
  value: StartOption | null;
  onChange: (option: StartOption | null) => void;
  disabled?: boolean;
  /* Drops the framing - heading, intro, surrounding box - for a caller that supplies its own,
     like the reset dialog where this is a step with a title of its own. The dates and the
     deadline line are the same either way; only the packaging goes. */
  compact?: boolean;
}) {
  const [options, setOptions] = useState<StartOption[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!teamListId) {
      setOptions(null);
      return;
    }

    let cancelled = false;
    setOptions(null);
    setFailed(false);

    competitionApi.getStartOptions(teamListId)
      .then((response) => {
        if (cancelled) return;
        if (response.data.return_code === 'SUCCESS') {
          const loaded = response.data.options || [];
          setOptions(loaded);
          // Preselect the recommendation, so the common case is one fewer decision. Falls back to
          // the first option if the server sent none - never leaves a list unselected.
          const recommended = loaded.find((o) => o.block_id === response.data.recommended_block_id);
          onChange(recommended ?? loaded[0] ?? null);
        } else {
          setFailed(true);
          setOptions([]);
          onChange(null);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        setOptions([]);
        onChange(null);
      });

    return () => { cancelled = true; };
    // onChange is deliberately not a dependency: callers pass an inline setter, and including it
    // would reload the options on every render of the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamListId]);

  const chosen = value;

  return (
    <div className={compact ? '' : 'border border-ink/30 p-4'}>
      {!compact && (
        <p className={`${LABEL} mb-1 flex items-center gap-1.5 text-ink-fade`}>
          <CalendarDaysIcon className="h-4 w-4" />
          When does it start?
        </p>
      )}

      {options === null ? (
        <p className="text-[13px] text-ink-fade">Loading dates&hellip;</p>
      ) : options.length === 0 ? (
        <p className="text-[13px] text-ink-fade">
          {failed
            ? 'We could not load the start dates just now. Your competition will still be created, and we’ll be in touch with its first round.'
            : 'We don’t have the next set of matches in yet. Your competition will still be created, and its first round follows as soon as they land.'}
        </p>
      ) : (
        <>
          {!compact && (
            <p className="mb-3 text-[13px] text-ink-fade">
              Your first round is ready and waiting the moment your competition exists, so anyone you
              invite can make their pick straight away.
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {options.map((option) => {
              const selected = option.block_id === value?.block_id;
              return (
                <button
                  key={option.block_id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(option)}
                  className={`h-full border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    selected ? 'border-ink bg-ink text-stock-lit' : 'border-ink/30 hover:border-ink'
                  }`}
                >
                  {/* The gap first and largest: it is the number the choice turns on, and a date
                      on its own reads the same whether it is tomorrow or a fortnight away. */}
                  <p className={`font-display text-lg leading-tight ${selected ? 'text-stock-lit' : 'text-ink'}`}>
                    {daysUntil(option.lock_time)}
                  </p>
                  <p className={`${LABEL} mt-1`}>{option.label}</p>
                  {/* No match count. It is 10 nearly every time, so it distinguishes nothing
                      between the options and just adds a line to read. */}
                  <p className={`mt-1 text-[12px] ${selected ? 'text-stock/85' : 'text-ink-fade'}`}>
                    {formatLockTime(option.lock_time)}
                  </p>
                </button>
              );
            })}
          </div>

          {/* The single most important consequence, and the one nothing used to say out loud.
              Everyone must start together - a late joiner would face opponents who had already
              burned teams - so joining closes when round 1 locks. */}
          {chosen && (
            <p className="mt-3 border-t border-ink/30 pt-3 text-[13px] text-ink-fade">
              Players can join until{' '}
              <span className="text-ink">{formatLockTime(chosen.lock_time)}</span> — after that the
              competition is closed and everyone plays the same rounds.
            </p>
          )}
        </>
      )}
    </div>
  );
}
