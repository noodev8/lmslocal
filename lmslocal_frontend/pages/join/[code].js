import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { competition, token, authenticated } from '../../lib/api';

export default function JoinWithCode() {
  const router = useRouter();
  const { code } = router.query;
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState({ type: '', content: '' });
  const [competitionDetails, setCompetitionDetails] = useState(null);
  const [autoLookupDone, setAutoLookupDone] = useState(false);

  useEffect(() => {
    checkAuthentication();
  }, []);

  useEffect(() => {
    if (user && code && !autoLookupDone) {
      // Auto-lookup competition when code is provided in URL
      handleLookupCompetition(code);
      setAutoLookupDone(true);
    }
  }, [user, code, autoLookupDone]);

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
      console.error('❌ Join with code auth check failed:', error);
      router.push('/login');
    }
  };

  const handleLookupCompetition = async (inviteCode) => {
    if (!inviteCode || !inviteCode.trim()) {
      setMessage({ type: 'error', content: 'Invalid invite code' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', content: '' });

    try {
      console.log('🔍 Looking up competition with code:', inviteCode);
      const result = await competition.getByInviteCode({ invite_code: inviteCode.trim() });

      if (result.success) {
        setCompetitionDetails(result.data);
        console.log('✅ Competition found:', result.data);
      } else {
        setMessage({ 
          type: 'error', 
          content: result.data.message || 'Competition not found' 
        });
        setCompetitionDetails(null);
      }
    } catch (error) {
      setMessage({ 
        type: 'error', 
        content: 'Network error. Please try again.' 
      });
      setCompetitionDetails(null);
    }

    setLoading(false);
  };

  const handleJoinCompetition = async () => {
    if (!competitionDetails || !code) return;

    setLoading(true);
    setMessage({ type: '', content: '' });

    try {
      console.log('🎮 Joining competition:', competitionDetails.competition_id);
      const result = await competition.join({ 
        invite_code: code.trim(),
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
          <div className="subtitle">
            {code ? `Using invite code: ${code.toUpperCase()}` : 'Join a Last Man Standing competition'}
          </div>
        </div>
      </div>

      <div className="content">
        <div className="container">
          <div className="card">
            <h2>Join Competition</h2>
            {code ? (
              <p style={{ color: '#666', marginBottom: '30px' }}>
                You've been invited to join a competition with code <strong>{code.toUpperCase()}</strong>
              </p>
            ) : (
              <p style={{ color: '#666', marginBottom: '30px' }}>
                Loading competition details...
              </p>
            )}

            {/* Status Message */}
            {message.content && (
              <div className={`alert alert-${message.type === 'error' ? 'error' : 'success'}`}>
                {message.content}
              </div>
            )}

            {/* Loading State */}
            {loading && !competitionDetails && (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div className="loading" style={{ margin: '0 auto 20px' }}></div>
                <p>Looking up competition...</p>
              </div>
            )}

            {/* Competition Preview */}
            {competitionDetails && (
              <div style={{ 
                marginTop: '30px', 
                padding: '20px', 
                backgroundColor: '#f8f9fa', 
                borderRadius: '4px',
                border: '1px solid #e9ecef'
              }}>
                <h3>Competition Details 🎯</h3>
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
                  <Link href="/dashboard" className="btn btn-secondary">
                    ← Back to Dashboard
                  </Link>
                </div>
              </div>
            )}

            {/* Help Section */}
            {!competitionDetails && !loading && (
              <div style={{ 
                marginTop: '30px',
                padding: '20px',
                backgroundColor: '#e7f3ff',
                borderRadius: '4px',
                border: '1px solid #b3d9ff'
              }}>
                <h4>💡 What's Next?</h4>
                <ul style={{ marginLeft: '20px', color: '#666' }}>
                  <li>We're looking up the competition details for you</li>
                  <li>If the invite code is valid, you'll see the competition preview</li>
                  <li>Click "Join" to become a player in the competition</li>
                  <li>Once joined, you'll be able to make picks each round</li>
                </ul>
              </div>
            )}

            {/* Navigation */}
            <div className="nav" style={{ marginTop: '30px' }}>
              <Link href="/join" className="nav-link">
                ← Enter Different Code
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}