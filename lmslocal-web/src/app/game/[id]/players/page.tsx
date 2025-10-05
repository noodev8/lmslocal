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
  EyeIcon,
  ClipboardDocumentListIcon,
  CheckCircleIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  EllipsisVerticalIcon
} from '@heroicons/react/24/outline';
import { competitionApi, adminApi, roundApi, fixtureApi, teamApi, userApi, Competition, Player, Team, cacheUtils } from '@/lib/api';
import { useAppData } from '@/contexts/AppDataContext';
import ConfirmationModal from '@/components/ConfirmationModal';
import { useToast, ToastContainer } from '@/components/Toast';


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
  const [updatingPayment, setUpdatingPayment] = useState<Set<number>>(new Set());

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [totalPlayers, setTotalPlayers] = useState(0);

  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const searchDebounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Lives management state - track pending changes before saving
  const [pendingLivesChanges, setPendingLivesChanges] = useState<Map<number, number>>(new Map());
  const [savingLivesChanges, setSavingLivesChanges] = useState(false);

  // Player status management state
  const [updatingStatus, setUpdatingStatus] = useState<Set<number>>(new Set());

  // Player unhide management state
  const [unhidingPlayer, setUnhidingPlayer] = useState<Set<number>>(new Set());

  // Dropdown menu state
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);

  // Toast notifications
  const { toasts, showToast, removeToast } = useToast();

  // Round & fixture data for Set Pick feature
  const [currentRoundId, setCurrentRoundId] = useState<number | null>(null);
  const [currentRoundNumber, setCurrentRoundNumber] = useState<number | null>(null);
  const [hasFixtures, setHasFixtures] = useState(false);
  const [roundIsLocked, setRoundIsLocked] = useState(false);

  // Set Pick modal state
  const [showSetPickModal, setShowSetPickModal] = useState(false);
  const [selectedPlayerForPick, setSelectedPlayerForPick] = useState<Player | null>(null);
  const [currentPlayerPick, setCurrentPlayerPick] = useState<string | null>(null);
  const [loadingPickData, setLoadingPickData] = useState(false);
  const [pickTeams, setPickTeams] = useState<Team[]>([]);
  const [allowedTeamNames, setAllowedTeamNames] = useState<Set<string>>(new Set());
  const [selectedTeam, setSelectedTeam] = useState('');
  const [settingPick, setSettingPick] = useState(false);
  const [pickSuccess, setPickSuccess] = useState(false);

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

  const loadPlayers = useCallback(async (page: number = currentPage, search: string = debouncedSearchTerm) => {
    if (abortControllerRef.current?.signal.aborted) return;

    setLoading(true);
    try {
      // Use cached API call with pagination and search
      const response = await competitionApi.getPlayers(competitionId, page, pageSize, search || undefined);
      if (abortControllerRef.current?.signal.aborted) return;

      if (response.data.return_code === 'SUCCESS') {
        // Get competition from context if available, otherwise from API response
        const competitionFromContext = competitions?.find(c => c.id === competitionId);
        setCompetition(competitionFromContext || response.data.competition as Competition);
        const playersData = response.data.players as Player[];
        setPlayers(playersData);

        // Update pagination state
        if (response.data.pagination) {
          setTotalPages(response.data.pagination.total_pages);
          setTotalPlayers(response.data.pagination.total_players);
          setCurrentPage(response.data.pagination.current_page);
        }
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
  }, [competitionId, currentPage, pageSize, debouncedSearchTerm, router, competitions]);

  // Load current round info to determine if "Set Pick" button should be shown
  const loadCurrentRound = useCallback(async () => {
    try {
      const response = await roundApi.getRounds(competitionId);
      if (response.data.return_code === 'SUCCESS') {
        const rounds = response.data.rounds || [];
        if (rounds.length > 0) {
          const latestRound = rounds[0];
          const hasFixturesFlag = (latestRound.fixture_count || 0) > 0;

          // Check if round is locked
          const now = new Date();
          const lockTime = new Date(latestRound.lock_time || '');
          const isLocked = !!(latestRound.lock_time && now >= lockTime);

          setCurrentRoundId(latestRound.id);
          setCurrentRoundNumber(latestRound.round_number);
          setHasFixtures(hasFixturesFlag);
          setRoundIsLocked(isLocked);
        } else {
          setCurrentRoundId(null);
          setCurrentRoundNumber(null);
          setHasFixtures(false);
          setRoundIsLocked(false);
        }
      }
    } catch (error) {
      console.error('Failed to load current round:', error);
    }
  }, [competitionId]);

  // Load round info on mount
  useEffect(() => {
    if (competitionId) {
      loadCurrentRound();
    }
  }, [competitionId, loadCurrentRound]);

  // Debounce search term (300ms delay)
  useEffect(() => {
    if (searchDebounceTimer.current) {
      clearTimeout(searchDebounceTimer.current);
    }

    searchDebounceTimer.current = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1); // Reset to page 1 when search changes
    }, 300);

    return () => {
      if (searchDebounceTimer.current) {
        clearTimeout(searchDebounceTimer.current);
      }
    };
  }, [searchTerm]);

  // Reload players when debounced search term changes
  useEffect(() => {
    if (competitionId) {
      loadPlayers(1, debouncedSearchTerm);
    }
  }, [debouncedSearchTerm]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  // Handle clear search
  const handleClearSearch = () => {
    setSearchTerm('');
    setDebouncedSearchTerm('');
    setCurrentPage(1);
  };

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

  // Handle opening Set Pick modal for a specific player
  const handleOpenSetPickModal = async (player: Player) => {
    if (!currentRoundId) return;

    setSelectedPlayerForPick(player);
    setShowSetPickModal(true);
    setLoadingPickData(true);

    try {
      // Load player's current pick
      const pickResponse = await adminApi.getPlayerPick(currentRoundId, player.id);
      if (pickResponse.data.return_code === 'SUCCESS' && pickResponse.data.pick) {
        setCurrentPlayerPick(pickResponse.data.pick.team_full_name || pickResponse.data.pick.team);
      } else {
        setCurrentPlayerPick(null);
      }

      // Load fixtures for current round
      const fixturesResponse = await fixtureApi.get(currentRoundId.toString());
      if (fixturesResponse.data.return_code === 'SUCCESS') {
        const fixtures = fixturesResponse.data.fixtures || [];

        // Extract unique teams from fixtures
        const fixtureTeamNames = new Set<string>();
        fixtures.forEach((fixture: { home_team: string; away_team: string; home_team_short: string; away_team_short: string }) => {
          fixtureTeamNames.add(fixture.home_team);
          fixtureTeamNames.add(fixture.away_team);
          fixtureTeamNames.add(fixture.home_team_short);
          fixtureTeamNames.add(fixture.away_team_short);
        });

        // Load player's allowed teams
        const allowedTeamNamesSet = new Set<string>();
        try {
          const allowedResponse = await userApi.getAllowedTeams(competitionId, player.id);
          if (allowedResponse.data.return_code === 'SUCCESS') {
            const allowedTeams = allowedResponse.data.allowed_teams || [];
            allowedTeams.forEach((team: Team) => {
              allowedTeamNamesSet.add(team.name);
              allowedTeamNamesSet.add(team.short_name);
            });
          }
        } catch {
          console.log('Could not fetch allowed teams for player - will show all fixture teams');
        }
        setAllowedTeamNames(allowedTeamNamesSet);

        // Get all teams and filter to those in current fixtures
        const teamsResponse = await teamApi.getTeams();
        if (teamsResponse.data.return_code === 'SUCCESS') {
          const allTeams = teamsResponse.data.teams || [];
          const fixtureTeams = allTeams.filter((team: Team) =>
            fixtureTeamNames.has(team.name) || fixtureTeamNames.has(team.short_name)
          );
          setPickTeams(fixtureTeams);
        }
      }
    } catch (error) {
      console.error('Failed to load pick data:', error);
    } finally {
      setLoadingPickData(false);
    }
  };

  // Handle setting/removing player pick
  const handleSetPlayerPick = async () => {
    if (!selectedPlayerForPick || !selectedTeam || !competition) return;

    setSettingPick(true);
    try {
      // Pass empty string if "NO_PICK" is selected to trigger removal
      const teamToSet = selectedTeam === 'NO_PICK' ? '' : selectedTeam;
      const response = await adminApi.setPlayerPick(competition.id, selectedPlayerForPick.id, teamToSet);

      if (response.data.return_code === 'SUCCESS') {
        setPickSuccess(true);

        const actionText = selectedTeam === 'NO_PICK' ? 'removed' : 'set';
        const teamText = selectedTeam === 'NO_PICK' ? '' : `: ${selectedTeam}`;

        // Invalidate picks cache
        cacheUtils.invalidateKey(`picks-${competitionId}`);
        cacheUtils.invalidateKey(`competition-players-${competitionId}`);

        // Show toast notification
        showToast(`Pick ${actionText}${teamText} for ${selectedPlayerForPick.display_name}`, 'success');

        // Auto-close modal after brief delay
        setTimeout(() => {
          handleClosePickModal();
        }, 500);
      } else {
        alert(`Failed to ${selectedTeam === 'NO_PICK' ? 'remove' : 'set'} pick: ${response.data.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to set/remove player pick:', error);
      alert(`Failed to ${selectedTeam === 'NO_PICK' ? 'remove' : 'set'} pick. Please try again.`);
    } finally {
      setSettingPick(false);
    }
  };

  // Handle closing Set Pick modal
  const handleClosePickModal = () => {
    setShowSetPickModal(false);
    setSelectedPlayerForPick(null);
    setCurrentPlayerPick(null);
    setPickTeams([]);
    setAllowedTeamNames(new Set());
    setSelectedTeam('');
    setPickSuccess(false);
    setLoadingPickData(false);
    setSettingPick(false);
  };

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

  const activePlayers = players.filter(p => p.status === 'active');

  // Payment summary
  const paidCount = players.filter(p => p.paid).length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Toast Container */}
      <ToastContainer toasts={toasts} onClose={removeToast} />

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
                <span>{totalPlayers || players.length} total</span>
                <span>•</span>
                <span>{activePlayers.length} active (on page)</span>
                <span>•</span>
                <span>{paidCount}/{players.length} paid (on page)</span>
              </div>
            </div>
          </div>
        </div>


        {/* Search Box */}
        <div className="mb-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Search players by name or email..."
              className="block w-full pl-10 pr-10 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {searchTerm && (
              <button
                onClick={handleClearSearch}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            )}
          </div>
          {debouncedSearchTerm && (
            <p className="mt-2 text-sm text-slate-600">
              Showing {totalPlayers} result{totalPlayers !== 1 ? 's' : ''} for &quot;{debouncedSearchTerm}&quot;
            </p>
          )}
        </div>

        {/* Access Code */}
        {competition?.access_code && (
          <div className="flex items-center space-x-3 mb-6">
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

        {/* Players List - New Stacked Design */}
        <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
          {players.map((player) => (
            <div key={player.id} className={`p-4 hover:bg-slate-50 transition-colors ${
              player.hidden ? 'bg-red-50 border-l-4 border-red-200' : ''
            }`}>
              {/* Row 1: Name + Actions Menu */}
              <div className="flex items-start justify-between mb-1">
                <h3 className="font-medium text-slate-900">{player.display_name}</h3>

                {/* Actions Dropdown Menu */}
                <div className="relative">
                  <button
                    onClick={() => setOpenDropdownId(openDropdownId === player.id ? null : player.id)}
                    className="p-1 hover:bg-slate-200 rounded transition-colors"
                    title="Actions"
                  >
                    <EllipsisVerticalIcon className="h-5 w-5 text-slate-600" />
                  </button>

                  {/* Dropdown Menu */}
                  {openDropdownId === player.id && (
                    <>
                      {/* Backdrop to close menu */}
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setOpenDropdownId(null)}
                      />

                      {/* Menu */}
                      <div className="absolute right-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-20">
                        {/* Set Pick */}
                        {currentRoundId && hasFixtures && !roundIsLocked && (
                          <button
                            onClick={() => {
                              setOpenDropdownId(null);
                              handleOpenSetPickModal(player);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center space-x-2"
                          >
                            <ClipboardDocumentListIcon className="h-4 w-4" />
                            <span>Set Pick</span>
                          </button>
                        )}

                        {/* Add Life */}
                        <button
                          onClick={() => {
                            setOpenDropdownId(null);
                            handleLivesChange(player.id, 'add');
                          }}
                          disabled={savingLivesChanges || (player.lives_remaining || 0) >= 2}
                          className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <PlusIcon className="h-4 w-4 text-green-600" />
                          <span>Add Life</span>
                        </button>

                        {/* Remove Life */}
                        <button
                          onClick={() => {
                            setOpenDropdownId(null);
                            handleLivesChange(player.id, 'subtract');
                          }}
                          disabled={savingLivesChanges || (player.lives_remaining || 0) <= 0}
                          className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <MinusIcon className="h-4 w-4 text-red-600" />
                          <span>Remove Life</span>
                        </button>

                        <div className="border-t border-slate-100 my-1" />

                        {/* Toggle Payment */}
                        <button
                          onClick={() => {
                            setOpenDropdownId(null);
                            handlePaymentToggle(player.id, player.paid);
                          }}
                          disabled={updatingPayment.has(player.id)}
                          className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center space-x-2 disabled:opacity-50"
                        >
                          <CurrencyDollarIcon className="h-4 w-4" />
                          <span>{player.paid ? 'Mark Unpaid' : 'Mark Paid'}</span>
                        </button>

                        {/* Toggle Status */}
                        <button
                          onClick={() => {
                            setOpenDropdownId(null);
                            handleStatusToggle(player.id, player.status || 'active');
                          }}
                          disabled={updatingStatus.has(player.id)}
                          className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center space-x-2 disabled:opacity-50"
                        >
                          <span className="h-4 w-4 flex items-center justify-center">
                            {(player.status || 'active') === 'active' ? '✓' : '✗'}
                          </span>
                          <span>{(player.status || 'active') === 'active' ? 'Mark as OUT' : 'Mark as Active'}</span>
                        </button>

                        {/* Unhide - Only if hidden */}
                        {player.hidden && (
                          <>
                            <div className="border-t border-slate-100 my-1" />
                            <button
                              onClick={() => {
                                setOpenDropdownId(null);
                                handleUnhidePlayer(player.id);
                              }}
                              disabled={unhidingPlayer.has(player.id)}
                              className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center space-x-2 disabled:opacity-50"
                            >
                              <EyeIcon className="h-4 w-4" />
                              <span>Unhide Player</span>
                            </button>
                          </>
                        )}

                        {/* Remove Player */}
                        {competition?.invite_code && (
                          <>
                            <div className="border-t border-slate-100 my-1" />
                            <button
                              onClick={() => {
                                setOpenDropdownId(null);
                                handleRemovePlayerClick(player.id, player.display_name);
                              }}
                              disabled={removing.has(player.id)}
                              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2 disabled:opacity-50"
                            >
                              <TrashIcon className="h-4 w-4" />
                              <span>Remove Player</span>
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Row 2: Email */}
              <p className="text-sm text-slate-600 mb-2">{player.email || 'No email'}</p>

              {/* Row 3: Status Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Lives Badge */}
                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium ${
                  pendingLivesChanges.has(player.id)
                    ? 'bg-blue-100 text-blue-700 border border-blue-300'
                    : 'bg-slate-100 text-slate-700'
                }`}>
                  {player.lives_remaining || 0} {(player.lives_remaining || 0) === 1 ? 'life' : 'lives'}
                  {pendingLivesChanges.has(player.id) && <span className="ml-1">*</span>}
                </span>

                {/* Payment Badge */}
                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium ${
                  player.paid
                    ? 'bg-green-100 text-green-700'
                    : 'bg-orange-100 text-orange-700'
                }`}>
                  {player.paid ? '💷 Paid' : 'Unpaid'}
                </span>

                {/* Status Badge */}
                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium ${
                  (player.status || 'active') === 'active'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {(player.status || 'active') === 'active' ? 'Active' : 'OUT'}
                </span>

                {/* Extra Badges */}
                {player.is_managed && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium bg-slate-100 text-slate-600">
                    Managed
                  </span>
                )}
                {player.hidden && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium bg-red-100 text-red-700">
                    Hidden
                  </span>
                )}
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

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 sm:px-6 rounded-lg">
            <div className="flex flex-1 justify-between sm:hidden">
              <button
                onClick={() => loadPlayers(currentPage - 1)}
                disabled={currentPage === 1}
                className="relative inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => loadPlayers(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="relative ml-3 inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-slate-700">
                  Showing <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span> to{' '}
                  <span className="font-medium">{Math.min(currentPage * pageSize, totalPlayers)}</span> of{' '}
                  <span className="font-medium">{totalPlayers}</span> players
                </p>
              </div>
              <div>
                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                  <button
                    onClick={() => loadPlayers(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center rounded-l-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="sr-only">Previous</span>
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                    </svg>
                  </button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 7) {
                      pageNum = i + 1;
                    } else if (currentPage <= 4) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 3) {
                      pageNum = totalPages - 6 + i;
                    } else {
                      pageNum = currentPage - 3 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => loadPlayers(pageNum)}
                        className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                          currentPage === pageNum
                            ? 'z-10 bg-slate-900 text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900'
                            : 'text-slate-900 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => loadPlayers(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center rounded-r-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="sr-only">Next</span>
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                    </svg>
                  </button>
                </nav>
              </div>
            </div>
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

      {/* Set Player Pick Modal */}
      {showSetPickModal && selectedPlayerForPick && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900">Set Pick for {selectedPlayerForPick.display_name}</h3>
                <button
                  onClick={handleClosePickModal}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              {loadingPickData ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-600 border-t-transparent"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Round Info */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-blue-900">
                      Round {currentRoundNumber}
                    </p>
                  </div>

                  {/* Current Pick Info */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <div className="flex items-start space-x-2">
                      <svg className="w-5 h-5 text-slate-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900">
                          {currentPlayerPick ? (
                            <>Current pick: <span className="font-semibold">{currentPlayerPick}</span></>
                          ) : (
                            'No pick made yet'
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Team Selection */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Select Team
                    </label>
                    <select
                      value={selectedTeam}
                      onChange={(e) => setSelectedTeam(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Choose a team...</option>
                      {pickTeams.map((team, index) => {
                        const isAllowed = allowedTeamNames.has(team.name) || allowedTeamNames.has(team.short_name);
                        return (
                          <option key={`${team.id}-${team.name}-${index}`} value={team.name}>
                            {isAllowed ? team.name : `❌ ${team.name}`}
                          </option>
                        );
                      })}
                      <option value="NO_PICK">Remove Pick</option>
                    </select>
                    <p className="text-xs text-slate-500 mt-1">
                      Teams marked with ❌ have already been used by this player
                    </p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-3 mt-6">
                <button
                  onClick={handleClosePickModal}
                  disabled={settingPick}
                  className="flex-1 px-4 py-2 text-slate-600 hover:text-slate-800 font-medium transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSetPlayerPick}
                  disabled={!selectedTeam || settingPick || pickSuccess || loadingPickData}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                    pickSuccess
                      ? 'bg-green-600 text-white'
                      : 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed'
                  }`}
                >
                  {pickSuccess ? (
                    <span className="flex items-center justify-center">
                      <CheckCircleIcon className="h-5 w-5 mr-2" />
                      Pick Set ✓
                    </span>
                  ) : settingPick ? (
                    selectedTeam === 'NO_PICK' ? 'Removing Pick...' : 'Setting Pick...'
                  ) : (
                    selectedTeam === 'NO_PICK' ? 'Remove Pick' : 'Set Pick'
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