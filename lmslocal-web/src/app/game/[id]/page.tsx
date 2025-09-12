'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  TrophyIcon,
  ArrowLeftIcon,
  UserGroupIcon,
  ChartBarIcon,
  ClockIcon,
  ClipboardDocumentIcon,
  Cog6ToothIcon,
  CalendarDaysIcon,
  PlayIcon
} from '@heroicons/react/24/outline';
import { Competition as CompetitionType, userApi, roundApi } from '@/lib/api';
import { useAppData } from '@/contexts/AppDataContext';

export default function UnifiedGameDashboard() {
  const router = useRouter();
  const params = useParams();
  const competitionId = params.id as string;
  
  // Use AppDataProvider context for competitions data
  const { competitions, loading: contextLoading } = useAppData();
  
  // Memoize the specific competition to prevent unnecessary re-renders
  const competition = useMemo(() => {
    return competitions?.find(c => c.id.toString() === competitionId);
  }, [competitions, competitionId]);

  const [winnerName, setWinnerName] = useState<string>('Loading...');
  
  // Simple loading based on context availability
  const loading = contextLoading || !competition;
  
  // Prevent duplicate API calls using refs
  const winnerLoadedRef = useRef(false);
  
  // User role detection
  const isOrganiser = competition?.is_organiser || false;
  const isParticipant = competition?.is_participant || false;
  
  // Simple winner detection using existing player_count and status
  const getWinnerStatus = (comp: CompetitionType) => {
    const playerCount = comp.player_count || 0;
    const isNotSetup = comp.status !== 'SETUP';
    
    if (playerCount === 1 && isNotSetup) return { isComplete: true, winner: winnerName, isDraw: false };
    if (playerCount === 0 && isNotSetup) return { isComplete: true, winner: undefined, isDraw: true };
    return { isComplete: false };
  };

  const competitionComplete = competition ? getWinnerStatus(competition) : { isComplete: false };


  // Handle play button click - check for rounds and fixtures before routing
  const handlePlayClick = async () => {
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
      
      // If we get here, there are rounds with fixtures - route to pick screen
      router.push(`/game/${competitionId}/pick`);
      
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
      
      // Load winner name if competition has 1 player and is not in setup
      if (competition.player_count === 1 && competition.status !== 'SETUP' && !winnerLoadedRef.current) {
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
    }
  }, [competition, competitionId, router, isOrganiser]);

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
                    href={`/play/${competitionId}/standings`}
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

        {/* Key Stats Grid */}
        <div className={`grid grid-cols-1 gap-6 mb-6 sm:mb-8 ${
          isOrganiser && isParticipant ? 'lg:grid-cols-4' : 'lg:grid-cols-3'
        }`}>
          {/* Competition Status */}
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
              <ChartBarIcon className="h-5 w-5 mr-2" />
              Competition Status
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Active Players</span>
                <span className="font-bold text-emerald-600">
                  {competition?.player_count || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Eliminated</span>
                <span className="font-bold text-red-500">
                  {(competition?.total_players || 0) - (competition?.player_count || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Current Round</span>
                <span className="font-bold text-slate-800">
                  {competition.current_round || 'Not Started'}
                </span>
              </div>
            </div>
          </div>

          {/* Invite Code Card */}
          {competition.invite_code && (
            <div className="bg-white rounded-xl p-6 border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
                <ClipboardDocumentIcon className="h-5 w-5 mr-2" />
                Invite Code
              </h3>
              
              <div className="text-center">
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
          )}

          {/* Pick Progress Card - for organizers */}
          {isOrganiser && (
            <div className="bg-white rounded-xl p-6 border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
                <UserGroupIcon className="h-5 w-5 mr-2" />
                Pick Progress
              </h3>
              
              <div className="text-center">
                {competition?.current_round_lock_time && new Date(competition.current_round_lock_time) <= new Date() ? (
                  <>
                    <div className="text-2xl font-bold text-slate-600 mb-1">
                      <ClockIcon className="h-6 w-6 inline mr-2" />
                      Round Locked
                    </div>
                    <div className="text-sm text-slate-600">
                      Final: {competition?.picks_made || 0} of {competition?.picks_required || 0} picks made
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-3xl font-bold text-blue-600 mb-1">
                      {competition?.pick_completion_percentage || 0}%
                    </div>
                    <div className="text-sm text-slate-600">
                      {competition?.picks_made || 0} of {competition?.picks_required || 0} picks made
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Your Status Card - for participants */}
          {isParticipant && (
            <div className="bg-white rounded-xl p-6 border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
                <UserGroupIcon className="h-5 w-5 mr-2" />
                Your Status
              </h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Status</span>
                  <span className={`font-bold ${
                    competition.user_status === 'active' 
                      ? 'text-emerald-600' 
                      : 'text-red-500'
                  }`}>
                    {competition.user_status === 'active' ? 'Active' : 'Eliminated'}
                  </span>
                </div>
                {competition.lives_remaining !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Lives Remaining</span>
                    <span className="font-bold text-slate-800">{competition.lives_remaining}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

{/* Organizer Action Buttons */}
        {isOrganiser && (
          <div className="bg-white rounded-xl p-4 sm:p-6 lg:p-8 shadow-sm border border-slate-200 mb-6 sm:mb-8">
            <div className={`grid gap-4 sm:gap-6 ${isParticipant ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5' : 'grid-cols-2 lg:grid-cols-4'}`}>
              {/* Play button - only show if organizer is also a participant */}
              {isParticipant && (
                <button 
                  onClick={handlePlayClick}
                  className="group text-center hover:opacity-80 transition-opacity duration-200 cursor-pointer"
                >
                  <div className="mb-4">
                    <PlayIcon className="h-12 w-12 text-slate-600 mx-auto group-hover:text-slate-800 transition-colors" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">Play</h3>
                  <p className="text-sm text-slate-600">View game as player</p>
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
                className="group text-center hover:opacity-80 transition-opacity duration-200 cursor-pointer"
              >
                <div className="mb-4">
                  <PlayIcon className="h-12 w-12 text-slate-600 mx-auto group-hover:text-slate-800 transition-colors" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Play</h3>
                <p className="text-sm text-slate-600">Make your picks and play the game</p>
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

        {/* Recent Activity for players only */}
        {!isOrganiser && competition.history && competition.history.length > 0 && (
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
              <ClockIcon className="h-5 w-5 mr-2" />
              Recent Activity
            </h3>
            
            <div className="space-y-3">
              {competition.history.slice(0, 3).map((round, index) => (
                <div key={index} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      Round {round.round_number}: {round.pick_team_full_name || round.pick_team || 'No pick'}
                    </p>
                    <p className="text-xs text-slate-500">{round.fixture}</p>
                  </div>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                    round.pick_result === 'win' ? 'bg-emerald-100 text-emerald-700' :
                    round.pick_result === 'loss' ? 'bg-red-100 text-red-700' :
                    round.pick_result === 'no_pick' ? 'bg-gray-100 text-gray-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {round.pick_result === 'win' ? 'Won' :
                     round.pick_result === 'loss' ? 'Lost' :
                     round.pick_result === 'no_pick' ? 'No Pick' :
                     'Pending'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}