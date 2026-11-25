'use client';

/*
  The card strip: how a player predicts a round, one match per card (docs/matchday.md §8.2).

  SHARED BY BOTH PREDICTION GAMES (2026-11-24): Matchday's coupon (/game/[id]/coupon) and Matchday
  Party (/mdparty). Lifted out of the Matchday coupon page so the two cannot drift apart; a change to
  how cards behave is made here, once. The strip knows nothing about either game. Each page turns its
  fixtures into StripFixtures and decides what a tap does:
    - Matchday saves every tap as it is made, so onTap awaits the server.
    - Matchday Party keeps the taps on the phone, and Done sends the whole coupon.

  THE RULES, unchanged from the Matchday page:
  - TAP A TEAM to predict it; the strip then moves to the next match. Tapping the team already
    predicted takes it back, which is how a match is skipped: there is no Skip button. The card says
    nothing about this as it is chosen - the strip has moved on before it could be read.
  - MOVING BETWEEN CARDS NEVER CHOOSES ANYTHING. A native horizontal scroller with snap points, so a
    finger swipes it, a trackpad scrolls it, and a mouse uses Previous / Next, the arrow keys or the
    tracker. Nothing asks which device it is on, and no copy tells anyone to swipe.
  - THE TRACKER is one segment per match, green once predicted; a tap jumps to that card.
  - It OPENS on the first match still to predict, once per placementKey (a round).
  - A BANKER (Matchday Party) is chosen on a screen of its own after the cards, not on them: a button
    on each card went by too fast, as the strip moves on after a tap (2026-11-25). A card only shows a
    star Banker tag when its fixture is flagged banker; Matchday flags none.
  - DONE sits on the last card, and on every card once all are predicted. Held back on an open last
    card until that match is predicted: offered before the tap, it reads as the way to finish and the
    last match gets skipped.
*/

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { LABEL, PANEL, BTN_PRIMARY, BTN_DARK } from '@/lib/design';

// Long enough to see the team turn green before the strip moves on, short enough not to wait for.
const ADVANCE_DELAY_MS = 350;

export type StripTeam = {
  /** What a prediction of this team is recorded as: a short name, a team id - the page's choice. */
  key: string;
  name: string;
  /** W / D / L going into the match, oldest first. Matchday Party shows it; Matchday has none. */
  form?: ('W' | 'D' | 'L')[];
};

export type StripFixture = {
  id: number;
  home: StripTeam;
  away: StripTeam;
  /** Top-right of the card, e.g. the kickoff. */
  meta?: string;
  /** The predicted team's key, or null. */
  chosen: string | null;
  /** "Hull won 2-1" once there is a result, else null. */
  resultText: string | null;
  /** Won / Drew / Lost and the points, once settled and predicted. */
  outcome: { word: string; points: string } | null;
  /** This prediction is the player's banker (games with a banker only). */
  banker?: boolean;
};

/** What a tap did, so the strip knows whether to move on. */
export type TapOutcome = 'chosen' | 'cleared' | 'failed';

