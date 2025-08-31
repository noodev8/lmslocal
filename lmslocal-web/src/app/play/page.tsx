'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  TrophyIcon,
  UserGroupIcon,
  CheckCircleIcon,
  ClockIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  PlusCircleIcon,
  XMarkIcon,
  PlayCircleIcon,
  FireIcon
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
        setCompetitions(response.data.competitions || []);
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
    } catch (error: any) {
      console.error('Join competition error:', error);
      if (error.response?.status === 401) {
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
    <div className="min-h-screen bg-slate-50">
      {/* Mobile-First Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center space-x-2">
              <TrophyIcon className="h-6 w-6 text-blue-600" />
              <h1 className="text-lg font-bold text-slate-900">LMSLocal</h1>
            </div>
            <div className="flex items-center space-x-1">
              <Link
                href="/profile"
                className="text-xs text-slate-600 hover:text-slate-800 px-2 py-1 rounded"
              >
                Profile
              </Link>
              <button
                onClick={handleLogout}
                className="text-xs text-slate-600 hover:text-slate-800 px-2 py-1 rounded"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="p-4 pb-20">
        {/* Quick Welcome - Mobile Optimized */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-900 mb-1">
            Hi {user?.display_name?.split(' ')[0] || user?.display_name}
          </h2>
          <p className="text-slate-600 text-sm">Your competitions</p>
        </div>

        {/* Competitions List - Mobile Optimized */}
        {competitions.length > 0 ? (
          <div className="space-y-4 mb-8">
            {competitions.map((competition) => (
              <Link
                key={competition.id}
                href={`/play/${competition.id}`}
                className="block bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all"
              >
                <div className="p-5">
                  {/* Competition Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 truncate text-lg">
                        {competition.name}
                      </h3>
                      <div className="flex items-center space-x-3 mt-2 text-sm text-slate-600">
                        <span className="flex items-center">
                          <UserGroupIcon className="h-4 w-4 mr-1" />
                          {competition.player_count}
                        </span>
                        {competition.current_round && (
                          <span className="flex items-center">
                            <ChartBarIcon className="h-4 w-4 mr-1" />
                            Round {competition.current_round}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Status Badge */}
                    {competition.is_complete ? (
                      <div className="flex items-center px-3 py-1.5 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
                        <TrophyIcon className="h-4 w-4 mr-1" />
                        Complete
                      </div>
                    ) : competition.needs_pick ? (
                      <div className="flex items-center px-3 py-1.5 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                        <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                        Pick Now
                      </div>
                    ) : competition.is_locked ? (
                      <div className="flex items-center px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium">
                        <PlayCircleIcon className="h-4 w-4 mr-1" />
                        In Play
                      </div>
                    ) : (
                      <div className="flex items-center px-3 py-1.5 bg-slate-100 text-slate-600 rounded-full text-sm font-medium">
                        <ClockIcon className="h-4 w-4 mr-1" />
                        Waiting
                      </div>
                    )}
                  </div>

                  {/* Quick Info - Only show most important */}
                  {competition.current_round_lock_time && !competition.is_complete && (
                    <div className="text-sm text-slate-600 mb-3">
                      Picks close: {new Date(competition.current_round_lock_time).toLocaleString('en-GB', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  )}

                  {competition.lives_remaining !== undefined && (
                    <div className="flex items-center justify-between mt-3 text-sm">
                      <span className="text-slate-600 font-medium">Lives:</span>
                      <div className="flex items-center space-x-1">
                        {Array.from({ length: Math.min(competition.lives_remaining, 5) }, (_, i) => (
                          <div key={i} className="w-2.5 h-2.5 bg-red-500 rounded-full"></div>
                        ))}
                        {competition.lives_remaining > 5 && (
                          <span className="text-slate-600 ml-1">+{competition.lives_remaining - 5}</span>
                        )}
                        <span className="font-semibold text-slate-900 ml-2 text-base">
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
          /* Empty State - Simple */
          <div className="text-center py-12 mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4">
              <UserGroupIcon className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">No competitions yet</h3>
            <p className="text-slate-500 text-sm mb-6">
              Ask your organizer for a competition code to get started
            </p>
          </div>
        )}

        {/* Join Competition CTA - At bottom, smaller */}
        <div className="mb-6">
          <button
            onClick={() => setShowJoinDialog(true)}
            className="w-full flex items-center justify-center px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <PlusCircleIcon className="h-4 w-4 mr-2" />
            Join Competition
          </button>
        </div>

        {/* Subtle Organizer CTA - Only show if they have competitions */}
        {competitions.length > 0 && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <div className="text-center">
              <p className="text-xs text-slate-600 mb-1">Want to organize your own?</p>
              <Link 
                href="/competition/create"
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                Create competition →
              </Link>
            </div>
          </div>
        )}
      </main>

      {/* Join Competition Modal - Mobile Optimized */}
      {showJoinDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">Join Competition</h3>
                <button
                  onClick={() => {
                    setShowJoinDialog(false);
                    setJoinCode('');
                    setJoinError('');
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="px-6 py-4">
              <p className="text-slate-600 text-sm mb-4">
                Enter your competition code:
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
                placeholder="1234"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-lg font-mono tracking-widest"
                autoFocus
              />
              
              {joinError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{joinError}</p>
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 bg-slate-50 rounded-b-2xl">
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowJoinDialog(false);
                    setJoinCode('');
                    setJoinError('');
                  }}
                  className="flex-1 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50"
                  disabled={joinLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleJoinCompetition}
                  disabled={joinCode.trim().length === 0 || joinLoading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  {joinLoading ? 'Joining...' : 'Join'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}