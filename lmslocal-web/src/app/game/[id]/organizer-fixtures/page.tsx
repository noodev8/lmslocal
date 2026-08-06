'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { organizerApi, teamApi, OrganizerFixture, Team } from '@/lib/api';
import { useAppData } from '@/contexts/AppDataContext';
import { cacheUtils } from '@/lib/cache';
import { LABEL, EYEBROW, HEADING, PANEL, BTN_PRIMARY, BTN_OUTLINE } from '@/lib/design';

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

  // Time shortcuts. 12-hour only - the 24-hour form said nothing extra and organisers
  // read kickoffs as "half seven", not "19:30".
  const timeShortcuts = [
    { label: '12:30pm', value: '12:30' },
    { label: '3pm', value: '15:00' },
    { label: '7:30pm', value: '19:30' }
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

    // Automated competitions have nothing to enter here - the fixture service owns their
    // fixtures, and viewing them is the round screen's job. This page is now only the entry form.
    if (competition && competition.fixture_service === true) {
      router.replace(`/game/${competitionId}/round`);
      return;
    }

    // Check if competition is complete
    if (competition && competition.is_complete) {
      setIsBlocked(true);
      setBlockReason('Cannot add matches - competition has ended');
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
              `Cannot add new matches. Round ${response.data.round_number} has ${unprocessedFixtures.length} unfinished match(es). Complete the current round first.`
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

    if (competition && competition.fixture_service !== true && !isBlocked) {
      checkCanAddFixtures();
    }
  }, [competition, competitionId, isBlocked]);

  // Fetch teams for the competition's team list
  useEffect(() => {
    const fetchTeams = async () => {
      if (!competition || competition.fixture_service === true || !competition.team_list_id) {
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
  }, [competition]);

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
      setSubmitError('Please add at least one match with both home and away teams');
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
        // invalidateCompetition already covers rounds and pick statistics for this competition.
        // Fixtures are keyed by round id, not competition, so they need the separate sweep.
        cacheUtils.invalidateCompetition(competitionId);
        cacheUtils.invalidatePattern(`fixtures-*`);
        cacheUtils.invalidateCompetitions();

        // Redirect immediately
        router.push(`/game/${competitionId}`);

      } else if (response.data.return_code === 'UNAUTHORIZED') {
        setSubmitError('You are not authorized to manage matches for this competition');

      } else if (response.data.return_code === 'AUTOMATED_COMPETITION') {
        setSubmitError('This competition uses automated fixture service. Please contact admin.');

      } else if (response.data.return_code === 'PREVIOUS_ROUND_INCOMPLETE') {
        setSubmitError(response.data.message || 'Complete the current round before adding new matches');

      } else if (response.data.return_code === 'ROUND_HAS_FIXTURES') {
        setSubmitError(response.data.message || 'Fixtures already exist for this round. All fixtures must be added in one transaction.');

      } else {
        setSubmitError(response.data.message || 'Failed to add matches');
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
      <div className="flex min-h-screen items-center justify-center bg-stock font-body text-ink">
        <p className={EYEBROW}>Loading&hellip;</p>
      </div>
    );
  }

  // Redirecting to the round screen (see the access effect above); render nothing meanwhile.
  if (competition.fixture_service === true) {
    return null;
  }

  const completeFixtureCount = fixtures.filter(f => f.home_team_short && f.away_team_short).length;

  return (
    <div className="min-h-screen bg-stock font-body text-ink">
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <Link href={`/game/${competitionId}`} className={`${LABEL} mb-4 inline-flex items-center gap-1.5 text-ink-fade transition-colors hover:text-ink`}>
          <ArrowLeftIcon className="h-4 w-4" />
          Back to dashboard
        </Link>

        <p className={EYEBROW}>Matches</p>
        <h1 className={`${HEADING} mt-1 text-3xl`}>{competition.name}</h1>

        {/* Loading State */}
        {isCheckingAccess && (
          <p className="mt-4 text-[15px] text-ink-fade">Checking access&hellip;</p>
        )}

        {/* Blocked State */}
        {isBlocked && !isCheckingAccess && (
          <div className={`${PANEL} mt-5 border-overprint p-6`}>
            <p className={EYEBROW}>Cannot add matches</p>
            <p className="mt-2 text-[15px] text-ink">{blockReason}</p>
            <Link href={`/game/${competitionId}`} className={`${BTN_OUTLINE} mt-4 inline-flex`}>
              Back to dashboard
            </Link>
          </div>
        )}

        {/* Success / Error Messages */}
        {submitSuccess && (
          <div className={`${PANEL} mt-5 p-4`}>
            <p className="text-[15px] text-ink">{submitSuccess} &mdash; redirecting&hellip;</p>
          </div>
        )}
        {submitError && (
          <div className={`${PANEL} mt-5 border-overprint p-4`}>
            <p className="text-[15px] text-ink">{submitError}</p>
          </div>
        )}

        {/* Form */}
        {!isBlocked && !isCheckingAccess && (
          <form onSubmit={handleSubmit}>
            {/* Kickoff Date/Time Section */}
            <div className={`${PANEL} mt-5 p-5 sm:p-6`}>
              <p className={EYEBROW}>Set round lock time</p>
              <p className="mt-1 text-[15px] text-ink-fade">Players must make picks before this time.</p>

              {/* Date Selection */}
              <div className="mt-5">
                <p className={`${LABEL} mb-3 text-ink-fade`}>Date</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {dateShortcuts.map((shortcut) => (
                    <button
                      key={shortcut.value}
                      type="button"
                      onClick={() => {
                        setKickoffDate(shortcut.value);
                        setShowCustomDate(false);
                      }}
                      className={`${LABEL} border px-3 py-2.5 transition-colors ${
                        kickoffDate === shortcut.value
                          ? 'border-ink bg-ink text-stock-lit'
                          : 'border-ink/30 text-ink hover:border-ink'
                      }`}
                    >
                      {shortcut.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setShowCustomDate(!showCustomDate)}
                  className={`${BTN_OUTLINE} mt-2`}
                >
                  Custom date&hellip;
                </button>
                {showCustomDate && (
                  <input
                    type="date"
                    {...(kickoffDate && { value: kickoffDate })}
                    onChange={(e) => setKickoffDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="mt-2 w-full rounded-sm border border-ink bg-transparent px-3 py-2 text-[15px] text-ink focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                  />
                )}
              </div>

              {/* Time Selection */}
              <div className="mt-5">
                <p className={`${LABEL} mb-3 text-ink-fade`}>Time</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {timeShortcuts.map((shortcut) => (
                    <button
                      key={shortcut.value}
                      type="button"
                      onClick={() => {
                        setKickoffTime(shortcut.value);
                        setShowCustomTime(false);
                      }}
                      className={`border px-3 py-3 text-center transition-colors ${
                        kickoffTime === shortcut.value
                          ? 'border-ink bg-ink text-stock-lit'
                          : 'border-ink/30 text-ink hover:border-ink'
                      }`}
                    >
                      <div className="font-data text-base">{shortcut.label}</div>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setShowCustomTime(!showCustomTime)}
                  className={`${BTN_OUTLINE} mt-2`}
                >
                  Custom time&hellip;
                </button>
                {showCustomTime && (
                  <input
                    type="time"
                    value={kickoffTime}
                    onChange={(e) => setKickoffTime(e.target.value)}
                    className="mt-2 rounded-sm border border-ink bg-transparent px-3 py-2 text-[15px] text-ink focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                  />
                )}
              </div>

              {/* Selected DateTime Display */}
              {selectedDateTimeDisplay && (
                <div className="mt-5 border-t border-ink/30 pt-4">
                  <p className={`${LABEL} text-ink-fade`}>Lock time</p>
                  <p className="mt-1 font-data text-[15px] text-ink">{selectedDateTimeDisplay}</p>
                  <p className="mt-1 text-[13px] text-ink-fade">Applied to all matches in this round.</p>
                </div>
              )}
            </div>

            {/* Fixtures Section - Two Column Layout */}
            <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
              {/* LEFT COLUMN: Team Selection Buttons */}
              <div className="order-2 lg:order-1">
                <div className={`${PANEL} p-5 sm:p-6`}>
                  <div className="mb-1 flex items-center justify-between">
                    <p className={EYEBROW}>Select teams</p>
                    <span className={`${LABEL} border border-ink px-2 py-1 text-ink`}>
                      {nextSlot.side === 'home' ? 'Home' : 'Away'}
                    </span>
                  </div>
                  <p className="mb-4 text-[13px] text-ink-fade">Tap teams to add &mdash; alternates home, away.</p>
                  {teamsLoading ? (
                    <p className="py-8 text-center text-[15px] text-ink-fade">Loading teams&hellip;</p>
                  ) : teams.length === 0 ? (
                    <p className="py-8 text-center text-[15px] text-overprint">No teams available for this competition</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {teams.map((team) => {
                        const isUsed = usedTeams.has(team.short_name);
                        return (
                          <button
                            key={team.id}
                            type="button"
                            onClick={() => !isUsed && handleTeamClick(team.short_name)}
                            disabled={isUsed}
                            className={`${LABEL} border px-2 py-2.5 transition-colors ${
                              isUsed
                                ? 'cursor-not-allowed border-ink/15 text-ink-fade/40'
                                : 'cursor-pointer border-ink/30 text-ink hover:border-ink'
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

              {/* RIGHT COLUMN: Fixtures List */}
              <div className="order-1 lg:order-2">
                <p className={`${EYEBROW} mb-2`}>Matches ({completeFixtureCount})</p>
                <div className={`${PANEL} max-h-[500px] overflow-y-auto`}>
                  <div className="divide-y divide-ink/30">
                    {fixtures.map((fixture, index) => {
                      const isNextSlot = index === nextSlot.index;
                      const homeTeam = teams.find(t => t.short_name === fixture.home_team_short);
                      const awayTeam = teams.find(t => t.short_name === fixture.away_team_short);
                      const homeTeamName = homeTeam?.name || fixture.home_team_short || '';
                      const awayTeamName = awayTeam?.name || fixture.away_team_short || '';

                      return (
                        <div key={index} className="flex items-center gap-2 px-4 py-2.5 text-[14px]">
                          <div className="flex flex-1 items-center justify-between gap-2">
                            <span className={isNextSlot && nextSlot.side === 'home' ? 'text-overprint' : 'text-ink'}>
                              {homeTeamName || '—'}
                            </span>
                            <span className="text-ink-fade">vs</span>
                            <span className={isNextSlot && nextSlot.side === 'away' ? 'text-overprint' : 'text-ink'}>
                              {awayTeamName || '—'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveFixture(index);
                            }}
                            className="text-ink-fade transition-colors hover:text-ink"
                            title={fixtures.length === 1 ? 'Clear fixture' : 'Remove fixture'}
                          >
                            &times;
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => router.push(`/game/${competitionId}`)}
                className={`${BTN_OUTLINE} px-6 py-3`}
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
                disabled={isSubmitting || completeFixtureCount === 0}
                className={`${BTN_PRIMARY} px-6 py-3 text-base disabled:opacity-40`}
              >
                {isSubmitting ? 'Saving…' : 'Confirm & lock fixtures'}
              </button>
            </div>
          </form>
        )}

        {/* Confirmation Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
            <div className={`${PANEL} w-full max-w-md`}>
              <div className="border-b border-ink/30 p-6">
                <p className={EYEBROW}>Confirm matches</p>
              </div>

              <div className="p-6">
                <p className="text-[15px] text-ink">
                  You are about to save{' '}
                  <span className="font-data font-semibold">
                    {completeFixtureCount} fixture{completeFixtureCount !== 1 ? 's' : ''}
                  </span>
                </p>

                <div className="mt-4 border border-overprint p-4">
                  <p className={`${LABEL} mb-2 text-overprint`}>Important</p>
                  <ul className="list-disc space-y-1 pl-4 text-[14px] text-ink">
                    <li>Once saved, you cannot add more matches to this round.</li>
                    <li>Make sure you have entered all matches for this round.</li>
                    <li>Double-check all teams are correct.</li>
                  </ul>
                </div>

                <p className="mt-4 text-[14px] text-ink-fade">
                  Are you sure all fixtures are ready to lock in?
                </p>
              </div>

              <div className="flex justify-end gap-3 border-t border-ink/30 p-4">
                <button
                  onClick={() => {
                    setShowConfirmModal(false);
                    setSubmitError('');
                  }}
                  className={`${BTN_OUTLINE} px-5 py-2`}
                >
                  Cancel
                </button>
                <button
                  onClick={(e) => {
                    setShowConfirmModal(false);
                    handleSubmit(e as unknown as React.FormEvent);
                  }}
                  className={`${BTN_PRIMARY} px-5 py-2 text-base`}
                >
                  Yes, lock fixtures
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