export default function CardStrip({
  fixtures,
  editable,
  isPlayer = true,
  placementKey,
  scoringLine = null,
  onTap,
  renderExtra,
  done,
  missingNote = 'You can come back to them until the lock.',
}: {
  fixtures: StripFixture[];
  /** The round is open and this person can predict. */
  editable: boolean;
  /** False for an organiser not playing: they have no predictions, so "not predicted" says nothing true. */
  isPlayer?: boolean;
  /** Changes when a new round's strip should open afresh on its first missing match. */
  placementKey: string | number;
  /** Shown on an open card with nothing chosen, e.g. the scoring in round 1. */
  scoringLine?: string | null;
  onTap: (index: number, teamKey: string) => Promise<TapOutcome> | TapOutcome;
  /** Anything a game adds under a card, e.g. Matchday's crowd line. */
  renderExtra?: (fixture: StripFixture, index: number) => ReactNode;
  /** The Done button: a link out, or an action (Matchday Party sends the coupon). Omit for none. */
  done?: { label?: string; href?: string; onClick?: () => void; busy?: boolean };
  /** Said after "N matches not predicted - they score 0." */
  missingNote?: string;
}) {
  const [current, setCurrent] = useState(0);
  const [busyId, setBusyId] = useState<number | null>(null);

  const stripRef = useRef<HTMLDivElement | null>(null);
  const placedFor = useRef<string | number | null>(null);
  const reducedMotion = useRef(false);
  // The move to the next card after a prediction, while it is pending. Any other move cancels it: a
  // player who taps a team and straight away taps Previous or the tracker meant to go there.
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The card on screen now, for a tap whose save is awaited: the `current` its closure saw is stale.
  const currentRef = useRef(0);

  useEffect(() => {
    reducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return () => { if (advanceTimer.current) clearTimeout(advanceTimer.current); };
  }, []);

  const goTo = useCallback((index: number, smooth = true) => {
    const strip = stripRef.current;
    if (!strip) return;
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
    const clamped = Math.max(0, Math.min(index, fixtures.length - 1));
    strip.scrollTo({ left: clamped * strip.clientWidth, behavior: smooth && !reducedMotion.current ? 'smooth' : 'auto' });
    currentRef.current = clamped;
    setCurrent(clamped);
  }, [fixtures.length]);

  // Open on the first match still to predict, once per round. After that, where they are is where
  // they put it.
  useEffect(() => {
    if (fixtures.length === 0 || placedFor.current === placementKey) return;
    placedFor.current = placementKey;
    const firstMissing = editable ? fixtures.findIndex(f => f.chosen === null) : -1;
    // After paint, so the strip has a width to scroll by.
    requestAnimationFrame(() => goTo(firstMissing > 0 ? firstMissing : 0, false));
  }, [fixtures, editable, placementKey, goTo]);

  // Keep the tracker in step with the strip however it was moved: a swipe, a trackpad, a key.
  const onStripScroll = () => {
    const strip = stripRef.current;
    if (!strip || strip.clientWidth === 0) return;
    const index = Math.round(strip.scrollLeft / strip.clientWidth);
    currentRef.current = index;
    if (index !== current) setCurrent(index);
  };

  // Arrow keys move between cards - never choose. Choosing is always a tap on a team.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') goTo(current - 1);
      if (e.key === 'ArrowRight') goTo(current + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, goTo]);

  const tap = async (index: number, teamKey: string) => {
    const fixture = fixtures[index];
    if (!fixture || busyId !== null) return;
    setBusyId(fixture.id);
    let outcome: TapOutcome = 'failed';
    try {
      outcome = await onTap(index, teamKey);
    } finally {
      setBusyId(null);
    }
    // Move on only from the card that was tapped. A player who went elsewhere while the save was in
    // flight, or in the moment before the move, meant to be there - checked both now and when the
    // timer fires, since a swipe does not pass through goTo to cancel it.
    if (outcome === 'chosen' && index + 1 < fixtures.length && currentRef.current === index) {
      advanceTimer.current = setTimeout(() => {
        advanceTimer.current = null;
        if (currentRef.current === index) goTo(index + 1);
      }, ADVANCE_DELAY_MS);
    }
  };

  if (fixtures.length === 0) return null;

  const predicted = fixtures.filter(f => f.chosen !== null).length;
  const allPredicted = predicted === fixtures.length;
  const missing = fixtures.length - predicted;
  const showDone = done && (
    (current === fixtures.length - 1 && (!editable || fixtures[current].chosen !== null)) || (editable && allPredicted)
  );

  const doneClass = `${editable ? BTN_PRIMARY : BTN_DARK} block w-full px-6 py-3.5 text-xl disabled:opacity-50`;

  return (
    <>
      {/* The tracker. Segments, not a count: how many are left, and where, at a glance. Green means
          predicted; the word is in each segment's label for a screen reader. */}
      {isPlayer && (
        <div className="mb-2 flex gap-1" role="tablist" aria-label="Matches">
          {fixtures.map((f, index) => {
            const isDone = f.chosen !== null;
            return (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={index === current}
                aria-label={`Match ${index + 1}: ${f.home.name} v ${f.away.name}, ${isDone ? 'predicted' : 'not predicted'}`}
                onClick={() => goTo(index)}
                className="group flex-1 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
              >
                <span
                  className={`block h-2 rounded-full transition-colors ${
                    isDone ? 'bg-moss' : 'bg-ink/15 group-hover:bg-ink/30'
                  } ${index === current ? 'ring-2 ring-ink ring-offset-2 ring-offset-stock' : ''}`}
                />
              </button>
            );
          })}
        </div>
      )}

      <div
        ref={stripRef}
        onScroll={onStripScroll}
        className="flex snap-x snap-mandatory overflow-x-auto [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none' }}
      >
        {fixtures.map((fixture, index) => (
          <div key={fixture.id} className="w-full flex-none snap-center pb-2 pr-2">
            <MatchCard
              fixture={fixture}
              position={index + 1}
              count={fixtures.length}
              editable={editable}
              busy={busyId === fixture.id}
              scoringLine={editable ? scoringLine : null}
              isPlayer={isPlayer}
              onTap={(teamKey) => tap(index, teamKey)}
              extra={renderExtra?.(fixture, index)}
            />
          </div>
        ))}
      </div>

      {/* Previous / next, for a mouse. A finger has the swipe, but these cost nothing there. */}
      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => goTo(current - 1)}
          disabled={current === 0}
          className={`${LABEL} flex items-center gap-1 text-ink transition-colors hover:text-ink-fade disabled:invisible`}
        >
          <ChevronLeftIcon className="h-4 w-4" /> Previous
        </button>
        <span className="font-data text-[13px] text-ink-fade">{current + 1} of {fixtures.length}</span>
        <button
          type="button"
          onClick={() => goTo(current + 1)}
          disabled={current >= fixtures.length - 1}
          className={`${LABEL} flex items-center gap-1 text-ink transition-colors hover:text-ink-fade disabled:invisible`}
        >
          Next <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Done. Red while the round is open - finishing is the screen's next action - and ink once it
          is locked, when it is only the way out. */}
      {showDone && (
        <div className="mt-6 text-center">
          {editable && !allPredicted && (
            <p className="mb-3 text-[15px] text-ink-fade">
              <span className="font-data text-ink">{missing}</span>{' '}
              {missing === 1 ? 'match' : 'matches'} not predicted &mdash; they score 0. {missingNote}
            </p>
          )}
          {done.href ? (
            <Link href={done.href} className={doneClass}>{done.label ?? 'Done'}</Link>
          ) : (
            <button type="button" onClick={done.onClick} disabled={done.busy} className={doneClass}>
              {done.label ?? 'Done'}
            </button>
          )}
        </div>
      )}
    </>
  );
}

