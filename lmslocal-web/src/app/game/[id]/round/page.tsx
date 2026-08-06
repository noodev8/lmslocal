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
import { organizerApi, teamApi, OrganizerFixtureWithResult } from '@/lib/api';
import { useAppData } from '@/contexts/AppDataContext';
import { cacheUtils } from '@/lib/cache';
import { LABEL, EYEBROW, HEADING, PANEL, BTN_PRIMARY, BTN_OUTLINE } from '@/lib/design';
import {
  deriveRoundState,
  deriveRoundCapabilities,
  roundStatusLine,
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
        competitionComplete: competition?.is_complete === true,
        now,
      }),
    // `now` is deliberately excluded - including it would rebuild the state every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hasRound, roundNumber, lockTime, fixtures, competition?.fixture_service, competition?.is_complete]
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

        {!isLoading && !loadError && state.phase === 'NO_ROUND' && (
          <div className={`${PANEL} mt-5 p-6`}>
            <p className="text-[15px] text-ink-fade">
              {state.automated
                ? 'Nothing to do — the next round will appear here once its fixtures are published.'
                : 'Nothing to show until this round has fixtures.'}
            </p>
            {capabilities.canEditFixtures && (
              <Link href={`/game/${competitionId}/organizer-fixtures`} className={`${BTN_PRIMARY} mt-4 inline-flex px-6 py-3 text-base`}>
                Add fixtures
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

                return (
                  <div key={fixture.id} className="px-4 py-3 sm:px-5 sm:py-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-data text-[15px] text-ink">
                        {homeName} <span className="text-ink-fade">vs</span> {awayName}
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
                          selected={outcome === 'home_win'}
                          interactive={capabilities.canEnterResults}
                          onClick={() => handleResultClick(fixture, 'home_win')}
                        />
                        <ResultSlot
                          label="Draw"
                          selected={outcome === 'draw'}
                          interactive={capabilities.canEnterResults}
                          onClick={() => handleResultClick(fixture, 'draw')}
                        />
                        <ResultSlot
                          label={fixture.away_team_short}
                          selected={outcome === 'away_win'}
                          interactive={capabilities.canEnterResults}
                          onClick={() => handleResultClick(fixture, 'away_win')}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

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
            <p className="text-[15px] text-ink-fade">This round has no fixtures yet.</p>
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
*/
function ResultSlot({
  label,
  selected,
  interactive,
  onClick,
}: {
  label: string;
  selected: boolean;
  interactive: boolean;
  onClick: () => void;
}) {
  const base = `${LABEL} border py-2.5 text-center transition-colors`;

  if (!interactive) {
    return (
      <span
        className={`${base} ${
          selected ? 'border-ink bg-ink text-stock-lit' : 'border-ink/15 text-ink-fade/50'
        }`}
      >
        {label}
      </span>
    );
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
      className={`${base} ${
        selected
          ? 'cursor-pointer border-ink bg-ink text-stock-lit'
          : 'cursor-pointer border-ink/30 text-ink hover:border-ink'
      }`}
    >
      {label}
    </button>
  );
}
