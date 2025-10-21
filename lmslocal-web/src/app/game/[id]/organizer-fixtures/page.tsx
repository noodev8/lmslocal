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
  const [fixtures, setFixtures] = useState<OrganizerFixture[]>([
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
  const [submitSuccess, setSubmitSuccess] = useState('');

  // Block state
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);

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
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700">Kickoff:</span>
              <input
                type="date"
                value={kickoffDate}
                onChange={(e) => setKickoffDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                required
              />
              <input
                type="time"
                value={kickoffTime}
                onChange={(e) => setKickoffTime(e.target.value)}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                required
              />
              <span className="text-xs text-gray-500">(applied to all fixtures)</span>
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
                    const isActive = index === activeFixtureIndex;
                    const isComplete = fixture.home_team_short && fixture.away_team_short;
                    // Get full team names from the teams array
                    const homeTeam = teams.find(t => t.short_name === fixture.home_team_short);
                    const awayTeam = teams.find(t => t.short_name === fixture.away_team_short);
                    const homeTeamName = homeTeam?.name || fixture.home_team_short || '';
                    const awayTeamName = awayTeam?.name || fixture.away_team_short || '';

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
                            {homeTeamName || '___'}
                          </span>
                          <span className="text-gray-500 mx-2">vs</span>
                          <span className={`font-medium ${isActive && activeSide === 'away' ? 'text-blue-600' : 'text-gray-800'}`}>
                            {awayTeamName || '___'}
                          </span>
                        </div>
                        {fixtures.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveFixture(index);
                            }}
                            className="text-red-500 hover:text-red-700 font-bold text-sm"
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
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => router.push(`/game/${competitionId}`)}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || fixtures.filter(f => f.home_team_short && f.away_team_short).length === 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isSubmitting ? 'Saving...' : 'Save Fixtures'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
