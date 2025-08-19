import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { token, authenticated, competition } from '../../../lib/api';

export default function ManageCompetition() {
  const router = useRouter();
  const { id } = router.query; // competition_id
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [competitionDetails, setCompetitionDetails] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [teams, setTeams] = useState([]);
  const [message, setMessage] = useState({ type: '', content: '' });
  const [showCreateRound, setShowCreateRound] = useState(false);
  const [editingFixture, setEditingFixture] = useState(null);
  const [enteringResult, setEnteringResult] = useState(null);
  const [editingRound, setEditingRound] = useState(null);

  useEffect(() => {
    checkAuthentication();
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
      console.error('❌ Manage competition auth check failed:', error);
      router.push('/login');
    }

    setLoading(false);
  };

  const loadCompetitionData = async () => {
    try {
      console.log('📋 Loading competition management data for ID:', id);
      
      if (!id) {
        console.log('⏳ ID not available yet, skipping load');
        return;
      }
      
      // Load competition details
      const compResult = await competition.get({ competition_id: parseInt(id) });
      if (compResult.success) {
        setCompetitionDetails(compResult.data);
        console.log('✅ Loaded competition details:', compResult.data);
      } else {
        console.error('❌ Failed to load competition details:', compResult.data);
        setCompetitionDetails({
          id: id,
          name: 'Sample Competition',
          status: 'active',
          team_list_name: 'English Premier League 2025-26',
          player_count: 5,
          timezone: 'Europe/London'
        });
      }

      // Load real teams for fixture creation
      const teamsResult = await competition.getTeams({ competition_id: parseInt(id) });
      if (teamsResult.success) {
        setTeams(teamsResult.data.teams || []);
        console.log('✅ Loaded teams:', teamsResult.data.teams);
      } else {
        console.error('❌ Failed to load teams:', teamsResult.data);
        setTeams([]);
      }

      // Load existing rounds and fixtures
      const roundsResult = await competition.getRounds({ competition_id: parseInt(id) });
      if (roundsResult.success) {
        setRounds(roundsResult.data.rounds || []);
        console.log('✅ Loaded rounds:', roundsResult.data.rounds);
      } else {
        console.error('❌ Failed to load rounds:', roundsResult.data);
        setRounds([]);
      }
      
    } catch (error) {
      console.error('❌ Failed to load competition data:', error);
      setMessage({ 
        type: 'error', 
        content: 'Failed to load competition data' 
      });
    }
  };

  const handleEditFixture = (fixture) => {
    setEditingFixture({
      id: fixture.id,
      home_team_id: fixture.home_team.id,
      away_team_id: fixture.away_team.id,
      kickoff_time: fixture.kickoff_time.slice(0, 16) // Format for datetime-local input
    });
  };

  const handleUpdateFixture = async () => {
    if (!editingFixture.home_team_id || !editingFixture.away_team_id || !editingFixture.kickoff_time) {
      alert('Please complete all fixture fields');
      return;
    }

    if (editingFixture.home_team_id === editingFixture.away_team_id) {
      alert('Home and away teams must be different');
      return;
    }

    try {
      const result = await competition.updateFixture({
        fixture_id: editingFixture.id,
        home_team_id: editingFixture.home_team_id,
        away_team_id: editingFixture.away_team_id,
        kickoff_time: editingFixture.kickoff_time
      });

      if (result.success) {
        setMessage({ type: 'success', content: 'Fixture updated successfully!' });
        setEditingFixture(null);
        await loadCompetitionData(); // Refresh data
      } else {
        alert('Failed to update fixture: ' + (result.data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('❌ Error updating fixture:', error);
      alert('Network error. Please try again.');
    }
  };

  const handleCancelEdit = () => {
    setEditingFixture(null);
  };

  const handleEditRound = (round) => {
    alert(`Adding fixtures to "${round.name}" - This feature coming soon!\n\nFor now, create a new round or edit existing fixtures.`);
  };

  const handleEnterResult = (fixture) => {
    setEnteringResult({
      id: fixture.id,
      home_team: fixture.home_team.name,
      away_team: fixture.away_team.name,
      home_score: fixture.home_score || '',
      away_score: fixture.away_score || ''
    });
  };

  const handleSubmitResult = async () => {
    if (enteringResult.home_score === '' || enteringResult.away_score === '') {
      alert('Please enter both home and away scores');
      return;
    }

    try {
      const result = await competition.enterResult({
        fixture_id: enteringResult.id,
        home_score: parseInt(enteringResult.home_score),
        away_score: parseInt(enteringResult.away_score)
      });

      if (result.success) {
        setMessage({ 
          type: 'success', 
          content: `${result.data.message} (${result.data.pick_processing.winners} winners, ${result.data.pick_processing.losers} eliminated)` 
        });
        setEnteringResult(null);
        await loadCompetitionData(); // Refresh data
      } else {
        alert('Failed to enter result: ' + (result.data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('❌ Error entering result:', error);
      alert('Network error. Please try again.');
    }
  };

  const handleCancelResult = () => {
    setEnteringResult(null);
  };

  if (loading) {
    return (
      <div className="page">
        <div className="header">
          <div className="container">
            <h1>📅 Manage Competition</h1>
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
          <h1>📅 Manage Competition</h1>
          <div className="subtitle">
            {competitionDetails?.name}
          </div>
        </div>
      </div>

      <div className="content">
        <div className="container">
          {/* Competition Overview */}
          <div className="card">
            <h2>Competition Overview</h2>
            
            {/* Status Message */}
            {message.content && (
              <div className={`alert alert-${message.type === 'error' ? 'error' : 'success'}`}>
                {message.content}
              </div>
            )}

            {competitionDetails && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                <div>
                  <strong>Name:</strong><br/>
                  {competitionDetails.name}
                </div>
                <div>
                  <strong>Status:</strong><br/>
                  <span style={{
                    padding: '4px 8px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    🟢 Active
                  </span>
                </div>
                <div>
                  <strong>Players:</strong><br/>
                  👥 {competitionDetails.player_count} joined
                </div>
                <div>
                  <strong>Team List:</strong><br/>
                  {competitionDetails.team_list_name}
                </div>
              </div>
            )}

            <div className="nav">
              <Link href="/dashboard" className="btn btn-secondary">
                ← Back to Dashboard
              </Link>
            </div>
          </div>

          {/* Rounds Management */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>Rounds & Fixtures</h2>
              <button 
                className="btn btn-primary"
                onClick={() => setShowCreateRound(true)}
              >
                ➕ Create Round
              </button>
            </div>

            {rounds.length === 0 ? (
              <div>
                <div className="alert alert-info">
                  📅 <strong>No rounds created yet</strong><br/>
                  Create your first round with fixtures to allow players to make picks.
                  Each round should represent a gameweek or matchday.
                </div>

                {/* Getting Started Guide */}
                <div style={{
                  marginTop: '20px',
                  padding: '20px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '8px',
                  border: '1px solid #e9ecef'
                }}>
                  <h3>🚀 Getting Started with Rounds</h3>
                  <ol style={{ marginLeft: '20px', lineHeight: '1.6' }}>
                    <li><strong>Create a Round:</strong> Click "➕ Create Round" to set up a new gameweek</li>
                    <li><strong>Add Fixtures:</strong> Add matches between teams with kickoff times</li>
                    <li><strong>Set Lock Time:</strong> When picks close (usually 1 hour before first match)</li>
                    <li><strong>Publish Round:</strong> Make it available for players to submit picks</li>
                  </ol>

                  <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#fff3cd', borderRadius: '4px', border: '1px solid #ffeaa7' }}>
                    <strong>💡 Pro Tip:</strong> Create rounds in advance and set future lock times. 
                    Players can see upcoming fixtures but can't submit picks until you're ready.
                  </div>
                </div>
              </div>
            ) : (
              <div>
                {/* Existing Rounds */}
                {rounds.map((round) => (
                  <div key={round.id} style={{
                    border: '1px solid #e9ecef',
                    borderRadius: '8px',
                    marginBottom: '20px',
                    backgroundColor: '#fff'
                  }}>
                    {/* Round Header */}
                    <div style={{
                      padding: '15px 20px',
                      borderBottom: '1px solid #e9ecef',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '8px 8px 0 0'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <h3 style={{ margin: 0 }}>Round {round.round_number}: {round.name}</h3>
                          <p style={{ margin: '5px 0 0 0', color: '#666', fontSize: '14px' }}>
                            {round.fixture_count} fixture{round.fixture_count !== 1 ? 's' : ''} • 
                            Lock time: {new Date(round.lock_time).toLocaleString()}
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{
                            padding: '4px 8px',
                            backgroundColor: round.status === 'open' ? '#28a745' : 
                                           round.status === 'locked' ? '#ffc107' : '#6c757d',
                            color: 'white',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}>
                            {round.status === 'open' ? '🟢 Open' :
                             round.status === 'locked' ? '🔒 Locked' : '🏁 Complete'}
                          </span>
                          <button 
                            onClick={() => handleEditRound(round)}
                            className="btn btn-secondary" 
                            style={{ padding: '4px 8px', fontSize: '12px' }}
                          >
                            ➕ Add Fixture
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Fixtures */}
                    <div style={{ padding: '15px 20px' }}>
                      {round.fixtures.length === 0 ? (
                        <p style={{ color: '#666', fontStyle: 'italic' }}>No fixtures in this round</p>
                      ) : (
                        <div style={{ display: 'grid', gap: '10px' }}>
                          {round.fixtures.map((fixture) => (
                            <div key={fixture.id} style={{
                              padding: '12px 15px',
                              backgroundColor: editingFixture?.id === fixture.id ? '#fff3cd' : 
                                              enteringResult?.id === fixture.id ? '#e7f3ff' :
                                              fixture.home_score !== null ? '#d4edda' : '#f8f9fa',
                              borderRadius: '4px',
                              border: editingFixture?.id === fixture.id ? '2px solid #ffc107' : 
                                     enteringResult?.id === fixture.id ? '2px solid #007bff' :
                                     fixture.home_score !== null ? '2px solid #28a745' : '1px solid #e9ecef'
                            }}>
                              {enteringResult?.id === fixture.id ? (
                                /* Result Entry Mode */
                                <div>
                                  <div style={{ marginBottom: '10px' }}>
                                    <strong>Enter Result: {enteringResult.home_team} vs {enteringResult.away_team}</strong>
                                  </div>
                                  
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                                    <span style={{ minWidth: '100px' }}>{enteringResult.home_team}</span>
                                    <input
                                      type="number"
                                      min="0"
                                      value={enteringResult.home_score}
                                      onChange={(e) => setEnteringResult(prev => ({ ...prev, home_score: e.target.value }))}
                                      style={{ width: '60px', textAlign: 'center' }}
                                      className="form-input"
                                    />
                                    <span>-</span>
                                    <input
                                      type="number"
                                      min="0"
                                      value={enteringResult.away_score}
                                      onChange={(e) => setEnteringResult(prev => ({ ...prev, away_score: e.target.value }))}
                                      style={{ width: '60px', textAlign: 'center' }}
                                      className="form-input"
                                    />
                                    <span style={{ minWidth: '100px' }}>{enteringResult.away_team}</span>
                                  </div>
                                  
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    <button 
                                      onClick={handleSubmitResult}
                                      className="btn btn-primary"
                                      style={{ padding: '4px 12px', fontSize: '12px' }}
                                    >
                                      ⚽ Enter Result
                                    </button>
                                    <button 
                                      onClick={handleCancelResult}
                                      className="btn btn-secondary"
                                      style={{ padding: '4px 12px', fontSize: '12px' }}
                                    >
                                      ❌ Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : editingFixture?.id === fixture.id ? (
                                /* Editing Mode */
                                <div>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                                    <select
                                      value={editingFixture.home_team_id}
                                      onChange={(e) => setEditingFixture(prev => ({ ...prev, home_team_id: e.target.value }))}
                                      className="form-input"
                                      style={{ fontSize: '14px' }}
                                    >
                                      <option value="">Select Home Team</option>
                                      {teams.map(team => (
                                        <option key={team.id} value={team.id}>{team.name}</option>
                                      ))}
                                    </select>
                                    
                                    <span style={{ fontWeight: 'bold' }}>vs</span>
                                    
                                    <select
                                      value={editingFixture.away_team_id}
                                      onChange={(e) => setEditingFixture(prev => ({ ...prev, away_team_id: e.target.value }))}
                                      className="form-input"
                                      style={{ fontSize: '14px' }}
                                    >
                                      <option value="">Select Away Team</option>
                                      {teams.map(team => (
                                        <option key={team.id} value={team.id}>{team.name}</option>
                                      ))}
                                    </select>
                                    
                                    <input
                                      type="datetime-local"
                                      value={editingFixture.kickoff_time}
                                      onChange={(e) => setEditingFixture(prev => ({ ...prev, kickoff_time: e.target.value }))}
                                      className="form-input"
                                      style={{ minWidth: '180px', fontSize: '14px' }}
                                    />
                                  </div>
                                  
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    <button 
                                      onClick={handleUpdateFixture}
                                      className="btn btn-primary"
                                      style={{ padding: '4px 12px', fontSize: '12px' }}
                                    >
                                      ✅ Save
                                    </button>
                                    <button 
                                      onClick={handleCancelEdit}
                                      className="btn btn-secondary"
                                      style={{ padding: '4px 12px', fontSize: '12px' }}
                                    >
                                      ❌ Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                /* Display Mode */
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <div style={{ minWidth: '120px', textAlign: 'right' }}>
                                      <strong>{fixture.home_team.name}</strong>
                                    </div>
                                    <div style={{ fontWeight: 'bold', color: '#666' }}>vs</div>
                                    <div style={{ minWidth: '120px' }}>
                                      <strong>{fixture.away_team.name}</strong>
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px', fontSize: '14px' }}>
                                    <div style={{ color: '#666' }}>
                                      {new Date(fixture.kickoff_time).toLocaleString()}
                                    </div>
                                    {fixture.home_score !== null && fixture.away_score !== null && (
                                      <div style={{
                                        padding: '4px 8px',
                                        backgroundColor: '#007bff',
                                        color: 'white',
                                        borderRadius: '4px',
                                        fontWeight: 'bold'
                                      }}>
                                        {fixture.home_score} - {fixture.away_score}
                                      </div>
                                    )}
                                    <span style={{
                                      padding: '2px 6px',
                                      backgroundColor: fixture.status === 'scheduled' ? '#6c757d' : 
                                                     fixture.status === 'live' ? '#28a745' : '#007bff',
                                      color: 'white',
                                      borderRadius: '4px',
                                      fontSize: '11px'
                                    }}>
                                      {fixture.status || 'scheduled'}
                                    </span>
                                    {round.status === 'open' && fixture.home_score === null && (
                                      <>
                                        <button 
                                          onClick={() => handleEditFixture(fixture)}
                                          className="btn btn-secondary"
                                          style={{ padding: '2px 6px', fontSize: '11px', marginRight: '4px' }}
                                        >
                                          ✏️
                                        </button>
                                        <button 
                                          onClick={() => handleEnterResult(fixture)}
                                          className="btn btn-success"
                                          style={{ padding: '2px 6px', fontSize: '11px' }}
                                        >
                                          ⚽
                                        </button>
                                      </>
                                    )}
                                    {fixture.home_score !== null && (
                                      <button 
                                        onClick={() => handleEnterResult(fixture)}
                                        className="btn btn-warning"
                                        style={{ padding: '2px 6px', fontSize: '11px' }}
                                        title="Update result"
                                      >
                                        📝
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Create Round Modal/Section */}
          {showCreateRound && (
            <div className="card" style={{ backgroundColor: '#e7f3ff', border: '2px solid #007bff' }}>
              <h3>➕ Create New Round</h3>
              <CreateRoundForm 
                competitionId={parseInt(id)}
                teams={teams}
                rounds={rounds}
                onCancel={() => setShowCreateRound(false)}
                onSuccess={() => {
                  setShowCreateRound(false);
                  loadCompetitionData(); // Refresh data
                }}
              />
            </div>
          )}

          {/* Help Section */}
          <div className="card">
            <h3>💡 Round Management Guide</h3>
            <div style={{ fontSize: '14px', color: '#666', lineHeight: '1.6' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                <div>
                  <h4>📅 Round Planning</h4>
                  <ul style={{ marginLeft: '20px' }}>
                    <li>Each round = one gameweek</li>
                    <li>Add 3-10 fixtures per round</li>
                    <li>Set realistic kickoff times</li>
                    <li>Lock picks 1-2 hours before first match</li>
                  </ul>
                </div>
                
                <div>
                  <h4>⚽ Fixture Management</h4>
                  <ul style={{ marginLeft: '20px' }}>
                    <li>Home vs Away team format</li>
                    <li>Accurate kickoff times crucial</li>
                    <li>Can edit before round starts</li>
                    <li>Results entered after matches</li>
                  </ul>
                </div>
                
                <div>
                  <h4>🎯 Player Experience</h4>
                  <ul style={{ marginLeft: '20px' }}>
                    <li>Players pick ONE team to win</li>
                    <li>"No team twice" rule enforced</li>
                    <li>Picks lock automatically</li>
                    <li>Wrong pick = lose a life</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Create Round Form Component
function CreateRoundForm({ competitionId, teams, rounds, onCancel, onSuccess }) {
  const [roundData, setRoundData] = useState({
    round_number: (rounds && rounds.length > 0) ? Math.max(...rounds.map(r => r.round_number)) + 1 : 1,
    name: '',
    fixtures: []
  });
  const [submitting, setSubmitting] = useState(false);

  const addFixture = () => {
    setRoundData(prev => ({
      ...prev,
      fixtures: [...prev.fixtures, {
        home_team_id: '',
        away_team_id: '',
        kickoff_time: ''
      }]
    }));
  };

  const removeFixture = (index) => {
    setRoundData(prev => ({
      ...prev,
      fixtures: prev.fixtures.filter((_, i) => i !== index)
    }));
  };

  const updateFixture = (index, field, value) => {
    setRoundData(prev => ({
      ...prev,
      fixtures: prev.fixtures.map((fixture, i) => 
        i === index ? { ...fixture, [field]: value } : fixture
      )
    }));
  };

  const handleSubmit = async () => {
    if (!roundData.name.trim()) {
      alert('Please enter a round name');
      return;
    }
    
    if (roundData.fixtures.length === 0) {
      alert('Please add at least one fixture');
      return;
    }

    // Validate fixtures
    for (let i = 0; i < roundData.fixtures.length; i++) {
      const fixture = roundData.fixtures[i];
      if (!fixture.home_team_id || !fixture.away_team_id || !fixture.kickoff_time) {
        alert(`Please complete fixture ${i + 1}`);
        return;
      }
      if (fixture.home_team_id === fixture.away_team_id) {
        alert(`Fixture ${i + 1}: Home and away teams must be different`);
        return;
      }
    }

    setSubmitting(true);
    try {
      console.log('🏗️ Creating round:', roundData);
      
      const result = await competition.createRound({
        competition_id: competitionId,
        round_number: roundData.round_number,
        name: roundData.name,
        fixtures: roundData.fixtures
      });

      if (result.success) {
        alert(`Round created successfully! Lock time: ${new Date(result.data.lock_time).toLocaleString()}`);
        onSuccess();
      } else {
        alert('Failed to create round: ' + (result.data.message || 'Unknown error'));
      }
      
    } catch (error) {
      console.error('❌ Error creating round:', error);
      alert('Failed to create round');
    }
    setSubmitting(false);
  };

  return (
    <div>
      <div className="form">
        <div className="form-group">
          <label className="form-label">Round Name *</label>
          <input
            type="text"
            value={roundData.name}
            onChange={(e) => setRoundData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Round 1, Gameweek 1, Week 1"
            className="form-input"
          />
        </div>

        <div className="alert alert-info" style={{ margin: '10px 0' }}>
          ⏰ <strong>Pick Lock Time:</strong> Automatically set to 1 hour before the earliest kickoff time
        </div>
      </div>

      <h4>Fixtures</h4>
      {roundData.fixtures.map((fixture, index) => (
        <div key={index} style={{
          border: '1px solid #e9ecef',
          borderRadius: '4px',
          padding: '15px',
          marginBottom: '10px',
          backgroundColor: '#fff'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <strong>Fixture {index + 1}</strong>
            <button 
              type="button"
              onClick={() => removeFixture(index)}
              className="btn btn-danger"
              style={{ padding: '2px 8px', fontSize: '12px' }}
            >
              ✕
            </button>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto', gap: '10px', alignItems: 'center' }}>
            <select
              value={fixture.home_team_id}
              onChange={(e) => updateFixture(index, 'home_team_id', e.target.value)}
              className="form-input"
            >
              <option value="">Select Home Team</option>
              {teams.map(team => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
            
            <span style={{ fontWeight: 'bold' }}>vs</span>
            
            <select
              value={fixture.away_team_id}
              onChange={(e) => updateFixture(index, 'away_team_id', e.target.value)}
              className="form-input"
            >
              <option value="">Select Away Team</option>
              {teams.map(team => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
            
            <input
              type="datetime-local"
              value={fixture.kickoff_time}
              onChange={(e) => updateFixture(index, 'kickoff_time', e.target.value)}
              className="form-input"
              style={{ minWidth: '180px' }}
            />
          </div>
        </div>
      ))}

      <div style={{ marginBottom: '20px' }}>
        <button 
          type="button"
          onClick={addFixture}
          className="btn btn-secondary"
        >
          ➕ Add Fixture
        </button>
      </div>

      <div className="nav">
        <button 
          onClick={handleSubmit}
          disabled={submitting}
          className="btn btn-primary"
        >
          {submitting ? (
            <>
              <div className="loading" style={{ marginRight: '8px' }}></div>
              Creating...
            </>
          ) : (
            '🏗️ Create Round'
          )}
        </button>
        <button 
          onClick={onCancel}
          className="btn btn-secondary"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}