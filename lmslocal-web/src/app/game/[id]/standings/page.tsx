'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  TrophyIcon,
  ClockIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import { userApi } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { LABEL, EYEBROW, HEADING, PANEL, BTN_PRIMARY, BTN_OUTLINE } from '@/lib/design';

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
  const loadSummary = useCallback(async () => {
    setLoading(true);

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
      setLoading(false);
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
      <div className="flex min-h-screen items-center justify-center bg-stock font-body text-ink">
        <div className="text-center">
          <div className="mb-4 inline-flex h-8 w-8 animate-spin items-center justify-center rounded-full border-2 border-ink border-t-transparent" />
          <p className={EYEBROW}>Loading</p>
          <p className="mt-2 text-[17px] text-ink-fade">Getting the latest results&hellip;</p>
        </div>
      </div>
    );
  }

  if (!competition) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stock font-body text-ink">
        <h3 className={`${HEADING} text-2xl`}>Competition not found</h3>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stock font-body text-ink">
      <header className="border-b border-ink/30">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href={`/game/${competitionId}`} className={`${LABEL} flex items-center gap-1.5 text-ink-fade transition-colors hover:text-ink`}>
            <ArrowLeftIcon className="h-4 w-4" />
            Dashboard
          </Link>
          <button
            onClick={() => setShowSearchModal(true)}
            className={`${LABEL} flex items-center gap-1.5 text-ink-fade transition-colors hover:text-ink`}
          >
            <MagnifyingGlassIcon className="h-4 w-4" />
            Search
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-8 sm:px-6 sm:py-10">
        <div>
          <p className={EYEBROW}>Standings</p>
          <h1 className={`${HEADING} mt-1 text-3xl`}>{competition.name}</h1>
        </div>

        {/* My History Button */}
        {currentUser && (
          <button
            onClick={() => {
              let currentUserPlayer = null;
              for (const groupKey in groupPlayers) {
                const found = groupPlayers[groupKey]?.find(p => p.id === currentUser.id);
                if (found) {
                  currentUserPlayer = found;
                  break;
                }
              }

              if (!currentUserPlayer) {
                currentUserPlayer = {
                  id: currentUser.id,
                  display_name: currentUser.display_name,
                  lives_remaining: 0,
                  status: 'unknown',
                  current_pick: null,
                  elimination_pick: null
                };
              }

              setSelectedPlayer(currentUserPlayer);
              setShowHistoryModal(true);
              loadPlayerHistory(currentUser.id);
            }}
            className={`${PANEL} flex w-full items-center justify-center gap-2 p-4 transition-colors hover:border-ink`}
          >
            <ClockIcon className="h-5 w-5 text-ink" />
            <span className={`${LABEL} text-ink`}>View my pick history</span>
          </button>
        )}

        {/* Groups */}
        <div className="space-y-3">
          {groups.map((group, index) => {
            const isExpanded = expandedGroups[group.key];
            const players = groupPlayers[group.key] || [];
            const isLoading = groupLoading[group.key];

            const isTopGroup = index === 0 && group.key !== 'eliminated';
            const isBottomGroup = group.key === 'eliminated';

            const totalActivePlayers = groups
              .filter(g => g.key !== 'eliminated')
              .reduce((sum, g) => sum + g.count, 0);
            const isWinner = isTopGroup && totalActivePlayers === 1 &&
                             (roundState === 'COMPLETE' || group.fixture_status === 'played');

            const isDangerZone = !isWinner && roundState === 'ACTIVE' &&
                                 group.lives === 0 &&
                                 group.fixture_status !== 'played' &&
                                 index > 0;

            return (
              <div
                key={group.key}
                className={`${PANEL} ${isWinner || isTopGroup ? 'border-moss' : isDangerZone ? 'border-overprint' : ''}`}
              >
                {/* Group Header - Clickable */}
                <button
                  onClick={() => toggleGroup(group.key)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-stock"
                >
                  <div className="flex items-center gap-3">
                    {/* Player Count Badge */}
                    <div className={`flex h-11 min-w-[2.75rem] items-center justify-center border px-2 font-display text-lg ${
                      isWinner || isTopGroup
                        ? 'border-moss text-moss'
                        : isDangerZone
                        ? 'border-overprint text-overprint'
                        : isBottomGroup
                        ? 'border-ink/20 text-ink-fade'
                        : 'border-ink/30 text-ink'
                    }`}>
                      {isWinner ? <TrophyIcon className="h-5 w-5" /> : group.count}
                    </div>
                    <div className="text-left">
                      <div className={`${LABEL} flex items-center gap-2 ${
                        isWinner || isTopGroup ? 'text-moss' : isDangerZone ? 'text-overprint' : 'text-ink'
                      }`}>
                        {isWinner ? (
                          <>
                            <span>Champion</span>
                            {group.winner_name && (
                              <>
                                <span>&middot;</span>
                                <span>{group.winner_name}</span>
                              </>
                            )}
                          </>
                        ) : (
                          <>
                            {group.lives !== null ? (
                              <>
                                <span>{group.lives} {group.lives === 1 ? 'life' : 'lives'}</span>
                                {group.fixture_status !== null && (
                                  <>
                                    <span>&middot;</span>
                                    <span>
                                      {group.fixture_status === 'played' ? 'Game played'
                                       : group.fixture_status === 'pending' ? 'Game pending'
                                       : 'No pick'}
                                    </span>
                                  </>
                                )}
                              </>
                            ) : (
                              <span>Eliminated</span>
                            )}
                          </>
                        )}
                      </div>
                      {!isWinner && group.count === 1 && group.winner_name && (
                        <div className="mt-0.5 font-data text-[14px] text-ink-fade">
                          {group.winner_name}
                        </div>
                      )}
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUpIcon className="h-4 w-4 flex-shrink-0 text-ink-fade" />
                  ) : (
                    <ChevronDownIcon className="h-4 w-4 flex-shrink-0 text-ink-fade" />
                  )}
                </button>

                {/* Expanded Player List */}
                {isExpanded && (
                  <div className="border-t border-ink/30">
                    {isLoading && players.length === 0 ? (
                      <div className="p-8 text-center">
                        <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-ink border-t-transparent" />
                      </div>
                    ) : players.length > 0 ? (
                      <>
                        <div className="divide-y divide-ink/30">
                          {players.map((player) => {
                            const isYou = currentUser?.id === player.id;
                            const isEliminatedRow = group.key === 'eliminated';

                            // Minimal display for eliminated players
                            if (isEliminatedRow) {
                              return (
                                <div key={player.id} className="flex items-center justify-between px-4 py-2.5">
                                  <div className="flex items-baseline gap-2">
                                    <span className="relative font-data text-[14px] text-ink-fade">
                                      {player.display_name}
                                      <span
                                        aria-hidden="true"
                                        className="absolute left-0 right-0 top-1/2 h-[1.5px] -translate-y-1/2 bg-overprint"
                                      />
                                    </span>
                                    <span className="sr-only"> &mdash; out</span>
                                    {player.elimination_pick && (
                                      <span className={`${LABEL} text-ink-fade`}>Round {player.elimination_pick.round_number}</span>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => {
                                      setSelectedPlayer(player);
                                      setShowHistoryModal(true);
                                      loadPlayerHistory(player.id);
                                    }}
                                    className={`${LABEL} text-ink-fade underline decoration-dotted underline-offset-4 transition-colors hover:text-ink`}
                                  >
                                    History
                                  </button>
                                </div>
                              );
                            }

                            // Full display for active players
                            return (
                              <div key={player.id} className="p-4">
                                <div className="mb-2 flex items-center gap-2">
                                  <span className="font-data text-[15px] text-ink">{player.display_name}</span>
                                  {isYou && <span className={`${LABEL} border border-ink px-1.5 py-0.5 text-ink`}>You</span>}
                                </div>

                                {player.current_pick && (
                                  <div className="mb-2 flex items-baseline justify-between gap-2 border-t border-ink/30 pt-2">
                                    <div>
                                      <p className="font-data text-[14px] text-ink">{player.current_pick.team_full_name}</p>
                                      {player.current_pick.fixture && (
                                        <p className="text-[12px] text-ink-fade">{player.current_pick.fixture}</p>
                                      )}
                                    </div>
                                    <span className={`${LABEL} flex-shrink-0 ${
                                      player.current_pick.outcome === 'WIN'
                                        ? 'text-moss'
                                        : player.current_pick.outcome === 'LOSE'
                                        ? 'text-overprint'
                                        : 'text-ink-fade'
                                    }`}>
                                      {player.current_pick.outcome === 'WIN' ? 'Won' : player.current_pick.outcome === 'LOSE' ? 'Out' : 'Pending'}
                                    </span>
                                  </div>
                                )}

                                {competition.current_round > 1 && (
                                  <button
                                    onClick={() => {
                                      setSelectedPlayer(player);
                                      setShowHistoryModal(true);
                                      loadPlayerHistory(player.id);
                                    }}
                                    className={`${BTN_OUTLINE} w-full justify-center py-2`}
                                  >
                                    View history
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Load More Button */}
                        {groupPagination[group.key] && groupPagination[group.key].current < groupPagination[group.key].total && (
                          <div className="border-t border-ink/30 p-4">
                            <button
                              onClick={() => loadMorePlayers(group.key)}
                              disabled={isLoading}
                              className={`${BTN_OUTLINE} flex w-full items-center justify-center gap-2 py-2.5 disabled:opacity-50`}
                            >
                              {isLoading ? (
                                <>
                                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-ink border-t-transparent" />
                                  Loading&hellip;
                                </>
                              ) : (
                                <>
                                  Load more ({groupPagination[group.key].current} of {groupPagination[group.key].total} pages)
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="p-8 text-center text-[15px] text-ink-fade">No players in this group</p>
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
          onClick={() => {
            setShowSearchModal(false);
            setSearchTerm('');
            setSearchResults([]);
          }}
        >
          <div
            className={`${PANEL} flex max-h-[90vh] w-full max-w-lg flex-col`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-ink/30 px-6 py-4">
              <p className={EYEBROW}>Standings</p>
              <h3 className={`${HEADING} mt-1 text-2xl`}>Search players</h3>
            </div>

            <div className="border-b border-ink/30 p-6">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
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
                  placeholder="Enter name or email…"
                  className="min-w-0 flex-1 rounded-sm border border-ink bg-transparent px-3 py-2 text-[15px] text-ink placeholder-ink-fade/60 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                  autoFocus
                  spellCheck={false}
                  autoComplete="off"
                />
                <button
                  onClick={handleSearch}
                  disabled={searchLoading || searchTerm.trim().length < 2}
                  className={`${BTN_PRIMARY} flex flex-shrink-0 items-center justify-center gap-2 px-4 py-2 text-base disabled:opacity-50`}
                >
                  {searchLoading ? 'Searching…' : 'Search'}
                </button>
              </div>
            </div>

            <div className="overflow-y-auto p-6">
              {totalSearchResults > 5 ? (
                <div className="py-8 text-center">
                  <p className="font-display text-4xl text-overprint">{totalSearchResults}</p>
                  <p className={`${HEADING} mt-2 text-xl`}>Players found</p>
                  <p className="mt-2 text-[15px] text-ink-fade">Please refine your search to see details.</p>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="divide-y divide-ink/30 border-y border-ink/30">
                  {searchResults.map((player) => {
                    const isYou = currentUser?.id === player.id;

                    return (
                      <button
                        key={player.id}
                        onClick={() => {
                          setShowSearchModal(false);
                          setSelectedPlayer(player);
                          setTimeout(() => {
                            setShowHistoryModal(true);
                            loadPlayerHistory(player.id);
                          }, 100);
                        }}
                        className="flex w-full items-center justify-between gap-3 px-1 py-3 text-left transition-colors hover:bg-stock"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-data text-[15px] text-ink">{player.display_name}</span>
                            {isYou && <span className={`${LABEL} border border-ink px-1.5 py-0.5 text-ink`}>You</span>}
                          </div>
                          <p className={`${LABEL} mt-1 text-ink-fade`}>{player.group_name}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : hasSearched && !searchLoading ? (
                <p className="py-8 text-center text-[15px] text-ink-fade">
                  No players found matching &ldquo;{searchTerm}&rdquo;
                </p>
              ) : (
                <div className="py-8 text-center text-ink-fade">
                  <MagnifyingGlassIcon className="mx-auto mb-3 h-10 w-10 opacity-40" />
                  <p className="text-[15px]">Enter a name or email and press search.</p>
                </div>
              )}
            </div>

            <div className="border-t border-ink/30 p-4">
              <button
                onClick={() => {
                  setShowSearchModal(false);
                  setSearchTerm('');
                  setSearchResults([]);
                }}
                className={`${BTN_OUTLINE} w-full justify-center py-2.5`}
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
          onClick={() => {
            setShowHistoryModal(false);
            setSelectedPlayer(null);
            setPlayerHistory([]);
            if (searchResults.length > 0) {
              setShowSearchModal(true);
            }
          }}
        >
          <div
            className={`${PANEL} flex max-h-[90vh] w-full max-w-lg flex-col`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-ink/30 px-6 py-4">
              <p className={EYEBROW}>Pick history</p>
              <h3 className={`${HEADING} mt-1 text-2xl`}>{selectedPlayer.display_name}</h3>
            </div>

            <div className="overflow-y-auto p-6">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-10 w-10 animate-spin rounded-full border-2 border-ink border-t-transparent" />
                </div>
              ) : playerHistory.length > 0 ? (
                <div className="divide-y divide-ink/30 border-y border-ink/30">
                  {playerHistory
                    .filter((round) => {
                      const isViewingOwnHistory = currentUser?.id === selectedPlayer?.id;
                      if (isViewingOwnHistory) return true;

                      if (round.round_number < (competition?.current_round || 0)) return true;

                      if (round.lock_time) {
                        const lockTime = new Date(round.lock_time);
                        const now = new Date();
                        return now >= lockTime;
                      }

                      return false;
                    })
                    .sort((a, b) => b.round_number - a.round_number)
                    .map((round) => (
                    <div key={round.round_id} className="flex items-center justify-between gap-3 py-3">
                      <div className="flex min-w-0 flex-1 items-baseline gap-3">
                        <span className={`${LABEL} flex-shrink-0 text-ink-fade`}>R{round.round_number}</span>
                        <div className="min-w-0">
                          <p className="truncate font-data text-[15px] text-ink">
                            {round.pick_team_full_name || round.pick_team || 'No pick'}
                          </p>
                          {round.fixture && (
                            <p className="truncate text-[12px] text-ink-fade">{round.fixture}</p>
                          )}
                        </div>
                      </div>
                      <span className={`${LABEL} flex-shrink-0 ${
                        round.pick_result === 'win' ? 'text-moss' : round.pick_result === 'loss' ? 'text-overprint' : 'text-ink-fade'
                      }`}>
                        {round.pick_result === 'win' ? 'Win' : round.pick_result === 'loss' ? 'Lose' : 'Pending'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-[15px] text-ink-fade">No history available</p>
              )}
            </div>

            <div className="border-t border-ink/30 p-4">
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setSelectedPlayer(null);
                  setPlayerHistory([]);
                  if (searchResults.length > 0) {
                    setShowSearchModal(true);
                  }
                }}
                className={`${BTN_OUTLINE} w-full justify-center py-2.5`}
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
