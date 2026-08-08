'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  TrophyIcon,
  ArrowLeftIcon,
  UserGroupIcon,
  Cog6ToothIcon,
  PlayIcon,
  UserIcon,
  MegaphoneIcon,
  CalendarIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import { Competition as CompetitionType, roundApi, competitionApi, offlinePlayerApi, promoteApi, teamApi, playerActionApi, fixtureApi } from '@/lib/api';
import { useAppData } from '@/contexts/AppDataContext';
import { useToast, ToastContainer } from '@/components/Toast';
import { LABEL, EYEBROW, HEADING, PANEL, BTN_PRIMARY, BTN_OUTLINE, BTN_DARK } from '@/lib/design';
import {
  deriveDashboardRoundState,
  pickDeadlineText,
  isStartGateVisible,
  startBlockedText,
  formatRoundStart,
  roundTileLabel,
  roundTileNeedsAction,
  roundTileSummary,
  roundTileTarget,
} from '@/lib/roundState';
import { buildInviteMessage, buildJoinUrl } from '@/lib/templates';
import { cacheUtils } from '@/lib/cache';
import { cachePrefixes } from '@/lib/cacheKeys';

/**
 * FEATURE FLAG: Round Statistics Progress Bar
 *
 * Controls whether the Win/Slip/Loss visual progress bar is displayed on the game dashboard.
 * When set to false:
 * - The visual progress bars (green WIN / grey SLIP / red OUT) are hidden
 * - API calls to getRoundStatistics() are skipped to reduce backend load
 * - All related state management is bypassed
 *
 * Set to true to re-enable the feature if needed in the future.
 */
const SHOW_ROUND_STATISTICS = false;

/**
 * Columns for the action tile grid, by how many tiles the current user actually gets.
 *
 * Written out rather than built from a template string because Tailwind only ships classes it can
 * see in the source - `sm:grid-cols-${n}` compiles to nothing. Keyed on the count so the row can't
 * strand a tile or two on a line of its own, which is what a fixed 4-column grid did to the six
 * tiles a full organiser sees.
 */
const TILE_GRID_COLS: Record<number, string> = {
  1: 'sm:grid-cols-1',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-4',
  5: 'sm:grid-cols-5',
  6: 'sm:grid-cols-3',
};

