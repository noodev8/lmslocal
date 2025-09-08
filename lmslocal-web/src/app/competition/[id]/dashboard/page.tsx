'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  TrophyIcon,
  UserGroupIcon,
  ChartBarIcon,
  ArrowLeftIcon,
  Cog6ToothIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';
import { Competition as CompetitionType, competitionApi, DashboardStats, userApi } from '@/lib/api';
import { useAppData } from '@/contexts/AppDataContext';



export default function AdminDashboard() {
  const router = useRouter();
  const params = useParams();
  const competitionId = params.id as string;
  
  // Use AppDataProvider context for competitions data
  const { competitions, loading: contextLoading } = useAppData();
  
  // Memoize the specific competition to prevent unnecessary re-renders
  const competition = useMemo(() => {
    return competitions?.find(c => c.id.toString() === competitionId);
  }, [competitions, competitionId]);

  const [competitionState, setCompetitionState] = useState<CompetitionType | null>(null);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  // Simple loading based on context availability
  const loading = contextLoading || !competition;
  const [winnerName, setWinnerName] = useState<string>('Loading...');
  
  // Prevent duplicate API calls using refs
  const statsLoadedRef = useRef(false);
  const winnerLoadedRef = useRef(false);
  
  // Simple winner detection using existing player_count and status
  const getWinnerStatus = (comp: CompetitionType) => {
    const playerCount = comp.player_count || 0;
    const isNotSetup = comp.status !== 'SETUP';
    
    if (playerCount === 1 && isNotSetup) return { isComplete: true, winner: winnerName, isDraw: false };
    if (playerCount === 0 && isNotSetup) return { isComplete: true, winner: undefined, isDraw: true };
    return { isComplete: false };
  };

  const competitionComplete = competition ? getWinnerStatus(competition) : { isComplete: false };

  useEffect(() => {
    // Simple auth check
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      router.push('/login');
      return;
    }
    
    // Load dashboard stats only if we have the competition
    if (competition && competition.is_organiser) {
      setCompetitionState(competition);
      
      // Prevent duplicate API calls using ref guard
      if (!statsLoadedRef.current) {
        statsLoadedRef.current = true;
        console.log('🔍 Loading dashboard stats (first time)');
        
        // Load stats without blocking the UI
        competitionApi.getDashboardStats(parseInt(competitionId))
          .then(response => {
            if (response.data.return_code === 'SUCCESS') {
              setDashboardStats(response.data.data || null);
            }
          })
          .catch(() => {
            // Stats are optional - continue without them
            statsLoadedRef.current = false; // Reset on error to allow retry
          });
      }
      
      // Load winner name if competition has 1 player and is not in setup
      if (competition.player_count === 1 && competition.status !== 'SETUP' && !winnerLoadedRef.current) {
        winnerLoadedRef.current = true;
        console.log('🏆 Loading winner name (first time)');
        
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
  }, [competition, competitionId, router]);


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
                  <h1 className="text-lg font-semibold text-slate-900">Competition Dashboard</h1>
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
                <h3 className="text-lg font-medium text-slate-900 mb-2">Loading Dashboard</h3>
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
                href="/dashboard?from=competition" 
                className="flex items-center space-x-1 sm:space-x-2 text-slate-600 hover:text-slate-800 transition-colors flex-shrink-0"
              >
                <ArrowLeftIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="font-medium text-sm sm:text-base hidden sm:block">Switch</span>
                <span className="font-medium text-sm sm:text-base sm:hidden">Back</span>
              </Link>
              <div className="h-4 sm:h-6 w-px bg-slate-300 flex-shrink-0" />
              <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
                <TrophyIcon className="h-5 w-5 sm:h-6 sm:w-6 text-slate-700 flex-shrink-0" />
                <div className="min-w-0">
                  <h1 className="text-base sm:text-lg font-semibold text-slate-900 truncate">Competition Dashboard</h1>
                  {competition && (
                    <p className="text-xs sm:text-sm text-slate-500 truncate">{competitionState?.name}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {/* Competition Info */}
        <div className="mb-6 sm:mb-8">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-2">{competitionState?.name}</h2>
          {competition.description && (
            <p className="text-slate-600 mb-4 text-sm sm:text-base">{competition.description}</p>
          )}
        </div>

        {/* Competition Completion Banner */}
        {competitionComplete.isComplete && (
          <div className="mb-6 sm:mb-8 bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm">
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
                    href={`/play/${competitionId}/standings?from=admin`}
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

        {/* Invite Code - Only show for competitions that haven't started */}
        {competition.invite_code && competition.status !== 'COMPLETE' && (
          <div className="mb-6 sm:mb-8 bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
              <div className="flex-1">
                <h3 className="text-base sm:text-lg font-semibold text-slate-900 mb-1">Player Invite Code</h3>
                <p className="text-sm sm:text-base text-slate-600">Share this code with players to join your competition</p>
              </div>
              <div className="text-center sm:text-right">
                <code className="text-xl sm:text-2xl font-mono font-bold text-slate-800 tracking-wider block">
                  {competition.invite_code}
                </code>
                <button
                  onClick={() => navigator.clipboard.writeText(competition.invite_code || '')}
                  className="mt-2 px-3 py-1 text-xs sm:text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                >
                  Click to copy
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dashboard Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 sm:mb-8">
          {/* Competition Status */}
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Competition Status</h3>
            
            {/* Competition Info with Icons */}
            <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-6 mb-6">
              <div className="flex items-center space-x-2 text-slate-600">
                <UserGroupIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="text-sm font-medium">
                  {dashboardStats?.competition_info.total_players || competition.player_count || 0} players
                </span>
              </div>
              <div className="flex items-center space-x-2 text-slate-600">
                <ChartBarIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="text-sm font-medium">
                  {dashboardStats?.competition_info.current_round 
                    ? `Round ${dashboardStats.competition_info.current_round.round_number}` 
                    : 'No rounds yet'
                  }
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-6 mb-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-emerald-600 mb-1">
                  {dashboardStats?.player_status.still_active || 0}
                </div>
                <div className="text-sm text-slate-600">Still In</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-red-500 mb-1">
                  {dashboardStats?.player_status.eliminated || 0}
                </div>
                <div className="text-sm text-slate-600">Eliminated</div>
              </div>
            </div>
            
            {/* Progress bar */}
            <div className="space-y-2">
              <div className="flex">
                <div 
                  className="bg-emerald-500 h-3 rounded-l-full transition-all duration-500" 
                  style={{ 
                    width: `${dashboardStats?.player_status.completion_percentage || 0}%` 
                  }}
                ></div>
                <div 
                  className="bg-slate-200 h-3 rounded-r-full transition-all duration-500"
                  style={{ 
                    width: `${100 - (dashboardStats?.player_status.completion_percentage || 0)}%` 
                  }}
                ></div>
              </div>
              <div className="text-xs text-slate-500">
                {dashboardStats?.player_status.completion_percentage?.toFixed(1) || 0}% remaining
              </div>
            </div>
          </div>

          {/* Players Made Picks */}
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2">
                <UserGroupIcon className="h-5 w-5 text-slate-600" />
                <h3 className="text-lg font-semibold text-slate-900">Players Made Picks</h3>
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {dashboardStats?.pick_status.picks_made || 0}
              </div>
            </div>
            
            {/* Pie Chart */}
            <div className="flex items-center justify-center">
              <div className="relative w-32 h-32">
                <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 36 36">
                  {/* Background circle */}
                  <path
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth="3"
                  />
                  {/* Progress arc - dynamic percentage */}
                  <path
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="3"
                    strokeDasharray={`${dashboardStats?.pick_status.completion_percentage || 0}, 100`}
                    strokeLinecap="round"
                  />
                </svg>
                {/* Center text */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-xl font-bold text-slate-900">
                      {dashboardStats?.pick_status.completion_percentage?.toFixed(0) || 0}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-4 text-center">
              <div className="text-xs text-slate-500">
                {dashboardStats?.pick_status.picks_made || 0} of {dashboardStats?.pick_status.picks_required || 0} players
              </div>
            </div>
          </div>
        </div>

        {/* Competition Management Hub */}
        <div className="bg-white rounded-xl p-4 sm:p-6 lg:p-8 shadow-sm border border-slate-200">
          {competition.status === 'COMPLETE' ? (
            <>
              <div className="text-center mb-6 sm:mb-8">
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">Tournament Complete! 🎉</h3>
                <p className="text-sm sm:text-base text-slate-600">View final results and tournament summary</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-12">
                <Link
                  href={`/play/${competitionId}/standings?from=admin`}
                  className="group text-center hover:opacity-80 transition-opacity duration-200"
                >
                  <div className="mb-4">
                    <TrophyIcon className="h-12 w-12 text-slate-600 mx-auto group-hover:text-slate-800 transition-colors" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">Winner & Results</h3>
                  <p className="text-sm text-slate-600">View final standings and winner</p>
                </Link>
                
                <Link
                  href={`/competition/${competitionId}/players`}
                  className="group text-center hover:opacity-80 transition-opacity duration-200"
                >
                  <div className="mb-4">
                    <UserGroupIcon className="h-12 w-12 text-slate-600 mx-auto group-hover:text-slate-800 transition-colors" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">Players</h3>
                  <p className="text-sm text-slate-600">View and manage players</p>
                </Link>
                
                <Link
                  href={`/competition/${competitionId}/settings`}
                  className="group text-center hover:opacity-80 transition-opacity duration-200"
                >
                  <div className="mb-4">
                    <Cog6ToothIcon className="h-12 w-12 text-slate-600 mx-auto group-hover:text-slate-800 transition-colors" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">Settings</h3>
                  <p className="text-sm text-slate-600">Manage competition settings</p>
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="text-center mb-6 sm:mb-8">
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">Competition Management</h3>
                <p className="text-sm sm:text-base text-slate-600">Everything you need to manage your competition</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-12">
                <Link
                  href={`/competition/${competitionId}/manage`}
                  className="group text-center hover:opacity-80 transition-opacity duration-200"
                >
                  <div className="mb-4">
                    <CalendarDaysIcon className="h-12 w-12 text-slate-600 mx-auto group-hover:text-slate-800 transition-colors" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">Fixtures</h3>
                  <p className="text-sm text-slate-600">Manage rounds and fixtures</p>
                </Link>
                
                <Link
                  href={`/competition/${competitionId}/players`}
                  className="group text-center hover:opacity-80 transition-opacity duration-200"
                >
                  <div className="mb-4">
                    <UserGroupIcon className="h-12 w-12 text-slate-600 mx-auto group-hover:text-slate-800 transition-colors" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">Players</h3>
                  <p className="text-sm text-slate-600">View and manage players</p>
                </Link>
                
                <Link
                  href={`/play/${competitionId}/standings?from=admin`}
                  className="group text-center hover:opacity-80 transition-opacity duration-200"
                >
                  <div className="mb-4">
                    <ChartBarIcon className="h-12 w-12 text-slate-600 mx-auto group-hover:text-slate-800 transition-colors" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">Standings</h3>
                  <p className="text-sm text-slate-600">View competition results</p>
                </Link>
                
                <Link
                  href={`/competition/${competitionId}/settings`}
                  className="group text-center hover:opacity-80 transition-opacity duration-200"
                >
                  <div className="mb-4">
                    <Cog6ToothIcon className="h-12 w-12 text-slate-600 mx-auto group-hover:text-slate-800 transition-colors" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">Settings</h3>
                  <p className="text-sm text-slate-600">Manage competition settings</p>
                </Link>
              </div>
            </>
          )}
        </div>

      </main>
    </div>
  );
}