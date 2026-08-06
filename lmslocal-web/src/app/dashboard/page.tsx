'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  PlusIcon,
  UserGroupIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  ClipboardDocumentIcon,
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
import { LABEL, EYEBROW, HEADING, PANEL, BTN_PRIMARY, BTN_OUTLINE, BTN_DARK, TICK } from '@/lib/design';
import { deriveDashboardRoundState, pickDeadlineText } from '@/lib/roundState';

export default function DashboardPage() {
  const router = useRouter();
  // Use app-level data from context instead of local API calls
  const { competitions, loading, updateCompetition, refreshCompetitions } = useAppData();

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

  // Calculate player count from existing competition data (no extra API calls)
  // Note: We don't show credit warnings here since we don't have paid_credit balance
  // Users can click through to billing page for full credit details
  const playerStats = useMemo(() => {
    if (!competitions) return { totalPlayers: 0, hasOrganizedCompetitions: false };

    // Sum total_players from competitions where user is organiser
    const organizedCompetitions = competitions.filter(comp => comp.is_organiser);
    const totalPlayers = organizedCompetitions.reduce((sum, comp) => sum + (comp.total_players || 0), 0);

    return {
      totalPlayers,
      hasOrganizedCompetitions: organizedCompetitions.length > 0
    };
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
        // Refresh competitions to remove the hidden one from view
        await refreshCompetitions(true);
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
      <div className="min-h-screen bg-stock font-body text-ink">
        <header className="border-b border-ink/30">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
            <Link href="/" className="font-display text-2xl font-semibold uppercase tracking-[0.1em] text-ink sm:text-[1.75rem]">
              LMSLocal
            </Link>
            <Link href="/help" className={`${LABEL} flex items-center gap-1.5 text-ink-fade transition-colors hover:text-ink`}>
              <BookOpenIcon className="h-4 w-4" />
              Help
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className={`${PANEL} p-8 text-center`}>
            <div className="mb-4 inline-flex h-8 w-8 animate-spin items-center justify-center rounded-full border-2 border-ink border-t-transparent" />
            <p className={EYEBROW}>Loading dashboard</p>
            <p className="mt-2 text-[17px] text-ink-fade">Fetching your competitions&hellip;</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stock font-body text-ink">
      <header className="border-b border-ink/30">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="font-display text-2xl font-semibold uppercase tracking-[0.1em] text-ink sm:text-[1.75rem]">
            LMSLocal
          </Link>
          <nav className="flex items-center gap-5 sm:gap-7">
            {playerStats.hasOrganizedCompetitions && (
              <Link
                href="/billing"
                className={`${LABEL} hidden items-center gap-1.5 text-ink-fade transition-colors hover:text-ink sm:flex`}
                title="View credits and billing"
              >
                <CreditCardIcon className="h-4 w-4" />
                Credits
              </Link>
            )}
            <Link href="/help" className={`${LABEL} hidden items-center gap-1.5 text-ink-fade transition-colors hover:text-ink sm:flex`}>
              <BookOpenIcon className="h-4 w-4" />
              Help
            </Link>
            <div className="relative flex items-center" ref={profileMenuRef}>
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className={`${LABEL} flex items-center gap-1.5 rounded-sm border border-ink px-3.5 py-2 text-ink transition-colors hover:bg-ink hover:text-stock-lit`}
              >
                <UserIcon className="h-4 w-4" />
                Profile
                <ChevronDownIcon className="h-3.5 w-3.5" />
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 top-full z-50 mt-2 w-52 border border-ink/30 bg-stock-lit">
                  <Link
                    href="/profile"
                    className={`${LABEL} flex items-center gap-3 px-4 py-3 text-ink transition-colors hover:bg-stock`}
                    onClick={() => setShowProfileMenu(false)}
                  >
                    <Cog6ToothIcon className="h-4 w-4" />
                    Settings
                  </Link>
                  <Link
                    href="/help"
                    className={`${LABEL} flex items-center gap-3 border-t border-ink/30 px-4 py-3 text-ink transition-colors hover:bg-stock`}
                    onClick={() => setShowProfileMenu(false)}
                  >
                    <BookOpenIcon className="h-4 w-4" />
                    Help centre
                  </Link>
                  <Link
                    href="/billing"
                    className={`${LABEL} flex items-center gap-3 border-t border-ink/30 px-4 py-3 text-ink transition-colors hover:bg-stock`}
                    onClick={() => setShowProfileMenu(false)}
                  >
                    <CreditCardIcon className="h-4 w-4" />
                    Billing
                  </Link>
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      handleLogout();
                    }}
                    className={`${LABEL} flex w-full items-center gap-3 border-t border-ink/30 px-4 py-3 text-left text-ink transition-colors hover:bg-stock`}
                  >
                    <ArrowRightOnRectangleIcon className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        {/* Empty State - Show when no competitions */}
        {userCompetitions.length === 0 ? (
          <div className="mx-auto max-w-2xl">
            <div className={`${PANEL} p-8 text-center sm:p-12`}>
              <p className={EYEBROW}>For organisers</p>
              <h2 className={`${HEADING} mt-2 text-4xl sm:text-5xl`}>Ready to organise?</h2>
              <p className="mx-auto mt-4 max-w-md text-[17px] text-ink-fade">
                Create your first Last Man Standing competition in minutes. It&apos;s free for up to 20 players.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
                <Link
                  href="/competition/create"
                  className={`${BTN_PRIMARY} inline-flex items-center justify-center gap-2 px-7 py-3.5 text-xl`}
                >
                  <PlusIcon className="h-5 w-5" />
                  Create your first competition
                </Link>
                <button
                  onClick={() => {
                    setShowJoinModal(true);
                    setJoinError(null);
                  }}
                  className={`${BTN_OUTLINE} inline-flex items-center justify-center gap-2 px-7 py-3.5 text-base`}
                >
                  <UserGroupIcon className="h-5 w-5" />
                  Join a competition
                </button>
              </div>
              <div className="mt-10 border-t border-ink/30 pt-8 text-left">
                <p className={`${LABEL} mb-4 text-center text-ink-fade`}>Why create with LMSLocal?</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="flex items-start gap-2">
                    <span className={TICK}>&#10003;</span>
                    <p className="text-[15px] text-ink-fade">5-minute setup</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className={TICK}>&#10003;</span>
                    <p className="text-[15px] text-ink-fade">Free up to 20 players</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className={TICK}>&#10003;</span>
                    <p className="text-[15px] text-ink-fade">Automated results</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Create / Join - Show when user has competitions */}
            <div className="mb-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/competition/create"
                className={`${BTN_PRIMARY} inline-flex items-center justify-center gap-2 px-6 py-3 text-lg`}
              >
                <PlusIcon className="h-5 w-5" />
                Create new competition
              </Link>
              <button
                onClick={() => {
                  setShowJoinModal(true);
                  setJoinError(null);
                }}
                className={`${BTN_OUTLINE} inline-flex items-center justify-center gap-2 px-6 py-3 text-base`}
              >
                <UserGroupIcon className="h-5 w-5" />
                Join a competition
              </button>
            </div>

            {/* Credits Info Banner - Only show for organizers */}
            {playerStats.hasOrganizedCompetitions && (
              <div className={`${PANEL} mb-6 p-4`}>
                <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                  <div className="flex items-start gap-3">
                    <CreditCardIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-ink-fade" />
                    <div>
                      <p className="text-[15px] font-medium text-ink">Growing your competitions?</p>
                      <p className="text-[13px] text-ink-fade">Check your player credits and purchase more capacity as needed</p>
                    </div>
                  </div>
                  <Link href="/billing" className={`${BTN_OUTLINE} flex-shrink-0`}>
                    View credits
                  </Link>
                </div>
              </div>
            )}

            {/* Competitions Grid */}
            <div className="grid grid-cols-1 items-start gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-3">
              {userCompetitions.map((competition) => {
                const competitionStatus = getWinnerStatus(competition);
                return (
                  <div key={competition.id} className="flex h-full flex-col">
                    <div className={`${PANEL} flex flex-1 flex-col transition-colors hover:border-ink`}>
                      {/* Card Header */}
                      <div className="border-b border-ink/30 p-4 sm:p-6">
                        <div className="mb-3 flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            {editingNameId === competition.id ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={editingNameValue}
                                  onChange={(e) => setEditingNameValue(e.target.value)}
                                  className="flex-1 border-b-2 border-ink bg-transparent font-data text-lg text-ink focus:outline-none"
                                  placeholder="Add personal note..."
                                  disabled={savingName}
                                  autoFocus
                                />
                                <button
                                  onClick={handleSaveName}
                                  disabled={savingName}
                                  className="text-moss hover:opacity-75 disabled:opacity-50"
                                >
                                  &#10003;
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  disabled={savingName}
                                  className="text-overprint hover:opacity-75 disabled:opacity-50"
                                >
                                  &#10005;
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-baseline gap-2">
                                <h4 className="truncate font-display text-2xl uppercase tracking-[0.03em] text-ink">
                                  {competition.name}
                                </h4>
                                {competition.is_organiser && (
                                  <span className={`${LABEL} flex-shrink-0 text-ink-fade`}>Organiser</span>
                                )}
                              </div>
                            )}
                          </div>

                          {editingNameId !== competition.id && (
                            <button
                              onClick={() => handleEditName(competition)}
                              className="p-1 text-ink-fade transition-colors hover:text-ink"
                              title="Edit personal note"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                          )}
                        </div>

                        {/* Personal Note Display */}
                        {competition.personal_name && editingNameId !== competition.id && (
                          <p className="mb-3 font-data text-[15px] italic text-ink-fade">{competition.personal_name}</p>
                        )}

                        {/* Your Status Display - Only for participants */}
                        {competition.is_participant && (
                          <div className="mb-3 flex items-center gap-2">
                            {competition.user_status === 'active' ? (
                              <>
                                <span className="h-2 w-2 flex-shrink-0 rounded-full bg-moss" />
                                <span className={`${LABEL} text-moss`}>Active</span>
                              </>
                            ) : (
                              <>
                                <span className="h-2 w-2 flex-shrink-0 rounded-full bg-overprint" />
                                <span className={`${LABEL} text-overprint`}>
                                  Eliminated
                                  <span className="sr-only"> &mdash; out</span>
                                </span>
                              </>
                            )}
                          </div>
                        )}

                        {/* Pick Status Display */}
                        {competition.needs_pick ? (
                          <div className="mb-3 flex items-center gap-2 border border-overprint px-3 py-2">
                            <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0 text-overprint" />
                            <span className={`${LABEL} text-ink`}>
                              {pickDeadlineText(
                                deriveDashboardRoundState({
                                  currentRound: competition.current_round,
                                  currentRoundLockTime: competition.current_round_lock_time,
                                  automated: competition.fixture_service === true,
                                  competitionComplete: competitionStatus.isComplete === true,
                                  now: new Date(),
                                  totalFixtures: competition.total_fixtures,
                                  fixturesWithResults: competition.fixtures_with_results,
                                  fixturesProcessed: competition.fixtures_processed,
                                })
                              )}
                            </span>
                          </div>
                        ) : (
                          <p className={`${LABEL} mb-3 text-moss`}>&#10003; Up to date</p>
                        )}

                        <div className="flex items-center gap-4 text-[15px] text-ink-fade">
                          <span className="flex items-center gap-1.5">
                            <UserGroupIcon className="h-4 w-4" />
                            {competition.player_count || 0} active
                          </span>
                          {competition.current_round && (
                            <span className="flex items-center gap-1.5">
                              <ChartBarIcon className="h-4 w-4" />
                              Round {competition.current_round}
                            </span>
                          )}
                        </div>

                        {/* Status Messages */}
                        {competition.player_count === 0 && (competition.status as string) !== 'COMPLETE' && (competition.current_round || 0) < 2 && (
                          <div className="mt-4 border border-ink/30 p-4">
                            <p className="text-[15px] font-medium text-ink">Waiting for players</p>
                            <p className="mt-1 text-[13px] text-ink-fade">Share your access code to get players joining</p>
                          </div>
                        )}

                        {/* Competition Completion Status - Winner/Draw Display */}
                        {competitionStatus.isComplete && (
                          <div className="mt-4 border border-ink/30 p-4">
                            {competitionStatus.winner ? (
                              <>
                                <p className="text-[15px] font-medium text-ink">Winner: {competitionStatus.winner}</p>
                                <p className="mt-1 text-[13px] text-ink-fade">Competition complete &mdash; view final standings for details</p>
                              </>
                            ) : (
                              <>
                                <p className="text-[15px] font-medium text-ink">Competition draw</p>
                                <p className="mt-1 text-[13px] text-ink-fade">No players remaining &mdash; competition ended in a draw</p>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Card Body */}
                      {competition.invite_code && (
                        <div className="flex-1 p-4 sm:p-6">
                          <div className="border border-ink/30 p-3">
                            <p className={`${LABEL} mb-1 text-ink-fade`}>Player invite code</p>
                            <div className="flex items-center gap-2">
                              <code className="font-data text-xl tracking-wider text-ink">{competition.invite_code}</code>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  navigator.clipboard.writeText(competition.invite_code || '');
                                }}
                                className="p-1 text-ink-fade transition-colors hover:text-ink"
                              >
                                <ClipboardDocumentIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="mt-auto border-t border-ink/30 px-4 py-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <Link
                            href={`/game/${competition.id}`}
                            className={`${BTN_DARK} flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 text-base`}
                          >
                            <ChartBarIcon className="h-4 w-4" />
                            {competition.is_organiser ? 'Manage competition' : 'View competition'}
                          </Link>
                          {competition.is_participant && !competition.is_organiser && (
                            <button
                              onClick={() => handleDeleteClick(competition)}
                              disabled={hidingCompetition === competition.id}
                              className={`${LABEL} text-ink-fade underline decoration-dotted underline-offset-[4px] transition-colors hover:text-ink disabled:opacity-50`}
                              title="Remove this competition from your dashboard"
                            >
                              {hidingCompetition === competition.id ? 'Removing...' : 'Delete for me'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobile App Promotion Banner */}
            <div className="mt-10 border-t border-ink/30 pt-8">
              <div className="mx-auto flex max-w-2xl flex-col items-center justify-between gap-4 border border-ink/30 bg-stock-deep p-4 sm:flex-row">
                <div className="text-center sm:text-left">
                  <p className="text-[15px] font-medium text-ink">Players: get our mobile app</p>
                  <p className="text-[13px] text-ink-fade">Make picks easier with instant notifications on iOS &amp; Android</p>
                </div>
                <div className="flex flex-shrink-0 gap-2">
                  <a
                    href="https://apps.apple.com/gb/app/lms-local/id6755344736"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${LABEL} flex items-center gap-1 rounded-sm bg-ink px-3 py-2 text-stock-lit transition-opacity hover:opacity-90`}
                  >
                    iOS
                  </a>
                  <a
                    href="https://play.google.com/store/apps/details?id=uk.co.lmslocal.lmslocal_flutter"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${LABEL} flex items-center gap-1 rounded-sm bg-ink px-3 py-2 text-stock-lit transition-opacity hover:opacity-90`}
                  >
                    Android
                  </a>
                </div>
              </div>
            </div>

          </>
        )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
          <div className={`${PANEL} w-full max-w-md p-6`}>
            <div className="mb-4 flex items-center gap-3">
              <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0 text-overprint" />
              <h3 className="font-display text-xl uppercase tracking-[0.03em] text-ink">Hide competition</h3>
            </div>

            <p className="mb-6 text-[15px] text-ink-fade">
              Hide &quot;{competitionToDelete.name}&quot; from your dashboard? This will remove it from your view.
            </p>

            <div className="flex justify-end gap-3">
              <button onClick={handleCancelDelete} className={`${BTN_OUTLINE} px-4 py-2`}>
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className={`${BTN_PRIMARY} px-4 py-2 text-base`}
              >
                Hide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
