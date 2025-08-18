// Simple test script for API endpoints
// Run this after starting the server with: node test_endpoints.js

const BASE_URL = 'http://localhost:3015/api';

async function testEndpoint(endpoint, payload, description) {
    try {
        console.log(`\n🧪 Testing: ${description}`);
        console.log(`📍 POST ${endpoint}`);
        console.log(`📤 Payload:`, JSON.stringify(payload, null, 2));
        
        const response = await fetch(`${BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
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

async function runTests() {
    console.log('🚀 Starting API endpoint tests...');
    console.log('Make sure server is running on port 3015');
    
    // Test 1: Health check
    await testEndpoint('/health', {}, 'Health Check');
    
    // Test 2: Create organisation
    const orgResult = await testEndpoint('/organisation/create', {
        name: 'Test Pub Ltd',
        owner_email: 'owner@testpub.com',
        owner_name: 'Test Owner'
    }, 'Create Organisation');
    
    if (orgResult) {
        // Test 3: Get organisation by ID
        await testEndpoint('/organisation/get', {
            organisation_id: orgResult.organisation_id
        }, 'Get Organisation by ID');
        
        // Test 4: Get organisation by slug
        await testEndpoint('/organisation/get', {
            slug: orgResult.slug
        }, 'Get Organisation by Slug');
    }
    
    // Test 5: Create user
    const userResult = await testEndpoint('/user/create', {
        email: 'testuser@example.com',
        display_name: 'Test User',
        is_managed: false
    }, 'Create User');
    
    if (userResult) {
        // Test 6: Get user by ID
        await testEndpoint('/user/get', {
            user_id: userResult.user_id
        }, 'Get User by ID');
        
        // Test 7: Get user by email
        await testEndpoint('/user/get', {
            email: 'testuser@example.com'
        }, 'Get User by Email');
    }
    
    // Test 8: Create managed user
    await testEndpoint('/user/create', {
        display_name: 'Managed Player',
        is_managed: true,
        created_by_user_id: userResult?.user_id || null
    }, 'Create Managed User');
    
    if (orgResult) {
        // Test 9: Create competition
        const compResult = await testEndpoint('/competition/create', {
            organisation_id: orgResult.organisation_id,
            team_list_id: 1, // Assuming EPL team list exists
            name: 'Test Competition',
            description: 'Test competition for API testing',
            lives_per_player: 2,
            no_team_twice: true,
            lock_hours_before_kickoff: 2
        }, 'Create Competition');
        
        if (compResult) {
            // Test 10: Get competition
            await testEndpoint('/competition/get', {
                competition_id: compResult.competition_id
            }, 'Get Competition');
        }
    }
    
    console.log('\n🏁 All tests completed!');
    console.log('Note: Some tests may fail if database lacks seed data (team_list)');
}

// Run tests if this file is executed directly
if (require.main === module) {
    runTests();
}

module.exports = { testEndpoint, runTests };