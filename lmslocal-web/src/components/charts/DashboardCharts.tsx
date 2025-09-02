'use client';

import { TrophyIcon, UserGroupIcon, ClockIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

// Enhanced Chart Components for Admin & Player Dashboards
export interface ChartData {
  label: string;
  value: number;
  color?: string;
  maxValue?: number;
}

// Progress Bar Chart (like Active Players from landing page)
export const ProgressChart = ({ 
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
  icon?: React.ComponentType<{ className?: string }>;
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

// Mini Bar Chart (like from landing page stats)
export const MiniBarChart = ({ 
  data, 
  title, 
  color = "slate",
  height = "h-16" 
}: {
  data: number[];
  title: string;
  color?: string;
  height?: string;
}) => {
  const max = Math.max(...data);
  
  return (
    <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
      <h4 className="text-sm font-medium text-slate-600 mb-3">{title}</h4>
      <div className={`flex items-end space-x-1 ${height}`}>
        {data.map((value, i) => (
          <div
            key={i}
            className={`bg-${color}-500 rounded-sm flex-1 transition-all duration-300`}
            style={{ height: `${(value / max) * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
};

// Competition Status Chart
export const CompetitionStatusChart = ({
  totalPlayers,
  remainingPlayers,
  eliminatedPlayers,
  currentRound
}: {
  totalPlayers: number;
  remainingPlayers: number;
  eliminatedPlayers: number;
  currentRound: number;
}) => {
  const remainingPercentage = (remainingPlayers / totalPlayers) * 100;
  
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Competition Status</h3>
        <span className="text-sm text-slate-500">Round {currentRound}</span>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="text-center">
          <div className="text-2xl font-bold text-emerald-600">{remainingPlayers}</div>
          <p className="text-sm text-slate-600">Still In</p>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-500">{eliminatedPlayers}</div>
          <p className="text-sm text-slate-600">Eliminated</p>
        </div>
      </div>
      
      <div className="w-full bg-slate-200 rounded-full h-4">
        <div 
          className="bg-emerald-500 h-4 rounded-full transition-all duration-500"
          style={{ width: `${remainingPercentage}%` }}
        />
      </div>
      <p className="text-xs text-slate-500 mt-2">
        {remainingPercentage.toFixed(1)}% remaining
      </p>
    </div>
  );
};

// Recent Activity Feed Chart
export const ActivityFeedChart = ({
  activities
}: {
  activities: Array<{
    id: string;
    type: 'pick' | 'elimination' | 'join' | 'result';
    player: string;
    message: string;
    timestamp: string;
  }>;
}) => {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'pick': return <CheckCircleIcon className="h-4 w-4 text-blue-500" />;
      case 'elimination': return <XCircleIcon className="h-4 w-4 text-red-500" />;
      case 'join': return <UserGroupIcon className="h-4 w-4 text-green-500" />;
      case 'result': return <TrophyIcon className="h-4 w-4 text-amber-500" />;
      default: return <ClockIcon className="h-4 w-4 text-slate-500" />;
    }
  };
  
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">Recent Activity</h3>
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {activities.map((activity) => (
          <div key={activity.id} className="flex items-start space-x-3">
            {getActivityIcon(activity.type)}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-700">{activity.message}</p>
              <p className="text-xs text-slate-500">{activity.timestamp}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Player Performance Chart (for individual player dashboard)
export const PlayerPerformanceChart = ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  playerName,
  roundsPlayed,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  roundsRemaining,
  correctPicks,
  status
}: {
  playerName: string;
  roundsPlayed: number;
  roundsRemaining: number;
  correctPicks: number;
  status: 'active' | 'eliminated';
}) => {
  const successRate = roundsPlayed > 0 ? (correctPicks / roundsPlayed) * 100 : 0;
  
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Your Performance</h3>
        <span className={`px-3 py-1 text-sm font-medium rounded-full ${
          status === 'active' 
            ? 'bg-emerald-100 text-emerald-700' 
            : 'bg-red-100 text-red-700'
        }`}>
          {status === 'active' ? '✅ Still In' : '❌ Eliminated'}
        </span>
      </div>
      
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <div className="text-xl font-bold text-slate-800">{correctPicks}</div>
          <p className="text-xs text-slate-600">Correct Picks</p>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-slate-800">{roundsPlayed}</div>
          <p className="text-xs text-slate-600">Rounds Played</p>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-emerald-600">{successRate.toFixed(0)}%</div>
          <p className="text-xs text-slate-600">Success Rate</p>
        </div>
      </div>
      
      <div className="w-full bg-slate-200 rounded-full h-2">
        <div 
          className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
          style={{ width: `${successRate}%` }}
        />
      </div>
    </div>
  );
};

// Round Progress Chart
export const RoundProgressChart = ({
  currentRound,
  totalRounds,
  roundsData
}: {
  currentRound: number;
  totalRounds: number;
  roundsData: Array<{
    round: number;
    playersRemaining: number;
    completed: boolean;
  }>;
}) => {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Tournament Progress</h3>
        <span className="text-sm text-slate-500">Round {currentRound} of {totalRounds}</span>
      </div>
      
      <div className="space-y-3">
        {roundsData.slice(0, 8).map((round) => (
          <div key={round.round} className="flex items-center space-x-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              round.completed 
                ? 'bg-emerald-500 text-white' 
                : round.round === currentRound
                ? 'bg-blue-500 text-white'
                : 'bg-slate-200 text-slate-600'
            }`}>
              {round.round}
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-700">
                  Round {round.round}
                </span>
                <span className="text-sm text-slate-500">
                  {round.playersRemaining} players
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-1 mt-1">
                <div 
                  className={`h-1 rounded-full ${
                    round.completed 
                      ? 'bg-emerald-500' 
                      : round.round === currentRound
                      ? 'bg-blue-500'
                      : 'bg-slate-200'
                  }`}
                  style={{ 
                    width: round.completed ? '100%' : round.round === currentRound ? '50%' : '0%' 
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Quick Stats Grid (for overview dashboards)
export const QuickStatsGrid = ({
  stats
}: {
  stats: Array<{
    title: string;
    value: string | number;
    change?: number;
    icon: React.ComponentType<{ className?: string }>;
    color?: string;
  }>;
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div key={index} className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center">
              <div className={`p-3 rounded-lg bg-${stat.color || 'slate'}-100`}>
                <Icon className={`h-6 w-6 text-${stat.color || 'slate'}-600`} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-600">{stat.title}</p>
                <div className="flex items-center">
                  <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                  {stat.change !== undefined && (
                    <span className={`ml-2 text-sm font-medium ${
                      stat.change > 0 ? 'text-emerald-600' : stat.change < 0 ? 'text-red-600' : 'text-slate-500'
                    }`}>
                      {stat.change > 0 ? '+' : ''}{stat.change}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};