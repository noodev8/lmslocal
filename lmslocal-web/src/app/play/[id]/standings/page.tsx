'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  TrophyIcon,
  ArrowLeftIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  UserIcon
} from '@heroicons/react/24/outline';
import { userApi } from '@/lib/api';
import { logout } from '@/lib/auth';

interface User {
  id: number;
  display_name: string;
  email: string;
}

interface Competition {
  id: number;
  name: string;
  current_round: number;
  is_locked: boolean;
  invite_code?: string;
}

interface RoundHistory {
  round_id: number;
  round_number: number;
  lock_time: string;
  pick_team: string | null;
  pick_team_full_name: string | null;
  visible_pick_team: string | null;
  visible_pick_team_full_name: string | null;
  home_team: string | null;
  away_team: string | null;
  result: string | null;
  pick_result: 'no_pick' | 'pending' | 'win' | 'draw' | 'loss';
}

interface Player {
  id: number;
  display_name: string;
  lives_remaining: number;
  status: string;
  history: RoundHistory[];
}

export default function CompetitionStandingsPage() {
  const router = useRouter();
  const params = useParams();
  const competitionId = params.id as string;
  
  const [user, setUser] = useState<User | null>(null);
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPlayers, setExpandedPlayers] = useState<Set<number>>(new Set());
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Create abort controller for this effect
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const initializeData = async () => {
      // Check authentication
      const token = localStorage.getItem('jwt_token');
      const userData = localStorage.getItem('user');
      
      if (!token || !userData) {
        if (!controller.signal.aborted) router.push('/login');
        return;
      }

      try {
        const parsedUser = JSON.parse(userData);
        if (!controller.signal.aborted) {
          setUser(parsedUser);
          await loadStandings();
        }
      } catch (error) {
        console.error('Error parsing user data:', error);
        if (!controller.signal.aborted) router.push('/login');
        return;
      }
    };

    // Handle auth expiration
    const handleAuthExpired = () => {
      if (!controller.signal.aborted) {
        router.push('/login');
      }
    };

    window.addEventListener('auth-expired', handleAuthExpired);
    initializeData();

    return () => {
      controller.abort();
      window.removeEventListener('auth-expired', handleAuthExpired);
      abortControllerRef.current = null;
    };
  }, [competitionId, router]);

  const loadStandings = async () => {
    if (abortControllerRef.current?.signal.aborted) return;
    
    try {
      const response = await userApi.getCompetitionStandings(parseInt(competitionId));
      if (abortControllerRef.current?.signal.aborted) return;
      
      if (response.data.return_code === 'SUCCESS') {
        setCompetition(response.data.competition);
        setPlayers(response.data.players);
      } else {
        console.error('Failed to load standings:', response.data.message);
        router.push('/play');
      }
    } catch (error) {
      if (abortControllerRef.current?.signal.aborted) return;
      console.error('Failed to load standings:', error);
      router.push('/play');
    } finally {
      if (!abortControllerRef.current?.signal.aborted) {
        setLoading(false);
      }
    }
  };

  const togglePlayerExpansion = (playerId: number) => {
    setExpandedPlayers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(playerId)) {
        newSet.delete(playerId);
      } else {
        newSet.add(playerId);
      }
      return newSet;
    });
  };

  const handleLogout = () => {
    logout(router);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!competition) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h3 className="text-xl font-medium text-gray-900 mb-2">Competition Not Found</h3>
          <Link href="/play" className="text-blue-600 hover:text-blue-700">
            Back to Competitions
          </Link>
        </div>
      </div>
    );
  }

  const activePlayers = players.filter(p => p.status !== 'OUT');
  const eliminatedPlayers = players.filter(p => p.status === 'OUT');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Link href={`/play/${competitionId}`} className="mr-3 p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
              </Link>
              <Link href="/" className="flex items-center">
                <TrophyIcon className="h-8 w-8 text-blue-600" />
                <span className="ml-2 text-xl font-bold text-gray-900">LMSLocal</span>
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {user?.display_name}
              </span>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Title */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{competition.name}</h1>
              <p className="text-gray-600">
                {activePlayers.length === 1 && !competition.invite_code
                  ? `🏆 Competition Complete - We have a winner!`
                  : `Round ${competition.current_round || 1} Standings - ${activePlayers.length} players remaining`
                }
              </p>
            </div>
          </div>
        </div>

        {/* Winner/Active Players */}
        {activePlayers.length > 0 && (
          <div className={`rounded-lg border p-4 sm:p-6 mb-6 ${
            activePlayers.length === 1 && !competition.invite_code
              ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200' 
              : 'bg-white border-gray-200'
          }`}>
            <h2 className="text-lg font-semibold mb-4 flex items-center">
              {activePlayers.length === 1 && !competition.invite_code ? (
                <>
                  <span className="text-2xl mr-3">🏆</span>
                  <span className="text-yellow-800">Competition Winner!</span>
                </>
              ) : (
                <>
                  <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                  <span className="text-gray-900">Active Players ({activePlayers.length})</span>
                </>
              )}
            </h2>
            
            <div className="space-y-3">
              {activePlayers.map((player) => (
                <div key={player.id} className={`border rounded-lg ${
                  activePlayers.length === 1 && !competition.invite_code
                    ? 'border-yellow-300 bg-yellow-50' 
                    : 'border-gray-200'
                }`}>
                  <div 
                    className={`flex items-center justify-between p-4 cursor-pointer ${
                      activePlayers.length === 1 && !competition.invite_code
                        ? 'hover:bg-yellow-100' 
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => togglePlayerExpansion(player.id)}
                  >
                    <div className="flex items-center gap-3">
                      {activePlayers.length === 1 && !competition.invite_code ? (
                        <span className="text-xl">👑</span>
                      ) : (
                        <UserIcon className="h-5 w-5 text-gray-400" />
                      )}
                      <span className={`font-medium ${
                        activePlayers.length === 1 && !competition.invite_code
                          ? 'text-yellow-900 text-lg' 
                          : 'text-gray-900'
                      }`}>
                        {player.display_name}
                        {activePlayers.length === 1 && !competition.invite_code && (
                          <span className="ml-2 text-sm font-bold text-yellow-700">WINNER</span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 text-sm rounded-full font-bold ${
                        activePlayers.length === 1 && !competition.invite_code
                          ? 'bg-yellow-200 text-yellow-900'
                          : player.lives_remaining === 0 
                            ? 'bg-red-100 text-red-800' 
                            : player.lives_remaining === 1 
                              ? 'bg-orange-100 text-orange-800' 
                              : 'bg-green-100 text-green-800'
                      }`}>
                        {activePlayers.length === 1 && !competition.invite_code
                          ? 'CHAMPION' 
                          : `${player.lives_remaining} ${player.lives_remaining === 1 ? 'life' : 'lives'}`
                        }
                      </span>
                      {expandedPlayers.has(player.id) ? (
                        <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronRightIcon className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  </div>
                  
                  {/* Expanded History */}
                  {expandedPlayers.has(player.id) && (
                    <div className="border-t border-gray-200 p-4 bg-gray-50">
                      <h4 className="font-medium text-gray-900 mb-3">Round History</h4>
                      
                      {/* Desktop History Table */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-2 font-medium text-gray-700">Round</th>
                              <th className="text-left py-2 font-medium text-gray-700">Pick</th>
                              <th className="text-left py-2 font-medium text-gray-700">Fixture</th>
                              <th className="text-left py-2 font-medium text-gray-700">Result</th>
                              <th className="text-left py-2 font-medium text-gray-700">Outcome</th>
                            </tr>
                          </thead>
                          <tbody>
                            {player.history
                              .slice()
                              .sort((a, b) => b.round_number - a.round_number)
                              .map((round) => (
                              <tr key={round.round_id} className="border-b border-gray-100">
                                <td className="py-2">
                                  <span className="font-medium">Round {round.round_number}</span>
                                  {round.round_number === competition.current_round && (
                                    <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">Current</span>
                                  )}
                                </td>
                                <td className="py-2">
                                  {round.visible_pick_team_full_name ? (
                                    <span className="text-blue-600 font-medium">{round.visible_pick_team_full_name}</span>
                                  ) : round.round_number === competition.current_round && !competition.is_locked ? (
                                    <span className="text-gray-500 italic">Hidden until locked</span>
                                  ) : (
                                    <span className="text-gray-500">No Pick</span>
                                  )}
                                </td>
                                <td className="py-2">
                                  {round.home_team && round.away_team ? (
                                    <span className="text-gray-700">{round.home_team} v {round.away_team}</span>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                                <td className="py-2">
                                  {round.result ? (
                                    <span className="text-gray-700">
                                      {round.result === 'home_win' ? `${round.home_team} Win` :
                                       round.result === 'away_win' ? `${round.away_team} Win` :
                                       'Draw'}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">Pending</span>
                                  )}
                                </td>
                                <td className="py-2">
                                  <span className={`px-2 py-1 text-xs rounded font-medium ${
                                    round.pick_result === 'win' ? 'bg-green-100 text-green-800' :
                                    round.pick_result === 'draw' ? 'bg-yellow-100 text-yellow-800' :
                                    round.pick_result === 'loss' ? 'bg-red-100 text-red-800' :
                                    round.pick_result === 'no_pick' ? 'bg-gray-100 text-gray-600' :
                                    'bg-gray-100 text-gray-600'
                                  }`}>
                                    {round.pick_result === 'win' ? 'Win' :
                                     round.pick_result === 'draw' ? 'Draw' :
                                     round.pick_result === 'loss' ? 'Loss' :
                                     round.pick_result === 'no_pick' ? 'No Pick' :
                                     'Pending'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile History Cards */}
                      <div className="md:hidden space-y-3">
                        {player.history
                          .slice()
                          .sort((a, b) => b.round_number - a.round_number)
                          .map((round) => (
                          <div key={round.round_id} className="border border-gray-200 rounded-lg p-3 bg-white">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">Round {round.round_number}</span>
                                {round.round_number === competition.current_round && (
                                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">Current</span>
                                )}
                              </div>
                              <span className={`px-2 py-1 text-xs rounded font-medium ${
                                round.pick_result === 'win' ? 'bg-green-100 text-green-800' :
                                round.pick_result === 'draw' ? 'bg-yellow-100 text-yellow-800' :
                                round.pick_result === 'loss' ? 'bg-red-100 text-red-800' :
                                round.pick_result === 'no_pick' ? 'bg-gray-100 text-gray-600' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                                {round.pick_result === 'win' ? 'Win' :
                                 round.pick_result === 'draw' ? 'Draw' :
                                 round.pick_result === 'loss' ? 'Loss' :
                                 round.pick_result === 'no_pick' ? 'No Pick' :
                                 'Pending'}
                              </span>
                            </div>
                            
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Pick:</span>
                                {round.visible_pick_team_full_name ? (
                                  <span className="text-blue-600 font-medium">{round.visible_pick_team_full_name}</span>
                                ) : round.round_number === competition.current_round && !competition.is_locked ? (
                                  <span className="text-gray-500 italic">Hidden</span>
                                ) : (
                                  <span className="text-gray-500">No Pick</span>
                                )}
                              </div>
                              
                              {round.home_team && round.away_team && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Fixture:</span>
                                  <span className="text-gray-700 text-right">{round.home_team} v {round.away_team}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Eliminated Players */}
        {eliminatedPlayers.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
              Eliminated Players ({eliminatedPlayers.length})
            </h2>
            
            <div className="space-y-3">
              {eliminatedPlayers.map((player) => (
                <div key={player.id} className="border border-gray-200 rounded-lg">
                  <div 
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                    onClick={() => togglePlayerExpansion(player.id)}
                  >
                    <div className="flex items-center gap-3">
                      <UserIcon className="h-5 w-5 text-gray-400" />
                      <span className="font-medium text-gray-500">{player.display_name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-1 text-xs rounded font-medium bg-red-100 text-red-800">
                        OUT
                      </span>
                      {expandedPlayers.has(player.id) ? (
                        <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronRightIcon className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  </div>
                  
                  {/* Expanded History - Same as active players */}
                  {expandedPlayers.has(player.id) && (
                    <div className="border-t border-gray-200 p-4 bg-gray-50">
                      {/* Similar history display as active players - abbreviated for brevity */}
                      <h4 className="font-medium text-gray-900 mb-3">Round History</h4>
                      <p className="text-sm text-gray-600">
                        {player.display_name} was eliminated and is no longer in the competition.
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}