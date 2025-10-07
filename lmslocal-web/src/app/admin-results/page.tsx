'use client';

/*
=======================================================================================================================================
Admin Results Page
=======================================================================================================================================
Purpose: Admin-only page for entering fixture results from fixture_load table
- Shows LOWEST gameweek with NULL scores
- Three-button interface: Home Win | Draw | Away Win
- Auto-saves on click, keeps fixtures visible for review
- Breadcrumb trail showing completion history
=======================================================================================================================================
*/

import { useState, useEffect } from 'react';
import axios from 'axios';

// Define fixture type
interface Fixture {
  fixture_id: number;
  home_team_short: string;
  away_team_short: string;
  kickoff_time: string;
  home_score: number | null;
  away_score: number | null;
  // Client-side tracking
  result_entered?: 'home_win' | 'away_win' | 'draw';
}

// Mapping of short codes to full team names
const TEAM_NAMES: Record<string, string> = {
  'ARS': 'Arsenal',
  'AVL': 'Aston Villa',
  'BOU': 'Bournemouth',
  'BRE': 'Brentford',
  'BHA': 'Brighton',
  'BUR': 'Burnley',
  'CHE': 'Chelsea',
  'CRY': 'Crystal Palace',
  'EVE': 'Everton',
  'FUL': 'Fulham',
  'LIV': 'Liverpool',
  'LUT': 'Luton Town',
  'MCI': 'Man City',
  'MUN': 'Man United',
  'NEW': 'Newcastle',
  'NFO': 'Nottingham Forest',
  'SHU': 'Sheffield United',
  'TOT': 'Tottenham',
  'WHU': 'West Ham',
  'WOL': 'Wolves'
};

