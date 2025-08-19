import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { authenticated, token, competition } from '../../lib/api';

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [hasOrganisation, setHasOrganisation] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [organizerCompetitions, setOrganizerCompetitions] = useState([]);
  const [competitionsLoading, setCompetitionsLoading] = useState(false);

  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    const jwt = token.get();
    
    if (!jwt) {
      // Not logged in, redirect to login
      router.push('/login');
      return;
    }

    try {
      // Verify JWT is still valid and get user info
      const result = await authenticated.getProfile(jwt);
      
      if (result.success) {
        setUser(result.data);
        
        // Check if user has completed onboarding
        await checkOnboardingStatus();
        
        // Determine user role by checking what competitions they have
        await determineUserRole();
        
      } else {
        // JWT invalid or expired
        token.remove();
        router.push('/login');
        return;
      }
    } catch (error) {
      setError('Failed to load user profile');
      console.error('❌ Dashboard auth check failed:', error);
    }

    setLoading(false);
  };

  const checkOnboardingStatus = async () => {
    try {
      // Check localStorage for onboarding completion
      const organisationId = localStorage.getItem('current_organisation_id');
      const role = localStorage.getItem('user_role');
      const onboardingChoice = localStorage.getItem('user_onboarding_choice');

      if (organisationId) {
        setHasOrganisation(true);
      }
      
      if (role) {
        setUserRole(role);
      }

      // If user hasn't completed onboarding, redirect them
      if (!organisationId && !role && !onboardingChoice) {
        console.log('👋 New user detected, redirecting to onboarding');
        router.push('/onboarding');
        return;
      }

      // TODO: In production, also check server-side for user's actual organisations
      // For now, we rely on localStorage for MVP

    } catch (error) {
      console.error('❌ Error checking onboarding status:', error);
    }
  };

  const determineUserRole = async () => {
    try {
      console.log('🔍 Determining user role from database...');
      
      // Try to load organizer competitions
      const orgResult = await competition.getOrganizerCompetitions();
      const hasOrganizerRole = orgResult.success && orgResult.data.competitions.length > 0;
      
      // Try to load player competitions  
      const playerResult = await competition.getUserCompetitions();
      const hasPlayerRole = playerResult.success && playerResult.data.competitions.length > 0;
      
      console.log('📊 Role check results:', { hasOrganizerRole, hasPlayerRole });
      
      if (hasOrganizerRole) {
        setUserRole('organizer');
        localStorage.setItem('user_role', 'organizer');
        setOrganizerCompetitions(orgResult.data.competitions || []);
        console.log('👑 User detected as organizer with', orgResult.data.competitions.length, 'competitions');
      } else if (hasPlayerRole) {
        setUserRole('player');
        localStorage.setItem('user_role', 'player');
        console.log('🎮 User detected as player only');
      } else {
        // No competitions found, check localStorage or default to no role
        const storedRole = localStorage.getItem('user_role');
        setUserRole(storedRole);
        console.log('🤷 No competitions found, using stored role:', storedRole);
      }
      
    } catch (error) {
      console.error('❌ Error determining user role:', error);
      // Fallback to localStorage
      const storedRole = localStorage.getItem('user_role');
      setUserRole(storedRole);
    }
  };

  const loadOrganizerCompetitions = async () => {
    setCompetitionsLoading(true);
    try {
      console.log('📋 Loading organizer competitions...');
      const result = await competition.getOrganizerCompetitions();
      console.log('📥 Raw API response:', result);
      
      if (result.success) {
        const competitions = result.data.competitions || [];
        setOrganizerCompetitions(competitions);
        console.log('✅ Organizer competitions loaded:', competitions.length, 'competitions');
        console.log('🔍 Competition details:', competitions);
      } else {
        console.log('❌ API returned error:', result.data);
        setOrganizerCompetitions([]);
      }
    } catch (error) {
      console.error('❌ Error loading organizer competitions:', error);
      setOrganizerCompetitions([]);
    }
    setCompetitionsLoading(false);
  };

  const handleLogout = () => {
    token.remove();
    // Clear onboarding data
    localStorage.removeItem('current_organisation_id');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_onboarding_choice');
    localStorage.removeItem('joined_competition_id');
    router.push('/');
  };

  const handleRoleSwitch = () => {
    // Clear current role and redirect to onboarding to choose new role
    localStorage.removeItem('user_role');
    localStorage.removeItem('current_organisation_id');
    router.push('/onboarding');
  };

  const handleStartCompetition = async (competitionId) => {
    try {
      console.log('🚀 Starting competition:', competitionId);
      const result = await competition.startCompetition({ competition_id: competitionId });
      
      if (result.success) {
        // Refresh the competitions list
        await determineUserRole();
        alert('Competition started successfully!');
      } else {
        alert('Failed to start competition: ' + (result.data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('❌ Error starting competition:', error);
      alert('Network error. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div className="header">
          <div className="container">
            <h1>📊 Dashboard</h1>
            <div className="subtitle">Loading...</div>
          </div>
        </div>

        <div className="content">
          <div className="container">
            <div className="card" style={{ textAlign: 'center' }}>
              <div className="loading" style={{ margin: '20px auto' }}></div>
              <p>Loading your dashboard...</p>
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
          <h1>📊 Dashboard</h1>
          <div className="subtitle">Welcome, {user?.display_name}</div>
        </div>
      </div>

      <div className="content">
        <div className="container">
          {/* User Info */}
          <div className="card">
            <h2>Your Profile</h2>
            <div className="alert alert-success">
              ✅ Successfully authenticated
            </div>
            
            {user && (
              <div style={{ marginBottom: '16px' }}>
                <p><strong>Name:</strong> {user.display_name}</p>
                <p><strong>Email:</strong> {user.email}</p>
                <p><strong>User ID:</strong> {user.user_id}</p>
              </div>
            )}

            <button onClick={handleLogout} className="btn btn-danger">
              🚪 Logout
            </button>
          </div>

          {/* Quick Actions */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2>Quick Actions</h2>
              {userRole && (
                <span style={{ 
                  padding: '4px 12px', 
                  backgroundColor: userRole === 'organizer' ? '#007bff' : '#28a745',
                  color: 'white',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}>
                  {userRole === 'organizer' ? '🏆 ORGANIZER' : '🎮 PLAYER'}
                </span>
              )}
            </div>
            
            {userRole === 'organizer' ? (
              <>
                <p style={{ marginBottom: '16px', color: '#666' }}>
                  Manage your competitions and players as an organizer.
                </p>
                
                <div className="nav">
                  <Link href="/competition/create" className="btn btn-primary">
                    ➕ Create Competition
                  </Link>
                  <button onClick={handleRoleSwitch} className="btn btn-secondary">
                    🎮 Switch to Player
                  </button>
                </div>
              </>
            ) : userRole === 'player' ? (
              <>
                <p style={{ marginBottom: '16px', color: '#666' }}>
                  View your competitions and make predictions as a player.
                </p>
                
                <div className="nav">
                  <Link href="/join" className="btn btn-primary">
                    🎯 Join Competition
                  </Link>
                  <Link href="/player/dashboard" className="btn btn-success">
                    🎮 Player Dashboard
                  </Link>
                  <button onClick={handleRoleSwitch} className="btn btn-secondary">
                    🏆 Switch to Organizer
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={{ marginBottom: '16px', color: '#666' }}>
                  Choose your role to get started with competitions.
                </p>
                
                <div className="nav">
                  <Link href="/join" className="btn btn-success">
                    🎯 Join Competition
                  </Link>
                  <button onClick={handleRoleSwitch} className="btn btn-primary">
                    🚀 Choose Your Role
                  </button>
                </div>
              </>
            )}
          </div>


          {/* Organizer Competitions */}
          {userRole === 'organizer' && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>Your Competitions</h2>
                {competitionsLoading && <div className="loading"></div>}
              </div>

              {organizerCompetitions.length === 0 ? (
                <div>
                  <div className="alert alert-info">
                    🏆 You haven't created any competitions yet. Start by creating your first competition to manage players and rounds.
                  </div>
                  
                  <div style={{ marginTop: '20px' }}>
                    <Link href="/competition/create" className="btn btn-primary">
                      ➕ Create Your First Competition
                    </Link>
                  </div>
                </div>
              ) : (
                <div>
                  {organizerCompetitions.map((comp, index) => (
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
                          <span style={{
                            padding: '4px 8px',
                            backgroundColor: comp.status === 'setup' ? '#ffc107' : 
                                           comp.status === 'active' ? '#28a745' : 
                                           comp.status === 'locked' ? '#17a2b8' : '#6c757d',
                            color: 'white',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}>
                            {comp.status === 'setup' ? '🔧 Setup' : 
                             comp.status === 'active' ? '🟢 Active' : 
                             comp.status === 'locked' ? '🔒 Locked' : '🏁 Complete'}
                          </span>
                          <span style={{
                            padding: '4px 8px',
                            backgroundColor: '#007bff',
                            color: 'white',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}>
                            👥 {comp.player_count || 0} Players
                          </span>
                        </div>
                      </div>
                      
                      {comp.description && (
                        <p style={{ color: '#666', margin: '8px 0' }}>{comp.description}</p>
                      )}
                      
                      <div style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
                        <p><strong>Team List:</strong> {comp.team_list_name}</p>
                        <p><strong>Invite Code:</strong> <code style={{ backgroundColor: '#fff', padding: '2px 6px', borderRadius: '3px' }}>{comp.invite_code}</code></p>
                        {comp.current_round && (
                          <p><strong>Current Round:</strong> Round {comp.current_round}</p>
                        )}
                      </div>

                      {/* Management Actions */}
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {comp.status === 'setup' ? (
                          <>
                            <button 
                              className="btn btn-primary"
                              onClick={() => handleStartCompetition(comp.competition_id)}
                            >
                              🚀 Start Competition
                            </button>
                            <button className="btn btn-secondary">
                              ⚙️ Edit Settings
                            </button>
                          </>
                        ) : comp.status === 'active' ? (
                          <>
                            <Link 
                              href={`/competition/${comp.competition_id}/manage`}
                              className="btn btn-primary"
                            >
                              📅 Manage Rounds
                            </Link>
                            <button className="btn btn-secondary">
                              👥 View Players
                            </button>
                            <button className="btn btn-secondary">
                              📊 Results
                            </button>
                          </>
                        ) : (
                          <button className="btn btn-secondary">
                            📊 View Results
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  <div style={{ marginTop: '20px' }}>
                    <Link href="/competition/create" className="btn btn-success">
                      ➕ Create Another Competition
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Development Status */}
          <div className="card">
            <h3>🚧 Development Status</h3>
            <p style={{ color: '#666', fontSize: '14px' }}>
              <strong>✅ Completed:</strong> Authentication flow, JWT verification, protected routes<br/>
              <strong>🚧 Next:</strong> Competition management, user roles, data integration<br/>
              <strong>📍 Current:</strong> Foundation frontend pages for testing backend APIs
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}