'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  TrophyIcon,
  ArrowLeftIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { fixtureApi, userApi, roundApi, playerActionApi } from '@/lib/api';
import { logout } from '@/lib/auth';

interface User {
  id: number;
  display_name: string;
  email: string;
}

interface Competition {
  id: number;
  name: string;
  current_round?: number;
  history?: RoundHistory[];
}

interface RoundHistory {
  round_id: number;
  round_number: number;
  lock_time: string;
  round_created: string;
  pick_team: string | null;
  pick_fixture_id: number | null;
  pick_created: string | null;
  pick_team_full_name: string | null;
  home_team: string | null;
  away_team: string | null;
  result: string | null;
  pick_result: 'no_pick' | 'pending' | 'win' | 'draw' | 'loss';
  lives_remaining?: number;
  player_status?: string; // 'active' or 'OUT'
}

interface Fixture {
  id: number;
  home_team: string;
  away_team: string;
  home_team_short: string;
  away_team_short: string;
  kickoff_time: string;
  result?: string;
}

export default function CompetitionPickPage() {
  const router = useRouter();
  const params = useParams();
  const competitionId = params.id as string;
  
  const [user, setUser] = useState<User | null>(null);
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentRoundId, setCurrentRoundId] = useState<number | null>(null);
  const [roundLockTime, setRoundLockTime] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<{teamShort: string, fixtureId: number, position: 'home' | 'away'} | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [allowedTeams, setAllowedTeams] = useState<string[]>([]); // Array of allowed team short names
  const [currentPick, setCurrentPick] = useState<string | null>(null); // Current pick for this round
  const [isRoundLocked, setIsRoundLocked] = useState<boolean>(false);
  const [teamPickCounts, setTeamPickCounts] = useState<Record<string, number>>({}); // Pick counts per team
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Create abort controller for this effect
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const initializeData = async () => {
      // Check authentication
      const token = localStorage.getItem('jwt_token');
      const userData = localStorage.getItem('user');
      
      if (!token || !userData) {
        if (!controller.signal.aborted) router.push('/login');
        return;
      }

      try {
        const parsedUser = JSON.parse(userData);
        if (!controller.signal.aborted) {
          setUser(parsedUser);
          await loadCompetitionData();
        }
      } catch (error) {
        console.error('Error parsing user data:', error);
        if (!controller.signal.aborted) router.push('/login');
        return;
      }
    };

    // Handle auth expiration
    const handleAuthExpired = () => {
      if (!controller.signal.aborted) {
        router.push('/login');
      }
    };

    window.addEventListener('auth-expired', handleAuthExpired);
    initializeData();

    return () => {
      controller.abort();
      window.removeEventListener('auth-expired', handleAuthExpired);
      abortControllerRef.current = null;
    };
  }, [competitionId, router]);

  const loadCompetitionData = async () => {
    try {
      // Get competition data from player dashboard (includes history)
      const response = await userApi.getPlayerDashboard();
      if (response.data.return_code === 'SUCCESS') {
        const comp = response.data.competitions.find(c => c.id.toString() === competitionId);
        if (comp) {
          setCompetition(comp); // This now includes the history data
          // Load allowed teams for this competition
          loadAllowedTeams(comp.id);
          if (comp.current_round) {
            // First get the actual round ID from round number
            getRoundId(comp.id, comp.current_round);
          }
        } else {
          router.push('/play');
          return;
        }
      }
    } catch (error) {
      console.error('Failed to load competition data:', error);
      router.push('/play');
    } finally {
      setLoading(false);
    }
  };

  const getRoundId = async (competitionId: number, roundNumber: number) => {
    try {
      // Get all rounds for this competition to find the correct round ID
      const response = await roundApi.getRounds(competitionId);
      if (response.data.return_code === 'SUCCESS') {
        const rounds = response.data.rounds || [];
        const currentRound = rounds.find(r => r.round_number === roundNumber);
        if (currentRound) {
          setCurrentRoundId(currentRound.id);
          setRoundLockTime(currentRound.lock_time);
          
          // Check if round is locked
          const now = new Date();
          const lockTime = new Date(currentRound.lock_time);
          const locked = now >= lockTime;
          setIsRoundLocked(locked);
          
          // Now load fixtures and current pick with the correct round ID
          loadFixtures(currentRound.id);
          loadCurrentPick(currentRound.id);
          
          // Load pick counts only when round is locked (for fairness)
          if (locked) {
            loadTeamPickCounts(currentRound.id);
          }
        }
      }
    } catch (error) {
      console.error('Failed to get round ID:', error);
    }
  };

  const loadFixtures = async (roundId: number) => {
    try {
      const response = await fixtureApi.get(roundId.toString());
      if (response.data.return_code === 'SUCCESS') {
        setFixtures(response.data.fixtures || []);
      }
    } catch (error) {
      console.error('Failed to load fixtures:', error);
      setFixtures([]);
    }
  };

  const loadAllowedTeams = async (competitionId: number) => {
    try {
      const response = await userApi.getAllowedTeams(competitionId);
      if (response.data.return_code === 'SUCCESS') {
        // Extract short names from allowed teams
        const allowedShortNames = response.data.allowed_teams.map(team => team.short_name);
        setAllowedTeams(allowedShortNames);
      }
    } catch (error) {
      console.error('Failed to load allowed teams:', error);
      setAllowedTeams([]);
    }
  };

  const loadCurrentPick = async (roundId: number) => {
    try {
      const response = await playerActionApi.getCurrentPick(roundId);
      if (response.data.return_code === 'SUCCESS') {
        const pickTeam = response.data.pick?.team || null;
        setCurrentPick(pickTeam);
      }
    } catch (error) {
      console.error('Failed to load current pick:', error);
      setCurrentPick(null);
    }
  };

  const loadTeamPickCounts = async (roundId: number) => {
    try {
      const response = await fixtureApi.getPickCounts(roundId);
      if (response.data.return_code === 'SUCCESS') {
        setTeamPickCounts(response.data.pick_counts || {});
      }
    } catch (error) {
      console.error('Failed to load team pick counts:', error);
      setTeamPickCounts({});
    }
  };

  const handleTeamSelect = (teamShort: string, fixtureId: number, position: 'home' | 'away', event: React.MouseEvent | React.TouchEvent) => {
    // Prevent if it's a scroll gesture or round is locked
    if (isRoundLocked) return;
    
    // For touch events, check if this was likely a scroll gesture
    if ('touches' in event || event.type === 'touchend') {
      event.preventDefault();
    }
    
    // If there's already a current pick, don't allow any new selections
    // User must remove current pick first
    if (currentPick) {
      return;
    }
    
    // No current pick, allow selection if team is in allowed list  
    if (allowedTeams.includes(teamShort)) {
      setSelectedTeam({ teamShort, fixtureId, position });
    }
  };

  const handleUnselectPick = async () => {
    if (!currentRoundId || submitting || isRoundLocked) return;

    setSubmitting(true);
    try {
      const response = await playerActionApi.unselectPick(currentRoundId);
      
      if (response.data.return_code === 'SUCCESS') {
        // Refresh allowed teams and current pick to show updated state
        if (competition && currentRoundId) {
          await loadAllowedTeams(competition.id);
          await loadCurrentPick(currentRoundId);
        }
        // Clear current selection
        setSelectedTeam(null);
      } else {
        alert('Failed to remove pick: ' + (response.data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to unselect pick:', error);
      alert('Failed to remove pick');
    } finally {
      setSubmitting(false);
    }
  };

  const submitPick = async () => {
    if (!selectedTeam || submitting || isRoundLocked) return;

    setSubmitting(true);
    try {
      const response = await playerActionApi.setPick(selectedTeam.fixtureId, selectedTeam.position);
      
      if (response.data.return_code === 'SUCCESS') {
        // Refresh allowed teams and current pick to show updated state
        if (competition && currentRoundId) {
          await loadAllowedTeams(competition.id);
          await loadCurrentPick(currentRoundId);
        }
        // Clear selection
        setSelectedTeam(null);
      } else {
        alert('Failed to submit pick: ' + (response.data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to submit pick:', error);
      alert('Failed to submit pick');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    logout(router);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!competition) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h3 className="text-xl font-medium text-gray-900 mb-2">Competition Not Found</h3>
          <Link href="/play" className="text-blue-600 hover:text-blue-700">
            Back to Competitions
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Link href="/play" className="mr-3 p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
              </Link>
              <Link href="/" className="flex items-center">
                <TrophyIcon className="h-8 w-8 text-blue-600" />
                <span className="ml-2 text-xl font-bold text-gray-900">LMSLocal</span>
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {user?.display_name}
              </span>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Title */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{competition.name}</h1>
              <p className="text-gray-600">
                Round {competition.current_round} - {isRoundLocked ? 'In Play' : 'Make Your Pick'}
                {roundLockTime && isRoundLocked && (
                  <span className="text-xs text-gray-500 ml-2">
                    (Locked: {new Date(roundLockTime).toLocaleString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false
                    })})
                  </span>
                )}
              </p>
              {roundLockTime && !isRoundLocked && (
                <p className="text-lg text-gray-700 mt-1">
                  Picks lock at: {new Date(roundLockTime).toLocaleString('en-GB', {
                    year: 'numeric',
                    month: '2-digit', 
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                  }).replace(',', '')}
                </p>
              )}
            </div>
            <Link 
              href={`/play/${competitionId}/standings`}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <TrophyIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Standings</span>
            </Link>
          </div>
        </div>


        {/* No Fixtures Message - when waiting for fixtures */}
        {fixtures.length === 0 && !isRoundLocked && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">No fixtures yet</h2>
            <p className="text-gray-600 mb-4">
              The organizer hasn't added fixtures for this round yet. Check back soon!
            </p>
            <div className="inline-flex items-center px-4 py-2 bg-blue-50 text-blue-700 rounded-lg">
              <ClockIcon className="h-5 w-5 mr-2" />
              <span>Waiting for fixtures...</span>
            </div>
          </div>
        )}

        {/* Pick Selection - Only show when round is NOT locked */}
        {fixtures.length > 0 && !isRoundLocked && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Choose Your Pick</h2>
            <p className="text-gray-600 mb-6">
              Select one team that you think will win. Remember, you can only pick each team once!
            </p>
            
            {/* Team Selection Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {fixtures
                .sort((a, b) => `${a.home_team} v ${a.away_team}`.localeCompare(`${b.home_team} v ${b.away_team}`))
                .flatMap(fixture => [
                // Home team card with fixture context
                {
                  short: fixture.home_team_short,
                  full: fixture.home_team,
                  fixtureId: fixture.id,
                  position: 'home' as const,
                  fixtureDisplay: `${fixture.home_team} v ${fixture.away_team}`
                },
                // Away team card with fixture context
                {
                  short: fixture.away_team_short,
                  full: fixture.away_team,
                  fixtureId: fixture.id,
                  position: 'away' as const,
                  fixtureDisplay: `${fixture.home_team} v ${fixture.away_team}`
                }
              ]).map((team, index) => {
                const isAllowed = allowedTeams.includes(team.short);
                const isSelected = selectedTeam?.teamShort === team.short;
                const isCurrentPick = currentPick === team.short;
                
                // Disable teams if:
                // 1. Team not in allowed list
                // 2. There's already a current pick (user must remove it first)
                const isDisabled = !isAllowed || (currentPick && !isCurrentPick);
                
                return (
                  <button
                    key={`${team.short}-${index}`}
                    onClick={(e) => handleTeamSelect(team.short, team.fixtureId, team.position, e)}
                    onTouchEnd={(e) => handleTeamSelect(team.short, team.fixtureId, team.position, e)}
                    disabled={isDisabled}
                    className={`p-4 rounded-lg border-2 touch-manipulation ${
                      isCurrentPick
                        ? 'border-blue-500 bg-blue-50 text-blue-900'
                        : currentPick || !isAllowed
                          ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                          : isSelected
                            ? 'border-green-500 bg-green-50 transition-colors' 
                            : 'border-gray-200 transition-colors active:border-blue-300 active:bg-blue-50 md:hover:border-blue-300 md:hover:bg-blue-50'
                    }`}
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  <div className="text-center">
                    {/* Main team (large) */}
                    <div className={`text-lg font-bold mb-2 ${
                      isCurrentPick 
                        ? 'text-blue-900' 
                        : currentPick || !isAllowed ? 'text-gray-400' : 'text-gray-900'
                    }`}>
                      {team.full}
                    </div>
                    
                    {/* Fixture context */}
                    <div className={`text-xs leading-tight ${
                      isCurrentPick 
                        ? 'text-blue-700'
                        : currentPick || !isAllowed ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      {team.fixtureDisplay}
                    </div>
                    
                    {isCurrentPick && (
                      <div className="text-xs text-blue-700 mt-2 font-bold">
                        ✓ CURRENT PICK
                      </div>
                    )}
                    
                    {/* Only show interactive elements when not locked */}
                    {!isRoundLocked && (
                      <>
                        {isSelected && isAllowed && !isCurrentPick && (
                          <div className="text-xs text-green-600 font-medium mt-2">
                            ✓ Selected
                          </div>
                        )}
                        
                        {currentPick && !isCurrentPick && isAllowed && (
                          <div className="text-xs text-gray-400 mt-2 font-medium">
                            Remove current pick to select
                          </div>
                        )}
                        
                        {!isAllowed && !isCurrentPick && (
                          <div className="text-xs text-gray-400 mt-2 font-medium">
                            Already Picked
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </button>
                );
              })}
            </div>

            {/* Confirmation Banner - shown when team is selected */}
            {selectedTeam && (
              <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="text-center">
                  <div className="text-green-800 font-medium mb-3">
                    Confirm your pick: <span className="font-bold">{selectedTeam.teamShort}</span>
                  </div>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={submitPick}
                      disabled={submitting}
                      className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors min-w-[120px]"
                    >
                      {submitting ? 'Confirming...' : 'Confirm Pick'}
                    </button>
                    <button
                      onClick={() => setSelectedTeam(null)}
                      disabled={submitting}
                      className="bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors min-w-[120px]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Remove Current Pick Card - shown when no team selected but user has current pick */}
            {!selectedTeam && currentPick && (
              <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="text-center">
                  <div className="text-red-800 font-medium mb-2">
                    Current Pick: <span className="font-bold">{currentPick}</span>
                  </div>
                  <div className="text-red-600 text-sm mb-4">
                    Want to change your pick? Remove it first to select a different team.
                  </div>
                  <button
                    onClick={handleUnselectPick}
                    disabled={submitting}
                    className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors min-w-[140px]"
                  >
                    {submitting ? 'Removing...' : 'Remove Pick'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* In Play Round - Show team selection display */}
        {isRoundLocked && fixtures.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            
            {/* Team Selection Cards - Display Only */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {fixtures
                .sort((a, b) => `${a.home_team} v ${a.away_team}`.localeCompare(`${b.home_team} v ${b.away_team}`))
                .flatMap(fixture => [
                // Home team card
                {
                  short: fixture.home_team_short,
                  full: fixture.home_team,
                  fixtureId: fixture.id,
                  position: 'home' as const,
                  fixtureDisplay: `${fixture.home_team} v ${fixture.away_team}`
                },
                // Away team card
                {
                  short: fixture.away_team_short,
                  full: fixture.away_team,
                  fixtureId: fixture.id,
                  position: 'away' as const,
                  fixtureDisplay: `${fixture.home_team} v ${fixture.away_team}`
                }
              ]).map((team, index) => {
                const isCurrentPick = currentPick === team.short;
                
                // Find the fixture for this team to check results
                const fixture = fixtures.find(f => 
                  f.home_team_short === team.short || f.away_team_short === team.short
                );
                
                // Determine result state for ALL teams (not just current pick)
                let resultState = 'no-result';
                if (fixture && fixture.result) {
                  const teamWon = fixture.result === team.short;
                  
                  if (teamWon) {
                    resultState = 'won';
                  } else {
                    resultState = 'lost'; // Either lost or drew
                  }
                }
                
                return (
                  <div
                    key={`${team.short}-${index}`}
                    className={`relative p-4 rounded-lg border-2 ${
                      resultState === 'won'
                        ? `border-green-500 bg-green-50 ${isCurrentPick ? 'ring-2 ring-blue-400' : ''}`
                        : resultState === 'lost'
                        ? `border-red-500 bg-red-50 ${isCurrentPick ? 'ring-2 ring-blue-400' : ''}`
                        : isCurrentPick
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-300 bg-gray-100 opacity-70'
                    }`}
                  >
                    {/* Player Count Badge - only show when round is locked */}
                    {teamPickCounts[team.short] && (
                      <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center shadow-lg">
                        {teamPickCounts[team.short]}
                      </div>
                    )}
                    <div className="text-center">
                      {/* Main team (large) */}
                      <div className={`text-lg font-bold mb-2 ${
                        resultState === 'won'
                          ? 'text-green-900'
                          : resultState === 'lost'
                          ? 'text-red-900'
                          : isCurrentPick
                          ? 'text-blue-900'
                          : 'text-gray-500'
                      }`}>
                        {team.full}
                      </div>
                      
                      {/* Fixture context */}
                      <div className={`text-xs leading-tight ${
                        resultState === 'won'
                          ? 'text-green-700'
                          : resultState === 'lost'
                          ? 'text-red-700'
                          : isCurrentPick
                          ? 'text-blue-700'
                          : 'text-gray-400'
                      }`}>
                        {team.fixtureDisplay}
                      </div>
                      
                      {/* Result indicator for all teams */}
                      {resultState === 'won' && (
                        <div className="text-xs text-green-700 mt-2 font-bold">
                          {isCurrentPick ? '🎉 YOU WON!' : '✓ WON'}
                        </div>
                      )}
                      
                      {resultState === 'lost' && (
                        <div className="text-xs text-red-700 mt-2 font-bold">
                          {isCurrentPick ? '❌ YOU LOST' : '✗ LOST'}
                        </div>
                      )}
                      
                      {resultState === 'no-result' && isCurrentPick && (
                        <div className="text-xs text-blue-700 mt-2 font-bold">
                          ✓ YOUR PICK
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {!currentPick && (
              <div className="mt-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-center">
                  <ExclamationTriangleIcon className="h-5 w-5 text-orange-600 mr-2" />
                  <span className="text-orange-800 font-medium">No Pick Made</span>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* In Play Round - No fixtures available */}
        {isRoundLocked && fixtures.length === 0 && !currentPick && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="p-4 bg-orange-50 border border-orange-200 rounded">
              <div className="flex items-center">
                <ExclamationTriangleIcon className="h-5 w-5 text-orange-600 mr-2" />
                <span className="text-orange-800 font-medium">No Pick Made This Round</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Competition History */}
        {competition?.history && competition.history.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 mt-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Round History</h2>
            
            {/* Desktop Table View - Hidden on mobile */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 font-medium text-gray-700">Round</th>
                    <th className="text-left py-2 font-medium text-gray-700">Your Pick</th>
                    <th className="text-left py-2 font-medium text-gray-700">Fixture</th>
                    <th className="text-left py-2 font-medium text-gray-700">Result</th>
                    <th className="text-left py-2 font-medium text-gray-700">Outcome</th>
                    <th className="text-left py-2 font-medium text-gray-700">Lives</th>
                  </tr>
                </thead>
                <tbody>
                  {competition.history
                    .slice() // Create a copy to avoid mutating original
                    .sort((a, b) => b.round_number - a.round_number) // Sort latest first
                    .map((round) => (
                    <tr key={round.round_id} className="border-b border-gray-100">
                      {/* Current round - simplified display */}
                      {round.round_number === competition.current_round ? (
                        <>
                          <td className="py-3" colSpan={6}>
                            <span className="font-medium text-blue-600">Round {round.round_number} (Current)</span>
                          </td>
                        </>
                      ) : (
                        /* Past rounds - full details */
                        <>
                          <td className="py-3">
                            <span className="font-medium">Round {round.round_number}</span>
                          </td>
                          <td className="py-3">
                            {round.pick_team_full_name ? (
                              <span className="text-blue-600 font-medium">{round.pick_team_full_name}</span>
                            ) : (
                              <span className="text-gray-500">No Pick</span>
                            )}
                          </td>
                          <td className="py-3">
                            {round.home_team && round.away_team ? (
                              <span className="text-gray-700">{round.home_team} v {round.away_team}</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="py-3">
                            {round.result ? (
                              <span className="text-gray-700">
                                {round.result === 'home_win' ? `${round.home_team} Win` :
                                 round.result === 'away_win' ? `${round.away_team} Win` :
                                 'Draw'}
                              </span>
                            ) : (
                              <span className="text-gray-400">Pending</span>
                            )}
                          </td>
                          <td className="py-3">
                            <span className={`px-2 py-1 text-xs rounded font-medium ${
                              round.pick_result === 'win' ? 'bg-green-100 text-green-800' :
                              round.pick_result === 'draw' ? 'bg-yellow-100 text-yellow-800' :
                              round.pick_result === 'loss' ? 'bg-red-100 text-red-800' :
                              round.pick_result === 'no_pick' ? 'bg-gray-100 text-gray-600' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {round.pick_result === 'win' ? 'Win' :
                               round.pick_result === 'draw' ? 'Draw' :
                               round.pick_result === 'loss' ? 'Loss' :
                               round.pick_result === 'no_pick' ? 'No Pick' :
                               'Pending'}
                            </span>
                          </td>
                          <td className="py-3">
                            {round.player_status === 'OUT' ? (
                              <span className="px-2 py-1 text-xs rounded font-medium bg-red-100 text-red-800">
                                OUT
                              </span>
                            ) : round.lives_remaining !== undefined ? (
                              <span className={`px-2 py-1 text-xs rounded font-medium ${
                                round.lives_remaining === 0 ? 'bg-red-100 text-red-800' :
                                round.lives_remaining === 1 ? 'bg-orange-100 text-orange-800' :
                                'bg-green-100 text-green-800'
                              }`}>
                                {round.lives_remaining} {round.lives_remaining === 1 ? 'life' : 'lives'}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View - Hidden on desktop */}
            <div className="md:hidden space-y-4">
              {competition.history
                .slice() // Create a copy to avoid mutating original
                .sort((a, b) => b.round_number - a.round_number) // Sort latest first
                .map((round) => (
                <div key={round.round_id} className="border border-gray-200 rounded-lg p-4">
                  {/* Current round - simplified display */}
                  {round.round_number === competition.current_round ? (
                    <div className="text-center">
                      <span className="font-semibold text-blue-600">Round {round.round_number} (Current)</span>
                    </div>
                  ) : (
                    /* Past rounds - full details */
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">Round {round.round_number}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 text-xs rounded font-medium ${
                            round.pick_result === 'win' ? 'bg-green-100 text-green-800' :
                            round.pick_result === 'draw' ? 'bg-yellow-100 text-yellow-800' :
                            round.pick_result === 'loss' ? 'bg-red-100 text-red-800' :
                            round.pick_result === 'no_pick' ? 'bg-gray-100 text-gray-600' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {round.pick_result === 'win' ? 'Win' :
                             round.pick_result === 'draw' ? 'Draw' :
                             round.pick_result === 'loss' ? 'Loss' :
                             round.pick_result === 'no_pick' ? 'No Pick' :
                             'Pending'}
                          </span>
                          {round.player_status === 'OUT' ? (
                            <span className="px-2 py-1 text-xs rounded font-medium bg-red-100 text-red-800">
                              OUT
                            </span>
                          ) : round.lives_remaining !== undefined ? (
                            <span className={`px-2 py-1 text-xs rounded font-medium ${
                              round.lives_remaining === 0 ? 'bg-red-100 text-red-800' :
                              round.lives_remaining === 1 ? 'bg-orange-100 text-orange-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {round.lives_remaining} {round.lives_remaining === 1 ? 'life' : 'lives'}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Your Pick:</span>
                          {round.pick_team_full_name ? (
                            <span className="text-blue-600 font-medium">{round.pick_team_full_name}</span>
                          ) : (
                            <span className="text-gray-500">No Pick</span>
                          )}
                        </div>
                        
                        {round.home_team && round.away_team && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Fixture:</span>
                            <span className="text-gray-700 text-right">{round.home_team} v {round.away_team}</span>
                          </div>
                        )}
                        
                        <div className="flex justify-between">
                          <span className="text-gray-600">Result:</span>
                          {round.result ? (
                            <span className="text-gray-700">
                              {round.result === 'home_win' ? `${round.home_team} Win` :
                               round.result === 'away_win' ? `${round.away_team} Win` :
                               'Draw'}
                            </span>
                          ) : (
                            <span className="text-gray-400">Pending</span>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}