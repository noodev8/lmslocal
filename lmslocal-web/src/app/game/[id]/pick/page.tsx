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
import { useToast, ToastContainer } from '@/components/Toast';
import { LABEL, EYEBROW, HEADING, PANEL, BTN_PRIMARY, BTN_OUTLINE } from '@/lib/design';

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
  const { competitions, loading: contextLoading, refreshData } = useAppData();
  const { showToast, toasts, removeToast } = useToast();

  // Find the specific competition
  const competition = competitions?.find(c => c.id.toString() === competitionId);

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
  const [selectedTeam, setSelectedTeam] = useState<{teamShort: string, fixtureId: number, position: 'home' | 'away'} | null>(null);
  const [submitting, setSubmitting] = useState(false);
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

    // Check authentication
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      router.push('/login');
      return;
    }

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



  const getFullTeamName = (shortName: string) => {
    const fixture = fixtures.find(f =>
      f.home_team_short === shortName || f.away_team_short === shortName
    );
    if (fixture) {
      return fixture.home_team_short === shortName ? fixture.home_team : fixture.away_team;
    }
    return shortName;
  };

  const getOpponentName = (fixtureId: number, position: 'home' | 'away') => {
    const fixture = fixtures.find(f => f.id === fixtureId);
    if (!fixture) return null;
    return position === 'home' ? fixture.away_team : fixture.home_team;
  };

  const handleTeamSelect = (teamShort: string, fixtureId: number, position: 'home' | 'away') => {
    // Can't select if round is locked
    if (isRoundLocked) return;

    // User must remove current pick first
    if (currentPick) {
      return;
    }

    // No current pick, allow selection if team is in allowed list
    if (allowedTeams.includes(teamShort)) {
      setSelectedTeam({ teamShort, fixtureId, position });
    }
  };

  const handleUnselectPick = async () => {
    if (!currentRoundId || submitting || isRoundLocked) return;

    setSubmitting(true);
    try {
      const response = await playerActionApi.unselectPick(currentRoundId);

      if (response.data.return_code === 'SUCCESS') {
        // Clear pick-related caches and refresh data
        if (competition && currentRoundId) {
          // Clear pick-specific caches
          apiCache.delete(`current-pick-${currentRoundId}-${competitionId}`);
          // Clear allowed teams cache so fresh data loads after team restoration
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
        setSelectedTeam(null);
      } else {
        alert('Failed to remove pick: ' + (response.data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to remove pick:', error);
      alert('Failed to remove pick');
    } finally {
      setSubmitting(false);
    }
  };

  const submitPick = async () => {
    if (!selectedTeam || submitting || isRoundLocked) return;

    setSubmitting(true);
    try {
      const response = await playerActionApi.setPick(selectedTeam.fixtureId, selectedTeam.position);

      if (response.data.return_code === 'SUCCESS') {
        // Check if this pick triggered auto-lock
        const roundLocked = (response.data as { round_locked?: boolean }).round_locked;

        // Clear pick-related caches and refresh data
        if (competition && currentRoundId) {
          // Clear pick-specific caches
          apiCache.delete(`current-pick-${currentRoundId}-${competitionId}`);

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

        setSelectedTeam(null);

        // Show appropriate success toast and handle refresh
        if (roundLocked) {
          showToast('You were the last player to pick. Pick choices are now available.', 'success');
          // Refresh page to show updated lock status
          setTimeout(() => {
            window.location.reload();
          }, 1500); // Give user time to see the toast
        } else {
          showToast('Pick saved successfully!', 'success');
        }
      } else {
        showToast('Failed to submit pick: ' + (response.data.message || 'Unknown error'), 'error');
      }
    } catch (error) {
      console.error('Failed to submit pick:', error);
      showToast('Failed to submit pick. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const currentRound = rounds.find(r => r.id === currentRoundId);
  const roundNumber = currentRound?.round_number;
  const lockTime = currentRound?.lock_time;
  const lockDate = lockTime ? new Date(lockTime) : null;

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
              const isSelected = selectedTeam?.teamShort === team.short;
              const isCurrentPick = currentPick === team.short;
              const isDisabled = !isAllowed || !!(currentPick && !isCurrentPick) || isRoundLocked;
              const isPicked = isSelected || isCurrentPick;

              return (
                <button
                  key={team.short}
                  onClick={() => handleTeamSelect(team.short, team.fixtureId, team.position)}
                  disabled={isDisabled}
                  className={`relative flex min-h-[72px] flex-1 items-center justify-center border p-3 text-center transition-colors sm:p-4 ${
                    isCurrentPick
                      ? 'border-2 border-moss bg-moss/10'
                      : isSelected
                      ? 'border-2 border-overprint bg-stock-lit'
                      : isDisabled
                      ? 'cursor-not-allowed border-ink/15 bg-stock text-ink-fade/60'
                      : 'cursor-pointer border-ink/30 hover:border-ink'
                  }`}
                >
                  {isCurrentPick && (
                    <span className={`${LABEL} absolute -top-2.5 left-3 bg-moss px-1.5 text-stock-lit`}>
                      Your pick
                    </span>
                  )}
                  <span className={`text-sm font-medium leading-tight sm:text-base ${
                    isCurrentPick ? 'text-ink' : isDisabled ? '' : 'text-ink'
                  }`}>
                    {team.name}
                  </span>
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

        {/* Remove Current Pick Card - shown when no team selected but user has current pick and round not locked */}
        {!selectedTeam && currentPick && !isRoundLocked && (
          <div className={`${PANEL} mt-5 p-5 text-center`}>
            {/* Body face, not font-data, even though a pick is entered content. This name is
                sitting directly under the same name in the fixture list above, and setting one
                string in two faces on one screen reads as a mistake. The list wins because it's
                the bigger block. See docs/design-system.md - the typewriter rule. */}
            <p className="text-[15px] text-ink">
              Your pick: <span className="font-semibold">{getFullTeamName(currentPick)}</span>
            </p>
            <p className="mt-1 text-[13px] text-ink-fade">
              Want to change your pick? Remove it first to select a different team.
            </p>
            <button
              onClick={handleUnselectPick}
              disabled={submitting}
              className={`${BTN_OUTLINE} mt-4 min-w-[140px] px-6 py-3`}
            >
              {submitting ? 'Removing…' : 'Remove pick'}
            </button>
          </div>
        )}

        {/* Help Section - only show when round not locked and no current pick */}
        {!isRoundLocked && !currentPick && (
          <div className={`${PANEL} mt-5 p-5`}>
            <p className={`${EYEBROW} text-center`}>How to make your pick</p>
            <ul className="mx-auto mt-3 max-w-sm space-y-1.5 text-[15px] text-ink-fade">
              <li>Tap any available team to select them.</li>
              <li>Confirm your selection before the round locks.</li>
              <li>Your team must win to advance — a draw or a loss eliminates you.</li>
            </ul>
          </div>
        )}
      </main>

      {/* Confirm Pick Modal - opens the instant a team is tapped, so a pick can't be
          half-made: last season players tapped a team and believed that was the
          pick, without noticing the round still needed a separate confirm. */}
      {selectedTeam && !isRoundLocked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
          <div className={`${PANEL} w-full max-w-sm p-6 text-center`}>
            <p className={EYEBROW}>Confirm your pick</p>
            <p className={`${HEADING} mt-2 text-2xl`}>{getFullTeamName(selectedTeam.teamShort)}</p>
            <p className={`${LABEL} mt-1 text-ink-fade`}>
              vs {getOpponentName(selectedTeam.fixtureId, selectedTeam.position)}
            </p>
            <p className="mt-3 text-[14px] text-ink-fade">
              You can change this before the round locks.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={() => setSelectedTeam(null)}
                disabled={submitting}
                className={`${BTN_OUTLINE} px-6 py-3 disabled:opacity-50`}
              >
                Cancel
              </button>
              <button
                onClick={submitPick}
                disabled={submitting}
                className={`${BTN_PRIMARY} min-w-[140px] px-6 py-3 text-base disabled:opacity-50`}
              >
                {submitting ? 'Confirming…' : 'Confirm pick'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}
