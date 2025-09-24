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

        // Check if round is locked - this page is only for locked rounds
        const now = new Date();
        const lockTime = new Date(latestRound.lock_time || '');
        const locked = !!(latestRound.lock_time && now >= lockTime);

        // If round is not locked, redirect back to pick page
        if (!locked) {
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
              <div className="h-6 w-px bg-slate-300" />
              <div>
                <h1 className="text-lg font-semibold text-slate-900">Results</h1>
                {currentRound && (
                  <p className="text-sm text-slate-600">
                    Round {currentRound.round_number}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Round Information */}
        {currentRound && (
          <div className="mb-6">
            <div className="font-semibold text-lg text-slate-800">
              Round {currentRound.round_number} - Results
            </div>
          </div>
        )}

        {/* Match Results */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="mb-6 text-center">
            <h2 className="text-xl font-bold text-slate-900">
              Match Results
            </h2>
          </div>

          <div className="space-y-6">
            {fixtures.map((fixture) => (
              <div key={fixture.id} className="border-b border-slate-100 last:border-b-0 pb-6 last:pb-0">
                {/* Team Cards with VS between them */}
                <div className="flex items-center gap-4">
                  {/* Home Team */}
                  {(() => {
                    const isCurrentPick = currentPick === fixture.home_team_short;
                    const fixtureResult = fixture.result;

                    // Determine game result: WIN = player advances, LOSE = player eliminated
                    let teamResult: 'win' | 'lose' | null = null;
                    if (fixtureResult) {
                      if (fixtureResult === fixture.home_team_short) {
                        teamResult = 'win'; // Team won = Player advances
                      } else {
                        teamResult = 'lose'; // Team lost or drew = Player eliminated
                      }
                    }

                    return (
                      <div
                        key={fixture.home_team_short}
                        className={`relative flex-1 p-4 rounded-lg border-2 ${
                          teamResult === 'win'
                            ? 'bg-green-600 border-slate-800 shadow-md text-white'
                            : teamResult === 'lose'
                            ? 'bg-red-600 border-slate-800 shadow-md text-white'
                            : isCurrentPick
                            ? 'bg-white border-blue-500 shadow-md'
                            : 'bg-white border-slate-300'
                        }`}
                      >
                        {/* Current pick indicator */}
                        {isCurrentPick && (
                          <div className="absolute -top-2 -left-2 bg-slate-600 text-white text-xs rounded-full px-2 py-1 font-bold shadow-md">
                            PICK
                          </div>
                        )}

                        {/* Player count badge */}
                        {teamPickCounts[fixture.home_team_short] && (
                          <div className="absolute -top-2 -right-2 bg-slate-600 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center shadow-lg">
                            {teamPickCounts[fixture.home_team_short]}
                          </div>
                        )}

                        <div className="text-center">
                          <div className={`text-lg font-bold ${
                            teamResult === 'win' || teamResult === 'lose' ? 'text-white' : 'text-black'
                          }`}>
                            {fixture.home_team}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* VS Separator */}
                  <div className="flex-shrink-0 px-2">
                    <div className="text-2xl font-bold text-slate-600">
                      VS
                    </div>
                  </div>

                  {/* Away Team */}
                  {(() => {
                    const isCurrentPick = currentPick === fixture.away_team_short;
                    const fixtureResult = fixture.result;

                    // Determine game result: WIN = player advances, LOSE = player eliminated
                    let teamResult: 'win' | 'lose' | null = null;
                    if (fixtureResult) {
                      if (fixtureResult === fixture.away_team_short) {
                        teamResult = 'win'; // Team won = Player advances
                      } else {
                        teamResult = 'lose'; // Team lost or drew = Player eliminated
                      }
                    }

                    return (
                      <div
                        key={fixture.away_team_short}
                        className={`relative flex-1 p-4 rounded-lg border-2 ${
                          teamResult === 'win'
                            ? 'bg-green-600 border-slate-800 shadow-md text-white'
                            : teamResult === 'lose'
                            ? 'bg-red-600 border-slate-800 shadow-md text-white'
                            : isCurrentPick
                            ? 'bg-white border-blue-500 shadow-md'
                            : 'bg-white border-slate-300'
                        }`}
                      >
                        {/* Current pick indicator */}
                        {isCurrentPick && (
                          <div className="absolute -top-2 -left-2 bg-slate-600 text-white text-xs rounded-full px-2 py-1 font-bold shadow-md">
                            PICK
                          </div>
                        )}

                        {/* Player count badge */}
                        {teamPickCounts[fixture.away_team_short] && (
                          <div className="absolute -top-2 -right-2 bg-slate-600 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center shadow-lg">
                            {teamPickCounts[fixture.away_team_short]}
                          </div>
                        )}

                        <div className="text-center">
                          <div className={`text-lg font-bold ${
                            teamResult === 'win' || teamResult === 'lose' ? 'text-white' : 'text-black'
                          }`}>
                            {fixture.away_team}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* No Pick Indicator */}
        {!currentPick && (
          <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="text-center">
              <div className="text-amber-800 font-medium">
                NO PICK - You did not make a selection for this round
              </div>
            </div>
          </div>
        )}

        {/* Statistics Section */}
        {Object.keys(teamPickCounts).length > 0 && (
          <div className="mt-6 bg-slate-50 rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 text-center">
              Player Pick Statistics
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {Object.entries(teamPickCounts)
                .sort(([,a], [,b]) => b - a) // Sort by pick count descending
                .map(([teamShort, count]) => {
                  const teamName = getFullTeamName(teamShort);
                  const isCurrentPick = currentPick === teamShort;

                  return (
                    <div
                      key={teamShort}
                      className={`p-3 rounded-lg border text-center ${
                        isCurrentPick
                          ? 'bg-blue-100 border-blue-300'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className={`font-bold text-sm ${
                        isCurrentPick ? 'text-blue-900' : 'text-slate-900'
                      }`}>
                        {teamName}
                      </div>
                      <div className={`text-xs mt-1 ${
                        isCurrentPick ? 'text-blue-700' : 'text-slate-600'
                      }`}>
                        {count} player{count !== 1 ? 's' : ''}
                        {isCurrentPick && ' (Your pick)'}
                      </div>
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