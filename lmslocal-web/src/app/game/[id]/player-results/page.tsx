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

  if (loading || contextLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200 shadow-sm">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <Link href={`/game/${competitionId}`} className="flex items-center space-x-2 text-slate-600 hover:text-slate-800 transition-colors">
                  <ArrowLeftIcon className="h-5 w-5" />
                  <span className="font-medium">Back</span>
                </Link>
                <div className="h-6 w-px bg-slate-300" />
                <div>
                  <h1 className="text-lg font-semibold text-slate-900">Round Results</h1>
                  <p className="text-sm text-slate-600">Loading round...</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
            <div className="flex items-center justify-center">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-50 rounded-full mb-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-600 border-t-transparent"></div>
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">Loading Results</h3>
                <p className="text-slate-500">Please wait while we load the round results...</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link href={`/game/${competitionId}`} className="flex items-center space-x-2 text-slate-600 hover:text-slate-800 transition-colors">
                <ArrowLeftIcon className="h-5 w-5" />
                <span className="font-medium">Dashboard</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Eliminated Banner */}
        {competition?.is_participant && competition?.user_status && competition.user_status !== 'active' && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <p className="text-red-700 font-medium">You&apos;ve been eliminated from this competition</p>
          </div>
        )}

        {/* Round Information */}
        {currentRound && (
          <div className="mb-6">
            <div className="font-semibold text-lg text-slate-800">
              Round {currentRound.round_number} - Results
            </div>
          </div>
        )}

        {/* Enhanced Pick Analysis - Main Focus */}
        <div className="mb-6 bg-white rounded-xl border border-slate-200 shadow-sm p-6">



          {/* All Teams Pick Distribution */}
          {Object.keys(teamPickCounts).length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(teamPickCounts)
                .sort(([teamA, countA], [teamB, countB]) => {
                  // First sort by win/lose status, then by pick count
                  const teamAWon = fixtures.some(f => f.result === teamA);
                  const teamBWon = fixtures.some(f => f.result === teamB);

                  if (teamAWon && !teamBWon) return -1;
                  if (!teamAWon && teamBWon) return 1;

                  return countB - countA; // Then by count descending
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
                      className={`p-4 rounded-lg border-2 text-center transition-all ${
                        teamWon
                          ? 'bg-green-50 border-green-300 text-green-900'
                          : teamLost
                          ? 'bg-red-50 border-red-300 text-red-900'
                          : isCurrentPick
                          ? 'bg-blue-50 border-blue-300 text-blue-900'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      {/* Win/Lose indicator */}
                      <div className="flex justify-center mb-2">
                        {teamWon && <span className="text-green-600 font-bold">✓</span>}
                        {teamLost && <span className="text-red-600 font-bold">✗</span>}
                        {!teamWon && !teamLost && <span className="text-slate-400">-</span>}
                      </div>

                      {/* Team name */}
                      <div className="font-bold text-sm mb-2">
                        {teamName}
                      </div>

                      {/* Pick count */}
                      <div className="text-xs">
                        <div className="font-semibold">
                          {count} player{count !== 1 ? 's' : ''}
                        </div>
                        {isCurrentPick && (
                          <div className="font-medium mt-1">
                            (Your pick)
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Compact Match Results */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-900">Match Results</h3>
            {!currentPick && (
              <div className="text-xs text-amber-700 bg-amber-100 px-2 py-1 rounded">
                No pick made
              </div>
            )}
          </div>
          <div className="space-y-2">
            {fixtures.map((fixture) => {
              const homeWon = fixture.result === fixture.home_team_short;
              const awayWon = fixture.result === fixture.away_team_short;
              const isPending = !fixture.result;
              const userPickedHome = currentPick === fixture.home_team_short;
              const userPickedAway = currentPick === fixture.away_team_short;

              return (
                <div key={fixture.id} className="flex items-center justify-between py-2 text-sm">
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    {/* Your pick indicator */}
                    {(userPickedHome || userPickedAway) && (
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        (userPickedHome && homeWon) || (userPickedAway && awayWon)
                          ? 'bg-green-500'
                          : (userPickedHome && awayWon) || (userPickedAway && homeWon)
                          ? 'bg-red-500'
                          : 'bg-blue-500'
                      }`}></div>
                    )}

                    {/* Match text */}
                    <span className={`truncate ${
                      homeWon ? 'font-semibold text-green-700' : awayWon ? 'text-slate-600' : 'text-slate-700'
                    }`}>
                      {fixture.home_team}
                    </span>
                    <span className="text-slate-500 flex-shrink-0">vs</span>
                    <span className={`truncate ${
                      awayWon ? 'font-semibold text-green-700' : homeWon ? 'text-slate-600' : 'text-slate-700'
                    }`}>
                      {fixture.away_team}
                    </span>
                  </div>

                  {/* Result indicator */}
                  <div className="text-xs text-slate-500 flex-shrink-0 ml-2">
                    {isPending ? 'Pending' :
                     homeWon ? `${fixture.home_team_short} won` :
                     awayWon ? `${fixture.away_team_short} won` : 'Draw'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}