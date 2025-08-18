// Authentication flow test script
// Run this after starting the server with: node test_auth.js

const BASE_URL = 'http://localhost:3015/api';

async function testEndpoint(endpoint, payload, description, headers = {}) {
    try {
        console.log(`\n🧪 Testing: ${description}`);
        console.log(`📍 POST ${endpoint}`);
        console.log(`📤 Payload:`, JSON.stringify(payload, null, 2));
        
        const response = await fetch(`${BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...headers
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log(`📥 Response (${response.status}):`, JSON.stringify(data, null, 2));
        
        if (data.return_code === 'SUCCESS') {
            console.log('✅ Test PASSED');
            return data;
        } else {
            console.log('❌ Test FAILED');
            return null;
        }
        
    } catch (error) {
        console.log('❌ Test ERROR:', error.message);
        return null;
    }
}

async function runAuthTests() {
    console.log('🔐 Starting Authentication Tests...');
    console.log('Make sure server is running on port 3015');
    
    // Test 1: Health check
    await testEndpoint('/health', {}, 'Health Check');
    
    // Test 2: Request login (this will send an email)
    console.log('\n📧 IMPORTANT: The next test will send a real email via Resend!');
    const email = 'test@example.com'; // Change this to your test email
    
    const loginResult = await testEndpoint('/auth/request-login', {
        email: email
    }, `Send Magic Link to ${email}`);
    
    if (loginResult) {
        console.log('✅ Magic link email should be sent!');
        console.log('📧 Check your email and click the magic link to get JWT token');
        console.log('🔗 Or manually visit: http://localhost:3015/api/auth/verify-token?token=YOUR_TOKEN');
        
        // Simulate what happens when user clicks the magic link
        console.log('\n⏳ Waiting 5 seconds (simulate user checking email)...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Note: In real testing, you'd extract the token from the email
        // For now, we'll demonstrate the other endpoints
        
        // Test 3: Validate a fake JWT (will fail)
        console.log('\n🧪 Testing JWT validation with fake token...');
        await testEndpoint('/auth/validate-jwt', {
            jwt: 'fake.jwt.token'
        }, 'Validate Fake JWT (should fail)');
        
        // Test 4: Try protected route without auth (should fail)
        console.log('\n🧪 Testing protected route without authentication...');
        await testEndpoint('/protected/profile', {}, 'Access Protected Route (no auth - should fail)');
        
        // Test 5: Try protected route with fake JWT (should fail)
        console.log('\n🧪 Testing protected route with fake JWT...');
        await testEndpoint('/protected/profile', {}, 'Access Protected Route (fake JWT - should fail)', {
            'Authorization': 'Bearer fake.jwt.token'
        });
    }
    
    console.log('\n🏁 Authentication tests completed!');
    console.log('\n📋 Manual Testing Steps:');
    console.log('1. Check your email for the magic link');
    console.log('2. Click the magic link to get JWT token');
    console.log('3. Copy the JWT token');
    console.log('4. Test protected route with:');
    console.log('   curl -X POST http://localhost:3015/api/protected/profile \\');
    console.log('        -H "Authorization: Bearer YOUR_JWT_TOKEN" \\');
    console.log('        -H "Content-Type: application/json" \\');
    console.log('        -d "{}"');
}

// Helper function to test with actual JWT
async function testWithJWT(jwtToken) {
    console.log('\n🔑 Testing with actual JWT token...');
    
    // Test validate JWT
    const validateResult = await testEndpoint('/auth/validate-jwt', {
        jwt: jwtToken
    }, 'Validate Real JWT Token');
    
    if (validateResult) {
        // Test protected route
        await testEndpoint('/protected/profile', {}, 'Access Protected Route (with valid JWT)', {
            'Authorization': `Bearer ${jwtToken}`
        });
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    runAuthTests();
}

module.exports = { testEndpoint, runAuthTests, testWithJWT };