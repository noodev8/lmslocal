import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { auth, token } from '../lib/api';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', content: '' });

  useEffect(() => {
    // Redirect if already logged in
    if (token.isLoggedIn()) {
      router.push('/dashboard');
    }
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email) {
      setMessage({ type: 'error', content: 'Please enter your email address' });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setMessage({ type: 'error', content: 'Please enter a valid email address' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', content: '' });

    try {
      console.log('🔐 Requesting login for:', email);
      const result = await auth.requestLogin(email);

      if (result.success) {
        setMessage({ 
          type: 'success', 
          content: `Magic link sent to ${email}! Check your email and click the login link.` 
        });
        setEmail(''); // Clear form
      } else {
        setMessage({ 
          type: 'error', 
          content: result.data.message || 'Failed to send login email' 
        });
      }
    } catch (error) {
      setMessage({ 
        type: 'error', 
        content: 'Network error. Please check your connection and try again.' 
      });
    }

    setLoading(false);
  };

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    // Clear any existing messages when user starts typing
    if (message.content) {
      setMessage({ type: '', content: '' });
    }
  };

  return (
    <div className="page">
      <div className="header">
        <div className="container">
          <h1>🔐 Log In</h1>
          <div className="subtitle">Enter your email to receive a magic login link</div>
        </div>
      </div>

      <div className="content">
        <div className="container">
          <div className="card">
            <h2>Email Login</h2>
            <p style={{marginBottom: '20px', color: '#666'}}>
              We'll send you a secure login link via email. No passwords required!
            </p>

            {/* Status Message */}
            {message.content && (
              <div className={`alert alert-${message.type === 'error' ? 'error' : 'success'}`}>
                {message.content}
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="form">
              <div className="form-group">
                <label htmlFor="email" className="form-label">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={email}
                  onChange={handleEmailChange}
                  placeholder="your.email@example.com"
                  className="form-input"
                  disabled={loading}
                  autoComplete="email"
                  autoFocus
                />
              </div>

              <button 
                type="submit" 
                disabled={loading || !email}
                className="btn btn-primary"
              >
                {loading ? (
                  <>
                    <div className="loading" style={{marginRight: '8px'}}></div>
                    Sending Magic Link...
                  </>
                ) : (
                  '📧 Send Magic Link'
                )}
              </button>
            </form>

            {/* Instructions */}
            <div style={{marginTop: '24px', padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '4px'}}>
              <h4 style={{marginBottom: '8px', color: '#495057'}}>How it works:</h4>
              <ol style={{marginLeft: '20px', color: '#6c757d', fontSize: '14px'}}>
                <li>Enter your email address above</li>
                <li>Check your email for the magic login link</li>
                <li>Click the link to log in instantly</li>
                <li>The link expires in 30 minutes for security</li>
              </ol>
            </div>

            {/* Navigation */}
            <div className="nav" style={{marginTop: '20px'}}>
              <Link href="/" className="nav-link">
                ← Back to Home
              </Link>
            </div>
          </div>

          {/* Development Info */}
          <div className="card">
            <h3>🚧 Development Note</h3>
            <p style={{color: '#666', fontSize: '14px'}}>
              This login page connects to the real backend API. Emails are sent via Resend 
              to the address you provide. Make sure the backend server is running on 
              <code style={{backgroundColor: '#f8f9fa', padding: '2px 4px'}}>localhost:3015</code>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}