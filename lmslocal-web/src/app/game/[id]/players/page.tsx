'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  TrashIcon,
  CurrencyDollarIcon,
  PlusIcon,
  MinusIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import { competitionApi, adminApi, Competition, Player } from '@/lib/api';
import { useAppData } from '@/contexts/AppDataContext';
import ConfirmationModal from '@/components/ConfirmationModal';


export default function CompetitionPlayersPage() {
  const router = useRouter();
  const params = useParams();
  const competitionId = parseInt(params.id as string);
  
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

  // Lives management state - track pending changes before saving
  const [pendingLivesChanges, setPendingLivesChanges] = useState<Map<number, number>>(new Map());
  const [savingLivesChanges, setSavingLivesChanges] = useState(false);

  // Player status management state
  const [updatingStatus, setUpdatingStatus] = useState<Set<number>>(new Set());

  // Player unhide management state
  const [unhidingPlayer, setUnhidingPlayer] = useState<Set<number>>(new Set());

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Create abort controller for this effect
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const initializeData = async () => {
      // Check authentication
      const token = localStorage.getItem('jwt_token');
      
      if (!token) {
        if (!controller.signal.aborted) router.push('/login');
        return;
      }

      try {
        if (!controller.signal.aborted) {
          await loadPlayers();
        }
      } catch (error) {
        console.error('Error initializing data:', error);
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
        const playersData = response.data.players as Player[];
        setPlayers(playersData);
      } else {
        console.error('Failed to load players:', response.data.message);
        router.push(`/game/${competitionId}/dashboard`);
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

  // Local lives management - update UI immediately, track changes for batch save
  const handleLivesChange = (playerId: number, operation: 'add' | 'subtract') => {
    if (!competition || savingLivesChanges) return;

    setPlayers(prev => prev.map(player => {
      if (player.id === playerId) {
        const currentLives = player.lives_remaining || 0; // Handle undefined case
        const newLives = operation === 'add'
          ? Math.min(2, currentLives + 1)
          : Math.max(0, currentLives - 1);

        // Track this change for batch save
        setPendingLivesChanges(prevPending => {
          const newPending = new Map(prevPending);
          newPending.set(playerId, newLives);
          return newPending;
        });

        return { ...player, lives_remaining: newLives };
      }
      return player;
    }));
  };

  // Save all pending lives changes to the server
  const handleSaveLivesChanges = async () => {
    if (!competition || pendingLivesChanges.size === 0 || savingLivesChanges) return;

    setSavingLivesChanges(true);

    try {
      // Send all changes to the server sequentially
      const results = [];
      for (const [playerId, newLives] of pendingLivesChanges) {
        // Find the original lives count to determine the operation
        const originalPlayer = players.find(p => p.id === playerId);
        if (!originalPlayer) continue;

        const response = await adminApi.updatePlayerLives(
          competition.id,
          playerId,
          'set',
          newLives,
          `Admin batch update: set to ${newLives} lives`
        );

        results.push({
          playerId,
          success: response.data.return_code === 'SUCCESS',
          error: response.data.message
        });
      }

      // Check for any failures
      const failures = results.filter(r => !r.success);
      if (failures.length > 0) {
        alert(`Failed to update ${failures.length} player(s). Please try again.`);
        // Keep failed changes in pending list
        setPendingLivesChanges(prev => {
          const newPending = new Map();
          failures.forEach(f => {
            if (prev.has(f.playerId)) {
              newPending.set(f.playerId, prev.get(f.playerId));
            }
          });
          return newPending;
        });
      } else {
        // All successful - clear pending changes and refresh data
        setPendingLivesChanges(new Map());

        // Clear the players cache to ensure fresh data on next load
        const { apiCache } = await import('@/lib/cache');
        apiCache.delete(`competition-players-${competition.id}`);

        // Reload fresh player data from server
        await loadPlayers();
      }

    } catch (error) {
      console.error('Failed to save lives changes:', error);
      alert('Failed to save lives changes. Please try again.');
    } finally {
      setSavingLivesChanges(false);
    }
  };

  // Reset any unsaved lives changes back to original values
  const handleCancelLivesChanges = () => {
    if (savingLivesChanges) return;

    // Reload the original player data to reset any pending changes
    loadPlayers();
    setPendingLivesChanges(new Map());
  };

  // Player status toggle - between 'active' and 'out'
  const handleStatusToggle = async (playerId: number, currentStatus: string) => {
    if (!competition || updatingStatus.has(playerId)) return;

    // Normalize current status (handle undefined/null as 'active')
    const normalizedCurrentStatus = currentStatus || 'active';

    // Determine new status - toggle between 'active' and 'out'
    const newStatus = normalizedCurrentStatus === 'active' ? 'out' : 'active';
    const statusLabel = newStatus === 'active' ? 'ACTIVE' : 'OUT';

    setUpdatingStatus(prev => new Set([...prev, playerId]));

    try {
      const response = await adminApi.updatePlayerStatus(
        competition.id,
        playerId,
        newStatus,
        `Admin manually set player as ${statusLabel}`
      );

      if (response.data.return_code === 'SUCCESS') {
        // Update the local state with new status
        setPlayers(prev => prev.map(player =>
          player.id === playerId
            ? { ...player, status: newStatus }
            : player
        ));

        // Clear the players cache to ensure fresh data on page reload
        const { apiCache } = await import('@/lib/cache');
        apiCache.delete(`competition-players-${competition.id}`);
      } else {
        console.error(`Failed to update player status: ${response.data.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to update player status:', error);
    } finally {
      setUpdatingStatus(prev => {
        const newSet = new Set(prev);
        newSet.delete(playerId);
        return newSet;
      });
    }
  };

  // Handle unhiding competition for a specific player
  const handleUnhidePlayer = async (playerId: number) => {
    if (!competition) return;

    setUnhidingPlayer(prev => new Set(prev).add(playerId));

    try {
      const response = await competitionApi.unhidePlayer(competition.id, playerId);

      if (response.data.return_code === 'SUCCESS') {
        // Update the local state to remove hidden flag
        setPlayers(prev => prev.map(player =>
          player.id === playerId
            ? { ...player, hidden: false }
            : player
        ));

        // Clear the players cache to ensure fresh data on page reload
        const { apiCache } = await import('@/lib/cache');
        apiCache.delete(`competition-players-${competition.id}`);
      } else {
        console.error(`Failed to unhide player: ${response.data.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to unhide player:', error);
    } finally {
      setUnhidingPlayer(prev => {
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-400 border-t-transparent"></div>
          </div>
          <h3 className="text-lg font-medium text-slate-900 mb-2">Loading Players</h3>
          <p className="text-slate-500">Please wait while we fetch player data...</p>
        </div>
      </div>
    );
  }

  const activePlayers = filteredPlayers.filter(p => p.status === 'active');
  
  // Payment summary
  const paidCount = players.filter(p => p.paid).length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link href={`/game/${competitionId}`} className="flex items-center space-x-2 text-slate-600 hover:text-slate-800 transition-colors">
                <ArrowLeftIcon className="h-5 w-5" />
                <span className="font-medium">Back</span>
              </Link>
              <div className="h-6 w-px bg-slate-300" />
              <div>
                <h1 className="text-lg font-semibold text-slate-900">Players</h1>
              </div>
            </div>
            
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        
        {/* Header with Competition Info & Quick Stats */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-slate-900 mb-1">{competition?.name}</h1>
              <div className="flex items-center space-x-4 text-sm text-slate-600">
                <span>{players.length} total</span>
                <span>•</span>
                <span>{activePlayers.length} active</span>
                <span>•</span>
                <span>{paidCount}/{players.length} paid</span>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          {/* Access Code */}
          {competition?.access_code && (
            <div className="flex items-center space-x-3">
              <span className="text-sm text-slate-600">Join code:</span>
              <code className="px-2 py-1 bg-slate-100 text-slate-900 rounded font-mono text-sm font-medium">{competition.access_code}</code>
              <button
                onClick={() => navigator.clipboard.writeText(competition.access_code!)}
                className="text-xs text-slate-500 hover:text-slate-700 underline"
              >
                copy
              </button>
            </div>
          )}

          {/* Filter Buttons */}
          <div className="flex space-x-2">
            <button
              onClick={() => setPaymentFilter('all')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                paymentFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setPaymentFilter('paid')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                paymentFilter === 'paid'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Paid
            </button>
            <button
              onClick={() => setPaymentFilter('unpaid')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                paymentFilter === 'unpaid'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Unpaid
            </button>
          </div>
        </div>

        {/* Lives Changes Save/Cancel Bar - Show when there are pending changes */}
        {pendingLivesChanges.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-blue-900">
                  {pendingLivesChanges.size} player{pendingLivesChanges.size !== 1 ? 's' : ''} with unsaved lives changes
                </span>
                <span className="text-xs text-blue-600">
                  (* indicates changed)
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCancelLivesChanges}
                  disabled={savingLivesChanges}
                  className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-white border border-blue-300 rounded hover:bg-blue-50 transition-colors disabled:opacity-50"
                >
                  Cancel Changes
                </button>
                <button
                  onClick={handleSaveLivesChanges}
                  disabled={savingLivesChanges}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm"
                >
                  {savingLivesChanges ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent mr-1"></div>
                      Saving...
                    </div>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Players List - Simplified */}
        <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
          {filteredPlayers.map((player) => (
            <div key={player.id} className={`p-4 hover:bg-slate-50 transition-colors ${
              player.hidden ? 'bg-red-50 border-l-4 border-red-200' : ''
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                {/* Player Info - Stack on mobile, inline on desktop */}
                <div className="flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2">
                    <div className="flex items-center flex-wrap gap-2 mb-1 sm:mb-0">
                      <p className="font-medium text-slate-900 break-words">{player.display_name}</p>
                      {player.status === 'eliminated' && (
                        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">OUT</span>
                      )}
                      {player.is_managed && (
                        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">Managed</span>
                      )}
                      {player.hidden && (
                        <span className="text-xs text-red-700 bg-red-100 px-2 py-0.5 rounded">Hidden</span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 break-words">{player.email || 'No email'}</p>
                </div>

                {/* Status & Actions - Compact on mobile */}
                <div className="flex items-center justify-end space-x-2 sm:space-x-4">
                  {/* Lives Management - Immediate UI Updates with Pending Changes */}
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleLivesChange(player.id, 'subtract')}
                      disabled={savingLivesChanges || (player.lives_remaining || 0) <= 0}
                      className="p-1 text-red-500 hover:text-red-700 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Remove 1 life"
                    >
                      <MinusIcon className="h-4 w-4" strokeWidth={2} />
                    </button>

                    <div className="flex items-center space-x-1 px-1 sm:px-2">
                      <span className={`text-sm font-medium min-w-[1rem] text-center ${
                        pendingLivesChanges.has(player.id) ? 'text-blue-600 font-bold' : 'text-slate-900'
                      }`}>
                        {player.lives_remaining || 0}
                      </span>
                      <span className="text-xs text-slate-500 hidden sm:inline">lives</span>
                      <span className="text-xs text-slate-500 sm:hidden">L</span>
                      {pendingLivesChanges.has(player.id) && (
                        <span className="text-xs text-blue-500">*</span>
                      )}
                    </div>

                    <button
                      onClick={() => handleLivesChange(player.id, 'add')}
                      disabled={savingLivesChanges || (player.lives_remaining || 0) >= 3}
                      className="p-1 text-green-500 hover:text-green-700 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Add 1 life"
                    >
                      <PlusIcon className="h-4 w-4" strokeWidth={2} />
                    </button>
                  </div>

                  {/* Payment Status */}
                  <div className="text-center">
                    <p className="text-sm font-medium">
                      {player.paid ? (
                        <span className="text-green-600">Paid</span>
                      ) : (
                        <span className="text-orange-600">Unpaid</span>
                      )}
                    </p>
                  </div>

                  {/* Other Actions */}
                  <div className="flex items-center space-x-1">
                    {/* Status Toggle - Shows current status and allows toggle */}
                    <button
                      onClick={() => handleStatusToggle(player.id, player.status || 'active')}
                      disabled={updatingStatus.has(player.id)}
                      className={`px-2 py-1 text-xs font-medium rounded transition-colors disabled:opacity-50 ${
                        (player.status || 'active') === 'active'
                          ? 'bg-green-100 text-green-700 hover:bg-green-50 border border-green-300'
                          : 'bg-red-100 text-red-700 hover:bg-red-50 border border-red-300'
                      }`}
                      title={`Currently ${(player.status || 'active') === 'active' ? 'ACTIVE' : 'OUT'} - Click to toggle`}
                    >
                      {updatingStatus.has(player.id) ? (
                        <div className="animate-spin rounded-full h-3 w-3 border border-slate-400 border-t-transparent mx-1"></div>
                      ) : (
                        (player.status || 'active') === 'active' ? 'ACTIVE' : 'OUT'
                      )}
                    </button>

                    {/* Payment Toggle */}
                    <button
                      onClick={() => handlePaymentToggle(player.id, player.paid)}
                      disabled={updatingPayment.has(player.id)}
                      className="p-1 text-slate-500 hover:text-slate-700 rounded transition-colors disabled:opacity-50"
                      title={player.paid ? 'Mark unpaid' : 'Mark paid'}
                    >
                      {updatingPayment.has(player.id) ? (
                        <div className="animate-spin rounded-full h-3 w-3 border border-slate-400 border-t-transparent"></div>
                      ) : (
                        <CurrencyDollarIcon className="h-4 w-4" strokeWidth={1.5} />
                      )}
                    </button>

                    {/* Unhide Player - Only show for hidden players */}
                    {player.hidden && (
                      <button
                        onClick={() => handleUnhidePlayer(player.id)}
                        disabled={unhidingPlayer.has(player.id)}
                        className="p-1 text-red-600 hover:text-green-600 rounded transition-colors disabled:opacity-50"
                        title="Unhide competition for this player"
                      >
                        {unhidingPlayer.has(player.id) ? (
                          <div className="animate-spin rounded-full h-3 w-3 border border-slate-400 border-t-transparent"></div>
                        ) : (
                          <EyeIcon className="h-4 w-4" strokeWidth={1.5} />
                        )}
                      </button>
                    )}

                    {/* Remove Player */}
                    {competition?.invite_code && (
                      <button
                        onClick={() => handleRemovePlayerClick(player.id, player.display_name)}
                        disabled={removing.has(player.id)}
                        className="p-1 text-slate-500 hover:text-red-600 rounded transition-colors disabled:opacity-50"
                        title="Remove player"
                      >
                        {removing.has(player.id) ? (
                          <div className="animate-spin rounded-full h-3 w-3 border border-slate-400 border-t-transparent"></div>
                        ) : (
                          <TrashIcon className="h-4 w-4" strokeWidth={1.5} />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* No Players State */}
        {players.length === 0 && (
          <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
            <h3 className="text-lg font-medium text-slate-900 mb-2">No players yet</h3>
            <p className="text-slate-600 mb-4">
              Share your join code to get players started.
            </p>
            {competition?.access_code && (
              <div className="inline-flex items-center space-x-2">
                <code className="px-3 py-1 bg-slate-100 text-slate-900 rounded font-mono font-medium">{competition.access_code}</code>
                <button
                  onClick={() => navigator.clipboard.writeText(competition.access_code!)}
                  className="text-slate-500 hover:text-slate-700 underline text-sm"
                >
                  copy
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

    </div>
  );
}