import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { token, authenticated } from '../../lib/api';

export default function Onboarding() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

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
      console.error('❌ Onboarding auth check failed:', error);
      router.push('/login');
      return;
    }

    setLoading(false);
  };

  const handleOrganizerChoice = () => {
    // Store choice in localStorage for persistence
    localStorage.setItem('user_onboarding_choice', 'organizer');
    router.push('/onboarding/organizer');
  };

  const handlePlayerChoice = () => {
    // Store choice in localStorage for persistence
    localStorage.setItem('user_onboarding_choice', 'player');
    router.push('/onboarding/player');
  };

  if (loading) {
    return (
      <div className="page">
        <div className="header">
          <div className="container">
            <h1>🏆 Welcome to LMSLocal</h1>
            <div className="subtitle">Setting up your account...</div>
          </div>
        </div>

        <div className="content">
          <div className="container">
            <div className="card" style={{ textAlign: 'center' }}>
              <div className="loading" style={{ margin: '20px auto' }}></div>
              <p>Loading...</p>
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
          <h1>🏆 Welcome to LMSLocal</h1>
          <div className="subtitle">Welcome, {user?.display_name}! Let's get you started.</div>
        </div>
      </div>

      <div className="content">
        <div className="container">
          {/* Welcome Message */}
          <div className="card" style={{ textAlign: 'center', marginBottom: '30px' }}>
            <h2>What brings you here today?</h2>
            <p style={{ color: '#666', fontSize: '16px', marginBottom: '30px' }}>
              Choose your primary goal to get started. You can always switch roles later!
            </p>
          </div>

          {/* Choice Cards */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: '30px',
            maxWidth: '800px',
            margin: '0 auto'
          }}>
            
            {/* Organizer Choice */}
            <div 
              className="card" 
              style={{ 
                cursor: 'pointer',
                textAlign: 'center',
                border: '2px solid #e0e0e0',
                transition: 'all 0.3s ease',
                padding: '30px 20px'
              }}
              onClick={handleOrganizerChoice}
              onMouseEnter={(e) => {
                e.target.style.borderColor = '#007bff';
                e.target.style.backgroundColor = '#f8f9fa';
              }}
              onMouseLeave={(e) => {
                e.target.style.borderColor = '#e0e0e0';
                e.target.style.backgroundColor = 'white';
              }}
            >
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>🏆</div>
              <h3 style={{ color: '#007bff', marginBottom: '15px' }}>ORGANIZER</h3>
              <p style={{ color: '#666', fontSize: '14px', lineHeight: '1.5' }}>
                I want to <strong>run competitions</strong>
              </p>
              <ul style={{ 
                textAlign: 'left', 
                color: '#666', 
                fontSize: '13px',
                marginTop: '20px',
                listStyle: 'none',
                padding: 0
              }}>
                <li>✓ Set up your venue/organization</li>
                <li>✓ Create Last Man Standing games</li>
                <li>✓ Manage players and results</li>
                <li>✓ Free for up to 5 players</li>
              </ul>
              
              <button 
                className="btn btn-primary" 
                style={{ marginTop: '20px', width: '100%' }}
              >
                Get Started as Organizer
              </button>
            </div>

            {/* Player Choice */}
            <div 
              className="card" 
              style={{ 
                cursor: 'pointer',
                textAlign: 'center',
                border: '2px solid #e0e0e0',
                transition: 'all 0.3s ease',
                padding: '30px 20px'
              }}
              onClick={handlePlayerChoice}
              onMouseEnter={(e) => {
                e.target.style.borderColor = '#28a745';
                e.target.style.backgroundColor = '#f8f9fa';
              }}
              onMouseLeave={(e) => {
                e.target.style.borderColor = '#e0e0e0';
                e.target.style.backgroundColor = 'white';
              }}
            >
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>🎮</div>
              <h3 style={{ color: '#28a745', marginBottom: '15px' }}>PLAYER</h3>
              <p style={{ color: '#666', fontSize: '14px', lineHeight: '1.5' }}>
                I want to <strong>join competitions</strong>
              </p>
              <ul style={{ 
                textAlign: 'left', 
                color: '#666', 
                fontSize: '13px',
                marginTop: '20px',
                listStyle: 'none',
                padding: 0
              }}>
                <li>✓ Join existing competitions</li>
                <li>✓ Make weekly predictions</li>
                <li>✓ Compete with friends</li>
                <li>✓ Track your progress</li>
              </ul>
              
              <button 
                className="btn btn-success" 
                style={{ marginTop: '20px', width: '100%' }}
              >
                Get Started as Player
              </button>
            </div>
          </div>

          {/* Footer Note */}
          <div style={{ textAlign: 'center', marginTop: '40px' }}>
            <p style={{ color: '#999', fontSize: '13px' }}>
              💡 <strong>Tip:</strong> You can be both an organizer and player! 
              This just determines your starting experience.
            </p>
          </div>

          {/* Skip Option */}
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <Link href="/dashboard" className="nav-link" style={{ fontSize: '14px' }}>
              Skip for now → Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}