export default function AdminResultsPage() {
  // ========================================
  // STATE MANAGEMENT
  // ========================================
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [authError, setAuthError] = useState('');

  // Results state
  const [gameweek, setGameweek] = useState<number | null>(null);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [totalFixtures, setTotalFixtures] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [allComplete, setAllComplete] = useState(false);

  // Breadcrumb history
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{
    gameweek: number;
    count: number;
    timestamp: string;
  }>>([]);

  // Push results state
  const [isPushingResults, setIsPushingResults] = useState(false);
  const [pushResultsMessage, setPushResultsMessage] = useState('');

  // ========================================
  // AUTHENTICATION HANDLER
  // ========================================
  const handleAuthenticate = (e: React.FormEvent) => {
    e.preventDefault();

    if (accessCode.trim() === '') {
      setAuthError('Please enter an access code');
      return;
    }

    setIsAuthenticated(true);
    setAuthError('');
  };

  // ========================================
  // FETCH FIXTURES NEEDING RESULTS
  // ========================================
  const fetchFixtures = async () => {
    setIsLoading(true);
    setLoadError('');

    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3015'}/admin-get-fixtures-for-results`,
        { access_code: accessCode }
      );

      if (response.data.return_code === 'SUCCESS') {
        if (response.data.fixtures.length === 0) {
          // All fixtures have results
          setAllComplete(true);
          setGameweek(null);
          setFixtures([]);
          setTotalFixtures(0);
        } else {
          setGameweek(response.data.gameweek);
          setFixtures(response.data.fixtures);
          setTotalFixtures(response.data.total_fixtures);
          setAllComplete(false);
        }
      } else if (response.data.return_code === 'UNAUTHORIZED') {
        setLoadError('Invalid access code');
        setIsAuthenticated(false);
      } else {
        setLoadError(response.data.message || 'Failed to load fixtures');
      }
    } catch (error) {
      console.error('Error fetching fixtures:', error);
      const err = error as { response?: { data?: { message?: string } } };
      setLoadError(
        err.response?.data?.message || 'Network error - could not connect to server'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Load fixtures on authentication
  useEffect(() => {
    if (isAuthenticated) {
      fetchFixtures();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // ========================================
  // PUSH RESULTS TO COMPETITIONS
  // ========================================
  const handlePushResults = async () => {
    // Confirm action
    if (!confirm('Push all unpushed results to competitions? This will process eliminations and update standings.')) {
      return;
    }

    setIsPushingResults(true);
    setPushResultsMessage('');

    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3015'}/admin/push-results-to-competitions`,
        { bot_manage: 'BOT_MAGIC_2025' }
      );

      if (response.data.return_code === 'SUCCESS') {
        setPushResultsMessage(
          `✓ ${response.data.message || 'Results pushed successfully'}`
        );
      } else if (response.data.return_code === 'NO_RESULTS_TO_PUSH') {
        setPushResultsMessage('ℹ No results to push');
      } else {
        setPushResultsMessage(`✗ ${response.data.message || 'Failed to push results'}`);
      }
    } catch (error) {
      console.error('Error pushing results:', error);
      setPushResultsMessage('✗ Network error - could not push results');
    } finally {
      setIsPushingResults(false);
    }
  };

  // ========================================
  // HANDLE RESULT BUTTON CLICK
  // ========================================
  const handleResultClick = async (fixture: Fixture, result: 'home_win' | 'away_win' | 'draw') => {
    try {
      // Immediately update UI (optimistic update)
      setFixtures(prevFixtures =>
        prevFixtures.map(f =>
          f.fixture_id === fixture.fixture_id
            ? { ...f, result_entered: result }
            : f
        )
      );

      // Save to backend
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3015'}/admin-set-result`,
        {
          access_code: accessCode,
          fixture_id: fixture.fixture_id,
          result: result
        }
      );

      if (response.data.return_code !== 'SUCCESS') {
        // Revert on error
        setFixtures(prevFixtures =>
          prevFixtures.map(f =>
            f.fixture_id === fixture.fixture_id
              ? { ...f, result_entered: undefined }
              : f
          )
        );
        alert(`Error: ${response.data.message || 'Failed to save result'}`);
      } else {
        // Check if all fixtures in gameweek are complete
        const updatedFixtures = fixtures.map(f =>
          f.fixture_id === fixture.fixture_id ? { ...f, result_entered: result } : f
        );
        const allEntered = updatedFixtures.every(f => f.result_entered);

        if (allEntered && gameweek) {
          // Add to breadcrumb
          const newBreadcrumb = {
            gameweek: gameweek,
            count: totalFixtures,
            timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
          };
          setBreadcrumbs(prev => [...prev, newBreadcrumb]);
          setAllComplete(true);
        }
      }
    } catch (error) {
      console.error('Error setting result:', error);
      // Revert optimistic update
      setFixtures(prevFixtures =>
        prevFixtures.map(f =>
          f.fixture_id === fixture.fixture_id
            ? { ...f, result_entered: undefined }
            : f
        )
      );
      alert('Network error - could not save result');
    }
  };

  // ========================================
  // RENDER: ACCESS CODE SCREEN
  // ========================================
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Admin Results
          </h1>
          <p className="text-gray-600 mb-6">
            Enter access code to continue
          </p>

          <form onSubmit={handleAuthenticate}>
            <div className="mb-4">
              <label htmlFor="accessCode" className="block text-sm font-medium text-gray-700 mb-2">
                Access Code
              </label>
              <input
                type="password"
                id="accessCode"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                placeholder="Enter code"
                autoComplete="off"
              />
              {authError && (
                <p className="mt-2 text-sm text-red-600">{authError}</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium"
            >
              Authenticate
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ========================================
  // RENDER: RESULTS ENTRY SCREEN
  // ========================================
  const remainingCount = fixtures.filter(f => !f.result_entered).length;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
          {/* Header with Breadcrumb Trail */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-2xl font-bold text-gray-900">
                Enter Results
              </h1>
              <div className="flex items-center gap-3">
                {breadcrumbs.length > 0 && (
                  <div className="text-xs text-gray-500">
                    {breadcrumbs.map((bc, idx) => (
                      <span key={idx} className="inline-flex items-center">
                        {idx > 0 && <span className="mx-1">→</span>}
                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded">
                          GW{bc.gameweek} ({bc.count}) {bc.timestamp}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handlePushResults}
                  disabled={isPushingResults}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-sm"
                >
                  {isPushingResults ? 'Pushing...' : 'Push Results'}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Premier League • Team List ID: 1
              </p>
              {pushResultsMessage && (
                <p className={`text-sm font-medium ${
                  pushResultsMessage.startsWith('✓')
                    ? 'text-green-600'
                    : pushResultsMessage.startsWith('ℹ')
                    ? 'text-blue-600'
                    : 'text-red-600'
                }`}>
                  {pushResultsMessage}
                </p>
              )}
            </div>
          </div>

          {/* Error Message */}
          {loadError && (
            <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {loadError}
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-8">
              <p className="text-gray-600">Loading fixtures...</p>
            </div>
          )}

          {/* All Complete Message */}
          {!isLoading && allComplete && (
            <div className="text-center py-8">
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <h2 className="text-xl font-bold text-green-800 mb-2">
                  ✓ Gameweek {gameweek} Complete!
                </h2>
                <p className="text-green-700">
                  All results entered for this gameweek
                </p>
              </div>
              <button
                onClick={() => {
                  setIsAuthenticated(false);
                  setAccessCode('');
                }}
                className="mt-4 px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-medium"
              >
                Logout
              </button>
            </div>
          )}

          {/* Fixtures List */}
          {!isLoading && !allComplete && fixtures.length > 0 && gameweek && (
            <>
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Gameweek {gameweek} - Enter Results
                  </h2>
                  <span className="text-sm text-gray-600">
                    {remainingCount} of {totalFixtures} remaining
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                {fixtures.map((fixture) => {
                  const homeTeamName = TEAM_NAMES[fixture.home_team_short] || fixture.home_team_short;
                  const awayTeamName = TEAM_NAMES[fixture.away_team_short] || fixture.away_team_short;
                  const resultEntered = fixture.result_entered;

                  return (
                    <div
                      key={fixture.fixture_id}
                      className={`p-4 rounded-md border-2 transition-colors ${
                        resultEntered
                          ? 'bg-green-50 border-green-300'
                          : 'bg-white border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="font-medium text-gray-900">
                          {homeTeamName} <span className="text-gray-400 mx-2">vs</span> {awayTeamName}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(fixture.kickoff_time).toLocaleDateString('en-GB')}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleResultClick(fixture, 'home_win')}
                          disabled={!!resultEntered}
                          className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                            resultEntered === 'home_win'
                              ? 'bg-green-600 text-white'
                              : resultEntered
                              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                        >
                          {homeTeamName} Win
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResultClick(fixture, 'draw')}
                          disabled={!!resultEntered}
                          className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                            resultEntered === 'draw'
                              ? 'bg-green-600 text-white'
                              : resultEntered
                              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              : 'bg-gray-600 text-white hover:bg-gray-700'
                          }`}
                        >
                          Draw
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResultClick(fixture, 'away_win')}
                          disabled={!!resultEntered}
                          className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                            resultEntered === 'away_win'
                              ? 'bg-green-600 text-white'
                              : resultEntered
                              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              : 'bg-red-600 text-white hover:bg-red-700'
                          }`}
                        >
                          {awayTeamName} Win
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 flex justify-center">
                <button
                  onClick={() => {
                    setIsAuthenticated(false);
                    setAccessCode('');
                  }}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-medium"
                >
                  Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
