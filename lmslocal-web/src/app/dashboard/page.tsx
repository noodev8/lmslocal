'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  TrophyIcon,
  PlusIcon,
  UserGroupIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  ClipboardDocumentIcon,
  PlayCircleIcon,
  PauseCircleIcon,
  UserIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';
import { userApi, competitionApi, Competition } from '@/lib/api';
import { logout } from '@/lib/auth';
import { useAppData } from '@/contexts/AppDataContext';
import JoinCompetitionModal from '@/components/JoinCompetitionModal';


export default function DashboardPage() {
  const router = useRouter();
  // Use app-level data from context instead of local API calls
  const { competitions, loading } = useAppData();
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [userType, setUserType] = useState<string | null>(null);
  const [winnerNames, setWinnerNames] = useState<Record<number, string>>({});
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [hidingCompetition, setHidingCompetition] = useState<number | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [competitionToDelete, setCompetitionToDelete] = useState<Competition | null>(null);

  // Memoize all user competitions (organized + participating) to prevent dependency issues
  const userCompetitions = useMemo(() => {
    return competitions?.filter(comp => comp.is_organiser || comp.is_participant) || [];
  }, [competitions]);

  // No complex timing logic - just show the latest round stats if available

  // Winner detection only shows when competition status is COMPLETE
  const getWinnerStatus = (competition: Competition) => {
    const playerCount = competition.player_count || 0;
    const isComplete = competition.status === 'COMPLETE';
    
    if (isComplete && playerCount === 1) {
      const winnerName = winnerNames[competition.id] || 'Loading...';
      return { isComplete: true, winner: winnerName, isDraw: false };
    } else if (isComplete && playerCount === 0) {
      return { isComplete: true, winner: undefined, isDraw: true };
    }
    return { isComplete: false };
  };

  // Load winner names for competitions that are COMPLETE
  useEffect(() => {
    const loadWinnerNames = async () => {
      const competitionsWithWinner = userCompetitions.filter(comp => comp.status === 'COMPLETE' && comp.player_count === 1);
      
      for (const competition of competitionsWithWinner) {
        if (!winnerNames[competition.id]) {
          try {
            const response = await userApi.getCompetitionStandings(competition.id);
            if (response.data.return_code === 'SUCCESS') {
              const players = (response.data.players as { status: string; display_name: string }[]) || [];
              const activePlayer = players.find(p => p.status !== 'OUT');
              const winnerName = activePlayer?.display_name || 'Unknown Winner';
              
              setWinnerNames(prev => ({
                ...prev,
                [competition.id]: winnerName
              }));
            }
          } catch (error) {
            console.warn(`Failed to get winner name for competition ${competition.id}:`, error);
          }
        }
      }
    };

    if (userCompetitions.length > 0) {
      loadWinnerNames();
    }
  }, [userCompetitions, winnerNames]);

  const checkUserTypeAndRoute = useCallback(async () => {
    try {
      const response = await userApi.checkUserType();
      if (response.data.return_code === 'SUCCESS') {
        const { user_type } = response.data;
        setUserType(user_type as string);
        
        // Smart routing logic removed - all users stay on unified dashboard
        // Competitions are now loaded via AppDataProvider
      } else {
        // Competitions are now loaded via AppDataProvider
      }
    } catch (error) {
      console.error('Failed to check user type:', error);
      // Competitions are now loaded via AppDataProvider
    }
  }, []);

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem('jwt_token');
    const userData = localStorage.getItem('user');
    
    if (!token || !userData || userData === 'undefined' || userData === 'null') {
      router.push('/login');
      return;
    }

    try {
      JSON.parse(userData); // Just validate the user data is valid JSON
      // User data is now loaded via AppDataProvider, no need to set local state
    } catch (error) {
      console.error('Failed to parse user data:', error);
      localStorage.removeItem('jwt_token');
      localStorage.removeItem('user');
      router.push('/login');
      return;
    }
    
    // No smart routing - all users stay on unified dashboard
    checkUserTypeAndRoute();
  }, [router, checkUserTypeAndRoute]);

  // Close profile menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    }

    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showProfileMenu]);

  // No complex useEffect needed - winner detection is now simple and inline

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'UNLOCKED': return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'LOCKED': return 'text-amber-700 bg-amber-50 border-amber-200';
      case 'SETUP': return 'text-slate-600 bg-slate-50 border-slate-200';
      default: return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'UNLOCKED': return <PlayCircleIcon className="h-4 w-4" />;
      case 'LOCKED': return <PauseCircleIcon className="h-4 w-4" />;
      case 'SETUP': return <ExclamationTriangleIcon className="h-4 w-4" />;
      default: return <ClockIcon className="h-4 w-4" />;
    }
  };

  const handleLogout = () => {
    logout(router);
  };

  const handleJoinCompetition = async (inviteCode: string) => {
    setJoinLoading(true);
    try {
      const response = await userApi.joinCompetitionByCode(inviteCode);
      if (response.data.return_code === 'SUCCESS') {
        setShowJoinModal(false);
        // Refresh the page to show the newly joined competition
        window.location.reload();
      } else {
        alert(response.data.message || 'Failed to join competition');
      }
    } catch (error) {
      console.error('Error joining competition:', error);
      alert('Failed to join competition. Please check the invite code and try again.');
    } finally {
      setJoinLoading(false);
    }
  };

  // Show confirmation modal for hiding competition
  const handleDeleteClick = (competition: Competition) => {
    setCompetitionToDelete(competition);
    setShowDeleteModal(true);
  };

  // Handle confirmed hiding of competition
  const handleConfirmDelete = async () => {
    if (!competitionToDelete) return;

    setHidingCompetition(competitionToDelete.id);
    setShowDeleteModal(false);

    try {
      const response = await competitionApi.hide(competitionToDelete.id);
      if (response.data.return_code === 'SUCCESS') {
        // Refresh the page to remove the hidden competition from view
        window.location.reload();
      } else {
        console.error('Failed to hide competition:', response.data.message);
      }
    } catch (error) {
      console.error('Error hiding competition:', error);
    } finally {
      setHidingCompetition(null);
      setCompetitionToDelete(null);
    }
  };

  // Cancel deletion
  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setCompetitionToDelete(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-3">
                <TrophyIcon className="h-7 w-7 text-slate-700" />
                <h1 className="text-xl font-bold text-slate-900">LMSLocal</h1>
              </div>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
            <div className="flex items-center justify-center">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-700 border-t-transparent"></div>
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">Loading Dashboard</h3>
                <p className="text-slate-500">Please wait while we fetch your competitions...</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Material 3 Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <Link href="/" className="flex items-center space-x-3">
                <TrophyIcon className="h-7 w-7 text-slate-700" />
                <h1 className="text-xl font-bold text-slate-900">LMSLocal</h1>
              </Link>
            </div>
            <div className="flex items-center relative" ref={profileMenuRef}>
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center space-x-2 px-3 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all duration-200"
              >
                <UserIcon className="h-5 w-5" />
                <span className="text-sm font-medium">Profile</span>
                <ChevronDownIcon className="h-4 w-4" />
              </button>
              
              {/* Dropdown Menu */}
              {showProfileMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                  <div className="py-1">
                    <Link
                      href="/profile"
                      className="flex items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors"
                      onClick={() => setShowProfileMenu(false)}
                    >
                      <Cog6ToothIcon className="h-4 w-4 mr-3" />
                      Settings
                    </Link>
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center px-4 py-2 text-sm text-red-700 hover:bg-red-50 transition-colors"
                    >
                      <ArrowRightOnRectangleIcon className="h-4 w-4 mr-3" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

        {/* Beta Notice */}
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <ExclamationTriangleIcon className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900">
                🚀 You&apos;re using LMSLocal BETA - Thank you for being an early user!
              </p>
              <p className="text-xs text-blue-700 mt-1">
                Questions or issues? Contact us at{' '}
                <a href="mailto:lmslocal@noodev8.com" className="font-medium underline hover:text-blue-800">
                  lmslocal@noodev8.com
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* Competitions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 items-start">
          {/* Competition Cards */}
          {userCompetitions.map((competition) => {
            const competitionStatus = getWinnerStatus(competition);
            return (
              <div
                key={competition.id}
                className="flex flex-col space-y-3 h-full"
              >
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex-1 flex flex-col">
                {/* Card Header */}
                <div className="p-4 sm:p-6 border-b border-slate-100">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="text-lg font-semibold text-slate-900 truncate">{competition.name}</h4>
                        {competition.is_organiser && (
                          <div className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                            ORGANISER
                          </div>
                        )}
                      </div>
                      {competition.needs_pick && (
                        <div className="mb-2">
                          <div className="inline-flex items-center px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-semibold">
                            PICK NEEDED
                          </div>
                        </div>
                      )}
                      <div className="flex items-center space-x-4 text-sm text-slate-600">
                        <div className="flex items-center space-x-2">
                          <UserGroupIcon className="h-4 w-4" />
                          <span>{competition.player_count || 0} active</span>
                        </div>
                        {competition.current_round && (
                          <div className="flex items-center space-x-2">
                            <ChartBarIcon className="h-4 w-4" />
                            <span>Round {competition.current_round}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Removed status badge as requested */}
                  </div>

                  {/* Status Messages */}
                  
                  {competition.player_count === 0 && (competition.status as string) !== 'COMPLETE' && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <ExclamationTriangleIcon className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-amber-900">Waiting for Players</p>
                          <p className="text-xs text-amber-700 mt-1">Share your access code to get players joining</p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Competition Completion Status - Winner/Draw Display */}
                  {competitionStatus.isComplete ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <TrophyIcon className="h-5 w-5 text-slate-600" />
                        </div>
                        <div className="flex-1">
                          {competitionStatus.winner ? (
                            <>
                              <p className="text-sm font-medium text-slate-900">🏆 Winner: {competitionStatus.winner}</p>
                              <p className="text-xs text-slate-600 mt-1">Competition complete - view final standings for details</p>
                            </>
                          ) : (
                            <>
                              <p className="text-sm font-medium text-slate-900">🤝 Competition Draw</p>
                              <p className="text-xs text-slate-600 mt-1">No players remaining - competition ended in a draw</p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}
                  
                  {!competitionStatus.isComplete && competition.current_round && competition.player_count && competition.player_count > 0 && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <PlayCircleIcon className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-emerald-900">Competition Active</p>
                          <p className="text-xs text-emerald-700 mt-1">Players are engaged and competition is running</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Body - Flexible to fill remaining space */}
                <div className="p-4 sm:p-6 flex-1">
                  <div className="space-y-4 h-full flex flex-col">
                    {/* Competition Stats */}
                    <div className="grid grid-cols-1 gap-4 text-sm">
                      {/* Removed rounds count and created date as requested */}
                    </div>

                    {/* Invite Code - Show for all users */}
                    {competition.invite_code && (
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="text-xs font-medium text-slate-700 mb-1">Player Invite Code</p>
                            <div className="flex items-center space-x-2">
                              <code className="text-lg font-mono font-bold text-slate-800 tracking-wider">
                                {competition.invite_code}
                              </code>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  navigator.clipboard.writeText(competition.invite_code || '');
                                }}
                                className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                              >
                                <ClipboardDocumentIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons - Back inside the card */}
                <div className="px-4 sm:px-6 py-4 bg-slate-50 border-t border-slate-100 mt-auto">
                  <div className="flex gap-3">
                    <Link
                      href={`/game/${competition.id}`}
                      className="flex-1 inline-flex items-center justify-center px-4 py-3 rounded-lg font-medium transition-colors text-base bg-slate-800 text-white hover:bg-slate-900"
                    >
                      <ChartBarIcon className="h-5 w-5 mr-2" />
                      {competition.is_organiser ? 'Manage Competition' : 'View Competition'}
                    </Link>
                    {/* Only show hide button if user is participant (not organiser) */}
                    {competition.is_participant && !competition.is_organiser && (
                      <button
                        onClick={() => handleDeleteClick(competition)}
                        disabled={hidingCompetition === competition.id}
                        className="px-2 py-1 rounded text-xs text-red-600 hover:text-red-800 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Remove this competition from your dashboard"
                      >
                        {hidingCompetition === competition.id ? (
                          <span className="flex items-center">
                            <div className="animate-spin h-3 w-3 border border-red-300 border-t-red-600 rounded-full mr-1"></div>
                            Removing...
                          </span>
                        ) : (
                          'Delete for me'
                        )}
                      </button>
                    )}
                  </div>
                </div>
                </div>
              </div>
            );
          })}
          
        </div>

        {/* Action Links - Create and Join */}
        <div className="text-center mt-8 pt-6 border-t border-slate-200">
          <div className="flex items-center justify-center space-x-8">
            <Link 
              href="/competition/create"
              className="inline-flex items-center space-x-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              <PlusIcon className="h-4 w-4" />
              <span>Create New Competition</span>
            </Link>
            <button
              onClick={() => setShowJoinModal(true)}
              className="inline-flex items-center space-x-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              <UserGroupIcon className="h-4 w-4" />
              <span>Join Competition</span>
            </button>
          </div>
        </div>

      </main>

      {/* Join Competition Modal */}
      <JoinCompetitionModal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onJoin={handleJoinCompetition}
        isLoading={joinLoading}
      />

      {/* Delete Competition Confirmation Modal */}
      {showDeleteModal && competitionToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-semibold text-slate-900">Remove Competition</h3>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-sm text-slate-600">
                Are you sure you want to remove &quot;{competitionToDelete.name}&quot; from your dashboard?
                This will hide it from your view.
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCancelDelete}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}