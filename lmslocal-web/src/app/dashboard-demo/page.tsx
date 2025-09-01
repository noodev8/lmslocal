'use client';

import { useState } from 'react';
import AdminDashboardExample from '../../components/examples/AdminDashboardExample';
import PlayerDashboardExample from '../../components/examples/PlayerDashboardExample';

export default function DashboardDemo() {
  const [activeView, setActiveView] = useState<'admin' | 'player'>('admin');

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Navigation Header */}
      <div className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Dashboard Demo</h1>
              <p className="text-slate-600">Preview of admin and player dashboard experiences</p>
            </div>
            <div className="flex rounded-lg bg-slate-100 p-1">
              <button
                onClick={() => setActiveView('admin')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeView === 'admin'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Admin View
              </button>
              <button
                onClick={() => setActiveView('player')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeView === 'player'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Player View
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="transition-opacity duration-300">
        {activeView === 'admin' ? (
          <AdminDashboardExample />
        ) : (
          <PlayerDashboardExample />
        )}
      </div>

      {/* Info Footer */}
      <div className="bg-white border-t border-slate-200 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Chart Components Available
            </h3>
            <p className="text-slate-600 mb-4">
              All charts are built with TypeScript and designed for both admin and player dashboards
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="bg-slate-50 rounded-lg p-3">
                <strong>ProgressChart</strong><br/>
                Progress bars with icons
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <strong>MiniBarChart</strong><br/>
                Compact activity charts
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <strong>QuickStatsGrid</strong><br/>
                Overview statistics
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <strong>ActivityFeedChart</strong><br/>
                Real-time activity feed
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <strong>CompetitionStatusChart</strong><br/>
                Tournament overview
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <strong>PlayerPerformanceChart</strong><br/>
                Individual player stats
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <strong>RoundProgressChart</strong><br/>
                Round-by-round progress
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <strong>All Responsive</strong><br/>
                Mobile & desktop ready
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}