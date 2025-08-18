import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { token, authenticated } from '../../lib/api';

export default function PlayerOnboarding() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState({ type: '', content: '' });
  const [inviteCode, setInviteCode] = useState('');

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
      console.error('❌ Player onboarding auth check failed:', error);
      router.push('/login');
    }
  };

  const handleInputChange = (value) => {
    // Convert to uppercase and remove non-alphanumeric characters
    const cleanCode = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    setInviteCode(cleanCode);
    
    // Clear messages when user types
    if (message.content) {
      setMessage({ type: '', content: '' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!inviteCode.trim()) {
      setMessage({ type: 'error', content: 'Please enter an invite code' });
      return;
    }
    
    if (inviteCode.length !== 6) {
      setMessage({ type: 'error', content: 'Invite codes are 6 characters long' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', content: '' });

    try {
      console.log('🎮 Joining competition with code:', inviteCode);
      
      // TODO: Implement join competition API call
      // For now, simulate the call
      const result = await new Promise(resolve => {
        setTimeout(() => {
          // Simulate successful join
          resolve({
            success: true,
            data: {
              competition_id: 123,
              competition_name: 'Test Competition',
              organisation_name: 'Test Pub Ltd'
            }
          });
        }, 1500);
      });

      if (result.success) {
        // Store the player context
        localStorage.setItem('user_role', 'player');
        localStorage.setItem('joined_competition_id', result.data.competition_id);
        
        setMessage({ 
          type: 'success', 
          content: `🎉 Successfully joined "${result.data.competition_name}"!` 
        });
        
        // Redirect to player dashboard
        setTimeout(() => {
          router.push('/player/dashboard');
        }, 2000);
      } else {
        setMessage({ 
          type: 'error', 
          content: result.data.message || 'Invalid invite code' 
        });
      }
    } catch (error) {
      setMessage({ 
        type: 'error', 
        content: 'Network error. Please try again.' 
      });
    }

    setLoading(false);
  };

  const handleBrowseOption = () => {
    // Future feature: browse public competitions
    setMessage({ 
      type: 'info', 
      content: 'Public competition browsing coming soon! For now, ask your organizer for an invite code.' 
    });
  };

  if (!user) {
    return (
      <div className="page">
        <div className="header">
          <div className="container">
            <h1>🎮 Join a Competition</h1>
            <div className="subtitle">Loading...</div>
          </div>
        </div>
        <div className="content">
          <div className="container">
            <div className="card" style={{ textAlign: 'center' }}>
              <div className="loading" style={{ margin: '20px auto' }}></div>
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
          <h1>🎮 Join a Competition</h1>
          <div className="subtitle">Enter your invite code to get started</div>
        </div>
      </div>

      <div className="content">
        <div className="container">
          <div className="card">
            <h2>Join Competition</h2>
            <p style={{ color: '#666', marginBottom: '30px' }}>
              Your organizer should have given you a 6-character invite code. 
              Enter it below to join their Last Man Standing competition!
            </p>

            {/* Status Message */}
            {message.content && (
              <div className={`alert alert-${message.type === 'error' ? 'error' : message.type === 'success' ? 'success' : 'info'}`}>
                {message.content}
              </div>
            )}

            <form onSubmit={handleSubmit} className="form">
              <div className="form-group">
                <label className="form-label">Invite Code *</label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder="ABC123"
                  className="form-input"
                  style={{ 
                    fontSize: '18px', 
                    textAlign: 'center',
                    letterSpacing: '2px',
                    fontFamily: 'monospace'
                  }}
                  maxLength="6"
                  autoFocus
                  required
                />
                <small style={{ color: '#666' }}>
                  Enter the 6-character code from your organizer
                </small>
              </div>

              <div style={{ marginTop: '30px' }}>
                <button 
                  type="submit"
                  disabled={loading || inviteCode.length !== 6}
                  className="btn btn-success"
                  style={{ marginRight: '10px' }}
                >
                  {loading ? (
                    <>
                      <div className="loading" style={{ marginRight: '8px' }}></div>
                      Joining Competition...
                    </>
                  ) : (
                    '🎮 Join Competition'
                  )}
                </button>
                
                <Link href="/onboarding" className="btn btn-secondary">
                  ← Back to Choice
                </Link>
              </div>
            </form>

            {/* Alternative Options */}
            <div style={{ marginTop: '40px', textAlign: 'center' }}>
              <p style={{ color: '#666', marginBottom: '15px' }}>Don't have an invite code?</p>
              
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button 
                  onClick={handleBrowseOption}
                  className="btn btn-outline"
                  style={{ fontSize: '14px' }}
                >
                  🔍 Browse Public Competitions
                </button>
                
                <Link href="/onboarding/organizer" className="btn btn-outline" style={{ fontSize: '14px' }}>
                  🏆 Create Your Own Instead
                </Link>
              </div>
            </div>

            {/* Help Section */}
            <div style={{ 
              marginTop: '40px',
              padding: '20px',
              backgroundColor: '#f8f9fa',
              borderRadius: '4px',
              border: '1px solid #e9ecef'
            }}>
              <h4>💡 How to Get an Invite Code</h4>
              <ul style={{ marginLeft: '20px', color: '#666', fontSize: '14px' }}>
                <li>Ask your pub landlord, workplace organizer, or club admin</li>
                <li>Check your group chat, email, or notice board</li>
                <li>Codes are usually shared when competitions start</li>
                <li>Each competition has its own unique code</li>
              </ul>
            </div>

            {/* What's Next */}
            <div style={{ 
              marginTop: '20px',
              padding: '20px',
              backgroundColor: '#e7f3ff',
              borderRadius: '4px',
              border: '1px solid #b3d9ff'
            }}>
              <h4>🚀 What's Next?</h4>
              <ul style={{ marginLeft: '20px', color: '#666', fontSize: '14px' }}>
                <li>Join the competition and see other players</li>
                <li>Make your weekly team predictions</li>
                <li>Track your progress on the leaderboard</li>
                <li>Compete to be the last man standing!</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}