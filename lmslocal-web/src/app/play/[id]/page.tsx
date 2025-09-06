'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  TrophyIcon,
  ArrowLeftIcon,
  ExclamationTriangleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { fixtureApi, userApi, roundApi, playerActionApi, Fixture, Team, Round } from '@/lib/api';
import { useAppData } from '@/contexts/AppDataContext';
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


export default function CompetitionPickPage() {
  const router = useRouter();
  const params = useParams();
  const competitionId = params.id as string;
  
  // Use AppDataProvider context to avoid redundant getPlayerDashboard call
  const { competitions } = useAppData();
  
  // Memoize the specific competition to prevent unnecessary re-renders
  const contextCompetition = useMemo(() => {
    return competitions?.find(c => c.id.toString() === competitionId);
  }, [competitions, competitionId]);

  // Helper function to get full team name from short name
  const getFullTeamName = (shortName: string): string => {
    for (const fixture of fixtures) {
      if (fixture.home_team_short === shortName) {
        return fixture.home_team;
      }
      if (fixture.away_team_short === shortName) {
        return fixture.away_team;
      }
    }
    return shortName; // Fallback to short name if not found
  };

  // Completely eliminate touch flicker by disabling active states on touch devices
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @media (hover: none) and (pointer: coarse) {
        .team-card-no-touch:active {
          background-color: inherit !important;
          border-color: inherit !important;
          color: inherit !important;
          transform: none !important;
        }
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  
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
  const [previousRoundData, setPreviousRoundData] = useState<{ round_number: number; fixtures: Array<{ id: number; home_team: string; away_team: string; home_team_short: string; away_team_short: string; result?: string }>; player_pick?: string; player_outcome?: string; pick_counts: Record<string, number> } | null>(null);
  const [loadingPreviousRound, setLoadingPreviousRound] = useState(false);
  const [showPreviousRound, setShowPreviousRound] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const previousRoundAbortControllerRef = useRef<AbortController | null>(null);

  const getRoundId = useCallback(async (competitionId: number, roundNumber: number) => {
    try {
      // Get all rounds for this competition to find the correct round ID
      const response = await roundApi.getRounds(competitionId);
      if (response.data.return_code === 'SUCCESS') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rounds = (response.data.rounds as any[]) || [];
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
          
          // Don't automatically load previous round - only when user requests it
        }
      }
    } catch (error) {
      console.error('Failed to get round ID:', error);
    }
  }, []);

  const loadAllowedTeams = useCallback(async (competitionId: number) => {
    try {
      const response = await userApi.getAllowedTeams(competitionId);
      if (response.data.return_code === 'SUCCESS') {
        // Extract short names from allowed teams
        const allowedShortNames = (response.data.allowed_teams as Team[]).map(team => team.short_name);
        setAllowedTeams(allowedShortNames);
      }
    } catch (error) {
      console.error('Failed to load allowed teams:', error);
      setAllowedTeams([]);
    }
  }, []);

  const loadCompetitionData = useCallback(async () => {
    try {
      // Get competition from context instead of redundant API call
      if (!contextCompetition) {
        return; // Wait for context to load
      }
      
      setCompetition(contextCompetition); // Competition from context
      // Load allowed teams for this competition
      loadAllowedTeams(contextCompetition.id);
      if (contextCompetition.current_round) {
        // First get the actual round ID from round number
        getRoundId(contextCompetition.id, contextCompetition.current_round);
      }
    } catch (error) {
      console.error('Failed to load competition data:', error);
      router.push('/play');
    } finally {
      setLoading(false);
    }
  }, [contextCompetition, router, getRoundId, loadAllowedTeams]);

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
      
      // Clean up previous round requests
      if (previousRoundAbortControllerRef.current) {
        previousRoundAbortControllerRef.current.abort();
        previousRoundAbortControllerRef.current = null;
      }
    };
  }, [competitionId, router, loadCompetitionData]);

  const loadFixtures = async (roundId: number) => {
    try {
      const response = await fixtureApi.get(roundId.toString());
      if (response.data.return_code === 'SUCCESS') {
        setFixtures((response.data.fixtures as Fixture[]) || []);
      }
    } catch (error) {
      console.error('Failed to load fixtures:', error);
      setFixtures([]);
    }
  };


  const loadCurrentPick = async (roundId: number) => {
    try {
      const response = await playerActionApi.getCurrentPick(roundId);
      if (response.data.return_code === 'SUCCESS') {
        const pickTeam = (response.data.pick as {team?: string})?.team || null;
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
        setTeamPickCounts((response.data.pick_counts as Record<string, number>) || {});
      }
    } catch (error) {
      console.error('Failed to load team pick counts:', error);
      setTeamPickCounts({});
    }
  };

  const loadPreviousRoundData = async (currentRoundNumber: number, competitionIdToUse?: string) => {
    if (currentRoundNumber <= 1) {
      return; // No previous round for round 1
    }
    
    const compId = competitionIdToUse || competitionId;
    if (!compId) {
      return;
    }
    
    setLoadingPreviousRound(true);
    
    try {
      // Get previous round ID directly from the database
      const previousRoundNumber = currentRoundNumber - 1;
      
      // Use the existing getRounds API to get all rounds, then find the previous one
      const roundsResponse = await roundApi.getRounds(parseInt(compId));
      
      if (roundsResponse.data.return_code === 'SUCCESS') {
        const previousRound = (roundsResponse.data.rounds as Round[]).find(r => r.round_number === previousRoundNumber);
        
        if (previousRound) {
          // Get fixtures for previous round
          const fixturesResponse = await fixtureApi.get(previousRound.id.toString());
          
          if (fixturesResponse.data.return_code === 'SUCCESS') {
            // Get player's pick for previous round
            const pickResponse = await playerActionApi.getCurrentPick(previousRound.id);
            
            // Get pick counts for previous round
            const pickCountResponse = await fixtureApi.getPickCounts(previousRound.id);
            
            // Build the previous round data
            const previousRoundData = {
              round_number: previousRoundNumber,
              fixtures: (fixturesResponse.data.fixtures as Fixture[]) || [],
              player_pick: (pickResponse.data.pick as {team?: string})?.team || undefined,
              player_outcome: undefined as string | undefined, // We'll calculate this
              pick_counts: (pickCountResponse.data.pick_counts as Record<string, number>) || {}
            };
            
            // Calculate player outcome if they had a pick
            if (previousRoundData.player_pick) {
              const playerFixture = previousRoundData.fixtures.find(f => 
                f.home_team_short === previousRoundData.player_pick || f.away_team_short === previousRoundData.player_pick
              );
              if (playerFixture?.result) {
                if (playerFixture.result === previousRoundData.player_pick) {
                  previousRoundData.player_outcome = 'won';
                } else if (playerFixture.result === 'draw') {
                  previousRoundData.player_outcome = 'lost'; // Draw counts as loss in Last Man Standing
                } else {
                  previousRoundData.player_outcome = 'lost';
                }
              }
            } else {
              previousRoundData.player_outcome = 'no_pick';
            }
            
            setPreviousRoundData(previousRoundData);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load previous round data:', error);
    } finally {
      setLoadingPreviousRound(false);
    }
  };

  const handleTogglePreviousRound = async () => {
    // Prevent multiple rapid clicks
    if (loadingPreviousRound) {
      return;
    }

    if (showPreviousRound) {
      // Hide previous round and clean up data - immediate, no async needed
      setShowPreviousRound(false);
      setPreviousRoundData(null);
      
      // Cancel any ongoing previous round API calls
      if (previousRoundAbortControllerRef.current) {
        previousRoundAbortControllerRef.current.abort();
        previousRoundAbortControllerRef.current = null;
      }
    } else {
      // Show previous round and load data if not already loaded
      setShowPreviousRound(true);
      if (!previousRoundData && competition?.current_round) {
        // Cancel any previous ongoing request before starting new one
        if (previousRoundAbortControllerRef.current) {
          previousRoundAbortControllerRef.current.abort();
        }
        
        // Create new abort controller for this request
        previousRoundAbortControllerRef.current = new AbortController();
        
        await loadPreviousRoundData(competition.current_round, competitionId);
      }
    }
  };

  // Lighter scroll detection for iPad - more permissive
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  // Function to reset touch states - less aggressive
  const resetTouchStates = () => {
    setIsScrolling(false);
    touchStartRef.current = null;
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }
  };

  // Lighter scroll detection - shorter timeout and less aggressive
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolling(true);
      
      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      // Shorter timeout - reset scroll state faster (50ms instead of 100ms)
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 50);
    };

    // Remove global touchmove listener - only use scroll detection
    // This prevents blocking touches that aren't actual scrolls

    // Listen for scroll events only
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const handleTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };
  };

  const handleTeamSelect = (teamShort: string, fixtureId: number, position: 'home' | 'away', event: React.MouseEvent | React.TouchEvent) => {
    // Prevent if round is locked  
    if (isRoundLocked) return;
    
    // LIGHTER: Only block interactions during active scrolling (much more permissive)
    if (isScrolling) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    
    // For touch events, do lighter movement detection
    if (event.type === 'touchend' && touchStartRef.current) {
      const touch = 'changedTouches' in event ? event.changedTouches[0] : null;
      if (touch) {
        const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
        const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);
        const deltaTime = Date.now() - touchStartRef.current.time;
        
        // More lenient movement detection - allow bigger movements and shorter times
        if (deltaX > 25 || deltaY > 25 || deltaTime < 30) {
          touchStartRef.current = null;
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }
      touchStartRef.current = null;
    }
    
    // Allow more event types to pass through
    if (event.type !== 'click' && event.type !== 'touchend' && event.type !== 'touchstart') {
      return;
    }
    
    // Don't preventDefault for touchstart to allow normal touch behavior
    if (event.type !== 'touchstart') {
      event.preventDefault();
      event.stopPropagation();
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

    // Reset all touch states when cancelling selection
    resetTouchStates();

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
    // Reset all touch states when submitting selection
    resetTouchStates();
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
              The organiser hasn&apos;t added fixtures for this round yet. Check back soon!
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
                const isDisabled = !isAllowed || !!(currentPick && !isCurrentPick);
                
                return (
                  <button
                    key={`${team.short}-${index}`}
                    onClick={(e) => handleTeamSelect(team.short, team.fixtureId, team.position, e)}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={(e) => handleTeamSelect(team.short, team.fixtureId, team.position, e)}
                    disabled={isDisabled}
                    style={{
                      // Light CSS to prevent unwanted touch behaviors but allow normal interaction
                      WebkitTapHighlightColor: 'transparent',
                      touchAction: 'manipulation',
                    }}
                    className={`team-card-no-touch p-4 rounded-lg border-2 select-none ${
                      isCurrentPick
                        ? 'border-blue-500 bg-blue-50 text-blue-900'
                        : currentPick || !isAllowed
                          ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                          : isSelected
                            ? 'border-green-500 bg-green-50 transition-colors' 
                            : 'border-gray-200 transition-colors active:border-blue-300 active:bg-blue-50 md:hover:border-blue-300 md:hover:bg-blue-50'
                    }`}
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
                      onClick={() => {
                        // Reset touch states when cancelling to prevent blocking
                        resetTouchStates();
                        setSelectedTeam(null);
                      }}
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
              <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="text-center">
                  <div className="text-gray-800 font-medium mb-2">
                    Current Pick: <span className="font-bold">{getFullTeamName(currentPick)}</span>
                  </div>
                  <div className="text-gray-600 text-sm mb-4">
                    Want to change your pick? Remove it first to select a different team.
                  </div>
                  <button
                    onClick={handleUnselectPick}
                    disabled={submitting}
                    className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors min-w-[140px]"
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
                    className={`relative p-4 rounded-lg border-2 transition-all duration-200 cursor-default ${
                      isCurrentPick ? (
                        resultState === 'won' ? 'bg-green-100 border-green-500 shadow-md' :
                        resultState === 'lost' ? 'bg-red-100 border-red-500 shadow-md' :
                        'bg-blue-100 border-blue-500 shadow-md'
                      ) : (
                        resultState === 'won' ? 'bg-green-50 border-green-300' :
                        resultState === 'lost' ? 'bg-red-50 border-red-300' :
                        'bg-gray-50 border-gray-200 opacity-70'
                      )
                    }`}
                  >
                    {/* Your pick indicator */}
                    {isCurrentPick && (
                      <div className="absolute -top-2 -left-2 bg-blue-600 text-white text-xs rounded-full px-2 py-1 font-bold shadow-md">
                        YOUR PICK
                      </div>
                    )}
                    
                    {/* Player Count Badge - only show when round is locked */}
                    {teamPickCounts[team.short] && (
                      <div className="absolute -top-2 -right-2 bg-gray-600 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center shadow-lg">
                        {teamPickCounts[team.short]}
                      </div>
                    )}
                    <div className="text-center">
                      {/* Team name (large) */}
                      <div className={`text-lg font-bold mb-1 ${
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
                      <div className={`text-xs mb-2 ${
                        resultState === 'won'
                          ? 'text-green-700'
                          : resultState === 'lost'
                          ? 'text-red-700'
                          : isCurrentPick
                          ? 'text-blue-700'
                          : 'text-gray-500'
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
        
        {/* Previous Round Toggle Button - Show when multiple rounds exist */}
        {competition?.current_round && competition.current_round > 1 && (
          <div className="mt-6 text-center">
            <button
              onClick={handleTogglePreviousRound}
              disabled={loadingPreviousRound}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 text-gray-700 rounded-lg font-medium transition-colors"
            >
              {loadingPreviousRound ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                  <span>Loading...</span>
                </>
              ) : showPreviousRound ? (
                <>
                  <span>Hide Previous Round</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </>
              ) : (
                <>
                  <span>Show Previous Round</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </>
              )}
            </button>
          </div>
        )}
        
        {/* Previous Round Results - Only when toggled */}
        {showPreviousRound && previousRoundData && (
          <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 mt-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Round {previousRoundData.round_number} Results</h2>
            {loadingPreviousRound ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Loading previous round...</span>
              </div>
            ) : (
              <div>
                {/* Team cards grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {previousRoundData.fixtures
                    .flatMap(fixture => [
                      { 
                        short: fixture.home_team_short, 
                        name: fixture.home_team, 
                        fixture: fixture,
                        is_home: true 
                      },
                      { 
                        short: fixture.away_team_short, 
                        name: fixture.away_team, 
                        fixture: fixture,
                        is_home: false 
                      }
                    ])
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((team) => {
                      const isPlayerPick = previousRoundData.player_pick === team.short;
                      const fixture = team.fixture;
                      const resultState = fixture?.result ? (
                        fixture.result === team.short ? 'won' : 
                        fixture.result === 'DRAW' ? 'draw' :
                        'lost'
                      ) : 'no-result';
                      const pickCount = previousRoundData.pick_counts[team.short] || 0;
                      
                      return (
                        <div
                          key={`${team.short}`}
                          className={`
                            relative p-4 rounded-lg border-2 transition-all duration-200 cursor-default
                            ${
                              isPlayerPick ? (
                                resultState === 'won' ? 'bg-green-100 border-green-500 shadow-md' :
                                resultState === 'lost' ? 'bg-red-100 border-red-500 shadow-md' :
                                resultState === 'draw' ? 'bg-yellow-100 border-yellow-500 shadow-md' :
                                'bg-blue-100 border-blue-500 shadow-md'
                              ) : (
                                resultState === 'won' ? 'bg-green-50 border-green-300' :
                                resultState === 'lost' ? 'bg-red-50 border-red-300' :
                                resultState === 'draw' ? 'bg-yellow-50 border-yellow-300' :
                                'bg-gray-50 border-gray-200'
                              )
                            }
                          `}
                        >
                          {/* Your pick indicator */}
                          {isPlayerPick && (
                            <div className="absolute -top-2 -left-2 bg-blue-600 text-white text-xs rounded-full px-2 py-1 font-bold shadow-md">
                              YOUR PICK
                            </div>
                          )}
                          
                          {/* Pick count badge */}
                          {pickCount > 0 && (
                            <div className="absolute -top-2 -right-2 bg-gray-600 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center font-bold">
                              {pickCount}
                            </div>
                          )}
                          
                          <div className="text-center">
                            <div className="text-lg font-bold text-gray-900 mb-1">
                              {team.name}
                            </div>
                            
                            {/* Fixture info */}
                            <div className="text-xs text-gray-500 mb-2">
                              {team.is_home ? `${team.name} v ${fixture.away_team}` : `${fixture.home_team} v ${team.name}`}
                            </div>
                            
                            {/* Result indicators */}
                            {resultState === 'won' && (
                              <div className="text-xs text-green-700 font-bold">
                                {isPlayerPick ? '🎉 YOU WON!' : '✓ WON'}
                              </div>
                            )}
                            
                            {resultState === 'lost' && (
                              <div className="text-xs text-red-700 font-bold">
                                {isPlayerPick ? '❌ YOU LOST' : '✗ LOST'}
                              </div>
                            )}
                            
                            {resultState === 'draw' && (
                              <div className="text-xs text-yellow-700 font-bold">
                                {isPlayerPick ? '➖ DRAW' : '= DRAW'}
                              </div>
                            )}
                            
                            {isPlayerPick && resultState === 'no-result' && (
                              <div className="text-xs text-blue-700 font-bold">
                                ✓ YOUR PICK
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}