import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { token, authenticated, competition } from '../../../lib/api';

export default function MakePick() {
  const router = useRouter();
  const { id } = router.query; // competition_id
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [competitionDetails, setCompetitionDetails] = useState(null);
  const [currentRound, setCurrentRound] = useState(null);
  const [fixtures, setFixtures] = useState([]);
  const [userPicks, setUserPicks] = useState([]);
  const [existingPick, setExistingPick] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [message, setMessage] = useState({ type: '', content: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (id) {
      checkAuthentication();
    }
  }, [id]);

  const checkAuthentication = async () => {
    if (!id) {
      console.log('⏳ Waiting for router ID...');
      return;
    }

    const jwt = token.get();
    
    if (!jwt) {
      router.push('/login');
      return;
    }

    try {
      const result = await authenticated.getProfile(jwt);
      
      if (result.success) {
        setUser(result.data);
        await loadCompetitionData();
      } else {
        token.remove();
        router.push('/login');
        return;
      }
    } catch (error) {
      console.error('❌ Pick page auth check failed:', error);
      router.push('/login');
    }

    setLoading(false);
  };

  const loadCompetitionData = async () => {
    try {
      console.log('📋 Loading competition pick data for ID:', id);
      
      if (!id) {
        console.log('⏳ ID not available yet, skipping load');
        return;
      }

      // Load competition details
      const compResult = await competition.get({ competition_id: parseInt(id) });
      if (compResult.success) {
        setCompetitionDetails(compResult.data);
        console.log('✅ Loaded competition details:', compResult.data);
      }

      // Load user's picks and current round info
      const picksResult = await competition.getUserPicks({ competition_id: parseInt(id) });
      if (picksResult.success) {
        setUserPicks(picksResult.data.picks || []);
        setCurrentRound(picksResult.data.current_round);
        console.log('✅ Loaded user picks:', picksResult.data.picks);
        console.log('✅ Current round:', picksResult.data.current_round);
        
        // Check if user has already made a pick for current round
        if (picksResult.data.current_round) {
          const currentRoundPick = picksResult.data.picks.find(
            pick => pick.round.id === picksResult.data.current_round.id
          );
          if (currentRoundPick) {
            setExistingPick(currentRoundPick);
            setSelectedTeam(currentRoundPick.team.id.toString());
          }
        }
      } else {
        console.error('❌ Failed to load user picks:', picksResult.data);
      }

      // Load current round fixtures if there's an open round
      if (picksResult.success && picksResult.data.current_round) {
        const roundsResult = await competition.getRounds({ competition_id: parseInt(id) });
        if (roundsResult.success) {
          const currentRoundData = roundsResult.data.rounds.find(
            round => round.id === picksResult.data.current_round.id
          );
          if (currentRoundData) {
            setFixtures(currentRoundData.fixtures || []);
            console.log('✅ Loaded fixtures:', currentRoundData.fixtures);
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Failed to load competition data:', error);
      setMessage({ 
        type: 'error', 
        content: 'Failed to load competition data' 
      });
    }
  };

  const handleSubmitPick = async () => {
    if (!selectedTeam) {
      setMessage({ type: 'error', content: 'Please select a team' });
      return;
    }

    if (!currentRound) {
      setMessage({ type: 'error', content: 'No active round available' });
      return;
    }

    setSubmitting(true);
    setMessage({ type: '', content: '' });

    try {
      console.log('🎯 Submitting pick:', selectedTeam, 'for round:', currentRound.id);
      
      const result = await competition.submitPick({
        competition_id: parseInt(id),
        round_id: currentRound.id,
        team_id: parseInt(selectedTeam)
      });
      
      if (result.success) {
        setMessage({ 
          type: 'success', 
          content: `${result.data.message} 🎉` 
        });
        
        // Refresh the pick data
        await loadCompetitionData();
        
        // Redirect back to player dashboard after a moment
        setTimeout(() => {
          router.push('/player/dashboard');
        }, 3000);
      } else {
        setMessage({ 
          type: 'error', 
          content: result.data.message || 'Failed to submit pick' 
        });
      }
      
    } catch (error) {
      console.error('❌ Pick submission failed:', error);
      setMessage({ 
        type: 'error', 
        content: 'Network error. Please try again.' 
      });
    }

    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="page">
        <div className="header">
          <div className="container">
            <h1>🎯 Make Your Pick</h1>
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
          <h1>🎯 Make Your Pick</h1>
          <div className="subtitle">
            {competitionDetails?.name} {currentRound && `- Round ${currentRound.round_number}: ${currentRound.name}`}
          </div>
        </div>
      </div>

      <div className="content">
        <div className="container">
          <div className="card">
            <h2>Current Round Fixtures</h2>
            
            {/* Status Message */}
            {message.content && (
              <div className={`alert alert-${message.type === 'error' ? 'error' : 'success'}`}>
                {message.content}
              </div>
            )}

            {/* Check if there's a current round */}
            {!currentRound ? (
              <div className="alert alert-info">
                📅 <strong>No Active Round</strong><br/>
                There are currently no rounds available for picks. The competition organizer needs to create rounds with fixtures before you can make picks.
              </div>
            ) : fixtures.length === 0 ? (
              <div>
                <div className="alert alert-info">
                  📅 <strong>Fixtures Not Yet Available</strong><br/>
                  The competition organizer hasn't set up fixtures for this round yet. 
                  Fixtures and pick submission will be available once the organizer creates the round schedule.
                </div>

                {/* Mock Pick Interface (for demonstration) */}
                <div style={{ 
                  marginTop: '30px',
                  padding: '20px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '8px',
                  border: '2px dashed #dee2e6'
                }}>
                  <h3>🚧 Preview: Pick Submission Interface</h3>
                  <p style={{ color: '#666', marginBottom: '20px' }}>
                    This is how the pick submission will look when fixtures are available:
                  </p>

                  <div style={{ marginBottom: '20px' }}>
                    <h4>Round 1 Fixtures (Example)</h4>
                    <div style={{ 
                      border: '1px solid #e9ecef', 
                      borderRadius: '4px', 
                      padding: '15px',
                      marginBottom: '10px',
                      backgroundColor: 'white'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong>Arsenal vs Chelsea</strong><br/>
                          <small style={{ color: '#666' }}>Saturday 3:00 PM</small>
                        </div>
                        <div>
                          <button disabled className="btn btn-secondary" style={{ marginRight: '5px' }}>
                            Arsenal
                          </button>
                          <button disabled className="btn btn-secondary">
                            Chelsea
                          </button>
                        </div>
                      </div>
                    </div>

                    <div style={{ 
                      border: '1px solid #e9ecef', 
                      borderRadius: '4px', 
                      padding: '15px',
                      backgroundColor: 'white'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong>Liverpool vs Manchester City</strong><br/>
                          <small style={{ color: '#666' }}>Sunday 4:30 PM</small>
                        </div>
                        <div>
                          <button disabled className="btn btn-secondary" style={{ marginRight: '5px' }}>
                            Liverpool
                          </button>
                          <button disabled className="btn btn-secondary">
                            Man City
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="alert alert-warning">
                    ⚠️ <strong>Remember:</strong> You can only pick each team once per competition (No Team Twice rule)
                  </div>

                  <button disabled className="btn btn-primary">
                    🔒 Submit Pick (Disabled - No Fixtures)
                  </button>
                </div>
              </div>
            ) : (
              /* Real Pick Interface */
              <div>
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h4>{currentRound.name} Fixtures</h4>
                    <div style={{ fontSize: '14px', color: '#666' }}>
                      Pick closes: {new Date(currentRound.lock_time).toLocaleString()}
                    </div>
                  </div>

                  {existingPick && (
                    <div className="alert alert-success" style={{ marginBottom: '15px' }}>
                      ✅ <strong>Current Pick:</strong> {existingPick.team.name} 
                      <span style={{ marginLeft: '10px', fontSize: '12px' }}>
                        (You can change your pick until the deadline)
                      </span>
                    </div>
                  )}

                  {/* Fixtures List */}
                  {fixtures.map((fixture) => (
                    <div key={fixture.id} style={{
                      border: '1px solid #e9ecef',
                      borderRadius: '4px',
                      padding: '15px',
                      marginBottom: '10px',
                      backgroundColor: 'white'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong>{fixture.home_team.name} vs {fixture.away_team.name}</strong><br/>
                          <small style={{ color: '#666' }}>
                            {new Date(fixture.kickoff_time).toLocaleString()}
                          </small>
                        </div>
                        <div>
                          <button 
                            onClick={() => setSelectedTeam(fixture.home_team.id.toString())}
                            className={`btn ${selectedTeam === fixture.home_team.id.toString() ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ marginRight: '8px' }}
                            disabled={submitting}
                          >
                            {selectedTeam === fixture.home_team.id.toString() ? '✓' : ''} {fixture.home_team.name}
                          </button>
                          <button 
                            onClick={() => setSelectedTeam(fixture.away_team.id.toString())}
                            className={`btn ${selectedTeam === fixture.away_team.id.toString() ? 'btn-primary' : 'btn-secondary'}`}
                            disabled={submitting}
                          >
                            {selectedTeam === fixture.away_team.id.toString() ? '✓' : ''} {fixture.away_team.name}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* No Team Twice Warning */}
                {userPicks.length > 0 && (
                  <div className="alert alert-warning" style={{ marginBottom: '20px' }}>
                    ⚠️ <strong>Teams you've already picked:</strong> {userPicks.map(pick => pick.team.name).join(', ')}
                    <br/><small>Remember: You cannot pick these teams again in this competition</small>
                  </div>
                )}

                {/* Submit Button */}
                <button 
                  onClick={handleSubmitPick}
                  disabled={!selectedTeam || submitting}
                  className="btn btn-primary"
                  style={{ fontSize: '16px', padding: '12px 24px' }}
                >
                  {submitting ? (
                    <>
                      <div className="loading" style={{ marginRight: '8px' }}></div>
                      {existingPick ? 'Updating Pick...' : 'Submitting Pick...'}
                    </>
                  ) : (
                    `🎯 ${existingPick ? 'Update Pick' : 'Submit Pick'}`
                  )}
                </button>
              </div>
            )}

            {/* Navigation */}
            <div className="nav" style={{ marginTop: '30px' }}>
              <Link href="/player/dashboard" className="nav-link">
                ← Back to Dashboard
              </Link>
            </div>
          </div>

          {/* Help Section */}
          <div className="card">
            <h3>💡 How Picks Work</h3>
            <div style={{ fontSize: '14px', color: '#666', lineHeight: '1.6' }}>
              <ul style={{ marginLeft: '20px' }}>
                <li><strong>Choose one team</strong> from the available fixtures that you think will win</li>
                <li><strong>No Team Twice rule:</strong> You cannot pick the same team again in this competition</li>
                <li><strong>Pick deadline:</strong> Usually 1 hour before the earliest kickoff time</li>
                <li><strong>Results:</strong> Based on 90-minute regulation time only (no extra time)</li>
                <li><strong>Wrong pick?</strong> You lose a life - eliminate all your lives and you're out!</li>
              </ul>

              <div style={{ 
                marginTop: '15px', 
                padding: '10px', 
                backgroundColor: '#fff3cd', 
                borderRadius: '4px',
                border: '1px solid #ffeaa7'
              }}>
                <strong>⏰ Tip:</strong> Submit your pick early! Picks automatically lock before matches start.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}