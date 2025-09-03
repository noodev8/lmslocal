'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import ErrorBoundary from '@/components/ErrorBoundary';
import Link from 'next/link';
import { 
  TrophyIcon,
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
  XMarkIcon,
  ChartBarIcon,
  ClipboardDocumentIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import { competitionApi, roundApi, fixtureApi, teamApi, adminApi, Competition, Team, Player } from '@/lib/api';

// Simple Progress Chart Component
const ProgressChart = ({ 
  title, 
  value, 
  maxValue = 100, 
  color = "emerald", 
  showLabel = true,
  icon: Icon
}: {
  title: string;
  value: number;
  maxValue?: number;
  color?: string;
  showLabel?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}) => {
  const percentage = Math.min((value / maxValue) * 100, 100);
  
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          {Icon && <Icon className="h-5 w-5 text-slate-600 mr-2" />}
          <h3 className="text-sm font-medium text-slate-700">{title}</h3>
        </div>
        {showLabel && (
          <span className={`text-lg font-bold text-${color}-600`}>{value}</span>
        )}
      </div>
      <div className="w-full bg-slate-200 rounded-full h-3">
        <div 
          className={`bg-${color}-500 h-3 rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {maxValue !== 100 && (
        <p className="text-xs text-slate-500 mt-2">of {maxValue}</p>
      )}
    </div>
  );
};


interface Round {
  id: number;
  round_number: number;
  lock_time?: string;
  status?: string;
  fixture_count?: number;
  is_current?: boolean;
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
  const [players, setPlayers] = useState<Array<{ id: number; display_name: string; email?: string }>>([]);
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
  }, [competitionId, router]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadCompetitionData = useCallback(async () => {
    try {
      // Load competition details and status in one go
      const [competitions, status] = await Promise.all([
        competitionApi.getMyCompetitions(),
        competitionApi.getStatus(parseInt(competitionId))
      ]);

      // Check competition access
      if (competitions.data.return_code === 'SUCCESS') {
        const comp = (competitions.data.competitions as Competition[]).find((c: Competition) => c.id.toString() === competitionId);
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
          setCurrentRound(status.data.current_round as Round);
          await loadFixtures((status.data.current_round as Round).id);
        } else {
          // No rounds - show first round creation modal with important messaging
          setShowCreateRoundModal(true);
          const defaultTime = getNextFriday6PM().slice(0, 16);
          setNewRoundLockTime(defaultTime);
        }
      }

    } catch (error) {
      console.error('Failed to load competition data:', error);
    } finally {
      setLoading(false);
    }
  }, [competitionId, router]);

  const loadFixtures = async (roundId: number) => {
    if (!roundId) {
      console.warn('loadFixtures called with invalid roundId:', roundId);
      return;
    }
    
    try {
      const response = await fixtureApi.get(roundId.toString());
      if (response.data.return_code === 'SUCCESS') {
        const existingFixtures = (response.data.fixtures as { home_team_short: string; away_team_short: string }[]) || [];
        
        // Convert existing fixtures to pending fixtures format
        const pendingFromExisting = existingFixtures.map((fixture: { home_team_short: string; away_team_short: string }) => ({
          home_team: fixture.home_team_short,
          away_team: fixture.away_team_short
        }));
        
        // Track used teams
        const used = new Set<string>();
        existingFixtures.forEach((fixture: { home_team_short: string; away_team_short: string }) => {
          used.add(fixture.home_team_short);
          used.add(fixture.away_team_short);
        });
        
        // Batch state updates to prevent multiple re-renders
        setPendingFixtures(pendingFromExisting);
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const createFirstRound = async () => {
    try {
      const response = await roundApi.create(competitionId, getNextFriday6PM());
      
      if (response.data.return_code === 'SUCCESS') {
        // Set the round directly instead of reloading (prevents race condition)
        const roundData = response.data.round as { id: number; round_number: number; lock_time: string; status: string; created_at: string };
        setCurrentRound({
          id: roundData.id,
          round_number: roundData.round_number,
          lock_time: roundData.lock_time,
          status: roundData.status || 'UNLOCKED'
        });
        // Round created successfully
      }
    } catch (error) {
      console.error('Failed to create first round:', error);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const toggleRoundLock = async () => {
    if (!currentRound) return;
    
    // This would call a lock/unlock API endpoint
    console.log('Toggle lock for round', currentRound.id);
    // TODO: Implement lock/unlock API call
  };

  const loadTeams = useCallback(async () => {
    try {
      const response = await teamApi.getTeams();
      if (response.data.return_code === 'SUCCESS') {
        setTeams((response.data.teams as Team[]) || []);
      }
    } catch (error) {
      console.error('Failed to load teams:', error);
    }
  }, []);

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
      case 'UNLOCKED': return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'LOCKED': return 'text-amber-700 bg-amber-50 border-amber-200';
      case 'SETUP': return 'text-slate-600 bg-slate-50 border-slate-200';
      default: return 'text-slate-600 bg-slate-50 border-slate-200';
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
        setPlayers((response.data.players as Player[]).filter(p => p.status !== 'OUT'));
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
        const pick = response.data.pick as { player_name: string; team: string };
        alert(`Pick set successfully for ${pick.player_name}: ${pick.team}`);
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
      <div className="min-h-screen bg-slate-50">
        {/* Header with loading state */}
        <header className="bg-white border-b border-slate-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <Link href={`/competition/${competitionId}/dashboard`} className="flex items-center space-x-2 text-slate-600 hover:text-slate-800 transition-colors">
                  <ArrowLeftIcon className="h-5 w-5" />
                  <span className="font-medium">Back to Dashboard</span>
                </Link>
                <div className="h-6 w-px bg-slate-300" />
                <div className="flex items-center space-x-3">
                  <TrophyIcon className="h-6 w-6 text-blue-600" />
                  <h1 className="text-lg font-semibold text-slate-900">Competition Management</h1>
                </div>
              </div>
            </div>
          </div>
        </header>
        
        <main className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
            <div className="flex items-center justify-center">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-50 rounded-full mb-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">Loading Competition</h3>
                <p className="text-slate-500">Please wait while we fetch your competition data...</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!competition) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-50 rounded-full mb-4">
            <ExclamationTriangleIcon className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900 mb-2">Competition Not Found</h1>
          <p className="text-slate-500 mb-6">The competition you&apos;re looking for doesn&apos;t exist or you don&apos;t have permission to access it.</p>
          <Link 
            href="/dashboard" 
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Return to Main Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50">
        {/* Material 3 Style Header */}
        <header className="bg-white border-b border-slate-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <Link href={`/competition/${competitionId}/dashboard`} className="flex items-center space-x-2 text-slate-600 hover:text-slate-800 transition-colors">
                  <ArrowLeftIcon className="h-5 w-5" />
                  <span className="font-medium">Back to Dashboard</span>
                </Link>
                <div className="h-6 w-px bg-slate-300" />
                <div className="flex items-center space-x-3">
                  <TrophyIcon className="h-6 w-6 text-blue-600" />
                  <h1 className="text-lg font-semibold text-slate-900">Competition Management</h1>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <Link
                  href={`/competition/${competitionId}/players`}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  <EyeIcon className="h-4 w-4 mr-2" />
                  View Players
                </Link>
                <button className="inline-flex items-center px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
                  <Cog6ToothIcon className="h-4 w-4 mr-2" />
                  Settings
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
          {/* Competition Overview Card - Material 3 Style */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-8">
            <div className="px-8 py-6 border-b border-slate-100">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">{competition.name}</h2>
                  {competition.description && (
                    <p className="text-slate-600 mb-4">{competition.description}</p>
                  )}
                  <div className="flex items-center space-x-6">
                    <div className="flex items-center space-x-2 text-slate-600">
                      <UserGroupIcon className="h-5 w-5" />
                      <span className="text-sm font-medium">{competition.player_count || 0} players</span>
                    </div>
                    {competition.invite_code && (
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-slate-500">Code:</span>
                        <div className="flex items-center space-x-2 bg-blue-50 px-3 py-1 rounded-lg">
                          <code className="text-sm font-mono font-semibold text-blue-700">{competition.invite_code}</code>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(competition.invite_code || '');
                            }}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <ClipboardDocumentIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Current Round Status */}
            {currentRound && (
              <div className="px-8 py-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-4 mb-4">
                      <h3 className="text-3xl font-bold text-slate-900">Round {currentRound.round_number}</h3>
                      <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(currentRound.status || 'SETUP')}`}>
                        {getStatusIcon(currentRound.status || 'SETUP')}
                        <span className="ml-2">
                          {currentRound.status === 'UNLOCKED' ? 'Active' :
                           currentRound.status === 'LOCKED' ? 'Locked' : 'Setup'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 text-slate-600">
                      <ClockIcon className="h-5 w-5" />
                      {isEditingCutoff ? (
                        <div className="flex items-center space-x-3">
                          <span className="text-sm">Pick deadline:</span>
                          <input
                            type="datetime-local"
                            value={newCutoffTime}
                            onChange={(e) => setNewCutoffTime(e.target.value)}
                            className="px-3 py-1 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <button
                            onClick={saveCutoffTime}
                            className="p-1 text-emerald-600 hover:text-emerald-700"
                          >
                            <CheckIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={cancelEditingCutoff}
                            className="p-1 text-slate-400 hover:text-slate-600"
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-3">
                          <span className="text-sm">
                            Pick deadline: {currentRound.lock_time ? new Date(currentRound.lock_time).toLocaleString(undefined, { 
                              weekday: 'short',
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric', 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            }) : 'Not set'}
                          </span>
                          <button
                            onClick={startEditingCutoff}
                            className="p-1 text-slate-400 hover:text-slate-600"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    {currentRound && 
                     (currentRound.fixture_count || 0) > 0 && 
                     currentRound.lock_time && new Date() < new Date(currentRound.lock_time) && (
                      <button
                        onClick={openAdminPickModal}
                        className="inline-flex items-center px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 hover:text-slate-900 transition-all duration-200 border border-slate-200 shadow-sm hover:shadow-md"
                      >
                        <UserGroupIcon className="h-4 w-4 mr-2" />
                        Set Player Pick
                      </button>
                    )}
                    {pendingFixtures.length > 0 && (
                      <button
                        onClick={savePendingFixtures}
                        disabled={isSavingFixtures}
                        className={`inline-flex items-center px-6 py-2 rounded-lg font-medium transition-all ${
                          isSavingFixtures
                            ? 'bg-slate-50 text-slate-400 cursor-not-allowed border border-slate-200'
                            : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                        }`}
                      >
                        {isSavingFixtures ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-300 border-t-slate-600 mr-2"></div>
                            Saving...
                          </>
                        ) : (
                          <>
                            <CheckCircleIcon className="h-4 w-4 mr-2" />
                            Confirm {pendingFixtures.length} Fixtures
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Stats - Progress Chart */}
          {currentRound && competition.player_count && (
            <div className="mb-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <ProgressChart
                  title="Players Made Picks"
                  value={Math.floor(competition.player_count * 0.75)} // Demo: 75% have picked
                  maxValue={competition.player_count}
                  color="emerald"
                  icon={UserGroupIcon}
                />
                <ProgressChart
                  title="Competition Progress"
                  value={currentRound.round_number}
                  maxValue={38}
                  color="blue"
                  icon={TrophyIcon}
                />
                <ProgressChart
                  title="Fixtures Created"
                  value={pendingFixtures.length}
                  maxValue={10}
                  color="amber"
                  icon={ChartBarIcon}
                />
              </div>
            </div>
          )}

          {/* Fixtures Management Section */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-8 py-6 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Fixture Management</h3>
                  <p className="text-sm text-slate-500 mt-1">Select teams to create fixtures for this round</p>
                </div>
                {currentRound && (
                  <div className="flex items-center space-x-2 text-sm text-slate-600">
                    <ChartBarIcon className="h-4 w-4" />
                    <span>{pendingFixtures.length} fixtures created</span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-8">
              {competition?.status === 'COMPLETE' ? (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mb-4">
                    <TrophyIcon className="h-8 w-8 text-emerald-600" />
                  </div>
                  <h4 className="text-lg font-medium text-slate-900 mb-2">Competition Complete!</h4>
                  <p className="text-slate-500 mb-6">This competition has finished. All results have been calculated.</p>
                  <div className="flex justify-center space-x-3">
                    <Link
                      href={`/play/${competitionId}/standings?from=admin`}
                      className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                      <TrophyIcon className="h-4 w-4 mr-2" />
                      View Final Standings
                    </Link>
                    <Link
                      href={`/competition/${competitionId}/dashboard`}
                      className="inline-flex items-center px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
                    >
                      Back to Dashboard
                    </Link>
                  </div>
                </div>
              ) : currentRound ? (
                <div className="space-y-8">
                  {/* Team Selection Grid */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium text-slate-900">
                        {nextSelection === 'home' ? 'Select Home Team' : selectedHomeTeam ? `Select Away Team (vs ${selectedHomeTeam})` : 'Select Teams'}
                      </h4>
                      <div className="text-sm text-slate-500">
                        {nextSelection === 'home' ? 'Step 1 of 2' : 'Step 2 of 2'}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-3">
                      {teams.map((team) => {
                        const isUsed = usedTeams.has(team.short_name);
                        const isSelectedHome = selectedHomeTeam === team.short_name;
                        
                        return (
                          <button
                            key={team.id}
                            onClick={() => handleTeamSelect(team)}
                            disabled={isUsed && !isSelectedHome}
                            className={`relative p-3 rounded-xl border-2 font-semibold text-sm transition-all duration-200 ${
                              isSelectedHome
                                ? 'border-blue-400 bg-blue-50 text-blue-700 shadow-sm'
                                : isUsed
                                ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm'
                            }`}
                          >
                            <div className="text-center">
                              <div className="font-bold text-base">{team.short_name}</div>
                            </div>
                            {isSelectedHome && (
                              <div className="absolute -top-2 -right-2 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                                <CheckIcon className="h-3 w-3 text-white" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Pending Fixtures Preview */}
                  {pendingFixtures.length > 0 && (
                    <div>
                      <h4 className="font-medium text-slate-900 mb-4">Created Fixtures</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {pendingFixtures.map((fixture, index) => (
                          <div key={index} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                            <div className="flex items-center space-x-3">
                              <span className="font-semibold text-slate-900">{fixture.home_team}</span>
                              <span className="text-slate-400">vs</span>
                              <span className="font-semibold text-slate-900">{fixture.away_team}</span>
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
                </div>
              ) : loading ? (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-slate-400 border-t-transparent"></div>
                  </div>
                  <h4 className="text-lg font-medium text-slate-900 mb-2">Loading Fixtures</h4>
                  <p className="text-slate-500">Please wait...</p>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4">
                    <CalendarIcon className="h-8 w-8 text-slate-400" />
                  </div>
                  <h4 className="text-lg font-medium text-slate-900 mb-2">No rounds created yet</h4>
                  <p className="text-slate-500">Create your first round to get started...</p>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Create New Round Modal - Material 3 Style */}
        {showCreateRoundModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50">
            <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl">
              <div className="px-8 py-6 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-slate-900">
                    {currentRound ? 'Create New Round' : 'Set Up Round 1'}
                  </h3>
                  <button
                    onClick={cancelCreateRound}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>
              </div>
              
              <div className="px-8 py-6">
                {!currentRound && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <ExclamationTriangleIcon className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-blue-900 mb-2">Important: Set Your Pick Deadline Carefully</h4>
                        <ul className="text-sm text-blue-800 space-y-1">
                          <li>• Give players time to join your competition</li>
                          <li>• Allow time for picks before fixtures start</li>
                          <li>• Consider time zones if players are in different locations</li>
                          <li>• You can change this later if needed</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="mb-6">
                  {currentRound ? (
                    <p className="text-slate-600 mb-4">
                      This will create Round {currentRound.round_number + 1} and reset fixtures.
                    </p>
                  ) : (
                    <p className="text-slate-700 mb-4 font-medium">
                      When should players make their picks by?
                    </p>
                  )}
                  
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    Pick Deadline
                  </label>
                  <input
                    type="datetime-local"
                    value={newRoundLockTime}
                    onChange={(e) => setNewRoundLockTime(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                    required
                  />
                  <p className="text-sm text-slate-500 mt-2">
                    Recommended: Set this 1-2 hours before your first fixtures kick off
                  </p>
                </div>
              </div>
              
              <div className="px-8 py-6 bg-slate-50 rounded-b-2xl">
                <div className="flex space-x-3">
                  <button
                    onClick={cancelCreateRound}
                    className="flex-1 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateRound}
                    disabled={!newRoundLockTime}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                  >
                    Create Round
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Admin Pick Modal - Material 3 Style */}
        {showAdminPickModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
              <div className="px-8 py-6 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-slate-900">Set Player Pick</h3>
                  <button
                    onClick={() => setShowAdminPickModal(false)}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>
              </div>

              <div className="px-8 py-6">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-3">
                      Select Player
                    </label>
                    <select
                      value={selectedPlayer || ''}
                      onChange={(e) => setSelectedPlayer(e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      <option value="">Choose a player...</option>
                      {players.map((player, index) => (
                        <option key={`player-${player.id}-${index}`} value={player.id}>
                          {player.display_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-3">
                      Select Team
                    </label>
                    <select
                      value={selectedTeam}
                      onChange={(e) => setSelectedTeam(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              </div>

              <div className="px-8 py-6 bg-slate-50 rounded-b-2xl">
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowAdminPickModal(false)}
                    className="flex-1 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSetPlayerPick}
                    disabled={!selectedPlayer || !selectedTeam || settingPick}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                  >
                    {settingPick ? 'Setting Pick...' : 'Set Pick'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}