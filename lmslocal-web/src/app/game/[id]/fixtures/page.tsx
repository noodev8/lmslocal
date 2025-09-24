'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  CalendarIcon,
  CheckCircleIcon,
  XMarkIcon,
  ChartBarIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';
import { roundApi, fixtureApi, teamApi, competitionApi, adminApi, userApi, Team, Player, cacheUtils } from '@/lib/api';
import { useAppData } from '@/contexts/AppDataContext';

interface Round {
  id: number;
  round_number: number;
  lock_time?: string;
  status?: string;
  fixture_count?: number;
}

interface PendingFixture {
  home_team: string;        // Full team name for display
  away_team: string;        // Full team name for display
  home_team_short: string;  // Short name for API calls
  away_team_short: string;  // Short name for API calls
}

export default function FixturesPage() {
  const router = useRouter();
  const params = useParams();
  const competitionId = params.id as string;
  
  // Use AppDataProvider context for competitions data
  const { competitions, loading: contextLoading } = useAppData();
  
  // Find the specific competition
  const competition = competitions?.find(c => c.id.toString() === competitionId);

  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateRoundModal, setShowCreateRoundModal] = useState(false);
  const [newRoundLockTime, setNewRoundLockTime] = useState('');
  const [showEditLockTimeModal, setShowEditLockTimeModal] = useState(false);
  const [editedLockTime, setEditedLockTime] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [isResettingFixtures, setIsResettingFixtures] = useState(false);
  const [showExtendTimeModal, setShowExtendTimeModal] = useState(false);
  const [extendingRound, setExtendingRound] = useState(false);
  const [extendedRound, setExtendedRound] = useState<Round | null>(null);
  
  // Fixture creation state
  const [teams, setTeams] = useState<Team[]>([]);
  const [pendingFixtures, setPendingFixtures] = useState<PendingFixture[]>([]);
  const [nextSelection, setNextSelection] = useState<'home' | 'away'>('home');
  const [selectedHomeTeam, setSelectedHomeTeam] = useState<{ name: string; short_name: string } | null>(null);
  const [usedTeams, setUsedTeams] = useState<Set<string>>(new Set());
  const [isSavingFixtures, setIsSavingFixtures] = useState(false);

  // Admin pick management state (separate from fixture creation to avoid conflicts)
  const [showAdminPickModal, setShowAdminPickModal] = useState(false);
  const [adminPickPlayers, setAdminPickPlayers] = useState<Player[]>([]);
  const [adminSelectedPlayer, setAdminSelectedPlayer] = useState<number | null>(null);
  const [adminSelectedTeam, setAdminSelectedTeam] = useState('');
  const [adminSettingPick, setAdminSettingPick] = useState(false);
  const [adminPickTeams, setAdminPickTeams] = useState<Team[]>([]);
  const [adminAllowedTeamNames, setAdminAllowedTeamNames] = useState<Set<string>>(new Set());

  const hasInitialized = useRef(false);

  const getNextFriday6PM = () => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 5 = Friday
    const daysUntilFriday = dayOfWeek <= 5 ? (5 - dayOfWeek) : (7 - dayOfWeek + 5);
    
    const nextFriday = new Date(now);
    nextFriday.setDate(now.getDate() + daysUntilFriday);
    nextFriday.setHours(18, 0, 0, 0); // 6:00 PM
    
    return nextFriday.toISOString();
  };

  const handleExtendRoundTime = useCallback(async (round: Round) => {
    setExtendingRound(true);

    try {
      // Calculate new lock time (next Friday 6PM - guaranteed future)
      const getNextFriday6PM = () => {
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0 = Sunday, 5 = Friday

        let daysUntilFriday;
        if (dayOfWeek < 5) {
          // Before Friday - use this week's Friday
          daysUntilFriday = 5 - dayOfWeek;
        } else if (dayOfWeek === 5) {
          // It's Friday - check if it's already past 6 PM
          if (now.getHours() >= 18) {
            // Past 6 PM on Friday - use NEXT Friday (7 days)
            daysUntilFriday = 7;
          } else {
            // Before 6 PM on Friday - use today
            daysUntilFriday = 0;
          }
        } else {
          // Weekend (Saturday/Sunday) - use next Friday
          daysUntilFriday = 5 + (7 - dayOfWeek);
        }

        const nextFriday = new Date(now);
        nextFriday.setDate(now.getDate() + daysUntilFriday);
        nextFriday.setHours(18, 0, 0, 0); // 6:00 PM

        return nextFriday.toISOString();
      };

      const newLockTime = getNextFriday6PM();

      const response = await roundApi.update(round.id.toString(), newLockTime);

      if (response.data.return_code === 'SUCCESS') {
        // Clear cache and proceed to fixture creation
        cacheUtils.invalidateKey(`rounds-${competitionId}`);

        // Update the round with new lock time and proceed
        const extendedRound = { ...round, lock_time: newLockTime };
        setCurrentRound(extendedRound);
        await loadFixtures(round.id);
        await loadTeams();

        // Keep modal open until user clicks continue
      } else {
        console.error('Failed to extend round time:', response.data.message);
        alert('Failed to extend round time: ' + response.data.message);
        setShowExtendTimeModal(false);
      }
    } catch (error) {
      console.error('Error extending round time:', error);
      alert('Failed to extend round time');
      setShowExtendTimeModal(false);
    } finally {
      setExtendingRound(false);
    }
  }, [competitionId]);

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
        
        // Check rounds status
        const response = await roundApi.getRounds(parseInt(competitionId));
        
        if (response.data.return_code !== 'SUCCESS') {
          console.error('Failed to get rounds:', response.data.message);
          setShowCreateRoundModal(true);
          const defaultTime = getNextFriday6PM().slice(0, 16);
          setNewRoundLockTime(defaultTime);
          setLoading(false);
          return;
        }
        
        const rounds = response.data.rounds || [];
        
        if (rounds.length === 0) {
          // No rounds at all - show create round modal
          setShowCreateRoundModal(true);
          const defaultTime = getNextFriday6PM().slice(0, 16);
          setNewRoundLockTime(defaultTime);
        } else {
          // Check the latest round
          const latestRound = rounds[0];
          
          // Check if the latest round is still unlocked (lock time not reached)
          const now = new Date();
          const lockTime = new Date(latestRound.lock_time || '');
          const isLocked = latestRound.lock_time && now >= lockTime;
          
          if (latestRound.fixture_count === 0) {
            // Round exists but no fixtures - check if we can still use it
            if (!isLocked) {
              // Round is not locked yet - use it for fixture creation
              setCurrentRound(latestRound);
              await loadFixtures(latestRound.id);
              await loadTeams();
            } else {
              // Round is locked but has no fixtures - auto-extend the lock time
              setExtendedRound(latestRound);
              setShowExtendTimeModal(true);
              // Auto-extend the round in the background
              handleExtendRoundTime(latestRound);
            }
          } else {
            // Round has fixtures - show read-only view (no editing allowed)
            setCurrentRound(latestRound);
            await loadFixtures(latestRound.id);
            // Don't load teams - no editing allowed
          }
        }
      } catch (error) {
        console.error('Failed to load fixtures data:', error);
        router.push(`/game/${competitionId}`);
      } finally {
        setLoading(false);
      }
    };

    initializeData();
  }, [competitionId, router, competition, contextLoading, handleExtendRoundTime]);

  const loadFixtures = async (roundId: number) => {
    try {
      const response = await fixtureApi.get(roundId.toString());
      if (response.data.return_code === 'SUCCESS') {
        const existingFixtures = (response.data.fixtures as { home_team: string; away_team: string; home_team_short: string; away_team_short: string }[]) || [];
        
        // Convert existing fixtures to pending fixtures format and sort alphabetically
        const pendingFromExisting = existingFixtures.map((fixture: { home_team: string; away_team: string; home_team_short: string; away_team_short: string }) => ({
          home_team: fixture.home_team,
          away_team: fixture.away_team,
          home_team_short: fixture.home_team_short,
          away_team_short: fixture.away_team_short
        })).sort((a, b) => {
          // Sort alphabetically by fixture (home_team vs away_team)
          const fixtureA = `${a.home_team} vs ${a.away_team}`;
          const fixtureB = `${b.home_team} vs ${b.away_team}`;
          return fixtureA.localeCompare(fixtureB);
        });
        
        // Track used teams
        const used = new Set<string>();
        existingFixtures.forEach((fixture: { home_team: string; away_team: string; home_team_short: string; away_team_short: string }) => {
          used.add(fixture.home_team_short);
          used.add(fixture.away_team_short);
        });
        
        setPendingFixtures(pendingFromExisting);
        setUsedTeams(used);
      }
    } catch (error) {
      console.error('Failed to load fixtures:', error);
      setPendingFixtures([]);
      setUsedTeams(new Set());
    }
  };


  const loadTeams = async () => {
    try {
      const response = await teamApi.getTeams();
      if (response.data.return_code === 'SUCCESS') {
        setTeams(response.data.teams || []);
      }
    } catch (error) {
      console.error('Failed to load teams:', error);
    }
  };

  const createFirstRound = async () => {
    try {
      const response = await roundApi.create(competitionId, newRoundLockTime || getNextFriday6PM());
      
      if (response.data.return_code === 'SUCCESS') {
        const roundData = response.data.round as { id: number; round_number: number; lock_time: string; status: string };
        setCurrentRound({
          id: roundData.id,
          round_number: roundData.round_number,
          lock_time: roundData.lock_time,
          status: roundData.status || 'UNLOCKED'
        });
        
        setShowCreateRoundModal(false);
        setNewRoundLockTime('');
        
        // Load teams for fixture creation
        await loadTeams();
      } else {
        alert('Failed to create round: ' + (response.data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to create round:', error);
      alert('Failed to create round');
    }
  };

  const cancelCreateRound = () => {
    setShowCreateRoundModal(false);
    setNewRoundLockTime('');
    router.push(`/game/${competitionId}`);
  };

  const updateLockTime = async () => {
    if (!currentRound || !editedLockTime) return;
    
    try {
      const response = await roundApi.update(currentRound.id.toString(), editedLockTime);
      
      if (response.data.return_code === 'SUCCESS') {
        // Update current round state
        setCurrentRound(prev => prev ? { ...prev, lock_time: editedLockTime } : null);
        
        // Clear rounds cache to ensure fresh data
        cacheUtils.invalidateKey(`rounds-${competitionId}`);
        
        setShowEditLockTimeModal(false);
        setEditedLockTime('');
      } else {
        alert(response.data.message || 'Failed to update lock time');
      }
    } catch (error) {
      console.error('Failed to update lock time:', error);
      alert('Failed to update lock time');
    }
  };

  const handleEditLockTime = () => {
    if (currentRound?.lock_time) {
      // Convert ISO string to datetime-local format
      const date = new Date(currentRound.lock_time);
      const localDateTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString().slice(0, 16);
      setEditedLockTime(localDateTime);
      setShowEditLockTimeModal(true);
    }
  };

  const resetFixtures = async () => {
    if (!currentRound || isResettingFixtures) return;
    
    setIsResettingFixtures(true);
    
    try {
      const response = await fixtureApi.reset(currentRound.id);
      
      if (response.data.return_code === 'SUCCESS') {
        // Clear all relevant caches
        cacheUtils.invalidateKey(`fixtures-${currentRound.id}`);
        cacheUtils.invalidateKey(`rounds-${competitionId}`);
        
        // Reset the page state to allow new fixture creation
        setPendingFixtures([]);
        setUsedTeams(new Set());
        setSelectedHomeTeam(null);
        setNextSelection('home');
        
        // Update current round to reflect no fixtures
        setCurrentRound(prev => prev ? { ...prev, fixture_count: 0 } : null);
        
        // Load teams for new fixture creation
        await loadTeams();
        
        // Reset the saving state in case it was stuck
        setIsSavingFixtures(false);
        
        setShowResetModal(false);
        
      } else {
        alert('Failed to reset fixtures: ' + (response.data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Reset fixtures error:', error);
      alert('Failed to reset fixtures');
    } finally {
      setIsResettingFixtures(false);
    }
  };

  const handleTeamSelect = (team: Team) => {
    if (nextSelection === 'home') {
      // Home team selected
      setSelectedHomeTeam({ name: team.name, short_name: team.short_name });
      setNextSelection('away');
      setUsedTeams(prev => new Set([...prev, team.short_name]));
    } else {
      // Away team selected - create fixture
      if (selectedHomeTeam) {
        const newFixture: PendingFixture = {
          home_team: selectedHomeTeam.name,
          away_team: team.name,
          home_team_short: selectedHomeTeam.short_name,
          away_team_short: team.short_name
        };
        
        setPendingFixtures(prev => [...prev, newFixture]);
        setUsedTeams(prev => new Set([...prev, team.short_name]));
        
        // Reset for next fixture
        setSelectedHomeTeam(null);
        setNextSelection('home');
      }
    }
  };

  const removePendingFixture = (index: number) => {
    const fixture = pendingFixtures[index];
    setPendingFixtures(prev => prev.filter((_, i) => i !== index));
    
    // Remove teams from used set (using short names)
    setUsedTeams(prev => {
      const newSet = new Set(prev);
      newSet.delete(fixture.home_team_short);
      newSet.delete(fixture.away_team_short);
      return newSet;
    });
  };

  const savePendingFixtures = async () => {
    if (!currentRound || pendingFixtures.length === 0 || isSavingFixtures) return;

    setIsSavingFixtures(true);
    
    try {
      // Add kickoff_time for API call and use short names for API
      const defaultKickoffTime = currentRound.lock_time || new Date().toISOString();
      const fixturesWithTime = pendingFixtures.map(fixture => ({
        home_team: fixture.home_team_short,
        away_team: fixture.away_team_short,
        kickoff_time: defaultKickoffTime
      }));

      const response = await fixtureApi.addBulk(currentRound.id.toString(), fixturesWithTime);
      
      if (response.data.return_code === 'SUCCESS') {
        // Clear fixture cache
        cacheUtils.invalidateKey(`fixtures-${currentRound.id}`);
        // Clear rounds cache so fixture_count gets updated
        cacheUtils.invalidateKey(`rounds-${competitionId}`);
        
        // Update the current round to reflect that fixtures now exist
        setCurrentRound(prev => prev ? { ...prev, fixture_count: pendingFixtures.length } : null);
        
        // Clear teams to prevent further editing
        setTeams([]);
        setSelectedHomeTeam(null);
        setNextSelection('home');
        setUsedTeams(new Set());
        
        // Stay on page in read-only mode - don't redirect
        setIsSavingFixtures(false);
      } else {
        alert('Failed to save fixtures: ' + (response.data.message || 'Unknown error'));
        setIsSavingFixtures(false);
      }
    } catch (error) {
      console.error('Save fixtures error:', error);
      alert('Failed to save fixtures');
      setIsSavingFixtures(false);
    }
  };

  // Admin pick functions (restored from old manage page)
  const loadAdminPickPlayers = async () => {
    try {
      const response = await competitionApi.getPlayers(parseInt(competitionId));
      if (response.data.return_code === 'SUCCESS') {
        setAdminPickPlayers(response.data.players || []);
      }
    } catch (error) {
      console.error('Failed to load players for admin pick:', error);
    }
  };

  const loadAdminPickAllowedTeams = async (userId: number) => {
    try {
      // First, get the player's allowed teams
      const allowedTeamNames = new Set<string>();
      try {
        const allowedResponse = await userApi.getAllowedTeams(parseInt(competitionId), userId);
        if (allowedResponse.data.return_code === 'SUCCESS') {
          const allowedTeams = allowedResponse.data.allowed_teams || [];
          allowedTeams.forEach((team: Team) => {
            allowedTeamNames.add(team.name);
            allowedTeamNames.add(team.short_name);
          });
        }
      } catch {
        console.log('Could not fetch allowed teams for player - will show all fixture teams');
      }
      setAdminAllowedTeamNames(allowedTeamNames);

      // Get all teams
      let allTeams: Team[] = [];
      if (teams.length > 0) {
        allTeams = teams;
      } else {
        const teamsResponse = await teamApi.getTeams();
        if (teamsResponse.data.return_code === 'SUCCESS') {
          allTeams = teamsResponse.data.teams || [];
        }
      }

      // Extract unique team names from current fixtures
      const fixtureTeamNames = new Set<string>();
      pendingFixtures.forEach(fixture => {
        fixtureTeamNames.add(fixture.home_team);
        fixtureTeamNames.add(fixture.away_team);
        fixtureTeamNames.add(fixture.home_team_short);
        fixtureTeamNames.add(fixture.away_team_short);
      });

      // Filter teams to only include those in current fixtures
      const fixtureTeams = allTeams.filter(team =>
        fixtureTeamNames.has(team.name) || fixtureTeamNames.has(team.short_name)
      );

      setAdminPickTeams(fixtureTeams);
    } catch (error) {
      console.error('Failed to load teams for admin pick:', error);
      // Fallback to all teams if something goes wrong
      if (teams.length > 0) {
        setAdminPickTeams(teams);
      } else {
        await teamApi.getTeams().then(res => {
          if (res.data.return_code === 'SUCCESS') {
            setAdminPickTeams(res.data.teams || []);
          }
        });
      }
    }
  };

  const handleSetPlayerPick = async () => {
    if (!adminSelectedPlayer || !adminSelectedTeam || !competition) return;

    setAdminSettingPick(true);
    try {
      const response = await adminApi.setPlayerPick(competition.id, adminSelectedPlayer, adminSelectedTeam);
      if (response.data.return_code === 'SUCCESS') {
        const pick = response.data.pick as { player_name: string; team: string };
        alert(`Pick set successfully for ${pick.player_name}: ${pick.team}`);
        setShowAdminPickModal(false);
        setAdminSelectedPlayer(null);
        setAdminSelectedTeam('');
        setAdminPickTeams([]);
      } else {
        alert(`Failed to set pick: ${(response.data as { message?: string }).message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to set player pick:', error);
      alert('Failed to set pick. Please try again.');
    } finally {
      setAdminSettingPick(false);
    }
  };

  const openAdminPickModal = async () => {
    await loadAdminPickPlayers();
    setShowAdminPickModal(true);
  };

  if (loading || contextLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <Link href={`/game/${competitionId}`} className="flex items-center space-x-2 text-slate-600 hover:text-slate-800 transition-colors">
                  <ArrowLeftIcon className="h-5 w-5" />
                  <span className="font-medium">Back</span>
                </Link>
                <div className="h-6 w-px bg-slate-300" />
                <div>
                  <h1 className="text-lg text-slate-900">Fixtures</h1>
                </div>
              </div>
            </div>
          </div>
        </header>
        
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
            <div className="flex items-center justify-center">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-50 rounded-full mb-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-600 border-t-transparent"></div>
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">Loading Fixtures</h3>
                <p className="text-slate-500">Please wait while we load the fixtures data...</p>
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link href={`/game/${competitionId}`} className="flex items-center space-x-2 text-slate-600 hover:text-slate-800 transition-colors">
                <ArrowLeftIcon className="h-5 w-5" />
                <span className="font-medium">Back</span>
              </Link>
              <div className="h-6 w-px bg-slate-300" />
              <div>
                <h1 className="text-lg text-slate-900">Fixtures</h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Competition Name */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">{competition?.name}</h1>
          {currentRound && currentRound.lock_time && (
            <div className="flex items-center space-x-3 mt-2">
              <p className="text-slate-600">
                <span className="font-medium">Round {currentRound.round_number} Lock Time:</span>{' '}
                {new Date(currentRound.lock_time).toLocaleString('en-GB', {
                  weekday: 'long',
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false
                })}
              </p>
              <button
                onClick={handleEditLockTime}
                className="text-slate-500 hover:text-slate-700 transition-colors"
                title="Edit lock time"
              >
                <CalendarIcon className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Create Round Modal */}
        {showCreateRoundModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
              <div className="p-6">
                <h3 className="text-lg text-slate-900 mb-4">Create First Round</h3>
                <div className="mb-4">
                  <label htmlFor="lockTime" className="block text-sm font-medium text-slate-700 mb-2">
                    Lock Time (when picks close)
                  </label>
                  <input
                    id="lockTime"
                    type="datetime-local"
                    value={newRoundLockTime}
                    onChange={(e) => setNewRoundLockTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                  />
                </div>
              </div>
              <div className="flex gap-3 px-6 py-4 bg-slate-50 rounded-b-xl">
                <button
                  onClick={cancelCreateRound}
                  className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createFirstRound}
                  className="flex-1 px-4 py-2 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-900 transition-colors"
                >
                  Create Round
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Fixtures Management */}
        {currentRound && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-6 py-4 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg text-slate-900">
                    {currentRound.fixture_count && currentRound.fixture_count > 0 ? 'Fixtures Management' : 'Fixture Management'}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    {currentRound.fixture_count && currentRound.fixture_count > 0 
                      ? `Round ${currentRound.round_number} fixtures are set. You can reset them to start over if needed.`
                      : `Select teams to create fixtures for Round ${currentRound.round_number}`
                    }
                  </p>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2 text-sm text-slate-600">
                    <ChartBarIcon className="h-4 w-4" />
                    <span>
                      {currentRound.fixture_count && currentRound.fixture_count > 0 
                        ? `${currentRound.fixture_count} fixtures (saved)` 
                        : `${pendingFixtures.length} fixtures${pendingFixtures.length > 0 ? ' (pending)' : ''}`
                      }
                    </span>
                  </div>
                  {/* Action Buttons */}
                  {currentRound.fixture_count && currentRound.fixture_count > 0 ? (
                    // Buttons for existing fixtures
                    (() => {
                      const now = new Date();
                      const lockTime = new Date(currentRound.lock_time || '');
                      const isLocked = currentRound.lock_time && now >= lockTime;

                      return (
                        <div className="flex items-center space-x-3">
                          {!isLocked ? (
                            <>
                              {/* Set Player Pick button - only when unlocked */}
                              <button
                                onClick={openAdminPickModal}
                                className="inline-flex items-center px-4 py-2 rounded-lg font-medium text-sm bg-slate-600 text-white hover:bg-slate-700 transition-colors"
                              >
                                <UserGroupIcon className="h-4 w-4 mr-2" />
                                Set Player Pick
                              </button>

                              {/* Reset button - only when unlocked */}
                              <button
                                onClick={() => setShowResetModal(true)}
                                className="inline-flex items-center px-4 py-2 rounded-lg font-medium text-sm bg-slate-500 text-white hover:bg-slate-600 transition-colors"
                              >
                                <TrashIcon className="h-4 w-4 mr-2" />
                                Reset Fixtures
                              </button>
                            </>
                          ) : (
                            <div className="text-sm text-slate-500 italic">
                              Round is locked - no changes allowed
                            </div>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    // Save button for pending fixtures
                    pendingFixtures.length > 0 && (
                      <button
                        onClick={savePendingFixtures}
                        disabled={isSavingFixtures}
                        className={`inline-flex items-center px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                          isSavingFixtures
                            ? 'bg-slate-50 text-slate-400 cursor-not-allowed'
                            : 'bg-slate-800 text-white hover:bg-slate-900'
                        }`}
                      >
                        {isSavingFixtures ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-400 border-t-transparent mr-2"></div>
                            Saving...
                          </>
                        ) : (
                          <>
                            <CheckCircleIcon className="h-4 w-4 mr-2" />
                            Confirm {pendingFixtures.length} Fixtures
                          </>
                        )}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 space-y-8">
              {currentRound.fixture_count && currentRound.fixture_count > 0 ? (
                // Read-only view when fixtures already exist
                <div>
                  {/* Show existing fixtures in read-only format */}
                  {pendingFixtures.length > 0 && (
                    <div>
                      <h4 className="font-medium text-slate-900 mb-4">Current Fixtures</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {pendingFixtures.map((fixture, index) => (
                          <div key={index} className="flex items-center justify-center bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                            <div className="flex items-center space-x-3">
                              <span className="text-slate-900">{fixture.home_team}</span>
                              <span className="text-slate-400">vs</span>
                              <span className="text-slate-900">{fixture.away_team}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // Editable view when no fixtures exist yet
                <>
                  {/* Team Selection */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium text-slate-900">
                        {nextSelection === 'home' ? 'Select Home Team' : selectedHomeTeam ? `Select Away Team (vs ${selectedHomeTeam.name})` : 'Select Teams'}
                      </h4>
                      <div className="text-sm text-slate-500">
                        {nextSelection === 'home' ? 'Step 1 of 2' : 'Step 2 of 2'}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-3">
                      {teams.map((team) => {
                        const isUsed = usedTeams.has(team.short_name);
                        const isSelectedHome = selectedHomeTeam?.short_name === team.short_name;
                        
                        return (
                          <button
                            key={team.id}
                            onClick={() => handleTeamSelect(team)}
                            disabled={isUsed && !isSelectedHome}
                            className={`p-2 rounded-lg border text-xs font-medium transition-all ${
                              isSelectedHome
                                ? 'bg-slate-700 border-slate-800 text-white'
                                : isUsed
                                ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 cursor-pointer'
                            }`}
                          >
                            {team.short_name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Pending Fixtures */}
                  {pendingFixtures.length > 0 && (
                    <div>
                      <h4 className="font-medium text-slate-900 mb-4">Created Fixtures</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {pendingFixtures.map((fixture, index) => (
                          <div key={index} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                            <div className="flex items-center space-x-3">
                              <span className="text-slate-900">{fixture.home_team}</span>
                              <span className="text-slate-400">vs</span>
                              <span className="text-slate-900">{fixture.away_team}</span>
                            </div>
                            <button
                              onClick={() => removePendingFixture(index)}
                              className="text-slate-400 hover:text-red-600 transition-colors"
                            >
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Reset Fixtures Confirmation Modal */}
        {showResetModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
              <div className="p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="flex-shrink-0">
                    <ExclamationTriangleIcon className="h-8 w-8 text-red-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Reset All Fixtures?</h2>
                    <p className="text-slate-600 mt-1">This action cannot be undone</p>
                  </div>
                </div>
                
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                  <h3 className="font-semibold text-red-800 mb-2">This will:</h3>
                  <ul className="text-sm text-red-700 space-y-1 list-disc list-inside">
                    <li>Delete all fixtures for Round {currentRound?.round_number}</li>
                    <li>Remove all player picks for this round</li>
                    <li>Restore team choices back to all affected players</li>
                    <li>Require players to make their picks again</li>
                  </ul>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start space-x-2">
                    <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-amber-800">
                        <strong>Important:</strong> If players have already made picks, 
                        they must select their teams again after you create new fixtures.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowResetModal(false)}
                    disabled={isResettingFixtures}
                    className="flex-1 px-4 py-2 text-slate-600 hover:text-slate-800 font-medium transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={resetFixtures}
                    disabled={isResettingFixtures}
                    className="flex-1 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 disabled:bg-slate-400 disabled:cursor-not-allowed font-medium transition-colors"
                  >
                    {isResettingFixtures ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2 inline-block"></div>
                        Resetting...
                      </>
                    ) : (
                      'Yes, Reset Fixtures'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Lock Time Modal */}
        {showEditLockTimeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
              <div className="p-6">
                <h2 className="text-xl font-bold text-slate-900 mb-4">Edit Lock Time</h2>
                <p className="text-slate-600 mb-4">
                  Update the lock time for Round {currentRound?.round_number}
                </p>
                
                <div className="mb-4">
                  <label htmlFor="edit-lock-time" className="block text-sm font-medium text-slate-700 mb-2">
                    Lock Time
                  </label>
                  <input
                    type="datetime-local"
                    id="edit-lock-time"
                    value={editedLockTime}
                    onChange={(e) => setEditedLockTime(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                  />
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      setShowEditLockTimeModal(false);
                      setEditedLockTime('');
                    }}
                    className="flex-1 px-4 py-2 text-slate-600 hover:text-slate-800 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={updateLockTime}
                    disabled={!editedLockTime}
                    className="flex-1 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 disabled:bg-slate-300 disabled:cursor-not-allowed font-medium transition-colors"
                  >
                    Update
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Round Lock Time Extended Modal */}
        {showExtendTimeModal && extendedRound && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
              <div className="p-6">
                <h3 className="text-lg text-slate-900 mb-4">
                  Round {extendedRound.round_number} Lock Time Extended
                </h3>
                
                <div className="mb-6">
                  <p className="text-slate-600 mb-3">
                    Round {extendedRound.round_number} was created but the lock time had expired before fixtures were added.
                  </p>
                  
                  {extendingRound ? (
                    <div className="flex items-center text-slate-600 mb-3">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-600 border-t-transparent mr-2"></div>
                      <span className="text-sm">Extending lock time...</span>
                    </div>
                  ) : (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
                      <p className="text-green-700 text-sm font-medium">
                        ✓ Lock time has been automatically extended to next Friday at 6:00 PM so you can add fixtures.
                      </p>
                    </div>
                  )}
                  
                  <p className="text-slate-500 text-sm">
                    You can change the lock time later if needed using the settings.
                  </p>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => setShowExtendTimeModal(false)}
                    disabled={extendingRound}
                    className="px-6 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 disabled:bg-slate-400 disabled:cursor-not-allowed font-medium transition-colors"
                  >
                    {extendingRound ? 'Extending...' : 'Continue to Add Fixtures'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Admin Pick Modal */}
        {showAdminPickModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-slate-900">Set Player Pick</h3>
                  <button
                    onClick={() => {
                      setShowAdminPickModal(false);
                      setAdminSelectedPlayer(null);
                      setAdminSelectedTeam('');
                      setAdminPickTeams([]);
                      setAdminAllowedTeamNames(new Set());
                    }}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Player Selection */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Select Player
                    </label>
                    <select
                      value={adminSelectedPlayer || ''}
                      onChange={(e) => {
                        const playerId = e.target.value ? parseInt(e.target.value) : null;
                        setAdminSelectedPlayer(playerId);
                        setAdminSelectedTeam('');
                        setAdminPickTeams([]);
                        setAdminAllowedTeamNames(new Set());
                        if (playerId) {
                          loadAdminPickAllowedTeams(playerId);
                        }
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                    >
                      <option value="">Choose a player...</option>
                      {adminPickPlayers.map((player) => (
                        <option key={player.id} value={player.id}>
                          {player.display_name} {player.status === 'eliminated' ? '(OUT)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Team Selection */}
                  {adminSelectedPlayer && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Select Team
                      </label>
                      <select
                        value={adminSelectedTeam}
                        onChange={(e) => setAdminSelectedTeam(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                      >
                        <option value="">Choose a team...</option>
                        {adminPickTeams.map((team, index) => {
                          const isAllowed = adminAllowedTeamNames.has(team.name) || adminAllowedTeamNames.has(team.short_name);
                          return (
                            <option key={`${team.id}-${team.name}-${index}`} value={team.name}>
                              {isAllowed ? team.name : `❌ ${team.name}`}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex space-x-3 mt-6">
                  <button
                    onClick={() => {
                      setShowAdminPickModal(false);
                      setAdminSelectedPlayer(null);
                      setAdminSelectedTeam('');
                      setAdminPickTeams([]);
                      setAdminAllowedTeamNames(new Set());
                    }}
                    disabled={adminSettingPick}
                    className="flex-1 px-4 py-2 text-slate-600 hover:text-slate-800 font-medium transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSetPlayerPick}
                    disabled={!adminSelectedPlayer || !adminSelectedTeam || adminSettingPick}
                    className="flex-1 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 disabled:bg-slate-300 disabled:cursor-not-allowed font-medium transition-colors"
                  >
                    {adminSettingPick ? 'Setting Pick...' : 'Set Pick'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}