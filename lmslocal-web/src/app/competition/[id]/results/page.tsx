'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeftIcon,
  TrophyIcon,
  CheckCircleIcon,
  PencilIcon,
} from '@heroicons/react/24/outline';
import { competitionApi, roundApi, fixtureApi, playerActionApi } from '@/lib/api';

interface Competition {
  id: number;
  name: string;
  status: string;
}

interface Round {
  id: number;
  round_number: number;
  lock_time?: string;
}

interface Fixture {
  id: number;
  home_team: string;
  away_team: string;
  home_team_short: string;
  away_team_short: string;
  kickoff_time: string;
  result?: string;
}

export default function CompetitionResultsPage() {
  const router = useRouter();
  const params = useParams();
  const competitionId = params.id as string;

  const [competition, setCompetition] = useState<Competition | null>(null);
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingResults, setSavingResults] = useState<Set<number>>(new Set());
  const [editingLockTime, setEditingLockTime] = useState(false);
  const [newLockTime, setNewLockTime] = useState('');
  const [calculatingResults, setCalculatingResults] = useState(false);
  const [calculationResults, setCalculationResults] = useState<any>(null);
  const [calculatedFixtures, setCalculatedFixtures] = useState<Set<number>>(new Set());
  const [competitionStatus, setCompetitionStatus] = useState<any>(null);
  const [hasUnprocessedResults, setHasUnprocessedResults] = useState(false);

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      router.push('/login');
      return;
    }

    loadData();
  }, [competitionId, router]);

  useEffect(() => {
    // Check for unprocessed results whenever fixtures or calculated fixtures change
    checkUnprocessedResults();
  }, [fixtures, calculatedFixtures]);

  const loadData = async () => {
    try {
      // Load competition details
      const competitions = await competitionApi.getMyCompetitions();
      if (competitions.data.return_code === 'SUCCESS') {
        const comp = competitions.data.competitions.find(c => c.id.toString() === competitionId);
        if (comp && comp.is_organiser) {
          setCompetition(comp);
        } else {
          router.push('/dashboard');
          return;
        }
      }

      // Load current round (latest round)
      const roundsResponse = await roundApi.getRounds(parseInt(competitionId));
      if (roundsResponse.data.return_code === 'SUCCESS') {
        const sortedRounds = roundsResponse.data.rounds.sort((a, b) => b.round_number - a.round_number);
        
        if (sortedRounds.length > 0) {
          const currentRound = sortedRounds[0];
          setCurrentRound(currentRound);
          loadFixtures(currentRound.id);
          checkCalculatedFixtures(currentRound.id);
          loadCompetitionStatus(parseInt(competitionId));
        }
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFixtures = async (roundId: number) => {
    try {
      const response = await fixtureApi.get(roundId.toString());
      if (response.data.return_code === 'SUCCESS') {
        setFixtures(response.data.fixtures || []);
      }
    } catch (error) {
      console.error('Failed to load fixtures:', error);
      setFixtures([]);
    }
  };

  const checkCalculatedFixtures = async (roundId: number) => {
    try {
      const response = await fixtureApi.getCalculated(roundId);
      if (response.data.return_code === 'SUCCESS') {
        setCalculatedFixtures(new Set(response.data.calculated_fixture_ids));
      }
    } catch (error) {
      console.error('Failed to check calculated fixtures:', error);
    }
  };

  const loadCompetitionStatus = async (competitionId: number) => {
    try {
      const response = await competitionApi.getStatus(competitionId);
      if (response.data.return_code === 'SUCCESS') {
        setCompetitionStatus(response.data);
      }
    } catch (error) {
      console.error('Failed to load competition status:', error);
    }
  };

  const checkUnprocessedResults = () => {
    // Check if any fixtures have results but are not processed (calculated)
    const unprocessed = fixtures.some(fixture => 
      fixture.result && !calculatedFixtures.has(fixture.id)
    );
    setHasUnprocessedResults(unprocessed);
  };

  const hasAllResults = () => {
    return fixtures.length > 0 && fixtures.every(f => f.result);
  };

  const needsResults = () => {
    // Round is locked but we don't have all results yet
    return isRoundLocked() && !hasAllResults();
  };

  const isRoundComplete = () => {
    // Round is locked, all results entered, and no unprocessed results
    return isRoundLocked() && hasAllResults() && !hasUnprocessedResults;
  };

  const getCompetitionState = () => {
    if (!competitionStatus) return null;
    
    const activePlayers = competitionStatus.players_active;
    
    if (activePlayers === 1) return 'WINNER';
    if (activePlayers === 0) return 'DRAW';
    if (activePlayers > 1) return 'CONTINUE';
    
    return null;
  };

  const handleCreateNextRound = async () => {
    if (!competition || !currentRound) return;
    
    try {
      // Create next round with round number + 1, defaulting to next Friday 6 PM
      const getNextFriday6PM = () => {
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0 = Sunday, 5 = Friday
        const daysUntilFriday = dayOfWeek <= 5 ? (5 - dayOfWeek) : (7 - dayOfWeek + 5);
        
        const nextFriday = new Date(now);
        nextFriday.setDate(now.getDate() + daysUntilFriday);
        nextFriday.setHours(18, 0, 0, 0); // 6:00 PM
        
        return nextFriday.toISOString();
      };
      
      const response = await roundApi.create(
        competition.id.toString(), 
        getNextFriday6PM()
      );
      
      if (response.data.return_code === 'SUCCESS') {
        // Redirect to manage page where they can immediately add fixtures
        router.push(`/competition/${competitionId}/manage`);
      } else {
        alert('Failed to create next round: ' + (response.data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to create next round:', error);
      alert('Failed to create next round');
    }
  };


  const isRoundLocked = () => {
    if (!currentRound?.lock_time) return false;
    const now = new Date();
    const lockTime = new Date(currentRound.lock_time);
    return now >= lockTime;
  };

  const setFixtureResult = async (fixture: Fixture, result: 'home_win' | 'away_win' | 'draw') => {
    // Check if round is locked before allowing result setting
    if (!isRoundLocked()) {
      alert(`Cannot set fixture results before round lock time. Round locks at ${new Date(currentRound?.lock_time || '').toLocaleString(undefined, {
        weekday: 'long',
        year: 'numeric', 
        month: 'long', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      })}`);
      return;
    }

    // Don't allow changes to fixtures that have been calculated/confirmed
    if (calculatedFixtures.has(fixture.id)) {
      return;
    }

    // Check if this result is already selected - if so, clear it (UI only)
    const isAlreadySelected = 
      (result === 'home_win' && fixture.result === fixture.home_team_short) ||
      (result === 'away_win' && fixture.result === fixture.away_team_short) ||
      (result === 'draw' && fixture.result === 'DRAW');

    if (isAlreadySelected) {
      // Clear the result in UI only - no API call
      setFixtures(prev => prev.map(f => 
        f.id === fixture.id 
          ? { ...f, result: null }
          : f
      ));
      return;
    }

    // Set the result in UI only - no API call until "Confirm Results" is pressed
    setFixtures(prev => prev.map(f => 
      f.id === fixture.id 
        ? { ...f, result: result === 'home_win' ? fixture.home_team_short : result === 'away_win' ? fixture.away_team_short : 'DRAW' }
        : f
    ));
  };

  const getResultButtonClass = (fixture: Fixture, resultType: 'home_win' | 'away_win' | 'draw') => {
    const locked = isRoundLocked();
    const calculated = calculatedFixtures.has(fixture.id);
    const baseClass = "px-3 py-2 rounded-md font-medium text-sm transition-colors ";
    
    // If fixture has calculated picks, show as locked with light blue theme
    if (calculated) {
      const isSelected = 
        (resultType === 'home_win' && fixture.result === fixture.home_team_short) ||
        (resultType === 'away_win' && fixture.result === fixture.away_team_short) ||
        (resultType === 'draw' && fixture.result === 'DRAW');
      
      if (isSelected) {
        return baseClass + "bg-teal-500 text-white cursor-not-allowed";
      } else {
        return baseClass + "bg-teal-100 text-teal-400 cursor-not-allowed";
      }
    }
    
    // If round is not locked, show disabled state
    if (!locked) {
      return baseClass + "bg-gray-200 text-gray-400 cursor-not-allowed";
    }
    
    // Only show as selected if there's actually a result set
    if (!fixture.result || fixture.result === null || fixture.result === undefined) {
      return baseClass + "bg-gray-100 text-gray-700 hover:bg-gray-200";
    }
    
    const isSelected = 
      (resultType === 'home_win' && fixture.result === fixture.home_team_short) ||
      (resultType === 'away_win' && fixture.result === fixture.away_team_short) ||
      (resultType === 'draw' && fixture.result === 'DRAW');
    
    if (isSelected) {
      return baseClass + "bg-green-600 text-white";
    }
    
    return baseClass + "bg-gray-100 text-gray-700 hover:bg-gray-200";
  };

  const handleEditLockTime = () => {
    if (currentRound?.lock_time) {
      // Format the datetime for the input field (YYYY-MM-DDTHH:mm)
      const lockTime = new Date(currentRound.lock_time);
      const formatted = lockTime.toISOString().slice(0, 16);
      setNewLockTime(formatted);
    }
    setEditingLockTime(true);
  };

  const handleSaveLockTime = async () => {
    if (!currentRound || !newLockTime) return;
    
    try {
      const response = await roundApi.update(currentRound.id.toString(), newLockTime);
      if (response.data.return_code === 'SUCCESS') {
        // Update local state
        setCurrentRound(prev => prev ? { ...prev, lock_time: newLockTime } : null);
        setEditingLockTime(false);
        // Force refresh fixtures to reflect any state changes
        if (currentRound) {
          loadFixtures(currentRound.id);
        }
      } else {
        alert('Failed to update lock time: ' + (response.data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to update lock time:', error);
      alert('Failed to update lock time');
    }
  };

  const handleCancelLockTime = () => {
    setEditingLockTime(false);
    setNewLockTime('');
  };

  const handleCalculateResults = async () => {
    if (!currentRound || !competition) return;
    
    setCalculatingResults(true);
    setCalculationResults(null);
    
    try {
      // First, save all UI fixture results to the database
      console.log('Saving fixture results to database...');
      const savePromises = fixtures
        .filter(fixture => fixture.result !== null && fixture.result !== undefined)
        .map(fixture => {
          const result = fixture.result === 'DRAW' ? 'draw' : 
                        fixture.result === fixture.home_team_short ? 'home_win' : 'away_win';
          return fixtureApi.setResult(fixture.id, result);
        });

      const saveResults = await Promise.all(savePromises);
      
      // Check if all saves were successful
      const failedSaves = saveResults.filter(result => result.data.return_code !== 'SUCCESS');
      if (failedSaves.length > 0) {
        alert(`Failed to save ${failedSaves.length} fixture result(s). Please try again.`);
        setCalculatingResults(false);
        return;
      }

      console.log('All fixture results saved. Now calculating...');
      
      // Now calculate results with the saved fixture data
      const response = await playerActionApi.calculateResults(currentRound.id);
      
      if (response.data.return_code === 'SUCCESS') {
        // After calculation, get the simple player counts
        const statusResponse = await competitionApi.getStatus(competition.id);
        
        if (statusResponse.data.return_code === 'SUCCESS') {
          setCalculationResults({
            ...response.data.results,
            players_active: statusResponse.data.players_active,
            players_out: statusResponse.data.players_out,
            total_players: statusResponse.data.total_players
          });
          // Refresh calculated fixtures and status
          setCompetitionStatus(statusResponse.data);
          if (currentRound) {
            checkCalculatedFixtures(currentRound.id);
          }
        } else {
          setCalculationResults(response.data.results);
        }
      } else {
        alert('Failed to calculate results: ' + (response.data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to calculate results:', error);
      alert('Failed to calculate results');
    } finally {
      setCalculatingResults(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header - Show immediately */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center">
                <Link 
                  href="/dashboard" 
                  className="flex items-center text-gray-600 hover:text-gray-900 mr-4"
                >
                  <ArrowLeftIcon className="h-5 w-5 mr-2" />
                  Dashboard
                </Link>
                <TrophyIcon className="h-8 w-8 text-green-600" />
                <span className="ml-2 text-xl font-bold text-gray-900">Results Entry</span>
              </div>
            </div>
          </div>
        </header>

        {/* Loading content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="animate-pulse space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <div className="h-5 bg-gray-200 rounded w-1/3"></div>
                    <div className="flex gap-2">
                      <div className="h-8 bg-gray-200 rounded w-20"></div>
                      <div className="h-8 bg-gray-200 rounded w-16"></div>
                      <div className="h-8 bg-gray-200 rounded w-20"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!competition) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Competition Not Found</h1>
          <Link href="/dashboard" className="text-green-600 hover:text-green-700">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Link 
                href="/dashboard" 
                className="flex items-center text-gray-600 hover:text-gray-900 mr-4"
              >
                <ArrowLeftIcon className="h-5 w-5 mr-2" />
                Dashboard
              </Link>
              <TrophyIcon className="h-8 w-8 text-green-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">Results Entry</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Competition and Round Info */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-gray-900">{competition.name} - Results</h1>
            
            {/* Competition Status and Actions */}
            {competitionStatus && (
              <div className="text-right">
                <div className="text-sm text-gray-500">Competition Status</div>
                <div className="flex items-center gap-4 text-sm mb-2">
                  <span className="text-green-600">{competitionStatus.players_active} In</span>
                  <span className="text-gray-400">•</span>
                  <span className="text-red-600">{competitionStatus.players_out} Out</span>
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-600">{competitionStatus.total_players} Total</span>
                </div>
                
{/* Action Buttons */}
                <div className="flex gap-2">
                  {/* Confirm Results Button */}
                  {isRoundLocked() && hasUnprocessedResults && (
                    <button
                      onClick={handleCalculateResults}
                      disabled={calculatingResults}
                      className={`px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors flex items-center gap-2 text-sm ${
                        calculatingResults ? 'cursor-not-allowed' : ''
                      }`}
                    >
                      {calculatingResults ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Confirming...
                        </>
                      ) : (
                        <>
                          <CheckCircleIcon className="h-4 w-4" />
                          Confirm Results
                        </>
                      )}
                    </button>
                  )}

                  {/* Create Next Round Button */}
                  {isRoundComplete() && getCompetitionState() === 'CONTINUE' && (
                    <button
                      onClick={handleCreateNextRound}
                      className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-medium shadow-sm hover:from-green-600 hover:to-green-700 transition-all duration-200 flex items-center gap-2 text-sm"
                    >
                      <span>Create Next Round</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          {currentRound && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="text-lg text-gray-600">
                  <span className="font-medium">Round {currentRound.round_number}</span>
                </div>
                
                {/* Lock Time Display/Edit */}
                <div className="flex items-center gap-2">
                  {!editingLockTime ? (
                    <>
                      {currentRound.lock_time && (
                        <span className="text-lg text-gray-600">
                          - {new Date(currentRound.lock_time).toLocaleString(undefined, { 
                            weekday: 'long',
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric', 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </span>
                      )}
                      {calculatedFixtures.size === 0 && (
                        <button
                          onClick={handleEditLockTime}
                          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                          title="Edit lock time"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="datetime-local"
                        value={newLockTime}
                        onChange={(e) => setNewLockTime(e.target.value)}
                        className="px-3 py-1 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <button
                        onClick={handleSaveLockTime}
                        className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelLockTime}
                        className="px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-400 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
              

              {/* Competition State - show when round complete */}
              {isRoundComplete() && getCompetitionState() && (
                <div className="flex items-center gap-4">
                  {getCompetitionState() === 'WINNER' && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex items-center">
                        <div className="text-2xl">🏆</div>
                        <div className="ml-3">
                          <h3 className="text-lg font-bold text-yellow-800">
                            {competitionStatus?.winner 
                              ? `${competitionStatus.winner.display_name} is the Winner!`
                              : 'We have a Winner!'
                            }
                          </h3>
                          <p className="text-sm text-yellow-700">
                            {competitionStatus?.winner 
                              ? 'Congratulations - competition complete!'
                              : 'Only 1 player remaining - competition complete'
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {getCompetitionState() === 'DRAW' && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center">
                        <div className="text-2xl">🤝</div>
                        <div className="ml-3">
                          <h3 className="text-lg font-bold text-gray-800">Competition Draw!</h3>
                          <p className="text-sm text-gray-700">All players eliminated - no winner</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {getCompetitionState() === 'CONTINUE' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center">
                        <div className="text-2xl">⚡</div>
                        <div className="ml-3">
                          <h3 className="text-lg font-bold text-blue-800">Round Complete!</h3>
                          <p className="text-sm text-blue-700">{competitionStatus?.players_active} players remaining - ready for next round</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </div>

        {/* Fixtures and Results */}
        {currentRound && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            
            {fixtures.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No fixtures found for this round.</p>
            ) : (
              <div className="space-y-4">
                {fixtures
                  .sort((a, b) => `${a.home_team} v ${a.away_team}`.localeCompare(`${b.home_team} v ${b.away_team}`))
                  .map((fixture) => (
                  <div key={fixture.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      {/* Fixture Info with Checkmark */}
                      <div className="flex-1 flex items-center gap-3">
                        <div className="text-lg font-medium text-gray-900">
                          {fixture.home_team} vs {fixture.away_team}
                        </div>
                        {fixture.result && fixture.result !== null && fixture.result !== undefined && !savingResults.has(fixture.id) && (
                          <CheckCircleIcon className="h-5 w-5 text-green-600 flex-shrink-0" />
                        )}
                        {savingResults.has(fixture.id) && (
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-600 flex-shrink-0"></div>
                        )}
                      </div>
                      
                      {/* Result Buttons */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => setFixtureResult(fixture, 'home_win')}
                          disabled={savingResults.has(fixture.id) || !isRoundLocked() || calculatedFixtures.has(fixture.id)}
                          className={getResultButtonClass(fixture, 'home_win')}
                        >
                          {fixture.home_team_short} Win
                        </button>
                        <button
                          onClick={() => setFixtureResult(fixture, 'draw')}
                          disabled={savingResults.has(fixture.id) || !isRoundLocked() || calculatedFixtures.has(fixture.id)}
                          className={getResultButtonClass(fixture, 'draw')}
                        >
                          Draw
                        </button>
                        <button
                          onClick={() => setFixtureResult(fixture, 'away_win')}
                          disabled={savingResults.has(fixture.id) || !isRoundLocked() || calculatedFixtures.has(fixture.id)}
                          className={getResultButtonClass(fixture, 'away_win')}
                        >
                          {fixture.away_team_short} Win
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}