export default function UnifiedGameDashboard() {
  const router = useRouter();
  const params = useParams();
  const competitionId = params.id as string;

  // Use AppDataProvider context for competitions data
  const { competitions, loading: contextLoading, refreshCompetitions } = useAppData();

  // Memoize the specific competition to prevent unnecessary re-renders
  const competition = useMemo(() => {
    return competitions?.find(c => c.id.toString() === competitionId);
  }, [competitions, competitionId]);

  const [currentRoundInfo, setCurrentRoundInfo] = useState<{
    id: number;
    round_number: number;
    lock_time?: string;
    fixture_count: number;
    is_locked: boolean;
    completed_fixtures?: number;
    status?: string;
  } | null>(null);
  const [, setLoadingRound] = useState(true);
  const [pickStats, setPickStats] = useState<{
    players_with_picks: number;
    total_active_players: number;
    pick_percentage: number;
  } | null>(null);
  const [roundStats, setRoundStats] = useState<{
    round_number: number;
    total_players: number;
    won: number;
    lost: number;
    eliminated: number;
  } | null>(null);
  const [currentRoundStats, setCurrentRoundStats] = useState<{
    round_number: number;
    total_players: number;
    won: number;
    lost: number;
    eliminated: number;
  } | null>(null);
  // DISABLED: Organiser fixture highlighting logic - may re-enable in future
  // const [needsFixtures, setNeedsFixtures] = useState(false);

  // Toast notifications
  const { toasts, showToast, removeToast } = useToast();

  // Guest player modal state
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [addPlayerForm, setAddPlayerForm] = useState({ display_name: '' });
  const [addPlayerError, setAddPlayerError] = useState<string | null>(null);

  // Copy button states
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const joinUrl = competition?.invite_code ? buildJoinUrl(competition.invite_code) : '';

  // Whether anyone can still join, computed the way the join gate itself computes it - round 1's
  // lock time, never competition.status, which lags behind it (docs/player-onboarding.md §4.2).
  // Codes are permanent now, so their presence no longer implies an open competition and this
  // card would otherwise invite sharing that only leads to a dead end.
  const joiningOpen = useMemo(() => {
    if (!currentRoundInfo) return true; // no rounds yet - the competition has not started
    if (currentRoundInfo.round_number > 1) return false;
    if (!currentRoundInfo.lock_time) return true;
    return new Date(currentRoundInfo.lock_time).getTime() > Date.now();
  }, [currentRoundInfo]);

  // The start gate. `startsAt` is the kickoff their first round would actually get, answered by
  // the same rules the push uses - so it is fetched rather than guessed here.
  const [startsAt, setStartsAt] = useState<string | null>(null);
  // The matches behind that date. Same toggle as the round screen - this is the card the organiser
  // actually presses, so it needs the same answer to "a full gameweek, or two leftovers?".
  const [startFixtures, setStartFixtures] = useState<{ home_team: string; away_team: string; kickoff_time: string }[]>([]);
  const [showStartFixtures, setShowStartFixtures] = useState(false);
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});
  // Ready is offered only when a round is actually available. False by default so a failed outlook
  // call blocks rather than offering a button that would do nothing.
  const [canStart, setCanStart] = useState(false);
  const [currentBatchKickoff, setCurrentBatchKickoff] = useState<string | null>(null);
  const [isSettingReady, setIsSettingReady] = useState(false);
  const [readyError, setReadyError] = useState<string | null>(null);
  const [messageCopied, setMessageCopied] = useState(false);

  // Unpicked players modal state
  const [showUnpickedModal, setShowUnpickedModal] = useState(false);
  const [unpickedPlayers, setUnpickedPlayers] = useState<Array<{ user_id: number; display_name: string }>>([]);
  const [loadingUnpicked, setLoadingUnpicked] = useState(false);

  // Simple loading based on context availability
  const loading = contextLoading || !competition;

  // Prevent duplicate API calls using refs
  const roundLoadedRef = useRef(false);
  const pickStatsLoadedRef = useRef(false);
  const roundStatsLoadedRef = useRef(false);
  const currentRoundStatsLoadedRef = useRef(false);
  const myPickLoadedRef = useRef(false);

  // The player's own pick for the current round. `myPickLoaded` exists so the card can stay off
  // the screen until the answer is in - rendering "not picked yet" for a moment to someone who
  // has picked is the one thing it must never do.
  const [myPick, setMyPick] = useState<{
    team: string;
    team_full_name: string;
    fixture: string;
    fixture_id: number;
  } | null>(null);
  const [myPickLoaded, setMyPickLoaded] = useState(false);
  // How their pick actually finished, once the result is in. Null while the fixture is unplayed.
  const [myPickOutcome, setMyPickOutcome] = useState<'won' | 'lost' | 'draw' | null>(null);
  const myPickOutcomeLoadedRef = useRef(false);

  // User role detection
  const isOrganiser = competition?.is_organiser || false;
  const isParticipant = competition?.is_participant || false;

  // Permission detection (organiser has all permissions implicitly, plus delegated permissions)
  const canManageResults = isOrganiser || competition?.manage_results || false;
  const canManageFixtures = isOrganiser || competition?.manage_fixtures || false;
  const canManagePlayers = isOrganiser || competition?.manage_players || false;
  const canManagePromote = isOrganiser || competition?.manage_promote || false;

  // Built from the dashboard payload's fixture counts, which reach every phase - see
  // deriveDashboardRoundState.
  const dashboardRoundState = useMemo(
    () =>
      deriveDashboardRoundState({
        currentRound: competition?.current_round,
        currentRoundLockTime: competition?.current_round_lock_time,
        automated: competition?.fixture_service === true,
        readyToStart: competition?.ready_at != null,
        competitionComplete: competition?.is_complete === true,
        now: new Date(),
        totalFixtures: competition?.total_fixtures,
        fixturesWithResults: competition?.fixtures_with_results,
        fixturesProcessed: competition?.fixtures_processed,
      }),
    [
      competition?.current_round,
      competition?.current_round_lock_time,
      competition?.fixture_service,
      competition?.ready_at,
      competition?.is_complete,
      competition?.total_fixtures,
      competition?.fixtures_with_results,
      competition?.fixtures_processed,
    ]
  );

  /* "Play" is only honest while there's something to play. Once the round locks the same tile
     goes to the read-only round view (handlePlayClick), so it says what it now does - and once a
     round is settled it names which round that is, because between rounds "Round progress" gives
     no clue whether pressing it shows the round just finished or one not yet started. It shows
     the finished one. */
  const playTileLabel =
    dashboardRoundState.phase === 'OPEN'
      ? 'Play'
      : dashboardRoundState.phase === 'COMPLETE' && dashboardRoundState.roundNumber
      ? `Round ${dashboardRoundState.roundNumber} results`
      : 'Round progress';

  /* False on an automated competition - the fixture service enters and processes its results, so
     there is nothing here for the organiser to do and the tile stays neutral. */
  const roundNeedsAction = roundTileNeedsAction(dashboardRoundState, { canManageResults, canManageFixtures });

  /* The start gate: an automated competition gets no fixtures at all until its organiser presses
     Ready, so the button is here, on the page they are already looking at, rather than one
     navigation away on a round screen that would otherwise be empty. Once pressed, the same card
     answers "when does it start?" - see docs/round-state-machine.md §5. */
  const showStartGate = isStartGateVisible(dashboardRoundState, { canManageResults, canManageFixtures });
  const isReadyToStart = dashboardRoundState.readyToStart;

  // Fetched before the button ("what happens if I press this?") and after it too - once they are
  // ready the gate card removes itself and the Round tile is the only thing left describing the
  // competition, so it needs the date. Hence showStartGate alone, not `&& !isReadyToStart`.
  useEffect(() => {
    if (!showStartGate) {
      setStartsAt(null);
      setStartFixtures([]);
      setCanStart(false);
      setCurrentBatchKickoff(null);
      return;
    }

    let cancelled = false;
    competitionApi.getStartOutlook(parseInt(competitionId))
      .then((response) => {
        if (cancelled || response.data.return_code !== 'SUCCESS') return;
        setStartsAt(response.data.starts_at);
        setStartFixtures(response.data.fixtures ?? []);
        setCanStart(response.data.can_start === true);
        setCurrentBatchKickoff(response.data.current_batch_kickoff ?? null);
      })
      .catch(() => { /* Card falls back to "as soon as the next matches are in", still true */ });

    return () => { cancelled = true; };
  }, [showStartGate, competitionId]);

  // Only once the organiser opens the list. Team names are static and cached, but this is the
  // busiest screen in the app and most visits never open the toggle.
  useEffect(() => {
    if (!showStartFixtures || Object.keys(teamNames).length > 0) return;

    let cancelled = false;
    teamApi.getTeams()
      .then((response) => {
        if (cancelled || response.data.return_code !== 'SUCCESS' || !response.data.teams) return;
        const mapping: Record<string, string> = {};
        response.data.teams.forEach((team) => { mapping[team.short_name] = team.name; });
        setTeamNames(mapping);
      })
      .catch(() => { /* Falls back to short codes, which are still readable */ });

    return () => { cancelled = true; };
  }, [showStartFixtures, teamNames]);


  const handleStartCompetition = async () => {
    if (!competition) return;
    setIsSettingReady(true);
    setReadyError(null);

    try {
      const response = await competitionApi.setReady(competition.id, true);

      if (response.data.return_code === 'SUCCESS') {
        // Pressing ready can publish round 1 there and then. The round load is a one-shot ref, so
        // without clearing it the dashboard would sit on "no rounds" beside a round that exists.
        if (response.data.round_started) {
          roundLoadedRef.current = false;
        }
        cacheUtils.invalidateCompetitions();
        await refreshCompetitions();
      } else {
        setReadyError(response.data.message || 'Could not update your competition.');
      }
    } catch {
      setReadyError('Network error — could not reach the server.');
    } finally {
      setIsSettingReady(false);
    }
  };

  /* "Add matches" goes to the entry form, not to the round screen it would otherwise sit on -
     see roundTileTarget. Every other phase still lands on the round. */
  const roundTileHref =
    roundTileTarget(dashboardRoundState, { canManageResults, canManageFixtures }) === 'fixtures'
      ? `/game/${competitionId}/organizer-fixtures`
      : `/game/${competitionId}/round`;

  /* The round panel's branches don't all produce output: the round-complete one is gated on
     SHOW_ROUND_STATISTICS, which is off, and the last falls through to null. Both left an empty
     bordered box sitting on the page between the round is settled and the next one arriving.
     Deciding here rather than in the JSX keeps the panel and its contents from disagreeing. */
  const roundPanelHasContent = useMemo(() => {
    if (!currentRoundInfo || competition?.status === 'COMPLETE') return false;
    if (!currentRoundInfo.is_locked) return true;
    if (currentRoundInfo.status === 'COMPLETE') return SHOW_ROUND_STATISTICS && !!roundStats;
    const latestSettled = competition?.history?.[0];
    return !latestSettled || latestSettled.round_number < currentRoundInfo.round_number;
  }, [currentRoundInfo, competition?.status, competition?.history, roundStats]);

  // Standings is unconditional; the rest are earned. Counted here so the grid can pick a column
  // count that divides evenly - see TILE_GRID_COLS.
  const tileCount =
    1 +
    (isParticipant ? 1 : 0) +
    (canManageFixtures || canManageResults ? 1 : 0) +
    (canManagePlayers ? 1 : 0) +
    (canManagePromote ? 1 : 0) +
    (isOrganiser ? 1 : 0);

  // Winner detection only shows when competition status is COMPLETE
  const getWinnerStatus = (comp: CompetitionType) => {
    const isComplete = comp.status === 'COMPLETE';

    if (isComplete && comp.winner_name) return { isComplete: true, winner: comp.winner_name, isDraw: false };
    if (isComplete && !comp.winner_name) return { isComplete: true, winner: undefined, isDraw: true };
    return { isComplete: false };
  };

  const competitionComplete = competition ? getWinnerStatus(competition) : { isComplete: false };


  // Handle play button click - check player status first, then rounds and fixtures before routing
  // Handle clicking the Round Progress card to show unpicked players
  const handleShowUnpickedPlayers = async () => {
    if (!competition || !currentRoundInfo) return;

    setLoadingUnpicked(true);
    setShowUnpickedModal(true);

    try {
      // Fetch unpicked players from API
      const response = await competitionApi.getUnpickedPlayers(competition.id);

      if (response.data.return_code === 'SUCCESS' && response.data.unpicked_players) {
        setUnpickedPlayers(response.data.unpicked_players);
      } else {
        console.error('Failed to fetch unpicked players:', response.data.message);
        setUnpickedPlayers([]);
      }
    } catch (error) {
      console.error('Error fetching unpicked players:', error);
      setUnpickedPlayers([]);
    } finally {
      setLoadingUnpicked(false);
    }
  };

  const handlePlayClick = async () => {
    try {
      const response = await roundApi.getRounds(parseInt(competitionId));

      if (response.data.return_code !== 'SUCCESS') {
        console.error('Failed to fetch rounds:', response.data.message);
        // If API fails, go to waiting screen as fallback
        router.push(`/game/${competitionId}/waiting`);
        return;
      }

      const rounds = response.data.rounds || [];

      // Check if no rounds exist
      if (rounds.length === 0) {
        router.push(`/game/${competitionId}/waiting`);
        return;
      }

      // Check if the latest round (first in array, as they're ordered most recent first) has fixtures
      const latestRound = rounds[0];
      if (latestRound.fixture_count === 0) {
        router.push(`/game/${competitionId}/waiting`);
        return;
      }

      // Check player status AFTER we know rounds exist
      // Eliminated participants can view results but cannot make picks
      if (competition?.is_participant && competition?.user_status && competition.user_status !== 'active') {
        // Eliminated participant - always show player results view (never allow picking)
        router.push(`/game/${competitionId}/player-results`);
        return;
      }

      // For active players and organizers: Check if round is locked to determine which page to show
      const now = new Date();
      const lockTime = new Date(latestRound.lock_time || '');
      const isLocked = !!(latestRound.lock_time && now >= lockTime);

      if (isLocked) {
        // Round is locked - show player results view
        router.push(`/game/${competitionId}/player-results`);
      } else {
        // Round is not locked - show pick screen (only active players and organizers reach here)
        router.push(`/game/${competitionId}/pick`);
      }

    } catch (error) {
      console.error('Error checking rounds:', error);
      // On error, fallback to waiting screen
      router.push(`/game/${competitionId}/waiting`);
    }
  };

  // Handle adding guest players
  const handleAddOfflinePlayer = async () => {
    if (!competition || !addPlayerForm.display_name.trim()) return;

    setAddingPlayer(true);
    setAddPlayerError(null);

    try {
      const response = await offlinePlayerApi.addOfflinePlayer(
        competition.id,
        addPlayerForm.display_name.trim()
      );

      if (response.data.return_code === 'SUCCESS') {
        // Player list is paginated, so it must go by prefix - an exact-key delete of
        // `competition-players-${id}` matches none of the real keys.
        cacheUtils.invalidatePrefix(cachePrefixes.competitionPlayers(competition.id));
        cacheUtils.invalidateCompetitions();

        // Reset form and close modal
        setAddPlayerForm({ display_name: '' });
        setAddPlayerError(null);
        setShowAddPlayerModal(false);

        // Refresh the page data to show updated player count
        window.location.reload();
      } else {
        setAddPlayerError(response.data.message || 'Unknown error occurred');
      }
    } catch (error) {
      console.error('Failed to add player:', error);
      setAddPlayerError('Failed to add player. Please try again.');
    } finally {
      setAddingPlayer(false);
    }
  };

  useEffect(() => {
    // Simple auth check
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      router.push('/login');
      return;
    }

    // Load data only if we have the competition
    if (competition) {

      // Load current round info
      if (!roundLoadedRef.current) {
        roundLoadedRef.current = true;
        roundApi.getRounds(parseInt(competitionId))
          .then(response => {
            if (response.data.return_code === 'SUCCESS') {
              const rounds = response.data.rounds || [];
              if (rounds.length > 0) {
                const latestRound = rounds[0];
                const now = new Date();
                const lockTime = new Date(latestRound.lock_time || '');
                const isLocked = !!(latestRound.lock_time && now >= lockTime);

                setCurrentRoundInfo({
                  id: latestRound.id,
                  round_number: latestRound.round_number,
                  lock_time: latestRound.lock_time,
                  fixture_count: latestRound.fixture_count || 0,
                  is_locked: isLocked,
                  completed_fixtures: latestRound.completed_fixtures || 0,
                  status: latestRound.status
                });

                // DISABLED: Organiser fixture highlighting logic - may re-enable in future
                // Check if this is a new competition needing fixtures
                // setNeedsFixtures(latestRound.fixture_count === 0 && latestRound.round_number === 1);
              } else {
                setCurrentRoundInfo(null);
                // DISABLED: Organiser fixture highlighting logic - may re-enable in future
                // No rounds at all - definitely needs fixtures
                // setNeedsFixtures(true);
              }
            }
            setLoadingRound(false);
          })
          .catch(() => {
            setLoadingRound(false);
            roundLoadedRef.current = false; // Reset on error to allow retry
          });
      }

      // Load pick statistics for all users
      if (!pickStatsLoadedRef.current && currentRoundInfo) {
        pickStatsLoadedRef.current = true;
        competitionApi.getPickStatistics(parseInt(competitionId))
          .then(response => {
            if (response.data.return_code === 'SUCCESS') {
              setPickStats({
                players_with_picks: response.data.players_with_picks || 0,
                total_active_players: response.data.total_active_players || 0,
                pick_percentage: response.data.pick_percentage || 0
              });
            }
          })
          .catch(() => {
            pickStatsLoadedRef.current = false; // Reset on error to allow retry
          });
      }

      // Load this player's own pick. Deliberately uncached: the player arrives here straight
      // after picking on the pick screen, and a stale hit would tell them it did not save.
      if (!myPickLoadedRef.current && currentRoundInfo && competition.is_participant) {
        myPickLoadedRef.current = true;
        playerActionApi.getCurrentPick(currentRoundInfo.id)
          .then(response => {
            if (response.data.return_code === 'SUCCESS') {
              const pick = response.data.pick;
              // Both names fall back to the short one rather than being assumed present: the
              // full name comes from a join on an active team row, so a team retired from the
              // list mid-season returns a pick with no name attached.
              setMyPick(pick ? {
                team: pick.team,
                team_full_name: pick.team_full_name || pick.team,
                fixture: pick.fixture || '',
                fixture_id: pick.fixture_id
              } : null);
              setMyPickLoaded(true);
            }
          })
          .catch(() => {
            // Non-fatal - the card stays hidden rather than claiming no pick was made.
            myPickLoadedRef.current = false;
          });
      }

      // How their pick finished. Only once the round is locked and something has been
      // processed - before that there is no result to find, and this is a second request on a
      // screen that already makes several. "Locked in" is the honest answer until then.
      if (
        !myPickOutcomeLoadedRef.current &&
        currentRoundInfo?.is_locked &&
        myPick &&
        (currentRoundInfo.completed_fixtures || 0) > 0
      ) {
        myPickOutcomeLoadedRef.current = true;
        const pick = myPick;
        fixtureApi.get(currentRoundInfo.id.toString())
          .then(response => {
            if (response.data.return_code !== 'SUCCESS') return;
            const fixture = (response.data.fixtures || []).find(f => f.id === pick.fixture_id);
            if (!fixture?.result) return;
            setMyPickOutcome(
              fixture.result === pick.team
                ? 'won'
                // `result` holds the winning team's short name, or the string below for a draw -
                // see lmslocal-server/db/README.md.
                : fixture.result === 'DRAW'
                ? 'draw'
                : 'lost'
            );
          })
          .catch(() => {
            myPickOutcomeLoadedRef.current = false;
          });
      }

      // Load round statistics for the most recently completed round
      if (SHOW_ROUND_STATISTICS && !roundStatsLoadedRef.current && currentRoundInfo) {
        roundStatsLoadedRef.current = true;

        // Fetch all rounds to find the most recently completed one
        roundApi.getRounds(parseInt(competitionId))
          .then(response => {
            if (response.data.return_code === 'SUCCESS') {
              const rounds = response.data.rounds || [];
              // Find the most recently completed round
              const completedRound = rounds.find(r => r.status === 'COMPLETE');

              if (completedRound) {
                // Fetch statistics for this completed round
                return promoteApi.getRoundStatistics(parseInt(competitionId), completedRound.id)
                  .then(statsResponse => {
                    if (statsResponse.data.return_code === 'SUCCESS' && statsResponse.data.statistics) {
                      setRoundStats({
                        round_number: completedRound.round_number,
                        ...statsResponse.data.statistics
                      });
                    }
                  });
              }
            }
          })
          .catch((error) => {
            console.error('Failed to load round statistics:', error);
            roundStatsLoadedRef.current = false; // Reset on error to allow retry
          });
      }

      // Load current round statistics (for live rounds with results being processed)
      if (SHOW_ROUND_STATISTICS && !currentRoundStatsLoadedRef.current && currentRoundInfo && currentRoundInfo.is_locked) {
        currentRoundStatsLoadedRef.current = true;

        // Fetch statistics for the current round
        promoteApi.getRoundStatistics(parseInt(competitionId), currentRoundInfo.id)
          .then(statsResponse => {
            if (statsResponse.data.return_code === 'SUCCESS' && statsResponse.data.statistics) {
              setCurrentRoundStats({
                round_number: currentRoundInfo.round_number,
                ...statsResponse.data.statistics
              });
            } else if (statsResponse.data.return_code === 'NO_DATA') {
              // No data yet for current round - this is fine, results haven't been processed yet
              setCurrentRoundStats(null);
            }
          })
          .catch((error) => {
            console.error('Failed to load current round statistics:', error);
            currentRoundStatsLoadedRef.current = false; // Reset on error to allow retry
          });
      }
    }
  }, [competition, competitionId, router, currentRoundInfo, myPick]);

  // Reset current round stats ref when round is locked
  useEffect(() => {
    if (currentRoundInfo && currentRoundInfo.is_locked) {
      currentRoundStatsLoadedRef.current = false;
    }
  }, [currentRoundInfo]);

  // Reset pick stats when player count changes (results were processed and players eliminated)
  // OR when round number changes (new fixtures added)
  useEffect(() => {
    pickStatsLoadedRef.current = false;
  }, [competition?.player_count, currentRoundInfo?.round_number]);

  // A new round means a new pick to make, so the old answer must not survive into it.
  useEffect(() => {
    myPickLoadedRef.current = false;
    setMyPickLoaded(false);
    myPickOutcomeLoadedRef.current = false;
    setMyPickOutcome(null);
  }, [currentRoundInfo?.round_number]);

  if (loading) {
    return (
      <div className="min-h-screen bg-stock font-body text-ink">
        <ToastContainer toasts={toasts} onClose={removeToast} />

        <header className="border-b border-ink/30">
          <div className="mx-auto flex max-w-3xl items-center px-4 py-4 sm:px-6">
            <Link href="/dashboard" className={`${LABEL} flex items-center gap-1.5 text-ink-fade transition-colors hover:text-ink`}>
              <ArrowLeftIcon className="h-4 w-4" />
              Dashboard
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <div className={`${PANEL} p-8 text-center`}>
            <div className="mb-4 inline-flex h-8 w-8 animate-spin items-center justify-center rounded-full border-2 border-ink border-t-transparent" />
            <p className={EYEBROW}>Loading</p>
            <p className="mt-2 text-[17px] text-ink-fade">Fetching your competition&hellip;</p>
          </div>
        </main>
      </div>
    );
  }

  if (!competition) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stock font-body text-ink">
        <div className="text-center">
          <h1 className={`${HEADING} text-3xl`}>Competition not found</h1>
          <Link href="/dashboard" className={`${LABEL} mt-4 inline-block text-ink-fade underline decoration-dotted underline-offset-4 transition-colors hover:text-ink`}>
            Return to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const contactLine = [
    competition.address_line_1,
    competition.address_line_2,
    competition.city,
    competition.postcode
  ].filter(Boolean).join(', ');

  return (
    <div className="min-h-screen bg-stock font-body text-ink">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <header className="border-b border-ink/30">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/dashboard" className={`${LABEL} flex items-center gap-1.5 text-ink-fade transition-colors hover:text-ink`}>
            <ArrowLeftIcon className="h-4 w-4" />
            Dashboard
          </Link>
          {isOrganiser && <span className={`${LABEL} text-ink-fade`}>Organiser</span>}
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-8 sm:px-6 sm:py-10">

        {/* Masthead */}
        <div className={`${PANEL} p-6 sm:p-8`}>
          {competition.logo_url ? (
            <div className="flex items-center gap-5">
              <Image
                src={competition.logo_url}
                alt={`${competition.name} logo`}
                width={84}
                height={84}
                className="flex-shrink-0 border border-ink/30"
                unoptimized
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div>
                <p className={EYEBROW}>Last man standing</p>
                <h1 className={`${HEADING} mt-1 text-2xl sm:text-3xl`}>{competition.name}</h1>
                {competition.personal_name && (
                  <p className="mt-1 font-data text-[15px] italic text-ink-fade">{competition.personal_name}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center">
              <p className={EYEBROW}>Last man standing</p>
              <h1 className={`${HEADING} mt-1 text-2xl sm:text-3xl`}>{competition.name}</h1>
              {competition.personal_name && (
                <p className="mt-1 font-data text-[15px] italic text-ink-fade">{competition.personal_name}</p>
              )}
              {competition.venue_name && (
                <p className="mt-1 text-[15px] text-ink-fade">{competition.venue_name}</p>
              )}
            </div>
          )}

          {(contactLine || competition.phone || competition.email) && (
            <div className="mt-5 border-t border-ink/30 pt-4 text-center">
              {contactLine && <p className="text-[13px] text-ink-fade">{contactLine}</p>}
              {(competition.phone || competition.email) && (
                <div className="mt-2 flex items-center justify-center gap-4 text-[13px]">
                  {competition.phone && (
                    <a href={`tel:${competition.phone}`} className="text-ink-fade transition-colors hover:text-ink">
                      {competition.phone}
                    </a>
                  )}
                  {competition.email && (
                    <a href={`mailto:${competition.email}`} className="text-ink-fade transition-colors hover:text-ink">
                      {competition.email}
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Status ledger */}
        {currentRoundInfo && competition?.status !== 'COMPLETE' && (
          <>
            {/* "After round 1" between rounds, not "Round 1". The count is current, the round is
                finished, and heading a live figure with a settled round's number reads as a
                snapshot taken back then. */}
            <div className={`${PANEL} p-6 text-center`}>
              <p className={EYEBROW}>
                {dashboardRoundState.phase === 'COMPLETE'
                  ? `After round ${currentRoundInfo.round_number}`
                  : `Round ${currentRoundInfo.round_number}`}
              </p>
              <p className="mt-2 font-display text-6xl text-overprint">{competition.player_count}</p>
              <p className={`${LABEL} mt-1 text-ink-fade`}>Still in</p>
            </div>

            {/* The player's own pick, above their status: it is the one thing here they can still
                act on, and it reads that way on the Flutter dashboard, which puts it in the same
                place. Without it, someone who had just picked came back to a dashboard identical
                to one who had not, and the only way to confirm a pick was to open the pick screen
                and read the highlight off the fixture list. */}
            {isParticipant && myPickLoaded && competition.user_status === 'active' && (
              <div className={`${PANEL} flex items-center justify-between gap-4 p-4`}>
                <div className="min-w-0">
                  <p className={`${LABEL} text-ink-fade`}>Your pick</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    {/* A mark beside the value, never a panel behind it - design-system.md §8. */}
                    <span className={`h-2 w-2 flex-none rounded-full ${
                      !myPick || (myPickOutcome && myPickOutcome !== 'won') ? 'bg-overprint' : 'bg-moss'
                    }`} />
                    {myPick ? (
                      // font-data: a value the player chose, not interface chrome. The empty
                      // state is the app talking, so it is set in body type instead.
                      <p className="truncate font-data text-lg text-ink">{myPick.team_full_name}</p>
                    ) : (
                      <p className="text-lg text-overprint">
                        {currentRoundInfo.is_locked ? 'No pick made' : 'Not picked yet'}
                      </p>
                    )}
                  </div>
                  {myPick?.fixture && (
                    <p className="mt-1 pl-4 font-data text-[13px] text-ink-fade">{myPick.fixture}</p>
                  )}
                </div>
                {currentRoundInfo.is_locked ? (
                  // A locked pick can no longer be changed, but it is still the way into the
                  // round: same destination the Round progress tile takes a participant to once
                  // the round locks, reached from the thing they were already looking at.
                  //
                  // Once the result is in it says how the pick did, not that it is locked. A
                  // settled round left this reading "Locked in" beside a team that had already
                  // won - true, and the least interesting true thing available.
                  <Link
                    href={`/game/${competitionId}/player-results`}
                    className={`${LABEL} flex flex-none items-center gap-1 ${
                      myPickOutcome === 'won'
                        ? 'font-semibold text-moss hover:opacity-80'
                        : myPickOutcome
                        ? 'text-overprint hover:opacity-80'
                        : 'text-ink-fade hover:text-ink'
                    }`}
                  >
                    {myPickOutcome === 'won'
                      ? 'Won'
                      : myPickOutcome === 'lost'
                      ? 'Lost'
                      : myPickOutcome === 'draw'
                      ? 'Draw'
                      : myPick
                      ? 'Locked in'
                      : 'Locked'}
                    <ChevronRightIcon className="h-4 w-4" />
                  </Link>
                ) : (
                  <Link
                    href={`/game/${competitionId}/pick`}
                    className={`${LABEL} flex flex-none items-center gap-1 text-ink hover:text-overprint`}
                  >
                    {myPick ? 'Change' : 'Pick'}
                    <ChevronRightIcon className="h-4 w-4" />
                  </Link>
                )}
              </div>
            )}

            {isParticipant && (
              <div className={`${PANEL} grid grid-cols-2 divide-x divide-ink/30`}>
                <div className="p-4 text-center">
                  <p className={`${LABEL} text-ink-fade`}>Your status</p>
                  <p className="mt-2 flex items-center justify-center gap-2 font-display text-lg uppercase text-ink">
                    <span className={`h-2 w-2 rounded-full ${competition.user_status === 'active' ? 'bg-moss' : 'bg-overprint'}`} />
                    {competition.user_status === 'active' ? 'In' : 'Out'}
                  </p>
                </div>
                <div className="p-4 text-center">
                  <p className={`${LABEL} text-ink-fade`}>Lives remaining</p>
                  <p className="mt-2 font-display text-lg text-ink">
                    {competition.user_status !== 'active'
                      ? '—'
                      : (competition.lives_remaining || 0) === 0 ? 'Knockout' : competition.lives_remaining}
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Competition Completion Banner */}
        {competitionComplete.isComplete && (
          <div className={`${PANEL} p-6 text-center`}>
            <p className={EYEBROW}>Competition complete</p>
            {competitionComplete.winner ? (
              <>
                <p className={`${HEADING} mt-2 text-2xl sm:text-3xl`}>Winner: {competitionComplete.winner}</p>
              </>
            ) : (
              <p className={`${HEADING} mt-2 text-2xl sm:text-3xl`}>Draw &mdash; no players remaining</p>
            )}
            <Link
              href={`/game/${competitionId}/standings`}
              className={`${BTN_PRIMARY} mt-5 inline-flex items-center gap-2 px-6 py-3 text-base`}
            >
              <TrophyIcon className="h-4 w-4" />
              View final standings
            </Link>
          </div>
        )}

        {/* Invite Players */}
        {competition.invite_code && joiningOpen && (isOrganiser || canManagePlayers) && (
          <div className={`${PANEL} p-6`}>
            <div className="text-center">
              <p className={EYEBROW}>Setup</p>
              <p className={`${HEADING} mt-1 text-2xl`}>Invite players</p>
            </div>

            {/* The link comes first and the code second: a player sent a link never has to type
                anything, which is the whole point of docs/player-onboarding.md §2. The code is
                still here for anyone told it out loud. */}
            <div className="mt-5 border-t border-ink/30 pt-5 text-center">
              <p className="text-[15px] text-ink-fade">Send players this link</p>
              <p className="mt-2 break-all font-data text-[15px] text-ink">{joinUrl}</p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(joinUrl);
                    setLinkCopied(true);
                    showToast('Join link copied', 'success');
                    setTimeout(() => setLinkCopied(false), 2000);
                  }}
                  className={`${BTN_OUTLINE} px-3 py-1.5`}
                >
                  {linkCopied ? 'Copied' : 'Copy link'}
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      buildInviteMessage({
                        competition_name: competition.name,
                        join_url: joinUrl,
                        lock_time: currentRoundInfo?.lock_time,
                        entry_fee: competition.entry_fee,
                        prize_structure: competition.prize_structure,
                      })
                    );
                    setMessageCopied(true);
                    showToast('Message copied! Paste it into WhatsApp, email, or any messaging app', 'success');
                    setTimeout(() => setMessageCopied(false), 2000);
                  }}
                  className={`${BTN_OUTLINE} px-3 py-1.5`}
                >
                  {messageCopied ? 'Copied' : 'Copy full message'}
                </button>
              </div>

              <p className="mt-4 text-[13px] text-ink-fade">
                Or give them the code <code className="font-data text-[15px] text-ink">{competition.invite_code}</code>{' '}
                to enter at lmslocal.co.uk
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(competition.invite_code || '');
                    setCodeCopied(true);
                    showToast('Competition code copied to clipboard!', 'success');
                    setTimeout(() => setCodeCopied(false), 2000);
                  }}
                  className="ml-2 underline underline-offset-2 hover:text-ink"
                >
                  {codeCopied ? 'Copied' : 'Copy code'}
                </button>
              </p>
            </div>

            <div className="mt-5 border-t border-ink/30 pt-5 text-center">
              <p className={`${LABEL} mb-1 text-ink-fade`}>Or add players directly</p>
              {/* Says what a guest is before the button, not after it in the modal - organisers
                  were clicking to find out. One line, because the whole idea is one line. */}
              <p className="mb-3 text-[13px] text-ink-fade">
                A guest has no login and no app &mdash; you make their picks for them
              </p>
              <button
                onClick={() => {
                  setShowAddPlayerModal(true);
                  setAddPlayerError(null);
                }}
                className={`${BTN_DARK} inline-flex items-center gap-2 px-5 py-2.5 text-base`}
              >
                <UserIcon className="h-4 w-4" />
                Add guest players
              </button>
            </div>
          </div>
        )}

        {/* The start gate, deliberately sitting under Invite players: the two are one job in
            order — get your people in, then say go.

            It exists only while the competition is waiting to be started. Once the organiser has
            said yes, the card has no job left: it was reporting a date nobody could act on, under
            a heading that read as news, on the one screen they check most. The Round tile carries
            the state from then on, and the round screen carries the date for anyone who asks. */}
        {showStartGate && !isReadyToStart && (
          <div className={`${PANEL} p-6 ${canStart ? 'border-overprint' : ''}`}>
            {/* Not "Next step" when there is no step to take, and no accent either - a red card
                with nothing to press on it reads as a problem the organiser has caused. */}
            <p className={EYEBROW}>{canStart ? 'Next step' : 'Waiting on the matches'}</p>
            <p className={`${HEADING} mt-1 text-2xl`}>
              {canStart
                ? (startsAt ? `Start with the matches on ${formatRoundStart(startsAt)}?` : 'Start with the next set of matches?')
                : 'Not yet — no matches ready for you'}
            </p>
            <p className="mt-2 text-[15px] text-ink-fade">
              {canStart
                ? 'That would be your Round 1, and your players can pick as soon as you press it.'
                : startBlockedText(currentBatchKickoff)}
            </p>
            {canStart && <button
              type="button"
              onClick={() => handleStartCompetition()}
              disabled={isSettingReady}
              className={`${BTN_PRIMARY} mt-4 inline-flex px-6 py-3 text-base disabled:opacity-50`}
            >
              {isSettingReady ? 'Starting…' : 'Yes, start my competition'}
            </button>}

            {/* Collapsed so it doesn't push the button this card exists for below the fold. Only
                populated when they can actually start, so it never previews a round they can't have. */}
            {startFixtures.length > 0 && (
              <div className="mt-4 border-t border-ink/30 pt-4">
                <button
                  type="button"
                  onClick={() => setShowStartFixtures((open) => !open)}
                  className={`${LABEL} text-ink-fade transition-colors hover:text-ink`}
                >
                  {showStartFixtures ? 'Hide the matches' : `See the ${startFixtures.length} matches`}
                </button>

                {showStartFixtures && (
                  <ul className="mt-3 space-y-1.5">
                    {startFixtures.map((fixture, index) => (
                      <li key={`${fixture.home_team}-${fixture.away_team}-${index}`} className="font-data text-[15px] text-ink">
                        {teamNames[fixture.home_team] || fixture.home_team}
                        <span className="text-ink-fade"> vs </span>
                        {teamNames[fixture.away_team] || fixture.away_team}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {readyError && <p className="mt-3 text-[14px] text-overprint">{readyError}</p>}
          </div>
        )}

        {/* Round Progress Card - Only show before lock when pick progress is useful */}
        {roundPanelHasContent && currentRoundInfo && (
          <div className={`${PANEL} p-5`}>
            {!currentRoundInfo.is_locked ? (
              /* Before Lock - Show Pick Progress (Clickable) */
              <div className="space-y-4">
                <button
                  onClick={handleShowUnpickedPlayers}
                  className="group -m-1 block w-full p-1 text-left"
                >
                  <p className={`${LABEL} text-ink-fade`}>Round {currentRoundInfo.round_number} picks</p>

                  {pickStats && (
                    <>
                      <div className="mt-3 flex items-baseline justify-between gap-2">
                        <p className="font-data text-[15px] text-ink">
                          {Math.min(pickStats.players_with_picks, pickStats.total_active_players)} of {pickStats.total_active_players} picked
                        </p>
                        <p className={`${LABEL} text-ink-fade transition-colors group-hover:text-ink`}>
                          {Math.min(100, Math.round((pickStats.players_with_picks / pickStats.total_active_players) * 100))}%
                        </p>
                      </div>
                      <div className="mt-2 h-[3px] w-full bg-ink/15">
                        <div
                          className="h-[3px] bg-overprint transition-all duration-300"
                          style={{ width: `${Math.min(100, (pickStats.players_with_picks / pickStats.total_active_players) * 100)}%` }}
                        />
                      </div>
                    </>
                  )}
                </button>

                {/* Show previous round statistics if available */}
                {SHOW_ROUND_STATISTICS && roundStats && roundStats.round_number < currentRoundInfo.round_number && (
                  <button
                    onClick={() => router.push(`/game/${competitionId}/standings`)}
                    className="w-full border-t border-ink/30 pt-4 text-left transition-colors hover:bg-stock"
                  >
                    <p className={`${LABEL} mb-2 text-ink-fade`}>Round {roundStats.round_number} results</p>
                    <div className="flex h-12 overflow-hidden border border-ink/30">
                      {roundStats.won > 0 && (
                        <div
                          className="flex flex-col items-center justify-center bg-moss text-stock-lit"
                          style={{ width: `${(roundStats.won / roundStats.total_players) * 100}%` }}
                        >
                          <div className="font-display text-lg">{roundStats.won}</div>
                        </div>
                      )}
                      {(roundStats.lost - roundStats.eliminated) > 0 && (
                        <div
                          className="flex flex-col items-center justify-center bg-ink/40 text-stock-lit"
                          style={{ width: `${((roundStats.lost - roundStats.eliminated) / roundStats.total_players) * 100}%` }}
                        >
                          <div className="font-display text-lg">{roundStats.lost - roundStats.eliminated}</div>
                        </div>
                      )}
                      {roundStats.eliminated > 0 && (
                        <div
                          className="flex flex-col items-center justify-center bg-overprint text-stock-lit"
                          style={{ width: `${(roundStats.eliminated / roundStats.total_players) * 100}%` }}
                        >
                          <div className="font-display text-lg">{roundStats.eliminated}</div>
                        </div>
                      )}
                    </div>
                  </button>
                )}
              </div>
            ) : currentRoundInfo.status === 'COMPLETE' ? (
              /* Round Complete - Waiting for new fixtures */
              <div className="space-y-3">
                {SHOW_ROUND_STATISTICS && roundStats && (
                  <button
                    onClick={() => router.push(`/game/${competitionId}/standings`)}
                    className="w-full text-left transition-colors hover:bg-stock"
                  >
                    <p className={`${LABEL} mb-2 text-ink-fade`}>Round {roundStats.round_number} results</p>
                    <div className="flex h-12 overflow-hidden border border-ink/30">
                      {roundStats.won > 0 && (
                        <div
                          className="flex flex-col items-center justify-center bg-moss text-stock-lit"
                          style={{ width: `${(roundStats.won / roundStats.total_players) * 100}%` }}
                        >
                          <div className="font-display text-lg">{roundStats.won}</div>
                        </div>
                      )}
                      {(roundStats.lost - roundStats.eliminated) > 0 && (
                        <div
                          className="flex flex-col items-center justify-center bg-ink/40 text-stock-lit"
                          style={{ width: `${((roundStats.lost - roundStats.eliminated) / roundStats.total_players) * 100}%` }}
                        >
                          <div className="font-display text-lg">{roundStats.lost - roundStats.eliminated}</div>
                        </div>
                      )}
                      {roundStats.eliminated > 0 && (
                        <div
                          className="flex flex-col items-center justify-center bg-overprint text-stock-lit"
                          style={{ width: `${(roundStats.eliminated / roundStats.total_players) * 100}%` }}
                        >
                          <div className="font-display text-lg">{roundStats.eliminated}</div>
                        </div>
                      )}
                    </div>
                  </button>
                )}
              </div>
            ) : !competition.history?.[0] || (competition.history[0].round_number < currentRoundInfo.round_number) ? (
              /* After Lock, Before Results - Show Live Status */
              <div className="space-y-3 text-center">
                <p className={EYEBROW}>Round {currentRoundInfo.round_number} live</p>

                {SHOW_ROUND_STATISTICS && currentRoundStats && currentRoundStats.round_number === currentRoundInfo.round_number && currentRoundStats.total_players > 0 ? (
                  <button
                    onClick={() => router.push(`/game/${competitionId}/standings`)}
                    className="w-full text-left transition-colors hover:bg-stock"
                  >
                    <div className="flex h-12 overflow-hidden border border-ink/30">
                      {currentRoundStats.won > 0 && (
                        <div
                          className="flex flex-col items-center justify-center bg-moss text-stock-lit"
                          style={{ width: `${(currentRoundStats.won / currentRoundStats.total_players) * 100}%` }}
                        >
                          <div className="font-display text-lg">{currentRoundStats.won}</div>
                        </div>
                      )}
                      {(currentRoundStats.lost - currentRoundStats.eliminated) > 0 && (
                        <div
                          className="flex flex-col items-center justify-center bg-ink/40 text-stock-lit"
                          style={{ width: `${((currentRoundStats.lost - currentRoundStats.eliminated) / currentRoundStats.total_players) * 100}%` }}
                        >
                          <div className="font-display text-lg">{currentRoundStats.lost - currentRoundStats.eliminated}</div>
                        </div>
                      )}
                      {currentRoundStats.eliminated > 0 && (
                        <div
                          className="flex flex-col items-center justify-center bg-overprint text-stock-lit"
                          style={{ width: `${(currentRoundStats.eliminated / currentRoundStats.total_players) * 100}%` }}
                        >
                          <div className="font-display text-lg">{currentRoundStats.eliminated}</div>
                        </div>
                      )}
                    </div>
                  </button>
                ) : (
                  /* States what happened to the window, not how many picked. Counting invited a
                     claim the numbers couldn't back - the old "All picks made" asserted something
                     it never checked, and contradicted the results screen when a round locked
                     with picks missing. This is true either way. */
                  <p className="text-[15px] text-ink-fade">Picks are in &mdash; the window is closed.</p>
                )}
              </div>
            ) : null
            }
          </div>
        )}

        {/* Competition Description */}
        {competition.description && (
          <div className={`${PANEL} p-5 text-center`}>
            <p className="text-[15px] text-ink-fade">{competition.description}</p>
          </div>
        )}

        {/* Action Buttons */}
        {(isOrganiser || canManageResults || canManageFixtures || canManagePlayers) ? (
          <div className={`grid gap-3 grid-cols-2 ${TILE_GRID_COLS[tileCount]}`}>
            {/* Play button - only show if user is also a participant */}
            {isParticipant && (
              <button
                onClick={handlePlayClick}
                className={`${PANEL} flex flex-col items-center justify-center gap-2 p-5 transition-colors hover:border-ink ${
                  competition.needs_pick ? 'border-overprint' : ''
                }`}
              >
                <PlayIcon className={`h-6 w-6 ${competition.needs_pick ? 'text-overprint' : 'text-ink'}`} />
                <span className={`${LABEL} text-ink`}>{playTileLabel}</span>
                {competition.needs_pick && (
                  <span className={`${LABEL} text-center text-overprint`}>
                    {pickDeadlineText(dashboardRoundState)}
                  </span>
                )}
              </button>
            )}

            {/* The round: fixtures and results are one destination, because they are one thing
                seen at two points in the week. The subtitle says which point, so the common
                question - "what's on this week?" - is answered without a click. When the round is
                waiting on this organiser it takes the same overprint accent the Play tile uses for
                "Pick needed" - both mean "this one is on you". */}
            {(canManageFixtures || canManageResults) && (
              <Link
                href={roundTileHref}
                className={`${PANEL} flex flex-col items-center justify-center gap-2 p-5 text-center transition-colors hover:border-ink ${
                  roundNeedsAction ? 'border-overprint' : ''
                }`}
              >
                <CalendarIcon className={`h-6 w-6 ${roundNeedsAction ? 'text-overprint' : 'text-ink'}`} />
                <span className={`${LABEL} text-ink`}>
                  {roundTileLabel(dashboardRoundState, { canManageResults, canManageFixtures })}
                </span>
                <span className={`${LABEL} ${roundNeedsAction ? 'text-overprint' : 'text-ink-fade'}`}>
                  {roundTileSummary(dashboardRoundState, { canManageResults, canManageFixtures }, startsAt)}
                </span>
              </Link>
            )}

            <Link
              href={`/game/${competitionId}/standings`}
              className={`${PANEL} flex flex-col items-center justify-center gap-2 p-5 transition-colors hover:border-ink`}
            >
              <TrophyIcon className="h-6 w-6 text-ink" />
              <span className={`${LABEL} text-ink`}>Standings</span>
            </Link>

            {/* Players Management - Show if user has players permission OR is organiser */}
            {canManagePlayers && (
              <Link
                href={`/game/${competitionId}/players`}
                className={`${PANEL} flex flex-col items-center justify-center gap-2 p-5 transition-colors hover:border-ink`}
              >
                <UserGroupIcon className="h-6 w-6 text-ink" />
                <span className={`${LABEL} text-ink`}>Players</span>
              </Link>
            )}

            {/* Promote - For organisers and users with manage_promote permission */}
            {canManagePromote && (
              <Link
                href={`/game/${competitionId}/promote`}
                className={`${PANEL} flex flex-col items-center justify-center gap-2 p-5 transition-colors hover:border-ink`}
              >
                <MegaphoneIcon className="h-6 w-6 text-ink" />
                <span className={`${LABEL} text-ink`}>Promote</span>
              </Link>
            )}

            {/* Settings - Only for main organisers */}
            {isOrganiser && (
              <Link
                href={`/game/${competitionId}/settings`}
                className={`${PANEL} flex flex-col items-center justify-center gap-2 p-5 transition-colors hover:border-ink`}
              >
                <Cog6ToothIcon className="h-6 w-6 text-ink" />
                <span className={`${LABEL} text-ink`}>Settings</span>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handlePlayClick}
              className={`${PANEL} flex flex-col items-center justify-center gap-2 p-5 transition-colors hover:border-ink ${
                competition.needs_pick ? 'border-overprint' : ''
              }`}
            >
              <PlayIcon className={`h-6 w-6 ${competition.needs_pick ? 'text-overprint' : 'text-ink'}`} />
              <span className={`${LABEL} text-ink`}>{playTileLabel}</span>
              {competition.needs_pick && (
                <span className={`${LABEL} text-center text-overprint`}>
                  {pickDeadlineText(dashboardRoundState)}
                </span>
              )}
            </button>

            <Link
              href={`/game/${competitionId}/standings`}
              className={`${PANEL} flex flex-col items-center justify-center gap-2 p-5 transition-colors hover:border-ink`}
            >
              <TrophyIcon className="h-6 w-6 text-ink" />
              <span className={`${LABEL} text-ink`}>Standings</span>
            </Link>
          </div>
        )}

      </main>

      {/* Add Guest Player Modal */}
      {showAddPlayerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
          <div className={`${PANEL} w-full max-w-md p-6`}>
            <p className={EYEBROW}>Guest player</p>
            <h3 className={`${HEADING} mt-1 text-2xl`}>Add guest player</h3>
            <p className="mt-2 text-[13px] text-ink-fade">
              No login and no app &mdash; you make their picks for them.
            </p>

            <div className="mt-5">
              <label htmlFor="display_name" className={`${LABEL} mb-2 block text-ink-fade`}>
                Player name
              </label>
              <input
                id="display_name"
                type="text"
                value={addPlayerForm.display_name}
                onChange={(e) => setAddPlayerForm(prev => ({ ...prev, display_name: e.target.value }))}
                placeholder="Enter player name"
                className="w-full rounded-sm border border-ink bg-transparent px-3 py-2 font-data text-[15px] text-ink placeholder-ink-fade/60 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                disabled={addingPlayer}
              />
            </div>

            {addPlayerError && (
              <div className="mt-4 border border-overprint px-3 py-2">
                <p className="text-[15px] text-ink">{addPlayerError}</p>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddPlayerModal(false);
                  setAddPlayerForm({ display_name: '' });
                  setAddPlayerError(null);
                }}
                disabled={addingPlayer}
                className={`${BTN_OUTLINE} px-4 py-2 disabled:opacity-50`}
              >
                Cancel
              </button>
              <button
                onClick={handleAddOfflinePlayer}
                disabled={addingPlayer || !addPlayerForm.display_name.trim()}
                className={`${BTN_PRIMARY} px-4 py-2 text-base disabled:opacity-50`}
              >
                {addingPlayer ? 'Adding player…' : 'Add player'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unpicked Players Modal */}
      {showUnpickedModal && pickStats && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
          <div className={`${PANEL} flex max-h-[80vh] w-full max-w-lg flex-col`}>
            <div className="flex items-center justify-between border-b border-ink/30 px-6 py-4">
              <h3 className={`${HEADING} text-xl`}>
                Round {currentRoundInfo?.round_number} picks
              </h3>
              <button
                onClick={() => setShowUnpickedModal(false)}
                className="text-ink-fade transition-colors hover:text-ink"
              >
                <span className="text-2xl leading-none">&times;</span>
              </button>
            </div>

            <div className="overflow-y-auto p-6">
              {loadingUnpicked ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="h-10 w-10 animate-spin rounded-full border-2 border-ink border-t-transparent" />
                  <p className="mt-4 text-ink-fade">Loading&hellip;</p>
                </div>
              ) : unpickedPlayers.length === 0 ? (
                <div className="py-8 text-center">
                  <p className={`${HEADING} text-xl`}>All players have picked</p>
                  <p className="mt-2 text-[15px] text-ink-fade">Everyone has made their selection for this round.</p>
                </div>
              ) : unpickedPlayers.length <= 10 ? (
                <div>
                  <p className="mb-4 text-[15px] text-ink-fade">
                    <span className="font-medium text-ink">{unpickedPlayers.length} {unpickedPlayers.length === 1 ? 'player has' : 'players have'}</span> not made their pick yet:
                  </p>
                  <div className="divide-y divide-ink/30 border-y border-ink/30">
                    {unpickedPlayers.map((player) => (
                      <div key={player.user_id} className="flex items-center gap-3 py-2.5">
                        <span className="h-2 w-2 flex-shrink-0 rounded-full bg-overprint" />
                        <span className="font-data text-[15px] text-ink">{player.display_name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center">
                  <p className="text-[15px] font-medium text-ink">
                    {unpickedPlayers.length} players have not made their pick yet
                  </p>
                  <p className="mt-1 text-[13px] text-ink-fade">
                    {Math.round((pickStats.players_with_picks / pickStats.total_active_players) * 100)}% complete
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-ink/30 px-6 py-4">
              <button onClick={() => setShowUnpickedModal(false)} className={`${BTN_OUTLINE} px-4 py-2`}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
