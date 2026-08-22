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
        // Sorted here rather than trusted from the response: writing a result changed the order
        // rows came back in, so the list reshuffled under a reader watching the round come in.
        // Alphabetical by home team, matching the picks grid below - every fixture in a round
        // shares one kickoff time, so ordering on that decided nothing and left ties to chance.
        const ordered = [...(response.data.fixtures || [])].sort((a, b) =>
          a.home_team.localeCompare(b.home_team) || a.id - b.id
        );
        setFixtures(ordered);
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

            /* Everything left-aligned and set in reading order. This was two justify-between
               rows across a max-w-3xl panel, which pushed the teams to opposite edges and left
               "vs" floating at a different position on every row - it sat wherever the two name
               widths happened to leave a gap. Worse, the pick label was pinned to the right, so
               it appeared under the away team even when the home team was the one picked. It now
               names the team instead of relying on position.

               One line per fixture, not two. The status had a whole row of its own and mostly
               repeated the line above it: "Coventry won" under a bolded Coventry, "You picked
               Brentford" under Brentford. Four fixtures then filled a screen with four
               statements the reader had already read. What is left in the right-hand column is
               only what the teams cannot say themselves - whose stake it is, and whether a
               result has arrived at all. */
            /* Two things this got wrong, both fixed to match lib/presentation/pages/play/
               player_results_page.dart, which diverged deliberately and said why.

               "You're out" on a lost pick is untrue for anyone still holding a life - most
               players in most competitions. Andy T read "YOU'RE OUT" beside Hull v Man Utd
               while sitting active with one life spent. The row states the pick's outcome;
               what it cost is the lives panel's job.

               A draw was worse: it said "Draw — pick" in neutral ink and never mentioned
               losing. A draw IS a loss here - push-results-to-competition maps DRAW to LOSE -
               so a player whose pick drew was told nothing had happened to them. */
            const userDrewOwnPick = (userPickedHome || userPickedAway) && isDraw;
            const status = userPickedHome || userPickedAway
              ? isPending
                ? 'Pick'
                : userWon
                ? 'You won'
                : isDraw
                ? 'Draw — you lost'
                : 'You lost'
              : isPending
              ? 'Pending'
              : isDraw
              ? 'Draw'
              : '';

            // "Pick" and "Draw — you lost" name no team, so the fixture line has to.
            const markPick = isPending || isDraw;

            return (
              <div key={fixture.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 sm:px-5">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 font-data text-[15px]">
                  {/* The pick is underlined only while the outcome cannot point at it. Once the
                      fixture is settled, "You won" beside a bolded winner - or "You're out"
                      beside the faded loser - already says which team was theirs, and a third
                      mark saying it again is the repetition this row keeps attracting. */}
                  <span className={`${homeWon ? 'font-semibold text-moss' : awayWon ? 'text-ink-fade' : 'text-ink'} ${
                    userPickedHome && markPick ? 'underline decoration-2 underline-offset-4' : ''
                  }`}>
                    {fixture.home_team}
                  </span>
                  <span className={`${LABEL} text-ink-fade`}>vs</span>
                  <span className={`${awayWon ? 'font-semibold text-moss' : homeWon ? 'text-ink-fade' : 'text-ink'} ${
                    userPickedAway && markPick ? 'underline decoration-2 underline-offset-4' : ''
                  }`}>
                    {fixture.away_team}
                  </span>
                </div>
                {/* Empty on a settled fixture the reader had no stake in: the winner is already
                    bold and the beaten side already faded, which survives in greyscale, so a
                    word saying so again is the noise this row was carrying. */}
                {status && (
                  <p
                    className={`${LABEL} whitespace-nowrap ${
                      userWon
                        ? 'font-semibold text-moss'
                        : userLost || userDrewOwnPick
                        ? 'text-overprint'
                        : isPending
                        ? 'text-ink-fade'
                        : 'text-ink'
                    }`}
                  >
                    {status}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Who Picked What */}
        {Object.keys(teamPickCounts).length > 0 && (
          <div className={`${PANEL} p-5`}>
            <p className={`${EYEBROW} mb-3`}>Who picked what</p>
            {/* auto-rows-fr so every card is the height of the tallest. A team with no result yet
                carries two lines against a settled team's three, and left to itself the grid gave
                each row its own height - so an unplayed team on a row of its own came out squat
                and read as a lesser kind of card. */}
            <div className="grid auto-rows-fr grid-cols-2 gap-2.5 sm:grid-cols-3">
              {Object.entries(teamPickCounts)
                /* Alphabetical, and **nothing here may depend on the result.** This used to put
                   winners first, so a card jumped to the front of the grid the moment its result
                   was written and the whole grid reflowed under a reader watching the round come
                   in. Won and lost are already said on each card, in a word and a ground.

                   Alphabetical alone, not most-picked first: a count moves as picks arrive, so
                   sorting on it is only stable once every pick is in. A name never moves. */
                .sort(([teamA], [teamB]) => teamA.localeCompare(teamB))
                .map(([teamShort, count]) => {
                  const isCurrentPick = currentPick === teamShort;
                  const teamWon = fixtures.some(f => f.result === teamShort);
                  const teamLost = fixtures.some(f =>
                    (f.home_team_short === teamShort || f.away_team_short === teamShort) &&
                    f.result && f.result !== teamShort
                  );

                  return (
                    /* A winning team fills with moss-wash - the green as a ground, with ink text
                       on top. Filling with `moss` itself was a dark slab, and a hairline rule or
                       small moss text vanished, because #2F4B32 reads as black below about
                       20px. The light ground is the only treatment that is both green and
                       comfortable at card size.

                       The word "Won" stays. design-system.md §8 requires state to be doubled
                       rather than left to colour, so the card still says what it means in
                       greyscale. Beaten teams recede, and that is all: the strike-through went,
                       because "Lost" is already printed underneath and crossing the name out on
                       top of it is a third telling and a needlessly unkind one. Overprint is not
                       used either - every fixture has a loser, and red is the ink that means the
                       reader is out. */
                    <div
                      key={teamShort}
                      className={`relative border p-3 text-center ${
                        teamWon
                          ? 'border-moss bg-moss-wash'
                          : teamLost
                          ? 'border-ink/15 bg-stock'
                          : isCurrentPick
                          ? 'border-ink'
                          : 'border-ink/30'
                      }`}
                    >
                      {/* Corner badge rather than a "Your pick" line inside the card: the line
                          made one card taller than its neighbours and repeated a word the badge
                          says in the same space the pick screen uses for it. */}
                      {isCurrentPick && (
                        <span className={`${LABEL} absolute left-0 top-0 bg-moss px-1.5 py-0.5 text-[10px] text-stock-lit`}>
                          Pick
                        </span>
                      )}
                      {/* Short name. The full name wrapped to two lines on the longer clubs, so
                          cards in the same row disagreed about where their result line sat. */}
                      <p
                        className={`font-data text-[14px] ${
                          teamWon
                            ? 'font-semibold text-ink'
                            : teamLost
                            ? 'text-ink-fade'
                            : 'text-ink'
                        }`}
                      >
                        {teamShort}
                      </p>
                      {/* Always a word here, "Pending" included. A blank line held the height but
                          read as something missing rather than something not yet decided. */}
                      <p className={`${LABEL} mt-0.5 ${teamWon ? 'font-semibold text-moss' : 'text-ink-fade'}`}>
                        {teamWon ? 'Won' : teamLost ? 'Lost' : 'Pending'}
                      </p>
                      {/* Sentence case, not the LABEL caps. "1 PLAYER" shouted a number nobody
                          needs shouted, and set at label weight it competed with the result. */}
                      <p className="mt-1.5 text-[13px] text-ink-fade">
                        {count} {count === 1 ? 'Player' : 'Players'}
                      </p>
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
