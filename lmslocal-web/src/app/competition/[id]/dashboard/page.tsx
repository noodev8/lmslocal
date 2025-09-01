'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  TrophyIcon,
  UserGroupIcon,
  ClockIcon,
  ChartBarIcon,
  ArrowLeftIcon,
  Cog6ToothIcon,
  CalendarDaysIcon,
  DocumentTextIcon,
  ArchiveBoxIcon
} from '@heroicons/react/24/outline';
import { competitionApi } from '@/lib/api';

// Simple Progress Chart Component
const ProgressChart = ({ 
  title, 
  value, 
  maxValue = 100, 
  color = "emerald", 
  showLabel = true,
  icon: Icon
}: {
  title: string;
  value: number;
  maxValue?: number;
  color?: string;
  showLabel?: boolean;
  icon?: any;
}) => {
  const percentage = Math.min((value / maxValue) * 100, 100);
  
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          {Icon && <Icon className="h-5 w-5 text-slate-600 mr-2" />}
          <h3 className="text-sm font-medium text-slate-700">{title}</h3>
        </div>
        {showLabel && (
          <span className={`text-lg font-bold text-${color}-600`}>{value}</span>
        )}
      </div>
      <div className="w-full bg-slate-200 rounded-full h-3">
        <div 
          className={`bg-${color}-500 h-3 rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {maxValue !== 100 && (
        <p className="text-xs text-slate-500 mt-2">of {maxValue}</p>
      )}
    </div>
  );
};

interface Competition {
  id: number;
  name: string;
  status: 'LOCKED' | 'UNLOCKED' | 'SETUP';
  player_count?: number;
  description?: string;
  invite_code?: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const params = useParams();
  const competitionId = params.id as string;

  const [competition, setCompetition] = useState<Competition | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentRound, setCurrentRound] = useState<any>(null);
  const [pickStatistics, setPickStatistics] = useState<any>(null);

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      router.push('/login');
      return;
    }

    loadCompetitionData();
  }, [competitionId, router]);

  const loadCompetitionData = async () => {
    try {
      // Load competition details
      const competitions = await competitionApi.getMyCompetitions();

      // Check competition access
      if (competitions.data.return_code === 'SUCCESS') {
        const comp = competitions.data.competitions.find(c => c.id.toString() === competitionId);
        if (comp && comp.is_organiser) {
          setCompetition(comp);
          
          // Try to get status, but don't fail if it doesn't work
          try {
            const status = await competitionApi.getStatus(parseInt(competitionId));
            if (status.data.return_code === 'SUCCESS') {
              setCurrentRound(status.data.current_round);
            }
          } catch (statusError) {
            console.warn('Could not load competition status:', statusError);
            // Continue without status - not critical for dashboard
          }

          // Try to get pick statistics
          try {
            const statistics = await competitionApi.getPickStatistics(parseInt(competitionId));
            if (statistics.data.return_code === 'SUCCESS') {
              setPickStatistics(statistics.data);
            }
          } catch (statsError) {
            console.warn('Could not load pick statistics:', statsError);
            // Continue without statistics - not critical for dashboard
          }
        } else {
          console.warn('Competition not found or no access');
          router.push('/dashboard');
          return;
        }
      } else {
        console.error('Failed to load competitions:', competitions.data);
        router.push('/dashboard');
        return;
      }

    } catch (error) {
      console.error('Failed to load competition data:', error);
      // Try to go back to dashboard instead of crashing
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
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
        
        <main className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
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
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link 
                href="/dashboard?from=competition" 
                className="flex items-center space-x-2 text-slate-600 hover:text-slate-800 transition-colors"
              >
                <ArrowLeftIcon className="h-5 w-5" />
                <span className="font-medium">Switch Competition</span>
              </Link>
              <div className="h-6 w-px bg-slate-300" />
              <div className="flex items-center space-x-3">
                <TrophyIcon className="h-6 w-6 text-blue-600" />
                <div>
                  <h1 className="text-lg font-semibold text-slate-900">Competition Dashboard</h1>
                  {competition && (
                    <p className="text-sm text-slate-500">{competition.name}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {/* Competition Info */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-2">{competition.name}</h2>
          {competition.description && (
            <p className="text-slate-600 mb-4">{competition.description}</p>
          )}
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2 text-slate-600">
              <UserGroupIcon className="h-5 w-5" />
              <span className="text-sm font-medium">{competition.player_count || 0} players</span>
            </div>
            {currentRound && (
              <div className="flex items-center space-x-2 text-slate-600">
                <ChartBarIcon className="h-5 w-5" />
                <span className="text-sm font-medium">Round {currentRound.round_number}</span>
              </div>
            )}
          </div>
        </div>

        {/* Progress Charts */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <ProgressChart
            title="Players Made Picks"
            value={pickStatistics ? pickStatistics.players_with_picks : 0}
            maxValue={pickStatistics ? pickStatistics.total_active_players : 1}
            color="emerald"
            icon={UserGroupIcon}
          />
          
          <ProgressChart
            title="Competition Progress"
            value={pickStatistics && pickStatistics.current_round ? pickStatistics.current_round.round_number : 0}
            maxValue={38}
            color="blue"
            icon={TrophyIcon}
          />
          
          <ProgressChart
            title="Pick Completion"
            value={pickStatistics ? pickStatistics.pick_percentage : 0}
            maxValue={100}
            color="amber"
            showLabel={true}
            icon={ClockIcon}
          />
        </div>

        {/* Competition Management Hub */}
        <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-200">
          {competition.status === 'COMPLETE' ? (
            <>
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Tournament Complete! 🎉</h3>
                <p className="text-slate-600">View final results and tournament summary</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <Link
                  href={`/play/${competitionId}/standings?from=admin`}
                  className="group p-6 bg-gradient-to-br from-yellow-50 to-yellow-100 hover:from-yellow-100 hover:to-yellow-200 rounded-xl text-left transition-all duration-200 border border-yellow-200 hover:border-yellow-300 transform hover:scale-105"
                >
                  <div className="flex items-center justify-center w-12 h-12 bg-yellow-600 rounded-lg mb-4 group-hover:bg-yellow-700 transition-colors">
                    <TrophyIcon className="h-6 w-6 text-white" />
                  </div>
                  <p className="text-lg font-semibold text-slate-900 mb-2">Winner & Results</p>
                  <p className="text-sm text-slate-600">View final standings and winner</p>
                </Link>
                
                <Link
                  href={`/competition/${competitionId}/players`}
                  className="group p-6 bg-gradient-to-br from-emerald-50 to-emerald-100 hover:from-emerald-100 hover:to-emerald-200 rounded-xl text-left transition-all duration-200 border border-emerald-200 hover:border-emerald-300 transform hover:scale-105"
                >
                  <div className="flex items-center justify-center w-12 h-12 bg-emerald-600 rounded-lg mb-4 group-hover:bg-emerald-700 transition-colors">
                    <UserGroupIcon className="h-6 w-6 text-white" />
                  </div>
                  <p className="text-lg font-semibold text-slate-900 mb-2">Players</p>
                  <p className="text-sm text-slate-600">View and manage players</p>
                </Link>
                
                <div className="group p-6 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl text-left border border-slate-200 opacity-60">
                  <div className="flex items-center justify-center w-12 h-12 bg-slate-400 rounded-lg mb-4">
                    <Cog6ToothIcon className="h-6 w-6 text-white" />
                  </div>
                  <p className="text-lg font-semibold text-slate-600 mb-2">Settings</p>
                  <p className="text-sm text-slate-500">Restart or copy competition</p>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Competition Management</h3>
                <p className="text-slate-600">Everything you need to manage your competition</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <Link
                  href={`/competition/${competitionId}/manage`}
                  className="group p-6 bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 rounded-xl text-left transition-all duration-200 border border-blue-200 hover:border-blue-300 transform hover:scale-105"
                >
                  <div className="flex items-center justify-center w-12 h-12 bg-blue-600 rounded-lg mb-4 group-hover:bg-blue-700 transition-colors">
                    <CalendarDaysIcon className="h-6 w-6 text-white" />
                  </div>
                  <p className="text-lg font-semibold text-slate-900 mb-2">Fixtures</p>
                  <p className="text-sm text-slate-600">Manage rounds and fixtures</p>
                </Link>
                
                <Link
                  href={`/competition/${competitionId}/players`}
                  className="group p-6 bg-gradient-to-br from-emerald-50 to-emerald-100 hover:from-emerald-100 hover:to-emerald-200 rounded-xl text-left transition-all duration-200 border border-emerald-200 hover:border-emerald-300 transform hover:scale-105"
                >
                  <div className="flex items-center justify-center w-12 h-12 bg-emerald-600 rounded-lg mb-4 group-hover:bg-emerald-700 transition-colors">
                    <UserGroupIcon className="h-6 w-6 text-white" />
                  </div>
                  <p className="text-lg font-semibold text-slate-900 mb-2">Players</p>
                  <p className="text-sm text-slate-600">View and manage players</p>
                </Link>
                
                <Link
                  href={`/play/${competitionId}/standings?from=admin`}
                  className="group p-6 bg-gradient-to-br from-amber-50 to-amber-100 hover:from-amber-100 hover:to-amber-200 rounded-xl text-left transition-all duration-200 border border-amber-200 hover:border-amber-300 transform hover:scale-105"
                >
                  <div className="flex items-center justify-center w-12 h-12 bg-amber-600 rounded-lg mb-4 group-hover:bg-amber-700 transition-colors">
                    <ChartBarIcon className="h-6 w-6 text-white" />
                  </div>
                  <p className="text-lg font-semibold text-slate-900 mb-2">Standings</p>
                  <p className="text-sm text-slate-600">View competition results</p>
                </Link>
                
                <div className="group p-6 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl text-left border border-slate-200 opacity-60">
                  <div className="flex items-center justify-center w-12 h-12 bg-slate-400 rounded-lg mb-4">
                    <Cog6ToothIcon className="h-6 w-6 text-white" />
                  </div>
                  <p className="text-lg font-semibold text-slate-600 mb-2">Settings</p>
                  <p className="text-sm text-slate-500">Coming soon</p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Competition Code - Only show for active competitions */}
        {competition.invite_code && competition.status !== 'COMPLETE' && (
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-blue-900 mb-1">Player Access Code</h3>
                <p className="text-blue-700">Share this code with players to join your competition</p>
              </div>
              <div className="text-right">
                <code className="text-2xl font-mono font-bold text-blue-600 tracking-wider">
                  {competition.invite_code}
                </code>
                <button
                  onClick={() => navigator.clipboard.writeText(competition.invite_code || '')}
                  className="block mt-2 text-sm text-blue-600 hover:text-blue-800"
                >
                  Click to copy
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}