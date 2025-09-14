'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeftIcon,
  ClockIcon,
  TrophyIcon
} from '@heroicons/react/24/outline';
import { roundApi, fixtureApi, cacheUtils } from '@/lib/api';
import { useAppData } from '@/contexts/AppDataContext';

interface Round {
  id: number;
  round_number: number;
  lock_time?: string;
  status?: string;
}

interface Fixture {
  id: number;
  home_team: string;
  away_team: string;
  home_team_short: string;
  away_team_short: string;
  kickoff_time: string;
  result?: string | null;
  processed?: string | null;
}

interface RoundInfo {
  round_number: number;
  lock_time: string | null;
  is_locked: boolean;
  all_processed: boolean;
}

export default function ResultsPage() {
  const router = useRouter();
  const params = useParams();
  const competitionId = params.id as string;
  
  // Use AppDataProvider context for competitions data
  const { competitions, loading: contextLoading, forceRefresh } = useAppData();
  
  // Find the specific competition
  const competition = competitions?.find(c => c.id.toString() === competitionId);

  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [roundInfo, setRoundInfo] = useState<RoundInfo | null>(null);
  const [loading, setLoading] = useState(true);
  // Remove local results tracking - work directly with fixture state
  const [confirming, setConfirming] = useState(false); // Track confirmation state
  const [creatingRound, setCreatingRound] = useState(false); // Track round creation state
  
  const hasInitialized = useRef(false);

  useEffect(() => {
    // Prevent double execution from React Strict Mode
    if (hasInitialized.current) {
      console.log('Results page useEffect: Already initialized, skipping');
      return;
    }
    
    console.log('Results page useEffect: Running initialization', { competition: !!competition, contextLoading });
    
    // Check authentication
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      router.push('/login');
      return;
    }

    const initializeData = async () => {
      if (!competition || contextLoading) return;

      // Check if competition is complete
      if (competition.status === 'COMPLETE') {
        // Redirect to standings page for completed competitions
        router.push(`/game/${competitionId}/standings`);
        return;
      }

      try {
        hasInitialized.current = true;
        
        // Get rounds to find current round
        const roundsResponse = await roundApi.getRounds(parseInt(competitionId));
        console.log('🔄 RESULTS PAGE: Loaded round data:', roundsResponse.data);

        if (roundsResponse.data.return_code !== 'SUCCESS') {
          console.error('Failed to get rounds:', roundsResponse.data.message);
          router.push(`/game/${competitionId}`);
          return;
        }
        
        const rounds = roundsResponse.data.rounds || [];
        
        if (rounds.length === 0) {
          router.push(`/game/${competitionId}`);
          return;
        }
        
        const latestRound = rounds[0];
        setCurrentRound(latestRound);
        
        // Load fixtures
        await loadFixtures(latestRound.id);
        
      } catch (error) {
        console.error('Failed to load results data:', error);
        router.push(`/game/${competitionId}`);
      } finally {
        setLoading(false);
      }
    };

    initializeData();
  }, [competitionId, router, competition, contextLoading]);

  const loadFixtures = async (roundId: number) => {
    try {
      const response = await fixtureApi.get(roundId.toString());
      if (response.data.return_code === 'SUCCESS') {
        const sortedFixtures = (response.data.fixtures || []).sort((a, b) => {
          // Sort alphabetically by fixture (home_team vs away_team) - all fixtures together
          const fixtureA = `${a.home_team} vs ${a.away_team}`;
          const fixtureB = `${b.home_team} vs ${b.away_team}`;
          const comparison = fixtureA.localeCompare(fixtureB);
          // Use ID as tiebreaker for stable sort
          return comparison !== 0 ? comparison : a.id - b.id;
        });
        setFixtures(sortedFixtures);
        
        // Store round information for completion detection
        if (response.data.round_info) {
          setRoundInfo(response.data.round_info);
        }
      }
    } catch (error) {
      console.error('Failed to load fixtures:', error);
    }
  };

  const handleSetResult = (fixtureId: number, result: 'home_win' | 'away_win' | 'draw' | 'clear') => {
    const fixture = fixtures.find(f => f.id === fixtureId);
    if (!fixture || isFixtureProcessed(fixture)) return;
    
    let newResult: string | null = null;
    if (result === 'home_win') newResult = fixture.home_team_short;
    else if (result === 'away_win') newResult = fixture.away_team_short;
    else if (result === 'draw') newResult = 'DRAW';
    
    // Update fixtures state directly and maintain alphabetical order
    setFixtures(prev => {
      const updated = prev.map(f => 
        f.id === fixtureId ? { ...f, result: newResult } : f
      );
      // Re-sort to maintain alphabetical order with stable sort
      return updated.sort((a, b) => {
        const fixtureA = `${a.home_team} vs ${a.away_team}`;
        const fixtureB = `${b.home_team} vs ${b.away_team}`;
        const comparison = fixtureA.localeCompare(fixtureB);
        // Use ID as tiebreaker for stable sort
        return comparison !== 0 ? comparison : a.id - b.id;
      });
    });
  };


  const isRoundLocked = () => {
    if (!currentRound?.lock_time) return false;
    return new Date() >= new Date(currentRound.lock_time);
  };


  const handleConfirmResults = async () => {
    if (!currentRound) return;
    
    setConfirming(true);
    
    try {
      // First submit all current results using batch API
      const results = fixtures
        .filter(f => f.result) // Only send fixtures that have results
        .map(f => ({
          fixture_id: f.id,
          result: f.result!
        }));
      
      const response = await fixtureApi.submitResults(parseInt(competitionId), results);

      // Debug: Log the full response to see what we're getting
      console.log('🔍 Submit results response:', response.data);

      if (response.data.return_code === 'SUCCESS' ||
          response.data.return_code === 'NEW_ROUND_CREATED') {

        // Check if competition completed
        const competitionCompleted = response.data.competition_status === 'COMPLETE';
        console.log('🏁 Competition completed?', competitionCompleted, 'Status:', response.data.competition_status);

        // If competition completed, redirect to game dashboard to show completion banner
        if (competitionCompleted) {
          router.push(`/game/${competitionId}`);
          return;
        }

        // Clear caches to ensure fresh data is loaded after results submission
        cacheUtils.invalidateKey(`rounds-${competitionId}`);
        cacheUtils.invalidateKey(`competition-players-${competitionId}`);
        cacheUtils.invalidateKey(`competition-standings-${competitionId}-full`);
        cacheUtils.invalidateKey(`competition-standings-${competitionId}-recent`);

        // Clear user dashboard cache for all competition members
        const userData = localStorage.getItem('user');
        if (userData) {
          const user = JSON.parse(userData);
          cacheUtils.invalidateKey(`user-dashboard-${user.id}`);
        }

        // Update local state FIRST to immediately reflect the changes in UI
        setFixtures(prev => {
          const updated = prev.map(f =>
            f.result ? { ...f, processed: new Date().toISOString() } : f
          );
          // Re-sort to maintain alphabetical order with stable sort
          return updated.sort((a, b) => {
            const fixtureA = `${a.home_team} vs ${a.away_team}`;
            const fixtureB = `${b.home_team} vs ${b.away_team}`;
            const comparison = fixtureA.localeCompare(fixtureB);
            // Use ID as tiebreaker for stable sort
            return comparison !== 0 ? comparison : a.id - b.id;
          });
        });

        // Force refresh app data to get updated dashboard and competition data
        await forceRefresh();
        
      } else {
        console.error('Failed to confirm results:', response.data.message || 'Unknown error');
      }
    } catch (error) {
      console.error('Failed to confirm results:', error);
    } finally {
      setConfirming(false);
    }
  };

  const canConfirmResults = () => {
    // Can only confirm if there's at least one unprocessed result
    return fixtures.length > 0 && fixtures.some(f => f.result && !f.processed);
  };

  const isFixtureProcessed = (fixture: Fixture) => {
    return fixture.processed !== null && fixture.processed !== undefined;
  };

  const isRoundCompleted = () => {
    // Check competition status first - if competition is complete, round is definitely complete
    if (competition?.status === 'COMPLETE') return true;

    // Check local state first - if all fixtures have results and are processed locally,
    // and the round is locked, then the round is completed
    const allFixturesCompleteLocally = fixtures.length > 0 &&
                                      fixtures.every(f => f.result && f.processed) &&
                                      isRoundLocked();
    if (allFixturesCompleteLocally) return true;

    // Fall back to server state
    return roundInfo?.is_locked && roundInfo?.all_processed;
  };

  const handleCreateNextRound = async () => {
    if (creatingRound) return;
    
    setCreatingRound(true);
    
    try {
      // Add a small delay to ensure loading state is visible
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Calculate default lock time (next Friday 6PM)
      const getNextFriday6PM = () => {
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0 = Sunday, 5 = Friday
        const daysUntilFriday = dayOfWeek <= 5 ? (5 - dayOfWeek) : (7 - dayOfWeek + 5);
        
        const nextFriday = new Date(now);
        nextFriday.setDate(now.getDate() + daysUntilFriday);
        nextFriday.setHours(18, 0, 0, 0); // 6:00 PM
        
        return nextFriday.toISOString();
      };

      const lockTime = getNextFriday6PM();
      const response = await roundApi.create(competitionId, lockTime);
      
      if (response.data.return_code === 'SUCCESS') {
        // Clear caches to ensure fresh data is loaded
        cacheUtils.invalidateKey(`rounds-${competitionId}`);
        cacheUtils.invalidateKey(`user-dashboard`); // Refresh competition data with new round info
        
        // Successfully created round - redirect to fixtures page
        router.push(`/game/${competitionId}/fixtures`);
      } else if (response.data.return_code === 'COMPETITION_COMPLETE') {
        // Competition was completed while we were trying to create next round
        alert(response.data.message || 'Competition has been completed');
        router.push(`/game/${competitionId}/standings`);
        return;
      } else {
        console.error('Failed to create round:', response.data.message);
        alert('Failed to create next round: ' + (response.data.message || 'Unknown error'));
        setCreatingRound(false);
      }
    } catch (error) {
      console.error('Error creating next round:', error);
      alert('Failed to create next round');
      setCreatingRound(false);
    }
    // Don't reset creatingRound on success - let the page navigation handle it
  };

  if (loading || contextLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <Link href={`/game/${competitionId}`} className="flex items-center space-x-2 text-slate-600 hover:text-slate-800 transition-colors">
                  <ArrowLeftIcon className="h-5 w-5" />
                  <span className="font-medium">Back</span>
                </Link>
                <div className="h-6 w-px bg-slate-300" />
                <div>
                  <h1 className="text-lg font-semibold text-slate-900">Results</h1>
                </div>
              </div>
            </div>
          </div>
        </header>
        
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
            <div className="flex items-center justify-center">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-50 rounded-full mb-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-600 border-t-transparent"></div>
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">Loading Results</h3>
                <p className="text-slate-500">Please wait while we load the fixture results...</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link href={`/game/${competitionId}`} className="flex items-center space-x-2 text-slate-600 hover:text-slate-800 transition-colors">
                <ArrowLeftIcon className="h-5 w-5" />
                <span className="font-medium">Back</span>
              </Link>
              <div className="h-6 w-px bg-slate-300" />
              <div>
                <h1 className="text-lg font-semibold text-slate-900">
                  {isRoundCompleted() ? 'Round Complete' : 'Results'}
                </h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Competition Name */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">{competition?.name}</h1>
          {currentRound && currentRound.lock_time && (
            <p className="text-slate-600 mt-2">
              <span className="font-medium">Round {currentRound.round_number}</span>{' '}
              - {isRoundLocked() ? 'Locked' : 'Locks'} {new Date(currentRound.lock_time).toLocaleString('en-GB', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
              })}
            </p>
          )}
        </div>

        {/* Round Lock Warning */}
        {!isRoundLocked() && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-center">
              <ClockIcon className="h-5 w-5 text-amber-600 mr-2" />
              <div>
                <p className="text-amber-800 font-medium">Round Not Locked Yet</p>
                <p className="text-amber-600 text-sm">You can set results, but they won&apos;t be processed until the round lock time is reached.</p>
              </div>
            </div>
          </div>
        )}

        {/* Fixtures Results */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {isRoundCompleted() ? 'Round Results' : 'Set Results'}
                </h3>
              </div>
              <div className="flex items-center space-x-2 text-sm text-slate-600">
                <TrophyIcon className="h-4 w-4" />
                <span>
                  {isRoundCompleted() ? 'Final: ' : ''}{fixtures.filter(f => f.result).length} of {fixtures.length} results {isRoundCompleted() ? 'processed' : 'set'}
                </span>
              </div>
            </div>
          </div>

          <div className="p-6">
            {fixtures.length > 0 ? (
              <div className="space-y-4">
                {fixtures.map((fixture, index) => (
                  <div key={`${fixture.id}-${index}`} className="border border-slate-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="font-semibold text-slate-900">{fixture.home_team}</div>
                        <div className="text-slate-400 font-medium">vs</div>
                        <div className="font-semibold text-slate-900">{fixture.away_team}</div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <>
                          <button
                            onClick={() => !isFixtureProcessed(fixture) && handleSetResult(fixture.id, 
                              fixture.result === fixture.home_team_short ? 'clear' : 'home_win'
                            )}
                            disabled={isFixtureProcessed(fixture)}
                            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                              isFixtureProcessed(fixture)
                                ? (fixture.result === fixture.home_team_short
                                    ? 'bg-slate-500 text-white cursor-not-allowed'
                                    : 'bg-slate-200 text-slate-500 cursor-not-allowed')
                                : (fixture.result === fixture.home_team_short
                                    ? 'bg-green-600 text-white hover:bg-green-700'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200')
                            }`}
                          >
                            {fixture.home_team_short} Win
                          </button>
                          <button
                            onClick={() => !isFixtureProcessed(fixture) && handleSetResult(fixture.id, 
                              fixture.result === 'DRAW' ? 'clear' : 'draw'
                            )}
                            disabled={isFixtureProcessed(fixture)}
                            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                              isFixtureProcessed(fixture)
                                ? (fixture.result === 'DRAW'
                                    ? 'bg-slate-500 text-white cursor-not-allowed'
                                    : 'bg-slate-200 text-slate-500 cursor-not-allowed')
                                : (fixture.result === 'DRAW'
                                    ? 'bg-green-600 text-white hover:bg-green-700'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200')
                            }`}
                          >
                            Draw
                          </button>
                          <button
                            onClick={() => !isFixtureProcessed(fixture) && handleSetResult(fixture.id, 
                              fixture.result === fixture.away_team_short ? 'clear' : 'away_win'
                            )}
                            disabled={isFixtureProcessed(fixture)}
                            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                              isFixtureProcessed(fixture)
                                ? (fixture.result === fixture.away_team_short
                                    ? 'bg-slate-500 text-white cursor-not-allowed'
                                    : 'bg-slate-200 text-slate-500 cursor-not-allowed')
                                : (fixture.result === fixture.away_team_short
                                    ? 'bg-green-600 text-white hover:bg-green-700'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200')
                            }`}
                          >
                            {fixture.away_team_short} Win
                          </button>
                        </>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-slate-500">No fixtures available for this round.</p>
              </div>
            )}
          </div>
        </div>

        {/* Action Section - Confirm Results or Create Next Round */}
        <div className="mt-6 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            {isRoundCompleted() ? (
              <>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Round Complete</h3>
                  <p className="text-sm text-slate-500 mt-1">All results processed and players eliminated. Ready to continue!</p>
                </div>
                <button
                  onClick={handleCreateNextRound}
                  disabled={creatingRound}
                  className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 inline-flex items-center justify-center min-w-[160px] ${
                    creatingRound
                      ? 'bg-slate-400 text-slate-600 cursor-not-allowed'
                      : 'bg-slate-600 text-white hover:bg-slate-700'
                  }`}
                >
                  {creatingRound ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-400 border-t-transparent mr-2"></div>
                      Creating...
                    </>
                  ) : (
                    'Create Next Round'
                  )}
                </button>
              </>
            ) : (
              <>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Confirm Results</h3>
                  <p className="text-sm text-slate-500 mt-1">Process player eliminations and advance to the next round</p>
                </div>
                <button
                  onClick={handleConfirmResults}
                  disabled={confirming || !canConfirmResults()}
                  className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 inline-flex items-center justify-center min-w-[160px] ${
                    canConfirmResults() && !confirming
                      ? 'bg-slate-600 text-white hover:bg-slate-700'
                      : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {confirming ? (
                    <>
                      <div className="animate-pulse w-2 h-2 bg-current rounded-full mr-2"></div>
                      Confirming...
                    </>
                  ) : (
                    'Confirm Results'
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </main>

    </div>
  );
}