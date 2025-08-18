import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { competition, token, authenticated } from '../../lib/api';

export default function CreateCompetition() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [teamLists, setTeamLists] = useState([]);
  const [message, setMessage] = useState({ type: '', content: '' });

  // Form data state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    logo_url: '',
    team_list_id: '',
    lives_per_player: 1,
    no_team_twice: true,
    lock_hours_before_kickoff: 1,
    timezone: 'Europe/London',
    organisation_id: null, // Will be set from user profile
    join_as_player: true // New option to auto-join as player
  });

  useEffect(() => {
    // Redirect if not logged in
    if (!token.isLoggedIn()) {
      router.push('/login');
      return;
    }

    // Initialize user data and load team lists
    initializeData();
  }, []);

  const initializeData = async () => {
    try {
      // Get user profile to determine organisation
      const jwt = token.get();
      const profileResult = await authenticated.getProfile(jwt);
      
      if (profileResult.success) {
        // Get organisation ID from localStorage (set during onboarding)
        const orgId = localStorage.getItem('current_organisation_id');
        
        if (!orgId) {
          setMessage({ 
            type: 'error', 
            content: 'No organisation found. Please complete onboarding first.' 
          });
          setTimeout(() => {
            router.push('/onboarding');
          }, 2000);
          return;
        }
        
        setFormData(prev => ({ ...prev, organisation_id: parseInt(orgId) }));
        
        // Now load team lists with the organisation ID
        await loadTeamLists(parseInt(orgId));
      } else {
        setMessage({ 
          type: 'error', 
          content: 'Failed to load user profile' 
        });
      }
    } catch (error) {
      setMessage({ 
        type: 'error', 
        content: 'Error initializing page' 
      });
    } finally {
      setInitializing(false);
    }
  };

  const loadTeamLists = async (orgId = null) => {
    try {
      const organisationId = orgId || formData.organisation_id;
      
      if (!organisationId) {
        setMessage({ 
          type: 'error', 
          content: 'Organisation ID not available' 
        });
        return;
      }

      const result = await competition.getTeamLists({ organisation_id: organisationId });
      
      if (result.success) {
        setTeamLists(result.data.team_lists || []);
        console.log('✅ Team lists loaded:', result.data.team_lists);
      } else {
        setMessage({ 
          type: 'error', 
          content: result.data.message || 'Failed to load team lists' 
        });
      }
    } catch (error) {
      setMessage({ 
        type: 'error', 
        content: 'Network error loading team lists' 
      });
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear messages when user types
    if (message.content) {
      setMessage({ type: '', content: '' });
    }
  };

  const validateStep = (step) => {
    switch (step) {
      case 1:
        if (!formData.name.trim()) {
          setMessage({ type: 'error', content: 'Competition name is required' });
          return false;
        }
        break;
      case 2:
        if (!formData.team_list_id) {
          setMessage({ type: 'error', content: 'Please select a team list' });
          return false;
        }
        break;
      case 3:
        if (formData.lives_per_player < 1 || formData.lives_per_player > 5) {
          setMessage({ type: 'error', content: 'Lives per player must be between 1 and 5' });
          return false;
        }
        if (formData.lock_hours_before_kickoff < 0 || formData.lock_hours_before_kickoff > 72) {
          setMessage({ type: 'error', content: 'Lock hours must be between 0 and 72' });
          return false;
        }
        break;
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 4));
      setMessage({ type: '', content: '' });
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    setMessage({ type: '', content: '' });
  };

  const handleSubmit = async () => {
    if (!validateStep(3)) return;

    setLoading(true);
    setMessage({ type: '', content: '' });

    try {
      console.log('🏆 Creating competition:', formData);
      console.log('📋 Organisation ID check:', formData.organisation_id);
      const result = await competition.create(formData);

      if (result.success) {
        const roleText = formData.join_as_player ? ' You are now both organizer and player!' : '';
        setMessage({ 
          type: 'success', 
          content: `Competition created successfully! Invite code: ${result.data.invite_code}.${roleText}` 
        });
        
        // Move to final step showing success
        setCurrentStep(4);
      } else {
        setMessage({ 
          type: 'error', 
          content: result.data.message || 'Failed to create competition' 
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

  const selectedTeamList = teamLists.find(tl => tl.id === parseInt(formData.team_list_id));

  // Show loading screen while initializing
  if (initializing) {
    return (
      <div className="page">
        <div className="header">
          <div className="container">
            <h1>🏆 Create Competition</h1>
            <div className="subtitle">Setting up...</div>
          </div>
        </div>

        <div className="content">
          <div className="container">
            <div className="card" style={{ textAlign: 'center' }}>
              <div className="loading" style={{ margin: '20px auto' }}></div>
              <p>Initializing competition creation wizard...</p>
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
          <h1>🏆 Create Competition</h1>
          <div className="subtitle">Set up your Last Man Standing competition</div>
        </div>
      </div>

      <div className="content">
        <div className="container">
          {/* Progress Steps */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              {[1, 2, 3, 4].map(step => (
                <div 
                  key={step}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '20px',
                    backgroundColor: step <= currentStep ? '#007bff' : '#e0e0e0',
                    color: step <= currentStep ? 'white' : '#666',
                    fontWeight: step === currentStep ? 'bold' : 'normal'
                  }}
                >
                  {step === 1 && 'Basic Info'}
                  {step === 2 && 'Teams'}
                  {step === 3 && 'Rules'}
                  {step === 4 && 'Complete'}
                </div>
              ))}
            </div>

            {/* Status Message */}
            {message.content && (
              <div className={`alert alert-${message.type === 'error' ? 'error' : 'success'}`}>
                {message.content}
              </div>
            )}

            {/* Step 1: Basic Information */}
            {currentStep === 1 && (
              <div>
                <h3>Competition Details</h3>
                <p style={{ marginBottom: '20px', color: '#666' }}>
                  Enter the basic information for your competition.
                </p>

                <div className="form">
                  <div className="form-group">
                    <label className="form-label">Competition Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      placeholder="e.g., Red Lion Premier League 2025"
                      className="form-input"
                      autoFocus
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      placeholder="Optional description of your competition"
                      className="form-input"
                      rows="3"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Logo URL</label>
                    <input
                      type="url"
                      value={formData.logo_url}
                      onChange={(e) => handleInputChange('logo_url', e.target.value)}
                      placeholder="https://example.com/logo.jpg (optional)"
                      className="form-input"
                    />
                  </div>
                </div>

                <div style={{ marginTop: '30px', display: 'flex', gap: '10px' }}>
                  <button 
                    onClick={nextStep}
                    disabled={!formData.name.trim()}
                    className="btn btn-primary"
                  >
                    Next: Select Teams →
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Team Selection */}
            {currentStep === 2 && (
              <div>
                <h3>Select Team List</h3>
                <p style={{ marginBottom: '20px', color: '#666' }}>
                  Choose which teams will be available for player selections.
                </p>

                <div className="form">
                  {teamLists.length === 0 ? (
                    <div className="alert alert-info">
                      Loading team lists...
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {teamLists.map(teamList => (
                        <label 
                          key={teamList.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '15px',
                            border: formData.team_list_id === teamList.id ? '2px solid #007bff' : '1px solid #ddd',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            backgroundColor: formData.team_list_id === teamList.id ? '#f0f8ff' : 'white'
                          }}
                        >
                          <input
                            type="radio"
                            name="team_list"
                            value={teamList.id}
                            checked={formData.team_list_id === teamList.id}
                            onChange={(e) => handleInputChange('team_list_id', parseInt(e.target.value))}
                            style={{ marginRight: '12px' }}
                          />
                          <div>
                            <div style={{ fontWeight: 'bold' }}>{teamList.name}</div>
                            <div style={{ fontSize: '14px', color: '#666' }}>
                              {teamList.team_count} teams • {teamList.type.toUpperCase()}
                              {teamList.season && ` • ${teamList.season}`}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '30px', display: 'flex', gap: '10px' }}>
                  <button onClick={prevStep} className="btn btn-secondary">
                    ← Back
                  </button>
                  <button 
                    onClick={nextStep}
                    disabled={!formData.team_list_id}
                    className="btn btn-primary"
                  >
                    Next: Set Rules →
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Rules Configuration */}
            {currentStep === 3 && (
              <div>
                <h3>Competition Rules</h3>
                <p style={{ marginBottom: '20px', color: '#666' }}>
                  Configure the rules and timing for your competition.
                </p>

                <div className="form">
                  <div className="form-group">
                    <label className="form-label">Lives per Player</label>
                    <select
                      value={formData.lives_per_player}
                      onChange={(e) => handleInputChange('lives_per_player', parseInt(e.target.value))}
                      className="form-input"
                    >
                      {[1, 2, 3, 4, 5].map(num => (
                        <option key={num} value={num}>
                          {num} {num === 1 ? 'Life' : 'Lives'}
                        </option>
                      ))}
                    </select>
                    <small style={{ color: '#666' }}>
                      How many incorrect predictions a player can make before elimination
                    </small>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={formData.no_team_twice}
                        onChange={(e) => handleInputChange('no_team_twice', e.target.checked)}
                        style={{ marginRight: '8px' }}
                      />
                      No Team Twice Rule
                    </label>
                    <small style={{ color: '#666' }}>
                      Players cannot pick the same team twice during the competition
                    </small>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={formData.join_as_player}
                        onChange={(e) => handleInputChange('join_as_player', e.target.checked)}
                        style={{ marginRight: '8px' }}
                      />
                      Join as Player
                    </label>
                    <small style={{ color: '#666' }}>
                      Automatically add yourself as a player so you can participate alongside others. 
                      You'll be able to make picks each round while still managing the competition.
                    </small>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Lock Selections (Hours Before Kickoff)</label>
                    <select
                      value={formData.lock_hours_before_kickoff}
                      onChange={(e) => handleInputChange('lock_hours_before_kickoff', parseInt(e.target.value))}
                      className="form-input"
                    >
                      {[0, 1, 2, 4, 6, 12, 24, 48, 72].map(hours => (
                        <option key={hours} value={hours}>
                          {hours === 0 ? 'At kickoff' : `${hours} hour${hours === 1 ? '' : 's'} before`}
                        </option>
                      ))}
                    </select>
                    <small style={{ color: '#666' }}>
                      When to lock player selections before the earliest match
                    </small>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Timezone</label>
                    <select
                      value={formData.timezone}
                      onChange={(e) => handleInputChange('timezone', e.target.value)}
                      className="form-input"
                    >
                      <option value="Europe/London">🇬🇧 London (GMT/BST)</option>
                      <option value="Europe/Paris">🇫🇷 Paris (CET/CEST)</option>
                      <option value="America/New_York">🇺🇸 New York (EST/EDT)</option>
                      <option value="America/Los_Angeles">🇺🇸 Los Angeles (PST/PDT)</option>
                      <option value="Australia/Sydney">🇦🇺 Sydney (AEST/AEDT)</option>
                    </select>
                  </div>
                </div>

                {/* Dual Role Explanation */}
                {formData.join_as_player && (
                  <div style={{ 
                    marginTop: '20px',
                    padding: '15px',
                    backgroundColor: '#e7f3ff',
                    borderRadius: '4px',
                    border: '1px solid #b3d9ff'
                  }}>
                    <h5>🎯 Dual Role Benefits</h5>
                    <ul style={{ marginLeft: '20px', color: '#666', fontSize: '14px' }}>
                      <li>Compete alongside your customers/colleagues</li>
                      <li>Builds engagement and community spirit</li>
                      <li>Experience the game from both perspectives</li>
                      <li>Switch between managing and playing views</li>
                    </ul>
                  </div>
                )}

                <div style={{ marginTop: '30px', display: 'flex', gap: '10px' }}>
                  <button onClick={prevStep} className="btn btn-secondary">
                    ← Back
                  </button>
                  <button 
                    onClick={handleSubmit}
                    disabled={loading}
                    className="btn btn-success"
                  >
                    {loading ? (
                      <>
                        <div className="loading" style={{ marginRight: '8px' }}></div>
                        Creating Competition...
                      </>
                    ) : (
                      formData.join_as_player ? '🏆 Create & Join Competition' : '🏆 Create Competition'
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Success */}
            {currentStep === 4 && (
              <div style={{ textAlign: 'center' }}>
                <h3>🎉 Competition Created!</h3>
                <p style={{ marginBottom: '20px', color: '#666' }}>
                  Your competition has been created successfully.
                </p>

                <div className="card" style={{ backgroundColor: '#f8f9fa' }}>
                  <h4>Competition Summary</h4>
                  <div style={{ textAlign: 'left', marginTop: '15px' }}>
                    <p><strong>Name:</strong> {formData.name}</p>
                    {formData.description && <p><strong>Description:</strong> {formData.description}</p>}
                    <p><strong>Team List:</strong> {selectedTeamList?.name}</p>
                    <p><strong>Lives per Player:</strong> {formData.lives_per_player}</p>
                    <p><strong>No Team Twice:</strong> {formData.no_team_twice ? 'Yes' : 'No'}</p>
                    <p><strong>Lock Time:</strong> {formData.lock_hours_before_kickoff} hours before kickoff</p>
                    <p><strong>Your Participation:</strong> {formData.join_as_player ? 'Organizer + Player' : 'Organizer only'}</p>
                  </div>
                </div>

                <div style={{ marginTop: '30px', display: 'flex', gap: '15px', justifyContent: 'center' }}>
                  <Link href="/dashboard" className="btn btn-primary">
                    📊 Go to Dashboard
                  </Link>
                  <Link href="/competition/create" className="btn btn-secondary">
                    ➕ Create Another Competition
                  </Link>
                </div>
              </div>
            )}

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