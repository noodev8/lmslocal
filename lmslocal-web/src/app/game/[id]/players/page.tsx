'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  TrashIcon,
  PlusIcon,
  MinusIcon,
  EyeIcon,
  CheckCircleIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  EllipsisVerticalIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';
import { competitionApi, adminApi, roundApi, fixtureApi, teamApi, userApi, organizerApi, Competition, Player, Team, cacheUtils } from '@/lib/api';
import { cachePrefixes } from '@/lib/cacheKeys';
import { useAppData } from '@/contexts/AppDataContext';
import ConfirmationModal from '@/components/ConfirmationModal';
import { useToast, ToastContainer } from '@/components/Toast';
import { LABEL, EYEBROW, HEADING, PANEL, BTN_PRIMARY, BTN_OUTLINE, BTN_DARK } from '@/lib/design';
import BotChip from '@/components/BotChip';
import PlayerEmail from '@/components/PlayerEmail';


export default function CompetitionPlayersPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const competitionId = parseInt(params.id as string);

  /* Arriving from somewhere that already knows whose pick needs setting - the dashboard's guest
     prompt - so the modal opens on that player instead of making the organiser find the row.
     A player id, not a name: names are not unique and are editable. */
  const pickForPlayerId = searchParams.get('pick');

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
  const [activeSearchTerm, setActiveSearchTerm] = useState('');

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

  // Permissions modal state
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [selectedPlayerForPermissions, setSelectedPlayerForPermissions] = useState<Player | null>(null);
  const [savingPermissions, setSavingPermissions] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const deepLinkHandledRef = useRef(false);

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
    const handleAuthExpired = (event: Event) => {
      // Only a real expiry belongs on /login. A deliberate sign-out raises the same event
      // and routes itself home, and this handler used to drag it to /login instead.
      const expired = (event as CustomEvent<{ expired?: boolean }>).detail?.expired;
      if (expired && !controller.signal.aborted) {
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

  /* Fires once, and only when both halves are in: the player list, and the round data the pick
     modal needs to offer teams. Guarded by a ref rather than clearing the query string, so a
     refresh does not silently drop the organiser somewhere different from the URL they hold. */
  useEffect(() => {
    if (deepLinkHandledRef.current || !pickForPlayerId || !currentRoundId) return;
    const player = players.find(p => p.id === parseInt(pickForPlayerId));
    if (!player) return;

    deepLinkHandledRef.current = true;
    handleOpenSetPickModal(player);
  }, [pickForPlayerId, currentRoundId, players]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadPlayers = useCallback(async (page: number = currentPage, search: string = activeSearchTerm) => {
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
        router.push(`/game/${competitionId}`);
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
  }, [competitionId, currentPage, pageSize, activeSearchTerm, router, competitions]);

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

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  // Handle search button click
  const handleSearch = () => {
    setActiveSearchTerm(searchTerm);
    setCurrentPage(1);
    loadPlayers(1, searchTerm);
  };

  // Handle Enter key press in search input
  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Handle clear search
  const handleClearSearch = () => {
    setSearchTerm('');
    setActiveSearchTerm('');
    setCurrentPage(1);
    loadPlayers(1, '');
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

        // Show success message (includes credit refund notification if applicable)
        showToast(response.data.message || 'Player removed successfully', 'success');
      } else {
        console.error('Failed to remove player:', response.data.message);
        showToast(response.data.message || 'Failed to remove player', 'error');
      }
    } catch (error) {
      console.error('Failed to remove player:', error);
      showToast('Failed to remove player due to network error', 'error');
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

        // Invalidate cached player data so fresh data is fetched on next visit
        cacheUtils.invalidatePrefix(cachePrefixes.competitionPlayers(competition.id));
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
        cacheUtils.invalidatePrefix(cachePrefixes.competitionPlayers(competition.id));

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
        cacheUtils.invalidatePrefix(cachePrefixes.competitionPlayers(competition.id));
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
        cacheUtils.invalidatePrefix(cachePrefixes.competitionPlayers(competition.id));
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

        // A pick changes the player's row and which teams remain available to them. There is no
        // `picks-${id}` cache; that key was invented at this call site and never written.
        cacheUtils.invalidatePrefix(cachePrefixes.competitionPlayers(competitionId));
        cacheUtils.invalidatePrefix(cachePrefixes.allowedTeams(competitionId));

        // Says it saved, not what was saved. The team was chosen a second ago in this modal and
        // is still on screen behind the toast - naming it back is the screen telling the
        // organiser something they just told it. The player's name stays, because with several
        // guests to set picks for that is the part worth confirming.
        showToast(`Pick ${actionText} for ${selectedPlayerForPick.display_name}`, 'success');

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
      <div className="flex min-h-screen items-center justify-center bg-stock font-body text-ink">
        <div className="text-center">
          <div className="mb-4 inline-flex h-8 w-8 animate-spin items-center justify-center rounded-full border-2 border-ink border-t-transparent" />
          <p className={EYEBROW}>Loading</p>
          <p className="mt-2 text-[17px] text-ink-fade">Fetching player data&hellip;</p>
        </div>
      </div>
    );
  }

  const activePlayers = players.filter(p => p.status === 'active');

  // Payment summary
  const paidCount = players.filter(p => p.paid).length;

  return (
    <div className="min-h-screen bg-stock font-body text-ink">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <header className="border-b border-ink/30">
        <div className="mx-auto flex max-w-3xl items-center px-4 py-4 sm:px-6">
          <Link href={`/game/${competitionId}`} className={`${LABEL} flex items-center gap-1.5 text-ink-fade transition-colors hover:text-ink`}>
            <ArrowLeftIcon className="h-4 w-4" />
            Back
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">

        <p className={EYEBROW}>Players</p>
        <h1 className={`${HEADING} mt-1 text-3xl`}>{competition?.name}</h1>
        <div className={`${LABEL} mt-2 flex items-center gap-2 text-ink-fade`}>
          <span>{totalPlayers || players.length} total</span>
          <span>&middot;</span>
          <span>{activePlayers.length} active (on page)</span>
          <span>&middot;</span>
          <span>{paidCount}/{players.length} paid (on page)</span>
        </div>

        {/* Search Box */}
        <div className="mt-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-fade" />
              <input
                type="text"
                value={searchTerm}
                onChange={handleSearchChange}
                onKeyPress={handleSearchKeyPress}
                placeholder="Search players by name or email…"
                className="w-full rounded-sm border border-ink bg-transparent py-2 pl-9 pr-9 text-[15px] text-ink placeholder-ink-fade/60 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              />
              {searchTerm && (
                <button
                  onClick={handleClearSearch}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-fade transition-colors hover:text-ink"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              )}
            </div>
            <button onClick={handleSearch} className={`${BTN_PRIMARY} px-6 py-2 text-base`}>
              Search
            </button>
          </div>
          {activeSearchTerm && (
            <p className="mt-2 text-[13px] text-ink-fade">
              Showing {totalPlayers} result{totalPlayers !== 1 ? 's' : ''} for &quot;{activeSearchTerm}&quot;
            </p>
          )}
        </div>

        {/* Access Code */}
        {competition?.access_code && (
          <div className="mt-5 flex items-center gap-3">
            <span className={`${LABEL} text-ink-fade`}>Join code:</span>
            <code className="font-data text-[15px] text-ink">{competition.access_code}</code>
            <button
              onClick={() => navigator.clipboard.writeText(competition.access_code!)}
              className={`${LABEL} text-ink-fade underline decoration-dotted underline-offset-4 transition-colors hover:text-ink`}
            >
              copy
            </button>
          </div>
        )}

        {/* Lives Changes Save/Cancel Bar - flagged as easy to miss: strengthened to an
            overprint-bordered panel instead of a quiet indigo strip, since a navigation away
            here used to lose the change with no warning. */}
        {pendingLivesChanges.size > 0 && (
          <div className={`${PANEL} mt-6 border-overprint p-4`}>
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
              <p className="text-[15px] font-medium text-ink">
                {pendingLivesChanges.size} player{pendingLivesChanges.size !== 1 ? 's' : ''} with unsaved lives changes
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCancelLivesChanges}
                  disabled={savingLivesChanges}
                  className={`${BTN_OUTLINE} px-4 py-2 disabled:opacity-50`}
                >
                  Cancel changes
                </button>
                <button
                  onClick={handleSaveLivesChanges}
                  disabled={savingLivesChanges}
                  className={`${BTN_PRIMARY} px-4 py-2 text-base disabled:opacity-50`}
                >
                  {savingLivesChanges ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Players List */}
        <div className={`${PANEL} mt-6 divide-y divide-ink/30`}>
          {players.map((player) => {
            return (
            <div key={player.id} className={`p-4 ${player.hidden ? 'border-l-2 border-overprint' : ''}`}>
              {/* Player Info */}
              <div className="mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-data text-[15px] text-ink">{player.display_name}</h3>
                  {player.is_bot && <BotChip />}
                </div>
                <PlayerEmail email={player.email} isBot={player.is_bot} />
              </div>

              {/* Admin Controls Row */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                {/* Lives Control */}
                <div className="flex items-center gap-1.5 border border-ink/30 px-2.5 py-1.5">
                  <button
                    onClick={() => handleLivesChange(player.id, 'subtract')}
                    disabled={savingLivesChanges || (player.lives_remaining || 0) <= 0}
                    title="Remove life"
                    className="text-ink transition-colors hover:opacity-70 disabled:opacity-30"
                  >
                    <MinusIcon className="h-4 w-4" />
                  </button>
                  <span className={`min-w-[4rem] text-center font-data text-[14px] ${
                    pendingLivesChanges.has(player.id) ? 'text-overprint' : 'text-ink'
                  }`}>
                    {player.lives_remaining || 0} {(player.lives_remaining || 0) === 1 ? 'life' : 'lives'}
                    {pendingLivesChanges.has(player.id) && '*'}
                  </span>
                  <button
                    onClick={() => handleLivesChange(player.id, 'add')}
                    disabled={savingLivesChanges || (player.lives_remaining || 0) >= 2}
                    title="Add life"
                    className="text-ink transition-colors hover:opacity-70 disabled:opacity-30"
                  >
                    <PlusIcon className="h-4 w-4" />
                  </button>
                </div>

                {/* Set pick. Out here rather than in the menu because it is the recurring,
                    deadline-bound job on this screen - once a round, before lock - and for a
                    guest it is the only way they ever get a pick at all. Payment went the other
                    way for the same reason: it is marked once a season.

                    One style for every row, guest or not. A filled button on the guest rows was
                    meant to say "this is the important one" and said "this one is different,
                    leave it alone" instead. */}
                <button
                  onClick={() => handleOpenSetPickModal(player)}
                  disabled={!currentRoundId || !hasFixtures || roundIsLocked}
                  title={
                    roundIsLocked
                      ? 'The round is locked'
                      : !currentRoundId || !hasFixtures
                      ? 'No fixtures in this round yet'
                      : `Set a pick for ${player.display_name}`
                  }
                  className={`${BTN_OUTLINE} inline-flex items-center gap-1.5 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  <CheckCircleIcon className="h-4 w-4" />
                  Set pick
                </button>

                {/* Paid stays visible once it is true - it is the answer to "have they paid?",
                    which is the question the list gets scanned for. Marking it happens in the
                    menu. */}
                {player.paid && (
                  <span className={`${LABEL} inline-flex items-center gap-1.5 border border-moss px-2 py-1 text-moss`}>
                    <CheckCircleIcon className="h-4 w-4" />
                    Paid
                  </span>
                )}

                {/* Hidden Badge */}
                {player.hidden && (
                  <span className={`${LABEL} border border-overprint px-2 py-1 text-overprint`}>Hidden</span>
                )}

                {/* Spacer to push menu to the right */}
                <div className="flex-1" />

                {/* More Options Menu */}
                <div className="relative">
                  <button
                    onClick={() => setOpenDropdownId(openDropdownId === player.id ? null : player.id)}
                    className="p-2 text-ink-fade transition-colors hover:text-ink"
                    title="More actions"
                  >
                    <EllipsisVerticalIcon className="h-5 w-5" />
                  </button>

                  {/* Dropdown Menu - Rare Actions Only */}
                  {openDropdownId === player.id && (
                    <>
                      {/* Backdrop to close menu */}
                      <div className="fixed inset-0 z-10" onClick={() => setOpenDropdownId(null)} />

                      {/* Menu */}
                      <div className="absolute left-0 top-full z-20 mt-1 w-52 border border-ink/30 bg-stock-lit sm:left-auto sm:right-0">
                        {/* Payment. Two organisers use this on real competitions, so it stays -
                            but it is marked once and then read, which is a menu action, not a
                            button on every row. Never offered for a bot: nobody is collecting
                            a fiver off one. */}
                        {!player.is_bot && (
                          <>
                            <button
                              onClick={() => {
                                setOpenDropdownId(null);
                                handlePaymentToggle(player.id, player.paid);
                              }}
                              disabled={updatingPayment.has(player.id)}
                              className={`${LABEL} flex w-full items-center gap-2 px-4 py-2.5 text-left text-ink transition-colors hover:bg-stock disabled:opacity-50`}
                            >
                              <CheckCircleIcon className="h-4 w-4" />
                              {player.paid ? 'Mark as unpaid' : 'Mark as paid'}
                            </button>

                            <div className="border-t border-ink/30" />
                          </>
                        )}

                        {/* Toggle Status */}
                        <button
                          onClick={() => {
                            setOpenDropdownId(null);
                            handleStatusToggle(player.id, player.status || 'active');
                          }}
                          disabled={updatingStatus.has(player.id)}
                          className={`${LABEL} flex w-full items-center gap-2 px-4 py-2.5 text-left text-ink transition-colors hover:bg-stock disabled:opacity-50`}
                        >
                          <span className="flex h-4 w-4 items-center justify-center">
                            {(player.status || 'active') === 'active' ? '✕' : '✓'}
                          </span>
                          {(player.status || 'active') === 'active' ? 'Mark as out' : 'Mark as active'}
                        </button>

                        {/* Unhide - Only if hidden */}
                        {player.hidden && (
                          <button
                            onClick={() => {
                              setOpenDropdownId(null);
                              handleUnhidePlayer(player.id);
                            }}
                            disabled={unhidingPlayer.has(player.id)}
                            className={`${LABEL} flex w-full items-center gap-2 px-4 py-2.5 text-left text-ink transition-colors hover:bg-stock disabled:opacity-50`}
                          >
                            <EyeIcon className="h-4 w-4" />
                            Unhide player
                          </button>
                        )}

                        {/* Manage Permissions - Only for main organiser */}
                        {competition?.is_organiser && (
                          <button
                            onClick={() => {
                              setOpenDropdownId(null);
                              setSelectedPlayerForPermissions(player);
                              setShowPermissionsModal(true);
                            }}
                            className={`${LABEL} flex w-full items-center gap-2 px-4 py-2.5 text-left text-ink transition-colors hover:bg-stock`}
                          >
                            <Cog6ToothIcon className="h-4 w-4" />
                            Manage permissions
                          </button>
                        )}

                        {/* Remove Player */}
                        {competition?.invite_code && (
                          <>
                            <div className="border-t border-ink/30" />
                            <button
                              onClick={() => {
                                setOpenDropdownId(null);
                                handleRemovePlayerClick(player.id, player.display_name);
                              }}
                              disabled={removing.has(player.id)}
                              className={`${LABEL} flex w-full items-center gap-2 px-4 py-2.5 text-left text-overprint transition-colors hover:bg-stock disabled:opacity-50`}
                            >
                              <TrashIcon className="h-4 w-4" />
                              Remove player
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            );
          })}
        </div>

        {/* No Players State */}
        {players.length === 0 && (
          <div className={`${PANEL} mt-6 p-12 text-center`}>
            <p className={`${HEADING} text-2xl`}>No players yet</p>
            <p className="mt-2 text-[15px] text-ink-fade">Share your join code to get players started.</p>
            {competition?.access_code && (
              <div className="mt-4 inline-flex items-center gap-2">
                <code className="font-data text-[15px] text-ink">{competition.access_code}</code>
                <button
                  onClick={() => navigator.clipboard.writeText(competition.access_code!)}
                  className={`${LABEL} text-ink-fade underline decoration-dotted underline-offset-4 transition-colors hover:text-ink`}
                >
                  copy
                </button>
              </div>
            )}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-6 flex flex-col gap-3 border-t border-ink/30 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13px] text-ink-fade">
              Showing <span className="font-medium text-ink">{(currentPage - 1) * pageSize + 1}</span> to{' '}
              <span className="font-medium text-ink">{Math.min(currentPage * pageSize, totalPlayers)}</span> of{' '}
              <span className="font-medium text-ink">{totalPlayers}</span> players
            </p>
            <nav className="flex items-center gap-1.5" aria-label="Pagination">
              <button
                onClick={() => loadPlayers(currentPage - 1)}
                disabled={currentPage === 1}
                className={`${BTN_OUTLINE} px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40`}
              >
                <span className="sr-only">Previous</span>
                &larr;
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
                    className={`${LABEL} flex h-8 min-w-[2rem] items-center justify-center border px-2 transition-colors ${
                      currentPage === pageNum
                        ? 'border-ink bg-ink text-stock-lit'
                        : 'border-ink/30 text-ink hover:border-ink'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => loadPlayers(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={`${BTN_OUTLINE} px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40`}
              >
                <span className="sr-only">Next</span>
                &rarr;
              </button>
            </nav>
          </div>
        )}

      </main>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={handleCancelRemove}
        onConfirm={handleConfirmRemove}
        title="Remove player"
        message={playerToRemove ? `Are you sure you want to remove ${playerToRemove.name} from the competition? This will delete all their picks and progress data and cannot be undone.` : ''}
        confirmText="Remove player"
        isLoading={playerToRemove ? removing.has(playerToRemove.id) : false}
      />

      {/* Set Player Pick Modal */}
      {showSetPickModal && selectedPlayerForPick && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
          <div className={`${PANEL} w-full max-w-md p-6`}>
            <div className="mb-5 flex items-center justify-between">
              <h3 className={`${HEADING} text-xl`}>Set pick &mdash; {selectedPlayerForPick.display_name}</h3>
              <button onClick={handleClosePickModal} className="text-ink-fade transition-colors hover:text-ink">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {loadingPickData ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink border-t-transparent" />
              </div>
            ) : (
              <div className="space-y-4">
                <p className={`${LABEL} text-ink-fade`}>Round {currentRoundNumber}</p>

                <div className="border border-ink/30 p-3">
                  <p className="text-[14px] text-ink">
                    {currentPlayerPick ? (
                      <>Current pick: <span className="font-data font-semibold">{currentPlayerPick}</span></>
                    ) : (
                      'No pick made yet'
                    )}
                  </p>
                </div>

                <div>
                  <label className={`${LABEL} mb-2 block text-ink-fade`}>Select team</label>
                  <select
                    value={selectedTeam}
                    onChange={(e) => setSelectedTeam(e.target.value)}
                    className="w-full rounded-sm border border-ink bg-transparent px-3 py-2 text-[15px] text-ink focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                  >
                    <option value="">Choose a team&hellip;</option>
                    {pickTeams.map((team, index) => {
                      const isAllowed = allowedTeamNames.has(team.name) || allowedTeamNames.has(team.short_name);
                      return (
                        <option key={`${team.id}-${team.name}-${index}`} value={team.name}>
                          {isAllowed ? team.name : `${team.name} — already used`}
                        </option>
                      );
                    })}
                    <option value="NO_PICK">Remove pick</option>
                  </select>
                  <p className="mt-1 text-[12px] text-ink-fade">
                    Teams marked &ldquo;already used&rdquo; have already been picked by this player.
                  </p>
                </div>
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleClosePickModal}
                disabled={settingPick}
                className={`${BTN_OUTLINE} flex-1 justify-center py-2 disabled:opacity-50`}
              >
                Cancel
              </button>
              <button
                onClick={handleSetPlayerPick}
                disabled={!selectedTeam || settingPick || pickSuccess || loadingPickData}
                className={`${pickSuccess ? BTN_DARK : BTN_PRIMARY} flex-1 py-2 text-base disabled:opacity-50`}
              >
                {pickSuccess ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <CheckCircleIcon className="h-4 w-4" />
                    Pick set
                  </span>
                ) : settingPick ? (
                  selectedTeam === 'NO_PICK' ? 'Removing pick…' : 'Setting pick…'
                ) : (
                  selectedTeam === 'NO_PICK' ? 'Remove pick' : 'Set pick'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permissions Modal */}
      {showPermissionsModal && selectedPlayerForPermissions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
          <div className={`${PANEL} w-full max-w-md p-6`}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className={`${HEADING} text-xl`}>
                Permissions &mdash; {selectedPlayerForPermissions.display_name}
              </h3>
              <button
                onClick={() => {
                  setShowPermissionsModal(false);
                  setSelectedPlayerForPermissions(null);
                }}
                className="text-ink-fade transition-colors hover:text-ink"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <p className="mb-6 text-[14px] text-ink-fade">
              Grant {selectedPlayerForPermissions.display_name} access to manage specific aspects of this competition.
            </p>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setSavingPermissions(true);

                const formData = new FormData(e.currentTarget);
                const permissions = {
                  manage_results: formData.get('manage_results') === 'on',
                  manage_fixtures: formData.get('manage_fixtures') === 'on',
                  manage_players: formData.get('manage_players') === 'on',
                  manage_promote: formData.get('manage_promote') === 'on',
                };

                try {
                  const response = await organizerApi.updatePlayerPermissions(
                    competitionId,
                    selectedPlayerForPermissions.id,
                    permissions
                  );

                  if (response.data.return_code === 'SUCCESS') {
                    // Update the player in the local state
                    setPlayers(prev =>
                      prev.map(p =>
                        p.id === selectedPlayerForPermissions.id
                          ? { ...p, ...permissions }
                          : p
                      )
                    );

                    showToast('Permissions updated successfully', 'success');
                    setShowPermissionsModal(false);
                    setSelectedPlayerForPermissions(null);
                  } else {
                    showToast(response.data.message || 'Failed to update permissions', 'error');
                  }
                } catch (error) {
                  console.error('Error updating permissions:', error);
                  showToast('Network error - could not update permissions', 'error');
                } finally {
                  setSavingPermissions(false);
                }
              }}
              className="space-y-4"
            >
              {/* Manage Results Permission */}
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  name="manage_results"
                  defaultChecked={selectedPlayerForPermissions.manage_results || false}
                  className="mt-1 h-4 w-4 accent-[#1C2620]"
                />
                <div className="flex-1">
                  <div className="text-[15px] font-medium text-ink">Manage results</div>
                  <div className="text-[13px] text-ink-fade">Enter and process match results</div>
                </div>
              </label>

              {/* Manage Fixtures Permission */}
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  name="manage_fixtures"
                  defaultChecked={selectedPlayerForPermissions.manage_fixtures || false}
                  className="mt-1 h-4 w-4 accent-[#1C2620]"
                />
                <div className="flex-1">
                  <div className="text-[15px] font-medium text-ink">Manage fixtures</div>
                  <div className="text-[13px] text-ink-fade">Add and modify fixtures</div>
                </div>
              </label>

              {/* Manage Players Permission */}
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  name="manage_players"
                  defaultChecked={selectedPlayerForPermissions.manage_players || false}
                  className="mt-1 h-4 w-4 accent-[#1C2620]"
                />
                <div className="flex-1">
                  <div className="text-[15px] font-medium text-ink">Manage players</div>
                  <div className="text-[13px] text-ink-fade">Add, remove, and manage players</div>
                </div>
              </label>

              {/* Manage Promote Permission */}
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  name="manage_promote"
                  defaultChecked={selectedPlayerForPermissions.manage_promote || false}
                  className="mt-1 h-4 w-4 accent-[#1C2620]"
                />
                <div className="flex-1">
                  <div className="text-[15px] font-medium text-ink">Manage promote</div>
                  <div className="text-[13px] text-ink-fade">Access promotion and marketing features</div>
                </div>
              </label>

              {/* Action Buttons */}
              <div className="flex gap-3 border-t border-ink/30 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowPermissionsModal(false);
                    setSelectedPlayerForPermissions(null);
                  }}
                  disabled={savingPermissions}
                  className={`${BTN_OUTLINE} flex-1 justify-center py-2 disabled:opacity-50`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPermissions}
                  className={`${BTN_PRIMARY} flex-1 py-2 text-base disabled:opacity-50`}
                >
                  {savingPermissions ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
