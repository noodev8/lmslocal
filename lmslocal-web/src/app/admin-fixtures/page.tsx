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

import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { teamApi, Team } from '@/lib/api';

// Define fixture type
interface Fixture {
  home_team_short: string;
  away_team_short: string;
}

export default function AdminFixturesPage() {
  // ========================================
  // STATE MANAGEMENT
  // ========================================
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [authError, setAuthError] = useState('');

  // Teams data from database
  const [teams, setTeams] = useState<Team[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [teamsError, setTeamsError] = useState('');

  // Fixture form state
  const [kickoffDate, setKickoffDate] = useState('');
  const [kickoffTime, setKickoffTime] = useState('15:00');
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [showCustomTime, setShowCustomTime] = useState(false);
  const [fixtures, setFixtures] = useState<Fixture[]>([
    { home_team_short: '', away_team_short: '' }
  ]);

  // Derive used teams from fixtures array (more robust than manual state tracking)
  const usedTeams = useMemo(() => {
    const used = new Set<string>();
    fixtures.forEach(fixture => {
      if (fixture.home_team_short) used.add(fixture.home_team_short);
      if (fixture.away_team_short) used.add(fixture.away_team_short);
    });
    return used;
  }, [fixtures]);

  // Calculate the next slot to fill (first incomplete fixture)
  const nextSlot = useMemo(() => {
    for (let i = 0; i < fixtures.length; i++) {
      const fixture = fixtures[i];
      if (!fixture.home_team_short) {
        return { index: i, side: 'home' as const };
      }
      if (!fixture.away_team_short) {
        return { index: i, side: 'away' as const };
      }
    }
    // All fixtures complete
    return { index: fixtures.length - 1, side: 'away' as const };
  }, [fixtures]);

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
  // DATE/TIME SHORTCUTS
  // ========================================
  // Helper function to get next occurrence of a day of week
  const getNextDayOfWeek = (dayOfWeek: number, weeksAhead: number = 0): Date => {
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sunday, 5 = Friday, 6 = Saturday

    let daysUntil = dayOfWeek - currentDay;

    // If the day has already passed this week, move to next week
    if (daysUntil < 0) {
      daysUntil += 7;
    }

    // Add additional weeks
    daysUntil += (weeksAhead * 7);

    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysUntil);
    return targetDate;
  };

  // Calculate date shortcuts
  const dateShortcuts = useMemo(() => {
    const shortcuts = [];

    // Next upcoming Fri, Sat, Sun (within next 7 days)
    const thisFri = getNextDayOfWeek(5, 0);
    const thisSat = getNextDayOfWeek(6, 0);
    const thisSun = getNextDayOfWeek(0, 0);

    shortcuts.push({
      label: `This Fri ${thisFri.getDate()} ${thisFri.toLocaleString('en-GB', { month: 'short' })}`,
      value: thisFri.toISOString().split('T')[0]
    });
    shortcuts.push({
      label: `This Sat ${thisSat.getDate()} ${thisSat.toLocaleString('en-GB', { month: 'short' })}`,
      value: thisSat.toISOString().split('T')[0]
    });
    shortcuts.push({
      label: `This Sun ${thisSun.getDate()} ${thisSun.toLocaleString('en-GB', { month: 'short' })}`,
      value: thisSun.toISOString().split('T')[0]
    });

    // Following week's Fri, Sat, Sun (1 week after first set)
    const nextFri = getNextDayOfWeek(5, 1);
    const nextSat = getNextDayOfWeek(6, 1);
    const nextSun = getNextDayOfWeek(0, 1);

    shortcuts.push({
      label: `Next Fri ${nextFri.getDate()} ${nextFri.toLocaleString('en-GB', { month: 'short' })}`,
      value: nextFri.toISOString().split('T')[0]
    });
    shortcuts.push({
      label: `Next Sat ${nextSat.getDate()} ${nextSat.toLocaleString('en-GB', { month: 'short' })}`,
      value: nextSat.toISOString().split('T')[0]
    });
    shortcuts.push({
      label: `Next Sun ${nextSun.getDate()} ${nextSun.toLocaleString('en-GB', { month: 'short' })}`,
      value: nextSun.toISOString().split('T')[0]
    });

    return shortcuts;
  }, []);

  // Time shortcuts
  const timeShortcuts = [
    { label: '12:30', subLabel: '12:30pm', value: '12:30' },
    { label: '14:00', subLabel: '2pm', value: '14:00' },
    { label: '15:00', subLabel: '3pm', value: '15:00' },
    { label: '17:00', subLabel: '5pm', value: '17:00' },
    { label: '19:30', subLabel: '7:30pm', value: '19:30' }
  ];

  // Format selected date/time for display
  const selectedDateTimeDisplay = useMemo(() => {
    if (!kickoffDate || !kickoffTime) return null;

    const date = new Date(kickoffDate + 'T00:00:00');
    const dayName = date.toLocaleDateString('en-GB', { weekday: 'long' });
    const dateStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    const [hours] = kickoffTime.split(':');
    const hour = parseInt(hours);
    const timeStr = hour === 12 ? '12pm' : hour > 12 ? `${hour - 12}pm` : hour === 0 ? '12am' : `${hour}am`;

    return `${dayName} ${dateStr} at ${timeStr}`;
  }, [kickoffDate, kickoffTime]);

  // ========================================
  // TIMEZONE CONVERSION HELPER
  // ========================================
  /**
   * Converts UK time (GMT/BST) to UTC
   * Handles both GMT (winter, UTC+0) and BST (summer, UTC+1) automatically
   *
   * @param dateString - Date in YYYY-MM-DD format
   * @param timeString - Time in HH:MM format (24-hour)
   * @returns ISO 8601 UTC timestamp string
   *
   * Examples:
   * - Input: '2025-07-15', '15:00' (3pm BST in summer)
   *   Output: '2025-07-15T14:00:00.000Z' (2pm UTC, since BST is UTC+1)
   *
   * - Input: '2025-01-15', '15:00' (3pm GMT in winter)
   *   Output: '2025-01-15T15:00:00.000Z' (3pm UTC, since GMT is UTC+0)
   */
  const convertUkTimeToUtc = (dateString: string, timeString: string): string => {
    // Parse components
    const [year, month, day] = dateString.split('-').map(Number);
    const [hours, minutes] = timeString.split(':').map(Number);

    // Format the input to see what time it would be in UK timezone
    // We create an arbitrary date, then format it to UK timezone to get a string
    // Then format the same moment to UTC to get another string
    // The difference tells us the offset
    const formatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/London',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    // Create a Date using UTC constructor with our input values
    // This represents the moment we want, but in UTC
    const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));

    // Now get what this UTC time would be in UK timezone
    const ukString = formatter.format(utcDate);

    // Parse the UK string back to get components
    const [ukDate, ukTime] = ukString.split(' ');
    const [ukYear, ukMonth, ukDay] = ukDate.split('-').map(Number);
    const [ukHours, ukMinutes, ukSeconds] = ukTime.split(':').map(Number);

    // Calculate the difference
    const ukTimestamp = Date.UTC(ukYear, ukMonth - 1, ukDay, ukHours, ukMinutes, ukSeconds);
    const utcTimestamp = utcDate.getTime();
    const offsetMs = ukTimestamp - utcTimestamp;

    // Now apply the reverse offset to our input to get the true UTC time
    // If UK time is 15:00 and it's BST (UTC+1), we want 14:00 UTC
    const targetUtcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
    const adjustedUtcDate = new Date(targetUtcDate.getTime() + offsetMs);

    return adjustedUtcDate.toISOString();
  };

  // ========================================
  // LOAD TEAMS FROM DATABASE
  // ========================================
  const loadTeams = async () => {
    setLoadingTeams(true);
    setTeamsError('');

    try {
      // Get teams for team_list_id = 1 (Premier League)
      const response = await teamApi.getTeams(1);

      if (response.data.return_code === 'SUCCESS') {
        setTeams(response.data.teams || []);
      } else {
        setTeamsError('Failed to load teams from database');
        const errorData = response.data as { message?: string };
        console.error('Failed to load teams:', errorData.message || 'Unknown error');
      }
    } catch (error) {
      console.error('Error loading teams:', error);
      setTeamsError('Network error - could not load teams');
    } finally {
      setLoadingTeams(false);
    }
  };

  // Load teams when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadTeams();
    }
  }, [isAuthenticated]);

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
      // Multiple fixtures: remove this one entirely
      setFixtures(fixtures.filter((_, i) => i !== index));
    } else {
      // Only one fixture: reset it to empty instead of removing
      setFixtures([{ home_team_short: '', away_team_short: '' }]);
    }
  };

  // Handle team click - always add to next incomplete slot
  const handleTeamClick = (teamCode: string) => {
    const updatedFixtures = [...fixtures];

    if (nextSlot.side === 'home') {
      updatedFixtures[nextSlot.index].home_team_short = teamCode;
    } else {
      updatedFixtures[nextSlot.index].away_team_short = teamCode;

      // If we just filled the away team and this is the last fixture, create a new one
      if (nextSlot.index === fixtures.length - 1) {
        updatedFixtures.push({ home_team_short: '', away_team_short: '' });
      }
    }

    setFixtures(updatedFixtures);
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

    // Convert UK time to UTC before storing in database
    // User enters time in UK timezone (GMT/BST), we store as UTC
    const kickoffDateTime = convertUkTimeToUtc(kickoffDate, kickoffTime);

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
            {/* Kickoff Date/Time Section */}
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">📅 Fixture Date & Time</h3>

              {/* Date Selection */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-700 mb-2">Date:</label>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {dateShortcuts.map((shortcut) => (
                    <button
                      key={shortcut.value}
                      type="button"
                      onClick={() => {
                        setKickoffDate(shortcut.value);
                        setShowCustomDate(false);
                      }}
                      className={`px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                        kickoffDate === shortcut.value
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {shortcut.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setShowCustomDate(!showCustomDate)}
                  className={`px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                    showCustomDate
                      ? 'bg-gray-700 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Custom date...
                </button>
                {showCustomDate && (
                  <input
                    type="date"
                    {...(kickoffDate && { value: kickoffDate })}
                    onChange={(e) => setKickoffDate(e.target.value)}
                    className="mt-2 px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 w-full"
                  />
                )}
              </div>

              {/* Time Selection */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-700 mb-2">Lock Time:</label>
                <div className="grid grid-cols-5 gap-2 mb-2">
                  {timeShortcuts.map((shortcut) => (
                    <button
                      key={shortcut.value}
                      type="button"
                      onClick={() => {
                        setKickoffTime(shortcut.value);
                        setShowCustomTime(false);
                      }}
                      className={`px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                        kickoffTime === shortcut.value
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div>{shortcut.label}</div>
                      <div className="text-[10px] opacity-75">{shortcut.subLabel}</div>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setShowCustomTime(!showCustomTime)}
                  className={`px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                    showCustomTime
                      ? 'bg-gray-700 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Custom time...
                </button>
                {showCustomTime && (
                  <input
                    type="time"
                    value={kickoffTime}
                    onChange={(e) => setKickoffTime(e.target.value)}
                    className="mt-2 px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>

              {/* Selected DateTime Display */}
              {selectedDateTimeDisplay && (
                <div className="mt-3 pt-3 border-t border-blue-300">
                  <div className="text-sm font-medium text-blue-900">
                    ✓ Selected: {selectedDateTimeDisplay}
                  </div>
                  <div className="text-xs text-blue-700 mt-1">
                    💡 UK time (GMT/BST) - converted to UTC for storage
                  </div>
                </div>
              )}
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
                          {nextSlot.side === 'home' ? 'HOME' : 'AWAY'}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 mb-3">
                      Click teams to add (alternates Home → Away)
                    </p>
                    {loadingTeams ? (
                      <div className="text-center py-8 text-gray-500">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mx-auto mb-2"></div>
                        <p className="text-sm">Loading teams...</p>
                      </div>
                    ) : teamsError ? (
                      <div className="text-center py-8">
                        <p className="text-sm text-red-600 mb-2">{teamsError}</p>
                        <button
                          type="button"
                          onClick={loadTeams}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                        >
                          Retry
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-2">
                        {teams.map((team) => {
                          const isUsed = usedTeams.has(team.short_name);
                          return (
                            <button
                              key={team.id}
                              type="button"
                              onClick={() => !isUsed && handleTeamClick(team.short_name)}
                              disabled={isUsed}
                              className={`px-3 py-2 rounded-md transition-colors font-bold text-sm ${
                                isUsed
                                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                  : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
                              }`}
                              title={team.name}
                            >
                              {team.short_name}
                            </button>
                          );
                        })}
                      </div>
                    )}
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
                      const isComplete = fixture.home_team_short && fixture.away_team_short;
                      const isNextSlot = index === nextSlot.index;
                      // Lookup team names from database teams
                      const homeTeam = teams.find(t => t.short_name === fixture.home_team_short);
                      const awayTeam = teams.find(t => t.short_name === fixture.away_team_short);
                      const homeTeamName = homeTeam ? homeTeam.name : fixture.home_team_short;
                      const awayTeamName = awayTeam ? awayTeam.name : fixture.away_team_short;

                      return (
                        <div
                          key={index}
                          className={`flex items-center gap-2 px-2 py-1 rounded transition-all text-xs ${
                            isComplete
                              ? 'bg-white border border-green-300'
                              : 'bg-white border border-gray-200'
                          }`}
                        >
                          <div className="flex-1 flex items-center justify-between">
                            <span className={`font-medium ${isNextSlot && nextSlot.side === 'home' ? 'text-blue-600' : 'text-gray-800'}`}>
                              {homeTeamName || 'Home'}
                            </span>
                            <span className="text-gray-400 mx-2">vs</span>
                            <span className={`font-medium ${isNextSlot && nextSlot.side === 'away' ? 'text-blue-600' : 'text-gray-800'}`}>
                              {awayTeamName || 'Away'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveFixture(index);
                            }}
                            className="px-1 text-red-500 hover:text-red-700 transition-colors font-bold"
                            title={fixtures.length === 1 ? "Clear fixture" : "Remove fixture"}
                          >
                            ×
                          </button>
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
