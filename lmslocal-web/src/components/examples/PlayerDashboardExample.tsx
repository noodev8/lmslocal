'use client';

import { 
  TrophyIcon, 
  UserGroupIcon, 
  StarIcon, 
  ClockIcon,
  CheckCircleIcon,
  FireIcon
} from '@heroicons/react/24/outline';
import {
  ProgressChart,
  MiniBarChart,
  PlayerPerformanceChart,
  ActivityFeedChart,
  RoundProgressChart,
  QuickStatsGrid
} from '../charts/DashboardCharts';

// Example Player Dashboard Implementation
export default function PlayerDashboardExample() {
  // Example data - would come from your API
  const playerStats = [
    {
      title: 'Your Position',
      value: '7th',
      change: 2, // moved up 2 positions
      icon: TrophyIcon,
      color: 'emerald'
    },
    {
      title: 'Correct Picks',
      value: 9,
      change: 0, // no change from last round
      icon: CheckCircleIcon,
      color: 'blue'
    },
    {
      title: 'Current Streak',
      value: 3,
      change: 1, // +1 from last round
      icon: FireIcon,
      color: 'orange'
    },
    {
      title: 'Rounds Left',
      value: 26,
      icon: ClockIcon,
      color: 'purple'
    }
  ];

  const yourPerformanceData = [8, 7, 9, 8, 9, 10, 9]; // picks per round
  const leaderboardData = [
    { round: 1, playersRemaining: 40, completed: true },
    { round: 2, playersRemaining: 38, completed: true },
    { round: 3, playersRemaining: 35, completed: true },
    { round: 4, playersRemaining: 32, completed: true },
    { round: 5, playersRemaining: 28, completed: true },
    { round: 6, playersRemaining: 24, completed: false },
    { round: 7, playersRemaining: 0, completed: false },
    { round: 8, playersRemaining: 0, completed: false }
  ];

  const recentCompetitionActivity = [
    {
      id: '1',
      type: 'pick' as const,
      player: 'You',
      message: 'You picked Arsenal (Round 12)',
      timestamp: '10 minutes ago'
    },
    {
      id: '2',
      type: 'elimination' as const,
      player: 'John',
      message: 'John was eliminated (Liverpool lost)',
      timestamp: '1 hour ago'
    },
    {
      id: '3',
      type: 'result' as const,
      player: 'System',
      message: 'Round 11 results: Arsenal won 2-1',
      timestamp: '2 hours ago'
    },
    {
      id: '4',
      type: 'elimination' as const,
      player: 'Emma',
      message: 'Emma was eliminated (Chelsea drew)',
      timestamp: '3 hours ago'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header with Competition Info */}
        <div className="mb-8">
          <div className="bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-xl p-6">
            <h1 className="text-2xl font-bold mb-2">Premier League Last Man Standing</h1>
            <p className="text-slate-200 mb-4">The Crown & Anchor • Round 12 of 38</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className="px-3 py-1 bg-emerald-500 text-white text-sm font-medium rounded-full">
                  ✅ Still In
                </span>
                <span className="text-slate-200">24 players remaining</span>
              </div>
              <div className="text-right">
                <p className="text-slate-200 text-sm">Picks lock in:</p>
                <p className="text-white font-semibold">2h 34m</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mb-8">
          <QuickStatsGrid stats={playerStats} />
        </div>

        {/* Main Dashboard Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Your Performance - Spans 2 columns */}
          <div className="lg:col-span-2">
            <PlayerPerformanceChart
              playerName="You"
              roundsPlayed={12}
              roundsRemaining={26}
              correctPicks={9}
              status="active"
            />
          </div>

          {/* Competition Progress */}
          <div>
            <ProgressChart
              title="Competition Progress"
              value={12}
              maxValue={38}
              color="blue"
              showLabel={false}
              icon={TrophyIcon}
            />
          </div>
        </div>

        {/* Make Your Pick Section */}
        <div className="mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Round 12 - Make Your Pick</h3>
              <span className="text-sm text-slate-500">Picks lock in 2h 34m</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button className="p-4 bg-emerald-100 hover:bg-emerald-200 border-2 border-emerald-300 rounded-lg text-center transition-colors">
                <div className="font-semibold text-emerald-800">✓ Arsenal</div>
                <div className="text-xs text-emerald-600">vs Brighton (H)</div>
              </button>
              <button className="p-4 bg-slate-50 hover:bg-slate-100 border-2 border-slate-200 rounded-lg text-center transition-colors">
                <div className="font-semibold text-slate-800">Chelsea</div>
                <div className="text-xs text-slate-600">vs Liverpool (A)</div>
              </button>
              <button className="p-4 bg-slate-50 hover:bg-slate-100 border-2 border-slate-200 rounded-lg text-center transition-colors">
                <div className="font-semibold text-slate-800">Man City</div>
                <div className="text-xs text-slate-600">vs Spurs (H)</div>
              </button>
              <button className="p-4 bg-slate-50 hover:bg-slate-100 border-2 border-slate-200 rounded-lg text-center transition-colors">
                <div className="font-semibold text-slate-800">Newcastle</div>
                <div className="text-xs text-slate-600">vs Villa (A)</div>
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-3">
              You've already used: Liverpool, Man United, Brighton, Leicester, West Ham, Everton, Wolves, Crystal Palace, Burnley
            </p>
          </div>
        </div>

        {/* Secondary Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Tournament Progress */}
          <div>
            <RoundProgressChart
              currentRound={12}
              totalRounds={38}
              roundsData={leaderboardData}
            />
          </div>

          {/* Your Pick History */}
          <div>
            <MiniBarChart
              data={yourPerformanceData}
              title="Your Recent Performance"
              color="emerald"
              height="h-20"
            />
          </div>

          {/* Competition Activity */}
          <div>
            <ActivityFeedChart activities={recentCompetitionActivity} />
          </div>
        </div>

        {/* Leaderboard Section */}
        <div className="mt-8 bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Current Standings</h3>
          <div className="space-y-2">
            {[
              { position: 1, name: 'Mike Johnson', picks: 12, streak: 5, status: 'active' },
              { position: 2, name: 'Sarah Connor', picks: 12, streak: 3, status: 'active' },
              { position: 3, name: 'David Smith', picks: 11, streak: 2, status: 'active' },
              { position: 4, name: 'Emma Wilson', picks: 11, streak: 1, status: 'active' },
              { position: 5, name: 'James Brown', picks: 10, streak: 4, status: 'active' },
              { position: 6, name: 'Lisa Taylor', picks: 10, streak: 1, status: 'active' },
              { position: 7, name: 'You', picks: 9, streak: 3, status: 'active' },
              { position: 8, name: 'Tom Wilson', picks: 9, streak: 2, status: 'active' }
            ].map((player, index) => (
              <div 
                key={index} 
                className={`flex items-center justify-between p-3 rounded-lg ${
                  player.name === 'You' ? 'bg-blue-50 border-2 border-blue-200' : 'bg-slate-50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    player.position <= 3 ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {player.position}
                  </div>
                  <div>
                    <p className={`font-medium ${player.name === 'You' ? 'text-blue-900' : 'text-slate-900'}`}>
                      {player.name}
                    </p>
                    <p className="text-xs text-slate-500">{player.picks} correct picks</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {player.streak > 0 && (
                    <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded">
                      🔥 {player.streak}
                    </span>
                  )}
                  <span className="text-emerald-600 text-sm font-medium">Active</span>
                </div>
              </div>
            ))}
          </div>
          <button className="mt-4 text-sm text-slate-600 hover:text-slate-900">
            View Full Leaderboard →
          </button>
        </div>
      </div>
    </div>
  );
}