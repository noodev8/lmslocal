'use client';

import { useState, useEffect } from 'react';
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
  MinusCircleIcon
} from '@heroicons/react/24/outline';
import { userApi } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';

interface StandingsGroup {
  key: string;
  name: string;
  lives: number | null;
  has_picked: boolean | null;
  count: number;
  icon: string;
}

interface YourPosition {
  lives: number;
  status: string;
  has_picked: boolean;
  group_key: string;
  group_name: string;
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
  const [yourPosition, setYourPosition] = useState<YourPosition | null>(null);
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

  // Load summary on mount
  const loadSummary = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    else setRefreshing(true);

    try {
      const response = await userApi.getStandingsSummary(parseInt(competitionId));

      if (response.data.return_code === 'SUCCESS') {
        setCompetition(response.data.competition || null);
        setRoundState(response.data.round_state || '');
        setYourPosition(response.data.your_position || null);
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
  };

  // Load players for a specific group
  const loadGroupPlayers = async (groupKey: string, page = 1) => {
    setGroupLoading(prev => ({ ...prev, [groupKey]: true }));

    try {
      const response = await userApi.getStandingsGroup(parseInt(competitionId), groupKey, page, 20);

      if (response.data.return_code === 'SUCCESS') {
        setGroupPlayers(prev => ({
          ...prev,
          [groupKey]: response.data.players || []
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

  useEffect(() => {
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      router.push('/login');
      return;
    }

    const user = getCurrentUser();
    setCurrentUser(user);
    loadSummary();
  }, [router, competitionId]);

  // Get icon component
  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case 'trophy': return TrophyIcon;
      case 'clock': return ClockIcon;
      case 'heart': return HeartIcon;
      case 'warning': return XCircleIcon;
      case 'eliminated': return MinusCircleIcon;
      default: return HeartIcon;
    }
  };

  // Get color classes
  const getGroupColor = (iconName: string) => {
    switch (iconName) {
      case 'trophy': return 'border-green-200 bg-green-50';
      case 'clock': return 'border-blue-200 bg-blue-50';
      case 'heart': return 'border-amber-200 bg-amber-50';
      case 'warning': return 'border-orange-200 bg-orange-50';
      case 'eliminated': return 'border-slate-200 bg-slate-50';
      default: return 'border-slate-200 bg-slate-50';
    }
  };

  const getIconColor = (iconName: string) => {
    switch (iconName) {
      case 'trophy': return 'text-green-600';
      case 'clock': return 'text-blue-600';
      case 'heart': return 'text-amber-600';
      case 'warning': return 'text-orange-600';
      case 'eliminated': return 'text-slate-500';
      default: return 'text-slate-600';
    }
  };

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
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* Competition Name */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <h2 className="text-xl font-bold text-slate-900 text-center">{competition.name}</h2>
          <p className="text-sm text-slate-600 text-center mt-1">Round {competition.current_round}</p>
        </div>

        {/* Your Position Card */}
        {yourPosition && yourPosition.status !== 'out' && (
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-md border-2 border-blue-500 p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-white">Your Position</h3>
              <div className="flex items-center space-x-2">
                <HeartIcon className="h-5 w-5 text-blue-200 fill-current" />
                <span className="text-xl font-bold text-white">{yourPosition.lives}</span>
              </div>
            </div>
            <div className="text-blue-100 text-sm">{yourPosition.group_name}</div>
            {roundState === 'ACTIVE' && (
              <div className="mt-2 flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${yourPosition.has_picked ? 'bg-green-400' : 'bg-orange-400'}`}></div>
                <span className="text-sm text-blue-100">
                  {yourPosition.has_picked ? 'Pick submitted' : 'No pick yet'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Groups */}
        <div className="space-y-3">
          {groups.map((group) => {
            const Icon = getIconComponent(group.icon);
            const isExpanded = expandedGroups[group.key];
            const players = groupPlayers[group.key] || [];
            const isLoading = groupLoading[group.key];

            return (
              <div key={group.key} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Group Header - Clickable */}
                <button
                  onClick={() => toggleGroup(group.key)}
                  className={`w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors ${getGroupColor(group.icon)}`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className={`h-6 w-6 ${getIconColor(group.icon)}`} />
                    <div className="text-left">
                      <div className="font-semibold text-slate-900">{group.name}</div>
                      <div className="text-sm text-slate-600">{group.count} {group.count === 1 ? 'player' : 'players'}</div>
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
                    {isLoading ? (
                      <div className="p-8 text-center">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-transparent"></div>
                      </div>
                    ) : players.length > 0 ? (
                      <div className="divide-y divide-slate-100">
                        {players.map((player) => {
                          const isYou = currentUser?.id === player.id;

                          return (
                            <div
                              key={player.id}
                              className={`p-4 ${isYou ? 'bg-blue-50' : 'hover:bg-slate-50'} transition-colors`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-2">
                                  <span className="font-medium text-slate-900">{player.display_name}</span>
                                  {isYou && (
                                    <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full font-medium">
                                      You
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center space-x-1">
                                  <HeartIcon className="h-4 w-4 text-red-500 fill-current" />
                                  <span className="text-sm font-medium text-slate-600">{player.lives_remaining}</span>
                                </div>
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

                              {/* Elimination Info */}
                              {player.elimination_pick && (
                                <div className="text-xs text-slate-600 mb-2">
                                  Out Round {player.elimination_pick.round_number} • {player.elimination_pick.team}
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

      {/* History Modal */}
      {showHistoryModal && selectedPlayer && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => {
            setShowHistoryModal(false);
            setSelectedPlayer(null);
            setPlayerHistory([]);
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
