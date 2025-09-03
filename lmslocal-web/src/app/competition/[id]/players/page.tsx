'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  TrophyIcon,
  ArrowLeftIcon,
  UserIcon,
  TrashIcon,
  CalendarIcon,
  ExclamationTriangleIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
  XCircleIcon,
  FunnelIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';
import { competitionApi, adminApi, offlinePlayerApi, Competition, Player } from '@/lib/api';
import { useAppData } from '@/contexts/AppDataContext';
import { logout } from '@/lib/auth';
import ConfirmationModal from '@/components/ConfirmationModal';

interface User {
  id: number;
  display_name: string;
  email: string;
}



export default function CompetitionPlayersPage() {
  const router = useRouter();
  const params = useParams();
  const competitionId = parseInt(params.id as string);
  
  const [user, setUser] = useState<User | null>(null);
  const [competition, setCompetition] = useState<Competition | null>(null);
  
  // Use AppDataProvider context to avoid redundant API calls
  const { competitions } = useAppData();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<Set<number>>(new Set());
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [playerToRemove, setPlayerToRemove] = useState<{ id: number; name: string } | null>(null);
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [updatingPayment, setUpdatingPayment] = useState<Set<number>>(new Set());
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [addPlayerForm, setAddPlayerForm] = useState({ display_name: '', email: '' });
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
  }, [competitionId, router]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadPlayers = useCallback(async () => {
    if (abortControllerRef.current?.signal.aborted) return;
    
    try {
      // Use cached API call with 30-second TTL for player data
      const response = await competitionApi.getPlayers(competitionId);
      if (abortControllerRef.current?.signal.aborted) return;
      
      if (response.data.return_code === 'SUCCESS') {
        // Get competition from context if available, otherwise from API response
        const competitionFromContext = competitions?.find(c => c.id === competitionId);
        setCompetition(competitionFromContext || response.data.competition as Competition);
        setPlayers(response.data.players as Player[]);
      } else {
        console.error('Failed to load players:', response.data.message);
        router.push(`/competition/${competitionId}/dashboard`);
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
  }, [competitionId, router, competitions]);

  const handleRemovePlayerClick = (playerId: number, playerName: string) => {
    setPlayerToRemove({ id: playerId, name: playerName });
    setShowConfirmModal(true);
  };

  const handleConfirmRemove = async () => {
    if (!playerToRemove) return;

    const { id: playerId } = playerToRemove;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { name: playerName } = playerToRemove;
    setRemoving(prev => new Set(prev).add(playerId));
    
    try {
      const response = await competitionApi.removePlayer(competitionId, playerId);
      
      if (response.data.return_code === 'SUCCESS') {
        // Remove player from local state
        setPlayers(prev => prev.filter(p => p.id !== playerId));
        
        // Update competition player count if available
        setCompetition(prev => prev ? { 
          ...prev, 
          player_count: (prev.player_count || 0) - 1 
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

  const handleAddOfflinePlayer = async () => {
    if (!competition || !addPlayerForm.display_name.trim()) return;

    setAddingPlayer(true);
    
    try {
      const response = await offlinePlayerApi.addOfflinePlayer(
        competition.id,
        addPlayerForm.display_name.trim(),
        addPlayerForm.email.trim() || undefined
      );
      
      if (response.data.return_code === 'SUCCESS') {
        // Reload players list to show the new player
        await loadPlayers();
        
        // Reset form and close modal
        setAddPlayerForm({ display_name: '', email: '' });
        setShowAddPlayerModal(false);
      } else {
        alert(`Failed to add offline player: ${response.data.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to add offline player:', error);
      alert('Failed to add offline player. Please try again.');
    } finally {
      setAddingPlayer(false);
    }
  };

  const handlePaymentToggle = async (playerId: number, currentPaid: boolean) => {
    if (!competition || updatingPayment.has(playerId)) return;
    
    setUpdatingPayment(prev => new Set([...prev, playerId]));
    
    try {
      const response = await adminApi.updatePaymentStatus(
        competition.id,
        playerId,
        !currentPaid, // Toggle the payment status
        undefined, // No amount for now
        !currentPaid ? new Date().toISOString() : undefined // Set current time if marking as paid
      );
      
      if (response.data.return_code === 'SUCCESS') {
        // Update the local state
        setPlayers(prev => prev.map(player => 
          player.id === playerId 
            ? { 
                ...player, 
                paid: !currentPaid,
                paid_date: !currentPaid ? new Date().toISOString() : undefined
              }
            : player
        ));
      } else {
        alert(`Failed to update payment status: ${response.data.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to update payment:', error);
      alert('Failed to update payment status. Please try again.');
    } finally {
      setUpdatingPayment(prev => {
        const newSet = new Set(prev);
        newSet.delete(playerId);
        return newSet;
      });
    }
  };

  // Filter players based on payment status
  const filteredPlayers = players.filter(player => {
    if (paymentFilter === 'paid') return player.paid;
    if (paymentFilter === 'unpaid') return !player.paid;
    return true; // 'all'
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  const activePlayers = filteredPlayers.filter(p => p.status === 'active');
  const eliminatedPlayers = filteredPlayers.filter(p => p.status === 'eliminated');
  
  // Payment summary
  const paidCount = players.filter(p => p.paid).length;
  const unpaidCount = players.filter(p => !p.paid).length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-sm shadow-sm border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <Link href={`/competition/${competitionId}/dashboard`} className="mr-4 p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <ArrowLeftIcon className="h-5 w-5 text-slate-600" />
              </Link>
              <Link href="/" className="flex items-center">
                <TrophyIcon className="h-8 w-8 text-slate-700" />
                <span className="ml-2 text-2xl font-bold text-slate-900">LMSLocal</span>
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-slate-600">
                Welcome, <span className="font-medium text-slate-900">{user?.display_name}</span>
              </span>
              <button
                onClick={handleLogout}
                className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors"
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
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-2">Player Management</h1>
              <p className="text-xl text-slate-600">{competition?.name}</p>
            </div>
            {competition?.access_code && (
              <button
                onClick={() => setShowAddPlayerModal(true)}
                className="inline-flex items-center px-6 py-3 bg-slate-800 text-white rounded-xl font-semibold hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 transition-all shadow-sm"
              >
                <UserIcon className="h-5 w-5 mr-2" />
                Add Offline Player
              </button>
            )}
          </div>
          
          {/* Competition Stats - Premium Design */}
          <div className="bg-gradient-to-br from-slate-100 via-slate-50 to-stone-100 rounded-2xl border border-slate-200/50 p-8 shadow-sm">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <UserIcon className="h-8 w-8 text-emerald-600" />
                </div>
                <div className="text-3xl font-bold text-slate-900 mb-1">{activePlayers.length}</div>
                <div className="text-sm font-medium text-slate-600">Active Players</div>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <ExclamationTriangleIcon className="h-8 w-8 text-red-600" />
                </div>
                <div className="text-3xl font-bold text-slate-900 mb-1">{eliminatedPlayers.length}</div>
                <div className="text-sm font-medium text-slate-600">Eliminated</div>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <UserGroupIcon className="h-8 w-8 text-slate-600" />
                </div>
                <div className="text-3xl font-bold text-slate-900 mb-1">{players.length}</div>
                <div className="text-sm font-medium text-slate-600">Total Players</div>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <CheckCircleIcon className="h-8 w-8 text-green-600" />
                </div>
                <div className="text-3xl font-bold text-slate-900 mb-1">{paidCount}</div>
                <div className="text-sm font-medium text-slate-600">Paid Up</div>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-amber-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <CurrencyDollarIcon className="h-8 w-8 text-amber-600" />
                </div>
                <div className="text-3xl font-bold text-slate-900 mb-1">{unpaidCount}</div>
                <div className="text-sm font-medium text-slate-600">Pending Payment</div>
              </div>
            </div>
            
            {competition?.access_code && (
              <div className="mt-8 pt-8 border-t border-slate-200/50">
                <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border border-slate-200/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-700 mb-2">Competition Access Code</p>
                      <p className="text-2xl font-bold text-slate-800 tracking-wider font-mono">{competition.access_code}</p>
                      <p className="text-xs text-slate-500 mt-1">Share this code for players to join</p>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(competition.access_code!);
                      }}
                      className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-900 transition-colors shadow-sm"
                    >
                      Copy Code
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Payment Filter - Enhanced Design */}
        <div className="mb-8">
          <div className="bg-white/70 backdrop-blur-sm rounded-xl border border-slate-200/50 p-6 shadow-sm">
            <div className="flex items-center gap-6">
              <div className="flex items-center">
                <FunnelIcon className="h-5 w-5 text-slate-500 mr-2" />
                <span className="text-sm font-semibold text-slate-700">Filter Players</span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setPaymentFilter('all')}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    paymentFilter === 'all'
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  All Players ({players.length})
                </button>
                <button
                  onClick={() => setPaymentFilter('paid')}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    paymentFilter === 'paid'
                      ? 'bg-green-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Paid ({paidCount})
                </button>
                <button
                  onClick={() => setPaymentFilter('unpaid')}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    paymentFilter === 'unpaid'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Pending Payment ({unpaidCount})
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Active Players */}
        {activePlayers.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mr-4">
                <UserIcon className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Active Players</h2>
                <p className="text-slate-600">{activePlayers.length} players still in the competition</p>
              </div>
            </div>
            
            <div className="bg-white/70 backdrop-blur-sm rounded-xl border border-slate-200/50 divide-y divide-slate-200/50 shadow-sm">
              {activePlayers.map((player) => (
                <div key={player.id} className="p-6 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mr-4">
                      <UserIcon className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <p className="font-semibold text-slate-900 text-lg">{player.display_name}</p>
                        {player.is_managed && (
                          <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium">Managed</span>
                        )}
                      </div>
                      <p className="text-slate-600">{player.email || 'No email provided'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-6">
                    {/* Payment Status Badge */}
                    <div className="text-center">
                      {player.paid ? (
                        <div className="space-y-2">
                          <div className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-semibold bg-green-100 text-green-800">
                            <CheckCircleIcon className="h-4 w-4 mr-2" />
                            Paid
                          </div>
                          {player.paid_date && (
                            <p className="text-xs text-slate-500">
                              {new Date(player.paid_date).toLocaleDateString('en-GB')}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-semibold bg-amber-100 text-amber-800">
                          <XCircleIcon className="h-4 w-4 mr-2" />
                          Pending
                        </div>
                      )}
                    </div>

                    <div className="text-center">
                      <p className="text-lg font-bold text-slate-900 mb-1">
                        {player.lives_remaining}
                      </p>
                      <p className="text-xs font-medium text-slate-600">
                        {player.lives_remaining === 1 ? 'Life Left' : 'Lives Left'}
                      </p>
                    </div>

                    <div className="text-center">
                      <p className="text-sm font-medium text-slate-900 mb-1">Joined</p>
                      <p className="text-xs text-slate-600 flex items-center">
                        <CalendarIcon className="h-3 w-3 mr-1" />
                        {new Date(player.joined_at).toLocaleDateString('en-GB')}
                      </p>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handlePaymentToggle(player.id, player.paid)}
                        disabled={updatingPayment.has(player.id)}
                        className={`p-3 rounded-xl transition-all disabled:opacity-50 shadow-sm ${
                          player.paid 
                            ? 'text-amber-600 hover:bg-amber-50 bg-amber-50/50' 
                            : 'text-green-600 hover:bg-green-50 bg-green-50/50'
                        }`}
                        title={player.paid ? 'Mark as unpaid' : 'Mark as paid'}
                      >
                        {updatingPayment.has(player.id) ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-current border-t-transparent"></div>
                        ) : (
                          <CurrencyDollarIcon className="h-5 w-5" />
                        )}
                      </button>
                      
                      <button
                        onClick={() => handleRemovePlayerClick(player.id, player.display_name)}
                        disabled={removing.has(player.id)}
                        className="p-3 text-red-600 hover:bg-red-50 bg-red-50/50 rounded-xl transition-all disabled:opacity-50 shadow-sm"
                        title="Remove player"
                      >
                        {removing.has(player.id) ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-red-600 border-t-transparent"></div>
                        ) : (
                          <TrashIcon className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Eliminated Players */}
        {eliminatedPlayers.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mr-4">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Eliminated Players</h2>
                <p className="text-slate-600">{eliminatedPlayers.length} players knocked out of the competition</p>
              </div>
            </div>
            
            <div className="bg-white/70 backdrop-blur-sm rounded-xl border border-slate-200/50 divide-y divide-slate-200/50 shadow-sm opacity-75">
              {eliminatedPlayers.map((player) => (
                <div key={player.id} className="p-6 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mr-4">
                      <UserIcon className="h-6 w-6 text-red-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <p className="font-semibold text-slate-700 text-lg">{player.display_name}</p>
                        {player.is_managed && (
                          <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded-lg text-xs font-medium">Managed</span>
                        )}
                        <span className="px-2 py-1 bg-red-100 text-red-600 rounded-lg text-xs font-semibold">ELIMINATED</span>
                      </div>
                      <p className="text-slate-500">{player.email || 'No email provided'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-6">
                    {/* Payment Status Badge */}
                    <div className="text-center">
                      {player.paid ? (
                        <div className="space-y-2">
                          <div className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-semibold bg-green-100 text-green-800">
                            <CheckCircleIcon className="h-4 w-4 mr-2" />
                            Paid
                          </div>
                          {player.paid_date && (
                            <p className="text-xs text-slate-500">
                              {new Date(player.paid_date).toLocaleDateString('en-GB')}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-semibold bg-amber-100 text-amber-800">
                          <XCircleIcon className="h-4 w-4 mr-2" />
                          Pending
                        </div>
                      )}
                    </div>

                    <div className="text-center">
                      <p className="text-lg font-bold text-red-600 mb-1">0</p>
                      <p className="text-xs font-medium text-slate-600">Lives Left</p>
                    </div>

                    <div className="text-center">
                      <p className="text-sm font-medium text-slate-700 mb-1">Joined</p>
                      <p className="text-xs text-slate-500 flex items-center">
                        <CalendarIcon className="h-3 w-3 mr-1" />
                        {new Date(player.joined_at).toLocaleDateString('en-GB')}
                      </p>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handlePaymentToggle(player.id, player.paid)}
                        disabled={updatingPayment.has(player.id)}
                        className={`p-3 rounded-xl transition-all disabled:opacity-50 shadow-sm ${
                          player.paid 
                            ? 'text-amber-600 hover:bg-amber-50 bg-amber-50/50' 
                            : 'text-green-600 hover:bg-green-50 bg-green-50/50'
                        }`}
                        title={player.paid ? 'Mark as unpaid' : 'Mark as paid'}
                      >
                        {updatingPayment.has(player.id) ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-current border-t-transparent"></div>
                        ) : (
                          <CurrencyDollarIcon className="h-5 w-5" />
                        )}
                      </button>
                      
                      <button
                        onClick={() => handleRemovePlayerClick(player.id, player.display_name)}
                        disabled={removing.has(player.id)}
                        className="p-3 text-red-600 hover:bg-red-50 bg-red-50/50 rounded-xl transition-all disabled:opacity-50 shadow-sm"
                        title="Remove player"
                      >
                        {removing.has(player.id) ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-red-600 border-t-transparent"></div>
                        ) : (
                          <TrashIcon className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* No Players State */}
        {players.length === 0 && (
          <div className="bg-gradient-to-br from-slate-50 via-stone-50 to-slate-100 rounded-2xl border border-slate-200/50 p-16 text-center">
            <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <UserIcon className="h-10 w-10 text-slate-400" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-4">Ready to Build Your Competition</h3>
            <p className="text-lg text-slate-600 mb-8 max-w-lg mx-auto">
              Share your access code with players to get started. They&apos;ll be able to join instantly and start making picks.
            </p>
            {competition?.access_code && (
              <div className="bg-white/70 backdrop-blur-sm rounded-xl p-8 inline-block border border-slate-200/50 shadow-sm">
                <p className="text-sm font-semibold text-slate-700 mb-3">Competition Access Code</p>
                <p className="text-3xl font-bold text-slate-800 tracking-wider font-mono mb-4">{competition.access_code}</p>
                <button
                  onClick={() => navigator.clipboard.writeText(competition.access_code!)}
                  className="px-6 py-3 bg-slate-800 text-white rounded-xl font-semibold hover:bg-slate-900 transition-colors shadow-sm"
                >
                  Copy Code to Share
                </button>
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

      {/* Add Offline Player Modal */}
      {showAddPlayerModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200">
            <div className="p-8">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mr-4">
                  <UserIcon className="h-6 w-6 text-slate-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900">Add Offline Player</h3>
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
                    className="block w-full px-4 py-3 border border-slate-300 rounded-xl shadow-sm focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm bg-slate-50/50 transition-colors"
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
                    className="block w-full px-4 py-3 border border-slate-300 rounded-xl shadow-sm focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm bg-slate-50/50 transition-colors"
                    disabled={addingPlayer}
                  />
                </div>

                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <p className="text-sm text-slate-600">
                    💡 This creates a managed player that you can set picks for on the fixtures page. Perfect for customers without smartphones.
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-4 mt-8">
                <button
                  onClick={() => {
                    setShowAddPlayerModal(false);
                    setAddPlayerForm({ display_name: '', email: '' });
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}