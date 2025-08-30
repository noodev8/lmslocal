'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  TrophyIcon, 
  PlusIcon, 
  UserGroupIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowRightIcon,
  Cog6ToothIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  UsersIcon
} from '@heroicons/react/24/outline';
import { competitionApi, userApi } from '@/lib/api';
import { logout } from '@/lib/auth';

interface Competition {
  id: number;
  name: string;
  status: 'LOCKED' | 'UNLOCKED' | 'SETUP';
  player_count?: number;
  current_round?: number;
  total_rounds?: number;
  organiser_id: number;
  created_at: string;
  needs_pick?: boolean;
  my_pick?: string;
  is_organiser?: boolean;
  invite_code?: string;
  slug?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [organizedCompetitions, setOrganizedCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCompetitionId, setNewCompetitionId] = useState<string | null>(null);
  const [userType, setUserType] = useState<string | null>(null);

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem('jwt_token');
    const userData = localStorage.getItem('user');
    
    if (!token || !userData || userData === 'undefined' || userData === 'null') {
      router.push('/login');
      return;
    }

    try {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
    } catch (error) {
      console.error('Failed to parse user data:', error);
      localStorage.removeItem('jwt_token');
      localStorage.removeItem('user');
      router.push('/login');
      return;
    }
    
    // Check if we just created a new competition
    const newCompId = localStorage.getItem('new_competition_id');
    if (newCompId) {
      setNewCompetitionId(newCompId);
      // Clear it after showing
      localStorage.removeItem('new_competition_id');
    }
    
