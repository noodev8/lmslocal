'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeftIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';
import { roundApi, fixtureApi, playerActionApi, userApi } from '@/lib/api';
import { withCache, apiCache } from '@/lib/cache';
import { useAppData } from '@/contexts/AppDataContext';

interface Fixture {
  id: number;
  home_team: string;
  away_team: string;
  home_team_short: string;
  away_team_short: string;
  kickoff_time: string;
  result?: string | null;
}

export default function PickPage() {
  const router = useRouter();
  const params = useParams();
  const competitionId = params.id as string;
  
  // Use AppDataProvider context for competitions data
  const { competitions, loading: contextLoading, refreshData } = useAppData();
  
  // Find the specific competition
  const competition = competitions?.find(c => c.id.toString() === competitionId);

  interface Round {
    id: number;
    round_number: number;
    fixture_count: number;
    lock_time?: string;
  }
  const [rounds, setRounds] = useState<Round[]>([]);
  const [currentRoundId, setCurrentRoundId] = useState<number | null>(null);
  const [viewingRoundId, setViewingRoundId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'current' | 'previous'>('current');
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<{teamShort: string, fixtureId: number, position: 'home' | 'away'} | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [allowedTeams, setAllowedTeams] = useState<string[]>([]);
  const [currentPick, setCurrentPick] = useState<string | null>(null);
  const [isRoundLocked, setIsRoundLocked] = useState<boolean>(false);
  const [teamPickCounts, setTeamPickCounts] = useState<Record<string, number>>({});
  const [pickDataLoaded, setPickDataLoaded] = useState<boolean>(false);
  
  const hasInitialized = useRef(false);

  const loadFixtures = async (roundId: number) => {
    try {
      const response = await fixtureApi.get(roundId.toString());
      if (response.data.return_code === 'SUCCESS') {
        setFixtures(response.data.fixtures || []);
      }
    } catch (error) {
      console.error('Failed to load fixtures:', error);
    }
  };

  const loadCurrentPick = useCallback(async (roundId: number) => {
    try {
      const response = await withCache(
        `current-pick-${roundId}-${competitionId}`,
        60 * 60 * 1000, // 1 hour cache - rounds don't change often
        () => playerActionApi.getCurrentPick(roundId)
      );
      if (response.data.return_code === 'SUCCESS') {
        const pickTeam = (response.data.pick as {team?: string})?.team || null;
        setCurrentPick(pickTeam);
      }
    } catch (error) {
      console.error('Failed to load current pick:', error);
      setCurrentPick(null);
    }
  }, [competitionId]);

  // Combined function to load all data for a specific round
  const loadRoundData = useCallback(async (roundId: number, isCurrentRound = true, freshRounds?: Round[]) => {
    setPickDataLoaded(false);
    
    try {
      await Promise.all([
        loadFixtures(roundId),
        // Load allowed teams only for current round, but always load current pick
        isCurrentRound ? loadAllowedTeams(parseInt(competitionId)) : Promise.resolve(),
        loadCurrentPick(roundId),
        loadTeamPickCounts(roundId)
      ]);

      // When viewing previous rounds, clear selections and allowed teams but keep the pick
      if (!isCurrentRound) {
        setSelectedTeam(null);
        setAllowedTeams([]);
        setIsRoundLocked(true); // Previous rounds are always "locked" for display
      } else {
        // For current round, use fresh rounds data when available, otherwise use state
        const roundsToUse = freshRounds || rounds;
        const currentRound = roundsToUse.find(r => r.id === roundId);
        if (currentRound) {
          const now = new Date();
          const lockTime = new Date(currentRound.lock_time || '');
          const locked = !!(currentRound.lock_time && now >= lockTime);
          setIsRoundLocked(locked);
        } else {
          setIsRoundLocked(false);
        }
      }

      setPickDataLoaded(true);
    } catch (error) {
      console.error('Failed to load round data:', error);
    }
  }, [competitionId, loadCurrentPick, rounds]);

  useEffect(() => {
    // Prevent double execution from React Strict Mode
    if (hasInitialized.current) {
      return;
    }
    
    // Check authentication
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      router.push('/login');
      return;
    }

    const initializeData = async () => {
      if (!competition || contextLoading) return;
      
      try {
        hasInitialized.current = true;
        
        // Get rounds to find current round (use cache for better performance)
        const roundsResponse = await roundApi.getRounds(parseInt(competitionId));
        
        if (roundsResponse.data.return_code !== 'SUCCESS') {
          console.error('Failed to get rounds:', roundsResponse.data.message);
          router.push(`/game/${competitionId}/waiting`);
          return;
        }
        
        const roundsData = roundsResponse.data.rounds || [];
        
        if (roundsData.length === 0) {
          router.push(`/game/${competitionId}/waiting`);
          return;
        }
        
        setRounds(roundsData);
        const latestRound = roundsData[0];
        
        // Check if round has fixtures and is not locked yet
        if (latestRound.fixture_count === 0) {
          router.push(`/game/${competitionId}/waiting`);
          return;
        }
        
        // Check if round is locked
        const now = new Date();
        const lockTime = new Date(latestRound.lock_time || '');
        const locked = !!(latestRound.lock_time && now >= lockTime);
        
        setCurrentRoundId(latestRound.id);
        setViewingRoundId(latestRound.id); // Initially view the current round
        setIsRoundLocked(locked);

        // Load data for the current round (initially) - pass fresh rounds data
        await loadRoundData(latestRound.id, true, roundsData);
        
      } catch (error) {
        console.error('Failed to load pick data:', error);
        router.push(`/game/${competitionId}`);
      } finally {
        setLoading(false);
      }
    };

    initializeData();
  }, [competitionId, router, competition, contextLoading, loadRoundData]);

  const loadAllowedTeams = async (competitionId: number) => {
    try {
      const response = await userApi.getAllowedTeams(competitionId);
      
      if (response.data.return_code === 'SUCCESS') {
        const teamShorts = (response.data.allowed_teams || []).map((team: { short_name: string }) => team.short_name);
        setAllowedTeams(teamShorts);
      } else {
        console.error('API returned error:', response.data.return_code, (response.data as { message?: string }).message);
      }
    } catch (error) {
      console.error('💥 Failed to load allowed teams:', error);
    }
  };


  const loadTeamPickCounts = async (roundId: number) => {
    try {
      const response = await withCache(
        `pick-counts-${roundId}`,
        60 * 60 * 1000, // 1 hour cache - pick counts change infrequently
        () => fixtureApi.getPickCounts(roundId)
      );
      if (response.data.return_code === 'SUCCESS') {
        setTeamPickCounts(response.data.pick_counts || {});
      }
    } catch (error) {
      console.error('Failed to load team pick counts:', error);
    }
  };

  const getFullTeamName = (shortName: string) => {
    const fixture = fixtures.find(f => 
      f.home_team_short === shortName || f.away_team_short === shortName
    );
    if (fixture) {
      return fixture.home_team_short === shortName ? fixture.home_team : fixture.away_team;
    }
    return shortName;
  };

  const handleTeamSelect = (teamShort: string, fixtureId: number, position: 'home' | 'away') => {
    // Can't select if round is locked
    if (isRoundLocked) return;
    
    // User must remove current pick first
    if (currentPick) {
      return;
    }
    
    // No current pick, allow selection if team is in allowed list  
    if (allowedTeams.includes(teamShort)) {
      setSelectedTeam({ teamShort, fixtureId, position });
    }
  };

  const handleUnselectPick = async () => {
    if (!currentRoundId || submitting || isRoundLocked) return;

    setSubmitting(true);
    try {
      const response = await playerActionApi.unselectPick(currentRoundId);
      
      if (response.data.return_code === 'SUCCESS') {
        // Clear pick-related caches and refresh data
        if (competition && currentRoundId) {
          // Clear pick-specific caches
          apiCache.delete(`current-pick-${currentRoundId}-${competitionId}`);
          apiCache.delete(`pick-counts-${currentRoundId}`);

          // Clear user dashboard cache to update pick counts on main game page
          const userData = localStorage.getItem('user');
          if (userData) {
            const user = JSON.parse(userData);
            apiCache.delete(`user-dashboard-${user.id}`);
          }

          await loadAllowedTeams(parseInt(competitionId));
          await loadCurrentPick(currentRoundId);
          await loadTeamPickCounts(currentRoundId); // Refresh pick counts to show updated numbers

          // Force dashboard data refresh for immediate stats update
          refreshData();
        }
        setSelectedTeam(null);
      } else {
        alert('Failed to remove pick: ' + (response.data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to remove pick:', error);
      alert('Failed to remove pick');
    } finally {
      setSubmitting(false);
    }
  };

  const submitPick = async () => {
    if (!selectedTeam || submitting || isRoundLocked) return;

    setSubmitting(true);
    try {
      const response = await playerActionApi.setPick(selectedTeam.fixtureId, selectedTeam.position);
      
      if (response.data.return_code === 'SUCCESS') {
        // Clear pick-related caches and refresh data
        if (competition && currentRoundId) {
          // Clear pick-specific caches
          apiCache.delete(`current-pick-${currentRoundId}-${competitionId}`);
          apiCache.delete(`pick-counts-${currentRoundId}`);

          // Clear user dashboard cache to update pick counts on main game page
          const userData = localStorage.getItem('user');
          if (userData) {
            const user = JSON.parse(userData);
            apiCache.delete(`user-dashboard-${user.id}`);
          }

          await loadAllowedTeams(parseInt(competitionId));
          await loadCurrentPick(currentRoundId);
          await loadTeamPickCounts(currentRoundId); // Refresh pick counts to show updated numbers

          // Force dashboard data refresh for immediate stats update
          refreshData();
        }
        setSelectedTeam(null);
      } else {
        alert('Failed to submit pick: ' + (response.data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to submit pick:', error);
      alert('Failed to submit pick');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || contextLoading || !pickDataLoaded) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200 shadow-sm">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <Link href={`/game/${competitionId}`} className="flex items-center space-x-2 text-slate-600 hover:text-slate-800 transition-colors">
                  <ArrowLeftIcon className="h-5 w-5" />
                  <span className="font-medium">Back</span>
                </Link>
                <div className="h-6 w-px bg-slate-300" />
                <div>
                  <h1 className="text-lg font-semibold text-slate-900">Make Your Pick</h1>
                  <p className="text-sm text-slate-600">Loading round...</p>
                </div>
              </div>
            </div>
          </div>
        </header>
        
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
            <div className="flex items-center justify-center">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-50 rounded-full mb-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-600 border-t-transparent"></div>
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">Loading Pick Options</h3>
                <p className="text-slate-500">Please wait while we load the fixtures...</p>
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
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link href={`/game/${competitionId}`} className="flex items-center space-x-2 text-slate-600 hover:text-slate-800 transition-colors">
                <ArrowLeftIcon className="h-5 w-5" />
                <span className="font-medium">Dashboard</span>
              </Link>
              <div className="h-6 w-px bg-slate-300" />
              <div>
                <h1 className="text-lg font-semibold text-slate-900">
                  {viewMode === 'previous' || isRoundLocked ? 'Results' : 'Make Your Pick'}
                </h1>
                {(() => {
                  const currentViewingRound = rounds.find(r => r.id === viewingRoundId);
                  const roundNumber = currentViewingRound?.round_number;
                  return roundNumber ? (
                    <p className="text-sm text-slate-600">
                      Round {roundNumber}
                      {viewMode === 'previous' ? ' (Previous)' : ''}
                      {isRoundLocked && viewMode === 'current' ? ' (Locked)' : ''}
                    </p>
                  ) : null;
                })()}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Competition Name */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              {/* Mode indicator */}
              {viewMode === 'previous' && (
                <p className="text-sm text-slate-600 mt-1">
                  Viewing previous round results
                </p>
              )}
            </div>
            
            {/* Round selector - show if there are multiple rounds */}
            {rounds.length > 1 && (
              <div className="relative">
                <select
                  value={viewingRoundId || currentRoundId || ''}
                  onChange={async (e) => {
                    const roundId = parseInt(e.target.value);
                    setViewingRoundId(roundId);
                    // Use the actual current round from rounds array to avoid stale state
                    const actualCurrentRoundId = rounds.length > 0 ? rounds[0].id : null;
                    const newViewMode = roundId === actualCurrentRoundId ? 'current' : 'previous';
                    setViewMode(newViewMode);
                    await loadRoundData(roundId, newViewMode === 'current');
                  }}
                  className="appearance-none bg-white border border-slate-300 rounded-lg px-4 py-2 pr-8 text-sm font-medium text-slate-700 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {rounds.map(round => (
                    <option key={round.id} value={round.id}>
                      {round.id === currentRoundId ? 'Current Round' : `Round ${round.round_number} Results`}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            )}
          </div>
        </div>


        {/* Round Information Card */}
        {(() => {
          const currentViewingRound = rounds.find(r => r.id === viewingRoundId);
          const roundNumber = currentViewingRound?.round_number;
          const lockTime = currentViewingRound?.lock_time;

          if (roundNumber) {
            // Calculate lock time info for current unlocked rounds
            let lockTimeInfo = null;
            if (viewMode === 'current' && !isRoundLocked && lockTime) {
              const lockDate = new Date(lockTime);
              const now = new Date();
              const timeUntilLock = lockDate.getTime() - now.getTime();
              const hoursUntilLock = Math.floor(timeUntilLock / (1000 * 60 * 60));
              const minutesUntilLock = Math.floor((timeUntilLock % (1000 * 60 * 60)) / (1000 * 60));

              lockTimeInfo = {
                lockDate,
                timeUntilLock,
                hoursUntilLock,
                minutesUntilLock
              };
            }

            return (
              <div className="mb-6">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-lg text-slate-800">
                    Round {roundNumber}
                    {viewMode === 'previous' ? ' - Results' : ''}
                    {isRoundLocked && viewMode === 'current' ? ' - Locked' : ''}
                  </div>

                  {/* Deadline for current unlocked rounds */}
                  {lockTimeInfo && (
                    <div className="text-right">
                      <div className="text-sm text-slate-600">
                        Deadline: {lockTimeInfo.lockDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </div>
                      <div className="font-semibold text-slate-800">
                        {lockTimeInfo.lockDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          }
          return null;
        })()}

        {/* Team Selection by Fixture */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          {/* Section Header - Simplified */}
          {(viewMode === 'previous' || isRoundLocked) && (
            <div className="mb-6 text-center">
              <h2 className="text-xl font-bold text-slate-900">
                {viewMode === 'previous' ? 'Match Results' : 'Final Picks & Results'}
              </h2>
            </div>
          )}

          <div className="space-y-6">
            {fixtures.map((fixture) => {
              // Create team objects for this fixture
              const homeTeam = {
                short: fixture.home_team_short,
                name: fixture.home_team,
                fixtureId: fixture.id,
                position: 'home' as const
              };

              const awayTeam = {
                short: fixture.away_team_short,
                name: fixture.away_team,
                fixtureId: fixture.id,
                position: 'away' as const
              };

              return (
                <div key={fixture.id} className="border-b border-slate-100 last:border-b-0 pb-6 last:pb-0">
                  {/* Team Cards with VS between them */}
                  <div className="flex items-center gap-4">
                    {/* Home Team */}
                    {(() => {
                      const team = homeTeam;
                      const isAllowed = allowedTeams.includes(team.short);
                      const isSelected = selectedTeam?.teamShort === team.short;
                      const isCurrentPick = currentPick === team.short;

                      // Check result for this team
                      const fixtureResult = fixture.result;

                      // Determine game result: WIN = player advances, LOSE = player eliminated
                      let teamResult: 'win' | 'lose' | null = null;
                      if (fixtureResult && isRoundLocked) {
                        if (fixtureResult === team.short) {
                          teamResult = 'win'; // Team won = Player advances
                        } else {
                          teamResult = 'lose'; // Team lost or drew = Player eliminated
                        }
                      }

                      // Disable teams if:
                      // 1. Team not in allowed list
                      // 2. There's already a current pick (user must remove it first)
                      // 3. Round is locked
                      // 4. Viewing previous rounds (not current round)
                      const isDisabled = !isAllowed || !!(currentPick && !isCurrentPick) || isRoundLocked || viewMode === 'previous';

                      return (
                        <button
                          key={team.short}
                          onClick={() => handleTeamSelect(team.short, team.fixtureId, team.position)}
                          disabled={isDisabled}
                          className={`relative flex-1 p-4 rounded-lg border-2 transition-all duration-200 ${
                            teamResult === 'win'
                              ? 'bg-green-600 border-slate-800 shadow-md text-white'
                              : teamResult === 'lose'
                              ? 'bg-red-600 border-slate-800 shadow-md text-white'
                              : isSelected
                              ? 'bg-white border-blue-500 shadow-md'
                              : isCurrentPick
                              ? 'bg-white border-blue-500 shadow-md'
                              : isDisabled
                              ? 'bg-slate-100 border-slate-300 text-slate-500 cursor-not-allowed opacity-50'
                              : 'bg-white border-slate-300 hover:border-slate-400 cursor-pointer'
                          }`}
                        >
                          {/* Current pick indicator */}
                          {isCurrentPick && (
                            <div className="absolute -top-2 -left-2 bg-slate-600 text-white text-xs rounded-full px-2 py-1 font-bold shadow-md">
                              PICK
                            </div>
                          )}

                          {/* Player count badge - only show when round is locked */}
                          {isRoundLocked && teamPickCounts[team.short] && (
                            <div className="absolute -top-2 -right-2 bg-slate-600 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center shadow-lg">
                              {teamPickCounts[team.short]}
                            </div>
                          )}

                          <div className="text-center">
                            {/* Full team name only */}
                            <div className={`text-lg font-bold ${
                              teamResult === 'win' || teamResult === 'lose' ? 'text-white' : 'text-black'
                            }`}>
                              {team.name}
                            </div>

                            {/* Result box - only show for pending (no result) fixtures */}
                            {isRoundLocked && !teamResult && (
                              <div className="text-xs font-bold mt-2 px-2 py-1 rounded text-white bg-slate-500">

                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })()}

                    {/* VS Separator */}
                    <div className="flex-shrink-0 px-2">
                      <div className="text-2xl font-bold text-slate-600">
                        VS
                      </div>
                    </div>

                    {/* Away Team */}
                    {(() => {
                      const team = awayTeam;
                      const isAllowed = allowedTeams.includes(team.short);
                      const isSelected = selectedTeam?.teamShort === team.short;
                      const isCurrentPick = currentPick === team.short;

                      // Check result for this team
                      const fixtureResult = fixture.result;

                      // Determine game result: WIN = player advances, LOSE = player eliminated
                      let teamResult: 'win' | 'lose' | null = null;
                      if (fixtureResult && isRoundLocked) {
                        if (fixtureResult === team.short) {
                          teamResult = 'win'; // Team won = Player advances
                        } else {
                          teamResult = 'lose'; // Team lost or drew = Player eliminated
                        }
                      }

                      // Disable teams if:
                      // 1. Team not in allowed list
                      // 2. There's already a current pick (user must remove it first)
                      // 3. Round is locked
                      // 4. Viewing previous rounds (not current round)
                      const isDisabled = !isAllowed || !!(currentPick && !isCurrentPick) || isRoundLocked || viewMode === 'previous';

                      return (
                        <button
                          key={team.short}
                          onClick={() => handleTeamSelect(team.short, team.fixtureId, team.position)}
                          disabled={isDisabled}
                          className={`relative flex-1 p-4 rounded-lg border-2 transition-all duration-200 ${
                            teamResult === 'win'
                              ? 'bg-green-600 border-slate-800 shadow-md text-white'
                              : teamResult === 'lose'
                              ? 'bg-red-600 border-slate-800 shadow-md text-white'
                              : isSelected
                              ? 'bg-white border-blue-500 shadow-md'
                              : isCurrentPick
                              ? 'bg-white border-blue-500 shadow-md'
                              : isDisabled
                              ? 'bg-slate-100 border-slate-300 text-slate-500 cursor-not-allowed opacity-50'
                              : 'bg-white border-slate-300 hover:border-slate-400 cursor-pointer'
                          }`}
                        >
                          {/* Current pick indicator */}
                          {isCurrentPick && (
                            <div className="absolute -top-2 -left-2 bg-slate-600 text-white text-xs rounded-full px-2 py-1 font-bold shadow-md">
                              PICK
                            </div>
                          )}

                          {/* Player count badge - only show when round is locked */}
                          {isRoundLocked && teamPickCounts[team.short] && (
                            <div className="absolute -top-2 -right-2 bg-slate-600 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center shadow-lg">
                              {teamPickCounts[team.short]}
                            </div>
                          )}

                          <div className="text-center">
                            {/* Full team name only */}
                            <div className={`text-lg font-bold ${
                              teamResult === 'win' || teamResult === 'lose' ? 'text-white' : 'text-black'
                            }`}>
                              {team.name}
                            </div>

                            {/* Result box - only show for pending (no result) fixtures */}
                            {isRoundLocked && !teamResult && (
                              <div className="text-xs font-bold mt-2 px-2 py-1 rounded text-white bg-slate-500">

                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* No Pick Indicator - shown when viewing previous rounds and no pick was made */}
        {viewMode === 'previous' && !currentPick && (
          <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="text-center">
              <div className="text-amber-800 font-medium">
                NO PICK - You did not make a selection for this round
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Banner - shown when team is selected and viewing current round */}
        {selectedTeam && !isRoundLocked && viewMode === 'current' && (
          <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-center">
              <div className="text-green-800 font-medium mb-3">
                Confirm your pick: <span className="font-bold">{getFullTeamName(selectedTeam.teamShort)}</span>
              </div>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={submitPick}
                  disabled={submitting}
                  className="bg-slate-600 hover:bg-slate-700 disabled:bg-slate-400 text-white px-6 py-3 rounded-lg font-medium transition-colors min-w-[120px]"
                >
                  {submitting ? 'Confirming...' : 'Confirm Pick'}
                </button>
                <button
                  onClick={() => setSelectedTeam(null)}
                  disabled={submitting}
                  className="bg-slate-200 hover:bg-slate-300 disabled:bg-slate-100 text-slate-700 px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Remove Current Pick Card - shown when no team selected but user has current pick and viewing current round */}
        {!selectedTeam && currentPick && !isRoundLocked && viewMode === 'current' && (
          <div className="mt-6 bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="text-center">
              <div className="text-slate-800 font-medium mb-2">
                Current Pick: <span className="font-bold">{getFullTeamName(currentPick)}</span>
              </div>
              <div className="text-slate-600 text-base mb-4">
                Want to change your pick? Remove it first to select a different team.
              </div>
              <button
                onClick={handleUnselectPick}
                disabled={submitting}
                className="bg-slate-600 hover:bg-slate-700 disabled:bg-slate-400 text-white px-6 py-3 rounded-lg font-medium transition-colors min-w-[140px]"
              >
                {submitting ? 'Removing...' : 'Remove Pick'}
              </button>
            </div>
          </div>
        )}

        {/* Statistics Section - only show when round is locked and we have pick counts */}
        {isRoundLocked && Object.keys(teamPickCounts).length > 0 && (
          <div className="mt-6 bg-slate-50 rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 text-center">
              Player Pick Statistics
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {Object.entries(teamPickCounts)
                .sort(([,a], [,b]) => b - a) // Sort by pick count descending
                .map(([teamShort, count]) => {
                  const teamName = getFullTeamName(teamShort);
                  const isCurrentPick = currentPick === teamShort;

                  return (
                    <div
                      key={teamShort}
                      className={`p-3 rounded-lg border text-center ${
                        isCurrentPick
                          ? 'bg-blue-100 border-blue-300'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className={`font-bold text-sm ${
                        isCurrentPick ? 'text-blue-900' : 'text-slate-900'
                      }`}>
                        {teamName}
                      </div>
                      <div className={`text-xs mt-1 ${
                        isCurrentPick ? 'text-blue-700' : 'text-slate-600'
                      }`}>
                        {count} player{count !== 1 ? 's' : ''}
                        {isCurrentPick && ' (Your pick)'}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Help Section - only show for current round when not locked */}
        {viewMode === 'current' && !isRoundLocked && !currentPick && (
          <div className="mt-6 bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="text-center">
              <div className="text-slate-800 font-medium mb-2">
                💡 How to make your pick
              </div>
              <div className="text-slate-700 text-sm space-y-1">
                <p>• Click on any available team to select them</p>
                <p>• Confirm your selection before the round locks</p>
                <p>• Your team must WIN to advance - draws and losses eliminate you</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}