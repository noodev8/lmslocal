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
  ChevronDownIcon,
  CreditCardIcon,
  BookOpenIcon,
  PencilIcon
} from '@heroicons/react/24/outline';
import { userApi, competitionApi, Competition } from '@/lib/api';
import { logout } from '@/lib/auth';
import { useAppData } from '@/contexts/AppDataContext';
import JoinCompetitionModal from '@/components/JoinCompetitionModal';


export default function DashboardPage() {
  const router = useRouter();
  // Use app-level data from context instead of local API calls
  const { competitions, loading, updateCompetition } = useAppData();
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [userType, setUserType] = useState<string | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [hidingCompetition, setHidingCompetition] = useState<number | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [competitionToDelete, setCompetitionToDelete] = useState<Competition | null>(null);

  // Personal name editing state
  const [editingNameId, setEditingNameId] = useState<number | null>(null);
  const [editingNameValue, setEditingNameValue] = useState<string>('');
  const [savingName, setSavingName] = useState(false);

  // Memoize all user competitions (organized + participating) to prevent dependency issues
  const userCompetitions = useMemo(() => {
    return competitions?.filter(comp => comp.is_organiser || comp.is_participant) || [];
  }, [competitions]);

  // No complex timing logic - just show the latest round stats if available

  // Winner detection only shows when competition status is COMPLETE
  const getWinnerStatus = (competition: Competition) => {
    const isComplete = competition.status === 'COMPLETE';

    if (isComplete && competition.winner_name) {
      return { isComplete: true, winner: competition.winner_name, isDraw: false };
    } else if (isComplete && !competition.winner_name) {
      return { isComplete: true, winner: undefined, isDraw: true };
    }
    return { isComplete: false };
  };

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
    setJoinError(null);
    try {
      const response = await userApi.joinCompetitionByCode(inviteCode);
      if (response.data.return_code === 'SUCCESS') {
        setShowJoinModal(false);
        setJoinError(null);
        // Refresh the page to show the newly joined competition
        window.location.reload();
      } else {
        setJoinError(response.data.message || 'Failed to join competition');
      }
    } catch (error) {
      console.error('Error joining competition:', error);
      setJoinError('Failed to join competition. Please check the invite code and try again.');
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

  // Handle personal name editing
  const handleEditName = (competition: Competition) => {
    setEditingNameId(competition.id);
    setEditingNameValue(competition.personal_name || competition.name || '');
  };

  const handleSaveName = async () => {
    if (!editingNameId) return;

    setSavingName(true);
    const trimmedName = editingNameValue.trim();
    const personalName = trimmedName === '' ? null : trimmedName;

    // Optimistically update context state (persists across navigation)
    updateCompetition(editingNameId, { personal_name: personalName });

    // Close the editing UI immediately
    const competitionIdToUpdate = editingNameId;
    setEditingNameId(null);
    setEditingNameValue('');
    setSavingName(false);

    try {
      const response = await competitionApi.updatePersonalName(competitionIdToUpdate, personalName);

      if (response.data.return_code !== 'SUCCESS') {
        console.error('Failed to update personal name:', response.data.message);
        // Revert on failure - update back to original or refresh
        // For now just log, could add error toast here
      }
    } catch (error) {
      console.error('Error updating personal name:', error);
      // Could revert the optimistic update here if needed
    }
  };

  const handleCancelEdit = () => {
    setEditingNameId(null);
    setEditingNameValue('');
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
              <div className="flex items-center space-x-4">
                <Link
                  href="/help"
                  className="flex items-center space-x-1 px-3 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all duration-200"
                >
                  <BookOpenIcon className="h-5 w-5" />
                  <span className="text-sm font-medium hidden sm:block">Help</span>
                </Link>
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
            <div className="flex items-center space-x-4">
              <Link
                href="/help"
                className="flex items-center space-x-1 px-3 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all duration-200"
              >
                <BookOpenIcon className="h-5 w-5" />
                <span className="text-sm font-medium hidden sm:block">Help</span>
              </Link>
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
                    <Link
                      href="/help"
                      className="flex items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors"
                      onClick={() => setShowProfileMenu(false)}
                    >
                      <BookOpenIcon className="h-4 w-4 mr-3" />
                      Help Center
                    </Link>
                    <Link
                      href="/billing"
                      className="flex items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors"
                      onClick={() => setShowProfileMenu(false)}
                    >
                      <CreditCardIcon className="h-4 w-4 mr-3" />
                      Billing
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
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Competitions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 items-start">
          {/* Competition Cards */}
          {userCompetitions.map((competition) => {
            const competitionStatus = getWinnerStatus(competition);
            return (
              <div
                key={competition.id}
                className="flex flex-col space-y-3 h-full"
              >
                <div className="bg-white rounded-xl border-2 border-slate-300 shadow-lg hover:shadow-xl hover:border-blue-400 transition-all duration-200 overflow-hidden flex-1 flex flex-col">
                {/* Card Header */}
                <div className="p-4 sm:p-6 border-b border-slate-200">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          {editingNameId === competition.id ? (
                            <div className="flex-1 flex items-center space-x-2">
                              <input
                                type="text"
                                value={editingNameValue}
                                onChange={(e) => setEditingNameValue(e.target.value)}
                                className="flex-1 text-lg font-semibold bg-transparent border-b-2 border-blue-500 focus:outline-none text-slate-900"
                                placeholder="Add personal note..."
                                disabled={savingName}
                                autoFocus
                              />
                              <button
                                onClick={handleSaveName}
                                disabled={savingName}
                                className="text-green-600 hover:text-green-700 disabled:opacity-50"
                              >
                                ✓
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                disabled={savingName}
                                className="text-red-600 hover:text-red-700 disabled:opacity-50"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <>
                              <h4 className="text-lg font-semibold text-slate-900 truncate">
                                {competition.name}
                              </h4>
                              {competition.is_organiser && (
                                <span className="text-xs text-slate-500 font-medium">
                                  (Organiser)
                                </span>
                              )}
                            </>
                          )}
                        </div>

                        {/* Edit button - for all users */}
                        {editingNameId !== competition.id && (
                          <button
                            onClick={() => handleEditName(competition)}
                            className="text-slate-400 hover:text-slate-600 p-1"
                            title="Edit personal note"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      {/* Personal Note Display - Fixed height for consistent alignment */}
                      <div className="mb-3 min-h-[20px]">
                        {competition.personal_name && editingNameId !== competition.id && (
                          <div className="text-sm text-slate-600 italic">
                            {competition.personal_name}
                          </div>
                        )}
                      </div>

                      {/* Your Status Display - Only for participants */}
                      {competition.is_participant && (
                        <div className="flex items-center space-x-2 mb-3">
                          {competition.user_status === 'active' ? (
                            <>
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span className="text-sm font-medium text-green-700">Active</span>
                            </>
                          ) : (
                            <>
                              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                              <span className="text-sm font-medium text-red-700">Eliminated</span>
                            </>
                          )}
                        </div>
                      )}

                      {/* Pick Status Display */}
                      {competition.needs_pick ? (
                        <div className="mb-3 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 flex items-center space-x-2">
                          <ExclamationTriangleIcon className="h-5 w-5 text-green-600 flex-shrink-0" />
                          <span className="text-sm font-bold text-green-800">Pick Needed</span>
                        </div>
                      ) : (
                        <div className="mb-3">
                          <span className="text-sm font-medium text-green-700">✓ Up to date</span>
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
                  
                </div>

                {/* Card Body - Only show if there's content to display */}
                {competition.invite_code && (
                  <div className="p-4 sm:p-6 flex-1">
                    <div className="space-y-4 h-full flex flex-col">
                      {/* Invite Code - Show for all users */}
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
                    </div>
                  </div>
                )}

                {/* Action Buttons - Back inside the card */}
                <div className="px-4 sm:px-6 py-4 bg-slate-50 border-t border-slate-200 mt-auto">
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
              onClick={() => {
                setShowJoinModal(true);
                setJoinError(null);
              }}
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
        onClose={() => {
          setShowJoinModal(false);
          setJoinError(null);
        }}
        onJoin={handleJoinCompetition}
        isLoading={joinLoading}
        error={joinError}
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