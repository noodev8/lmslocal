'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { organizerApi, teamApi, OrganizerFixture, Team } from '@/lib/api';
import { useAppData } from '@/contexts/AppDataContext';
import { cacheUtils } from '@/lib/cache';

export default function OrganizerFixturesPage() {
  const router = useRouter();
  const params = useParams();
  const competitionId = params.id as string;

  // Get competition from context
  const { competitions } = useAppData();
  const competition = useMemo(() => {
    return competitions?.find(c => c.id.toString() === competitionId);
  }, [competitions, competitionId]);

  // Teams state (loaded from database)
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);

  // Fixture form state
  const [kickoffDate, setKickoffDate] = useState('');
  const [kickoffTime, setKickoffTime] = useState('19:30');
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [showCustomTime, setShowCustomTime] = useState(false);
  const [fixtures, setFixtures] = useState<OrganizerFixture[]>([
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
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Block state
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);

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

    // Next upcoming Fri, Sat, Tue (within next 7 days)
    const thisFri = getNextDayOfWeek(5, 0);
    const thisSat = getNextDayOfWeek(6, 0);
    const thisTue = getNextDayOfWeek(2, 0);

    shortcuts.push({
      label: `This Fri ${thisFri.getDate()} ${thisFri.toLocaleString('en-GB', { month: 'short' })}`,
      value: thisFri.toISOString().split('T')[0],
      isCurrent: true
    });
    shortcuts.push({
      label: `This Sat ${thisSat.getDate()} ${thisSat.toLocaleString('en-GB', { month: 'short' })}`,
      value: thisSat.toISOString().split('T')[0],
      isCurrent: true
    });
    shortcuts.push({
      label: `This Tue ${thisTue.getDate()} ${thisTue.toLocaleString('en-GB', { month: 'short' })}`,
      value: thisTue.toISOString().split('T')[0],
      isCurrent: true
    });

    // Following week's Fri, Sat, Tue (1 week after first set)
    const nextFri = getNextDayOfWeek(5, 1);
    const nextSat = getNextDayOfWeek(6, 1);
    const nextTue = getNextDayOfWeek(2, 1);

    shortcuts.push({
      label: `Next Fri ${nextFri.getDate()} ${nextFri.toLocaleString('en-GB', { month: 'short' })}`,
      value: nextFri.toISOString().split('T')[0],
      isCurrent: false
    });
    shortcuts.push({
      label: `Next Sat ${nextSat.getDate()} ${nextSat.toLocaleString('en-GB', { month: 'short' })}`,
      value: nextSat.toISOString().split('T')[0],
      isCurrent: false
    });
    shortcuts.push({
      label: `Next Tue ${nextTue.getDate()} ${nextTue.toLocaleString('en-GB', { month: 'short' })}`,
      value: nextTue.toISOString().split('T')[0],
      isCurrent: false
    });

    return shortcuts;
  }, []);

  // Time shortcuts
  const timeShortcuts = [
    { label: '12:30', subLabel: '12:30pm', value: '12:30' },
    { label: '15:00', subLabel: '3pm', value: '15:00' },
    { label: '19:30', subLabel: '7:30pm', value: '19:30' }
  ];

  // Set default date to next Friday on component mount
  useEffect(() => {
    if (!kickoffDate && dateShortcuts.length > 0) {
      // Default to first Friday (This Fri)
      setKickoffDate(dateShortcuts[0].value);
    }
  }, [dateShortcuts, kickoffDate]);

  // Format selected date/time for display
  const selectedDateTimeDisplay = useMemo(() => {
    if (!kickoffDate || !kickoffTime) return null;

    const date = new Date(kickoffDate + 'T00:00:00');
    const dayName = date.toLocaleDateString('en-GB', { weekday: 'long' });
    const dateStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    const [hours, minutes] = kickoffTime.split(':');
    const hour = parseInt(hours);
    const mins = minutes !== '00' ? `:${minutes}` : '';
    const timeStr = hour === 12 ? `12${mins}pm` : hour > 12 ? `${hour - 12}${mins}pm` : hour === 0 ? `12${mins}am` : `${hour}${mins}am`;

    return `${dayName} ${dateStr} at ${timeStr}`;
  }, [kickoffDate, kickoffTime]);

  // Check authentication and authorization
  useEffect(() => {
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      router.push('/login');
      return;
    }

    // Check if user has permission to manage fixtures (organizer or delegated permission)
    const canManageFixtures = competition?.is_organiser || competition?.manage_fixtures;
    if (competition && !canManageFixtures) {
      router.push(`/game/${competitionId}`);
      return;
    }

    // Check if competition uses manual fixture mode
    if (competition && competition.fixture_service === true) {
      router.push(`/game/${competitionId}`);
      return;
    }

    // Check if competition is complete
    if (competition && competition.is_complete) {
      setIsBlocked(true);
      setBlockReason('Cannot add fixtures - competition has ended');
      setIsCheckingAccess(false);
      return;
    }
  }, [router, competitionId, competition]);

  // Check if fixtures can be added (check for incomplete previous round)
  useEffect(() => {
    const checkCanAddFixtures = async () => {
      if (!competition) return;

      try {
        // Try to get current round fixtures to see if there are unprocessed ones
        const response = await organizerApi.getFixturesForResults(parseInt(competitionId));

        if (response.data.return_code === 'SUCCESS') {
          const { fixtures } = response.data;

          // Check if there are any fixtures without results or not processed
          const unprocessedFixtures = fixtures.filter(
            (f: { result: string | null; processed: string | null }) => !f.result || !f.processed
          );

          if (unprocessedFixtures.length > 0) {
            setIsBlocked(true);
            setBlockReason(
              `Cannot add new fixtures. Round ${response.data.round_number} has ${unprocessedFixtures.length} unprocessed fixture(s). Complete current round first.`
            );
          }
        }
      } catch (error) {
        console.error('Error checking fixture access:', error);
        // Don't block on error - let them try and get server error message
      } finally {
        setIsCheckingAccess(false);
      }
    };

    if (competition && !isBlocked) {
      checkCanAddFixtures();
    }
  }, [competition, competitionId, isBlocked]);

  // Fetch teams for the competition's team list
  useEffect(() => {
    const fetchTeams = async () => {
      if (!competition?.team_list_id) {
        setTeamsLoading(false);
        return;
      }

      try {
        setTeamsLoading(true);
        const response = await teamApi.getTeams(competition.team_list_id);

        if (response.data.return_code === 'SUCCESS') {
          setTeams(response.data.teams || []);
        } else {
          console.error('Failed to load teams:', response.data);
          setTeams([]);
        }
      } catch (error) {
        console.error('Error fetching teams:', error);
        setTeams([]);
      } finally {
        setTeamsLoading(false);
      }
    };

    fetchTeams();
  }, [competition?.team_list_id]);

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

  // Form submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Reset previous messages
    setSubmitError('');
    setSubmitSuccess('');

    // Validate kickoff date and time
    if (!kickoffDate || !kickoffTime) {
      setSubmitError('Please select a kickoff date and time');
      return;
    }

    // Validate date is not in the past
    const kickoffDateTime = new Date(`${kickoffDate}T${kickoffTime}:00`);
    const now = new Date();

    if (kickoffDateTime < now) {
      setSubmitError('Kickoff date and time cannot be in the past. Please select a future date and time.');
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
    const kickoffDateTimeISO = new Date(`${kickoffDate}T${kickoffTime}:00Z`).toISOString();

    try {
      setIsSubmitting(true);

      // Make API call
      const response = await organizerApi.addFixtures(
        parseInt(competitionId),
        kickoffDateTimeISO,
        validFixtures
      );

      // Check response
      if (response.data.return_code === 'SUCCESS') {
        // Invalidate specific caches to ensure fresh data
        cacheUtils.invalidateCompetition(parseInt(competitionId));
        cacheUtils.invalidateKey(`rounds-${competitionId}`); // Rounds cache
        cacheUtils.invalidatePattern(`fixtures-*`); // All fixture caches
        cacheUtils.invalidateKey(`pick-stats-${competitionId}`); // Pick statistics cache

        // Redirect immediately
        router.push(`/game/${competitionId}`);

      } else if (response.data.return_code === 'UNAUTHORIZED') {
        setSubmitError('You are not authorized to manage fixtures for this competition');

      } else if (response.data.return_code === 'AUTOMATED_COMPETITION') {
        setSubmitError('This competition uses automated fixture service. Please contact admin.');

      } else if (response.data.return_code === 'PREVIOUS_ROUND_INCOMPLETE') {
        setSubmitError(response.data.message || 'Complete the current round before adding new fixtures');

      } else if (response.data.return_code === 'ROUND_HAS_FIXTURES') {
        setSubmitError(response.data.message || 'Fixtures already exist for this round. All fixtures must be added in one transaction.');

      } else {
        setSubmitError(response.data.message || 'Failed to add fixtures');
      }

    } catch (error) {
      console.error('Error adding fixtures:', error);
      setSubmitError('Network error - could not connect to server');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading while competition data loads
  if (!competition) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6">
          <Link
            href={`/game/${competitionId}`}
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>

        {/* Loading State */}
        {isCheckingAccess && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded">
            <p className="text-sm text-blue-700">Checking access...</p>
          </div>
        )}

        {/* Blocked State */}
        {isBlocked && !isCheckingAccess && (
          <div className="mb-4 p-6 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="text-yellow-600 text-2xl">⚠️</div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-yellow-900 mb-2">
                  Cannot Add Fixtures
                </h3>
                <p className="text-sm text-yellow-800 mb-4">
                  {blockReason}
                </p>
                <Link
                  href={`/game/${competitionId}`}
                  className="inline-block px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
                >
                  Back to Dashboard
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Success Message */}
        {submitSuccess && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700">
            ✓ {submitSuccess} - Redirecting...
          </div>
        )}

        {/* Error Message */}
        {submitError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {submitError}
          </div>
        )}

        {/* Form */}
        {!isBlocked && !isCheckingAccess && (
          <form onSubmit={handleSubmit}>
          {/* Kickoff Date/Time Section */}
          <div className="mb-6 p-6 bg-white rounded-2xl shadow-lg border border-slate-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-md">
                <span className="text-2xl">🔒</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900">Set Round Lock Time</h3>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-slate-700">
                Players must make picks <strong>before</strong> this time.
              </p>
            </div>

            {/* Date Selection */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-700 mb-3">Date:</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                {dateShortcuts.map((shortcut) => (
                  <button
                    key={shortcut.value}
                    type="button"
                    onClick={() => {
                      setKickoffDate(shortcut.value);
                      setShowCustomDate(false);
                    }}
                    className={`px-4 py-3 text-sm font-semibold rounded-xl transition-all transform hover:scale-105 ${
                      kickoffDate === shortcut.value
                        ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/50'
                        : 'bg-white text-slate-700 border-2 border-slate-200 hover:border-blue-300 hover:shadow-md'
                    }`}
                  >
                    {shortcut.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowCustomDate(!showCustomDate)}
                className={`px-4 py-3 text-sm font-semibold rounded-xl transition-all ${
                  showCustomDate
                    ? 'bg-slate-700 text-white shadow-md'
                    : 'bg-white text-slate-600 border-2 border-slate-200 hover:border-slate-300 hover:shadow-md'
                }`}
              >
                Custom date...
              </button>
              {showCustomDate && (
                <input
                  type="date"
                  {...(kickoffDate && { value: kickoffDate })}
                  onChange={(e) => setKickoffDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="mt-2 px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 w-full"
                />
              )}
            </div>

            {/* Time Selection */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-700 mb-3">Time:</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                {timeShortcuts.map((shortcut) => (
                  <button
                    key={shortcut.value}
                    type="button"
                    onClick={() => {
                      setKickoffTime(shortcut.value);
                      setShowCustomTime(false);
                    }}
                    className={`px-4 py-4 text-sm font-semibold rounded-xl transition-all transform hover:scale-105 ${
                      kickoffTime === shortcut.value
                        ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/50'
                        : 'bg-white text-slate-700 border-2 border-slate-200 hover:border-blue-300 hover:shadow-md'
                    }`}
                  >
                    <div className="text-lg">{shortcut.label}</div>
                    <div className="text-xs opacity-75">{shortcut.subLabel}</div>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowCustomTime(!showCustomTime)}
                className={`px-4 py-3 text-sm font-semibold rounded-xl transition-all ${
                  showCustomTime
                    ? 'bg-slate-700 text-white shadow-md'
                    : 'bg-white text-slate-600 border-2 border-slate-200 hover:border-slate-300 hover:shadow-md'
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
              <div className="mt-6 p-4 bg-gradient-to-r from-emerald-50 to-blue-50 rounded-xl border-2 border-emerald-200">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">✓</span>
                  <div>
                    <div className="text-base font-bold text-slate-900">
                      {selectedDateTimeDisplay}
                    </div>
                    <div className="text-xs text-slate-600 mt-1">
                      Lock time applied to all fixtures in this round
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Fixtures Section - Two Column Layout */}
          <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT COLUMN: Team Selection Buttons */}
            <div className="order-2 lg:order-1">
              <div className="sticky top-4">
                <div className="p-6 bg-white rounded-2xl shadow-lg border border-slate-200">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                      Select Teams
                    </h2>
                    <div className="px-3 py-1 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold text-sm shadow-md">
                      {nextSlot.side === 'home' ? 'HOME' : 'AWAY'}
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 mb-4">
                    Click teams to add (alternates Home → Away)
                  </p>
                  {teamsLoading ? (
                    <div className="text-center py-8 text-slate-600">Loading teams...</div>
                  ) : teams.length === 0 ? (
                    <div className="text-center py-8 text-red-600">No teams available for this competition</div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {teams.map((team) => {
                        const isUsed = usedTeams.has(team.short_name);
                        return (
                          <button
                            key={team.id}
                            type="button"
                            onClick={() => !isUsed && handleTeamClick(team.short_name)}
                            disabled={isUsed}
                            className={`px-3 py-2.5 rounded-lg transition-all font-bold text-sm ${
                              isUsed
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                : 'bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 active:scale-95 shadow-md hover:shadow-lg'
                            }`}
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

            {/* RIGHT COLUMN: Fixtures List */}
            <div className="order-1 lg:order-2">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3">
                Fixtures ({fixtures.filter(f => f.home_team_short && f.away_team_short).length})
              </h2>
              <div className="p-4 bg-white rounded-2xl shadow-lg border border-slate-200 max-h-[500px] overflow-y-auto">
                <div className="space-y-1">
                  {fixtures.map((fixture, index) => {
                    const isComplete = fixture.home_team_short && fixture.away_team_short;
                    const isNextSlot = index === nextSlot.index;
                    // Get full team names from the teams array
                    const homeTeam = teams.find(t => t.short_name === fixture.home_team_short);
                    const awayTeam = teams.find(t => t.short_name === fixture.away_team_short);
                    const homeTeamName = homeTeam?.name || fixture.home_team_short || '';
                    const awayTeamName = awayTeam?.name || fixture.away_team_short || '';

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
                            {homeTeamName || '___'}
                          </span>
                          <span className="text-gray-500 mx-2">vs</span>
                          <span className={`font-medium ${isNextSlot && nextSlot.side === 'away' ? 'text-blue-600' : 'text-gray-800'}`}>
                            {awayTeamName || '___'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFixture(index);
                          }}
                          className="text-red-500 hover:text-red-700 font-bold text-sm"
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
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => router.push(`/game/${competitionId}`)}
              className="px-8 py-3 border-2 border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 hover:border-slate-400 transition-all font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                const validFixtures = fixtures.filter(f => f.home_team_short && f.away_team_short);
                if (validFixtures.length === 0) {
                  setSubmitError('Please add at least one fixture with both home and away teams');
                  return;
                }
                setShowConfirmModal(true);
              }}
              disabled={isSubmitting || fixtures.filter(f => f.home_team_short && f.away_team_short).length === 0}
              className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed transition-all font-bold shadow-lg shadow-emerald-500/50 hover:shadow-xl disabled:shadow-none"
            >
              {isSubmitting ? 'Saving...' : '🔒 Confirm & Lock Fixtures'}
            </button>
          </div>
        </form>
        )}

        {/* Confirmation Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
              {/* Modal Header */}
              <div className="bg-amber-500 text-white px-6 py-4 rounded-t-2xl">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">⚠️</div>
                  <h3 className="text-xl font-bold">Confirm Fixtures</h3>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6">
                <div className="mb-4">
                  <p className="text-gray-800 font-medium mb-3">
                    You are about to save{' '}
                    <span className="text-blue-600 font-bold">
                      {fixtures.filter(f => f.home_team_short && f.away_team_short).length} fixture{fixtures.filter(f => f.home_team_short && f.away_team_short).length !== 1 ? 's' : ''}
                    </span>
                  </p>

                  <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4 mb-4">
                    <p className="text-amber-900 font-semibold mb-2">⚠️ Important:</p>
                    <ul className="text-sm text-amber-800 space-y-1 list-disc list-inside">
                      <li>Once saved, you <strong>cannot add more fixtures</strong> to this round</li>
                      <li>Make sure you have entered <strong>all fixtures</strong> for this round</li>
                      <li>Double-check all teams are correct</li>
                    </ul>
                  </div>

                  <p className="text-gray-700 text-sm">
                    Are you sure all fixtures are ready to lock in?
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 rounded-b-2xl border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowConfirmModal(false);
                    setSubmitError('');
                  }}
                  className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={(e) => {
                    setShowConfirmModal(false);
                    handleSubmit(e as unknown as React.FormEvent);
                  }}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Yes, Lock Fixtures
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
