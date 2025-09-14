'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  FireIcon,
  ClockIcon,
  TrophyIcon,
  HeartIcon,
  CheckCircleIcon,
  XCircleIcon,
  MinusCircleIcon,
  LockClosedIcon,
  LockOpenIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import { userApi } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';

interface Competition {
  id: number;
  name: string;
  current_round: number;
  status?: string;
  current_round_lock_time?: string;
}

interface RoundHistory {
  round_id: number;
  round_number: number;
  lock_time: string;
  pick_team: string | null;
  pick_team_full_name: string | null;
  fixture: string | null;
  fixture_result: string | null;
  pick_result: 'no_pick' | 'pending' | 'win' | 'draw' | 'loss';
}

interface CurrentPick {
  team: string | null;
  team_full_name?: string | null;
  outcome: string | null;
  fixture: string | null;
}

interface Player {
  id: number;
  display_name: string;
  lives_remaining: number;
  status: string;
  current_pick: CurrentPick | null;
  history: RoundHistory[];
}

export default function CompetitionStandingsPage() {
  const router = useRouter();
  const params = useParams();
  const competitionId = params.id as string;

  const [competition, setCompetition] = useState<Competition | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ id: number; email: string; display_name: string } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const playersPerPage = 25;
  const paginationThreshold = 50;

  const loadStandings = useCallback(async () => {
    if (abortControllerRef.current?.signal.aborted) return;

    try {
      const standingsResponse = await userApi.getCompetitionStandings(parseInt(competitionId), true);

      if (abortControllerRef.current?.signal.aborted) return;

      if (standingsResponse.data.return_code === 'SUCCESS') {
        setCompetition(standingsResponse.data.competition as Competition);
        setPlayers(standingsResponse.data.players as Player[]);
        setCurrentPage(1); // Reset to first page when data changes
      } else {
        console.error('Failed to load standings:', standingsResponse.data.message);
        router.push(`/game/${competitionId}`);
      }
    } catch (error) {
      if (abortControllerRef.current?.signal.aborted) return;
      console.error('Failed to load standings:', error);
      router.push(`/game/${competitionId}`);
    } finally {
      if (!abortControllerRef.current?.signal.aborted) {
        setLoading(false);
      }
    }
  }, [competitionId, router]);

  useEffect(() => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const initializeData = async () => {
      const token = localStorage.getItem('jwt_token');

      if (!token) {
        if (!controller.signal.aborted) router.push('/login');
        return;
      }

      try {
        const user = getCurrentUser();
        if (!controller.signal.aborted) {
          setCurrentUser(user);
          await loadStandings();
        }
      } catch (error) {
        console.warn('Failed to load standings data:', error);
        if (!controller.signal.aborted) router.push('/login');
      }
    };

    initializeData();

    return () => {
      controller.abort();
    };
  }, [router, loadStandings]);

  const activePlayers = players.filter(p => p.status === 'active');
  const eliminatedPlayers = players.filter(p => p.status !== 'active');

  // Determine if pagination is needed
  const totalPlayers = players.length;
  const needsPagination = totalPlayers >= paginationThreshold;

  // Sort all players with current user first, then by name
  const sortedAllPlayers = [...activePlayers, ...eliminatedPlayers].sort((a, b) => {
    const aIsCurrentUser = currentUser?.id === a.id;
    const bIsCurrentUser = currentUser?.id === b.id;
    if (aIsCurrentUser && !bIsCurrentUser) return -1;
    if (!aIsCurrentUser && bIsCurrentUser) return 1;

    // Then by status (active first)
    if (a.status === 'active' && b.status !== 'active') return -1;
    if (a.status !== 'active' && b.status === 'active') return 1;

    // Then alphabetically
    return a.display_name.localeCompare(b.display_name);
  });

  // Calculate pagination
  const totalPages = needsPagination ? Math.ceil(totalPlayers / playersPerPage) : 1;
  const startIndex = needsPagination ? (currentPage - 1) * playersPerPage : 0;
  const endIndex = needsPagination ? startIndex + playersPerPage : totalPlayers;

  // Get players for current page
  const currentPagePlayers = needsPagination ? sortedAllPlayers.slice(startIndex, endIndex) : sortedAllPlayers;
  const currentPageActivePlayers = currentPagePlayers.filter(p => p.status === 'active');
  const currentPageEliminatedPlayers = currentPagePlayers.filter(p => p.status !== 'active');

  // Check if current round is locked
  const isCurrentRoundLocked = (() => {
    if (!competition?.current_round_lock_time) return false;
    const now = new Date();
    const lockTime = new Date(competition.current_round_lock_time);
    return now >= lockTime;
  })();

  // Determine if picks should be visible
  const isPickVisible = (playerId: number) => {
    const isOwnPlayer = currentUser && currentUser.id === playerId;
    const hasEnoughPlayersToHide = activePlayers.length <= 3;
    return isCurrentRoundLocked || !hasEnoughPlayersToHide || isOwnPlayer;
  };

  // Find the elimination pick (last losing pick that eliminated the player)
  const getEliminationPick = (player: Player) => {
    if (player.status === 'active') return null;

    // Find the last losing pick in their history
    for (let i = player.history.length - 1; i >= 0; i--) {
      const round = player.history[i];
      if (round.pick_result === 'loss' && round.pick_team_full_name) {
        return {
          team: round.pick_team_full_name,
          round: round.round_number,
          fixture: round.fixture,
          result: round.fixture_result
        };
      }
    }
    return null;
  };

  // Calculate player streaks and stats
  const getPlayerStats = (player: Player) => {
    const recentHistory = player.history.slice(-5); // Last 5 rounds
    let currentStreak = 0;
    let streakType: 'win' | 'loss' | null = null;

    if (recentHistory.length > 0) {
      const latestResult = recentHistory[recentHistory.length - 1]?.pick_result;
      if (latestResult === 'win' || latestResult === 'loss') {
        streakType = latestResult;

        // Count consecutive results of same type from the end
        for (let i = recentHistory.length - 1; i >= 0; i--) {
          if (recentHistory[i].pick_result === streakType) {
            currentStreak++;
          } else {
            break;
          }
        }
      }
    }

    const totalWins = recentHistory.filter(h => h.pick_result === 'win').length;
    const totalRounds = recentHistory.length;

    return {
      currentStreak,
      streakType,
      recentWins: totalWins,
      recentTotal: totalRounds,
      winRate: totalRounds > 0 ? Math.round((totalWins / totalRounds) * 100) : 0,
      recentForm: recentHistory.slice(-3).map(h => h.pick_result) // Last 3 for form display
    };
  };

  // Get winner status
  const getWinnerStatus = () => {
    if (competition?.status === 'COMPLETE' && activePlayers.length === 1) {
      return { isComplete: true, winner: activePlayers[0]?.display_name };
    } else if (competition?.status === 'COMPLETE' && activePlayers.length === 0) {
      return { isComplete: true, winner: null };
    }
    return { isComplete: false };
  };

  const winnerStatus = getWinnerStatus();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full shadow-lg mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-400 border-t-transparent"></div>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Loading Standings</h3>
          <p className="text-slate-600">Getting the latest results...</p>
        </div>
      </div>
    );
  }

  if (!competition) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h3 className="text-lg font-medium text-slate-900 mb-2">Competition Not Found</h3>
          <p className="text-slate-500">Unable to load competition data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-700 to-slate-800 shadow-lg sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link
                href={`/game/${competitionId}`}
                className="flex items-center space-x-2 text-slate-200 hover:text-white transition-colors group"
              >
                <ArrowLeftIcon className="h-5 w-5 group-hover:-translate-x-0.5 transition-transform" />
                <span className="font-medium">Back</span>
              </Link>
              <div className="h-6 w-px bg-slate-500" />
              <div>
                <h1 className="text-lg font-bold text-white flex items-center space-x-2">
                  <TrophyIcon className="h-5 w-5 text-yellow-400" />
                  <span>Final Standings</span>
                </h1>
              </div>
            </div>
            {winnerStatus.isComplete && winnerStatus.winner && (
              <div className="flex items-center space-x-2 text-green-300">
                <TrophyIcon className="h-6 w-6 text-yellow-400" />
                <span className="font-bold text-white">Champion: {winnerStatus.winner}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* Competition Status Hero */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 p-6 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">{competition.name}</h2>
                <div className="flex items-center space-x-4 text-slate-600">
                  <span className="flex items-center space-x-1">
                    <span className="font-medium">Round {competition.current_round}</span>
                  </span>
                  <span>•</span>
                  <span className="flex items-center space-x-1">
                    {isCurrentRoundLocked ? (
                      <LockClosedIcon className="h-4 w-4" />
                    ) : (
                      <LockOpenIcon className="h-4 w-4" />
                    )}
                    <span>{isCurrentRoundLocked ? 'Locked' : 'Open'}</span>
                  </span>
                  <span>•</span>
                  <span>{activePlayers.length} players remaining</span>
                </div>
              </div>
              {winnerStatus.isComplete && (
                <div className="text-center">
                  <TrophyIcon className="h-8 w-8 text-green-600 mx-auto mb-1" />
                  <div className="text-sm font-medium text-slate-700">
                    {winnerStatus.winner ? `${winnerStatus.winner} Wins!` : 'Draw!'}
                  </div>
                </div>
              )}
            </div>
          </div>

          {competition.current_round_lock_time && (
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-100">
              <div className="flex items-center space-x-2 text-sm text-slate-600">
                <ClockIcon className="h-4 w-4" />
                <span>
                  Round {isCurrentRoundLocked ? 'locked' : 'locks'}: {' '}
                  {new Date(competition.current_round_lock_time).toLocaleString('en-GB', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                  })}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Active Players */}
        {currentPageActivePlayers.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center space-x-2">
              <HeartIcon className="h-5 w-5 text-red-500" />
              <span>IN ({activePlayers.length} / {players.length}){needsPagination ? ` - Page ${currentPage} of ${totalPages}` : ''}</span>
            </h3>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {currentPageActivePlayers.map((player) => {
                const stats = getPlayerStats(player);
                const isCurrentUser = currentUser?.id === player.id;

                return (
                  <div
                    key={player.id}
                    className={`bg-white rounded-xl shadow-sm border-2 transition-all hover:shadow-md ${
                      isCurrentUser
                        ? 'border-blue-200 bg-blue-50/30'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Player Header */}
                    <div className="p-4 pb-3">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className={`font-semibold text-lg ${isCurrentUser ? 'text-blue-900' : 'text-slate-900'}`}>
                          {player.display_name}
                          {isCurrentUser && (
                            <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                              You
                            </span>
                          )}
                        </h4>

                        {/* Lives Display */}
                        <div className="flex items-center space-x-2">
                          <div className="flex space-x-1">
                            {[...Array(3)].map((_, i) => (
                              <HeartIcon
                                key={i}
                                className={`h-4 w-4 ${
                                  i < player.lives_remaining
                                    ? 'text-red-500 fill-current'
                                    : 'text-slate-300'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-sm font-medium text-slate-600">
                            {player.lives_remaining}
                          </span>
                        </div>
                      </div>

                      {/* Current Pick */}
                      {isPickVisible(player.id) && (
                        <div className="mb-3">
                          {player.current_pick && player.current_pick.outcome !== 'NO_PICK' ? (
                            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-3">
                              <div className="flex items-center space-x-2 mb-1">
                                <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                                <span className="text-sm font-medium text-green-800">Current Pick</span>
                              </div>
                              <div className="text-green-900 font-semibold">
                                {player.current_pick.team_full_name || player.current_pick.team}
                              </div>
                              {player.current_pick.fixture && (
                                <div className="text-sm text-green-700 mt-1">
                                  {player.current_pick.fixture}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                              <div className="flex items-center space-x-2 mb-1">
                                <MinusCircleIcon className="h-4 w-4 text-slate-400" />
                                <span className="text-sm font-medium text-slate-600">No Pick</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Stats & Streak */}
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-3">
                          {/* Recent Form */}
                          <div className="flex items-center space-x-1">
                            <span className="text-slate-600">Form:</span>
                            <div className="flex space-x-0.5">
                              {stats.recentForm.slice(-3).map((result, i) => (
                                <div
                                  key={i}
                                  className={`w-2 h-2 rounded-full ${
                                    result === 'win' ? 'bg-green-500' :
                                    result === 'loss' ? 'bg-red-500' :
                                    'bg-slate-300'
                                  }`}
                                />
                              ))}
                            </div>
                          </div>

                          {/* Win Rate */}
                          <div className="text-slate-600">
                            <span className="font-medium">{stats.winRate}%</span> win rate
                          </div>
                        </div>

                        {/* Streak */}
                        {stats.currentStreak > 1 && (
                          <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${
                            stats.streakType === 'win'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {stats.streakType === 'win' && <FireIcon className="h-3 w-3" />}
                            <span>
                              {stats.currentStreak} {stats.streakType === 'win' ? 'wins' : 'losses'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Recent History */}
                    {player.history.length > 0 && (
                      <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/50">
                        <h5 className="text-xs font-medium text-slate-700 mb-2 uppercase tracking-wide">
                          Recent History
                        </h5>
                        <div className="space-y-2">
                          {player.history.sort((a, b) => b.round_number - a.round_number).slice(0, 3).map((round) => (
                            <div key={round.round_id} className="flex items-center justify-between text-sm">
                              <div className="flex items-center space-x-2">
                                <span className="text-slate-600 font-medium">R{round.round_number}</span>
                                <span className="text-slate-900">
                                  {round.pick_team_full_name || 'No Pick'}
                                </span>
                              </div>
                              <div className="flex items-center space-x-1">
                                {round.pick_result === 'win' ? (
                                  <CheckCircleIcon className="h-4 w-4 text-green-500" />
                                ) : round.pick_result === 'loss' ? (
                                  <XCircleIcon className="h-4 w-4 text-red-500" />
                                ) : (
                                  <ClockIcon className="h-4 w-4 text-slate-400" />
                                )}
                                <span className={`text-xs font-medium ${
                                  round.pick_result === 'win' ? 'text-green-600' :
                                  round.pick_result === 'loss' ? 'text-red-600' :
                                  'text-slate-500'
                                }`}>
                                  {round.pick_result === 'win' ? 'WIN' :
                                   round.pick_result === 'loss' ? 'LOSE' :
                                   'PENDING'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Eliminated Players */}
        {currentPageEliminatedPlayers.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-600 flex items-center space-x-2">
              <XCircleIcon className="h-5 w-5 text-slate-500" />
              <span>Eliminated ({eliminatedPlayers.length})</span>
            </h3>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {currentPageEliminatedPlayers.map((player) => {
                const stats = getPlayerStats(player);
                const isCurrentUser = currentUser?.id === player.id;
                const eliminationPick = getEliminationPick(player);

                return (
                  <div
                    key={player.id}
                    className={`relative rounded-lg border-2 p-4 transition-all ${
                      isCurrentUser
                        ? 'bg-red-50/50 border-red-200 shadow-sm'
                        : 'bg-slate-50 border-slate-200 opacity-75'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className={`font-medium ${
                        isCurrentUser ? 'text-red-800' : 'text-slate-700'
                      }`}>
                        {player.display_name}
                        {isCurrentUser && (
                          <span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                            You
                          </span>
                        )}
                      </h4>
                      <div className="flex items-center space-x-1">
                        <XCircleIcon className="h-4 w-4 text-red-500" />
                        <span className={`text-xs px-2 py-1 rounded font-medium ${
                          isCurrentUser
                            ? 'bg-red-100 text-red-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          OUT
                        </span>
                      </div>
                    </div>

                    {/* Elimination Pick */}
                    {eliminationPick ? (
                      <div className={`text-sm mb-2 p-2 rounded border ${
                        isCurrentUser
                          ? 'bg-red-50 border-red-200 text-red-800'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}>
                        <div className="font-medium text-xs mb-1">
                          Eliminated in Round {eliminationPick.round}
                        </div>
                        <div className="font-semibold">
                          {eliminationPick.team}
                        </div>
                        {eliminationPick.fixture && (
                          <div className="text-xs mt-1 opacity-75">
                            {eliminationPick.fixture} • {eliminationPick.result || 'Lost'}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className={`text-xs mb-2 px-2 py-1 rounded ${
                        isCurrentUser
                          ? 'bg-red-100 text-red-700 border border-red-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        Eliminated
                      </div>
                    )}

                    <div className={`text-xs ${
                      isCurrentUser ? 'text-red-600' : 'text-slate-500'
                    }`}>
                      {stats.winRate}% win rate • Lasted {player.history.length} round{player.history.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pagination Controls */}
        {needsPagination && (
          <div className="mt-8 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-600">
                  Showing {startIndex + 1}-{Math.min(endIndex, totalPlayers)} of {totalPlayers} players
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      currentPage === 1
                        ? 'text-slate-400 cursor-not-allowed'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <ChevronLeftIcon className="h-4 w-4 mr-1" />
                    Previous
                  </button>

                  <div className="flex items-center space-x-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          currentPage === page
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      currentPage === totalPages
                        ? 'text-slate-400 cursor-not-allowed'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Next
                    <ChevronRightIcon className="h-4 w-4 ml-1" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}