'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon
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
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<{teamShort: string, fixtureId: number, position: 'home' | 'away'} | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [allowedTeams, setAllowedTeams] = useState<string[]>([]);
  const [currentPick, setCurrentPick] = useState<string | null>(null);
  const [isRoundLocked, setIsRoundLocked] = useState<boolean>(false);
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

  // Load data for the current round
  const loadRoundData = useCallback(async (roundId: number, freshRounds?: Round[]) => {
    setPickDataLoaded(false);

    try {
      await Promise.all([
        loadFixtures(roundId),
        loadAllowedTeams(parseInt(competitionId)),
        loadCurrentPick(roundId)
      ]);

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
        
        // Check if round is locked - this page is only for unlocked rounds
        const now = new Date();
        const lockTime = new Date(latestRound.lock_time || '');
        const locked = !!(latestRound.lock_time && now >= lockTime);

        // If round is locked, redirect to player results page
        if (locked) {
          router.push(`/game/${competitionId}/player-results`);
          return;
        }

        setCurrentRoundId(latestRound.id);
        setIsRoundLocked(locked);

        // Load data for the current round - pass fresh rounds data
        await loadRoundData(latestRound.id, roundsData);
        
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
          // Clear allowed teams cache so fresh data loads after team restoration
          apiCache.delete(`allowed-teams-${competitionId}-current`);

          // Clear user dashboard cache to update pick counts on main game page
          const userData = localStorage.getItem('user');
          if (userData) {
            const user = JSON.parse(userData);
            apiCache.delete(`user-dashboard-${user.id}`);
          }

          await loadAllowedTeams(parseInt(competitionId));
          await loadCurrentPick(currentRoundId);

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

          // Clear user dashboard cache to update pick counts on main game page
          const userData = localStorage.getItem('user');
          if (userData) {
            const user = JSON.parse(userData);
            apiCache.delete(`user-dashboard-${user.id}`);
          }

          await loadAllowedTeams(parseInt(competitionId));
          await loadCurrentPick(currentRoundId);

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
                <h1 className="text-lg font-semibold text-slate-900">Make Your Pick</h1>
                {(() => {
                  const currentRound = rounds.find(r => r.id === currentRoundId);
                  const roundNumber = currentRound?.round_number;
                  return roundNumber ? (
                    <p className="text-sm text-slate-600">
                      Round {roundNumber}
                      {isRoundLocked ? ' (Locked)' : ''}
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
              {/* Current round info */}
            </div>
          </div>
        </div>


        {/* Round Information Card */}
        {(() => {
          const currentRound = rounds.find(r => r.id === currentRoundId);
          const roundNumber = currentRound?.round_number;
          const lockTime = currentRound?.lock_time;

          if (roundNumber) {
            // Calculate lock time info for unlocked rounds
            let lockTimeInfo = null;
            if (!isRoundLocked && lockTime) {
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
                    {isRoundLocked ? ' - Locked' : ''}
                  </div>

                  {/* Deadline for unlocked rounds */}
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
                  <div className="flex items-center gap-2 sm:gap-4">
                    {/* Home Team */}
                    {(() => {
                      const team = homeTeam;
                      const isAllowed = allowedTeams.includes(team.short);
                      const isSelected = selectedTeam?.teamShort === team.short;
                      const isCurrentPick = currentPick === team.short;

                      // Disable teams if:
                      // 1. Team not in allowed list
                      // 2. There's already a current pick (user must remove it first)
                      // 3. Round is locked
                      const isDisabled = !isAllowed || !!(currentPick && !isCurrentPick) || isRoundLocked;

                      return (
                        <button
                          key={team.short}
                          onClick={() => handleTeamSelect(team.short, team.fixtureId, team.position)}
                          disabled={isDisabled}
                          className={`relative flex-1 min-h-[80px] p-3 sm:p-4 rounded-lg border-2 transition-all duration-200 ${
                            isSelected
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

                          <div className="text-center flex items-center justify-center h-full">
                            {/* Full team name with responsive sizing and multi-line support */}
                            <div className="text-sm sm:text-base lg:text-lg font-bold text-black leading-tight">
                              {team.name}
                            </div>
                          </div>
                        </button>
                      );
                    })()}

                    {/* VS Separator */}
                    <div className="flex-shrink-0 px-2">
                      <div className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-600">
                        VS
                      </div>
                    </div>

                    {/* Away Team */}
                    {(() => {
                      const team = awayTeam;
                      const isAllowed = allowedTeams.includes(team.short);
                      const isSelected = selectedTeam?.teamShort === team.short;
                      const isCurrentPick = currentPick === team.short;

                      // Disable teams if:
                      // 1. Team not in allowed list
                      // 2. There's already a current pick (user must remove it first)
                      // 3. Round is locked
                      const isDisabled = !isAllowed || !!(currentPick && !isCurrentPick) || isRoundLocked;

                      return (
                        <button
                          key={team.short}
                          onClick={() => handleTeamSelect(team.short, team.fixtureId, team.position)}
                          disabled={isDisabled}
                          className={`relative flex-1 min-h-[80px] p-3 sm:p-4 rounded-lg border-2 transition-all duration-200 ${
                            isSelected
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

                          <div className="text-center flex items-center justify-center h-full">
                            {/* Full team name with responsive sizing and multi-line support */}
                            <div className="text-sm sm:text-base lg:text-lg font-bold text-black leading-tight">
                              {team.name}
                            </div>
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


        {/* Confirmation Banner - shown when team is selected and round not locked */}
        {selectedTeam && !isRoundLocked && (
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

        {/* Remove Current Pick Card - shown when no team selected but user has current pick and round not locked */}
        {!selectedTeam && currentPick && !isRoundLocked && (
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


        {/* Help Section - only show when round not locked and no current pick */}
        {!isRoundLocked && !currentPick && (
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