'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  TrophyIcon,
  ArrowLeftIcon,
  UserGroupIcon,
  ClipboardDocumentIcon,
  Cog6ToothIcon,
  CalendarDaysIcon,
  PlayIcon
} from '@heroicons/react/24/outline';
import { Competition as CompetitionType, userApi, roundApi, competitionApi } from '@/lib/api';
import { useAppData } from '@/contexts/AppDataContext';

export default function UnifiedGameDashboard() {
  const router = useRouter();
  const params = useParams();
  const competitionId = params.id as string;
  
  // Use AppDataProvider context for competitions data
  const { competitions, loading: contextLoading, latestRoundStats } = useAppData();
  
  // Memoize the specific competition to prevent unnecessary re-renders
  const competition = useMemo(() => {
    return competitions?.find(c => c.id.toString() === competitionId);
  }, [competitions, competitionId]);

  const [winnerName, setWinnerName] = useState<string>('Loading...');
  const [currentRoundInfo, setCurrentRoundInfo] = useState<{
    round_number: number;
    lock_time?: string;
    fixture_count: number;
    is_locked: boolean;
    completed_fixtures?: number;
    status?: string;
  } | null>(null);
  const [, setLoadingRound] = useState(true);
  const [pickStats, setPickStats] = useState<{
    players_with_picks: number;
    total_active_players: number;
    pick_percentage: number;
  } | null>(null);

  // Simple loading based on context availability
  const loading = contextLoading || !competition;

  // Prevent duplicate API calls using refs
  const winnerLoadedRef = useRef(false);
  const roundLoadedRef = useRef(false);
  const pickStatsLoadedRef = useRef(false);
  
  // User role detection
  const isOrganiser = competition?.is_organiser || false;
  const isParticipant = competition?.is_participant || false;
  
  // Winner detection only shows when competition status is COMPLETE
  const getWinnerStatus = (comp: CompetitionType) => {
    const playerCount = comp.player_count || 0;
    const isComplete = comp.status === 'COMPLETE';
    
    if (isComplete && playerCount === 1) return { isComplete: true, winner: winnerName, isDraw: false };
    if (isComplete && playerCount === 0) return { isComplete: true, winner: undefined, isDraw: true };
    return { isComplete: false };
  };

  const competitionComplete = competition ? getWinnerStatus(competition) : { isComplete: false };


  // Handle play button click - check player status first, then rounds and fixtures before routing
  const handlePlayClick = async () => {
    // Check if player is eliminated before allowing play
    if (competition?.user_status && competition.user_status !== 'active') {
      router.push(`/game/${competitionId}/standings`);
      return;
    }

    try {
      const response = await roundApi.getRounds(parseInt(competitionId));
      
      if (response.data.return_code !== 'SUCCESS') {
        console.error('Failed to fetch rounds:', response.data.message);
        // If API fails, go to waiting screen as fallback
        router.push(`/game/${competitionId}/waiting`);
        return;
      }
      
      const rounds = response.data.rounds || [];
      
      // Check if no rounds exist
      if (rounds.length === 0) {
        router.push(`/game/${competitionId}/waiting`);
        return;
      }
      
      // Check if the latest round (first in array, as they're ordered most recent first) has fixtures
      const latestRound = rounds[0];
      if (latestRound.fixture_count === 0) {
        router.push(`/game/${competitionId}/waiting`);
        return;
      }

      // Check if round is locked to determine which page to show
      const now = new Date();
      const lockTime = new Date(latestRound.lock_time || '');
      const isLocked = !!(latestRound.lock_time && now >= lockTime);

      if (isLocked) {
        // Round is locked - show player results view
        router.push(`/game/${competitionId}/player-results`);
      } else {
        // Round is not locked - show pick screen
        router.push(`/game/${competitionId}/pick`);
      }
      
    } catch (error) {
      console.error('Error checking rounds:', error);
      // On error, fallback to waiting screen
      router.push(`/game/${competitionId}/waiting`);
    }
  };

  // Handle fixtures button click - check for rounds and fixtures before routing
  const handleFixturesClick = async () => {
    try {
      const response = await roundApi.getRounds(parseInt(competitionId));
      
      if (response.data.return_code !== 'SUCCESS') {
        console.error('Failed to fetch rounds:', response.data.message);
        // If API fails, go to fixtures screen to handle creation
        router.push(`/game/${competitionId}/fixtures`);
        return;
      }
      
      const rounds = response.data.rounds || [];
      
      // Check if no rounds exist OR if the latest round has no fixtures
      if (rounds.length === 0 || rounds[0].fixture_count === 0) {
        router.push(`/game/${competitionId}/fixtures`);
        return;
      }
      
      // Round has fixtures - check if it's locked
      const latestRound = rounds[0];
      const now = new Date();
      const lockTime = new Date(latestRound.lock_time || '');
      const isLocked = latestRound.lock_time && now >= lockTime;
      
      if (isLocked) {
        // Round is locked - go to results screen
        router.push(`/game/${competitionId}/results`);
      } else {
        // Round is not locked yet - go to fixtures screen
        router.push(`/game/${competitionId}/fixtures`);
      }
      
    } catch (error) {
      console.error('Error checking rounds for fixtures:', error);
      // On error, fallback to fixtures screen
      router.push(`/game/${competitionId}/fixtures`);
    }
  };

  useEffect(() => {
    // Simple auth check
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      router.push('/login');
      return;
    }
    
    // Load data only if we have the competition
    if (competition) {
      
      // Load current round info
      if (!roundLoadedRef.current) {
        roundLoadedRef.current = true;
        roundApi.getRounds(parseInt(competitionId))
          .then(response => {
            if (response.data.return_code === 'SUCCESS') {
              const rounds = response.data.rounds || [];
              if (rounds.length > 0) {
                const latestRound = rounds[0];
                const now = new Date();
                const lockTime = new Date(latestRound.lock_time || '');
                const isLocked = !!(latestRound.lock_time && now >= lockTime);
                
                setCurrentRoundInfo({
                  round_number: latestRound.round_number,
                  lock_time: latestRound.lock_time,
                  fixture_count: latestRound.fixture_count || 0,
                  is_locked: isLocked,
                  completed_fixtures: latestRound.completed_fixtures || 0,
                  status: latestRound.status
                });
              } else {
                setCurrentRoundInfo(null);
              }
            }
            setLoadingRound(false);
          })
          .catch(() => {
            setLoadingRound(false);
            roundLoadedRef.current = false; // Reset on error to allow retry
          });
      }
      
      // Load winner name if competition is COMPLETE
      if (competition.status === 'COMPLETE' && competition.player_count === 1 && !winnerLoadedRef.current) {
        winnerLoadedRef.current = true;
        userApi.getCompetitionStandings(parseInt(competitionId))
          .then(response => {
            if (response.data.return_code === 'SUCCESS') {
              const players = (response.data.players as { status: string; display_name: string }[]) || [];
              const activePlayer = players.find(p => p.status !== 'OUT');
              setWinnerName(activePlayer?.display_name || 'Unknown Winner');
            }
          })
          .catch(() => {
            setWinnerName('Unknown Winner');
            winnerLoadedRef.current = false; // Reset on error to allow retry
          });
      }

      // Load pick statistics for all users
      if (!pickStatsLoadedRef.current && currentRoundInfo) {
        pickStatsLoadedRef.current = true;
        competitionApi.getPickStatistics(parseInt(competitionId))
          .then(response => {
            if (response.data.return_code === 'SUCCESS') {
              setPickStats({
                players_with_picks: response.data.players_with_picks || 0,
                total_active_players: response.data.total_active_players || 0,
                pick_percentage: response.data.pick_percentage || 0
              });
            }
          })
          .catch(() => {
            pickStatsLoadedRef.current = false; // Reset on error to allow retry
          });
      }
    }
  }, [competition, competitionId, router, currentRoundInfo]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <Link href="/dashboard" className="flex items-center space-x-2 text-slate-600 hover:text-slate-800 transition-colors">
                  <ArrowLeftIcon className="h-5 w-5" />
                  <span className="font-medium">Dashboard</span>
                </Link>
                <div className="h-6 w-px bg-slate-300" />
                <div className="flex items-center space-x-3">
                  <TrophyIcon className="h-6 w-6 text-blue-600" />
                  <h1 className="text-lg font-semibold text-slate-900">Loading Competition...</h1>
                </div>
              </div>
            </div>
          </div>
        </header>
        
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
            <div className="flex items-center justify-center">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-50 rounded-full mb-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">Loading Game Dashboard</h3>
                <p className="text-slate-500">Please wait while we fetch your competition data...</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!competition) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-slate-900 mb-2">Competition Not Found</h1>
          <Link href="/dashboard" className="text-blue-600 hover:text-blue-800">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between min-h-[4rem] py-2">
            <div className="flex items-center space-x-2 sm:space-x-4 flex-1 min-w-0">
              <Link 
                href="/dashboard" 
                className="flex items-center space-x-1 sm:space-x-2 text-slate-600 hover:text-slate-800 transition-colors flex-shrink-0"
              >
                <ArrowLeftIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="font-medium text-sm sm:text-base">Dashboard</span>
              </Link>
              <div className="h-4 sm:h-6 w-px bg-slate-300 flex-shrink-0" />
              <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
                <div className="min-w-0">
                  <h1 className="text-base sm:text-lg font-semibold text-slate-900 truncate">
                    {isOrganiser ? 'Management' : 'Game'}
                  </h1>
                </div>
              </div>
            </div>
            
            {/* User role badge */}
            <div className="flex items-center space-x-2">
              {isOrganiser && (
                <div className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                  ORGANISER
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">


        {/* Latest Round Results Card */}
        {latestRoundStats &&
         latestRoundStats.competition_id === parseInt(competitionId) && (
          <div className="mb-6 sm:mb-8">
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <TrophyIcon className="h-6 w-6 text-yellow-400 mr-3" />
                    <h2 className="text-lg font-bold text-white">
                      Round {latestRoundStats.round_number} Results
                    </h2>
                  </div>
                  <span className="text-slate-200 text-sm font-medium">
                    {currentRoundInfo?.status === 'COMPLETE' ? 'Round Complete' : 'Latest Eliminations'}
                  </span>
                </div>
              </div>

              {/* Main Content */}
              <div className="px-6 py-6">
                {/* Status Messages - Now prominent */}
                <div className="text-center mb-6">
                  {latestRoundStats.survivors > 1 && (
                    <div className="bg-blue-50 rounded-xl p-6 border-2 border-blue-300 shadow-sm">
                      <p className="text-3xl text-blue-700 font-bold mb-1">
                        {latestRoundStats.survivors} players still in
                      </p>
                      <p className="text-base text-blue-600">
                        {latestRoundStats.eliminated_this_round === 0
                          ? `All players survived Round ${latestRoundStats.round_number}`
                          : `Advance to Round ${latestRoundStats.round_number + 1}`
                        }
                      </p>
                    </div>
                  )}

                  {latestRoundStats.survivors === 1 && (
                    <div className="bg-green-50 rounded-xl p-6 border-2 border-green-300 shadow-sm">
                      <p className="text-3xl text-green-800 font-bold">
                        👑 We have a champion!
                      </p>
                    </div>
                  )}

                  {latestRoundStats.survivors === 0 && (
                    <div className="bg-slate-50 rounded-xl p-6 border-2 border-slate-300 shadow-sm">
                      <p className="text-3xl text-slate-700 font-bold">
                        😱 Everyone&apos;s out! Draw game!
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                  {/* Eliminated This Round */}
                  <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                    <p className="text-2xl font-bold text-red-600 mb-1">
                      {latestRoundStats.eliminated_this_round}
                    </p>
                    <p className="text-xs text-red-700 font-medium">
                      {latestRoundStats.eliminated_this_round === 1 ? 'Player Eliminated' : 'Players Eliminated'}
                    </p>
                  </div>

                  {/* Started With */}
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                    <p className="text-2xl font-bold text-blue-600 mb-1">
                      {latestRoundStats.total_players}
                    </p>
                    <p className="text-xs text-blue-700 font-medium">
                      Started With
                    </p>
                  </div>

                  {/* Total Eliminated */}
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                    <p className="text-2xl font-bold text-slate-600 mb-1">
                      {latestRoundStats.total_eliminated}
                    </p>
                    <p className="text-xs text-slate-700 font-medium">Total Out</p>
                  </div>
                </div>

                {/* Personal Status for Participants */}
                {isParticipant && (
                  <div className="mt-6 p-6 rounded-xl border-2 border-slate-300 bg-white shadow-sm">
                    <div className="text-center">
                      <div className={`text-2xl font-bold mb-2 ${
                        competition.user_status === 'active' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {latestRoundStats.survivors === 1 && competition.user_status === 'active'
                          ? '🏆 You Are The Winner!'
                          : competition.user_status === 'active'
                          ? '✅ You Advanced!'
                          : '❌ You Were Eliminated'}
                      </div>

                      {/* Show round-specific result if available */}
                      {latestRoundStats.user_outcome && (
                        <div className="text-lg text-slate-700 mb-1">
                          Round {latestRoundStats.round_number}: {
                            latestRoundStats.user_outcome === 'WIN' ? 'Advanced' :
                            latestRoundStats.user_outcome === 'LOSS' ? 'Eliminated' :
                            'Draw'
                          }
                        </div>
                      )}

                      {/* Show picked team if available */}
                      {latestRoundStats.user_picked_team && (
                        <div className="text-base text-slate-600 font-medium">
                          Picked: {latestRoundStats.user_picked_team}
                        </div>
                      )}

                      {/* Show lives remaining if applicable */}
                      {competition.lives_remaining !== undefined && competition.lives_remaining > 0 && (
                        <div className="text-base text-slate-600 font-medium mt-1">
                          Lives Remaining: {competition.lives_remaining}
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        )}

        {/* Competition Completion Banner */}
        {competitionComplete.isComplete && (
          <div className="mb-6 sm:mb-8 bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm">
            <div className="flex items-center justify-center">
              <div className="text-center">
                <TrophyIcon className="h-12 w-12 sm:h-16 sm:w-16 text-slate-600 mx-auto mb-3" />
                
                {competitionComplete.winner ? (
                  <>
                    <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">🎉 Competition Complete!</h3>
                    <div className="mb-2">
                      <p className="text-lg font-medium text-slate-700">Winner</p>
                      <p className="text-xl sm:text-2xl font-bold text-slate-800">{competitionComplete.winner}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">🤝 Competition Complete!</h3>
                    <div className="mb-2">
                      <p className="text-lg font-medium text-slate-700">Result: Draw</p>
                      <p className="text-base text-slate-600">No players remaining</p>
                    </div>
                  </>
                )}
                
                <div className="mt-4">
                  <Link 
                    href={`/game/${competitionId}/standings`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg font-medium hover:bg-slate-700 transition-colors text-sm sm:text-base"
                  >
                    <TrophyIcon className="h-4 w-4" />
                    View Final Standings
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Invite Code - Keep this handy */}
        {competition.invite_code && (
          <div className="mb-6 sm:mb-8">
            <div className="bg-white rounded-xl p-4 sm:p-6 border border-slate-200 shadow-sm">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center justify-center">
                  <ClipboardDocumentIcon className="h-5 w-5 mr-2" />
                  Invite Code
                </h3>
                <code className="text-2xl font-mono font-bold text-slate-800 tracking-wider block mb-2">
                  {competition.invite_code}
                </code>
                <button
                  onClick={() => navigator.clipboard.writeText(competition.invite_code || '')}
                  className="px-3 py-1 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                >
                  Click to copy
                </button>
                <p className="text-xs text-slate-500 mt-2">Share this code to invite players</p>
              </div>
            </div>
          </div>
        )}

        {/* Pick Statistics - All Players */}
        {pickStats && currentRoundInfo && (
          <div className="mb-6 sm:mb-8">
            <div className="bg-white rounded-xl p-4 sm:p-6 border border-slate-200 shadow-sm">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-slate-900 mb-1">
                  Round {currentRoundInfo.round_number} {currentRoundInfo.is_locked ? 'Results' : 'Pick Status'}
                </h3>
                <p className="text-sm text-slate-600">
                  {pickStats.players_with_picks} of {pickStats.total_active_players} players made their pick
                </p>
              </div>

              {/* Visual Progress Bar - Always show as complete when locked */}
              {!currentRoundInfo.is_locked && (
                <div className="mb-4">
                  <div className="w-full bg-slate-200 rounded-full h-8 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500 flex items-center justify-center"
                      style={{ width: `${pickStats.pick_percentage}%` }}
                    >
                      {pickStats.pick_percentage > 20 && (
                        <span className="text-white text-sm font-medium">
                          {pickStats.pick_percentage}%
                        </span>
                      )}
                    </div>
                  </div>
                  {pickStats.pick_percentage <= 20 && (
                    <p className="text-sm text-slate-700 font-medium mt-2">
                      {pickStats.pick_percentage}%
                    </p>
                  )}
                </div>
              )}

              {/* Status Message */}
              <div className="text-center">
                {currentRoundInfo.is_locked ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-blue-800">
                      🔒 Round locked - All picks complete!
                    </p>
                  </div>
                ) : pickStats.pick_percentage === 100 ? (
                  <p className="text-sm font-medium text-green-700">
                    {currentRoundInfo.round_number >= 2
                      ? "✅ All players have picked - Round will lock shortly!"
                      : "✅ All players have picked!"
                    }
                  </p>
                ) : pickStats.pick_percentage >= 75 ? (
                  <p className="text-sm font-medium text-blue-700">
                    Almost there - {pickStats.total_active_players - pickStats.players_with_picks} player{pickStats.total_active_players - pickStats.players_with_picks !== 1 ? 's' : ''} remaining
                  </p>
                ) : (
                  <p className="text-sm font-medium text-slate-700">
                    {pickStats.total_active_players - pickStats.players_with_picks} player{pickStats.total_active_players - pickStats.players_with_picks !== 1 ? 's' : ''} still need to pick
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

{/* Organizer Action Buttons */}
        {isOrganiser && (
          <div className="bg-white rounded-xl p-4 sm:p-6 lg:p-8 shadow-sm border border-slate-200 mb-6 sm:mb-8">
            <div className={`grid gap-4 sm:gap-6 ${isParticipant ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5' : 'grid-cols-2 lg:grid-cols-4'}`}>
              {/* Play button - only show if organizer is also a participant */}
              {isParticipant && (
                <button
                  onClick={handlePlayClick}
                  className="relative group text-center hover:opacity-80 transition-opacity duration-200 cursor-pointer"
                >
                  <div className="mb-4">
                    <PlayIcon className={`h-12 w-12 mx-auto group-hover:text-slate-800 transition-colors ${
                      competition.needs_pick ? 'text-red-600' : 'text-slate-600'
                    }`} />
                  </div>
                  <h3 className={`text-lg font-semibold mb-2 ${
                    competition.needs_pick ? 'text-red-900' : 'text-slate-900'
                  }`}>Play</h3>
                  {competition.needs_pick ? (
                    <div className="inline-flex items-center px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-semibold">
                      Make your pick now!
                    </div>
                  ) : (
                    <p className="text-sm text-slate-600">
                      View game as player
                    </p>
                  )}
                </button>
              )}
              
              <button 
                onClick={handleFixturesClick}
                className="group text-center hover:opacity-80 transition-opacity duration-200 cursor-pointer"
              >
                <div className="mb-4">
                  <CalendarDaysIcon className="h-12 w-12 text-slate-600 mx-auto group-hover:text-slate-800 transition-colors" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Fixtures</h3>
                <p className="text-sm text-slate-600">Manage rounds and fixtures</p>
              </button>
              
              <Link
                href={`/game/${competitionId}/standings`}
                className="group text-center hover:opacity-80 transition-opacity duration-200 cursor-pointer"
              >
                <div className="mb-4">
                  <TrophyIcon className="h-12 w-12 text-slate-600 mx-auto group-hover:text-slate-800 transition-colors" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Standings</h3>
                <p className="text-sm text-slate-600">View leaderboard and results</p>
              </Link>
              
              <Link
                href={`/game/${competitionId}/players`}
                className="group text-center hover:opacity-80 transition-opacity duration-200 cursor-pointer"
              >
                <div className="mb-4">
                  <UserGroupIcon className="h-12 w-12 text-slate-600 mx-auto group-hover:text-slate-800 transition-colors" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Players</h3>
                <p className="text-sm text-slate-600">View and manage players</p>
              </Link>
              
              <Link
                href={`/game/${competitionId}/settings`}
                className="group text-center hover:opacity-80 transition-opacity duration-200 cursor-pointer"
              >
                <div className="mb-4">
                  <Cog6ToothIcon className="h-12 w-12 text-slate-600 mx-auto group-hover:text-slate-800 transition-colors" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Settings</h3>
                <p className="text-sm text-slate-600">Competition settings</p>
              </Link>
            </div>
          </div>
        )}

        {/* Player Action Buttons - Only for players */}
        {!isOrganiser && (
          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-slate-200 mb-6 sm:mb-8">
            <div className="grid grid-cols-2 gap-4 sm:gap-6">
              <button
                onClick={handlePlayClick}
                className="relative group text-center hover:opacity-80 transition-opacity duration-200 cursor-pointer"
              >
                <div className="mb-4">
                  <PlayIcon className={`h-12 w-12 mx-auto group-hover:text-slate-800 transition-colors ${
                    competition.needs_pick ? 'text-red-600' : 'text-slate-600'
                  }`} />
                </div>
                <h3 className={`text-lg font-semibold mb-2 ${
                  competition.needs_pick ? 'text-red-900' : 'text-slate-900'
                }`}>Play</h3>
                {competition.needs_pick ? (
                  <div className="inline-flex items-center px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-semibold">
                    Make your pick now!
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">
                    Make your picks and play the game
                  </p>
                )}
              </button>
              
              <Link
                href={`/game/${competitionId}/standings`}
                className="group text-center hover:opacity-80 transition-opacity duration-200 cursor-pointer"
              >
                <div className="mb-4">
                  <TrophyIcon className="h-12 w-12 text-slate-600 mx-auto group-hover:text-slate-800 transition-colors" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Standings</h3>
                <p className="text-sm text-slate-600">View leaderboard and results</p>
              </Link>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}