'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon
} from '@heroicons/react/24/outline';
import { roundApi, fixtureApi, playerActionApi, userApi } from '@/lib/api';
import { withCache, apiCache } from '@/lib/cache';
import { useAppData } from '@/contexts/AppDataContext';
import { useCompetitionGate } from '@/hooks/useCompetitionGate';
import CompetitionUnavailable from '@/components/CompetitionUnavailable';
import { useToast, ToastContainer } from '@/components/Toast';
import { LABEL, EYEBROW, HEADING, PANEL } from '@/lib/design';

interface Fixture {
  id: number;
  home_team: string;
  away_team: string;
  home_team_short: string;
  away_team_short: string;
  kickoff_time: string;
  result?: string | null;
}

export default function PickPage() {
  const router = useRouter();
  const params = useParams();
  const competitionId = params.id as string;

  // Use AppDataProvider context for competitions data
  const { loading: contextLoading, refreshData } = useAppData();
  const { showToast, toasts, removeToast } = useToast();

  const { competition, unavailable } = useCompetitionGate(competitionId);

  interface Round {
    id: number;
    round_number: number;
    fixture_count: number;
    lock_time?: string;
  }
  const [rounds, setRounds] = useState<Round[]>([]);
  const [currentRoundId, setCurrentRoundId] = useState<number | null>(null);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  // The team whose tap is in flight, so its own button can show the wait rather than a banner
  // somewhere else on the screen.
  const [submittingTeam, setSubmittingTeam] = useState<string | null>(null);
  const [allowedTeams, setAllowedTeams] = useState<string[]>([]);
  const [currentPick, setCurrentPick] = useState<string | null>(null);
  const [isRoundLocked, setIsRoundLocked] = useState<boolean>(false);
  const [pickDataLoaded, setPickDataLoaded] = useState<boolean>(false);

  const hasInitialized = useRef(false);

  const loadFixtures = async (roundId: number) => {
    try {
      const response = await fixtureApi.get(roundId.toString());
      if (response.data.return_code === 'SUCCESS') {
        setFixtures(response.data.fixtures || []);
      }
    } catch (error) {
      console.error('Failed to load fixtures:', error);
    }
  };

  const loadCurrentPick = useCallback(async (roundId: number) => {
    try {
      const response = await withCache(
        `current-pick-${roundId}-${competitionId}`,
        60 * 60 * 1000, // 1 hour cache - rounds don't change often
        () => playerActionApi.getCurrentPick(roundId)
      );
      if (response.data.return_code === 'SUCCESS') {
        const pickTeam = (response.data.pick as {team?: string})?.team || null;
        setCurrentPick(pickTeam);
      }
    } catch (error) {
      console.error('Failed to load current pick:', error);
      setCurrentPick(null);
    }
  }, [competitionId]);

  // Load data for the current round
  const loadRoundData = useCallback(async (roundId: number, freshRounds?: Round[]) => {
    setPickDataLoaded(false);

    try {
      await Promise.all([
        loadFixtures(roundId),
        loadAllowedTeams(parseInt(competitionId)),
        loadCurrentPick(roundId)
      ]);

      // For current round, use fresh rounds data when available, otherwise use state
      const roundsToUse = freshRounds || rounds;
      const currentRound = roundsToUse.find(r => r.id === roundId);
      if (currentRound) {
        const now = new Date();
        const lockTime = new Date(currentRound.lock_time || '');
        const locked = !!(currentRound.lock_time && now >= lockTime);
        setIsRoundLocked(locked);
      } else {
        setIsRoundLocked(false);
      }

      setPickDataLoaded(true);
    } catch (error) {
      console.error('Failed to load round data:', error);
    }
  }, [competitionId, loadCurrentPick, rounds]);

  useEffect(() => {
    // Prevent double execution from React Strict Mode
    if (hasInitialized.current) {
      return;
    }

    // No auth check here: useCompetitionGate owns it, and it carries the destination through the
    // sign-in. This used to push a bare /login, winning the race and losing where they were going.

    const initializeData = async () => {
      if (!competition || contextLoading) return;

      try {
        hasInitialized.current = true;

        // Check if user is an eliminated participant - redirect to results
        if (competition.is_participant && competition.user_status && competition.user_status !== 'active') {
          router.push(`/game/${competitionId}/player-results`);
          return;
        }

        // Get rounds to find current round (use cache for better performance)
        const roundsResponse = await roundApi.getRounds(parseInt(competitionId));

        if (roundsResponse.data.return_code !== 'SUCCESS') {
          console.error('Failed to get rounds:', roundsResponse.data.message);
          router.push(`/game/${competitionId}/waiting`);
          return;
        }

        const roundsData = roundsResponse.data.rounds || [];

        if (roundsData.length === 0) {
          router.push(`/game/${competitionId}/waiting`);
          return;
        }

        setRounds(roundsData);
        const latestRound = roundsData[0];

        // Check if round has fixtures and is not locked yet
        if (latestRound.fixture_count === 0) {
          router.push(`/game/${competitionId}/waiting`);
          return;
        }

        // Check if round is locked - this page is only for unlocked rounds
        const now = new Date();
        const lockTime = new Date(latestRound.lock_time || '');
        const locked = !!(latestRound.lock_time && now >= lockTime);

        // If round is locked, redirect to player results page
        if (locked) {
          router.push(`/game/${competitionId}/player-results`);
          return;
        }

        setCurrentRoundId(latestRound.id);
        setIsRoundLocked(locked);

        // Load data for the current round - pass fresh rounds data
        await loadRoundData(latestRound.id, roundsData);

      } catch (error) {
        console.error('Failed to load pick data:', error);
        router.push(`/game/${competitionId}`);
      } finally {
        setLoading(false);
      }
    };

    initializeData();
  }, [competitionId, router, competition, contextLoading, loadRoundData]);

  const loadAllowedTeams = async (competitionId: number) => {
    try {
      const response = await userApi.getAllowedTeams(competitionId);

      if (response.data.return_code === 'SUCCESS') {
        const teamShorts = (response.data.allowed_teams || []).map((team: { short_name: string }) => team.short_name);
        setAllowedTeams(teamShorts);
      } else {
        console.error('API returned error:', response.data.return_code, (response.data as { message?: string }).message);
      }
    } catch (error) {
      console.error('💥 Failed to load allowed teams:', error);
    }
  };



  /**
   * Tapping a team IS the pick. There is no separate confirm step, and no modal in its place.
   *
   * A pick is not a commitment until the round locks: `set-pick` takes a change directly
   * (ON CONFLICT DO UPDATE, putting the old team back into allowed_teams and auditing it as
   * "Pick Changed"), so a mis-tap is corrected by tapping the right team. Asking someone to
   * confirm something they can simply redo buys nothing — and the step it replaces was itself
   * losing people their round, since a player who tapped a team and closed the page had picked
   * nothing. Same reasoning, and same behaviour, as the Flutter app's pick page.
   */
  const pickTeam = async (teamShort: string, fixtureId: number, position: 'home' | 'away') => {
    if (submitting || isRoundLocked || !currentRoundId) return;
    // The current pick is exempt from the allowed test - see the disabled logic below.
    if (!allowedTeams.includes(teamShort) && currentPick !== teamShort) return;
    // Tapping the team already picked is a no-op rather than a pointless write.
    if (currentPick === teamShort) return;

    setSubmitting(true);
    setSubmittingTeam(teamShort);
    try {
      const response = await playerActionApi.setPick(fixtureId, position);

      if (response.data.return_code === 'SUCCESS') {
        // Check if this pick triggered auto-lock
        const roundLocked = (response.data as { round_locked?: boolean }).round_locked;

        // Clear pick-related caches and refresh data
        if (competition && currentRoundId) {
          // Clear pick-specific caches
          apiCache.delete(`current-pick-${currentRoundId}-${competitionId}`);
          // A change hands the previous team back to allowed_teams, so a stale list would keep
          // showing it as unavailable.
          apiCache.delete(`allowed-teams-${competitionId}-current`);

          // Clear user dashboard cache to update pick counts on main game page
          const userData = localStorage.getItem('user');
          if (userData) {
            const user = JSON.parse(userData);
            apiCache.delete(`user-dashboard-${user.id}`);
          }

          await loadAllowedTeams(parseInt(competitionId));
          await loadCurrentPick(currentRoundId);

          // Force dashboard data refresh for immediate stats update
          refreshData();
        }

        // No toast on an ordinary pick. The badge lands on the team they just tapped, which is
        // the same fact in the place they are already looking - a message naming the team on top
        // of that is the third time the screen has told them. Failures still speak, below.
        if (roundLocked) {
          showToast('You were the last player to pick. Pick choices are now available.', 'success');
          // Refresh page to show updated lock status
          setTimeout(() => {
            window.location.reload();
          }, 1500); // Give user time to see the toast
        }
      } else {
        showToast('Failed to save pick: ' + (response.data.message || 'Unknown error'), 'error');
      }
    } catch (error) {
      console.error('Failed to save pick:', error);
      showToast('Failed to save pick. Please try again.', 'error');
    } finally {
      setSubmitting(false);
      setSubmittingTeam(null);
    }
  };

  const currentRound = rounds.find(r => r.id === currentRoundId);
  const roundNumber = currentRound?.round_number;
  const lockTime = currentRound?.lock_time;
  const lockDate = lockTime ? new Date(lockTime) : null;

  if (unavailable) return <CompetitionUnavailable />;

  if (loading || contextLoading || !pickDataLoaded) {
    return (
      <div className="min-h-screen bg-stock font-body text-ink">
        <header className="border-b border-ink/30">
          <div className="mx-auto flex max-w-3xl items-center px-4 py-4 sm:px-6">
            <Link href={`/game/${competitionId}`} className={`${LABEL} flex items-center gap-1.5 text-ink-fade transition-colors hover:text-ink`}>
              <ArrowLeftIcon className="h-4 w-4" />
              Dashboard
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <div className={`${PANEL} p-8 text-center`}>
            <div className="mb-4 inline-flex h-8 w-8 animate-spin items-center justify-center rounded-full border-2 border-ink border-t-transparent" />
            <p className={EYEBROW}>Loading</p>
            <p className="mt-2 text-[17px] text-ink-fade">Fetching this round&apos;s fixtures&hellip;</p>
          </div>
        </main>
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
          {roundNumber && (
            <span className={`${LABEL} text-ink-fade`}>
              Round {roundNumber}
              {isRoundLocked ? ' — locked' : ''}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-5 flex items-baseline justify-between gap-3">
          <div>
            <p className={EYEBROW}>Make your pick</p>
            <h1 className={`${HEADING} mt-1 text-3xl`}>Round {roundNumber}</h1>
          </div>
          {lockDate && !isRoundLocked && (
            <div className="text-right">
              <p className={`${LABEL} text-ink-fade`}>Deadline</p>
              <p className="font-data text-[15px] text-ink">
                {lockDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                {' '}
                {lockDate
                  .toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })
                  // On the hour drops its minutes — "8pm", not "8:00pm" — matching roundState.ts
                  .replace(/:00(?=\s*[ap]m\b)/i, '')
                  .replace(/\s/g, '')}
              </p>
            </div>
          )}
        </div>

        {/* Fixture List */}
        <div className={`${PANEL} divide-y divide-ink/30`}>
          {fixtures.map((fixture) => {
            const homeTeam = {
              short: fixture.home_team_short,
              name: fixture.home_team,
              fixtureId: fixture.id,
              position: 'home' as const
            };

            const awayTeam = {
              short: fixture.away_team_short,
              name: fixture.away_team,
              fixtureId: fixture.id,
              position: 'away' as const
            };

            const renderTeam = (team: { short: string; name: string; fixtureId: number; position: 'home' | 'away' }) => {
              const isAllowed = allowedTeams.includes(team.short);
              const isCurrentPick = currentPick === team.short;
              const isSubmittingThis = submittingTeam === team.short;
              // Holding a pick no longer disables every other team - changing your mind is one
              // tap, the same gesture as choosing. And the team you picked is never "unavailable"
              // even though picking it removes it from allowed_teams under no_team_twice, which
              // rendered your own choice in the same grey as a team you used in an earlier round.
              const isDisabled = (!isAllowed && !isCurrentPick) || isRoundLocked;

              return (
                <button
                  key={team.short}
                  onClick={() => pickTeam(team.short, team.fixtureId, team.position)}
                  disabled={isDisabled || submitting}
                  className={`relative flex min-h-[72px] flex-1 items-center justify-center border p-3 text-center transition-colors sm:p-4 ${
                    isCurrentPick
                      ? 'border-2 border-moss bg-moss/10'
                      : isDisabled
                      ? 'cursor-not-allowed border-ink/15 bg-stock text-ink-fade/60'
                      : 'cursor-pointer border-ink/30 hover:border-ink disabled:cursor-wait'
                  }`}
                >
                  {/* Sits in the box's own top-left corner rather than above it as a caption:
                      the tile has the room, and a mark on the thing itself is what a player
                      scanning a list of ten matches actually sees. */}
                  {isCurrentPick && (
                    <span className={`${LABEL} absolute left-0 top-0 bg-moss px-2 py-1 text-[11px] text-stock-lit`}>
                      Pick
                    </span>
                  )}
                  {isSubmittingThis ? (
                    <span className="inline-flex h-5 w-5 animate-spin items-center justify-center rounded-full border-2 border-ink border-t-transparent" />
                  ) : (
                    <span className={`text-sm font-medium leading-tight sm:text-base ${
                      isCurrentPick ? 'text-ink' : isDisabled ? '' : 'text-ink'
                    }`}>
                      {team.name}
                    </span>
                  )}
                </button>
              );
            };

            return (
              <div key={fixture.id} className="flex items-center gap-2 p-3 sm:gap-4 sm:p-4">
                {renderTeam(homeTeam)}
                <span className={`${LABEL} flex-shrink-0 text-ink-fade`}>vs</span>
                {renderTeam(awayTeam)}
              </div>
            );
          })}
        </div>

        {/* One line, and it is the only rule that matters at the moment of picking. It replaces
            a titled card of three bullets: "tap a team to select" narrated what the player was
            already doing, "confirm your selection" described a step that no longer exists, and
            the third said a draw or loss eliminates you — untrue for anyone holding a life, which
            is most players in most competitions. */}
        {!isRoundLocked && (
          <p className="mt-5 text-center text-[15px] text-ink-fade">Your team must win to advance.</p>
        )}
      </main>

      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}
