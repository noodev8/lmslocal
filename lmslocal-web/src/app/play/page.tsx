'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  TrophyIcon,
  UserGroupIcon,
  CheckCircleIcon,
  ClockIcon,
  StarIcon,
  FireIcon,
  CogIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  PlusCircleIcon,
  XMarkIcon
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
  user_status?: string; // User participation status: 'active', 'eliminated', etc.
  is_locked?: boolean;
  current_round_lock_time?: string;
  current_pick?: {
    team: string;
    team_full_name: string;
    fixture: string;
  };
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
    // Check authentication
    const token = localStorage.getItem('jwt_token');
    const userData = localStorage.getItem('user');
    
    if (!token || !userData) {
      router.push('/login');
      return;
    }

    try {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      
      // Load player competitions from API
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
        // Success - close dialog and refresh competitions
        setShowJoinDialog(false);
        setJoinCode('');
        setJoinError('');
        await loadPlayerCompetitions(); // Refresh the page data
      } else {
        // Handle error return codes from our API
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
      
      // Only network errors should reach here now
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Link href="/" className="flex items-center">
                <TrophyIcon className="h-8 w-8 text-blue-600" />
                <span className="ml-2 text-xl font-bold text-gray-900">LMSLocal</span>
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Welcome back, <span className="font-medium text-gray-900">{user?.display_name}</span>
              </span>
              <Link
                href="/profile"
                className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md"
              >
                Profile
              </Link>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header with Competition Selection */}
        <div className="mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center">
                <TrophyIcon className="h-8 w-8 text-blue-600 mr-4" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Welcome back, {user?.display_name}!</h1>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowJoinDialog(true)}
                  className="flex items-center text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  <PlusCircleIcon className="h-4 w-4 mr-1" />
                  Join Competition
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Competition Selector */}
        {competitions.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Competitions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {competitions.map((competition) => {
                const CardComponent = Link; // Always make it clickable to view current pick
                
                return (
                  <CardComponent
                    key={competition.id}
                    href={`/play/${competition.id}`}
                    className={`block p-6 rounded-lg border cursor-pointer transition-all ${
                      competition.is_complete 
                        ? 'border-yellow-300 bg-gradient-to-br from-yellow-50 to-amber-50 hover:border-yellow-400 hover:shadow-lg'
                        : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className={`text-lg font-semibold truncate ${
                        competition.is_complete ? 'text-yellow-900' : 'text-gray-900'
                      }`}>
                        {competition.is_complete && '🏆 '}{competition.name}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        competition.is_complete 
                          ? 'bg-yellow-200 text-yellow-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {competition.is_complete ? 'Complete' : 'Active'}
                      </span>
                    </div>
                    
                    <div className="space-y-2 text-sm mb-4">
                      {competition.is_complete ? (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-yellow-700">Winner:</span>
                            <span className="font-bold text-yellow-900">
                              {competition.winner?.display_name || 'Unknown'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-yellow-700">Players:</span>
                            <span className="font-medium text-yellow-800">
                              1 of {competition.total_players} remaining
                            </span>
                          </div>
                        </div>
                      ) : (
                        <>
                          {competition.current_round && (
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Current Round</span>
                              <span className="font-medium text-gray-900">{competition.current_round}</span>
                            </div>
                          )}
                          {competition.current_round_lock_time && (
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Lock Time</span>
                              <span className="font-medium text-xs text-gray-900">
                                {new Date(competition.current_round_lock_time).toLocaleString('en-GB', {
                                  year: 'numeric',
                                  month: '2-digit', 
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: false
                                }).replace(',', '')}
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    
                    {competition.is_complete ? (
                      <div className="flex items-center justify-center bg-yellow-100 border border-yellow-300 rounded-lg p-3">
                        <TrophyIcon className="h-4 w-4 text-yellow-700 mr-2" />
                        <span className="text-sm font-bold text-yellow-800">Competition Complete!</span>
                      </div>
                    ) : competition.is_locked ? (
                      <div className="flex items-center justify-center bg-green-50 border border-green-200 rounded-lg p-3">
                        <FireIcon className="h-4 w-4 text-green-600 mr-2" />
                        <span className="text-sm font-medium text-green-700">In Play</span>
                      </div>
                    ) : competition.needs_pick ? (
                      <div className="flex items-center justify-center bg-orange-50 border border-orange-200 rounded-lg p-3">
                        <ExclamationTriangleIcon className="h-4 w-4 text-orange-600 mr-2" />
                        <span className="text-sm font-medium text-orange-800">Pick Required</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <ClockIcon className="h-4 w-4 text-blue-600 mr-2" />
                        <span className="text-sm font-medium text-blue-800">Waiting</span>
                      </div>
                    )}
                  </CardComponent>
                );
              })}
            </div>
          </div>
        )}

        {/* Show message if no competitions */}
        {competitions.length === 0 && (
          <div className="text-center py-12">
            <UserGroupIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">No Competitions Yet</h3>
            <p className="text-gray-600 mb-6">Use the "Join Competition" link above to get started!</p>
          </div>
        )}

        {/* Become an Organizer Banner */}
        <div className="mb-8">
          <div className={`rounded-lg border transition-all ${
            competitions.length > 0 
              ? 'bg-gray-50 border-gray-200 p-4' // Subtle styling for existing players
              : 'bg-gradient-to-r from-green-50 to-blue-50 border-green-200 p-6' // Prominent for new users
          }`}>
            <div className="flex items-start">
              {competitions.length === 0 && (
                <div className="flex-shrink-0">
                  <div className="bg-green-100 rounded-full p-2">
                    <TrophyIcon className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              )}
              <div className={`flex-grow ${competitions.length === 0 ? 'ml-4' : ''}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                  <div>
                    <h3 className={`font-semibold mb-2 ${
                      competitions.length > 0 
                        ? 'text-sm text-gray-700' // Smaller, muted for existing players
                        : 'text-lg text-green-900' // Large, prominent for new users
                    }`}>
                      Want to organize your own competition?
                    </h3>
                    {competitions.length === 0 && (
                      <p className="text-sm text-green-800 mb-3">
                        Create engaging Last Man Standing competitions for your pub, workplace, or club. 
                        Setup takes just 5 minutes and brings people together around the excitement of football!
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    <Link 
                      href="/competition/create"
                      className={`inline-flex items-center rounded-lg font-medium transition-colors ${
                        competitions.length > 0
                          ? 'px-3 py-1 text-xs bg-gray-200 text-gray-600 hover:bg-gray-300 hover:text-gray-700' // Small, subtle button
                          : 'px-4 py-2 bg-green-600 text-white hover:bg-green-700 shadow-sm' // Large, prominent button
                      }`}
                    >
                      <PlusCircleIcon className={competitions.length > 0 ? 'h-3 w-3 mr-1' : 'h-4 w-4 mr-2'} />
                      Create Competition
                    </Link>
                  </div>
                </div>
                {competitions.length === 0 && (
                  <div className="flex items-center text-xs text-green-700 mt-2">
                    <span className="mr-4">✓ Easy setup wizard</span>
                    <span className="mr-4">✓ Automatic scoring</span>
                    <span>✓ Player management tools</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
      </main>

      {/* Join Competition Dialog */}
      {showJoinDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Join Competition</h3>
                <button
                  onClick={() => {
                    setShowJoinDialog(false);
                    setJoinCode('');
                    setJoinError('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              
              <p className="text-sm text-gray-600 mb-4">
                Enter the competition code to join:
              </p>
              
              <input
                type="text"
                value={joinCode}
                onChange={(e) => {
                  setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                  setJoinError(''); // Clear error when user starts typing
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && joinCode.trim().length > 0 && !joinLoading) {
                    handleJoinCompetition();
                  }
                }}
                placeholder="1234"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-lg font-mono tracking-widest"
                autoFocus
              />
              
              {joinError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{joinError}</p>
                </div>
              )}
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowJoinDialog(false);
                    setJoinCode('');
                    setJoinError('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  disabled={joinLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleJoinCompetition}
                  disabled={joinCode.trim().length === 0 || joinLoading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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