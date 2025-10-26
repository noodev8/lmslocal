'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  ClockIcon,
  TrophyIcon,
  HeartIcon,
  CheckCircleIcon,
  XCircleIcon,
  MinusCircleIcon,
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

interface EliminationPick {
  round_number: number;
  team: string;
  fixture: string | null;
  result: string | null;
}

interface Player {
  id: number;
  display_name: string;
  lives_remaining: number;
  status: string;
  current_pick: CurrentPick | null;
  elimination_pick?: EliminationPick | null;
}

export default function CompetitionStandingsPage() {
  const router = useRouter();
  const params = useParams();
  const competitionId = params.id as string;

  const [competition, setCompetition] = useState<Competition | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ id: number; email: string; display_name: string } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Pagination state - server-side pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [totalPlayers, setTotalPlayers] = useState(0);

  // Filter and search state
  const [filterByLives, setFilterByLives] = useState<'all' | '2' | '1' | '0' | 'out'>('all'); // Default to ALL
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filterCounts, setFilterCounts] = useState({
    all: 0,
    lives_2: 0,
    lives_1: 0,
    lives_0: 0,
    out: 0
  });

  // History modal state
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedPlayerForHistory, setSelectedPlayerForHistory] = useState<Player | null>(null);
  const [fullHistoryData, setFullHistoryData] = useState<RoundHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadStandings = useCallback(async (page: number = currentPage) => {
    if (abortControllerRef.current?.signal.aborted) return;

    setLoading(true);
    try {
      const standingsResponse = await userApi.getCompetitionStandings(
        parseInt(competitionId),
        true,
        page,
        pageSize,
        filterByLives,
        searchQuery || undefined
      );

      if (abortControllerRef.current?.signal.aborted) return;

      if (standingsResponse.data.return_code === 'SUCCESS') {
        setCompetition(standingsResponse.data.competition as Competition);
        setPlayers(standingsResponse.data.players as Player[]);

        // Update pagination state from server response
        if (standingsResponse.data.pagination) {
          setTotalPages(standingsResponse.data.pagination.total_pages);
          setTotalPlayers(standingsResponse.data.pagination.total_players);
          setCurrentPage(standingsResponse.data.pagination.current_page);
        }

        // Update filter counts from server response
        if (standingsResponse.data.filter_counts) {
          setFilterCounts(standingsResponse.data.filter_counts);
        }
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
        setIsInitialLoad(false); // Mark initial load as complete
      }
    }
  }, [competitionId, router, currentPage, pageSize, filterByLives, searchQuery]);

  const loadPlayerHistory = async (playerId: number) => {
    setLoadingHistory(true);
    try {
      const historyResponse = await userApi.getPlayerHistory(parseInt(competitionId), playerId);

      if (historyResponse.data.return_code === 'SUCCESS' && historyResponse.data.history) {
        setFullHistoryData(historyResponse.data.history as RoundHistory[]);
      } else {
        console.error('Failed to load player history:', historyResponse.data.message);
        setFullHistoryData([]);
      }
    } catch (error) {
      console.error('Failed to load player history:', error);
      setFullHistoryData([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Handle filter change
  const handleFilterChange = (newFilter: 'all' | '2' | '1' | '0' | 'out') => {
    setFilterByLives(newFilter);
    setCurrentPage(1); // Reset to first page when filter changes
    setSearchQuery(''); // Clear search when filter changes
    setSearchInput(''); // Clear search input
  };

  // Handle search submit
  const handleSearch = () => {
    setSearchQuery(searchInput.trim());
    setCurrentPage(1); // Reset to first page when searching
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchInput('');
    setSearchQuery('');
    setCurrentPage(1);
  };

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

  // Force scrollbar to always be visible to prevent layout shift
  useEffect(() => {
    document.documentElement.style.overflowY = 'scroll';
    return () => {
      document.documentElement.style.overflowY = '';
    };
  }, []);

  // Pagination is needed if total players exceeds page size
  const needsPagination = totalPages > 1;

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
    return isCurrentRoundLocked || isOwnPlayer;
  };

  // Get winner status
  const getWinnerStatus = () => {
    const activePlayers = players.filter(p => p.status === 'active');
    if (competition?.status === 'COMPLETE' && activePlayers.length === 1) {
      return { isComplete: true, winner: activePlayers[0]?.display_name };
    } else if (competition?.status === 'COMPLETE' && activePlayers.length === 0) {
      return { isComplete: true, winner: null };
    }
    return { isComplete: false };
  };

  const winnerStatus = getWinnerStatus();

  // Only show full-page loading on initial load
  if (loading && isInitialLoad) {
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
                <h1 className="text-lg font-bold text-white">
                  Standings
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
                  {!winnerStatus.isComplete && (
                    <>
                      <span>•</span>
                      <span>{filterCounts.lives_2 + filterCounts.lives_1 + filterCounts.lives_0} players remaining</span>
                    </>
                  )}
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

        {/* Filter Buttons and Search */}
        <div className="mb-6 space-y-4">
          {/* Loading Progress Bar */}
          {loading && !isInitialLoad && (
            <div className="h-1 w-full bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 animate-pulse w-full"></div>
            </div>
          )}

          {/* Filter Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            <button
              onClick={() => handleFilterChange('all')}
              disabled={loading && !isInitialLoad}
              className={`px-4 py-2 rounded-lg font-medium transition-all min-h-[44px] ${
                filterByLives === 'all'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
              } ${loading && !isInitialLoad ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              ALL ({filterCounts.all})
            </button>
            <button
              onClick={() => handleFilterChange('2')}
              disabled={loading && !isInitialLoad}
              className={`px-4 py-2 rounded-lg font-medium transition-all min-h-[44px] ${
                filterByLives === '2'
                  ? 'bg-green-600 text-white shadow-md'
                  : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
              } ${loading && !isInitialLoad ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              2 Lives ({filterCounts.lives_2})
            </button>
            <button
              onClick={() => handleFilterChange('1')}
              disabled={loading && !isInitialLoad}
              className={`px-4 py-2 rounded-lg font-medium transition-all min-h-[44px] ${
                filterByLives === '1'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
              } ${loading && !isInitialLoad ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              1 Life ({filterCounts.lives_1})
            </button>
            <button
              onClick={() => handleFilterChange('0')}
              disabled={loading && !isInitialLoad}
              className={`px-4 py-2 rounded-lg font-medium transition-all min-h-[44px] ${
                filterByLives === '0'
                  ? 'bg-orange-600 text-white shadow-md'
                  : 'bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200'
              } ${loading && !isInitialLoad ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              0 Lives ({filterCounts.lives_0})
            </button>
            <button
              onClick={() => handleFilterChange('out')}
              disabled={loading && !isInitialLoad}
              className={`px-4 py-2 rounded-lg font-medium transition-all min-h-[44px] ${
                filterByLives === 'out'
                  ? 'bg-gray-600 text-white shadow-md'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
              } ${loading && !isInitialLoad ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Out ({filterCounts.out})
            </button>
          </div>

          {/* Search Bar */}
          <div className="flex gap-2">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !loading && handleSearch()}
              placeholder="Search players..."
              disabled={loading && !isInitialLoad}
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              onClick={handleSearch}
              disabled={loading && !isInitialLoad}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Search
            </button>
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                disabled={loading && !isInitialLoad}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Players List */}
        {players.length > 0 ? (
          <div className={`space-y-6 transition-opacity duration-200 ${loading && !isInitialLoad ? 'opacity-50' : 'opacity-100'}`}>
            {/* Active Players Grid */}
            {players.filter(p => p.status !== 'out').length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center space-x-2">
                  <HeartIcon className="h-5 w-5 text-red-500" />
                  <span>Active Players ({players.filter(p => p.status !== 'out').length} on this page)</span>
                </h3>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {players.filter(p => p.status !== 'out').map((player) => {
                    const isCurrentUser = currentUser?.id === player.id;

                    // Render active players
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
                    <div className="p-3 pb-2">
                      <div className="flex items-center justify-between mb-2">
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
                            {[...Array(2)].map((_, i) => (
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
                        <div className="mb-2">
                          {player.current_pick && player.current_pick.outcome !== 'NO_PICK' ? (
                            <div className={`rounded-lg p-2 border ${
                              player.current_pick.outcome === 'WIN'
                                ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
                                : player.current_pick.outcome === 'LOSE'
                                ? 'bg-gradient-to-r from-red-50 to-rose-50 border-red-200'
                                : 'bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200'
                            }`}>
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center space-x-2">
                                  <div className={`h-2 w-2 rounded-full ${
                                    player.current_pick.outcome === 'WIN'
                                      ? 'bg-green-500'
                                      : player.current_pick.outcome === 'LOSE'
                                      ? 'bg-red-500'
                                      : 'bg-blue-500'
                                  }`}></div>
                                  <span className={`text-sm font-medium ${
                                    player.current_pick.outcome === 'WIN'
                                      ? 'text-green-800'
                                      : player.current_pick.outcome === 'LOSE'
                                      ? 'text-red-800'
                                      : 'text-blue-800'
                                  }`}>Current Pick</span>
                                </div>
                                {player.current_pick.outcome === 'WIN' && (
                                  <div className="flex items-center space-x-1">
                                    <CheckCircleIcon className="h-4 w-4 text-green-600" />
                                    <span className="text-xs font-bold text-green-700">WIN</span>
                                  </div>
                                )}
                                {player.current_pick.outcome === 'LOSE' && (
                                  <div className="flex items-center space-x-1">
                                    <XCircleIcon className="h-4 w-4 text-red-600" />
                                    <span className="text-xs font-bold text-red-700">LOSE</span>
                                  </div>
                                )}
                              </div>
                              <div className={`font-semibold ${
                                player.current_pick.outcome === 'WIN'
                                  ? 'text-green-900'
                                  : player.current_pick.outcome === 'LOSE'
                                  ? 'text-red-900'
                                  : 'text-blue-900'
                              }`}>
                                {player.current_pick.team_full_name || player.current_pick.team}
                              </div>
                              {player.current_pick.fixture && (
                                <div className={`text-sm mt-1 ${
                                  player.current_pick.outcome === 'WIN'
                                    ? 'text-green-700'
                                    : player.current_pick.outcome === 'LOSE'
                                    ? 'text-red-700'
                                    : 'text-blue-700'
                                }`}>
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
                    </div>

                    {/* View Full History Button - Mobile-friendly touch target */}
                    {competition && competition.current_round > 1 && (
                      <div className="border-t border-slate-100 px-3 py-2">
                        <button
                          onClick={() => {
                            setSelectedPlayerForHistory(player);
                            setShowHistoryModal(true);
                            loadPlayerHistory(player.id);
                          }}
                          className="w-full py-2.5 px-4 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors min-h-[44px]"
                        >
                          View Full History
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

            {/* Eliminated Players Compact List */}
            {players.filter(p => p.status === 'out').length > 0 && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center space-x-2">
                  <MinusCircleIcon className="h-5 w-5 text-rose-500" />
                  <span>Eliminated ({players.filter(p => p.status === 'out').length} on this page)</span>
                </h3>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">
                  {players.filter(p => p.status === 'out').map((player) => {
                    const isCurrentUser = currentUser?.id === player.id;

                    return (
                      <div
                        key={player.id}
                        className={`px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors ${
                          isCurrentUser ? 'bg-rose-50/50' : ''
                        }`}
                      >
                        {/* Left: Name + Elimination Info */}
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <MinusCircleIcon className="h-4 w-4 text-rose-400 flex-shrink-0" />
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <span className={`font-medium text-sm ${
                              isCurrentUser ? 'text-rose-900' : 'text-slate-800'
                            }`}>
                              {player.display_name}
                            </span>
                            {isCurrentUser && (
                              <span className="text-xs bg-rose-200 text-rose-800 px-1.5 py-0.5 rounded-full font-medium">
                                You
                              </span>
                            )}
                            {player.elimination_pick && (
                              <>
                                <span className="text-xs text-slate-400">•</span>
                                <span className="text-xs text-slate-600">
                                  Round {player.elimination_pick.round_number}
                                </span>
                                <span className="text-xs text-slate-400">•</span>
                                <span className="text-xs text-slate-700 font-medium truncate">
                                  {player.elimination_pick.team}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Right: History Button */}
                        <button
                          onClick={() => {
                            setSelectedPlayerForHistory(player);
                            setShowHistoryModal(true);
                            loadPlayerHistory(player.id);
                          }}
                          className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
                        >
                          History →
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
            <p className="text-slate-500">No players found{searchQuery ? ` matching "${searchQuery}"` : ''}</p>
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Clear Search
              </button>
            )}
          </div>
        )}

        {/* Pagination Controls */}
        {needsPagination && (
          <div className="mt-8 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-4 py-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm text-slate-600">
                  Showing {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, totalPlayers)} of {totalPlayers} players
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => loadStandings(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      currentPage === 1
                        ? 'text-slate-400 cursor-not-allowed'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <ChevronLeftIcon className="h-4 w-4 sm:mr-1" />
                    <span className="hidden sm:inline">Previous</span>
                  </button>

                  <div className="flex items-center px-3 py-2 text-sm font-medium text-slate-900">
                    Page {currentPage} of {totalPages}
                  </div>

                  <button
                    onClick={() => loadStandings(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      currentPage === totalPages
                        ? 'text-slate-400 cursor-not-allowed'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRightIcon className="h-4 w-4 sm:ml-1" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Full History Modal - Mobile-first design */}
        {showHistoryModal && selectedPlayerForHistory && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => {
              setShowHistoryModal(false);
              setSelectedPlayerForHistory(null);
              setFullHistoryData([]);
            }}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold">{selectedPlayerForHistory.display_name}</h3>
                  <p className="text-blue-100 text-sm">Complete Pick History</p>
                </div>
                <button
                  onClick={() => {
                    setShowHistoryModal(false);
                    setSelectedPlayerForHistory(null);
                    setFullHistoryData([]);
                  }}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors min-w-[44px] min-h-[44px]"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Content - Scrollable */}
              <div className="overflow-y-auto max-h-[calc(90vh-120px)] p-6">
                {loadingHistory ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-slate-600">Loading history...</p>
                    </div>
                  </div>
                ) : fullHistoryData.length > 0 ? (
                  <div className="space-y-1">
                    {fullHistoryData
                      .sort((a, b) => b.round_number - a.round_number) // Newest first
                      .map((round) => (
                        <div
                          key={round.round_id}
                          className={`flex items-center justify-between py-2 px-3 border-l-4 ${
                            round.pick_result === 'win'
                              ? 'bg-green-50/50 border-green-500'
                              : round.pick_result === 'loss'
                              ? 'bg-red-50/50 border-red-500'
                              : 'bg-slate-50 border-slate-300'
                          }`}
                        >
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <span className="text-sm font-semibold text-slate-600 w-8 flex-shrink-0">
                              R{round.round_number}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-slate-900 truncate">
                                {round.pick_team_full_name || round.pick_team || 'No Pick'}
                              </div>
                              {round.fixture && (
                                <div className="text-xs text-slate-600 truncate">
                                  {round.fixture}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-1 flex-shrink-0">
                            {round.pick_result === 'win' ? (
                              <>
                                <CheckCircleIcon className="h-5 w-5 text-green-600" />
                                <span className="font-bold text-green-700 text-sm">WIN</span>
                              </>
                            ) : round.pick_result === 'loss' ? (
                              <>
                                <XCircleIcon className="h-5 w-5 text-red-600" />
                                <span className="font-bold text-red-700 text-sm">LOSE</span>
                              </>
                            ) : round.pick_result === 'pending' ? (
                              <>
                                <ClockIcon className="h-5 w-5 text-slate-400" />
                                <span className="font-medium text-slate-600 text-sm">PENDING</span>
                              </>
                            ) : (
                              <>
                                <MinusCircleIcon className="h-5 w-5 text-slate-400" />
                                <span className="font-medium text-slate-600 text-sm">NO PICK</span>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    <p>No pick history available</p>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-50 px-6 py-4 flex items-center justify-between border-t border-slate-200">
                <div className="text-sm text-slate-600">
                  {fullHistoryData.length} round{fullHistoryData.length !== 1 ? 's' : ''} played
                </div>
                <button
                  onClick={() => {
                    setShowHistoryModal(false);
                    setSelectedPlayerForHistory(null);
                    setFullHistoryData([]);
                  }}
                  className="px-6 py-2.5 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors min-h-[44px]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}