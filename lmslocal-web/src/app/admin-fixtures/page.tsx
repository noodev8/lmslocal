'use client';

/*
=======================================================================================================================================
Admin Fixtures Management Page
=======================================================================================================================================
Purpose: Secure admin-only page for adding fixtures to the fixture_load staging table
- Access code protection (hardcoded)
- No search engine indexing (noindex meta tag via layout)
- Quick UI for entering Premier League fixtures
- Auto-calculates next gameweek
- Single kickoff time for all fixtures in batch
=======================================================================================================================================
*/

import { useState } from 'react';
import axios from 'axios';

// Define fixture type
interface Fixture {
  home_team_short: string;
  away_team_short: string;
}

// Common Premier League team abbreviations
const PREMIER_LEAGUE_TEAMS = [
  'ARS', 'AVL', 'BOU', 'BRE', 'BHA', 'BUR', 'CHE', 'CRY', 'EVE', 'FUL',
  'LIV', 'LUT', 'MCI', 'MUN', 'NEW', 'NFO', 'SHU', 'TOT', 'WHU', 'WOL'
];

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

export default function AdminFixturesPage() {
  // ========================================
  // STATE MANAGEMENT
  // ========================================
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [authError, setAuthError] = useState('');

  // Fixture form state
  const [kickoffDate, setKickoffDate] = useState('');
  const [kickoffTime, setKickoffTime] = useState('15:00');
  const [fixtures, setFixtures] = useState<Fixture[]>([
    { home_team_short: '', away_team_short: '' }
  ]);

  // Track which fixture row is currently active and which side (home/away)
  const [activeFixtureIndex, setActiveFixtureIndex] = useState<number>(0);
  const [activeSide, setActiveSide] = useState<'home' | 'away'>('home');

  // Track which teams have been used in the current fixture set
  const [usedTeams, setUsedTeams] = useState<Set<string>>(new Set());

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Breadcrumb history - track successful submissions
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{
    gameweek: number;
    count: number;
    timestamp: string;
  }>>([]);

  // Push fixtures state
  const [isPushingFixtures, setIsPushingFixtures] = useState(false);
  const [pushFixturesMessage, setPushFixturesMessage] = useState('');

  // ========================================
  // AUTHENTICATION HANDLER
  // ========================================
  const handleAuthenticate = (e: React.FormEvent) => {
    e.preventDefault();

    // Simple client-side check (actual verification is server-side)
    if (accessCode.trim() === '') {
      setAuthError('Please enter an access code');
      return;
    }

    setIsAuthenticated(true);
    setAuthError('');
  };

  // ========================================
  // PUSH FIXTURES TO COMPETITIONS
  // ========================================
  const handlePushFixtures = async () => {
    // Confirm action
    if (!confirm('Push fixtures to competitions? This will create new rounds for eligible competitions.')) {
      return;
    }

    setIsPushingFixtures(true);
    setPushFixturesMessage('');

    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3015'}/admin/push-fixtures-to-competitions`,
        { bot_manage: 'BOT_MAGIC_2025' }
      );

      if (response.data.return_code === 'SUCCESS') {
        setPushFixturesMessage(
          `✓ ${response.data.message || 'Fixtures pushed successfully'} (${response.data.competitions_updated} competitions, ${response.data.fixtures_pushed} fixtures)`
        );
      } else if (response.data.return_code === 'NO_ACTIVE_FIXTURES') {
        setPushFixturesMessage('ℹ No fixtures available to push');
      } else if (response.data.return_code === 'NO_SUBSCRIBED_COMPETITIONS') {
        setPushFixturesMessage('ℹ No competitions subscribed to fixture service');
      } else {
        setPushFixturesMessage(`✗ ${response.data.message || 'Failed to push fixtures'}`);
      }
    } catch (error) {
      console.error('Error pushing fixtures:', error);
      setPushFixturesMessage('✗ Network error - could not push fixtures');
    } finally {
      setIsPushingFixtures(false);
    }
  };

  // ========================================
  // FIXTURE MANAGEMENT HANDLERS
  // ========================================

  // Note: handleAddFixture removed - fixtures auto-create when both teams selected

  // Remove fixture row
  const handleRemoveFixture = (index: number) => {
    if (fixtures.length > 1) {
      const removedFixture = fixtures[index];
      const newUsedTeams = new Set(usedTeams);

      // Remove teams from used set if they were in this fixture
      if (removedFixture.home_team_short) {
        newUsedTeams.delete(removedFixture.home_team_short);
      }
      if (removedFixture.away_team_short) {
        newUsedTeams.delete(removedFixture.away_team_short);
      }

      setFixtures(fixtures.filter((_, i) => i !== index));
      setUsedTeams(newUsedTeams);

      if (activeFixtureIndex >= fixtures.length - 1) {
        setActiveFixtureIndex(Math.max(0, fixtures.length - 2));
      }
    }
  };

  // Handle team click - alternate between home and away
  const handleTeamClick = (teamCode: string) => {
    const updatedFixtures = [...fixtures];
    const newUsedTeams = new Set(usedTeams);

    // Add team to used teams set
    newUsedTeams.add(teamCode);

    if (activeSide === 'home') {
      updatedFixtures[activeFixtureIndex].home_team_short = teamCode;
      setActiveSide('away'); // Switch to away team
    } else {
      updatedFixtures[activeFixtureIndex].away_team_short = teamCode;

      // Move to next fixture or create new one
      if (activeFixtureIndex < fixtures.length - 1) {
        setActiveFixtureIndex(activeFixtureIndex + 1);
        setActiveSide('home');
      } else {
        // Auto-create new fixture and move to it
        updatedFixtures.push({ home_team_short: '', away_team_short: '' });
        setActiveFixtureIndex(activeFixtureIndex + 1);
        setActiveSide('home');
      }
    }

    setFixtures(updatedFixtures);
    setUsedTeams(newUsedTeams);
  };

  // Handle fixture row click to make it active
  const handleFixtureRowClick = (index: number) => {
    setActiveFixtureIndex(index);

    // Determine which side should be active
    const fixture = fixtures[index];
    if (!fixture.home_team_short) {
      setActiveSide('home');
    } else if (!fixture.away_team_short) {
      setActiveSide('away');
    } else {
      setActiveSide('home'); // Both filled, default to home
    }
  };

  // ========================================
  // FORM SUBMISSION HANDLER
  // ========================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Reset previous error
    setSubmitError('');

    // Validate kickoff date and time
    if (!kickoffDate || !kickoffTime) {
      setSubmitError('Please select a kickoff date and time');
      return;
    }

    // Validate fixtures
    const validFixtures = fixtures.filter(
      f => f.home_team_short.trim() !== '' && f.away_team_short.trim() !== ''
    );

    if (validFixtures.length === 0) {
      setSubmitError('Please add at least one fixture with both home and away teams');
      return;
    }

    // Combine date and time into ISO 8601 format
    const kickoffDateTime = new Date(`${kickoffDate}T${kickoffTime}:00Z`).toISOString();

    try {
      setIsSubmitting(true);

      // Make API call
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3015'}/admin-add-fixtures`,
        {
          access_code: accessCode,
          kickoff_time: kickoffDateTime,
          fixtures: validFixtures
        }
      );

      // Check response
      if (response.data.return_code === 'SUCCESS') {
        // Add to breadcrumb history
        const newBreadcrumb = {
          gameweek: response.data.gameweek,
          count: response.data.fixtures_added,
          timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        };
        setBreadcrumbs(prev => [...prev, newBreadcrumb]);

        // Reset form after success
        setFixtures([{ home_team_short: '', away_team_short: '' }]);
        setKickoffDate('');
        setKickoffTime('15:00');
        setActiveFixtureIndex(0);
        setActiveSide('home');
        setUsedTeams(new Set());

      } else if (response.data.return_code === 'UNAUTHORIZED') {
        setSubmitError('Invalid access code - authentication failed');
        setIsAuthenticated(false);

      } else {
        setSubmitError(response.data.message || 'Failed to add fixtures');
      }

    } catch (error) {
      console.error('Error adding fixtures:', error);
      const err = error as { response?: { data?: { message?: string } } };
      setSubmitError(
        err.response?.data?.message ||
        'Network error - could not connect to server'
      );
    } finally {
      setIsSubmitting(false);
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
            Admin Fixtures
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
  // RENDER: FIXTURES FORM
  // ========================================
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
          {/* Header with Breadcrumb Trail */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-2xl font-bold text-gray-900">
                Add Fixtures to Staging
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
                  onClick={handlePushFixtures}
                  disabled={isPushingFixtures}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-sm"
                >
                  {isPushingFixtures ? 'Pushing...' : 'Push Fixtures'}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Premier League • Team List ID: 1
              </p>
              {pushFixturesMessage && (
                <p className={`text-sm font-medium ${
                  pushFixturesMessage.startsWith('✓')
                    ? 'text-green-600'
                    : pushFixturesMessage.startsWith('ℹ')
                    ? 'text-blue-600'
                    : 'text-red-600'
                }`}>
                  {pushFixturesMessage}
                </p>
              )}
            </div>
          </div>

          {/* Error Message - Inline */}
          {submitError && (
            <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {submitError}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            {/* Kickoff Date/Time Section - Compact */}
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700">Kickoff:</span>
                <input
                  type="date"
                  id="kickoffDate"
                  value={kickoffDate}
                  onChange={(e) => setKickoffDate(e.target.value)}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  required
                />
                <input
                  type="time"
                  id="kickoffTime"
                  value={kickoffTime}
                  onChange={(e) => setKickoffTime(e.target.value)}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  required
                />
                <span className="text-xs text-gray-500">(applied to all)</span>
              </div>
            </div>

            {/* Fixtures Section - Two Column Layout */}
            <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* LEFT COLUMN: Team Selection Buttons */}
              <div className="order-2 lg:order-1">
                <div className="sticky top-4">
                  <div className="p-4 bg-white rounded-md border-2 border-blue-200">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-lg font-semibold text-gray-900">
                        Select Teams
                      </h2>
                      <div className="text-sm text-gray-600">
                        <span className="font-semibold text-blue-600">
                          {activeSide === 'home' ? 'HOME' : 'AWAY'}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 mb-3">
                      Click teams to add (alternates Home → Away)
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {PREMIER_LEAGUE_TEAMS.map((team) => {
                        const isUsed = usedTeams.has(team);
                        return (
                          <button
                            key={team}
                            type="button"
                            onClick={() => !isUsed && handleTeamClick(team)}
                            disabled={isUsed}
                            className={`px-3 py-2 rounded-md transition-colors font-bold text-sm ${
                              isUsed
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
                            }`}
                          >
                            {team}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Fixtures List - Compact */}
              <div className="order-1 lg:order-2">
                <h2 className="text-sm font-semibold text-gray-900 mb-2">
                  Fixtures ({fixtures.filter(f => f.home_team_short && f.away_team_short).length})
                </h2>
                <div className="p-2 bg-gray-50 rounded-md border border-gray-300 max-h-[500px] overflow-y-auto">
                  <div className="space-y-1">
                    {fixtures.map((fixture, index) => {
                      const isActive = index === activeFixtureIndex;
                      const isComplete = fixture.home_team_short && fixture.away_team_short;
                      const homeTeamName = fixture.home_team_short ? TEAM_NAMES[fixture.home_team_short] || fixture.home_team_short : '';
                      const awayTeamName = fixture.away_team_short ? TEAM_NAMES[fixture.away_team_short] || fixture.away_team_short : '';

                      return (
                        <div
                          key={index}
                          onClick={() => handleFixtureRowClick(index)}
                          className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-all text-xs ${
                            isActive
                              ? 'bg-blue-100 border border-blue-500'
                              : isComplete
                              ? 'bg-white border border-green-300 hover:bg-green-50'
                              : 'bg-white border border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          <div className="flex-1 flex items-center justify-between">
                            <span className={`font-medium ${isActive && activeSide === 'home' ? 'text-blue-600' : 'text-gray-800'}`}>
                              {homeTeamName || 'Home'}
                            </span>
                            <span className="text-gray-400 mx-2">vs</span>
                            <span className={`font-medium ${isActive && activeSide === 'away' ? 'text-blue-600' : 'text-gray-800'}`}>
                              {awayTeamName || 'Away'}
                            </span>
                          </div>
                          {fixtures.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveFixture(index);
                              }}
                              className="px-1 text-red-500 hover:text-red-700 transition-colors font-bold"
                              title="Remove fixture"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {isSubmitting ? 'Adding Fixtures...' : 'Add Fixtures to Staging'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAuthenticated(false);
                  setAccessCode('');
                }}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-medium"
              >
                Logout
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
