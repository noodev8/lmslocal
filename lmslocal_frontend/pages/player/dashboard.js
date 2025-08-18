import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { token, authenticated } from '../../lib/api';

export default function PlayerDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');

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

  const handleLogout = () => {
    token.remove();
    localStorage.removeItem('current_organisation_id');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_onboarding_choice');
    localStorage.removeItem('joined_competition_id');
    router.push('/');
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
          <div className="subtitle">Welcome, {user?.display_name}</div>
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
              </div>
            )}

            <div className="nav">
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
            <h2>Your Competitions</h2>
            <div className="alert alert-info">
              🚧 This section will show your active competitions where you can make weekly picks.
              Competition joining and pick submission will be implemented next.
            </div>
            
            <p style={{ color: '#666', fontSize: '14px', marginTop: '16px' }}>
              This section will show:
            </p>
            <ul style={{ marginLeft: '20px', color: '#666', fontSize: '14px' }}>
              <li>Competitions you've joined</li>
              <li>Current round status and deadlines</li>
              <li>Your pick history and results</li>
              <li>Leaderboard and standings</li>
            </ul>
          </div>

          {/* Quick Actions */}
          <div className="card">
            <h2>Quick Actions</h2>
            <div className="nav">
              <Link href="/onboarding/player" className="btn btn-success">
                ➕ Join Another Competition
              </Link>
              <Link href="/onboarding/organizer" className="btn btn-primary">
                🏆 Become an Organizer
              </Link>
            </div>
          </div>

          {/* Development Status */}
          <div className="card">
            <h3>🚧 Development Status</h3>
            <p style={{ color: '#666', fontSize: '14px' }}>
              <strong>✅ Completed:</strong> Player onboarding flow, role switching<br/>
              <strong>🚧 Next:</strong> Competition joining, pick submission interface<br/>
              <strong>📍 Current:</strong> Player dashboard foundation
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}