    // Check user type for smart routing
    checkUserTypeAndRoute();
  }, [router]);

  const checkUserTypeAndRoute = async () => {
    try {
      const response = await userApi.checkUserType();
      if (response.data.return_code === 'SUCCESS') {
        const { user_type, suggested_route, has_organized } = response.data;
        setUserType(user_type);
        
        // Smart routing logic
        if (user_type === 'player' && !has_organized) {
          // Pure player - redirect to player dashboard
          router.push('/play');
          return;
        } else if (user_type === 'both' && suggested_route === '/play') {
          // User participates more than organizes - suggest player dashboard
          const shouldRedirect = window.confirm(
            'You participate in more competitions than you organize. Would you like to go to your player dashboard instead?'
          );
          if (shouldRedirect) {
            router.push('/play');
            return;
          }
        }
        
        // Stay on admin dashboard for organisers or if user chooses to
        loadCompetitions();
      } else {
        // Fallback to loading competitions if check fails
        loadCompetitions();
      }
    } catch (error) {
      console.error('Failed to check user type:', error);
      // Fallback to loading competitions
      loadCompetitions();
    }
  };

  const loadCompetitions = async () => {
    try {
      // Load all competitions (both organized and playing)
      const response = await competitionApi.getMyCompetitions();
      if (response.data.return_code === 'SUCCESS') {
        const competitions = response.data.competitions || [];
        
        // Only show competitions where user is organiser
        const organized = competitions.filter(comp => comp.is_organiser);
        
        setOrganizedCompetitions(organized);
      }

    } catch (error) {
      console.error('Failed to load competitions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'UNLOCKED': return 'text-green-600 bg-green-50';
      case 'LOCKED': return 'text-orange-600 bg-orange-50';
      case 'SETUP': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'UNLOCKED': return <CheckCircleIcon className="h-5 w-5" />;
      case 'LOCKED': return <ClockIcon className="h-5 w-5" />;
      case 'SETUP': return <ExclamationTriangleIcon className="h-5 w-5" />;
      default: return <ClockIcon className="h-5 w-5" />;
    }
  };

  const handleLogout = () => {
    logout(router);
  };

  const handleManageClick = async (competitionId: number) => {
    try {
      const status = await competitionApi.getStatus(competitionId);
      if (status.data.return_code === 'SUCCESS') {
        if (status.data.should_route_to_results) {
          // Has fixtures - go to results
          router.push(`/competition/${competitionId}/results`);
        } else {
          // No fixtures - go to fixture creation
          router.push(`/competition/${competitionId}/manage`);
        }
      } else {
        // Fallback to manage page
        router.push(`/competition/${competitionId}/manage`);
      }
    } catch (error) {
      console.error('Failed to get competition status:', error);
      // Fallback to manage page
      router.push(`/competition/${competitionId}/manage`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
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
                <TrophyIcon className="h-8 w-8 text-green-600" />
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
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {user?.display_name} 👋
          </h1>
          <p className="text-lg text-gray-600">
            Ready to run some brilliant Last Man Standing competitions?
          </p>
        </div>
        
        {/* Organised Competitions */}
        <section className="mb-12">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">My Organised Competitions</h2>
            <p className="text-gray-600 text-sm mt-1">
              Create engaging competitions that bring your customers together
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* New Competition Card */}
            <div className="bg-gradient-to-br from-green-50 to-blue-50 border-2 border-dashed border-green-300 rounded-lg p-6 hover:shadow-md transition-shadow flex flex-col items-center justify-center text-center relative overflow-hidden">
              {/* Decorative background pattern */}
              <div className="absolute inset-0 opacity-5">
                <div className="absolute top-4 left-4">⚽</div>
                <div className="absolute top-8 right-8">🏆</div>
                <div className="absolute bottom-6 left-8">🎯</div>
                <div className="absolute bottom-4 right-4">⭐</div>
              </div>
              
              <div className="relative z-10">
                <div className="bg-green-100 rounded-full p-3 mb-4 inline-flex">
                  <PlusIcon className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Start New Competition</h3>
                <p className="text-gray-600 text-sm mb-6">
                  Get your customers engaged with a thrilling Last Man Standing tournament. 
                  <span className="block text-green-700 font-medium mt-1">Setup takes just 5 minutes! ⚡</span>
                </p>
                <Link
                  href="/competition/create"
                  className="inline-flex items-center px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors shadow-md hover:shadow-lg"
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Create Competition
                </Link>
              </div>
            </div>

            {organizedCompetitions.map((competition) => {
              const isNewCompetition = newCompetitionId && competition.id.toString() === newCompetitionId;
              return (
              <div key={competition.id} className={`rounded-lg p-6 hover:shadow-md transition-shadow flex flex-col ${
                isNewCompetition 
                  ? 'bg-gradient-to-br from-green-50 to-blue-50 border-2 border-green-400 shadow-lg' 
                  : 'bg-white border border-gray-200'
              }`}>
                {isNewCompetition && (
                  <div className="flex items-center mb-3">
                    <div className="bg-green-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center">
                      <span className="animate-pulse mr-1">✨</span>
                      NEW!
                    </div>
                  </div>
                )}
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 truncate">{competition.name}</h3>
                </div>
                
                {isNewCompetition && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                    <div className="text-sm text-blue-800">
                      <p className="font-medium mb-1">🎯 Ready to set up your competition?</p>
                      <p className="text-xs">Add rounds, fixtures, and start inviting players!</p>
                    </div>
                  </div>
                )}
                
                {!isNewCompetition && competition.player_count === 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                    <div className="text-sm text-amber-800">
                      <p className="font-medium mb-1">📢 Ready for players!</p>
                      <p className="text-xs">Competition is set up - share your access code to get players joining.</p>
                    </div>
                  </div>
                )}
                
                {competition.current_round && competition.player_count > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                    <div className="text-sm text-green-800">
                      <p className="font-medium mb-1">🏃‍♂️ Competition running!</p>
                      <p className="text-xs">Manage rounds, results and keep the excitement going.</p>
                    </div>
                  </div>
                )}
                
                <div className="space-y-2 text-sm text-gray-600 mb-6 flex-grow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <UserGroupIcon className="h-4 w-4 mr-2" />
                      <span>{competition.player_count || 0} players</span>
                    </div>
                    {competition.current_round && (
                      <div className="flex items-center">
                        <ChartBarIcon className="h-4 w-4 mr-1" />
                        <span>Round {competition.current_round}</span>
                      </div>
                    )}
                  </div>
                  
                  {competition.total_rounds && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <CalendarDaysIcon className="h-4 w-4 mr-2" />
                        <span>{competition.total_rounds} total rounds</span>
                      </div>
                      <div className="flex items-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          competition.status === 'UNLOCKED' ? 'bg-green-100 text-green-700' :
                          competition.status === 'LOCKED' ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {competition.status === 'UNLOCKED' ? 'Active' :
                           competition.status === 'LOCKED' ? 'Locked' :
                           'Setup'}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <ClockIcon className="h-4 w-4 mr-2" />
                      <span className="text-xs">
                        Created {new Date(competition.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>
                  
                  {competition.invite_code && (
                    <div className="bg-gray-50 border border-gray-200 rounded p-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-gray-900 mb-1">Player Access Code</p>
                          <p className="text-lg font-bold text-blue-600 tracking-wider">{competition.invite_code}</p>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(competition.invite_code);
                            // Could add a toast notification here
                          }}
                          className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200 transition-colors"
                        >
                          Copy
                        </button>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">Share this code with players to join</p>
                    </div>
                  )}
                </div>

                <div className="flex mt-auto space-x-2">
                  <button
                    onClick={() => handleManageClick(competition.id)}
                    className={`flex-1 inline-flex items-center justify-center px-3 py-2 rounded-lg font-medium transition-colors text-sm ${
                      isNewCompetition 
                        ? 'bg-green-600 text-white hover:bg-green-700 shadow-md' 
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    <Cog6ToothIcon className="h-4 w-4 mr-1" />
                    Manage
                  </button>
                  <Link
                    href={`/competition/${competition.id}/players`}
                    className={`flex-1 inline-flex items-center justify-center px-3 py-2 rounded-lg font-medium transition-colors text-sm ${
                      isNewCompetition 
                        ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md' 
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    <UsersIcon className="h-4 w-4 mr-1" />
                    Players
                  </Link>
                </div>
              </div>
              );
            })}
          </div>
        </section>

      </main>
    </div>
  );
}