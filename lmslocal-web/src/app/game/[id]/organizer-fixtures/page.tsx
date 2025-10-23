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
  const [kickoffTime, setKickoffTime] = useState('15:00');
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

    // Next upcoming Fri, Sat, Sun (within next 7 days)
    const thisFri = getNextDayOfWeek(5, 0);
    const thisSat = getNextDayOfWeek(6, 0);
    const thisSun = getNextDayOfWeek(0, 0);

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
      label: `This Sun ${thisSun.getDate()} ${thisSun.toLocaleString('en-GB', { month: 'short' })}`,
      value: thisSun.toISOString().split('T')[0],
      isCurrent: true
    });

    // Following week's Fri, Sat, Sun (1 week after first set)
    const nextFri = getNextDayOfWeek(5, 1);
    const nextSat = getNextDayOfWeek(6, 1);
    const nextSun = getNextDayOfWeek(0, 1);

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
      label: `Next Sun ${nextSun.getDate()} ${nextSun.toLocaleString('en-GB', { month: 'short' })}`,
      value: nextSun.toISOString().split('T')[0],
      isCurrent: false
    });

    return shortcuts;
  }, []);

  // Time shortcuts
  const timeShortcuts = [
    { label: '12:00', subLabel: 'Noon', value: '12:00' },
    { label: '14:00', subLabel: '2pm', value: '14:00' },
    { label: '15:00', subLabel: '3pm', value: '15:00' },
    { label: '17:00', subLabel: '5pm', value: '17:00' },
    { label: '20:00', subLabel: '8pm', value: '20:00' }
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

  // Check authentication and authorization
  useEffect(() => {
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      router.push('/login');
      return;
    }

    // Check if user is organizer
    if (competition && !competition.is_organiser) {
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
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            Manage Fixtures - {competition.name}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Add fixtures for the next round
          </p>
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
                  min={new Date().toISOString().split('T')[0]}
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
                  (Lock time applied to all fixtures)
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
                  {teamsLoading ? (
                    <div className="text-center py-8 text-gray-600">Loading teams...</div>
                  ) : teams.length === 0 ? (
                    <div className="text-center py-8 text-red-600">No teams available for this competition</div>
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
              <h2 className="text-sm font-semibold text-gray-900 mb-2">
                Fixtures ({fixtures.filter(f => f.home_team_short && f.away_team_short).length})
              </h2>
              <div className="p-2 bg-gray-50 rounded-md border border-gray-300 max-h-[500px] overflow-y-auto">
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
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => router.push(`/game/${competitionId}`)}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
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
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isSubmitting ? 'Saving...' : 'Confirm & Lock Fixtures'}
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
