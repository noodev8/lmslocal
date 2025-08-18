import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { token, authenticated, organisation } from '../../lib/api';

export default function OrganizerOnboarding() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState({ type: '', content: '' });
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: ''
  });

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
      console.error('❌ Organizer onboarding auth check failed:', error);
      router.push('/login');
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Auto-generate slug from name
    if (field === 'name') {
      const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single
        .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
      
      setFormData(prev => ({ ...prev, slug }));
    }
    
    // Clear messages when user types
    if (message.content) {
      setMessage({ type: '', content: '' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.name.trim()) {
      setMessage({ type: 'error', content: 'Organisation name is required' });
      return;
    }
    
    if (!formData.slug.trim()) {
      setMessage({ type: 'error', content: 'URL slug is required' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', content: '' });

    try {
      console.log('🏢 Creating organisation:', formData);
      const result = await organisation.create({
        name: formData.name.trim(),
        slug: formData.slug.trim(),
        description: formData.description.trim() || null,
        owner_email: user.email,
        owner_name: user.display_name
      });

      if (result.success) {
        // Store the organisation context
        localStorage.setItem('current_organisation_id', result.data.organisation_id);
        localStorage.setItem('user_role', 'organizer');
        
        setMessage({ 
          type: 'success', 
          content: `🎉 ${formData.name} created successfully!` 
        });
        
        // Redirect to competition creation
        setTimeout(() => {
          router.push('/competition/create');
        }, 2000);
      } else {
        setMessage({ 
          type: 'error', 
          content: result.data.message || 'Failed to create organisation' 
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
            <h1>🏆 Setup Your Organization</h1>
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
          <h1>🏆 Setup Your Organization</h1>
          <div className="subtitle">Create your venue and start running competitions</div>
        </div>
      </div>

      <div className="content">
        <div className="container">
          <div className="card">
            <h2>Organization Details</h2>
            <p style={{ color: '#666', marginBottom: '30px' }}>
              Tell us about your venue, workplace, or club. This will be the home for all your competitions.
            </p>

            {/* Status Message */}
            {message.content && (
              <div className={`alert alert-${message.type === 'error' ? 'error' : 'success'}`}>
                {message.content}
              </div>
            )}

            <form onSubmit={handleSubmit} className="form">
              <div className="form-group">
                <label className="form-label">Organization Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="e.g., The Red Lion Pub, Acme Corp, Manchester United FC"
                  className="form-input"
                  autoFocus
                  required
                />
                <small style={{ color: '#666' }}>
                  This is the public name that players will see
                </small>
              </div>

              <div className="form-group">
                <label className="form-label">URL Slug *</label>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ color: '#666', marginRight: '8px' }}>lmslocal.com/</span>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => handleInputChange('slug', e.target.value)}
                    placeholder="red-lion-pub"
                    className="form-input"
                    style={{ flex: 1 }}
                    pattern="[a-z0-9-]+"
                    required
                  />
                </div>
                <small style={{ color: '#666' }}>
                  This creates your custom URL that players will use to join. Only lowercase letters, numbers, and hyphens allowed.
                </small>
              </div>

              <div className="form-group">
                <label className="form-label">Description (Optional)</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Brief description of your organization or venue"
                  className="form-input"
                  rows="3"
                />
              </div>

              <div style={{ marginTop: '30px' }}>
                <button 
                  type="submit"
                  disabled={loading || !formData.name.trim() || !formData.slug.trim()}
                  className="btn btn-primary"
                  style={{ marginRight: '10px' }}
                >
                  {loading ? (
                    <>
                      <div className="loading" style={{ marginRight: '8px' }}></div>
                      Creating Organization...
                    </>
                  ) : (
                    '🏢 Create Organization'
                  )}
                </button>
                
                <Link href="/onboarding" className="btn btn-secondary">
                  ← Back to Choice
                </Link>
              </div>
            </form>

            {/* Preview */}
            {formData.name && formData.slug && (
              <div style={{ 
                marginTop: '30px', 
                padding: '20px', 
                backgroundColor: '#f8f9fa', 
                borderRadius: '4px',
                border: '1px solid #e9ecef'
              }}>
                <h4>Preview</h4>
                <p><strong>Organization:</strong> {formData.name}</p>
                <p><strong>Player URL:</strong> lmslocal.com/{formData.slug}</p>
                {formData.description && <p><strong>Description:</strong> {formData.description}</p>}
              </div>
            )}

            {/* What's Next */}
            <div style={{ 
              marginTop: '30px',
              padding: '20px',
              backgroundColor: '#e7f3ff',
              borderRadius: '4px',
              border: '1px solid #b3d9ff'
            }}>
              <h4>🚀 What's Next?</h4>
              <ul style={{ marginLeft: '20px', color: '#666' }}>
                <li>Create your first Last Man Standing competition</li>
                <li>Share your invite code with players</li>
                <li>Set up rounds and manage results</li>
                <li>Free for up to 5 players!</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}