'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeftIcon,
  TrophyIcon,
  CheckCircleIcon,
  PencilIcon,
  UserGroupIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { competitionApi, roundApi, fixtureApi, playerActionApi, adminApi, userApi } from '@/lib/api';
import { useAppData } from '@/contexts/AppDataContext';

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
  
  // Use AppDataProvider context to avoid redundant getMyCompetitions call
  const { competitions } = useAppData();
  
  // Memoize the specific competition to prevent unnecessary re-renders
  const contextCompetition = useMemo(() => {
    return competitions?.find(c => c.id.toString() === competitionId);
  }, [competitions, competitionId]);

  const [competition, setCompetition] = useState<Competition | null>(null);
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [savingResults, setSavingResults] = useState<Set<number>>(new Set());
  const [editingLockTime, setEditingLockTime] = useState(false);
  const [newLockTime, setNewLockTime] = useState('');
  const [calculatingResults, setCalculatingResults] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [calculationResults, setCalculationResults] = useState<{ message: string; affected_players?: number; players_active?: number; players_out?: number; total_players?: number } | null>(null);
  const [calculatedFixtures, setCalculatedFixtures] = useState<Set<number>>(new Set());
  const [competitionStatus, setCompetitionStatus] = useState<{ current_round: Round | null; fixture_count: number; should_route_to_results: boolean; players_active?: number; players_out?: number; total_players?: number; winner?: { display_name: string } } | null>(null);
  const [hasUnprocessedResults, setHasUnprocessedResults] = useState(false);
  
  // Admin pick management state
  const [players, setPlayers] = useState<Array<{ id: number; display_name: string; email?: string }>>([]);
  const [allowedTeams, setAllowedTeams] = useState<Array<{ team_id: number; team_name: string }>>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [settingPick, setSettingPick] = useState(false);
  const [showAdminPickModal, setShowAdminPickModal] = useState(false);
  const [loadingAllowedTeams, setLoadingAllowedTeams] = useState(false);

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      router.push('/login');
      return;
    }

    loadData();
  }, [competitionId, router]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Check for unprocessed results whenever fixtures or calculated fixtures change
    checkUnprocessedResults();
  }, [fixtures, calculatedFixtures]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = useCallback(async () => {
    try {
      // Get competition from context instead of redundant API call
      if (!contextCompetition) {
        return; // Wait for context to load
      }
      
      if (contextCompetition && (contextCompetition as Competition & { is_organiser: boolean }).is_organiser) {
        setCompetition(contextCompetition);
      } else {
        router.push(`/competition/${competitionId}/dashboard`);
        return;
      }

      // Load current round (latest round)
      const roundsResponse = await roundApi.getRounds(parseInt(competitionId));
      if (roundsResponse.data.return_code === 'SUCCESS') {
        const sortedRounds = (roundsResponse.data.rounds as { round_number: number; id: number }[]).sort((a, b) => b.round_number - a.round_number);
        
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
  }, [competitionId, router, contextCompetition]);

  const loadFixtures = async (roundId: number) => {
    try {
      const response = await fixtureApi.get(roundId.toString());
      if (response.data.return_code === 'SUCCESS') {
        setFixtures((response.data.fixtures as Fixture[]) || []);
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
        setCalculatedFixtures(new Set(response.data.calculated_fixture_ids as number[]));
      }
    } catch (error) {
      console.error('Failed to check calculated fixtures:', error);
    }
  };

  const loadCompetitionStatus = async (competitionId: number) => {
    try {
      const response = await competitionApi.getStatus(competitionId);
      if (response.data.return_code === 'SUCCESS') {
        setCompetitionStatus({
          current_round: response.data.current_round as Round | null,
          fixture_count: response.data.fixture_count as number,
          should_route_to_results: response.data.should_route_to_results as boolean,
          players_active: response.data.players_active as number | undefined,
          players_out: response.data.players_out as number | undefined,
          total_players: response.data.total_players as number | undefined
        });
      }
    } catch (error) {
      console.error('Failed to load competition status:', error);
    }
  };

  const checkUnprocessedResults = useCallback(() => {
    // Check if any fixtures have results but are not processed (calculated)
    const unprocessed = fixtures.some(fixture => 
      fixture.result && !calculatedFixtures.has(fixture.id)
    );
    setHasUnprocessedResults(unprocessed);
  }, [fixtures, calculatedFixtures]);

  const hasAllResults = () => {
    return fixtures.length > 0 && fixtures.every(f => f.result);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    
    if (activePlayers === undefined) return null;
    if (activePlayers === 1) return 'WINNER';
    if (activePlayers === 0) return 'DRAW';
    if (activePlayers > 1) return 'CONTINUE';
    
    return null;
  };

  // Admin pick management functions
  const loadPlayers = async () => {
    if (!competition) return;
    
    try {
      const response = await competitionApi.getPlayers(parseInt(competitionId));
      if (response.data.return_code === 'SUCCESS') {
        setPlayers((response.data.players as Array<{ id: number; display_name: string; email?: string; status?: string }>).filter(p => p.status !== 'OUT'));
      }
    } catch (error) {
      console.error('Failed to load players:', error);
    }
  };

  const loadAllowedTeamsForPlayer = async (playerId: number) => {
    if (!competition) return;
    
    setLoadingAllowedTeams(true);
    try {
      // Use enhanced API that supports getting allowed teams for another player (admin only)
      const response = await userApi.getAllowedTeams(competition.id, playerId);
      if (response.data.return_code === 'SUCCESS') {
        setAllowedTeams((response.data.allowed_teams as Array<{ team_id: number; name: string }>).map((team: { team_id: number; name: string }) => ({
          team_id: team.team_id,
          team_name: team.name
        })));
      }
    } catch (error) {
      console.error('Failed to load allowed teams:', error);
      setAllowedTeams([]);
    } finally {
      setLoadingAllowedTeams(false);
    }
  };

  const handleSetPlayerPick = async () => {
    if (!selectedPlayer || !selectedTeam || !competition) return;
    
    setSettingPick(true);
    try {
      const response = await adminApi.setPlayerPick(competition.id, selectedPlayer, selectedTeam);
      if (response.data.return_code === 'SUCCESS') {
        setShowAdminPickModal(false);
        setSelectedPlayer(null);
        setSelectedTeam('');
        setAllowedTeams([]);
      } else {
        alert(`Failed to set pick: ${response.data.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to set pick:', error);
      alert('Failed to set pick. Please try again.');
    } finally {
      setSettingPick(false);
    }
  };

  const openAdminPickModal = async () => {
    await loadPlayers();
    setSelectedPlayer(null);
    setSelectedTeam('');
    setAllowedTeams([]);
    setShowAdminPickModal(true);
  };

  const handlePlayerSelection = async (playerId: number | null) => {
    setSelectedPlayer(playerId);
    setSelectedTeam(''); // Reset team selection when player changes
    
    if (playerId && !isNaN(playerId)) {
      await loadAllowedTeamsForPlayer(playerId);
    } else {
      setAllowedTeams([]);
    }
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
          ? { ...f, result: undefined }
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
    const baseClass = "px-3 py-2 rounded-lg font-medium text-sm transition-all duration-200 border ";
    
    // If fixture has calculated picks, show as locked with professional theme
    if (calculated) {
      const isSelected = 
        (resultType === 'home_win' && fixture.result === fixture.home_team_short) ||
        (resultType === 'away_win' && fixture.result === fixture.away_team_short) ||
        (resultType === 'draw' && fixture.result === 'DRAW');
      
      if (isSelected) {
        return baseClass + "bg-slate-600 text-white border-slate-600 cursor-not-allowed shadow-sm";
      } else {
        return baseClass + "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed";
      }
    }
    
    // If round is not locked, show disabled state
    if (!locked) {
      return baseClass + "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed";
    }
    
    // Only show as selected if there's actually a result set
    if (!fixture.result || fixture.result === null || fixture.result === undefined) {
      return baseClass + "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300 hover:shadow-sm";
    }
    
    const isSelected = 
      (resultType === 'home_win' && fixture.result === fixture.home_team_short) ||
      (resultType === 'away_win' && fixture.result === fixture.away_team_short) ||
      (resultType === 'draw' && fixture.result === 'DRAW');
    
    if (isSelected) {
      return baseClass + "bg-blue-600 text-white border-blue-600 shadow-sm";
    }
    
    return baseClass + "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300 hover:shadow-sm";
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
            ...(response.data.results as { message: string; affected_players?: number }),
            players_active: statusResponse.data.players_active as number,
            players_out: statusResponse.data.players_out as number,
            total_players: statusResponse.data.total_players as number
          });
          // Refresh calculated fixtures and status
          setCompetitionStatus({
            current_round: statusResponse.data.current_round as Round | null,
            fixture_count: statusResponse.data.fixture_count as number,
            should_route_to_results: statusResponse.data.should_route_to_results as boolean,
            players_active: statusResponse.data.players_active as number | undefined,
            players_out: statusResponse.data.players_out as number | undefined,
            total_players: statusResponse.data.total_players as number | undefined
          });
          if (currentRound) {
            checkCalculatedFixtures(currentRound.id);
          }
        } else {
          setCalculationResults(response.data.results as { message: string; affected_players?: number });
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
                  href={`/competition/${competitionId}/dashboard`} 
                  className="flex items-center text-gray-600 hover:text-gray-900 mr-4"
                >
                  <ArrowLeftIcon className="h-5 w-5 mr-2" />
                  Back to Dashboard
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
          <Link href={`/competition/${competitionId}/dashboard`} className="text-green-600 hover:text-green-700">
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
                href={`/competition/${competitionId}/dashboard`} 
                className="flex items-center text-gray-600 hover:text-gray-900 mr-4"
              >
                <ArrowLeftIcon className="h-5 w-5 mr-2" />
                Back to Dashboard
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
            
            {/* Competition Status and Actions - Material 3 Style */}
            {competitionStatus && (
              <div className="flex flex-col items-end space-y-4">
                <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Competition Status</div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                      <span className="text-slate-900 font-semibold">{competitionStatus.players_active}</span>
                      <span className="text-slate-600">In</span>
                    </div>
                    <div className="w-px h-4 bg-slate-300"></div>
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <span className="text-slate-900 font-semibold">{competitionStatus.players_out}</span>
                      <span className="text-slate-600">Out</span>
                    </div>
                    <div className="w-px h-4 bg-slate-300"></div>
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                      <span className="text-slate-900 font-semibold">{competitionStatus.total_players}</span>
                      <span className="text-slate-600">Total</span>
                    </div>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-3">
                  {/* Confirm Results Button - Always visible to prevent layout shift */}
                  <button
                    onClick={handleCalculateResults}
                    disabled={calculatingResults || !(isRoundLocked() && hasUnprocessedResults)}
                    className={`inline-flex items-center px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 border ${
                      isRoundLocked() && hasUnprocessedResults && !calculatingResults
                        ? 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md'
                        : 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                    }`}
                  >
                    {calculatingResults ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-400 border-t-transparent mr-2"></div>
                        Confirming...
                      </>
                    ) : (
                      <>
                        <CheckCircleIcon className="h-4 w-4 mr-2" />
                        Confirm Results
                      </>
                    )}
                  </button>

                  {/* Set Player Pick Button - Show during active picking phase */}
                  {currentRound && currentRound.lock_time && new Date() < new Date(currentRound.lock_time) && (
                    <button
                      onClick={openAdminPickModal}
                      className="inline-flex items-center px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 hover:text-slate-900 transition-all duration-200 border border-slate-200 shadow-sm hover:shadow-md"
                    >
                      <UserGroupIcon className="h-4 w-4 mr-2" />
                      Set Player Pick
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
                        className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-all duration-200 font-medium shadow-sm hover:shadow-md"
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

      {/* Admin Pick Modal */}
      {showAdminPickModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Set Player Pick</h3>
              <button
                onClick={() => setShowAdminPickModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Player Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Player
                </label>
                <select
                  value={selectedPlayer || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    const playerId = value ? parseInt(value) : null;
                    handlePlayerSelection(playerId);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Choose a player...</option>
                  {players.map((player, index) => (
                    <option key={`player-${player.id}-${index}`} value={player.id}>
                      {player.display_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Team Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Team {selectedPlayer && loadingAllowedTeams && '(Loading...)'}
                </label>
                <select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={!selectedPlayer || loadingAllowedTeams}
                  required
                >
                  <option value="">
                    {!selectedPlayer 
                      ? 'Select a player first...' 
                      : loadingAllowedTeams 
                        ? 'Loading teams...' 
                        : 'Choose a team...'
                    }
                  </option>
                  {allowedTeams.map((team, index) => (
                    <option key={`allowed-team-${team.team_id}-${index}`} value={team.team_name}>
                      {team.team_name}
                    </option>
                  ))}
                </select>
                {selectedPlayer && allowedTeams.length === 0 && !loadingAllowedTeams && (
                  <p className="text-sm text-red-600 mt-1">
                    No teams available for this player
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAdminPickModal(false)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSetPlayerPick}
                disabled={!selectedPlayer || !selectedTeam || settingPick}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {settingPick ? 'Setting Pick...' : 'Set Pick'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}