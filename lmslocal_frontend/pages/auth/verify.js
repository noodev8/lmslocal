import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { auth, token } from '../../lib/api';

export default function AuthVerify() {
  const router = useRouter();
  const [status, setStatus] = useState('verifying'); // 'verifying', 'success', 'error'
  const [message, setMessage] = useState('');
  const [userInfo, setUserInfo] = useState(null);
  const [jwtToken, setJwtToken] = useState('');

  useEffect(() => {
    // Get token from URL query parameter
    const { token: authToken } = router.query;

    if (authToken) {
      verifyAuthToken(authToken);
    } else if (router.isReady) {
      // Router is ready but no token found
      setStatus('error');
      setMessage('No authentication token found in the URL');
    }
  }, [router.query, router.isReady]);

  const verifyAuthToken = async (authToken) => {
    try {
      console.log('🔍 Verifying auth token...');
      setStatus('verifying');
      
      const result = await auth.verifyToken(authToken);

      if (result.success) {
        // Success - store JWT and update state
        const { jwt, user_id, display_name, email, expires_in } = result.data;
        
        // Store JWT in localStorage
        token.store(jwt);
        
        setStatus('success');
        setMessage('Login successful! You are now authenticated.');
        setUserInfo({ user_id, display_name, email });
        setJwtToken(jwt);
        
        console.log('✅ Authentication successful');
        
        // Redirect to dashboard after 3 seconds
        setTimeout(() => {
          router.push('/dashboard');
        }, 3000);
        
      } else {
        setStatus('error');
        setMessage(result.data.message || 'Authentication failed');
        console.log('❌ Authentication failed:', result.data);
      }

    } catch (error) {
      setStatus('error');
      setMessage('Network error during authentication');
      console.error('❌ Verification error:', error);
    }
  };

  const handleCopyJWT = () => {
    if (navigator.clipboard && jwtToken) {
      navigator.clipboard.writeText(jwtToken);
      alert('JWT token copied to clipboard!');
    }
  };

  if (status === 'verifying') {
    return (
      <div className="page">
        <div className="header">
          <div className="container">
            <h1>🔍 Verifying Login</h1>
            <div className="subtitle">Please wait while we authenticate you...</div>
          </div>
        </div>

        <div className="content">
          <div className="container">
            <div className="card" style={{ textAlign: 'center' }}>
              <div className="loading" style={{ margin: '20px auto' }}></div>
              <p>Verifying your magic link...</p>
              <p style={{ fontSize: '14px', color: '#666', marginTop: '8px' }}>
                This should only take a moment.
              </p>
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
          <h1>{status === 'success' ? '✅ Login Successful' : '❌ Login Failed'}</h1>
          <div className="subtitle">
            {status === 'success' ? 'Welcome to Last Man Standing!' : 'Authentication Error'}
          </div>
        </div>
      </div>

      <div className="content">
        <div className="container">
          <div className="card">
            {status === 'success' ? (
              <div>
                <div className="alert alert-success">
                  🎉 {message}
                </div>

                {userInfo && (
                  <div style={{ marginBottom: '20px' }}>
                    <h3>Welcome back!</h3>
                    <p><strong>Name:</strong> {userInfo.display_name}</p>
                    <p><strong>Email:</strong> {userInfo.email}</p>
                    <p><strong>User ID:</strong> {userInfo.user_id}</p>
                  </div>
                )}

                <div className="alert alert-info">
                  Redirecting to dashboard in 3 seconds...
                </div>

                <div className="nav">
                  <Link href="/dashboard" className="btn btn-primary">
                    📊 Go to Dashboard Now
                  </Link>
                  <Link href="/" className="btn btn-secondary">
                    🏠 Home
                  </Link>
                </div>

                {/* Development: Show JWT token */}
                {jwtToken && (
                  <div style={{ marginTop: '24px', padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                    <h4 style={{ marginBottom: '8px' }}>🔑 Development: JWT Token</h4>
                    <textarea 
                      value={jwtToken} 
                      readOnly 
                      style={{ 
                        width: '100%', 
                        height: '80px', 
                        fontFamily: 'monospace', 
                        fontSize: '12px',
                        padding: '8px',
                        border: '1px solid #ddd',
                        borderRadius: '4px'
                      }}
                    />
                    <button 
                      onClick={handleCopyJWT}
                      className="btn btn-secondary"
                      style={{ marginTop: '8px', fontSize: '14px' }}
                    >
                      📋 Copy JWT
                    </button>
                    <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                      This token is automatically stored and will be used for authenticated API calls.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="alert alert-error">
                  {message}
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <h3>What went wrong?</h3>
                  <ul style={{ marginLeft: '20px', marginTop: '8px', color: '#666' }}>
                    <li>The magic link may have expired (links expire after 30 minutes)</li>
                    <li>The link may have been used already (one-time use only)</li>
                    <li>There may be a server connection issue</li>
                  </ul>
                </div>

                <div className="nav">
                  <Link href="/login" className="btn btn-primary">
                    🔐 Request New Login Link
                  </Link>
                  <Link href="/" className="btn btn-secondary">
                    🏠 Home
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Development Info */}
          <div className="card">
            <h3>🚧 Development Note</h3>
            <p style={{ color: '#666', fontSize: '14px' }}>
              This page handles magic link verification from email. The URL should contain 
              a <code>token</code> parameter that gets verified against the backend API 
              at <code>/api/auth/verify-token</code>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}