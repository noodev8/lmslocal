'use client';

import { 
  TrophyIcon, 
  UserGroupIcon, 
  ClockIcon, 
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import {
  ProgressChart,
  MiniBarChart,
  CompetitionStatusChart,
  ActivityFeedChart,
  RoundProgressChart,
  QuickStatsGrid
} from '../charts/DashboardCharts';

// Example Admin Dashboard Implementation
export default function AdminDashboardExample() {
  // Example data - would come from your API
  const competitionStats = [
    {
      title: 'Active Players',
      value: 24,
      change: 8,
      icon: UserGroupIcon,
      color: 'emerald'
    },
    {
      title: 'Current Round',
      value: 12,
      icon: ClockIcon,
      color: 'blue'
    },
    {
      title: 'Total Rounds',
      value: 38,
      icon: TrophyIcon,
      color: 'amber'
    },
    {
      title: 'Completion',
      value: '32%',
      change: 12,
      icon: ChartBarIcon,
      color: 'purple'
    }
  ];

  const weeklyPlayerActivity = [12, 18, 15, 22, 24, 19, 21];
  const roundsData = [
    { round: 1, playersRemaining: 40, completed: true },
    { round: 2, playersRemaining: 38, completed: true },
    { round: 3, playersRemaining: 35, completed: true },
    { round: 4, playersRemaining: 32, completed: true },
    { round: 5, playersRemaining: 28, completed: true },
    { round: 6, playersRemaining: 24, completed: false },
    { round: 7, playersRemaining: 0, completed: false },
    { round: 8, playersRemaining: 0, completed: false }
  ];

  const recentActivities = [
    {
      id: '1',
      type: 'pick' as const,
      player: 'Mike',
      message: 'Mike picked Arsenal (Round 12)',
      timestamp: '2 minutes ago'
    },
    {
      id: '2',
      type: 'join' as const,
      player: 'Sarah',
      message: 'Sarah joined the competition',
      timestamp: '5 minutes ago'
    },
    {
      id: '3',
      type: 'elimination' as const,
      player: 'John',
      message: 'John was eliminated (Liverpool lost)',
      timestamp: '1 hour ago'
    },
    {
      id: '4',
      type: 'result' as const,
      player: 'System',
      message: 'Round 11 results updated',
      timestamp: '2 hours ago'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-slate-600">Premier League Last Man Standing - The Crown & Anchor</p>
        </div>

        {/* Quick Stats */}
        <div className="mb-8">
          <QuickStatsGrid stats={competitionStats} />
        </div>

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Competition Status - Spans 2 columns */}
          <div className="lg:col-span-2">
            <CompetitionStatusChart
              totalPlayers={40}
              remainingPlayers={24}
              eliminatedPlayers={16}
              currentRound={12}
            />
          </div>

          {/* Player Activity Progress */}
          <div>
            <ProgressChart
              title="Players Made Picks"
              value={18}
              maxValue={24}
              color="emerald"
              icon={UserGroupIcon}
            />
          </div>
        </div>

        {/* Secondary Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Round Progress */}
          <div>
            <RoundProgressChart
              currentRound={12}
              totalRounds={38}
              roundsData={roundsData}
            />
          </div>

          {/* Weekly Activity Chart */}
          <div>
            <MiniBarChart
              data={weeklyPlayerActivity}
              title="Weekly Player Activity"
              color="blue"
              height="h-20"
            />
          </div>

          {/* Recent Activity Feed */}
          <div>
            <ActivityFeedChart activities={recentActivities} />
          </div>
        </div>

        {/* Admin Actions */}
        <div className="mt-8 bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button className="p-4 bg-slate-50 hover:bg-slate-100 rounded-lg text-left transition-colors">
              <TrophyIcon className="h-6 w-6 text-slate-600 mb-2" />
              <p className="text-sm font-medium text-slate-900">Update Results</p>
              <p className="text-xs text-slate-500">Post round results</p>
            </button>
            <button className="p-4 bg-slate-50 hover:bg-slate-100 rounded-lg text-left transition-colors">
              <UserGroupIcon className="h-6 w-6 text-slate-600 mb-2" />
              <p className="text-sm font-medium text-slate-900">Manage Players</p>
              <p className="text-xs text-slate-500">Add or remove players</p>
            </button>
            <button className="p-4 bg-slate-50 hover:bg-slate-100 rounded-lg text-left transition-colors">
              <ClockIcon className="h-6 w-6 text-slate-600 mb-2" />
              <p className="text-sm font-medium text-slate-900">Lock Picks</p>
              <p className="text-xs text-slate-500">Manually lock round</p>
            </button>
            <button className="p-4 bg-slate-50 hover:bg-slate-100 rounded-lg text-left transition-colors">
              <ChartBarIcon className="h-6 w-6 text-slate-600 mb-2" />
              <p className="text-sm font-medium text-slate-900">View Reports</p>
              <p className="text-xs text-slate-500">Detailed analytics</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}