'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  TrophyIcon,
  HeartIcon,
  ClockIcon,
  XCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import { userApi } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';

interface StandingsGroup {
  key: string;
  name: string;
  lives: number | null;
  fixture_status: string | null;
  count: number;
  icon: string;
  winner_name?: string;
}

interface Competition {
  id: number;
  name: string;
  current_round: number;
  status: string;
}

interface Player {
  id: number;
  display_name: string;
  lives_remaining: number;
  status: string;
  group_name?: string;
  current_pick: {
    team: string;
    team_full_name: string;
    fixture: string;
    outcome: string;
  } | null;
  elimination_pick: {
    round_number: number;
    team: string;
    fixture: string;
    result: string;
  } | null;
}

interface RoundHistory {
  round_id: number;
  round_number: number;
  pick_team: string;
  pick_team_full_name: string;
  fixture: string | null;
  fixture_result: string | null;
  pick_result: string;
  lock_time: string;
}

export default function StandingsPage() {
  const router = useRouter();
  const params = useParams();
  const competitionId = params.id as string;

  const [currentUser, setCurrentUser] = useState<{ id: number; email: string; display_name: string } | null>(null);
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [roundState, setRoundState] = useState<string>('');
  const [groups, setGroups] = useState<StandingsGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Expanded group state
  const [expandedGroups, setExpandedGroups] = useState<{ [key: string]: boolean }>({});
  const [groupPlayers, setGroupPlayers] = useState<{ [key: string]: Player[] }>({});
  const [groupLoading, setGroupLoading] = useState<{ [key: string]: boolean }>({});
  const [groupPagination, setGroupPagination] = useState<{ [key: string]: { current: number; total: number } }>({});

  // History modal state
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [playerHistory, setPlayerHistory] = useState<RoundHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Search modal state
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Player[]>([]);
  const [totalSearchResults, setTotalSearchResults] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Load summary on mount
  const loadSummary = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    else setRefreshing(true);

    try {
      const response = await userApi.getStandingsSummary(parseInt(competitionId));

      if (response.data.return_code === 'SUCCESS') {
        setCompetition(response.data.competition || null);
        setRoundState(response.data.round_state || '');
        setGroups(response.data.groups || []);
      } else {
        console.error('Failed to load standings:', response.data.message);
      }
    } catch (error) {
      console.error('Error loading standings:', error);
    } finally {
      if (showLoader) setLoading(false);
      else setRefreshing(false);
    }
  }, [competitionId]);

  // Load players for a specific group
  const loadGroupPlayers = async (groupKey: string, page = 1, append = false) => {
    setGroupLoading(prev => ({ ...prev, [groupKey]: true }));

    try {
      const response = await userApi.getStandingsGroup(parseInt(competitionId), groupKey, page, 20);

      if (response.data.return_code === 'SUCCESS') {
        setGroupPlayers(prev => ({
          ...prev,
          [groupKey]: append
            ? [...(prev[groupKey] || []), ...(response.data.players || [])]
            : response.data.players || []
        }));
        setGroupPagination(prev => ({
          ...prev,
          [groupKey]: {
            current: response.data.pagination?.current_page || 1,
            total: response.data.pagination?.total_pages || 1
          }
        }));
      }
    } catch (error) {
      console.error('Error loading group players:', error);
    } finally {
      setGroupLoading(prev => ({ ...prev, [groupKey]: false }));
    }
  };

  // Load more players for a group
  const loadMorePlayers = (groupKey: string) => {
    const pagination = groupPagination[groupKey];
    if (pagination && pagination.current < pagination.total) {
      loadGroupPlayers(groupKey, pagination.current + 1, true);
    }
  };

  // Toggle group expansion
  const toggleGroup = (groupKey: string) => {
    const isCurrentlyExpanded = expandedGroups[groupKey];

    if (!isCurrentlyExpanded) {
      // Expanding - load players
      setExpandedGroups(prev => ({ ...prev, [groupKey]: true }));
      if (!groupPlayers[groupKey]) {
        loadGroupPlayers(groupKey);
      }
    } else {
      // Collapsing
      setExpandedGroups(prev => ({ ...prev, [groupKey]: false }));
    }
  };

  // Load player history
  const loadPlayerHistory = async (playerId: number) => {
    setLoadingHistory(true);
    try {
      const response = await userApi.getPlayerHistory(parseInt(competitionId), playerId);

      if (response.data.return_code === 'SUCCESS' && response.data.history) {
        setPlayerHistory(response.data.history);
      } else {
        setPlayerHistory([]);
      }
    } catch (error) {
      console.error('Error loading history:', error);
      setPlayerHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Manual refresh
  const handleRefresh = async () => {
    // Clear cache and reload
    const { cacheUtils } = await import('@/lib/api');
    cacheUtils.invalidateKey(`standings-summary-${competitionId}`);
    await loadSummary(false);
  };

  // Search players
  const handleSearch = async () => {
    if (searchTerm.trim().length < 2) {
      setSearchResults([]);
      setTotalSearchResults(0);
      return;
    }

    setHasSearched(true);
    setSearchLoading(true);
    try {
      const response = await userApi.searchPlayers(parseInt(competitionId), searchTerm.trim(), 20);

      if (response.data.return_code === 'SUCCESS') {
        const results = response.data.results || [];
        setTotalSearchResults(results.length);
        // Only show first 5 results
        setSearchResults(results.slice(0, 5));
      } else {
        setSearchResults([]);
        setTotalSearchResults(0);
      }
    } catch (error) {
      console.error('Error searching players:', error);
      setSearchResults([]);
      setTotalSearchResults(0);
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      router.push('/login');
      return;
    }

    const user = getCurrentUser();
    setCurrentUser(user);
    loadSummary();
  }, [router, competitionId, loadSummary]);

  // Clear search when modal opens
  useEffect(() => {
    if (showSearchModal) {
      setSearchTerm('');
      setSearchResults([]);
      setTotalSearchResults(0);
      setHasSearched(false);
    }
  }, [showSearchModal]);

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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-700 to-slate-800 shadow-lg sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link
                href={`/game/${competitionId}`}
                className="flex items-center space-x-2 text-slate-200 hover:text-white transition-colors"
              >
                <ArrowLeftIcon className="h-5 w-5" />
                <span className="font-medium">Back</span>
              </Link>
              <div className="h-6 w-px bg-slate-500" />
              <div>
                <h1 className="text-lg font-bold text-white">Standings</h1>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowSearchModal(true)}
                className="flex items-center space-x-2 px-3 py-2 text-sm text-slate-200 hover:text-white hover:bg-slate-600 rounded-lg transition-colors"
              >
                <MagnifyingGlassIcon className="h-4 w-4" />
                <span>Search</span>
              </button>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center space-x-2 px-3 py-2 text-sm text-slate-200 hover:text-white hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50"
              >
                <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* Competition Name */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <h2 className="text-xl font-bold text-slate-900 text-center">{competition.name}</h2>
          <p className="text-sm text-slate-600 text-center mt-1">Round {competition.current_round}</p>
        </div>

        {/* Groups */}
        <div className="space-y-3">
          {groups.map((group, index) => {
            const isExpanded = expandedGroups[group.key];
            const players = groupPlayers[group.key] || [];
            const isLoading = groupLoading[group.key];

            const isTopGroup = index === 0 && group.key !== 'eliminated';
            const isBottomGroup = group.key === 'eliminated';

            // Winner: Exactly 1 active player remaining (sole champion) - count total active players across all groups
            const totalActivePlayers = groups
              .filter(g => g.key !== 'eliminated')
              .reduce((sum, g) => sum + g.count, 0);
            const isWinner = isTopGroup && totalActivePlayers === 1;

            // Danger zone: 0 lives, game not played, during active round, and groups exist above
            const isDangerZone = !isWinner && roundState === 'ACTIVE' &&
                                 group.lives === 0 &&
                                 group.fixture_status !== 'played' &&
                                 index > 0;

            return (
              <div key={group.key} className={`rounded-xl shadow-sm overflow-hidden ${
                isWinner
                  ? 'border-2 border-amber-400 shadow-lg'
                  : isTopGroup
                  ? 'border-2 border-green-300 shadow-md'
                  : 'bg-white border border-slate-200'
              }`}>
                {/* Group Header - Clickable */}
                <button
                  onClick={() => toggleGroup(group.key)}
                  className={`w-full px-5 py-4 flex items-center justify-between transition-colors ${
                    isWinner
                      ? 'bg-gradient-to-r from-amber-100 to-yellow-50 hover:from-amber-200 hover:to-yellow-100'
                      : isTopGroup
                      ? 'bg-gradient-to-r from-green-100 to-green-50 hover:from-green-200 hover:to-green-100'
                      : isDangerZone
                      ? 'hover:bg-slate-50'
                      : isBottomGroup
                      ? 'bg-slate-100 hover:bg-slate-200'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    {/* Player Count Badge */}
                    <div className={`flex items-center justify-center min-w-[3rem] h-12 px-2 rounded-lg font-bold text-lg ${
                      isWinner
                        ? 'bg-amber-500 text-white'
                        : isTopGroup
                        ? 'bg-green-600 text-white'
                        : isDangerZone
                        ? 'bg-red-600 text-white'
                        : isBottomGroup
                        ? 'bg-slate-400 text-white'
                        : 'bg-slate-600 text-white'
                    }`}>
                      {isWinner ? <TrophyIcon className="h-6 w-6" /> : group.count}
                    </div>
                    <div className="text-left">
                      <div className={`flex items-center space-x-2 ${
                        isWinner
                          ? 'font-bold text-amber-900'
                          : isTopGroup
                          ? 'font-bold text-green-900'
                          : 'font-semibold text-slate-900'
                      }`}>
                        {isWinner ? (
                          // Winner: Show "Champion • [Name]"
                          <>
                            <span>Champion</span>
                            {group.winner_name && (
                              <>
                                <span className="text-amber-600">•</span>
                                <span className="text-amber-800">{group.winner_name}</span>
                              </>
                            )}
                          </>
                        ) : (
                          <>
                            {group.lives !== null && (
                              <>
                                <div className="flex items-center space-x-1">
                                  <HeartIcon className="h-5 w-5 text-red-500 fill-current" />
                                  <span>{group.lives}</span>
                                </div>
                                <span className="text-slate-400">•</span>
                              </>
                            )}
                            <span>
                              {group.lives !== null
                                ? (group.fixture_status === 'played' ? 'Game Played'
                                   : group.fixture_status === 'pending' ? 'Game Pending'
                                   : 'No Pick')
                                : 'Eliminated'}
                            </span>
                          </>
                        )}
                      </div>
                      {/* Show name on second line for any single-player group (but not champions yet) */}
                      {!isWinner && group.count === 1 && group.winner_name && (
                        <div className={`text-sm mt-0.5 ${
                          isTopGroup ? 'text-green-700' : 'text-slate-600'
                        }`}>
                          {group.winner_name}
                        </div>
                      )}
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUpIcon className="h-5 w-5 text-slate-400" />
                  ) : (
                    <ChevronDownIcon className="h-5 w-5 text-slate-400" />
                  )}
                </button>

                {/* Expanded Player List */}
                {isExpanded && (
                  <div className="border-t border-slate-200">
                    {isLoading && players.length === 0 ? (
                      <div className="p-8 text-center">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-transparent"></div>
                      </div>
                    ) : players.length > 0 ? (
                      <>
                        <div className="divide-y divide-slate-100">
                          {players.map((player) => {
                            const isYou = currentUser?.id === player.id;
                            const isEliminated = group.key === 'eliminated';

                            // Minimal display for eliminated players
                            if (isEliminated) {
                              return (
                                <div
                                  key={player.id}
                                  className="px-4 py-2 hover:bg-slate-50 transition-colors flex items-center justify-between"
                                >
                                  <div className="flex items-center space-x-2">
                                    <span className="text-sm text-slate-700">{player.display_name}</span>
                                    {player.elimination_pick && (
                                      <span className="text-xs text-slate-500">
                                        (Round {player.elimination_pick.round_number})
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => {
                                      setSelectedPlayer(player);
                                      setShowHistoryModal(true);
                                      loadPlayerHistory(player.id);
                                    }}
                                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                  >
                                    History
                                  </button>
                                </div>
                              );
                            }

                            // Full display for active players
                            return (
                              <div
                                key={player.id}
                                className={`p-4 ${isYou ? 'bg-blue-50' : 'hover:bg-slate-50'} transition-colors`}
                              >
                                <div className="flex items-center space-x-2 mb-2">
                                  <span className="font-medium text-slate-900">{player.display_name}</span>
                                  {isYou && (
                                    <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full font-medium">
                                      You
                                    </span>
                                  )}
                                </div>

                                {/* Current Pick */}
                                {player.current_pick && (
                                  <div className={`text-sm rounded-lg p-2 border mb-2 ${
                                    player.current_pick.outcome === 'WIN'
                                      ? 'bg-green-50 border-green-200 text-green-900'
                                      : player.current_pick.outcome === 'LOSE'
                                      ? 'bg-red-50 border-red-200 text-red-900'
                                      : 'bg-blue-50 border-blue-200 text-blue-900'
                                  }`}>
                                    <div className="font-medium">{player.current_pick.team_full_name}</div>
                                    {player.current_pick.fixture && (
                                      <div className="text-xs opacity-75">{player.current_pick.fixture}</div>
                                    )}
                                  </div>
                                )}

                                {/* History Button */}
                                {competition.current_round > 1 && (
                                  <button
                                    onClick={() => {
                                      setSelectedPlayer(player);
                                      setShowHistoryModal(true);
                                      loadPlayerHistory(player.id);
                                    }}
                                    className="w-full py-2 px-3 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                                  >
                                    View History
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Load More Button */}
                        {groupPagination[group.key] && groupPagination[group.key].current < groupPagination[group.key].total && (
                          <div className="border-t border-slate-200 p-4">
                            <button
                              onClick={() => loadMorePlayers(group.key)}
                              disabled={isLoading}
                              className="w-full py-2.5 px-4 text-sm font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                            >
                              {isLoading ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-400 border-t-transparent"></div>
                                  <span>Loading...</span>
                                </>
                              ) : (
                                <>
                                  <ChevronDownIcon className="h-4 w-4" />
                                  <span>
                                    Load More ({groupPagination[group.key].current} of {groupPagination[group.key].total} pages)
                                  </span>
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="p-8 text-center text-slate-500 text-sm">
                        No players in this group
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      {/* Search Modal */}
      {showSearchModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => {
            setShowSearchModal(false);
            setSearchTerm('');
            setSearchResults([]);
          }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4">
              <h3 className="text-xl font-bold">Search Players</h3>
              <p className="text-blue-100 text-sm">Search by name or email</p>
            </div>

            {/* Search Input */}
            <div className="p-6 border-b border-slate-200">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    // Reset search state when user starts typing a new search
                    if (hasSearched) {
                      setHasSearched(false);
                      setSearchResults([]);
                      setTotalSearchResults(0);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch();
                    }
                  }}
                  placeholder="Enter name or email..."
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                  spellCheck={false}
                  autoComplete="off"
                />
                <button
                  onClick={handleSearch}
                  disabled={searchLoading || searchTerm.trim().length < 2}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {searchLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      <span>Searching...</span>
                    </>
                  ) : (
                    <>
                      <MagnifyingGlassIcon className="h-5 w-5" />
                      <span>Search</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Search Results */}
            <div className="overflow-y-auto max-h-[calc(90vh-240px)] p-6">
              {totalSearchResults > 5 ? (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                    <span className="text-2xl font-bold text-blue-600">{totalSearchResults}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    {totalSearchResults} players found
                  </h3>
                  <p className="text-slate-600">
                    Please refine your search to see details
                  </p>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="divide-y divide-slate-200">
                  {searchResults.map((player) => {
                    const isYou = currentUser?.id === player.id;

                    return (
                      <button
                        key={player.id}
                        onClick={() => {
                          // Close search modal first, then open history modal
                          setShowSearchModal(false);
                          setSelectedPlayer(player);
                          // Small delay to allow search modal to close first
                          setTimeout(() => {
                            setShowHistoryModal(true);
                            loadPlayerHistory(player.id);
                          }, 100);
                        }}
                        className={`w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors ${
                          isYou ? 'bg-blue-50' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="font-medium text-slate-900 truncate">{player.display_name}</span>
                              {isYou && (
                                <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-600">{player.group_name}</div>
                          </div>
                          <ChevronUpIcon className="h-5 w-5 text-slate-400 flex-shrink-0 ml-2 rotate-90" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : hasSearched && !searchLoading ? (
                <div className="text-center py-12 text-slate-500">
                  No players found matching &ldquo;{searchTerm}&rdquo;
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <MagnifyingGlassIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Enter a name or email and click Search</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200">
              <button
                onClick={() => {
                  setShowSearchModal(false);
                  setSearchTerm('');
                  setSearchResults([]);
                }}
                className="w-full px-6 py-2.5 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && selectedPlayer && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => {
            setShowHistoryModal(false);
            setSelectedPlayer(null);
            setPlayerHistory([]);
            // Re-open search modal if there were previous search results
            if (searchResults.length > 0) {
              setShowSearchModal(true);
            }
          }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4">
              <h3 className="text-xl font-bold">{selectedPlayer.display_name}</h3>
              <p className="text-blue-100 text-sm">Complete Pick History</p>
            </div>

            {/* Modal Content */}
            <div className="overflow-y-auto max-h-[calc(90vh-180px)] p-6">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-600 border-t-transparent"></div>
                </div>
              ) : playerHistory.length > 0 ? (
                <div className="space-y-2">
                  {playerHistory.sort((a, b) => b.round_number - a.round_number).map((round) => (
                    <div
                      key={round.round_id}
                      className={`flex items-center justify-between py-2 px-3 rounded border-l-4 ${
                        round.pick_result === 'win'
                          ? 'bg-green-50 border-green-500'
                          : round.pick_result === 'loss'
                          ? 'bg-red-50 border-red-500'
                          : 'bg-slate-50 border-slate-300'
                      }`}
                    >
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <span className="text-sm font-semibold text-slate-600 w-8">R{round.round_number}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-slate-900 truncate">
                            {round.pick_team_full_name || round.pick_team || 'No Pick'}
                          </div>
                          {round.fixture && (
                            <div className="text-xs text-slate-600 truncate">{round.fixture}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-1">
                        {round.pick_result === 'win' && (
                          <>
                            <CheckCircleIcon className="h-5 w-5 text-green-600" />
                            <span className="font-bold text-green-700 text-sm">WIN</span>
                          </>
                        )}
                        {round.pick_result === 'loss' && (
                          <>
                            <XCircleIcon className="h-5 w-5 text-red-600" />
                            <span className="font-bold text-red-700 text-sm">LOSE</span>
                          </>
                        )}
                        {round.pick_result === 'pending' && (
                          <>
                            <ClockIcon className="h-5 w-5 text-slate-400" />
                            <span className="font-medium text-slate-600 text-sm">PENDING</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500">No history available</div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200">
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setSelectedPlayer(null);
                  setPlayerHistory([]);
                  // Re-open search modal if there were previous search results
                  if (searchResults.length > 0) {
                    setShowSearchModal(true);
                  }
                }}
                className="w-full px-6 py-2.5 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
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
