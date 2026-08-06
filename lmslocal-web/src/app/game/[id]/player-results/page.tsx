'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon
} from '@heroicons/react/24/outline';
import { roundApi, fixtureApi, playerActionApi } from '@/lib/api';
import { withCache } from '@/lib/cache';
import { useAppData } from '@/contexts/AppDataContext';
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

interface Round {
  id: number;
  round_number: number;
}

export default function PlayerResultsPage() {
  const router = useRouter();
  const params = useParams();
  const competitionId = params.id as string;

  // Use AppDataProvider context for competitions data
  const { competitions, loading: contextLoading } = useAppData();

  // Find the specific competition
  const competition = competitions?.find(c => c.id.toString() === competitionId);

  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPick, setCurrentPick] = useState<string | null>(null);
  const [teamPickCounts, setTeamPickCounts] = useState<Record<string, number>>({});

  const hasInitialized = useRef(false);

  const loadFixtures = useCallback(async (roundId: number) => {
    try {
      const response = await fixtureApi.get(roundId.toString());
      if (response.data.return_code === 'SUCCESS') {
        setFixtures(response.data.fixtures || []);
      }
    } catch (error) {
      console.error('Failed to load fixtures:', error);
    }
  }, []);

  const loadCurrentPick = useCallback(async (roundId: number) => {
    try {
      const response = await withCache(
        `current-pick-${roundId}-${competitionId}`,
        60 * 60 * 1000, // 1 hour cache
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

  const loadTeamPickCounts = useCallback(async (roundId: number) => {
    try {
      const response = await withCache(
        `pick-counts-${roundId}`,
        60 * 60 * 1000, // 1 hour cache
        () => fixtureApi.getPickCounts(roundId)
      );
      if (response.data.return_code === 'SUCCESS') {
        setTeamPickCounts(response.data.pick_counts || {});
      }
    } catch (error) {
      console.error('Failed to load team pick counts:', error);
    }
  }, []);

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

        // Get current round
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

        const latestRound = roundsData[0];

        // Check if round has fixtures
        if (latestRound.fixture_count === 0) {
          router.push(`/game/${competitionId}/waiting`);
          return;
        }

        // Check if round is locked
        const now = new Date();
        const lockTime = new Date(latestRound.lock_time || '');
        const locked = !!(latestRound.lock_time && now >= lockTime);

        // Check if user is an eliminated participant
        const isEliminatedParticipant = competition.is_participant &&
          competition.user_status &&
          competition.user_status !== 'active';

        // If round is not locked AND user is not eliminated, redirect to pick page
        // Eliminated participants should stay on results page (they can't pick anyway)
        if (!locked && !isEliminatedParticipant) {
          router.push(`/game/${competitionId}/pick`);
          return;
        }

        setCurrentRound(latestRound);

        // Load data for current locked round
        await Promise.all([
          loadFixtures(latestRound.id),
          loadCurrentPick(latestRound.id),
          loadTeamPickCounts(latestRound.id)
        ]);

      } catch (error) {
        console.error('Failed to load results data:', error);
        router.push(`/game/${competitionId}`);
      } finally {
        setLoading(false);
      }
    };

    initializeData();
  }, [competitionId, router, competition, contextLoading, loadFixtures, loadCurrentPick, loadTeamPickCounts]);

  const getFullTeamName = (shortName: string) => {
    const fixture = fixtures.find(f =>
      f.home_team_short === shortName || f.away_team_short === shortName
    );
    if (fixture) {
      return fixture.home_team_short === shortName ? fixture.home_team : fixture.away_team;
    }
    return shortName;
  };

  const isEliminated = !!(competition?.is_participant && competition?.user_status && competition.user_status !== 'active');

  if (loading || contextLoading) {
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
            <p className="mt-2 text-[17px] text-ink-fade">Fetching this round&apos;s results&hellip;</p>
          </div>
        </main>
      </div>
    );
  }

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

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-8 sm:px-6 sm:py-10">

        {/* Elimination is the single most important fact for this user, so it leads the page */}
        {isEliminated && (
          <div className={`${PANEL} border-overprint p-6 text-center`}>
            <p className={EYEBROW}>Result</p>
            <p className={`${HEADING} mt-1 text-2xl text-overprint`}>You&apos;ve been eliminated</p>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className={EYEBROW}>Results</p>
            {currentRound && <h1 className={`${HEADING} mt-1 text-3xl`}>Round {currentRound.round_number}</h1>}
          </div>
          {!currentPick && (
            <span className={`${LABEL} border border-overprint px-2 py-1 text-overprint`}>No pick made</span>
          )}
        </div>

        {/* Match Ledger */}
        <div className={`${PANEL} divide-y divide-ink/30`}>
          {fixtures.map((fixture) => {
            const homeWon = fixture.result === fixture.home_team_short;
            const awayWon = fixture.result === fixture.away_team_short;
            const isPending = !fixture.result;
            const isDraw = !isPending && !homeWon && !awayWon;
            const userPickedHome = currentPick === fixture.home_team_short;
            const userPickedAway = currentPick === fixture.away_team_short;
            const userWon = (userPickedHome && homeWon) || (userPickedAway && awayWon);
            const userLost = (userPickedHome && awayWon) || (userPickedAway && homeWon);

            const pickedTeam = userPickedHome ? fixture.home_team : fixture.away_team;

            /* Everything left-aligned and set in reading order. This was two justify-between
               rows across a max-w-3xl panel, which pushed the teams to opposite edges and left
               "vs" floating at a different position on every row - it sat wherever the two name
               widths happened to leave a gap. Worse, the pick label was pinned to the right, so
               it appeared under the away team even when the home team was the one picked. It now
               names the team instead of relying on position. */
            return (
              <div key={fixture.id} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 font-data text-[15px]">
                  <span className={homeWon ? 'font-semibold text-moss' : awayWon ? 'text-ink-fade' : 'text-ink'}>
                    {fixture.home_team}
                  </span>
                  <span className={`${LABEL} text-ink-fade`}>vs</span>
                  <span className={awayWon ? 'font-semibold text-moss' : homeWon ? 'text-ink-fade' : 'text-ink'}>
                    {fixture.away_team}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className={`${LABEL} text-ink-fade`}>
                    {isPending ? 'Pending' : isDraw ? 'Draw' : homeWon ? `${fixture.home_team_short} won` : `${fixture.away_team_short} won`}
                  </span>
                  {(userPickedHome || userPickedAway) && (
                    <>
                      <span className="text-ink-fade/60" aria-hidden="true">&middot;</span>
                      <span className={`${LABEL} ${userWon ? 'text-moss' : userLost ? 'text-overprint' : 'text-ink-fade'}`}>
                        {userWon
                          ? `You picked ${pickedTeam} — won`
                          : userLost
                          ? `You picked ${pickedTeam} — out`
                          : `You picked ${pickedTeam}`}
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Who Picked What */}
        {Object.keys(teamPickCounts).length > 0 && (
          <div className={`${PANEL} p-5`}>
            <p className={`${EYEBROW} mb-3`}>Who picked what</p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {Object.entries(teamPickCounts)
                .sort(([teamA, countA], [teamB, countB]) => {
                  const teamAWon = fixtures.some(f => f.result === teamA);
                  const teamBWon = fixtures.some(f => f.result === teamB);
                  if (teamAWon && !teamBWon) return -1;
                  if (!teamAWon && teamBWon) return 1;
                  return countB - countA;
                })
                .map(([teamShort, count]) => {
                  const teamName = getFullTeamName(teamShort);
                  const isCurrentPick = currentPick === teamShort;
                  const teamWon = fixtures.some(f => f.result === teamShort);
                  const teamLost = fixtures.some(f =>
                    (f.home_team_short === teamShort || f.away_team_short === teamShort) &&
                    f.result && f.result !== teamShort
                  );

                  return (
                    <div
                      key={teamShort}
                      className={`border p-3 text-center ${
                        teamWon
                          ? 'border-moss bg-moss/10'
                          : teamLost
                          ? 'border-overprint/40 bg-stock'
                          : isCurrentPick
                          ? 'border-ink'
                          : 'border-ink/30'
                      }`}
                    >
                      <p className={`font-data text-[14px] ${teamWon ? 'font-semibold text-moss' : teamLost ? 'text-ink-fade' : 'text-ink'}`}>
                        {teamName}
                      </p>
                      <p className={`${LABEL} mt-1.5 text-ink-fade`}>
                        {count} player{count !== 1 ? 's' : ''}
                      </p>
                      {isCurrentPick && <p className={`${LABEL} mt-0.5 text-ink`}>Your pick</p>}
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
