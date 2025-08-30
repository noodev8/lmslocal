'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  TrophyIcon,
  ArrowLeftIcon,
  UserIcon,
  TrashIcon,
  CalendarIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { competitionApi } from '@/lib/api';
import { logout } from '@/lib/auth';
import ConfirmationModal from '@/components/ConfirmationModal';

interface User {
  id: number;
  display_name: string;
  email: string;
}

interface Competition {
  id: number;
  name: string;
  player_count: number;
  invite_code?: string;
}

interface Player {
  id: number;
  display_name: string;
  email: string;
  status: 'active' | 'eliminated';
  lives_remaining: number;
  joined_at: string;
}

export default function CompetitionPlayersPage() {
  const router = useRouter();
  const params = useParams();
  const competitionId = parseInt(params.id as string);
  
  const [user, setUser] = useState<User | null>(null);
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<Set<number>>(new Set());
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [playerToRemove, setPlayerToRemove] = useState<{ id: number; name: string } | null>(null);
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
          await loadPlayers();
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

  const loadPlayers = async () => {
    if (abortControllerRef.current?.signal.aborted) return;
    
    try {
      const response = await competitionApi.getPlayers(competitionId);
      if (abortControllerRef.current?.signal.aborted) return;
      
      if (response.data.return_code === 'SUCCESS') {
        setCompetition(response.data.competition);
        setPlayers(response.data.players);
      } else {
        console.error('Failed to load players:', response.data.message);
        router.push('/dashboard');
      }
    } catch (error) {
      if (abortControllerRef.current?.signal.aborted) return;
      console.error('Failed to load players:', error);
      router.push('/dashboard');
    } finally {
      if (!abortControllerRef.current?.signal.aborted) {
        setLoading(false);
      }
    }
  };

  const handleRemovePlayerClick = (playerId: number, playerName: string) => {
    setPlayerToRemove({ id: playerId, name: playerName });
    setShowConfirmModal(true);
  };

  const handleConfirmRemove = async () => {
    if (!playerToRemove) return;

    const { id: playerId, name: playerName } = playerToRemove;
    setRemoving(prev => new Set(prev).add(playerId));
    
    try {
      const response = await competitionApi.removePlayer(competitionId, playerId);
      
      if (response.data.return_code === 'SUCCESS') {
        // Remove player from local state
        setPlayers(prev => prev.filter(p => p.id !== playerId));
        
        // Update competition player count if available
        setCompetition(prev => prev ? { 
          ...prev, 
          player_count: prev.player_count - 1 
        } : null);
      } else {
        console.error('Failed to remove player:', response.data.message);
        alert(`Failed to remove player: ${response.data.message}`);
      }
    } catch (error) {
      console.error('Failed to remove player:', error);
      alert('Failed to remove player due to network error');
    } finally {
      setRemoving(prev => {
        const newSet = new Set(prev);
        newSet.delete(playerId);
        return newSet;
      });
      setShowConfirmModal(false);
      setPlayerToRemove(null);
    }
  };

  const handleCancelRemove = () => {
    setShowConfirmModal(false);
    setPlayerToRemove(null);
  };

  const handleLogout = () => {
    logout(router);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  const activePlayers = players.filter(p => p.status === 'active');
  const eliminatedPlayers = players.filter(p => p.status === 'eliminated');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Link href="/dashboard" className="mr-3 p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
              </Link>
              <Link href="/" className="flex items-center">
                <TrophyIcon className="h-8 w-8 text-green-600" />
                <span className="ml-2 text-xl font-bold text-gray-900">LMSLocal</span>
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Welcome, <span className="font-medium text-gray-900">{user?.display_name}</span>
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
        
        {/* Title & Competition Info */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Player Management</h1>
          <p className="text-lg text-gray-600 mb-4">{competition?.name}</p>
          
          {/* Competition Stats */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{activePlayers.length}</div>
                <div className="text-sm text-gray-600">Active Players</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{eliminatedPlayers.length}</div>
                <div className="text-sm text-gray-600">Eliminated</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{players.length}</div>
                <div className="text-sm text-gray-600">Total Players</div>
              </div>
            </div>
            
            {competition?.invite_code && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Access Code (Still Recruiting)</p>
                    <p className="text-lg font-bold text-blue-600 tracking-wider">{competition.invite_code}</p>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(competition.invite_code!);
                    }}
                    className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200 transition-colors"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Active Players */}
        {activePlayers.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <UserIcon className="h-5 w-5 text-green-600 mr-2" />
              Active Players ({activePlayers.length})
            </h2>
            
            <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
              {activePlayers.map((player) => (
                <div key={player.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex items-center">
                    <div className="bg-green-100 rounded-full p-2 mr-3">
                      <UserIcon className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{player.display_name}</p>
                      <p className="text-sm text-gray-600">{player.email}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {player.lives_remaining} {player.lives_remaining === 1 ? 'life' : 'lives'}
                      </p>
                      <p className="text-xs text-gray-600 flex items-center">
                        <CalendarIcon className="h-3 w-3 mr-1" />
                        Joined {new Date(player.joined_at).toLocaleDateString('en-GB')}
                      </p>
                    </div>
                    
                    <button
                      onClick={() => handleRemovePlayerClick(player.id, player.display_name)}
                      disabled={removing.has(player.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Remove player"
                    >
                      {removing.has(player.id) ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b border-red-600"></div>
                      ) : (
                        <TrashIcon className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Eliminated Players */}
        {eliminatedPlayers.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-600 mr-2" />
              Eliminated Players ({eliminatedPlayers.length})
            </h2>
            
            <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
              {eliminatedPlayers.map((player) => (
                <div key={player.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex items-center">
                    <div className="bg-red-100 rounded-full p-2 mr-3">
                      <UserIcon className="h-4 w-4 text-red-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-500">{player.display_name}</p>
                      <p className="text-sm text-gray-400">{player.email}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="text-sm font-medium text-red-600">Eliminated</p>
                      <p className="text-xs text-gray-400 flex items-center">
                        <CalendarIcon className="h-3 w-3 mr-1" />
                        Joined {new Date(player.joined_at).toLocaleDateString('en-GB')}
                      </p>
                    </div>
                    
                    <button
                      onClick={() => handleRemovePlayerClick(player.id, player.display_name)}
                      disabled={removing.has(player.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Remove player"
                    >
                      {removing.has(player.id) ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b border-red-600"></div>
                      ) : (
                        <TrashIcon className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* No Players State */}
        {players.length === 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <UserIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Players Yet</h3>
            <p className="text-gray-600 mb-4">
              Share your access code to start getting players to join your competition.
            </p>
            {competition?.invite_code && (
              <div className="bg-gray-50 rounded-lg p-4 inline-block">
                <p className="text-sm font-medium text-gray-900 mb-1">Access Code</p>
                <p className="text-xl font-bold text-blue-600 tracking-wider">{competition.invite_code}</p>
              </div>
            )}
          </div>
        )}

      </main>
      
      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={handleCancelRemove}
        onConfirm={handleConfirmRemove}
        title="Remove Player"
        message={playerToRemove ? `Are you sure you want to remove ${playerToRemove.name} from the competition? This will delete all their picks and progress data and cannot be undone.` : ''}
        confirmText="Remove Player"
        isLoading={playerToRemove ? removing.has(playerToRemove.id) : false}
      />
    </div>
  );
}