'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  TrophyIcon,
  UserGroupIcon,
  ClockIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  PlusCircleIcon,
  XMarkIcon,
  PlayCircleIcon,
} from '@heroicons/react/24/outline';
import { userApi } from '@/lib/api';
import { logout } from '@/lib/auth';

interface User {
  id: number;
  display_name: string;
  email: string;
}

interface Competition {
  id: number;
  name: string;
  player_count?: number;
  active_players?: number;
  current_round?: number;
  total_rounds?: number;
  needs_pick?: boolean;
  my_pick?: string;
  is_organiser?: boolean;
  lives_remaining?: number;
  user_status?: string;
  is_locked?: boolean;
  current_round_lock_time?: string;
  current_pick?: {
    team: string;
    team_full_name: string;
    fixture: string;
  };
  is_complete?: boolean;
  winner?: {
    display_name: string;
  };
  total_players?: number;
}

export default function PlayerDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string>('');

  useEffect(() => {
    const token = localStorage.getItem('jwt_token');
    const userData = localStorage.getItem('user');
    
    if (!token || !userData) {
      router.push('/login');
      return;
    }

    try {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      loadPlayerCompetitions();
    } catch (error) {
      console.error('Error parsing user data:', error);
      router.push('/login');
      return;
    }
  }, [router]);

  const loadPlayerCompetitions = async () => {
    try {
      const response = await userApi.getPlayerDashboard();
      if (response.data.return_code === 'SUCCESS') {
        setCompetitions((response.data.competitions as Competition[]) || []);
      } else {
        console.error('Failed to load player competitions:', response.data.message);
        setCompetitions([]);
      }
    } catch (error) {
      console.error('Failed to load player competitions:', error);
      setCompetitions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout(router);
  };

  const handleJoinCompetition = async () => {
    if (joinCode.trim().length === 0) return;
    
    setJoinLoading(true);
    setJoinError('');
    
    try {
      const response = await userApi.joinCompetitionByCode(joinCode);
      
      if (response.data.return_code === 'SUCCESS') {
        setShowJoinDialog(false);
        setJoinCode('');
        setJoinError('');
        await loadPlayerCompetitions();
      } else {
        let errorMessage = response.data.message || 'Failed to join competition';
        
        if (response.data.return_code === 'COMPETITION_NOT_FOUND') {
          errorMessage = 'Competition not found with that code';
        } else if (response.data.return_code === 'COMPETITION_STARTED') {
          errorMessage = 'Competition has already started';
        } else if (response.data.return_code === 'ROUND_LOCKED') {
          errorMessage = 'Round 1 has already started';
        } else if (response.data.return_code === 'VALIDATION_ERROR') {
          errorMessage = 'Please enter a valid competition code';
        }
        
        setJoinError(errorMessage);
      }
    } catch (error: unknown) {
      console.error('Join competition error:', error);
      if ((error as {response?: {status: number}}).response?.status === 401) {
        setJoinError('Please login again');
      } else {
        setJoinError('Network error. Please try again.');
      }
    } finally {
      setJoinLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200 shadow-sm">
          <div className="px-4 sm:px-6">
            <div className="flex items-center justify-between h-14">
              <div className="flex items-center space-x-2">
                <TrophyIcon className="h-6 w-6 text-blue-600" />
                <h1 className="text-lg font-bold text-slate-900">LMSLocal</h1>
              </div>
            </div>
          </div>
        </header>
        <main className="p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-center">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-50 rounded-full mb-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent"></div>
                </div>
                <p className="text-slate-600">Loading competitions...</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Material 3 Header */}
      <header className="bg-white/95 backdrop-blur-sm border-b border-slate-200 shadow-sm">
        <div className="px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-slate-100 rounded-2xl">
                <TrophyIcon className="h-8 w-8 text-slate-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">LMSLocal</h1>
                <p className="text-sm text-slate-500">Last Man Standing</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Link
                href="/profile"
                className="flex items-center space-x-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all duration-200 hover:shadow-sm"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                  <span className="text-white text-sm font-semibold">
                    {user?.display_name?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
                <span className="text-sm text-slate-700 font-medium hidden sm:block">
                  {user?.display_name?.split(' ')[0] || 'Profile'}
                </span>
              </Link>
              <button
                onClick={handleLogout}
                className="px-4 py-3 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-50 rounded-2xl transition-all duration-200"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="px-6 py-8 pb-24 max-w-4xl mx-auto">
        {/* Material 3 Welcome Section */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-3 h-3 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full"></div>
            <h2 className="text-3xl font-bold text-slate-900">
              Welcome back, {user?.display_name?.split(' ')[0] || user?.display_name}
            </h2>
          </div>
          <p className="text-slate-600 text-lg ml-6">Your competitions and tournaments</p>
        </div>

        {/* Competition Cards - Material 3 Style */}
        {competitions.length > 0 ? (
          <div className="grid gap-6 mb-8">
            {competitions.map((competition) => (
              <Link
                key={competition.id}
                href={`/play/${competition.id}`}
                className="block bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300 hover:-translate-y-1 group"
              >
                <div className="p-6">
                  {/* Competition Header */}
                  <div className="flex items-start justify-between mb-5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="p-2 bg-slate-100 rounded-xl group-hover:bg-slate-200 transition-colors">
                          <TrophyIcon className="h-5 w-5 text-slate-600" />
                        </div>
                        <h3 className="font-bold text-slate-900 truncate text-xl">
                          {competition.name}
                        </h3>
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-slate-600">
                        <span className="flex items-center space-x-2 px-3 py-1.5 bg-slate-50 rounded-full">
                          <UserGroupIcon className="h-4 w-4" />
                          <span className="font-medium">{competition.active_players} players</span>
                        </span>
                        {competition.current_round && (
                          <span className="flex items-center space-x-2 px-3 py-1.5 bg-blue-50 rounded-full">
                            <ChartBarIcon className="h-4 w-4 text-blue-600" />
                            <span className="font-medium text-blue-700">Round {competition.current_round}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Material 3 Status Badge */}
                    {competition.user_status === 'OUT' ? (
                      <div className="flex items-center px-4 py-2 bg-gradient-to-r from-red-50 to-red-100 border border-red-200 text-red-700 rounded-2xl text-sm font-semibold shadow-sm">
                        <XMarkIcon className="h-4 w-4 mr-2" />
                        Eliminated
                      </div>
                    ) : competition.is_complete ? (
                      <div className="flex items-center px-4 py-2 bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 text-slate-700 rounded-2xl text-sm font-semibold shadow-sm">
                        <TrophyIcon className="h-4 w-4 mr-2" />
                        Complete
                      </div>
                    ) : competition.needs_pick ? (
                      <div className="flex items-center px-4 py-2 bg-gradient-to-r from-amber-50 to-orange-100 border border-orange-200 text-orange-700 rounded-2xl text-sm font-semibold shadow-sm animate-pulse">
                        <ExclamationTriangleIcon className="h-4 w-4 mr-2" />
                        Pick Now
                      </div>
                    ) : competition.is_locked ? (
                      <div className="flex items-center px-4 py-2 bg-gradient-to-r from-emerald-50 to-emerald-100 border border-emerald-200 text-emerald-700 rounded-2xl text-sm font-semibold shadow-sm">
                        <PlayCircleIcon className="h-4 w-4 mr-2" />
                        In Play
                      </div>
                    ) : (
                      <div className="flex items-center px-4 py-2 bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 text-blue-700 rounded-2xl text-sm font-semibold shadow-sm">
                        <ClockIcon className="h-4 w-4 mr-2" />
                        Waiting
                      </div>
                    )}
                  </div>

                  {/* Material 3 Quick Info */}
                  {competition.user_status !== 'OUT' && competition.current_round_lock_time && !competition.is_complete && (
                    <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl">
                      <div className="flex items-center space-x-2">
                        <ClockIcon className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-700">
                          Picks close: {new Date(competition.current_round_lock_time).toLocaleString('en-GB', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>
                  )}

                  {competition.user_status !== 'OUT' && competition.lives_remaining !== undefined && (
                    <div className="flex items-center justify-between mt-4 p-4 bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 rounded-2xl">
                      <span className="text-slate-700 font-semibold">Lives Remaining:</span>
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center space-x-1">
                          {Array.from({ length: Math.min(competition.lives_remaining, 5) }, (_, i) => (
                            <div key={i} className="w-3 h-3 bg-gradient-to-r from-red-500 to-red-600 rounded-full shadow-sm"></div>
                          ))}
                          {competition.lives_remaining > 5 && (
                            <span className="text-slate-600 ml-1 text-sm">+{competition.lives_remaining - 5}</span>
                          )}
                        </div>
                        <span className="font-bold text-slate-900 text-lg ml-2">
                          {competition.lives_remaining}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          /* Material 3 Empty State */
          <div className="text-center py-16 mb-8">
            <div className="mb-8">
              <div className="inline-flex items-center justify-center w-24 h-24 bg-slate-100 rounded-3xl shadow-sm mb-2">
                <TrophyIcon className="h-12 w-12 text-slate-600" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-4">Ready to Start Your First Competition?</h3>
            <p className="text-slate-600 text-lg mb-10 max-w-md mx-auto leading-relaxed">
              Create a Last Man Standing tournament and invite your friends, colleagues, or customers to join the excitement!
            </p>
            
            {/* Primary Create Competition Button */}
            <Link 
              href="/competition/create"
              className="inline-flex items-center px-8 py-4 bg-slate-800 text-white rounded-3xl text-lg font-semibold hover:bg-slate-900 transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1 mb-8"
            >
              Create Competition
            </Link>
            
            <div className="flex items-center justify-center space-x-3 mb-6">
              <div className="h-px bg-slate-300 flex-1 max-w-16"></div>
              <span className="text-slate-400 text-sm font-medium">or</span>
              <div className="h-px bg-slate-300 flex-1 max-w-16"></div>
            </div>
            
            {/* Secondary Join Button */}
            <button
              onClick={() => setShowJoinDialog(true)}
              className="inline-flex items-center px-6 py-3 bg-white border-2 border-slate-300 text-slate-700 rounded-3xl text-base font-semibold hover:bg-slate-50 hover:border-slate-400 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              Join Competition
            </button>
          </div>
        )}

        {/* Action Section for Existing Users */}
        {competitions.length > 0 && (
          <div className="grid sm:grid-cols-2 gap-4 mb-8">
            {/* Join Another Competition */}
            <button
              onClick={() => setShowJoinDialog(true)}
              className="flex items-center justify-center px-6 py-4 bg-white border-2 border-slate-300 text-slate-700 rounded-3xl font-semibold hover:bg-slate-50 hover:border-slate-400 transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5"
            >
              Join Another Competition
            </button>

            {/* Create Another Competition */}
            <Link 
              href="/competition/create"
              className="flex items-center justify-center px-6 py-4 bg-slate-800 text-white rounded-3xl font-semibold hover:bg-slate-900 transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5"
            >
              Create Competition
            </Link>
          </div>
        )}
      </main>

      {/* Material 3 Join Competition Modal */}
      {showJoinDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200">
            <div className="px-8 py-6 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-50 rounded-2xl">
                    <UserGroupIcon className="h-6 w-6 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Join Competition</h3>
                </div>
                <button
                  onClick={() => {
                    setShowJoinDialog(false);
                    setJoinCode('');
                    setJoinError('');
                  }}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-2xl transition-colors"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="px-8 py-6">
              <p className="text-slate-600 text-base mb-6">
                Enter your competition access code:
              </p>
              
              <input
                type="text"
                value={joinCode}
                onChange={(e) => {
                  setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                  setJoinError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && joinCode.trim().length > 0 && !joinLoading) {
                    handleJoinCompetition();
                  }
                }}
                placeholder="ABC123"
                className="w-full px-6 py-4 border-2 border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-xl font-mono tracking-widest font-semibold bg-slate-50 focus:bg-white transition-all"
                autoFocus
              />
              
              {joinError && (
                <div className="mt-4 p-4 bg-gradient-to-r from-red-50 to-red-100 border-2 border-red-200 rounded-2xl">
                  <p className="text-sm text-red-700 font-medium">{joinError}</p>
                </div>
              )}
            </div>
            
            <div className="px-8 py-6 bg-gradient-to-r from-slate-50 to-slate-100 rounded-b-3xl">
              <div className="flex space-x-4">
                <button
                  onClick={() => {
                    setShowJoinDialog(false);
                    setJoinCode('');
                    setJoinError('');
                  }}
                  className="flex-1 px-6 py-3 bg-white border-2 border-slate-300 text-slate-700 rounded-2xl font-semibold hover:bg-slate-50 hover:border-slate-400 transition-all duration-200"
                  disabled={joinLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleJoinCompetition}
                  disabled={joinCode.trim().length === 0 || joinLoading}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl font-semibold hover:from-blue-700 hover:to-blue-800 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  {joinLoading ? 'Joining...' : 'Join Competition'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}