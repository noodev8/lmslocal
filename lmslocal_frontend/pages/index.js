import { useEffect, useState } from 'react';
import Link from 'next/link';
import { health, token } from '../lib/api';

export default function Home() {
  const [serverStatus, setServerStatus] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    setIsLoggedIn(token.isLoggedIn());
    
    // Check server health
    checkServerHealth();
    setLoading(false);
  }, []);

  const checkServerHealth = async () => {
    const result = await health.check();
    setServerStatus(result);
  };

  return (
    <div className="page">
      <div className="header">
        <div className="container">
          <h1>🏆 Last Man Standing</h1>
          <div className="subtitle">Local Competition Management Platform</div>
        </div>
      </div>

      <div className="content">
        <div className="container">
          {/* Server Status */}
          <div className="card">
            <h2>System Status</h2>
            {loading ? (
              <div>Checking server status... <div className="loading"></div></div>
            ) : serverStatus ? (
              serverStatus.success ? (
                <div className="alert alert-success">
                  ✅ Server running - Database connected
                  <div style={{fontSize: '14px', marginTop: '8px'}}>
                    Status: {serverStatus.data.server_status} | 
                    Database: {serverStatus.data.database_status} |
                    Time: {new Date(serverStatus.data.timestamp).toLocaleString()}
                  </div>
                </div>
              ) : (
                <div className="alert alert-error">
                  ❌ Server error: {serverStatus.data.message}
                </div>
              )
            ) : (
              <div className="alert alert-error">
                ❌ Cannot connect to server
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="card">
            <h2>Quick Access</h2>
            
            {isLoggedIn ? (
              <div>
                <div className="alert alert-success">
                  ✅ You are logged in
                </div>
                <div className="nav">
                  <Link href="/dashboard" className="btn btn-primary">
                    📊 Dashboard
                  </Link>
                  <Link href="/player/dashboard" className="btn btn-secondary">
                    🎮 Player View
                  </Link>
                  <button 
                    onClick={() => {
                      token.remove();
                      setIsLoggedIn(false);
                    }}
                    className="btn btn-danger"
                  >
                    🚪 Logout
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="alert alert-info">
                  Welcome! Please log in to access competitions.
                </div>
                <div className="nav">
                  <Link href="/login" className="btn btn-primary">
                    🔐 Log In
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Development Info */}
          <div className="card">
            <h3>Development Status</h3>
            <p><strong>Phase:</strong> Authentication & Core API Foundation</p>
            <p><strong>Available Features:</strong></p>
            <ul style={{marginLeft: '20px', marginTop: '8px'}}>
              <li>✅ Server health check</li>
              <li>✅ Passwordless email authentication</li>
              <li>✅ JWT token management</li>
              <li>✅ Organisation/User/Competition API</li>
              <li>🚧 Frontend pages (in progress)</li>
            </ul>
            
            <div style={{marginTop: '16px'}}>
              <strong>API Endpoints Available:</strong><br/>
              <code style={{fontSize: '12px', color: '#666'}}>
                http://localhost:3015/api/health<br/>
                http://localhost:3015/api/auth/*<br/>
                http://localhost:3015/api/organisation/*<br/>
                http://localhost:3015/api/user/*<br/>
                http://localhost:3015/api/competition/*
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}