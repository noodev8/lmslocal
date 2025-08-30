'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import ErrorBoundary from '@/components/ErrorBoundary';
import Link from 'next/link';
import { 
  TrophyIcon,
  PlusIcon,
  UserGroupIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowLeftIcon,
  Cog6ToothIcon,
  CalendarIcon,
  PlayIcon,
  PauseIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { competitionApi, roundApi, fixtureApi, teamApi, adminApi } from '@/lib/api';

interface Competition {
  id: number;
  name: string;
  status: 'LOCKED' | 'UNLOCKED' | 'SETUP';
  player_count?: number;
  description?: string;
  invite_code?: string;
  slug?: string;
}

interface Round {
  id: number;
  round_number: number;
  lock_time?: string;
  status?: string;
  fixture_count?: number;
  is_current?: boolean;
}


interface Team {
  id: number;
  name: string;
  short_name: string;
}

interface PendingFixture {
  home_team: string;
  away_team: string;
}

export default function ManageCompetitionPage() {
  const router = useRouter();
  const params = useParams();
  const competitionId = params.id as string;

  const [competition, setCompetition] = useState<Competition | null>(null);
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateRoundModal, setShowCreateRoundModal] = useState(false);
  const [newRoundLockTime, setNewRoundLockTime] = useState('');
  
  // Admin pick management state
  const [players, setPlayers] = useState<any[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [settingPick, setSettingPick] = useState(false);
  const [showAdminPickModal, setShowAdminPickModal] = useState(false);

  const getNextFriday6PM = () => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 5 = Friday
    const daysUntilFriday = dayOfWeek <= 5 ? (5 - dayOfWeek) : (7 - dayOfWeek + 5);
    
    const nextFriday = new Date(now);
    nextFriday.setDate(now.getDate() + daysUntilFriday);
    nextFriday.setHours(18, 0, 0, 0); // 6:00 PM
    
    return nextFriday.toISOString();
  };

  // Fixture creation state
  const [teams, setTeams] = useState<Team[]>([]);
  const [pendingFixtures, setPendingFixtures] = useState<PendingFixture[]>([]);
  const [nextSelection, setNextSelection] = useState<'home' | 'away'>('home');
  const [selectedHomeTeam, setSelectedHomeTeam] = useState<string | null>(null);
  const [usedTeams, setUsedTeams] = useState<Set<string>>(new Set());
  const [isEditingCutoff, setIsEditingCutoff] = useState(false);
  const [newCutoffTime, setNewCutoffTime] = useState('');
  const [isSavingFixtures, setIsSavingFixtures] = useState(false);
  const hasInitialized = useRef(false);

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

    hasInitialized.current = true;
    loadCompetitionData();
    loadTeams();
  }, [competitionId, router]);

  const loadCompetitionData = async () => {
    try {
      // Load competition details and status in one go
      const [competitions, status] = await Promise.all([
        competitionApi.getMyCompetitions(),
        competitionApi.getStatus(parseInt(competitionId))
      ]);

      // Check competition access
      if (competitions.data.return_code === 'SUCCESS') {
        const comp = competitions.data.competitions.find(c => c.id.toString() === competitionId);
        if (comp && comp.is_organiser) {
          setCompetition(comp);
        } else {
          router.push('/dashboard');
          return;
        }
      }

      // Handle routing based on status
      if (status.data.return_code === 'SUCCESS') {
        if (status.data.should_route_to_results) {
          // Has fixtures - go to results
          router.push(`/competition/${competitionId}/results`);
          return;
        }
        
        if (status.data.current_round) {
          // Has round but no fixtures - stay here and load fixture creation
          setCurrentRound(status.data.current_round);
          loadFixtures(status.data.current_round.id);
        } else {
          // No rounds - create first round
          createFirstRound();
        }
      }

    } catch (error) {
      console.error('Failed to load competition data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFixtures = async (roundId: number) => {
    if (!roundId) {
      console.warn('loadFixtures called with invalid roundId:', roundId);
      return;
    }
    
    try {
      const response = await fixtureApi.get(roundId.toString());
      if (response.data.return_code === 'SUCCESS') {
        const existingFixtures = response.data.fixtures || [];
        
        // Convert existing fixtures to pending fixtures format
        const pendingFromExisting = existingFixtures.map((fixture: any) => ({
          home_team: fixture.home_team_short,
          away_team: fixture.away_team_short
        }));
        
        setPendingFixtures(pendingFromExisting);
        
        // Track used teams
        const used = new Set<string>();
        existingFixtures.forEach((fixture: any) => {
          used.add(fixture.home_team_short);
          used.add(fixture.away_team_short);
        });
        setUsedTeams(used);
      } else {
        console.error('Failed to load fixtures:', response.data);
      }
    } catch (error) {
      console.error('Failed to load fixtures:', error);
      // Reset state on error
      setPendingFixtures([]);
      setUsedTeams(new Set());
    }
  };

  const createFirstRound = async () => {
    try {
      const response = await roundApi.create(competitionId, getNextFriday6PM());
      
      if (response.data.return_code === 'SUCCESS') {
        // Set the round directly instead of reloading (prevents race condition)
        setCurrentRound({
          id: response.data.round.id,
          round_number: response.data.round.round_number,
          lock_time: response.data.round.lock_time,
          status: response.data.round.status || 'UNLOCKED',
          created_at: response.data.round.created_at
        });
        // Round created successfully
      }
    } catch (error) {
      console.error('Failed to create first round:', error);
    }
  };

  const openCreateRoundModal = () => {
    if (!currentRound) return;
    
    // Set default to next Friday 6 PM in local datetime format
    const defaultTime = getNextFriday6PM().slice(0, 16); // Remove timezone info for datetime-local input
    setNewRoundLockTime(defaultTime);
    setShowCreateRoundModal(true);
  };

  const handleCreateRound = async () => {
    if (!newRoundLockTime) return;
    
    try {
      const isoDateTime = new Date(newRoundLockTime).toISOString();
      const response = await roundApi.create(competitionId, isoDateTime);
      
      if (response.data.return_code === 'SUCCESS') {
        setShowCreateRoundModal(false);
        setNewRoundLockTime('');
        loadCompetitionData(); // Reload to show new round
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
  };

  const toggleRoundLock = async () => {
    if (!currentRound) return;
    
    // This would call a lock/unlock API endpoint
    console.log('Toggle lock for round', currentRound.id);
    // TODO: Implement lock/unlock API call
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

  const handleTeamSelect = (team: Team) => {
    if (usedTeams.has(team.short_name)) {
      return; // Team already used
    }

    if (nextSelection === 'home') {
      setSelectedHomeTeam(team.short_name);
      setNextSelection('away');
      setUsedTeams(prev => new Set([...prev, team.short_name]));
    } else {
      // Away team selected - create fixture
      if (selectedHomeTeam) {
        const newFixture: PendingFixture = {
          home_team: selectedHomeTeam,
          away_team: team.short_name
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
    
    // Remove teams from used set
    setUsedTeams(prev => {
      const newSet = new Set(prev);
      newSet.delete(fixture.home_team);
      newSet.delete(fixture.away_team);
      return newSet;
    });
  };

  const savePendingFixtures = async () => {
    if (!currentRound || pendingFixtures.length === 0 || isSavingFixtures) return;

    setIsSavingFixtures(true);
    
    try {
      // Add kickoff_time for API call (backend still expects it)
      const defaultKickoffTime = currentRound.lock_time || new Date().toISOString();
      const fixturesWithTime = pendingFixtures.map(fixture => ({
        ...fixture,
        kickoff_time: defaultKickoffTime
      }));

      const response = await fixtureApi.addBulk(currentRound.id.toString(), fixturesWithTime);
      
      if (response.data.return_code === 'SUCCESS') {
        // Go straight to results page after confirming fixtures
        router.push(`/competition/${competitionId}/results`);
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

  const startEditingCutoff = () => {
    if (currentRound?.lock_time) {
      // Convert to datetime-local format
      const date = new Date(currentRound.lock_time);
      const localDateTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, -1);
      setNewCutoffTime(localDateTime);
    } else {
      setNewCutoffTime('');
    }
    setIsEditingCutoff(true);
  };

  const cancelEditingCutoff = () => {
    setIsEditingCutoff(false);
    setNewCutoffTime('');
  };

  const saveCutoffTime = async () => {
    if (!currentRound || !newCutoffTime) return;

    try {
      const isoDateTime = new Date(newCutoffTime).toISOString();
      const response = await roundApi.update(currentRound.id.toString(), isoDateTime);
      
      if (response.data.return_code === 'SUCCESS') {
        // Update local state
        setCurrentRound(prev => prev ? { ...prev, lock_time: isoDateTime } : null);
        setIsEditingCutoff(false);
        alert('Cut-off time updated successfully!');
      } else {
        alert('Failed to update cut-off time: ' + (response.data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Update cut-off time error:', error);
      alert('Failed to update cut-off time');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'UNLOCKED': return 'text-green-600 bg-green-50';
      case 'LOCKED': return 'text-orange-600 bg-orange-50';
      case 'SETUP': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'UNLOCKED': return <PlayIcon className="h-4 w-4" />;
      case 'LOCKED': return <PauseIcon className="h-4 w-4" />;
      case 'SETUP': return <ExclamationTriangleIcon className="h-4 w-4" />;
      default: return <ClockIcon className="h-4 w-4" />;
    }
  };

  // Admin pick management functions
  const loadPlayers = async () => {
    if (!competition) return;
    
    try {
      const response = await competitionApi.getPlayers(parseInt(competitionId));
      if (response.data.return_code === 'SUCCESS') {
        setPlayers(response.data.players.filter(p => p.status !== 'OUT'));
      }
    } catch (error) {
      console.error('Failed to load players:', error);
    }
  };

  const handleSetPlayerPick = async () => {
    if (!selectedPlayer || !selectedTeam || !competition) return;
    
    setSettingPick(true);
    try {
      const response = await adminApi.setPlayerPick(competition.id, selectedPlayer, selectedTeam);
      if (response.data.return_code === 'SUCCESS') {
        alert(`Pick set successfully for ${response.data.pick.player_name}: ${response.data.pick.team}`);
        setShowAdminPickModal(false);
        setSelectedPlayer(null);
        setSelectedTeam('');
      } else {
        alert(`Failed to set pick: ${response.data.message}`);
      }
    } catch (error) {
      console.error('Failed to set player pick:', error);
      alert('Failed to set pick. Please try again.');
    } finally {
      setSettingPick(false);
    }
  };

  const openAdminPickModal = async () => {
    await loadPlayers();
    setShowAdminPickModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Show header immediately */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center">
                <Link href="/dashboard" className="flex items-center text-gray-600 hover:text-gray-900 mr-4">
                  <ArrowLeftIcon className="h-5 w-5 mr-2" />
                  Dashboard
                </Link>
                <TrophyIcon className="h-8 w-8 text-green-600" />
                <span className="ml-2 text-xl font-bold text-gray-900">Manage Competition</span>
              </div>
            </div>
          </div>
        </header>
        
        {/* Loading content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
                <p className="text-gray-500">Loading competition...</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!competition) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Competition Not Found</h1>
          <Link href="/dashboard" className="text-green-600 hover:text-green-700">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Link href="/dashboard" className="flex items-center text-gray-600 hover:text-gray-900 mr-4">
                <ArrowLeftIcon className="h-5 w-5 mr-2" />
                Dashboard
              </Link>
              <TrophyIcon className="h-8 w-8 text-green-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">Manage Competition</span>
            </div>
            <div className="flex items-center space-x-4">
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Competition Overview */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{competition.name}</h1>
              {competition.description && (
                <p className="text-gray-600 mb-4">{competition.description}</p>
              )}
              <div className="flex items-center space-x-6 text-sm text-gray-600">
                <div className="flex items-center">
                  <UserGroupIcon className="h-4 w-4 mr-1" />
                  <span>{competition.player_count || 0} players</span>
                </div>
              </div>
            </div>
            <button
              className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              <Cog6ToothIcon className="h-4 w-4 mr-2" />
              Competition Settings
            </button>
          </div>
        </div>

        {/* Current Round Section */}
        {currentRound && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-2">
                  <h2 className="text-4xl font-bold text-gray-900">Round {currentRound.round_number}</h2>
                </div>
                
                <div className="text-xl text-gray-600 mb-3">
                  <ClockIcon className="h-6 w-6 inline mr-2" />
                  {isEditingCutoff ? (
                    <div className="inline-flex items-center gap-2">
                      <span>Choose picks by:</span>
                      <input
                        type="datetime-local"
                        value={newCutoffTime}
                        onChange={(e) => setNewCutoffTime(e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded text-base"
                      />
                      <button
                        onClick={saveCutoffTime}
                        className="p-1 text-green-600 hover:text-green-700"
                      >
                        <CheckIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={cancelEditingCutoff}
                        className="p-1 text-red-600 hover:text-red-700"
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2">
                      <span>Choose picks by: {currentRound.lock_time ? new Date(currentRound.lock_time).toLocaleString(undefined, { 
                        weekday: 'long',
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric', 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      }) : 'Not set'}</span>
                      <button
                        onClick={startEditingCutoff}
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
                
              </div>
              
              <div className="mt-6 lg:mt-0 flex gap-3 flex-wrap">
                {currentRound && 
                 currentRound.fixture_count > 0 && 
                 new Date() < new Date(currentRound.lock_time) && (
                  <button
                    onClick={openAdminPickModal}
                    className="inline-flex items-center px-4 py-2 border border-blue-300 bg-blue-50 text-blue-700 rounded-lg font-medium hover:bg-blue-100 hover:border-blue-400 transition-colors text-sm"
                  >
                    <UserGroupIcon className="h-4 w-4 mr-2" />
                    Set Player Pick
                  </button>
                )}
                {pendingFixtures.length > 0 && (
                  <button
                    onClick={savePendingFixtures}
                    disabled={isSavingFixtures}
                    className={`inline-flex items-center px-4 py-2 border rounded-lg font-medium transition-all duration-200 text-sm ${
                      isSavingFixtures
                        ? 'border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed'
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400'
                    }`}
                  >
                    {isSavingFixtures ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                        Saving Fixtures...
                      </>
                    ) : (
                      <>
                        <CheckCircleIcon className="h-4 w-4 mr-2 text-green-600" />
                        Confirm Fixtures ({pendingFixtures.length})
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-8">
          {/* Fixtures Management Section */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            {!currentRound ? (
              <div className="text-center py-12 text-gray-500">
                <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p>Creating your first round...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Team Selection for Adding Fixtures */}
                <div>
                  <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">

                    {/* Team Selection Cards - Smaller */}
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 mb-4">
                      {teams.map((team) => {
                        const isUsed = usedTeams.has(team.short_name);
                        const isSelectedHome = selectedHomeTeam === team.short_name;
                        
                        return (
                          <button
                            key={team.id}
                            onClick={() => handleTeamSelect(team)}
                            disabled={isUsed && !isSelectedHome}
                            className={`p-2 rounded-md border font-medium text-xs transition-all ${
                              isSelectedHome
                                ? 'border-gray-400 bg-gray-200 text-gray-800'
                                : isUsed
                                ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50'
                            }`}
                          >
                            <div className="font-bold text-sm">{team.short_name}</div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Pending Fixtures Preview */}
                    {pendingFixtures.length > 0 && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {pendingFixtures.map((fixture, index) => (
                            <div key={index} className="flex items-center justify-between bg-white border border-gray-200 rounded px-3 py-2">
                              <span className="text-sm font-medium">
                                {fixture.home_team} vs {fixture.away_team}
                              </span>
                              <button
                                onClick={() => removePendingFixture(index)}
                                className="text-red-500 hover:text-red-700 text-xs"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}


          </div>
        </div>
      </main>

      {/* Create New Round Modal */}
      {showCreateRoundModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Create New Round</h2>
              <button
                onClick={cancelCreateRound}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-600 mb-4">
                This will create Round {currentRound ? currentRound.round_number + 1 : 1} and reset fixtures.
              </p>
              
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Make picks by (deadline):
              </label>
              <input
                type="datetime-local"
                value={newRoundLockTime}
                onChange={(e) => setNewRoundLockTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                Players must make their picks before this time
              </p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={cancelCreateRound}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateRound}
                disabled={!newRoundLockTime}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Create Round
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Pick Modal */}
      {showAdminPickModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Set Player Pick</h3>
              <button
                onClick={() => setShowAdminPickModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Player Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Player
                </label>
                <select
                  value={selectedPlayer || ''}
                  onChange={(e) => setSelectedPlayer(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Choose a player...</option>
                  {players.map((player, index) => (
                    <option key={`player-${player.user_id}-${index}`} value={player.user_id}>
                      {player.display_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Team Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Team
                </label>
                <select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Choose a team...</option>
                  {teams.map((team, index) => (
                    <option key={`team-${team.id}-${index}`} value={team.name}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAdminPickModal(false)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSetPlayerPick}
                disabled={!selectedPlayer || !selectedTeam || settingPick}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {settingPick ? 'Setting Pick...' : 'Set Pick'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      </div>
    </ErrorBoundary>
  );
}