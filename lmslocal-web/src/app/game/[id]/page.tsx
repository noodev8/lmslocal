'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  TrophyIcon,
  ArrowLeftIcon,
  UserGroupIcon,
  Cog6ToothIcon,
  PlayIcon,
  UserIcon,
  MegaphoneIcon,
  CalendarIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { Competition as CompetitionType, roundApi, competitionApi, offlinePlayerApi, promoteApi } from '@/lib/api';
import { useAppData } from '@/contexts/AppDataContext';
import { useToast, ToastContainer } from '@/components/Toast';
import { LABEL, EYEBROW, HEADING, PANEL, BTN_PRIMARY, BTN_OUTLINE, BTN_DARK } from '@/lib/design';

/**
 * FEATURE FLAG: Round Statistics Progress Bar
 *
 * Controls whether the Win/Slip/Loss visual progress bar is displayed on the game dashboard.
 * When set to false:
 * - The visual progress bars (green WIN / grey SLIP / red OUT) are hidden
 * - API calls to getRoundStatistics() are skipped to reduce backend load
 * - All related state management is bypassed
 *
 * Set to true to re-enable the feature if needed in the future.
 */
const SHOW_ROUND_STATISTICS = false;

export default function UnifiedGameDashboard() {
  const router = useRouter();
  const params = useParams();
  const competitionId = params.id as string;

  // Use AppDataProvider context for competitions data
  const { competitions, loading: contextLoading } = useAppData();

  // Memoize the specific competition to prevent unnecessary re-renders
  const competition = useMemo(() => {
    return competitions?.find(c => c.id.toString() === competitionId);
  }, [competitions, competitionId]);

  const [currentRoundInfo, setCurrentRoundInfo] = useState<{
    id: number;
    round_number: number;
    lock_time?: string;
    fixture_count: number;
    is_locked: boolean;
    completed_fixtures?: number;
    status?: string;
  } | null>(null);
  const [, setLoadingRound] = useState(true);
  const [pickStats, setPickStats] = useState<{
    players_with_picks: number;
    total_active_players: number;
    pick_percentage: number;
  } | null>(null);
  const [roundStats, setRoundStats] = useState<{
    round_number: number;
    total_players: number;
    won: number;
    lost: number;
    eliminated: number;
  } | null>(null);
  const [currentRoundStats, setCurrentRoundStats] = useState<{
    round_number: number;
    total_players: number;
    won: number;
    lost: number;
    eliminated: number;
  } | null>(null);
  // DISABLED: Organiser fixture highlighting logic - may re-enable in future
  // const [needsFixtures, setNeedsFixtures] = useState(false);

  // Toast notifications
  const { toasts, showToast, removeToast } = useToast();

  // Guest player modal state
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [addPlayerForm, setAddPlayerForm] = useState({ display_name: '' });
  const [addPlayerError, setAddPlayerError] = useState<string | null>(null);

  // Copy button states
  const [codeCopied, setCodeCopied] = useState(false);
  const [messageCopied, setMessageCopied] = useState(false);

  // Unpicked players modal state
  const [showUnpickedModal, setShowUnpickedModal] = useState(false);
  const [unpickedPlayers, setUnpickedPlayers] = useState<Array<{ user_id: number; display_name: string }>>([]);
  const [loadingUnpicked, setLoadingUnpicked] = useState(false);

  // Simple loading based on context availability
  const loading = contextLoading || !competition;

  // Prevent duplicate API calls using refs
  const roundLoadedRef = useRef(false);
  const pickStatsLoadedRef = useRef(false);
  const roundStatsLoadedRef = useRef(false);
  const currentRoundStatsLoadedRef = useRef(false);

  // User role detection
  const isOrganiser = competition?.is_organiser || false;
  const isParticipant = competition?.is_participant || false;

  // Permission detection (organiser has all permissions implicitly, plus delegated permissions)
  const canManageResults = isOrganiser || competition?.manage_results || false;
  const canManageFixtures = isOrganiser || competition?.manage_fixtures || false;
  const canManagePlayers = isOrganiser || competition?.manage_players || false;
  const canManagePromote = isOrganiser || competition?.manage_promote || false;

  // Winner detection only shows when competition status is COMPLETE
  const getWinnerStatus = (comp: CompetitionType) => {
    const isComplete = comp.status === 'COMPLETE';

    if (isComplete && comp.winner_name) return { isComplete: true, winner: comp.winner_name, isDraw: false };
    if (isComplete && !comp.winner_name) return { isComplete: true, winner: undefined, isDraw: true };
    return { isComplete: false };
  };

  const competitionComplete = competition ? getWinnerStatus(competition) : { isComplete: false };


  // Handle play button click - check player status first, then rounds and fixtures before routing
  // Handle clicking the Round Progress card to show unpicked players
  const handleShowUnpickedPlayers = async () => {
    if (!competition || !currentRoundInfo) return;

    setLoadingUnpicked(true);
    setShowUnpickedModal(true);

    try {
      // Fetch unpicked players from API
      const response = await competitionApi.getUnpickedPlayers(competition.id);

      if (response.data.return_code === 'SUCCESS' && response.data.unpicked_players) {
        setUnpickedPlayers(response.data.unpicked_players);
      } else {
        console.error('Failed to fetch unpicked players:', response.data.message);
        setUnpickedPlayers([]);
      }
    } catch (error) {
      console.error('Error fetching unpicked players:', error);
      setUnpickedPlayers([]);
    } finally {
      setLoadingUnpicked(false);
    }
  };

  const handlePlayClick = async () => {
    try {
      const response = await roundApi.getRounds(parseInt(competitionId));

      if (response.data.return_code !== 'SUCCESS') {
        console.error('Failed to fetch rounds:', response.data.message);
        // If API fails, go to waiting screen as fallback
        router.push(`/game/${competitionId}/waiting`);
        return;
      }

      const rounds = response.data.rounds || [];

      // Check if no rounds exist
      if (rounds.length === 0) {
        router.push(`/game/${competitionId}/waiting`);
        return;
      }

      // Check if the latest round (first in array, as they're ordered most recent first) has fixtures
      const latestRound = rounds[0];
      if (latestRound.fixture_count === 0) {
        router.push(`/game/${competitionId}/waiting`);
        return;
      }

      // Check player status AFTER we know rounds exist
      // Eliminated participants can view results but cannot make picks
      if (competition?.is_participant && competition?.user_status && competition.user_status !== 'active') {
        // Eliminated participant - always show player results view (never allow picking)
        router.push(`/game/${competitionId}/player-results`);
        return;
      }

      // For active players and organizers: Check if round is locked to determine which page to show
      const now = new Date();
      const lockTime = new Date(latestRound.lock_time || '');
      const isLocked = !!(latestRound.lock_time && now >= lockTime);

      if (isLocked) {
        // Round is locked - show player results view
        router.push(`/game/${competitionId}/player-results`);
      } else {
        // Round is not locked - show pick screen (only active players and organizers reach here)
        router.push(`/game/${competitionId}/pick`);
      }

    } catch (error) {
      console.error('Error checking rounds:', error);
      // On error, fallback to waiting screen
      router.push(`/game/${competitionId}/waiting`);
    }
  };

  // Handle adding guest players
  const handleAddOfflinePlayer = async () => {
    if (!competition || !addPlayerForm.display_name.trim()) return;

    setAddingPlayer(true);
    setAddPlayerError(null);

    try {
      const response = await offlinePlayerApi.addOfflinePlayer(
        competition.id,
        addPlayerForm.display_name.trim()
      );

      if (response.data.return_code === 'SUCCESS') {
        // Clear any cache related to competition players/data
        const { cacheUtils } = await import('@/lib/api');
        cacheUtils.invalidateKey(`competition-players-${competition.id}`);
        cacheUtils.invalidateKey(`user-dashboard`);

        // Reset form and close modal
        setAddPlayerForm({ display_name: '' });
        setAddPlayerError(null);
        setShowAddPlayerModal(false);

        // Refresh the page data to show updated player count
        window.location.reload();
      } else {
        setAddPlayerError(response.data.message || 'Unknown error occurred');
      }
    } catch (error) {
      console.error('Failed to add player:', error);
      setAddPlayerError('Failed to add player. Please try again.');
    } finally {
      setAddingPlayer(false);
    }
  };

  useEffect(() => {
    // Simple auth check
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      router.push('/login');
      return;
    }

    // Load data only if we have the competition
    if (competition) {

      // Load current round info
      if (!roundLoadedRef.current) {
        roundLoadedRef.current = true;
        roundApi.getRounds(parseInt(competitionId))
          .then(response => {
            if (response.data.return_code === 'SUCCESS') {
              const rounds = response.data.rounds || [];
              if (rounds.length > 0) {
                const latestRound = rounds[0];
                const now = new Date();
                const lockTime = new Date(latestRound.lock_time || '');
                const isLocked = !!(latestRound.lock_time && now >= lockTime);

                setCurrentRoundInfo({
                  id: latestRound.id,
                  round_number: latestRound.round_number,
                  lock_time: latestRound.lock_time,
                  fixture_count: latestRound.fixture_count || 0,
                  is_locked: isLocked,
                  completed_fixtures: latestRound.completed_fixtures || 0,
                  status: latestRound.status
                });

                // DISABLED: Organiser fixture highlighting logic - may re-enable in future
                // Check if this is a new competition needing fixtures
                // setNeedsFixtures(latestRound.fixture_count === 0 && latestRound.round_number === 1);
              } else {
                setCurrentRoundInfo(null);
                // DISABLED: Organiser fixture highlighting logic - may re-enable in future
                // No rounds at all - definitely needs fixtures
                // setNeedsFixtures(true);
              }
            }
            setLoadingRound(false);
          })
          .catch(() => {
            setLoadingRound(false);
            roundLoadedRef.current = false; // Reset on error to allow retry
          });
      }

      // Load pick statistics for all users
      if (!pickStatsLoadedRef.current && currentRoundInfo) {
        pickStatsLoadedRef.current = true;
        competitionApi.getPickStatistics(parseInt(competitionId))
          .then(response => {
            if (response.data.return_code === 'SUCCESS') {
              setPickStats({
                players_with_picks: response.data.players_with_picks || 0,
                total_active_players: response.data.total_active_players || 0,
                pick_percentage: response.data.pick_percentage || 0
              });
            }
          })
          .catch(() => {
            pickStatsLoadedRef.current = false; // Reset on error to allow retry
          });
      }

      // Load round statistics for the most recently completed round
      if (SHOW_ROUND_STATISTICS && !roundStatsLoadedRef.current && currentRoundInfo) {
        roundStatsLoadedRef.current = true;

        // Fetch all rounds to find the most recently completed one
        roundApi.getRounds(parseInt(competitionId))
          .then(response => {
            if (response.data.return_code === 'SUCCESS') {
              const rounds = response.data.rounds || [];
              // Find the most recently completed round
              const completedRound = rounds.find(r => r.status === 'COMPLETE');

              if (completedRound) {
                // Fetch statistics for this completed round
                return promoteApi.getRoundStatistics(parseInt(competitionId), completedRound.id)
                  .then(statsResponse => {
                    if (statsResponse.data.return_code === 'SUCCESS' && statsResponse.data.statistics) {
                      setRoundStats({
                        round_number: completedRound.round_number,
                        ...statsResponse.data.statistics
                      });
                    }
                  });
              }
            }
          })
          .catch((error) => {
            console.error('Failed to load round statistics:', error);
            roundStatsLoadedRef.current = false; // Reset on error to allow retry
          });
      }

      // Load current round statistics (for live rounds with results being processed)
      if (SHOW_ROUND_STATISTICS && !currentRoundStatsLoadedRef.current && currentRoundInfo && currentRoundInfo.is_locked) {
        currentRoundStatsLoadedRef.current = true;

        // Fetch statistics for the current round
        promoteApi.getRoundStatistics(parseInt(competitionId), currentRoundInfo.id)
          .then(statsResponse => {
            if (statsResponse.data.return_code === 'SUCCESS' && statsResponse.data.statistics) {
              setCurrentRoundStats({
                round_number: currentRoundInfo.round_number,
                ...statsResponse.data.statistics
              });
            } else if (statsResponse.data.return_code === 'NO_DATA') {
              // No data yet for current round - this is fine, results haven't been processed yet
              setCurrentRoundStats(null);
            }
          })
          .catch((error) => {
            console.error('Failed to load current round statistics:', error);
            currentRoundStatsLoadedRef.current = false; // Reset on error to allow retry
          });
      }
    }
  }, [competition, competitionId, router, currentRoundInfo]);

  // Reset current round stats ref when round is locked
  useEffect(() => {
    if (currentRoundInfo && currentRoundInfo.is_locked) {
      currentRoundStatsLoadedRef.current = false;
    }
  }, [currentRoundInfo]);

  // Reset pick stats when player count changes (results were processed and players eliminated)
  // OR when round number changes (new fixtures added)
  useEffect(() => {
    pickStatsLoadedRef.current = false;
  }, [competition?.player_count, currentRoundInfo?.round_number]);

  if (loading) {
    return (
      <div className="min-h-screen bg-stock font-body text-ink">
        <ToastContainer toasts={toasts} onClose={removeToast} />

        <header className="border-b border-ink/30">
          <div className="mx-auto flex max-w-3xl items-center px-4 py-4 sm:px-6">
            <Link href="/dashboard" className={`${LABEL} flex items-center gap-1.5 text-ink-fade transition-colors hover:text-ink`}>
              <ArrowLeftIcon className="h-4 w-4" />
              Dashboard
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <div className={`${PANEL} p-8 text-center`}>
            <div className="mb-4 inline-flex h-8 w-8 animate-spin items-center justify-center rounded-full border-2 border-ink border-t-transparent" />
            <p className={EYEBROW}>Loading</p>
            <p className="mt-2 text-[17px] text-ink-fade">Fetching your competition&hellip;</p>
          </div>
        </main>
      </div>
    );
  }

  if (!competition) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stock font-body text-ink">
        <div className="text-center">
          <h1 className={`${HEADING} text-3xl`}>Competition not found</h1>
          <Link href="/dashboard" className={`${LABEL} mt-4 inline-block text-ink-fade underline decoration-dotted underline-offset-4 transition-colors hover:text-ink`}>
            Return to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const contactLine = [
    competition.address_line_1,
    competition.address_line_2,
    competition.city,
    competition.postcode
  ].filter(Boolean).join(', ');

  return (
    <div className="min-h-screen bg-stock font-body text-ink">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <header className="border-b border-ink/30">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/dashboard" className={`${LABEL} flex items-center gap-1.5 text-ink-fade transition-colors hover:text-ink`}>
            <ArrowLeftIcon className="h-4 w-4" />
            Dashboard
          </Link>
          {isOrganiser && <span className={`${LABEL} text-ink-fade`}>Organiser</span>}
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-8 sm:px-6 sm:py-10">

        {/* Masthead */}
        <div className={`${PANEL} p-6 sm:p-8`}>
          {competition.logo_url ? (
            <div className="flex items-center gap-5">
              <Image
                src={competition.logo_url}
                alt={`${competition.name} logo`}
                width={84}
                height={84}
                className="flex-shrink-0 border border-ink/30"
                unoptimized
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div>
                <p className={EYEBROW}>Last man standing</p>
                <h1 className={`${HEADING} mt-1 text-2xl sm:text-3xl`}>{competition.name}</h1>
                {competition.personal_name && (
                  <p className="mt-1 font-data text-[15px] italic text-ink-fade">{competition.personal_name}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center">
              <p className={EYEBROW}>Last man standing</p>
              <h1 className={`${HEADING} mt-1 text-2xl sm:text-3xl`}>{competition.name}</h1>
              {competition.personal_name && (
                <p className="mt-1 font-data text-[15px] italic text-ink-fade">{competition.personal_name}</p>
              )}
              {competition.venue_name && (
                <p className="mt-1 text-[15px] text-ink-fade">{competition.venue_name}</p>
              )}
            </div>
          )}

          {(contactLine || competition.phone || competition.email) && (
            <div className="mt-5 border-t border-ink/30 pt-4 text-center">
              {contactLine && <p className="text-[13px] text-ink-fade">{contactLine}</p>}
              {(competition.phone || competition.email) && (
                <div className="mt-2 flex items-center justify-center gap-4 text-[13px]">
                  {competition.phone && (
                    <a href={`tel:${competition.phone}`} className="text-ink-fade transition-colors hover:text-ink">
                      {competition.phone}
                    </a>
                  )}
                  {competition.email && (
                    <a href={`mailto:${competition.email}`} className="text-ink-fade transition-colors hover:text-ink">
                      {competition.email}
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Status ledger */}
        {currentRoundInfo && competition?.status !== 'COMPLETE' && (
          <>
            <div className={`${PANEL} p-6 text-center`}>
              <p className={EYEBROW}>Round {currentRoundInfo.round_number}</p>
              <p className="mt-2 font-display text-6xl text-overprint">{competition.player_count}</p>
              <p className={`${LABEL} mt-1 text-ink-fade`}>Still in</p>
            </div>

            {isParticipant && (
              <div className={`${PANEL} grid grid-cols-2 divide-x divide-ink/30`}>
                <div className="p-4 text-center">
                  <p className={`${LABEL} text-ink-fade`}>Your status</p>
                  <p className="mt-2 flex items-center justify-center gap-2 font-display text-lg uppercase text-ink">
                    <span className={`h-2 w-2 rounded-full ${competition.user_status === 'active' ? 'bg-moss' : 'bg-overprint'}`} />
                    {competition.user_status === 'active' ? 'In' : 'Out'}
                  </p>
                </div>
                <div className="p-4 text-center">
                  <p className={`${LABEL} text-ink-fade`}>Lives remaining</p>
                  <p className="mt-2 font-display text-lg text-ink">
                    {competition.lives_remaining !== undefined ? competition.lives_remaining : 0}
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Competition Completion Banner */}
        {competitionComplete.isComplete && (
          <div className={`${PANEL} p-6 text-center`}>
            <p className={EYEBROW}>Competition complete</p>
            {competitionComplete.winner ? (
              <>
                <p className={`${HEADING} mt-2 text-2xl sm:text-3xl`}>Winner: {competitionComplete.winner}</p>
              </>
            ) : (
              <p className={`${HEADING} mt-2 text-2xl sm:text-3xl`}>Draw &mdash; no players remaining</p>
            )}
            <Link
              href={`/game/${competitionId}/standings`}
              className={`${BTN_PRIMARY} mt-5 inline-flex items-center gap-2 px-6 py-3 text-base`}
            >
              <TrophyIcon className="h-4 w-4" />
              View final standings
            </Link>
          </div>
        )}

        {/* Invite Players */}
        {competition.invite_code && (isOrganiser || canManagePlayers) && (
          <div className={`${PANEL} p-6`}>
            <div className="text-center">
              <p className={EYEBROW}>Setup</p>
              <p className={`${HEADING} mt-1 text-2xl`}>Invite players</p>
            </div>

            <div className="mt-5 border-t border-ink/30 pt-5 text-center">
              <p className="text-[15px] text-ink-fade">
                Invite players to <span className="text-ink">lmslocal.co.uk</span> using competition code
              </p>
              <div className="mt-3 flex items-center justify-center gap-2">
                <code className="font-data text-2xl tracking-wider text-ink">{competition.invite_code}</code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(competition.invite_code || '');
                    setCodeCopied(true);
                    showToast('Competition code copied to clipboard!', 'success');
                    setTimeout(() => setCodeCopied(false), 2000);
                  }}
                  className={`${BTN_OUTLINE} px-3 py-1.5`}
                >
                  {codeCopied ? 'Copied' : 'Copy code'}
                </button>
              </div>

              <button
                onClick={() => {
                  // Format lock time if available
                  let lockTimeText = '';
                  if (currentRoundInfo?.lock_time) {
                    const lockDate = new Date(currentRoundInfo.lock_time);
                    lockTimeText = `\n⏰ First round locks: ${lockDate.toLocaleString('en-GB', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}`;
                  }

                  // Format entry details if available
                  let entryDetails = '';
                  const entryFee = competition.entry_fee ? Number(competition.entry_fee) : 0;
                  if (entryFee > 0) {
                    entryDetails = `\n💷 Entry: £${entryFee.toFixed(2)}`;
                    if (competition.prize_structure) {
                      entryDetails += `\n🏆 Prizes: ${competition.prize_structure}`;
                    }
                  } else if (competition.prize_structure) {
                    entryDetails = `\n🏆 Prizes: ${competition.prize_structure}`;
                  }

                  const message = `🏆 Last Man Standing Competition 🏆

I'm running a ${competition.name} competition!

📱 Download the app:
Search "LMS Local" in App Store or Google Play, then join using code: ${competition.invite_code}${lockTimeText}
${entryDetails}
Pick a team each round - if they win, you survive!

🌐 Or join on web: https://lmslocal.co.uk (use same code)

Good luck! ⚽`;
                  navigator.clipboard.writeText(message);
                  setMessageCopied(true);
                  showToast('Message copied! Paste it into WhatsApp, email, or any messaging app', 'success');
                  setTimeout(() => setMessageCopied(false), 2000);
                }}
                className={`${BTN_OUTLINE} mt-3`}
              >
                {messageCopied ? 'Copied — paste into your chat app' : 'Copy message for WhatsApp, email…'}
              </button>
            </div>

            <div className="mt-5 border-t border-ink/30 pt-5 text-center">
              <p className={`${LABEL} mb-3 text-ink-fade`}>Or add players directly</p>
              <button
                onClick={() => {
                  setShowAddPlayerModal(true);
                  setAddPlayerError(null);
                }}
                className={`${BTN_DARK} inline-flex items-center gap-2 px-5 py-2.5 text-base`}
              >
                <UserIcon className="h-4 w-4" />
                Add guest players
              </button>
            </div>
          </div>
        )}

        {/* Round Progress Card - Only show before lock when pick progress is useful */}
        {currentRoundInfo && competition?.status !== 'COMPLETE' && (
          <div className={`${PANEL} p-5`}>
            {!currentRoundInfo.is_locked ? (
              /* Before Lock - Show Pick Progress (Clickable) */
              <div className="space-y-4">
                <button
                  onClick={handleShowUnpickedPlayers}
                  className="group -m-1 block w-full p-1 text-left"
                >
                  <p className={`${LABEL} text-ink-fade`}>Round {currentRoundInfo.round_number} picks</p>

                  {pickStats && (
                    <>
                      <div className="mt-3 flex items-baseline justify-between gap-2">
                        <p className="font-data text-[15px] text-ink">
                          {Math.min(pickStats.players_with_picks, pickStats.total_active_players)} of {pickStats.total_active_players} picked
                        </p>
                        <p className={`${LABEL} text-ink-fade transition-colors group-hover:text-ink`}>
                          {Math.min(100, Math.round((pickStats.players_with_picks / pickStats.total_active_players) * 100))}%
                        </p>
                      </div>
                      <div className="mt-2 h-[3px] w-full bg-ink/15">
                        <div
                          className="h-[3px] bg-overprint transition-all duration-300"
                          style={{ width: `${Math.min(100, (pickStats.players_with_picks / pickStats.total_active_players) * 100)}%` }}
                        />
                      </div>
                    </>
                  )}
                </button>

                {/* Show previous round statistics if available */}
                {SHOW_ROUND_STATISTICS && roundStats && roundStats.round_number < currentRoundInfo.round_number && (
                  <button
                    onClick={() => router.push(`/game/${competitionId}/standings`)}
                    className="w-full border-t border-ink/30 pt-4 text-left transition-colors hover:bg-stock"
                  >
                    <p className={`${LABEL} mb-2 text-ink-fade`}>Round {roundStats.round_number} results</p>
                    <div className="flex h-12 overflow-hidden border border-ink/30">
                      {roundStats.won > 0 && (
                        <div
                          className="flex flex-col items-center justify-center bg-moss text-stock-lit"
                          style={{ width: `${(roundStats.won / roundStats.total_players) * 100}%` }}
                        >
                          <div className="font-display text-lg">{roundStats.won}</div>
                        </div>
                      )}
                      {(roundStats.lost - roundStats.eliminated) > 0 && (
                        <div
                          className="flex flex-col items-center justify-center bg-ink/40 text-stock-lit"
                          style={{ width: `${((roundStats.lost - roundStats.eliminated) / roundStats.total_players) * 100}%` }}
                        >
                          <div className="font-display text-lg">{roundStats.lost - roundStats.eliminated}</div>
                        </div>
                      )}
                      {roundStats.eliminated > 0 && (
                        <div
                          className="flex flex-col items-center justify-center bg-overprint text-stock-lit"
                          style={{ width: `${(roundStats.eliminated / roundStats.total_players) * 100}%` }}
                        >
                          <div className="font-display text-lg">{roundStats.eliminated}</div>
                        </div>
                      )}
                    </div>
                  </button>
                )}
              </div>
            ) : currentRoundInfo.status === 'COMPLETE' ? (
              /* Round Complete - Waiting for new fixtures */
              <div className="space-y-3">
                {SHOW_ROUND_STATISTICS && roundStats && (
                  <button
                    onClick={() => router.push(`/game/${competitionId}/standings`)}
                    className="w-full text-left transition-colors hover:bg-stock"
                  >
                    <p className={`${LABEL} mb-2 text-ink-fade`}>Round {roundStats.round_number} results</p>
                    <div className="flex h-12 overflow-hidden border border-ink/30">
                      {roundStats.won > 0 && (
                        <div
                          className="flex flex-col items-center justify-center bg-moss text-stock-lit"
                          style={{ width: `${(roundStats.won / roundStats.total_players) * 100}%` }}
                        >
                          <div className="font-display text-lg">{roundStats.won}</div>
                        </div>
                      )}
                      {(roundStats.lost - roundStats.eliminated) > 0 && (
                        <div
                          className="flex flex-col items-center justify-center bg-ink/40 text-stock-lit"
                          style={{ width: `${((roundStats.lost - roundStats.eliminated) / roundStats.total_players) * 100}%` }}
                        >
                          <div className="font-display text-lg">{roundStats.lost - roundStats.eliminated}</div>
                        </div>
                      )}
                      {roundStats.eliminated > 0 && (
                        <div
                          className="flex flex-col items-center justify-center bg-overprint text-stock-lit"
                          style={{ width: `${(roundStats.eliminated / roundStats.total_players) * 100}%` }}
                        >
                          <div className="font-display text-lg">{roundStats.eliminated}</div>
                        </div>
                      )}
                    </div>
                  </button>
                )}
              </div>
            ) : !competition.history?.[0] || (competition.history[0].round_number < currentRoundInfo.round_number) ? (
              /* After Lock, Before Results - Show Live Status */
              <div className="space-y-3 text-center">
                <p className={EYEBROW}>Round {currentRoundInfo.round_number} live</p>

                {SHOW_ROUND_STATISTICS && currentRoundStats && currentRoundStats.round_number === currentRoundInfo.round_number && currentRoundStats.total_players > 0 ? (
                  <button
                    onClick={() => router.push(`/game/${competitionId}/standings`)}
                    className="w-full text-left transition-colors hover:bg-stock"
                  >
                    <div className="flex h-12 overflow-hidden border border-ink/30">
                      {currentRoundStats.won > 0 && (
                        <div
                          className="flex flex-col items-center justify-center bg-moss text-stock-lit"
                          style={{ width: `${(currentRoundStats.won / currentRoundStats.total_players) * 100}%` }}
                        >
                          <div className="font-display text-lg">{currentRoundStats.won}</div>
                        </div>
                      )}
                      {(currentRoundStats.lost - currentRoundStats.eliminated) > 0 && (
                        <div
                          className="flex flex-col items-center justify-center bg-ink/40 text-stock-lit"
                          style={{ width: `${((currentRoundStats.lost - currentRoundStats.eliminated) / currentRoundStats.total_players) * 100}%` }}
                        >
                          <div className="font-display text-lg">{currentRoundStats.lost - currentRoundStats.eliminated}</div>
                        </div>
                      )}
                      {currentRoundStats.eliminated > 0 && (
                        <div
                          className="flex flex-col items-center justify-center bg-overprint text-stock-lit"
                          style={{ width: `${(currentRoundStats.eliminated / currentRoundStats.total_players) * 100}%` }}
                        >
                          <div className="font-display text-lg">{currentRoundStats.eliminated}</div>
                        </div>
                      )}
                    </div>
                  </button>
                ) : (
                  <button
                    onClick={handlePlayClick}
                    className={`${BTN_OUTLINE} w-full justify-center px-4 py-3`}
                  >
                    All picks made — check which teams have been chosen
                  </button>
                )}
              </div>
            ) : null
            }
          </div>
        )}

        {/* Competition Description */}
        {competition.description && (
          <div className={`${PANEL} p-5 text-center`}>
            <p className="text-[15px] text-ink-fade">{competition.description}</p>
          </div>
        )}

        {/* Action Buttons */}
        {(isOrganiser || canManageResults || canManageFixtures || canManagePlayers) ? (
          <div className={`grid gap-3 ${isParticipant ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-4'}`}>
            {/* Play button - only show if user is also a participant */}
            {isParticipant && (
              <button
                onClick={handlePlayClick}
                className={`${PANEL} flex flex-col items-center justify-center gap-2 p-5 transition-colors hover:border-ink ${
                  competition.needs_pick ? 'border-overprint' : ''
                }`}
              >
                <PlayIcon className={`h-6 w-6 ${competition.needs_pick ? 'text-overprint' : 'text-ink'}`} />
                <span className={`${LABEL} text-ink`}>Play</span>
                {competition.needs_pick && <span className={`${LABEL} text-overprint`}>Pick needed</span>}
              </button>
            )}

            {/* Fixture Management - Show if user has fixtures permission. Also reachable on
                automated competitions, as a manual backstop for fixing a round the fixture
                service got wrong. */}
            {canManageFixtures && (
              <Link
                href={`/game/${competitionId}/organizer-fixtures`}
                className={`${PANEL} flex flex-col items-center justify-center gap-2 p-5 transition-colors hover:border-ink`}
              >
                <CalendarIcon className="h-6 w-6 text-ink" />
                <span className={`${LABEL} text-ink`}>Fixtures</span>
              </Link>
            )}

            {/* Results Management - Show if user has results permission. Also reachable on
                automated competitions, as a manual backstop for fixing a round the fixture
                service got wrong. */}
            {canManageResults && (
              <Link
                href={`/game/${competitionId}/organizer-results`}
                className={`${PANEL} flex flex-col items-center justify-center gap-2 p-5 transition-colors hover:border-ink`}
              >
                <CheckCircleIcon className="h-6 w-6 text-ink" />
                <span className={`${LABEL} text-ink`}>Results</span>
              </Link>
            )}

            <Link
              href={`/game/${competitionId}/standings`}
              className={`${PANEL} flex flex-col items-center justify-center gap-2 p-5 transition-colors hover:border-ink`}
            >
              <TrophyIcon className="h-6 w-6 text-ink" />
              <span className={`${LABEL} text-ink`}>Standings</span>
            </Link>

            {/* Players Management - Show if user has players permission OR is organiser */}
            {canManagePlayers && (
              <Link
                href={`/game/${competitionId}/players`}
                className={`${PANEL} flex flex-col items-center justify-center gap-2 p-5 transition-colors hover:border-ink`}
              >
                <UserGroupIcon className="h-6 w-6 text-ink" />
                <span className={`${LABEL} text-ink`}>Players</span>
              </Link>
            )}

            {/* Promote - For organisers and users with manage_promote permission */}
            {canManagePromote && (
              <Link
                href={`/game/${competitionId}/promote`}
                className={`${PANEL} flex flex-col items-center justify-center gap-2 p-5 transition-colors hover:border-ink`}
              >
                <MegaphoneIcon className="h-6 w-6 text-ink" />
                <span className={`${LABEL} text-ink`}>Promote</span>
              </Link>
            )}

            {/* Settings - Only for main organisers */}
            {isOrganiser && (
              <Link
                href={`/game/${competitionId}/settings`}
                className={`${PANEL} flex flex-col items-center justify-center gap-2 p-5 transition-colors hover:border-ink`}
              >
                <Cog6ToothIcon className="h-6 w-6 text-ink" />
                <span className={`${LABEL} text-ink`}>Settings</span>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handlePlayClick}
              className={`${PANEL} flex flex-col items-center justify-center gap-2 p-5 transition-colors hover:border-ink ${
                competition.needs_pick ? 'border-overprint' : ''
              }`}
            >
              <PlayIcon className={`h-6 w-6 ${competition.needs_pick ? 'text-overprint' : 'text-ink'}`} />
              <span className={`${LABEL} text-ink`}>Play</span>
              {competition.needs_pick && <span className={`${LABEL} text-overprint`}>Pick needed</span>}
            </button>

            <Link
              href={`/game/${competitionId}/standings`}
              className={`${PANEL} flex flex-col items-center justify-center gap-2 p-5 transition-colors hover:border-ink`}
            >
              <TrophyIcon className="h-6 w-6 text-ink" />
              <span className={`${LABEL} text-ink`}>Standings</span>
            </Link>
          </div>
        )}

      </main>

      {/* Add Guest Player Modal */}
      {showAddPlayerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
          <div className={`${PANEL} w-full max-w-md p-6`}>
            <p className={EYEBROW}>Guest player</p>
            <h3 className={`${HEADING} mt-1 text-2xl`}>Add player</h3>

            <div className="mt-5">
              <label htmlFor="display_name" className={`${LABEL} mb-2 block text-ink-fade`}>
                Player name
              </label>
              <input
                id="display_name"
                type="text"
                value={addPlayerForm.display_name}
                onChange={(e) => setAddPlayerForm(prev => ({ ...prev, display_name: e.target.value }))}
                placeholder="Enter player name"
                className="w-full rounded-sm border border-ink bg-transparent px-3 py-2 font-data text-[15px] text-ink placeholder-ink-fade/60 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                disabled={addingPlayer}
              />

              <p className="mt-4 text-[13px] text-ink-fade">
                This creates a player that you can manage and set picks for. Perfect for customers who need assistance or don&apos;t have access to join themselves.
              </p>
            </div>

            {addPlayerError && (
              <div className="mt-4 border border-overprint px-3 py-2">
                <p className="text-[15px] text-ink">{addPlayerError}</p>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddPlayerModal(false);
                  setAddPlayerForm({ display_name: '' });
                  setAddPlayerError(null);
                }}
                disabled={addingPlayer}
                className={`${BTN_OUTLINE} px-4 py-2 disabled:opacity-50`}
              >
                Cancel
              </button>
              <button
                onClick={handleAddOfflinePlayer}
                disabled={addingPlayer || !addPlayerForm.display_name.trim()}
                className={`${BTN_PRIMARY} px-4 py-2 text-base disabled:opacity-50`}
              >
                {addingPlayer ? 'Adding player…' : 'Add player'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unpicked Players Modal */}
      {showUnpickedModal && pickStats && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
          <div className={`${PANEL} flex max-h-[80vh] w-full max-w-lg flex-col`}>
            <div className="flex items-center justify-between border-b border-ink/30 px-6 py-4">
              <h3 className={`${HEADING} text-xl`}>
                Round {currentRoundInfo?.round_number} picks
              </h3>
              <button
                onClick={() => setShowUnpickedModal(false)}
                className="text-ink-fade transition-colors hover:text-ink"
              >
                <span className="text-2xl leading-none">&times;</span>
              </button>
            </div>

            <div className="overflow-y-auto p-6">
              {loadingUnpicked ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="h-10 w-10 animate-spin rounded-full border-2 border-ink border-t-transparent" />
                  <p className="mt-4 text-ink-fade">Loading&hellip;</p>
                </div>
              ) : unpickedPlayers.length === 0 ? (
                <div className="py-8 text-center">
                  <p className={`${HEADING} text-xl`}>All players have picked</p>
                  <p className="mt-2 text-[15px] text-ink-fade">Everyone has made their selection for this round.</p>
                </div>
              ) : unpickedPlayers.length <= 10 ? (
                <div>
                  <p className="mb-4 text-[15px] text-ink-fade">
                    <span className="font-medium text-ink">{unpickedPlayers.length} {unpickedPlayers.length === 1 ? 'player has' : 'players have'}</span> not made their pick yet:
                  </p>
                  <div className="divide-y divide-ink/30 border-y border-ink/30">
                    {unpickedPlayers.map((player) => (
                      <div key={player.user_id} className="flex items-center gap-3 py-2.5">
                        <span className="h-2 w-2 flex-shrink-0 rounded-full bg-overprint" />
                        <span className="font-data text-[15px] text-ink">{player.display_name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center">
                  <p className="text-[15px] font-medium text-ink">
                    {unpickedPlayers.length} players have not made their pick yet
                  </p>
                  <p className="mt-1 text-[13px] text-ink-fade">
                    {Math.round((pickStats.players_with_picks / pickStats.total_active_players) * 100)}% complete
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-ink/30 px-6 py-4">
              <button onClick={() => setShowUnpickedModal(false)} className={`${BTN_OUTLINE} px-4 py-2`}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