/**
 * One match. The two teams ARE the choice - no Home / Away buttons under a fixture line, which said
 * the same thing twice. Home team first, as a fixture is always written.
 */
function MatchCard({
  fixture, position, count, editable, busy, scoringLine, isPlayer, onTap, extra,
}: {
  fixture: StripFixture;
  position: number;
  count: number;
  editable: boolean;
  busy: boolean;
  scoringLine: string | null;
  isPlayer: boolean;
  onTap: (teamKey: string) => void;
  extra?: ReactNode;
}) {
  return (
    // The one print-offset shadow in the system belongs to "the sheet", and a card is exactly that.
    <div className={`${PANEL} p-5 shadow-[4px_4px_0_0_rgba(28,38,32,0.16)] sm:p-6`}>
      <div className="flex items-baseline justify-between">
        <p className={`${LABEL} text-ink-fade`}>
          Match {position} of {count}
          {fixture.banker && <span className="ml-2 text-overprint">&#9733; Banker</span>}
        </p>
        {fixture.meta && <p className="font-data text-[13px] text-ink-fade">{fixture.meta}</p>}
      </div>

      {editable && <p className={`${LABEL} mt-4 text-center text-ink`}>Who wins?</p>}

      <div className="mt-4 space-y-2">
        <TeamButton team={fixture.home} chosen={fixture.chosen === fixture.home.key} editable={editable} busy={busy} onClick={() => onTap(fixture.home.key)} />
        <p className={`${LABEL} text-center text-ink-fade`}>v</p>
        <TeamButton team={fixture.away} chosen={fixture.chosen === fixture.away.key} editable={editable} busy={busy} onClick={() => onTap(fixture.away.key)} />
      </div>

      {/* One statement under the teams (design-system §8). Every state carries its word as well as
          its colour. */}
      <div className="mt-4 min-h-[20px] text-center text-[13px]">
        {busy ? (
          <span className="text-ink-fade">Saving&hellip;</span>
        ) : fixture.outcome && fixture.chosen !== null ? (
          <span className="inline-flex items-center gap-1.5">
            {fixture.resultText && <span className="text-ink-fade">{fixture.resultText} &middot;</span>}
            <span className={`${LABEL} text-ink`}>{fixture.outcome.word}</span>
            <span className="font-data text-ink">{fixture.outcome.points}</span>
          </span>
        ) : fixture.resultText ? (
          <span className="text-ink-fade">{fixture.resultText}{isPlayer && fixture.chosen === null ? ' · not predicted' : ''}</span>
        ) : editable ? (
          // No line once a team is chosen (2026-11-25): the strip moves on straight after the tap,
          // so "Tap it again to take it back" flashed up and was gone before anyone could read it.
          fixture.chosen === null && scoringLine
            ? <span className={`${LABEL} text-ink`}>{scoringLine}</span>
            : null
        ) : isPlayer && fixture.chosen === null ? (
          <span className="text-ink-fade">Not predicted &middot; scores 0</span>
        ) : null}
      </div>

      {extra}
    </div>
  );
}

function TeamButton({
  team, chosen, editable, busy, onClick,
}: {
  team: StripTeam; chosen: boolean; editable: boolean; busy: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!editable || busy}
      aria-pressed={chosen}
      aria-label={chosen ? `${team.name} (your prediction${editable ? ' - tap to take it back' : ''})` : editable ? `${team.name} to win` : team.name}
      className={`relative flex min-h-[64px] w-full flex-col items-center justify-center border px-4 py-3 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
        chosen
          ? 'border-2 border-moss bg-moss-wash'
          : !editable
            ? 'cursor-default border-ink/15'
            : 'cursor-pointer border-ink/30 hover:border-ink disabled:cursor-wait'
      }`}
    >
      <span className="font-data text-xl leading-tight text-ink">{team.name}</span>
      {team.form && team.form.length > 0 && (
        <span className="mt-1.5 flex gap-0.5" aria-label={`Form: ${team.form.join(' ')}`}>
          {team.form.map((f, i) => (
            <span
              key={i}
              className={`inline-flex h-4 w-4 items-center justify-center font-data text-[10px] ${
                f === 'W' ? 'bg-ink text-stock-lit' : f === 'L' ? 'border border-overprint text-overprint' : 'border border-ink/40 text-ink-fade'
              }`}
            >
              {f}
            </span>
          ))}
        </span>
      )}
    </button>
  );
}
