import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { competition, token, authenticated } from '../../lib/api';

export default function JoinCompetition() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState({ type: '', content: '' });
  const [inviteCode, setInviteCode] = useState('');
  const [competitionDetails, setCompetitionDetails] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

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
      console.error('❌ Join competition auth check failed:', error);
      router.push('/login');
    }
  };

  const handleCodeChange = (value) => {
    setInviteCode(value.toUpperCase());
    setShowPreview(false);
    setCompetitionDetails(null);
    
    // Clear messages when user types
    if (message.content) {
      setMessage({ type: '', content: '' });
    }
  };

  const handleLookupCompetition = async () => {
    if (!inviteCode.trim()) {
      setMessage({ type: 'error', content: 'Please enter an invite code' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', content: '' });

    try {
      console.log('🔍 Looking up competition with code:', inviteCode);
      const result = await competition.getByInviteCode({ invite_code: inviteCode.trim() });

      if (result.success) {
        setCompetitionDetails(result.data);
        setShowPreview(true);
        console.log('✅ Competition found:', result.data);
      } else {
        setMessage({ 
          type: 'error', 
          content: result.data.message || 'Competition not found' 
        });
        setShowPreview(false);
        setCompetitionDetails(null);
      }
    } catch (error) {
      setMessage({ 
        type: 'error', 
        content: 'Network error. Please try again.' 
      });
      setShowPreview(false);
      setCompetitionDetails(null);
    }

    setLoading(false);
  };

  const handleJoinCompetition = async () => {
    if (!competitionDetails) return;

    setLoading(true);
    setMessage({ type: '', content: '' });

    try {
      console.log('🎮 Joining competition:', competitionDetails.competition_id);
      const result = await competition.join({ 
        invite_code: inviteCode.trim(),
        competition_id: competitionDetails.competition_id 
      });

      if (result.success) {
        setMessage({ 
          type: 'success', 
          content: `🎉 Successfully joined ${competitionDetails.name}!` 
        });
        
        // Store the joined competition context
        localStorage.setItem('joined_competition_id', competitionDetails.competition_id);
        localStorage.setItem('user_role', 'player');
        
        // Redirect to player dashboard after delay
        setTimeout(() => {
          router.push('/player/dashboard');
        }, 2000);
      } else {
        setMessage({ 
          type: 'error', 
          content: result.data.message || 'Failed to join competition' 
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

  if (!user) {
    return (
      <div className="page">
        <div className="header">
          <div className="container">
            <h1>🎮 Join Competition</h1>
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
          <h1>🎮 Join Competition</h1>
          <div className="subtitle">Enter an invite code to join a Last Man Standing competition</div>
        </div>
      </div>

      <div className="content">
        <div className="container">
          <div className="card">
            <h2>Enter Invite Code</h2>
            <p style={{ color: '#666', marginBottom: '30px' }}>
              Ask the competition organizer for their unique invite code to join their competition.
            </p>

            {/* Status Message */}
            {message.content && (
              <div className={`alert alert-${message.type === 'error' ? 'error' : 'success'}`}>
                {message.content}
              </div>
            )}

            {/* Invite Code Input */}
            <div className="form">
              <div className="form-group">
                <label className="form-label">Invite Code *</label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => handleCodeChange(e.target.value)}
                    placeholder="e.g., ABC123"
                    className="form-input"
                    style={{ flex: 1, textTransform: 'uppercase' }}
                    maxLength="8"
                    autoFocus
                    disabled={loading}
                  />
                  <button 
                    onClick={handleLookupCompetition}
                    disabled={loading || !inviteCode.trim()}
                    className="btn btn-primary"
                  >
                    {loading ? (
                      <>
                        <div className="loading" style={{ marginRight: '8px' }}></div>
                        Looking up...
                      </>
                    ) : (
                      '🔍 Look Up'
                    )}
                  </button>
                </div>
                <small style={{ color: '#666' }}>
                  Invite codes are usually 6-8 characters (letters and numbers)
                </small>
              </div>
            </div>

            {/* Competition Preview */}
            {showPreview && competitionDetails && (
              <div style={{ 
                marginTop: '30px', 
                padding: '20px', 
                backgroundColor: '#f8f9fa', 
                borderRadius: '4px',
                border: '1px solid #e9ecef'
              }}>
                <h3>Competition Found! 🎯</h3>
                <div style={{ marginTop: '15px' }}>
                  <p><strong>Name:</strong> {competitionDetails.name}</p>
                  {competitionDetails.description && (
                    <p><strong>Description:</strong> {competitionDetails.description}</p>
                  )}
                  <p><strong>Organisation:</strong> {competitionDetails.organisation_name}</p>
                  <p><strong>Team List:</strong> {competitionDetails.team_list_name}</p>
                  <p><strong>Lives per Player:</strong> {competitionDetails.lives_per_player}</p>
                  <p><strong>No Team Twice Rule:</strong> {competitionDetails.no_team_twice ? 'Yes' : 'No'}</p>
                  <p><strong>Status:</strong> {competitionDetails.status === 'setup' ? '🔧 Setting up' : 
                    competitionDetails.status === 'active' ? '🟢 Active' : 
                    competitionDetails.status === 'locked' ? '🔒 Round locked' : 
                    competitionDetails.status}</p>
                  {competitionDetails.player_count !== undefined && (
                    <p><strong>Current Players:</strong> {competitionDetails.player_count}</p>
                  )}
                </div>

                <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                  <button 
                    onClick={handleJoinCompetition}
                    disabled={loading}
                    className="btn btn-success"
                  >
                    {loading ? (
                      <>
                        <div className="loading" style={{ marginRight: '8px' }}></div>
                        Joining...
                      </>
                    ) : (
                      '🎮 Join This Competition'
                    )}
                  </button>
                  <button 
                    onClick={() => {
                      setShowPreview(false);
                      setCompetitionDetails(null);
                      setInviteCode('');
                    }}
                    className="btn btn-secondary"
                  >
                    ← Try Different Code
                  </button>
                </div>
              </div>
            )}

            {/* Help Section */}
            <div style={{ 
              marginTop: '30px',
              padding: '20px',
              backgroundColor: '#e7f3ff',
              borderRadius: '4px',
              border: '1px solid #b3d9ff'
            }}>
              <h4>💡 How It Works</h4>
              <ul style={{ marginLeft: '20px', color: '#666' }}>
                <li>Get an invite code from the competition organizer</li>
                <li>Enter the code above to preview the competition details</li>
                <li>Click "Join" to become a player in the competition</li>
                <li>Once joined, you'll be able to make picks each round</li>
              </ul>
            </div>

            {/* Navigation */}
            <div className="nav" style={{ marginTop: '30px' }}>
              <Link href="/dashboard" className="nav-link">
                ← Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}