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
  CalendarDaysIcon,
  PlayIcon,
  UserIcon,
  MegaphoneIcon
} from '@heroicons/react/24/outline';
import { Competition as CompetitionType, userApi, roundApi, competitionApi, offlinePlayerApi } from '@/lib/api';
import { useAppData } from '@/contexts/AppDataContext';
import MarketingDisplay from '@/components/MarketingDisplay';
import { useToast, ToastContainer } from '@/components/Toast';

export default function UnifiedGameDashboard() {
  const router = useRouter();
  const params = useParams();
  const competitionId = params.id as string;
  
  // Use AppDataProvider context for competitions data
  const { competitions, loading: contextLoading, latestRoundStats, user } = useAppData();
  
  // Memoize the specific competition to prevent unnecessary re-renders
  const competition = useMemo(() => {
    return competitions?.find(c => c.id.toString() === competitionId);
  }, [competitions, competitionId]);

  const [winnerName, setWinnerName] = useState<string>('Loading...');
  const [currentRoundInfo, setCurrentRoundInfo] = useState<{
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
  const [needsFixtures, setNeedsFixtures] = useState(false);

  // Toast notifications
  const { toasts, showToast, removeToast } = useToast();

  // Guest player modal state
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [addPlayerForm, setAddPlayerForm] = useState({ display_name: '', email: '' });
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
  const winnerLoadedRef = useRef(false);
  const roundLoadedRef = useRef(false);
  const pickStatsLoadedRef = useRef(false);
  
  // User role detection
  const isOrganiser = competition?.is_organiser || false;
  const isParticipant = competition?.is_participant || false;
  
  // Winner detection only shows when competition status is COMPLETE
  const getWinnerStatus = (comp: CompetitionType) => {
    const playerCount = comp.player_count || 0;
    const isComplete = comp.status === 'COMPLETE';
    
    if (isComplete && playerCount === 1) return { isComplete: true, winner: winnerName, isDraw: false };
    if (isComplete && playerCount === 0) return { isComplete: true, winner: undefined, isDraw: true };
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
      // Eliminated non-organizer players can view results but cannot make picks
      if (competition?.user_status && competition.user_status !== 'active' && !isOrganiser) {
        // Eliminated player - always show player results view (never allow picking)
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

  // Handle fixtures button click - check for rounds and fixtures before routing
  const handleFixturesClick = async () => {
    try {
      const response = await roundApi.getRounds(parseInt(competitionId));
      
      if (response.data.return_code !== 'SUCCESS') {
        console.error('Failed to fetch rounds:', response.data.message);
        // If API fails, go to fixtures screen to handle creation
        router.push(`/game/${competitionId}/fixtures`);
        return;
      }
      
      const rounds = response.data.rounds || [];
      
      // Check if no rounds exist OR if the latest round has no fixtures
      if (rounds.length === 0 || rounds[0].fixture_count === 0) {
        router.push(`/game/${competitionId}/fixtures`);
        return;
      }
      
      // Round has fixtures - check if it's locked
      const latestRound = rounds[0];
      const now = new Date();
      const lockTime = new Date(latestRound.lock_time || '');
      const isLocked = latestRound.lock_time && now >= lockTime;
      
      if (isLocked) {
        // Round is locked - go to results screen
        router.push(`/game/${competitionId}/results`);
      } else {
        // Round is not locked yet - go to fixtures screen
        router.push(`/game/${competitionId}/fixtures`);
      }
      
    } catch (error) {
      console.error('Error checking rounds for fixtures:', error);
      // On error, fallback to fixtures screen
      router.push(`/game/${competitionId}/fixtures`);
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
        addPlayerForm.display_name.trim(),
        addPlayerForm.email.trim() || undefined
      );

      if (response.data.return_code === 'SUCCESS') {
        // Clear any cache related to competition players/data
        const { cacheUtils } = await import('@/lib/api');
        cacheUtils.invalidateKey(`competition-players-${competition.id}`);
        cacheUtils.invalidateKey(`user-dashboard`);

        // Reset form and close modal
        setAddPlayerForm({ display_name: '', email: '' });
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
                  round_number: latestRound.round_number,
                  lock_time: latestRound.lock_time,
                  fixture_count: latestRound.fixture_count || 0,
                  is_locked: isLocked,
                  completed_fixtures: latestRound.completed_fixtures || 0,
                  status: latestRound.status
                });

                // Check if this is a new competition needing fixtures
                setNeedsFixtures(latestRound.fixture_count === 0 && latestRound.round_number === 1);
              } else {
                setCurrentRoundInfo(null);
                // No rounds at all - definitely needs fixtures
                setNeedsFixtures(true);
              }
            }
            setLoadingRound(false);
          })
          .catch(() => {
            setLoadingRound(false);
            roundLoadedRef.current = false; // Reset on error to allow retry
          });
      }
      
      // Load winner name if competition is COMPLETE
      if (competition.status === 'COMPLETE' && competition.player_count === 1 && !winnerLoadedRef.current) {
        winnerLoadedRef.current = true;
        userApi.getCompetitionStandings(parseInt(competitionId))
          .then(response => {
            if (response.data.return_code === 'SUCCESS') {
              const players = (response.data.players as { status: string; display_name: string }[]) || [];
              const activePlayer = players.find(p => p.status !== 'OUT');
              setWinnerName(activePlayer?.display_name || 'Unknown Winner');
            }
          })
          .catch(() => {
            setWinnerName('Unknown Winner');
            winnerLoadedRef.current = false; // Reset on error to allow retry
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
    }
  }, [competition, competitionId, router, currentRoundInfo]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Toast Container */}
        <ToastContainer toasts={toasts} onClose={removeToast} />

        <header className="bg-white border-b border-gray-100">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Link href="/dashboard" className="flex items-center space-x-2 text-gray-500 hover:text-gray-700">
                  <ArrowLeftIcon className="h-4 w-4" />
                  <span className="text-sm font-medium">Dashboard</span>
                </Link>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-6">
          <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-8">
            <div className="flex items-center justify-center">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-50 rounded-full mb-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-600 border-t-transparent"></div>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Loading Game Dashboard</h3>
                <p className="text-gray-500">Please wait while we fetch your competition data...</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!competition) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Competition Not Found</h1>
          <Link href="/dashboard" className="text-gray-600 hover:text-gray-800">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast Container */}
      <ToastContainer toasts={toasts} onClose={removeToast} />

      {/* Header */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                href="/dashboard"
                className="flex items-center space-x-2 text-gray-500 hover:text-gray-700"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                <span className="text-sm font-medium">Dashboard</span>
              </Link>
            </div>

            {/* User role badge */}
            {isOrganiser && (
              <div className="text-sm text-gray-500">Organiser</div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* Competition Name - Always visible */}
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4">
          <div className="text-center">
            <h1 className="text-xl font-bold text-gray-900">{competition.name}</h1>
            {competition.personal_name && (
              <p className="text-sm text-gray-600 italic mt-1">{competition.personal_name}</p>
            )}
            {competition.venue_name && (
              <p className="text-sm text-gray-600 mt-1">{competition.venue_name}</p>
            )}
          </div>
        </div>

        {/* Competition Logo & Extended Branding Section */}
        {competition.logo_url && (
          <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-center">
              <div className="text-center">
                <div className="flex justify-center mb-4">
                  <Image
                    src={competition.logo_url}
                    alt="Competition logo"
                    width={80}
                    height={80}
                    className="w-20 h-20 rounded-lg object-cover shadow-md"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
                {competition.venue_name && (
                  <p className="text-sm text-gray-600 mb-3">
                    {competition.venue_name}
                  </p>
                )}

                {/* Compact Address Display */}
                {(competition.address_line_1 || competition.city || competition.postcode) && (
                  <p className="text-xs text-gray-500 mb-1">
                    {[
                      competition.address_line_1,
                      competition.address_line_2,
                      competition.city,
                      competition.postcode
                    ].filter(Boolean).join(', ')}
                  </p>
                )}

                {/* Contact Links */}
                {(competition.phone || competition.email) && (
                  <div className="flex items-center justify-center gap-3 text-xs">
                    {competition.phone && (
                      <a
                        href={`tel:${competition.phone}`}
                        className="text-gray-500 hover:text-gray-700 flex items-center gap-1 transition-colors"
                      >
                        <span>📞</span>
                        <span>{competition.phone}</span>
                      </a>
                    )}
                    {competition.email && (
                      <a
                        href={`mailto:${competition.email}`}
                        className="text-gray-500 hover:text-gray-700 flex items-center gap-1 transition-colors"
                      >
                        <span>✉️</span>
                        <span>{competition.email}</span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Current Status Card - Clean and minimal */}
        {latestRoundStats &&
         latestRoundStats.competition_id === parseInt(competitionId) && (
          <div className="bg-white rounded-lg border border-gray-100 shadow-sm">
            <div className="p-4 border-b border-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {competition.user_status === 'active' ? (
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  ) : (
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  )}
                  <span className="text-sm font-medium text-gray-900">
                    Your Status: {competition.user_status === 'active' ? 'Still In' : 'Eliminated'}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  {currentRoundInfo?.status === 'COMPLETE' ? 'Round Complete' : 'Latest Results'}
                </div>
              </div>
            </div>

            <div className="p-4">
              <div className="text-center mb-4">
                {latestRoundStats.survivors > 1 && (
                  <>
                    <div className="text-2xl font-bold text-gray-900 mb-1">Round {latestRoundStats.round_number} Complete</div>
                    <div className="text-sm text-gray-600">
                      {latestRoundStats.eliminated_this_round === 0
                        ? `All players survived - Advance to Round ${latestRoundStats.round_number + 1}`
                        : `Advance to Round ${latestRoundStats.round_number + 1}`
                      }
                    </div>
                  </>
                )}

                {latestRoundStats.survivors === 1 && (
                  <>
                    <div className="text-2xl font-bold text-gray-900 mb-1">👑 Champion Found!</div>
                    <div className="text-sm text-gray-600">Competition Complete</div>
                  </>
                )}

                {latestRoundStats.survivors === 0 && (
                  <>
                    <div className="text-2xl font-bold text-gray-900 mb-1">😱 Draw Game!</div>
                    <div className="text-sm text-gray-600">No players remaining</div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-lg font-semibold text-green-600">{latestRoundStats.survivors}</div>
                  <div className="text-xs text-gray-500">Still In</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-red-500">{latestRoundStats.eliminated_this_round}</div>
                  <div className="text-xs text-gray-500">Eliminated</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-gray-600">{latestRoundStats.total_players}</div>
                  <div className="text-xs text-gray-500">Started</div>
                </div>
              </div>

              {/* Personal Status for Participants */}
              {isParticipant && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="text-center">
                    <div className={`text-lg font-semibold mb-2 ${
                      competition.user_status === 'active' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {latestRoundStats.survivors === 1 && competition.user_status === 'active'
                        ? '🏆 You Are The Winner!'
                        : competition.user_status === 'active'
                        ? 'You Advanced!'
                        : 'You Were Eliminated'}
                    </div>

                    {/* Show round-specific details */}
                    <div className="space-y-1 text-sm text-gray-600">
                      {latestRoundStats.user_outcome && (
                        <div>
                          Round {latestRoundStats.round_number}: {
                            latestRoundStats.user_outcome === 'WIN' ? 'Advanced' :
                            latestRoundStats.user_outcome === 'LOSS' ? 'Eliminated' :
                            'Draw'
                          }
                        </div>
                      )}

                      {latestRoundStats.user_picked_team && (
                        <div>Picked: {latestRoundStats.user_picked_team}</div>
                      )}

                      {competition.lives_remaining !== undefined && competition.lives_remaining > 0 && (
                        <div>Lives Remaining: {competition.lives_remaining}</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Competition Completion Banner */}
        {competitionComplete.isComplete && (
          <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4">
            <div className="text-center">
              <TrophyIcon className="h-8 w-8 text-gray-600 mx-auto mb-3" />

              {competitionComplete.winner ? (
                <>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">🎉 Competition Complete!</h3>
                  <div className="mb-3">
                    <p className="text-sm text-gray-600">Winner</p>
                    <p className="text-lg font-bold text-gray-900">{competitionComplete.winner}</p>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">🤝 Competition Complete!</h3>
                  <div className="mb-3">
                    <p className="text-sm text-gray-600">Result: Draw</p>
                    <p className="text-sm text-gray-500">No players remaining</p>
                  </div>
                </>
              )}

              <Link
                href={`/game/${competitionId}/standings`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors text-sm"
              >
                <TrophyIcon className="h-4 w-4" />
                View Final Standings
              </Link>
            </div>
          </div>
        )}

        {/* Invite Players - Enhanced with Guest Player Option */}
        {competition.invite_code && (
          <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4">
            <div className="space-y-4">
              {/* Header with subtle outstanding step messaging */}
              <div className="text-center">
                <div className="text-sm font-medium text-gray-900 mb-1">Invite Players</div>
                <div className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full inline-block">
                  Complete setup by adding players
                </div>
              </div>

              {/* Invite Code */}
              <div className="text-center border-b border-gray-100 pb-4">
                <div className="text-xs text-gray-600 mb-2">Invite players to</div>
                <div className="text-sm font-medium text-blue-600 mb-2">https://lmslocal.co.uk</div>
                <div className="text-xs text-gray-600 mb-2">using competition code:</div>
                <div className="flex items-center justify-center space-x-2 mb-3">
                  <code className="text-lg font-mono font-bold text-gray-800 tracking-wider">
                    {competition.invite_code}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(competition.invite_code || '');
                      setCodeCopied(true);
                      showToast('Competition code copied to clipboard!', 'success');
                      setTimeout(() => setCodeCopied(false), 2000);
                    }}
                    className={`text-xs px-2 py-1 rounded border transition-colors ${
                      codeCopied
                        ? 'text-green-600 bg-green-50 border-green-300'
                        : 'text-gray-500 hover:text-gray-700 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {codeCopied ? '✓ Copied!' : 'Copy Code'}
                  </button>
                </div>

                {/* Copy Message Button */}
                <button
                  onClick={() => {
                    const message = `🏆 Join our Last Man Standing competition!\n\nGo to: https://lmslocal.co.uk\nUse code: ${competition.invite_code}\n\nGood luck! ⚽`;
                    navigator.clipboard.writeText(message);
                    setMessageCopied(true);
                    showToast('Message copied! Paste it into WhatsApp, email, or any messaging app', 'success');
                    setTimeout(() => setMessageCopied(false), 2000);
                  }}
                  className={`text-xs px-3 py-1 rounded border transition-colors ${
                    messageCopied
                      ? 'text-green-700 bg-green-100 border-green-400 font-medium'
                      : 'text-green-600 hover:text-green-700 border-green-200 hover:border-green-300 bg-green-50 hover:bg-green-100'
                  }`}
                >
                  {messageCopied ? '✓ Copied - Paste into your chat app!' : '📱 Copy Message (WhatsApp, email, etc.)'}
                </button>
              </div>

              {/* Add Guest Player Option */}
              <div className="text-center">
                <div className="text-xs text-gray-600 mb-3">Or add players directly</div>
                <button
                  onClick={() => {
                    setShowAddPlayerModal(true);
                    setAddPlayerError(null);
                  }}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-lg hover:bg-gray-900 transition-colors"
                >
                  <UserIcon className="h-4 w-4 mr-2" />
                  Add Guest Players
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Status Cards - Compact design */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Personal Status Card - Only visible for participants in active competitions */}
          {isParticipant && competition?.status !== 'COMPLETE' && (
            <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  {competition.user_status === 'active' ? (
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  ) : (
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  )}
                  <div className="text-sm font-medium text-gray-900">
                    {competition.user_status === 'active' ? (
                      currentRoundInfo?.round_number || competition.current_round
                        ? `Active in Round ${currentRoundInfo?.round_number || competition.current_round}`
                        : 'Active - Waiting for first round'
                    ) : (
                      `Eliminated ${competition.history?.find(h => h.pick_result === 'loss' || h.pick_result === 'no_pick') ? `in Round ${competition.history.find(h => h.pick_result === 'loss' || h.pick_result === 'no_pick')?.round_number}` : ''}`
                    )}
                  </div>
                </div>

                {competition.history?.[0] && competition.history[0].pick_team && (
                  <div className="text-xs text-gray-600 space-y-1">
                    <div>
                      Round {competition.history[0].round_number}: {competition.history[0].pick_team_full_name || competition.history[0].pick_team}
                      {competition.history[0].pick_result === 'loss' && (
                        <span className="text-red-600 font-medium"> (Lost)</span>
                      )}
                      {competition.history[0].pick_result === 'no_pick' && (
                        <span className="text-amber-600 font-medium"> (No Pick)</span>
                      )}
                      {competition.history[0].pick_result === 'win' && (
                        <span className="text-green-600 font-medium"> (Won)</span>
                      )}
                    </div>
                    {competition.history[0].fixture && (
                      <div className="text-gray-500">{competition.history[0].fixture}</div>
                    )}
                  </div>
                )}

                {competition.lives_remaining !== undefined && competition.lives_remaining > 0 && (
                  <div className="text-xs text-gray-600">
                    {competition.lives_remaining} lives remaining
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Round Status Card - Context-aware */}
          {/* Only show this card if competition is not complete */}
          {currentRoundInfo && competition?.status !== 'COMPLETE' && (
            <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4">
              {!currentRoundInfo.is_locked ? (
                /* Before Lock - Show Pick Progress (Clickable) */
                <div
                  className="space-y-3 cursor-pointer hover:bg-gray-50 p-3 rounded-lg transition-colors -mx-3"
                  onClick={handleShowUnpickedPlayers}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleShowUnpickedPlayers()}
                >
                  <div className="text-sm font-medium text-gray-900">
                    Round {currentRoundInfo.round_number} Progress
                  </div>

                  {pickStats && (
                    <>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, (pickStats.players_with_picks / pickStats.total_active_players) * 100)}%` }}
                        ></div>
                      </div>

                      <div className="text-xs text-gray-500">
                        {Math.min(pickStats.players_with_picks, pickStats.total_active_players)} of {pickStats.total_active_players} picked
                        <span className="ml-2 font-medium">
                          {Math.min(100, Math.round((pickStats.players_with_picks / pickStats.total_active_players) * 100))}%
                        </span>
                      </div>
                    </>
                  )}
                </div>
              ) : !competition.history?.[0] || (competition.history[0].round_number < currentRoundInfo.round_number) ? (
                /* After Lock, Before Results - Show Live Status */
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <div className="text-sm font-medium text-gray-900">
                      Round {currentRoundInfo.round_number} Live
                    </div>
                  </div>

                  <div className="text-sm text-gray-600">⚽ Round in progress</div>
                  <div className="text-xs text-gray-500">
                    Results will be processed as matches complete throughout the round
                  </div>
                </div>
              ) : null
              }
            </div>
          )}
        </div>

{/* Action Buttons - Refined design */}
        {isOrganiser ? (
          <div className={`grid gap-4 ${isParticipant ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6' : 'grid-cols-2 sm:grid-cols-5'}`}>
            {/* Play button - only show if organizer is also a participant */}
            {isParticipant && (
              <button
                onClick={handlePlayClick}
                className="group bg-white rounded-lg border border-gray-100 shadow-sm p-4 hover:shadow-md transition-all"
              >
                <div className="flex flex-col items-center space-y-2">
                  <div className={`p-2 rounded-lg ${
                    competition.needs_pick ? 'bg-red-50 group-hover:bg-red-100' : 'bg-gray-50 group-hover:bg-gray-100'
                  }`}>
                    <PlayIcon className={`h-5 w-5 ${
                      competition.needs_pick ? 'text-red-600' : 'text-gray-600'
                    }`} />
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-semibold text-gray-900">
                      {currentRoundInfo?.is_locked ? 'Results' : 'Make Pick'}
                    </div>
                    {currentRoundInfo?.is_locked ? (
                      <div className="text-xs text-gray-500">See results</div>
                    ) : competition.needs_pick ? (
                      <div className="text-xs text-red-600 font-medium">Now!</div>
                    ) : (
                      <div className="text-xs text-gray-500">Make your picks</div>
                    )}
                  </div>
                </div>
              </button>
            )}

            <button
              onClick={handleFixturesClick}
              className={`group bg-white rounded-lg border border-gray-100 shadow-sm p-4 hover:shadow-md transition-all relative ${
                needsFixtures ? 'ring-2 ring-blue-100' : ''
              }`}
            >
              {needsFixtures && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></div>
              )}
              <div className="flex flex-col items-center space-y-2">
                <div className={`p-2 rounded-lg ${
                  needsFixtures ? 'bg-blue-50 group-hover:bg-blue-100' : 'bg-gray-50 group-hover:bg-gray-100'
                }`}>
                  <CalendarDaysIcon className={`h-5 w-5 ${
                    needsFixtures ? 'text-blue-600' : 'text-gray-600'
                  }`} />
                </div>
                <div className="text-center">
                  <div className="text-sm font-semibold text-gray-900">Fixtures</div>
                  {needsFixtures ? (
                    <div className="text-xs text-blue-600 font-medium">Set up now</div>
                  ) : (
                    <div className="text-xs text-gray-500">Manage rounds</div>
                  )}
                </div>
              </div>
            </button>

            <Link
              href={`/game/${competitionId}/standings`}
              className="group bg-white rounded-lg border border-gray-100 shadow-sm p-4 hover:shadow-md transition-all"
            >
              <div className="flex flex-col items-center space-y-2">
                <div className="p-2 bg-gray-50 rounded-lg group-hover:bg-gray-100">
                  <TrophyIcon className="h-5 w-5 text-gray-600" />
                </div>
                <div className="text-center">
                  <div className="text-sm font-semibold text-gray-900">Standings</div>
                  <div className="text-xs text-gray-500">View leaderboard</div>
                </div>
              </div>
            </Link>

            <Link
              href={`/game/${competitionId}/players`}
              className="group bg-white rounded-lg border border-gray-100 shadow-sm p-4 hover:shadow-md transition-all"
            >
              <div className="flex flex-col items-center space-y-2">
                <div className="p-2 bg-gray-50 rounded-lg group-hover:bg-gray-100">
                  <UserGroupIcon className="h-5 w-5 text-gray-600" />
                </div>
                <div className="text-center">
                  <div className="text-sm font-semibold text-gray-900">Players</div>
                  <div className="text-xs text-gray-500">Manage players</div>
                </div>
              </div>
            </Link>

            <Link
              href={`/game/${competitionId}/marketing`}
              className="group bg-white rounded-lg border border-gray-100 shadow-sm p-4 hover:shadow-md transition-all"
            >
              <div className="flex flex-col items-center space-y-2">
                <div className="p-2 bg-gray-50 rounded-lg group-hover:bg-gray-100">
                  <MegaphoneIcon className="h-5 w-5 text-gray-600" />
                </div>
                <div className="text-center">
                  <div className="text-sm font-semibold text-gray-900">Marketing</div>
                  <div className="text-xs text-gray-500">Manage posts</div>
                </div>
              </div>
            </Link>

            <Link
              href={`/game/${competitionId}/settings`}
              className="group bg-white rounded-lg border border-gray-100 shadow-sm p-4 hover:shadow-md transition-all"
            >
              <div className="flex flex-col items-center space-y-2">
                <div className="p-2 bg-gray-50 rounded-lg group-hover:bg-gray-100">
                  <Cog6ToothIcon className="h-5 w-5 text-gray-600" />
                </div>
                <div className="text-center">
                  <div className="text-sm font-semibold text-gray-900">Settings</div>
                  <div className="text-xs text-gray-500">Competition settings</div>
                </div>
              </div>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={handlePlayClick}
              className="group bg-white rounded-lg border border-gray-100 shadow-sm p-4 hover:shadow-md transition-all"
            >
              <div className="flex flex-col items-center space-y-2">
                <div className={`p-2 rounded-lg ${
                  competition.needs_pick ? 'bg-red-50 group-hover:bg-red-100' : 'bg-gray-50 group-hover:bg-gray-100'
                }`}>
                  <PlayIcon className={`h-5 w-5 ${
                    competition.needs_pick ? 'text-red-600' : 'text-gray-600'
                  }`} />
                </div>
                <div className="text-center">
                  <div className="text-sm font-semibold text-gray-900">
                    {currentRoundInfo?.is_locked ? 'Results' : 'Make Pick'}
                  </div>
                  {currentRoundInfo?.is_locked ? (
                    <div className="text-xs text-gray-500">See results</div>
                  ) : competition.needs_pick ? (
                    <div className="text-xs text-red-600 font-medium">Round {currentRoundInfo?.round_number || 'Next'}</div>
                  ) : (
                    <div className="text-xs text-gray-500">Make your picks</div>
                  )}
                </div>
              </div>
            </button>

            <Link
              href={`/game/${competitionId}/standings`}
              className="group bg-white rounded-lg border border-gray-100 shadow-sm p-4 hover:shadow-md transition-all"
            >
              <div className="flex flex-col items-center space-y-2">
                <div className="p-2 bg-gray-50 rounded-lg group-hover:bg-gray-100">
                  <TrophyIcon className="h-5 w-5 text-gray-600" />
                </div>
                <div className="text-center">
                  <div className="text-sm font-semibold text-gray-900">Standings</div>
                  <div className="text-xs text-gray-500">View leaderboard</div>
                </div>
              </div>
            </Link>
          </div>
        )}

        {/* Marketing Content - placed at bottom to not interfere with game functionality */}
        <MarketingDisplay
          competitionId={parseInt(competitionId)}
          className="mt-2"
          user={user}
        />

      </main>

      {/* Add Guest Player Modal */}
      {showAddPlayerModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200">
            <div className="p-8">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mr-4">
                  <UserIcon className="h-6 w-6 text-slate-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900">Add Player</h3>
              </div>

              <div className="space-y-6">
                <div>
                  <label htmlFor="display_name" className="block text-sm font-semibold text-slate-700 mb-2">
                    Player Name *
                  </label>
                  <input
                    id="display_name"
                    type="text"
                    value={addPlayerForm.display_name}
                    onChange={(e) => setAddPlayerForm(prev => ({ ...prev, display_name: e.target.value }))}
                    placeholder="Enter player name"
                    className="block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm transition-colors"
                    disabled={addingPlayer}
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-2">
                    Email Address <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={addPlayerForm.email}
                    onChange={(e) => setAddPlayerForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="player@email.com"
                    className="block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm transition-colors"
                    disabled={addingPlayer}
                  />
                </div>

                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <p className="text-sm text-slate-600">
                    💡 This creates a player that you can set picks for on the fixtures page. Perfect for customers who need assistance or don&apos;t have access to join themselves.
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-4 mt-8">
                <button
                  onClick={() => {
                    setShowAddPlayerModal(false);
                    setAddPlayerForm({ display_name: '', email: '' });
                    setAddPlayerError(null);
                  }}
                  disabled={addingPlayer}
                  className="px-6 py-3 text-sm font-semibold text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddOfflinePlayer}
                  disabled={addingPlayer || !addPlayerForm.display_name.trim()}
                  className="px-6 py-3 text-sm font-semibold text-white bg-slate-800 rounded-xl hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {addingPlayer ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                      Adding Player...
                    </div>
                  ) : (
                    'Add Player'
                  )}
                </button>
              </div>

              {/* Error message */}
              {addPlayerError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{addPlayerError}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Unpicked Players Modal */}
      {showUnpickedModal && pickStats && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-slate-800 text-white px-6 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">
                  Round {currentRoundInfo?.round_number} Picks
                </h3>
                <button
                  onClick={() => setShowUnpickedModal(false)}
                  className="text-slate-300 hover:text-white transition-colors"
                >
                  <span className="text-2xl">×</span>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {loadingUnpicked ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-slate-800"></div>
                  <p className="mt-4 text-slate-600">Loading...</p>
                </div>
              ) : unpickedPlayers.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-4">🎉</div>
                  <h4 className="text-xl font-bold text-slate-900 mb-2">All players have picked!</h4>
                  <p className="text-slate-600">Everyone has made their selection for this round.</p>
                </div>
              ) : unpickedPlayers.length <= 10 ? (
                <div>
                  <p className="text-sm text-slate-600 mb-4">
                    <span className="font-semibold text-slate-900">{unpickedPlayers.length} {unpickedPlayers.length === 1 ? 'player has' : 'players have'}</span> not made their pick yet:
                  </p>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {unpickedPlayers.map((player) => (
                      <div
                        key={player.user_id}
                        className="flex items-center py-2 px-3 bg-slate-50 rounded-lg"
                      >
                        <div className="w-2 h-2 bg-orange-500 rounded-full mr-3"></div>
                        <span className="text-slate-900">{player.display_name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-lg font-semibold text-slate-900 mb-2">
                    {unpickedPlayers.length} players have not made their pick yet
                  </p>
                  <p className="text-slate-600">
                    {Math.round((pickStats.players_with_picks / pickStats.total_active_players) * 100)}% complete
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-4 flex justify-end border-t border-slate-200">
              <button
                onClick={() => setShowUnpickedModal(false)}
                className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}