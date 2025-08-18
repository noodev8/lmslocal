import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { authenticated, token } from '../../lib/api';

export default function Dashboard() {
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
      // Not logged in, redirect to login
      router.push('/login');
      return;
    }

    try {
      // Verify JWT is still valid and get user info
      const result = await authenticated.getProfile(jwt);
      
      if (result.success) {
        setUser(result.data);
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

  const handleLogout = () => {
    token.remove();
    router.push('/');
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
            <h2>Quick Actions</h2>
            <p style={{ marginBottom: '16px', color: '#666' }}>
              Organizer dashboard - manage your competitions and players.
            </p>
            
            <div className="nav">
              <Link href="/competition/create" className="btn btn-primary">
                ➕ Create Competition
              </Link>
              <Link href="/player/dashboard" className="btn btn-secondary">
                🎮 Player View
              </Link>
            </div>
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