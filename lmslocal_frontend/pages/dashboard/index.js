import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { authenticated, token } from '../../lib/api';

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [hasOrganisation, setHasOrganisation] = useState(false);
  const [userRole, setUserRole] = useState(null);

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
    // Allow users to switch between organizer and player roles
    router.push('/onboarding');
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
                  <button onClick={handleRoleSwitch} className="btn btn-primary">
                    🚀 Choose Your Role
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Competitions */}
          <div className="card">
            <h2>Your Competitions</h2>
            <div className="alert alert-info">
              🚧 Competition list will be implemented next. For now, this demonstrates 
              the protected route working with JWT authentication.
            </div>
            
            <p style={{ color: '#666', fontSize: '14px', marginTop: '16px' }}>
              This section will show:
            </p>
            <ul style={{ marginLeft: '20px', color: '#666', fontSize: '14px' }}>
              <li>Active competitions you're organizing</li>
              <li>Player counts and statuses</li>
              <li>Recent activity and updates</li>
              <li>Competition management links</li>
            </ul>
          </div>

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