import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { token, authenticated, competition } from '../../lib/api';

export default function PlayerDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [competitionsLoading, setCompetitionsLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [userCompetitions, setUserCompetitions] = useState([]);
  const [competitionRounds, setCompetitionRounds] = useState({});

  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    const jwt = token.get();
    
    if (!jwt) {
      router.push('/login');
      return;
    }

    try {
      const result = await authenticated.getProfile(jwt);
      
      if (result.success) {
        setUser(result.data);
        // Load user's competitions after authentication
        await loadUserCompetitions();
      } else {
        token.remove();
        router.push('/login');
        return;
      }
    } catch (error) {
      setError('Failed to load user profile');
      console.error('❌ Player dashboard auth check failed:', error);
    }

    setLoading(false);
  };

  const loadUserCompetitions = async () => {
    setCompetitionsLoading(true);
    try {
      console.log('📋 Loading user competitions');
      const result = await competition.getUserCompetitions();
      
      if (result.success) {
        setUserCompetitions(result.data.competitions || []);
        console.log('✅ User competitions loaded:', result.data.competitions);
        
        // For each competition, check if there are open rounds for picks
        for (const comp of result.data.competitions) {
          if (comp.status === 'active' && comp.player_status === 'active') {
            await checkCompetitionRounds(comp.competition_id);
          }
        }
      } else {
        console.log('ℹ️ No competitions found or API not implemented yet');
        setUserCompetitions([]);
      }
    } catch (error) {
      console.log('ℹ️ Competitions API not ready yet:', error);
      setUserCompetitions([]);
    }
    setCompetitionsLoading(false);
  };

  const checkCompetitionRounds = async (competitionId) => {
    try {
      console.log('🔍 Checking rounds for competition:', competitionId);
      const picksResult = await competition.getUserPicks({ competition_id: competitionId });
      
      if (picksResult.success && picksResult.data.current_round) {
        // Check if there are fixtures for the current round
        const roundsResult = await competition.getRounds({ competition_id: competitionId });
        if (roundsResult.success) {
          const currentRoundData = roundsResult.data.rounds.find(
            round => round.id === picksResult.data.current_round.id
          );
          
          setCompetitionRounds(prev => ({
            ...prev,
            [competitionId]: {
              current_round: picksResult.data.current_round,
              fixtures: currentRoundData?.fixtures || [],
              user_picks: picksResult.data.picks || [],
              has_current_pick: picksResult.data.picks.some(
                pick => pick.round.id === picksResult.data.current_round.id
              )
            }
          }));
          
          console.log('✅ Round data loaded for competition', competitionId);
        }
      }
    } catch (error) {
      console.error('❌ Failed to load round data for competition', competitionId, error);
    }
  };

  const handleLogout = () => {
    token.remove();
    localStorage.removeItem('current_organisation_id');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_onboarding_choice');
    localStorage.removeItem('joined_competition_id');
    router.push('/');
  };

  const getCompetitionStatusBadge = (status) => {
    const badges = {
      setup: { color: '#ffc107', text: '🔧 Setting Up' },
      active: { color: '#28a745', text: '🟢 Active' },
      locked: { color: '#17a2b8', text: '🔒 Round Locked' },
      completed: { color: '#6c757d', text: '🏁 Completed' }
    };
    
    const badge = badges[status] || { color: '#6c757d', text: status };
    
    return (
      <span style={{
        padding: '4px 8px',
        backgroundColor: badge.color,
        color: 'white',
        borderRadius: '8px',
        fontSize: '12px',
        fontWeight: 'bold'
      }}>
        {badge.text}
      </span>
    );
  };

  const getPlayerStatusBadge = (livesRemaining, status) => {
    if (status === 'eliminated') {
      return (
        <span style={{
          padding: '4px 8px',
          backgroundColor: '#dc3545',
          color: 'white',
          borderRadius: '8px',
          fontSize: '12px',
          fontWeight: 'bold'
        }}>
          💀 Eliminated
        </span>
      );
    }
    
    return (
      <span style={{
        padding: '4px 8px',
        backgroundColor: livesRemaining > 1 ? '#28a745' : '#ffc107',
        color: 'white',
        borderRadius: '8px',
        fontSize: '12px',
        fontWeight: 'bold'
      }}>
        ❤️ {livesRemaining} {livesRemaining === 1 ? 'Life' : 'Lives'}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="page">
        <div className="header">
          <div className="container">
            <h1>🎮 Player Dashboard</h1>
            <div className="subtitle">Loading...</div>
          </div>
        </div>

        <div className="content">
          <div className="container">
            <div className="card" style={{ textAlign: 'center' }}>
              <div className="loading" style={{ margin: '20px auto' }}></div>
              <p>Loading your competitions...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <div className="header">
          <div className="container">
            <h1>❌ Error</h1>
          </div>
        </div>

        <div className="content">
          <div className="container">
            <div className="card">
              <div className="alert alert-error">{error}</div>
              <div className="nav">
                <Link href="/login" className="btn btn-primary">
                  🔐 Log In Again
                </Link>
                <Link href="/" className="btn btn-secondary">
                  🏠 Home
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="header">
        <div className="container">
          <h1>🎮 Player Dashboard</h1>
          <div className="subtitle">Welcome back, {user?.display_name}</div>
        </div>
      </div>

      <div className="content">
        <div className="container">
          {/* User Info */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Player Profile</h2>
              <span style={{ 
                padding: '4px 12px', 
                backgroundColor: '#28a745',
                color: 'white',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 'bold'
              }}>
                🎮 PLAYER
              </span>
            </div>
            
            {user && (
              <div style={{ marginBottom: '16px', marginTop: '16px' }}>
                <p><strong>Name:</strong> {user.display_name}</p>
                <p><strong>Email:</strong> {user.email}</p>
                <p><strong>Competitions:</strong> {userCompetitions.length} joined</p>
              </div>
            )}

            <div className="nav">
              <Link href="/join" className="btn btn-primary">
                🎯 Join Competition
              </Link>
              <Link href="/dashboard" className="btn btn-secondary">
                📊 Main Dashboard
              </Link>
              <button onClick={handleLogout} className="btn btn-danger">
                🚪 Logout
              </button>
            </div>
          </div>

          {/* Active Competitions */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>Your Competitions</h2>
              {competitionsLoading && <div className="loading"></div>}
            </div>

            {userCompetitions.length === 0 ? (
              <div>
                <div className="alert alert-info">
                  🎯 You haven't joined any competitions yet! Use an invite code to join your first competition.
                </div>
                
                <div style={{ marginTop: '20px' }}>
                  <Link href="/join" className="btn btn-primary">
                    🎯 Join Your First Competition
                  </Link>
                </div>
              </div>
            ) : (
              <div>
                {userCompetitions.map((comp, index) => (
                  <div key={comp.competition_id || index} style={{
                    border: '1px solid #e9ecef',
                    borderRadius: '8px',
                    padding: '20px',
                    marginBottom: '15px',
                    backgroundColor: '#f8f9fa'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <h3 style={{ margin: 0 }}>{comp.name}</h3>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {getCompetitionStatusBadge(comp.status)}
                        {getPlayerStatusBadge(comp.lives_remaining, comp.player_status)}
                      </div>
                    </div>
                    
                    {comp.description && (
                      <p style={{ color: '#666', margin: '8px 0' }}>{comp.description}</p>
                    )}
                    
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
                      <p><strong>Organisation:</strong> {comp.organisation_name}</p>
                      <p><strong>Team List:</strong> {comp.team_list_name}</p>
                      {comp.current_round && (
                        <p><strong>Current Round:</strong> Round {comp.current_round}</p>
                      )}
                    </div>

                    {/* Competition Action */}
                    {comp.status === 'active' && comp.player_status === 'active' ? (
                      <div style={{
                        padding: '15px',
                        backgroundColor: '#e7f3ff',
                        borderRadius: '6px',
                        border: '1px solid #b3d9ff'
                      }}>
                        <h4 style={{ margin: '0 0 10px 0' }}>🎯 Current Round</h4>
                        {(() => {
                          const roundData = competitionRounds[comp.competition_id];
                          
                          if (!roundData || !roundData.current_round) {
                            return (
                              <div>
                                <p style={{ margin: '0 0 10px 0', fontSize: '14px' }}>
                                  Waiting for organizer to start the first round
                                </p>
                                <div className="alert alert-info">
                                  📅 The competition organizer will create rounds and fixtures when ready to begin.
                                </div>
                              </div>
                            );
                          }
                          
                          if (roundData.fixtures.length === 0) {
                            return (
                              <div>
                                <p style={{ margin: '0 0 10px 0', fontSize: '14px' }}>
                                  {roundData.current_round.name} - Pick your team to win this week
                                </p>
                                <div className="alert alert-info" style={{ margin: '10px 0' }}>
                                  ⚠️ Fixtures not yet available for this round. Organizer needs to add fixtures.
                                </div>
                                <button disabled className="btn btn-secondary">
                                  🔒 Waiting for Fixtures
                                </button>
                              </div>
                            );
                          }
                          
                          // Round has fixtures - show pick interface
                          return (
                            <div>
                              <p style={{ margin: '0 0 10px 0', fontSize: '14px' }}>
                                {roundData.current_round.name} - {roundData.fixtures.length} fixture{roundData.fixtures.length !== 1 ? 's' : ''} available
                              </p>
                              
                              {roundData.has_current_pick ? (
                                <div className="alert alert-success" style={{ margin: '10px 0' }}>
                                  ✅ You have made your pick for this round! You can still change it before the deadline.
                                </div>
                              ) : (
                                <div className="alert alert-warning" style={{ margin: '10px 0' }}>
                                  ⏰ Pick deadline: {new Date(roundData.current_round.lock_time).toLocaleString()}
                                </div>
                              )}
                              
                              <Link 
                                href={`/competition/${comp.competition_id}/pick`}
                                className="btn btn-primary"
                              >
                                🎯 {roundData.has_current_pick ? 'View/Change Pick' : 'Make Your Pick'}
                              </Link>
                            </div>
                          );
                        })()}
                      </div>
                    ) : comp.status === 'setup' ? (
                      <div className="alert alert-info">
                        🔧 Competition is still being set up by the organizer
                      </div>
                    ) : comp.status === 'locked' ? (
                      <div className="alert alert-warning">
                        🔒 Current round is locked - waiting for results
                      </div>
                    ) : comp.player_status === 'eliminated' ? (
                      <div className="alert alert-error">
                        💀 You have been eliminated from this competition
                      </div>
                    ) : comp.status === 'completed' ? (
                      <div className="alert alert-success">
                        🏁 Competition completed - View final results
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* How It Works */}
          <div className="card">
            <h3>🎯 How Last Man Standing Works</h3>
            <div style={{ fontSize: '14px', color: '#666', lineHeight: '1.6' }}>
              <ol style={{ marginLeft: '20px' }}>
                <li><strong>Join competitions</strong> using invite codes from organizers</li>
                <li><strong>Each round</strong>, pick one team you think will win their match</li>
                <li><strong>No team twice</strong> - you can only pick each team once per competition</li>
                <li><strong>Wrong pick?</strong> You lose a life (usually 1 life = elimination)</li>
                <li><strong>Last player standing</strong> wins the competition!</li>
              </ol>
              
              <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#fff3cd', borderRadius: '4px', border: '1px solid #ffeaa7' }}>
                <strong>⏰ Timing:</strong> Picks usually lock 1 hour before kickoff, so make your selection early!
              </div>
            </div>
          </div>

          {/* Development Status */}
          <div className="card">
            <h3>🚧 Development Status</h3>
            <div style={{ fontSize: '14px', color: '#666' }}>
              <p><strong>✅ Completed:</strong></p>
              <ul style={{ marginLeft: '20px' }}>
                <li>Player authentication and profiles</li>
                <li>Join competitions with invite codes</li>
                <li>Competition preview and status tracking</li>
                <li>Player dashboard foundation</li>
              </ul>
              
              <p style={{ marginTop: '15px' }}><strong>🚧 Next Phase:</strong></p>
              <ul style={{ marginLeft: '20px' }}>
                <li>Round and fixture management (organizer tools)</li>
                <li>Pick submission interface</li>
                <li>Real-time competition updates</li>
                <li>Results processing and elimination</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}