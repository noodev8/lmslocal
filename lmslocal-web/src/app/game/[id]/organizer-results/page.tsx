'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { organizerApi, OrganizerFixtureWithResult } from '@/lib/api';
import { useAppData } from '@/contexts/AppDataContext';

// Team full names mapping
const TEAM_NAMES: Record<string, string> = {
  'ARS': 'Arsenal',
  'AVL': 'Aston Villa',
  'BOU': 'Bournemouth',
  'BRE': 'Brentford',
  'BHA': 'Brighton',
  'BUR': 'Burnley',
  'CHE': 'Chelsea',
  'CRY': 'Crystal Palace',
  'EVE': 'Everton',
  'FUL': 'Fulham',
  'LIV': 'Liverpool',
  'LUT': 'Luton Town',
  'MCI': 'Man City',
  'MUN': 'Man United',
  'NEW': 'Newcastle',
  'NFO': 'Nottingham Forest',
  'SHU': 'Sheffield United',
  'TOT': 'Tottenham',
  'WHU': 'West Ham',
  'WOL': 'Wolves'
};

interface FixtureWithClientState extends OrganizerFixtureWithResult {
  result_entered?: 'home_win' | 'away_win' | 'draw';
  processed?: string | null;
}

export default function OrganizerResultsPage() {
  const router = useRouter();
  const params = useParams();
  const competitionId = params.id as string;

  // Get competition from context
  const { competitions } = useAppData();
  const competition = useMemo(() => {
    return competitions?.find(c => c.id.toString() === competitionId);
  }, [competitions, competitionId]);

  // Results state
  const [roundNumber, setRoundNumber] = useState<number | null>(null);
  const [roundStartTime, setRoundStartTime] = useState<string | null>(null);
  const [fixtures, setFixtures] = useState<FixtureWithClientState[]>([]);
  const [totalFixtures, setTotalFixtures] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processError, setProcessError] = useState('');
  const [processSuccess, setProcessSuccess] = useState('');

  // Check authentication and authorization
  useEffect(() => {
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      router.push('/login');
      return;
    }

    // Check if user is organizer
    if (competition && !competition.is_organiser) {
      router.push(`/game/${competitionId}`);
      return;
    }

    // Check if competition uses manual fixture mode
    if (competition && competition.fixture_service === true) {
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
        setFixtures(response.data.fixtures || []);
        setTotalFixtures(response.data.total_fixtures || 0);
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
    // Optimistic update
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
            f.id === fixture.id ? { ...f, result_entered: undefined } : f
          )
        );
        alert(`Error: ${response.data.message || 'Failed to save result'}`);
      }
    } catch (error) {
      console.error('Error setting result:', error);
      // Revert optimistic update
      setFixtures(prevFixtures =>
        prevFixtures.map(f =>
          f.id === fixture.id ? { ...f, result_entered: undefined } : f
        )
      );
      alert('Network error - could not save result');
    }
  };

  // Handle process results
  const handleProcessResults = async () => {
    setIsProcessing(true);
    setProcessError('');
    setProcessSuccess('');

    try {
      const response = await organizerApi.processResults(parseInt(competitionId));

      if (response.data.return_code === 'SUCCESS') {
        const message = `Results processed! ${response.data.players_eliminated} eliminated, ${response.data.no_pick_penalties} no-pick penalties. ${response.data.active_players_remaining} players remaining.`;
        setProcessSuccess(message);

        // Reload fixtures to show updated processed status
        await loadFixtures();

      } else if (response.data.return_code === 'NO_RESULTS_TO_PROCESS') {
        setProcessError('All fixtures have been processed or have no results set');
      } else {
        setProcessError(response.data.message || 'Failed to process results');
      }
    } catch (error) {
      console.error('Error processing results:', error);
      setProcessError('Network error - could not process results');
    } finally {
      setIsProcessing(false);
    }
  };

  // Calculate progress
  const remainingCount = fixtures.filter(f => !f.result_entered).length;
  const allResultsEntered = fixtures.length > 0 && remainingCount === 0;
  const hasResultsToProcess = fixtures.some(f => f.result_entered && !f.processed);

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

  // Show loading while competition data loads
  if (!competition) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6">
          <Link
            href={`/game/${competitionId}`}
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            Enter Results - {competition.name}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {roundNumber ? `Round ${roundNumber}` : 'Loading...'}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          {/* Success Message */}
          {processSuccess && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700">
              ✓ {processSuccess} - Redirecting...
            </div>
          )}

          {/* Error Message */}
          {(loadError || processError) && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {loadError || processError}
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-8">
              <p className="text-gray-600">Loading fixtures...</p>
            </div>
          )}

          {/* No Rounds State */}
          {!isLoading && loadError && (
            <div className="text-center py-8">
              <button
                onClick={() => router.push(`/game/${competitionId}/organizer-fixtures`)}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
              >
                Add Fixtures
              </button>
            </div>
          )}

          {/* Fixtures List */}
          {!isLoading && !loadError && fixtures.length > 0 && roundNumber && (
            <>
              {/* Round Not Started Warning */}
              {!roundHasStarted && timeUntilStart && (
                <div className="mb-4 p-4 bg-amber-50 border border-amber-300 rounded-md">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">⏰</div>
                    <div>
                      <h3 className="font-semibold text-amber-900">Round hasn&apos;t started yet</h3>
                      <p className="text-sm text-amber-800 mt-1">
                        Results can be entered after the round starts in <span className="font-medium">{timeUntilStart}</span>
                        {roundStartTime && (
                          <span className="ml-2">
                            ({new Date(roundStartTime).toLocaleString('en-GB', {
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
                  </div>
                </div>
              )}

              {/* Progress Header */}
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Round {roundNumber} - Enter Results
                  </h2>
                  <span className="text-sm text-gray-600">
                    {remainingCount} of {totalFixtures} remaining
                  </span>
                </div>
              </div>

              {/* Fixtures */}
              <div className="space-y-2 mb-6">
                {fixtures.map((fixture) => {
                  const homeTeamName = TEAM_NAMES[fixture.home_team_short] || fixture.home_team_short;
                  const awayTeamName = TEAM_NAMES[fixture.away_team_short] || fixture.away_team_short;
                  const resultEntered = fixture.result_entered;
                  const isProcessed = fixture.processed !== null;

                  return (
                    <div
                      key={fixture.id}
                      className={`p-4 rounded-md border-2 transition-colors ${
                        isProcessed
                          ? 'bg-purple-50 border-purple-300'
                          : resultEntered
                          ? 'bg-green-50 border-green-300'
                          : 'bg-white border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="font-medium text-gray-900">
                          {homeTeamName} <span className="text-gray-400 mx-2">vs</span> {awayTeamName}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-2">
                          {new Date(fixture.kickoff_time).toLocaleDateString('en-GB')}
                          {isProcessed && (
                            <span className="text-purple-600 font-medium">Processed</span>
                          )}
                          {resultEntered && !isProcessed && (
                            <CheckCircleIcon className="h-4 w-4 text-green-600" />
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleResultClick(fixture, 'home_win')}
                          disabled={!roundHasStarted || isProcessed || !!resultEntered}
                          className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                            resultEntered === 'home_win'
                              ? isProcessed ? 'bg-purple-600 text-white' : 'bg-green-600 text-white'
                              : !roundHasStarted || resultEntered || isProcessed
                              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                          title={!roundHasStarted ? 'Round has not started yet' : ''}
                        >
                          {homeTeamName} Win
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResultClick(fixture, 'draw')}
                          disabled={!roundHasStarted || isProcessed || !!resultEntered}
                          className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                            resultEntered === 'draw'
                              ? isProcessed ? 'bg-purple-600 text-white' : 'bg-green-600 text-white'
                              : !roundHasStarted || resultEntered || isProcessed
                              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              : 'bg-gray-600 text-white hover:bg-gray-700'
                          }`}
                          title={!roundHasStarted ? 'Round has not started yet' : ''}
                        >
                          Draw
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResultClick(fixture, 'away_win')}
                          disabled={!roundHasStarted || isProcessed || !!resultEntered}
                          className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                            resultEntered === 'away_win'
                              ? isProcessed ? 'bg-purple-600 text-white' : 'bg-green-600 text-white'
                              : !roundHasStarted || resultEntered || isProcessed
                              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                          title={!roundHasStarted ? 'Round has not started yet' : ''}
                        >
                          {awayTeamName} Win
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Process Results Button */}
              <div className="border-t border-gray-200 pt-4">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-600">
                    {allResultsEntered ? (
                      <span className="text-green-600 font-medium">
                        ✓ All results entered - ready to process
                      </span>
                    ) : hasResultsToProcess ? (
                      <span className="text-blue-600 font-medium">
                        {fixtures.filter(f => f.result_entered && !f.processed).length} result(s) ready to process
                      </span>
                    ) : (
                      <span>
                        Enter results to process
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleProcessResults}
                    disabled={!hasResultsToProcess || isProcessing}
                    className="px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    {isProcessing ? 'Processing...' : 'Process Results'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {allResultsEntered
                    ? 'Processing will eliminate players, apply no-pick penalties, and check for competition completion'
                    : 'Partial processing allowed - only fixtures with results will be processed'}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
