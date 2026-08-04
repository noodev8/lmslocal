'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { organizerApi, teamApi, OrganizerFixtureWithResult } from '@/lib/api';
import { useAppData } from '@/contexts/AppDataContext';
import { LABEL, EYEBROW, HEADING, PANEL, BTN_PRIMARY } from '@/lib/design';

interface FixtureWithClientState extends OrganizerFixtureWithResult {
  result_entered?: 'home_win' | 'away_win' | 'draw';
  processed?: string | null;
}

/* Derives the outcome already saved on a fixture from its real `result` field - used to seed
   result_entered on load (so a reload doesn't blank out results that were already set) and for
   the read-only automated view, where there is no client-side selection to fall back on. */
function actualOutcome(fixture: FixtureWithClientState): 'home_win' | 'away_win' | 'draw' | null {
  if (!fixture.result) return null;
  if (fixture.result === 'DRAW') return 'draw';
  if (fixture.result === fixture.home_team_short) return 'home_win';
  if (fixture.result === fixture.away_team_short) return 'away_win';
  return null;
}

export default function OrganizerResultsPage() {
  const router = useRouter();
  const params = useParams();
  const competitionId = params.id as string;

  // Get competition from context
  const { competitions, refreshCompetitions } = useAppData();
  const competition = useMemo(() => {
    return competitions?.find(c => c.id.toString() === competitionId);
  }, [competitions, competitionId]);

  // Results state
  const [roundNumber, setRoundNumber] = useState<number | null>(null);
  const [roundStartTime, setRoundStartTime] = useState<string | null>(null);
  const [fixtures, setFixtures] = useState<FixtureWithClientState[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processError, setProcessError] = useState('');

  // Team names mapping (fetched from API with cache)
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});

  // Fetch teams on mount
  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const response = await teamApi.getTeams();
        if (response.data.return_code === 'SUCCESS' && response.data.teams) {
          // Build mapping from short_name to name
          const mapping: Record<string, string> = {};
          response.data.teams.forEach(team => {
            mapping[team.short_name] = team.name;
          });
          setTeamNames(mapping);
        }
      } catch (error) {
        console.error('Failed to fetch teams:', error);
        // Continue with empty mapping - will fall back to short codes
      }
    };

    fetchTeams();
  }, []);

  // Check authentication and authorization
  useEffect(() => {
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      router.push('/login');
      return;
    }

    // Check if user has permission to manage results (organizer or delegated permission)
    const canManageResults = competition?.is_organiser || competition?.manage_results;
    if (competition && !canManageResults) {
      router.push(`/game/${competitionId}`);
      return;
    }

  }, [router, competitionId, competition]);

  // Load fixtures on mount
  useEffect(() => {
    if (competition) {
      loadFixtures();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competition]);

  const loadFixtures = async () => {
    setIsLoading(true);
    setLoadError('');

    try {
      const response = await organizerApi.getFixturesForResults(parseInt(competitionId));

      if (response.data.return_code === 'SUCCESS') {
        setRoundNumber(response.data.round_number);
        setRoundStartTime(response.data.round_start_time);
        // Seed result_entered from whatever was already saved, so a reload mid-round shows the
        // same selections instead of resetting them - previously this only happened in read-only
        // mode, so an organiser who navigated away and back saw a blank sheet and a disabled
        // Process button with no explanation.
        const loadedFixtures = (response.data.fixtures || []).map((f: FixtureWithClientState) => ({
          ...f,
          result_entered: actualOutcome(f) ?? undefined
        }));
        setFixtures(loadedFixtures);
      } else if (response.data.return_code === 'NO_ROUNDS') {
        setLoadError('No rounds exist for this competition yet. Please add fixtures first.');
      } else if (response.data.return_code === 'UNAUTHORIZED') {
        setLoadError('You are not authorized to view results for this competition');
      } else {
        setLoadError(response.data.message || 'Failed to load fixtures');
      }
    } catch (error) {
      console.error('Error loading fixtures:', error);
      setLoadError('Network error - could not connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle result button click
  const handleResultClick = async (fixture: FixtureWithClientState, result: 'home_win' | 'away_win' | 'draw') => {
    // If clicking the same result, unselect it (UI only, no API call)
    if (fixture.result_entered === result) {
      setFixtures(prevFixtures =>
        prevFixtures.map(f =>
          f.id === fixture.id ? { ...f, result_entered: undefined } : f
        )
      );
      return; // No API call when unselecting
    }

    // Selecting a new result - update UI and call API
    const previousResult = fixture.result_entered;
    setFixtures(prevFixtures =>
      prevFixtures.map(f =>
        f.id === fixture.id ? { ...f, result_entered: result } : f
      )
    );

    try {
      const response = await organizerApi.setResult(fixture.id, result);

      if (response.data.return_code !== 'SUCCESS') {
        // Revert on error
        setFixtures(prevFixtures =>
          prevFixtures.map(f =>
            f.id === fixture.id ? { ...f, result_entered: previousResult } : f
          )
        );
        alert(`Error: ${response.data.message || 'Failed to save result'}`);
      }
    } catch (error) {
      console.error('Error setting result:', error);
      // Revert on error
      setFixtures(prevFixtures =>
        prevFixtures.map(f =>
          f.id === fixture.id ? { ...f, result_entered: previousResult } : f
        )
      );
      alert('Network error - could not save result');
    }
  };

  // Handle process results
  const handleProcessResults = async () => {
    setIsProcessing(true);
    setProcessError('');

    try {
      const response = await organizerApi.processResults(parseInt(competitionId));

      if (response.data.return_code === 'SUCCESS') {
        // Check if any players were eliminated (which changes the active player count)
        const playersEliminated = response.data.players_eliminated || 0;

        // Invalidate caches so stats refresh when organizer returns to dashboard
        const { cacheUtils } = await import('@/lib/api');
        cacheUtils.invalidateKey(`user-dashboard`);
        cacheUtils.invalidateKey(`pick-statistics-${competitionId}`);
        cacheUtils.invalidatePattern(`round-statistics-${competitionId}-*`); // Clear all round stats for this competition
        cacheUtils.invalidateKey(`rounds-${competitionId}`); // Clear round status (Live vs Results)

        // Only refresh AppDataContext if players were eliminated (player count changed)
        if (playersEliminated > 0) {
          await refreshCompetitions(true); // Pass true to bypass cache
        }

        // Wait for all cache operations to complete before redirecting
        await new Promise(resolve => setTimeout(resolve, 100));

        // Redirect to game dashboard with fresh data
        router.push(`/game/${competitionId}`);

      } else if (response.data.return_code === 'NO_RESULTS_TO_PROCESS') {
        setProcessError('All fixtures have been processed or have no results set');
      } else {
        setProcessError(response.data.message || 'Failed to process results');
      }
    } catch (error) {
      console.error('Error processing results:', error);
      // Deliberately not "failed". The likeliest way to land here is the connection dropping
      // while the server was still working - and the server finishes and commits regardless of
      // whether anyone is still listening, so the results are usually already saved. Telling
      // them to check first stops a pointless retry and stops them thinking the round is stuck.
      setProcessError('We lost contact while results were processing. Reload the page to check - they may already be done.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Enable Process Results whenever a saved, unprocessed result exists - not just ones touched
  // this browser session, so the button's state survives a reload.
  const hasResultsToProcess = fixtures.some(f => !!f.result_entered && f.processed === null);

  // Check if round has started (current time >= round start time)
  const roundHasStarted = useMemo(() => {
    if (!roundStartTime) return true; // If no start time, allow entry
    const now = new Date();
    const startTime = new Date(roundStartTime);
    return now >= startTime;
  }, [roundStartTime]);

  // Calculate time until round starts
  const timeUntilStart = useMemo(() => {
    if (!roundStartTime || roundHasStarted) return null;
    const now = new Date();
    const startTime = new Date(roundStartTime);
    const diffMs = startTime.getTime() - now.getTime();
    const diffMins = Math.ceil(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const remainingMins = diffMins % 60;

    if (diffHours > 24) {
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
    } else if (diffHours > 0) {
      return `${diffHours}h ${remainingMins}m`;
    } else {
      return `${diffMins} minute${diffMins !== 1 ? 's' : ''}`;
    }
  }, [roundStartTime, roundHasStarted]);

  // Automated competitions are read-only here - the fixture service owns their results.
  const readOnly = competition?.fixture_service === true;

  // Show loading while competition data loads
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
        <Link href={`/game/${competitionId}`} className={`${LABEL} mb-4 inline-flex items-center gap-1.5 text-ink-fade transition-colors hover:text-ink`}>
          <ArrowLeftIcon className="h-4 w-4" />
          Back
        </Link>

        <p className={EYEBROW}>{readOnly ? 'Results' : 'Enter results'}</p>
        <h1 className={`${HEADING} mt-1 text-3xl`}>{competition.name}</h1>
        {readOnly && (
          <p className="mt-2 text-[15px] text-ink-fade">
            Fixtures are managed automatically for this competition — view only.
          </p>
        )}
        <p className={`${LABEL} mt-2 text-ink-fade`}>
          {roundNumber ? `Round ${roundNumber}` : 'Loading…'}
        </p>

        <div className={`${PANEL} mt-5`}>
          {(loadError || processError) && (
            <div className="border-b border-overprint p-4">
              <p className="text-[15px] text-ink">{loadError || processError}</p>
            </div>
          )}

          {isLoading && (
            <p className="p-8 text-center text-[15px] text-ink-fade">Loading fixtures&hellip;</p>
          )}

          {/* No Rounds State */}
          {!isLoading && loadError && !readOnly && (
            <div className="p-8 text-center">
              <button
                onClick={() => router.push(`/game/${competitionId}/organizer-fixtures`)}
                className={`${BTN_PRIMARY} px-6 py-3 text-base`}
              >
                Add fixtures
              </button>
            </div>
          )}

          {/* Fixtures List */}
          {!isLoading && !loadError && fixtures.length > 0 && roundNumber && (
            <>
              {/* Round Not Started Warning */}
              {!readOnly && !roundHasStarted && timeUntilStart && (
                <div className="border-b border-ink/30 p-4">
                  <p className="text-[15px] text-ink">
                    Round hasn&apos;t started yet — results can be entered in <span className="font-medium">{timeUntilStart}</span>
                    {roundStartTime && (
                      <span className="text-ink-fade">
                        {' '}({new Date(roundStartTime).toLocaleString('en-GB', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })})
                      </span>
                    )}
                  </p>
                </div>
              )}

              {/* Fixtures */}
              <div className="divide-y divide-ink/30">
                {fixtures.map((fixture) => {
                  const homeTeamName = teamNames[fixture.home_team_short] || fixture.home_team_short;
                  const awayTeamName = teamNames[fixture.away_team_short] || fixture.away_team_short;
                  const resultEntered = readOnly ? actualOutcome(fixture) : fixture.result_entered;
                  const isProcessed = fixture.processed !== null;
                  const disabled = readOnly || !roundHasStarted || isProcessed;

                  const buttonClass = (isSelected: boolean) => `${LABEL} border py-2.5 text-center transition-colors ${
                    isSelected
                      ? isProcessed
                        ? 'border-ink/40 bg-stock text-ink-fade'
                        : 'border-ink bg-ink text-stock-lit'
                      : disabled
                      ? 'cursor-not-allowed border-ink/15 text-ink-fade/50'
                      : 'cursor-pointer border-ink/30 text-ink hover:border-ink'
                  }`;

                  return (
                    <div key={fixture.id} className="p-4 sm:p-5">
                      <span className="font-data text-[15px] text-ink">
                        {homeTeamName} <span className="text-ink-fade">vs</span> {awayTeamName}
                      </span>

                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => handleResultClick(fixture, 'home_win')}
                          disabled={disabled}
                          className={buttonClass(resultEntered === 'home_win')}
                          title={readOnly ? 'View only' : !roundHasStarted ? 'Round has not started yet' : isProcessed ? 'Results already processed' : ''}
                        >
                          {fixture.home_team_short}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResultClick(fixture, 'draw')}
                          disabled={disabled}
                          className={buttonClass(resultEntered === 'draw')}
                          title={readOnly ? 'View only' : !roundHasStarted ? 'Round has not started yet' : isProcessed ? 'Results already processed' : ''}
                        >
                          Draw
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResultClick(fixture, 'away_win')}
                          disabled={disabled}
                          className={buttonClass(resultEntered === 'away_win')}
                          title={readOnly ? 'View only' : !roundHasStarted ? 'Round has not started yet' : isProcessed ? 'Results already processed' : ''}
                        >
                          {fixture.away_team_short}
                        </button>
                      </div>
                      {isProcessed && <p className={`${LABEL} mt-2 text-ink-fade`}>Processed</p>}
                    </div>
                  );
                })}
              </div>

              {/* Process Results Button - hidden entirely for automated competitions, the
                  fixture service processes results as part of pushing them */}
              {!readOnly && (
                <div className="border-t border-ink/30 p-4">
                  {/* The server sends nothing back until every pick has been settled, so there is
                      no real progress to report and no honest way to estimate a duration - a big
                      round takes many times longer than a small one. This says what is happening
                      and asks them not to reload, which is the part that matters: a reload loses
                      their view of the outcome, and a second run started mid-flight is work the
                      server then has to throw away. */}
                  {isProcessing && (
                    <div
                      role="status"
                      aria-live="polite"
                      className={`${PANEL} mb-4 flex items-start gap-3 p-4`}
                    >
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
                      disabled={!hasResultsToProcess || isProcessing}
                      className={`${BTN_PRIMARY} px-6 py-3 text-base disabled:opacity-40`}
                    >
                      {isProcessing ? 'Processing…' : 'Process results'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
