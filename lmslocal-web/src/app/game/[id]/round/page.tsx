'use client';

/*
The organiser's single view of the current round. Replaces the old Fixtures and Results screens,
which rendered the same match list twice and left whichever one didn't match the clock as a dead
end. What shows here is decided by src/lib/roundState.ts; the rules behind it are in
docs/round-state-machine.md. Change the doc first.
*/

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { organizerApi, teamApi, competitionApi, OrganizerFixtureWithResult } from '@/lib/api';
import { useAppData } from '@/contexts/AppDataContext';
import { cacheUtils } from '@/lib/cache';
import { LABEL, EYEBROW, HEADING, PANEL, BTN_PRIMARY, BTN_OUTLINE } from '@/lib/design';
import {
  deriveRoundState,
  deriveRoundCapabilities,
  roundStatusLine,
  formatRoundStart,
  isStartGateVisible,
  outcomeFromResult,
  ResultOutcome,
} from '@/lib/roundState';

export default function RoundPage() {
  const router = useRouter();
  const params = useParams();
  const competitionId = params.id as string;

  const { competitions, refreshCompetitions } = useAppData();
  const competition = useMemo(
    () => competitions?.find((c) => c.id.toString() === competitionId),
    [competitions, competitionId]
  );

  const [hasRound, setHasRound] = useState(false);
  const [roundNumber, setRoundNumber] = useState<number | null>(null);
  const [lockTime, setLockTime] = useState<string | null>(null);
  const [fixtures, setFixtures] = useState<OrganizerFixtureWithResult[]>([]);
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // When their first round would actually start. Only fetched in the one phase that shows it, and
  // deliberately from the server rather than derived here: the answer depends on what is staged
  // for their team list, which this screen has no other way of knowing.
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [isSettingReady, setIsSettingReady] = useState(false);

  // Re-derived on every render so the phase follows the clock without a timer: any refetch or
  // interaction re-reads `now`, which is enough to move OPEN -> LOCKED on the next paint.
  const now = new Date();

  const canManageFixtures = competition?.is_organiser || competition?.manage_fixtures || false;
  const canManageResults = competition?.is_organiser || competition?.manage_results || false;

  const state = useMemo(
    () =>
      deriveRoundState({
        hasRound,
        roundNumber,
        lockTime,
        fixtures,
        automated: competition?.fixture_service === true,
        readyToStart: competition?.ready_at != null,
        competitionComplete: competition?.is_complete === true,
        now,
      }),
    // `now` is deliberately excluded - including it would rebuild the state every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hasRound, roundNumber, lockTime, fixtures, competition?.fixture_service, competition?.ready_at, competition?.is_complete]
  );

  const capabilities = useMemo(
    () => deriveRoundCapabilities(state, { canManageFixtures, canManageResults }, fixtures),
    [state, canManageFixtures, canManageResults, fixtures]
  );

  /* Deliberately uncached - see docs/round-state-machine.md §7. This screen exists to say what is
     true right now, and a stale result count is the one thing that makes an organiser think the
     system is broken. */
  const loadRound = useCallback(async () => {
    setLoadError('');
    try {
      const response = await organizerApi.getFixturesForResults(parseInt(competitionId));

      if (response.data.return_code === 'SUCCESS') {
        setHasRound(true);
        setRoundNumber(response.data.round_number);
        setLockTime(response.data.round_start_time);
        setFixtures(response.data.fixtures || []);
      } else if (response.data.return_code === 'NO_ROUNDS') {
        // Not an error - it's the NO_ROUND phase, which has its own copy.
        setHasRound(false);
        setRoundNumber(null);
        setLockTime(null);
        setFixtures([]);
      } else if (response.data.return_code === 'UNAUTHORIZED') {
        setLoadError('You do not have permission to view this round.');
      } else {
        setLoadError(response.data.message || 'Could not load this round.');
      }
    } catch (error) {
      console.error('Error loading round:', error);
      setLoadError('Network error — could not reach the server.');
    } finally {
      setIsLoading(false);
    }
  }, [competitionId]);

  useEffect(() => {
    if (competition) loadRound();
  }, [competition, loadRound]);

  // Only the automated first-round phase has anywhere to show this, and only once they are ready
  // is there a date to show.
  const showStartGate = isStartGateVisible(state, { canManageResults, canManageFixtures });
  // Fetched in both faces of the gate: the date is the answer to "what happens if I press this?",
  // so it belongs on screen before the button as well as after.
  const shouldLoadOutlook = showStartGate;

  useEffect(() => {
    if (!shouldLoadOutlook) {
      setStartsAt(null);
      return;
    }

    let cancelled = false;
    competitionApi.getStartOutlook(parseInt(competitionId))
      .then((response) => {
        if (cancelled || response.data.return_code !== 'SUCCESS') return;
        setStartsAt(response.data.starts_at);
      })
      .catch(() => { /* The card falls back to "when the next matches are in", which is still true */ });

    return () => { cancelled = true; };
  }, [shouldLoadOutlook, competitionId]);

  const handleStartCompetition = async () => {
    if (!competition) return;
    setIsSettingReady(true);
    setActionError('');

    try {
      const response = await competitionApi.setReady(competition.id, true);

      if (response.data.return_code === 'SUCCESS') {
        cacheUtils.invalidateCompetitions();
        await refreshCompetitions();
      } else {
        setActionError(response.data.message || 'Could not update your competition.');
      }
    } catch (error) {
      console.error('Error setting ready:', error);
      setActionError('Network error — could not reach the server.');
    } finally {
      setIsSettingReady(false);
    }
  };

  // The organiser's real pattern is to leave this open, go and do something else, and come back
  // expecting it to be current. Cheaper and more accurate than any TTL.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadRound();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [loadRound]);

  // Team names are genuinely static, so this is the one thing here worth taking from cache.
  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const response = await teamApi.getTeams();
        if (response.data.return_code === 'SUCCESS' && response.data.teams) {
          const mapping: Record<string, string> = {};
          response.data.teams.forEach((team) => {
            mapping[team.short_name] = team.name;
          });
          setTeamNames(mapping);
        }
      } catch (error) {
        console.error('Failed to fetch teams:', error);
        // Falls back to short codes, which are still readable.
      }
    };
    fetchTeams();
  }, []);

  const handleResultClick = async (fixture: OrganizerFixtureWithResult, outcome: ResultOutcome) => {
    if (!capabilities.canEnterResults) return;

    const current = outcomeFromResult(fixture.result, fixture.home_team_short, fixture.away_team_short);

    // Tapping the result that's already set clears it. Entering results is a long sitting where
    // a mis-tap is ordinary, and without this the only way back was to pick a result you knew to
    // be wrong and leave it there. A processed fixture is still immutable - the buttons stop
    // being interactive, and the server refuses with ALREADY_PROCESSED regardless.
    const isUndo = current === outcome;

    setActionError('');
    const previous = fixture.result;

    // The server stores a team code or 'DRAW', so the optimistic value has to be in that
    // vocabulary too - otherwise the row disagrees with itself until the next refetch.
    const optimistic = isUndo
      ? null
      : outcome === 'draw'
      ? 'DRAW'
      : outcome === 'home_win'
      ? fixture.home_team_short
      : fixture.away_team_short;

    setFixtures((prev) => prev.map((f) => (f.id === fixture.id ? { ...f, result: optimistic } : f)));

    try {
      const response = await organizerApi.setResult(fixture.id, isUndo ? 'clear' : outcome);
      if (response.data.return_code !== 'SUCCESS') {
        setFixtures((prev) => prev.map((f) => (f.id === fixture.id ? { ...f, result: previous } : f)));
        setActionError(response.data.message || 'Could not save that result.');
      }
    } catch (error) {
      console.error('Error setting result:', error);
      setFixtures((prev) => prev.map((f) => (f.id === fixture.id ? { ...f, result: previous } : f)));
      setActionError('Network error — that result was not saved.');
    }
  };

  const handleProcessResults = async () => {
    setIsProcessing(true);
    setActionError('');

    try {
      const response = await organizerApi.processResults(parseInt(competitionId));

      if (response.data.return_code === 'SUCCESS') {
        cacheUtils.invalidateCompetition(parseInt(competitionId));
        // Unconditional, unlike the screen this replaces: the dashboard's round and pick figures
        // move whether or not anyone was eliminated.
        await refreshCompetitions(true);
        await loadRound();
      } else if (response.data.return_code === 'NO_RESULTS_TO_PROCESS') {
        setActionError('There is nothing left to process in this round.');
      } else {
        setActionError(response.data.message || 'Could not process this round.');
      }
    } catch (error) {
      console.error('Error processing results:', error);
      // The server commits regardless of whether anyone is still listening, so the likeliest
      // reading is that it worked. Telling them to check stops a pointless retry.
      setActionError('We lost contact while processing. Reload to check — it may already be done.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!competition) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stock font-body text-ink">
        <p className={EYEBROW}>Loading&hellip;</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stock font-body text-ink">
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <Link
          href={`/game/${competitionId}`}
          className={`${LABEL} mb-4 inline-flex items-center gap-1.5 text-ink-fade transition-colors hover:text-ink`}
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to dashboard
        </Link>

        <p className={EYEBROW}>{state.roundNumber ? `Round ${state.roundNumber}` : 'Round'}</p>
        <h1 className={`${HEADING} mt-1 text-3xl`}>{competition.name}</h1>

        {!isLoading && !loadError && (
          <p className="mt-2 text-[15px] text-ink-fade">{roundStatusLine(state)}</p>
        )}

        {/* No "managed for you" badge here. Who typed the fixtures in is our business, not the
            organiser's - they're on the page either way, and the phrase explains an implementation
            detail that changes nothing they do. The one place it earns its keep is the LOCKED
            status line, where results are due and there are deliberately no buttons. */}

        {actionError && (
          <div className={`${PANEL} mt-5 border-overprint p-4`}>
            <p className="text-[15px] text-ink">{actionError}</p>
          </div>
        )}

        {isLoading && (
          <div className={`${PANEL} mt-5`}>
            <p className="p-8 text-center text-[15px] text-ink-fade">Loading&hellip;</p>
          </div>
        )}

        {!isLoading && loadError && (
          <div className={`${PANEL} mt-5 border-overprint p-6`}>
            <p className="text-[15px] text-ink">{loadError}</p>
          </div>
        )}

        {/* The start gate. An automated competition gets no fixtures at all until the organiser
            presses Ready — see docs/round-state-machine.md §5. We never name a date we haven't
            got: once ready, the card shows the real kickoff if a batch is staged for them, and
            says so plainly if not. */}
        {!isLoading && !loadError && state.phase === 'NO_ROUND' && showStartGate && (
          <div className={`${PANEL} mt-5 p-6 ${!state.readyToStart ? 'border-overprint' : ''}`}>
            {!state.readyToStart ? (
              <>
                <p className={`${HEADING} text-xl`}>
                  {startsAt ? `Start with the matches on ${formatRoundStart(startsAt)}?` : 'Start with the next set of matches?'}
                </p>
                <p className="mt-2 text-[15px] text-ink-fade">
                  {startsAt
                    ? 'That would be your Round 1, and your players can pick as soon as it appears. Nothing happens until you press this.'
                    : "We don't have the next set of matches yet. Say the word now and your Round 1 will be the first ones that arrive."}
                </p>
                <button
                  type="button"
                  onClick={() => handleStartCompetition()}
                  disabled={isSettingReady}
                  className={`${BTN_PRIMARY} mt-4 inline-flex px-6 py-3 text-base disabled:opacity-50`}
                >
                  {isSettingReady ? 'Starting…' : 'Yes, start my competition'}
                </button>
              </>
            ) : (
              <>
                <p className={`${HEADING} text-xl`}>
                  {startsAt ? `Round 1 starts ${formatRoundStart(startsAt)}` : 'Waiting for the next matches'}
                </p>
                <p className="mt-2 text-[15px] text-ink-fade">
                  {startsAt
                    ? 'Your players can pick as soon as it appears here.'
                    : "You're ready. Your first round will start as soon as the next set of matches is in."}
                </p>
              </>
            )}
          </div>
        )}

        {!isLoading && !loadError && state.phase === 'NO_ROUND' && !showStartGate && (
          <div className={`${PANEL} mt-5 p-6`}>
            <p className="text-[15px] text-ink-fade">
              {state.automated
                ? 'Nothing to do — the next round will appear here once its matches are published.'
                : 'Nothing to show until this round has matches.'}
            </p>
            {capabilities.canEditFixtures && (
              <Link href={`/game/${competitionId}/organizer-fixtures`} className={`${BTN_PRIMARY} mt-4 inline-flex px-6 py-3 text-base`}>
                Add matches
              </Link>
            )}
          </div>
        )}

        {!isLoading && !loadError && state.phase !== 'NO_ROUND' && fixtures.length > 0 && (
          <div className={`${PANEL} mt-5`}>
            <div className="divide-y divide-ink/30">
              {fixtures.map((fixture) => {
                const homeName = teamNames[fixture.home_team_short] || fixture.home_team_short;
                const awayName = teamNames[fixture.away_team_short] || fixture.away_team_short;
                const outcome = outcomeFromResult(
                  fixture.result,
                  fixture.home_team_short,
                  fixture.away_team_short
                );

                /* The winner is named twice on this row - in the fixture line and in the slots -
                   and both use the same green. A losing side only fades. Red is not used here
                   even though a loss eliminates: every decided fixture has a loser, so half the
                   screen would be overprint and the colour would stop meaning "needs you". */
                const homeWon = outcome === 'home_win';
                const awayWon = outcome === 'away_win';
                const beaten = outcome !== null && outcome !== 'draw';

                return (
                  <div key={fixture.id} className="px-4 py-3 sm:px-5 sm:py-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-data text-[15px]">
                        <span className={homeWon ? 'font-semibold text-moss' : beaten ? 'text-ink-fade' : 'text-ink'}>
                          {homeName}
                        </span>
                        <span className="text-ink-fade"> vs </span>
                        <span className={awayWon ? 'font-semibold text-moss' : beaten ? 'text-ink-fade' : 'text-ink'}>
                          {awayName}
                        </span>
                      </span>
                      {/* Only meaningful once results are expected; before kickoff every row
                          would carry the same empty marker. */}
                      {capabilities.showResultSlots && !outcome && (
                        <span className={`${LABEL} flex-shrink-0 text-ink-fade`}>To play</span>
                      )}
                    </div>

                    {/* Absent before kickoff, not disabled - a grid of dead buttons on a round
                        that hasn't started reads as broken software. */}
                    {capabilities.showResultSlots && (
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <ResultSlot
                          label={fixture.home_team_short}
                          selected={homeWon}
                          decided={outcome !== null}
                          tone="win"
                          interactive={capabilities.canEnterResults}
                          onClick={() => handleResultClick(fixture, 'home_win')}
                        />
                        <ResultSlot
                          label="Draw"
                          selected={outcome === 'draw'}
                          decided={outcome !== null}
                          tone="draw"
                          interactive={capabilities.canEnterResults}
                          onClick={() => handleResultClick(fixture, 'draw')}
                        />
                        <ResultSlot
                          label={fixture.away_team_short}
                          selected={awayWon}
                          decided={outcome !== null}
                          tone="win"
                          interactive={capabilities.canEnterResults}
                          onClick={() => handleResultClick(fixture, 'away_win')}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* The round is settled and the next one doesn't exist yet. This is the only route
                onward for a manual competition - without it the organiser's week ends on a
                read-only page with nothing to press. */}
            {capabilities.canEditFixtures && (
              <div className="flex flex-col items-start gap-3 border-t border-ink/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[15px] text-ink-fade">
                  This round is settled. Add next week&rsquo;s matches when you have them.
                </p>
                <Link
                  href={`/game/${competitionId}/organizer-fixtures`}
                  className={`${BTN_PRIMARY} inline-flex flex-none px-6 py-3 text-base`}
                >
                  Add next matches
                </Link>
              </div>
            )}

            {capabilities.canProcessResults && (
              <div className="border-t border-ink/30 p-4">
                {isProcessing && (
                  <div role="status" aria-live="polite" className={`${PANEL} mb-4 flex items-start gap-3 p-4`}>
                    <span
                      aria-hidden="true"
                      className="mt-[5px] h-2 w-2 flex-none animate-pulse rounded-full bg-overprint"
                    />
                    <div>
                      <p className={`${LABEL} text-ink`}>Processing results</p>
                      <p className="mt-1 text-[15px] text-ink-fade">
                        Please don&rsquo;t refresh or close this page.
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleProcessResults}
                    disabled={isProcessing}
                    className={`${BTN_PRIMARY} px-6 py-3 text-base disabled:opacity-40`}
                  >
                    {isProcessing ? 'Processing…' : 'Process results'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* A round that exists but carries no fixtures. Rare, but it used to render as an empty
            panel with no explanation. */}
        {!isLoading && !loadError && state.phase !== 'NO_ROUND' && fixtures.length === 0 && (
          <div className={`${PANEL} mt-5 p-6`}>
            <p className="text-[15px] text-ink-fade">This round has no matches yet.</p>
          </div>
        )}

        {!isLoading && !loadError && state.phase !== 'NO_ROUND' && (
          <button
            type="button"
            onClick={() => router.push(`/game/${competitionId}/standings`)}
            className={`${BTN_OUTLINE} mt-5`}
          >
            View standings
          </button>
        )}
      </main>
    </div>
  );
}

/*
One result slot. Renders as a button only when it can actually be pressed - otherwise it is a
read-out, so a view-only organiser never sees a control that does nothing.

Three states, and the colour carries which one:

  undecided  outlined, full-strength ink   nothing has happened here yet
  winner     filled moss (green)           a team won - the only green on the row
  draw       filled ink (near-black)       settled, but nobody won, so not green
  beaten     faded, hairline border        recedes; it is context, not news

The old version filled the selected slot with ink whatever it meant, so "Hull won" and "Draw"
looked identical and neither read as a result - just as the pressed one of three buttons.
*/
function ResultSlot({
  label,
  selected,
  decided,
  tone,
  interactive,
  onClick,
}: {
  label: string;
  selected: boolean;
  decided: boolean;
  tone: 'win' | 'draw';
  interactive: boolean;
  onClick: () => void;
}) {
  const base = `${LABEL} border py-2.5 text-center transition-colors`;

  // Both colours are AA on their fill: moss is 7.3:1 on stock and carries stock-lit text, per
  // the palette notes in tailwind.config.js.
  const filled = tone === 'win' ? 'border-moss bg-moss text-stock-lit' : 'border-ink bg-ink text-stock-lit';
  const beaten = 'border-ink/15 text-ink-fade/50';

  if (!interactive) {
    return <span className={`${base} ${selected ? filled : beaten}`}>{label}</span>;
  }

  // aria-pressed, not a plain button: these three are a toggle group, and tapping the selected
  // one clears it. Screen readers announce the pressed state, and the title says so for everyone
  // else - nothing about a filled-in slot otherwise suggests it can be undone.
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      title={selected ? 'Tap again to clear this result' : undefined}
      className={`${base} cursor-pointer ${
        selected ? filled : decided ? `${beaten} hover:border-ink/40` : 'border-ink/30 text-ink hover:border-ink'
      }`}
    >
      {label}
    </button>
  );
}
