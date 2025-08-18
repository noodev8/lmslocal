/*
=======================================================================================================================================
API Route: /health
=======================================================================================================================================
Method: POST
Purpose: Health check endpoint to verify server and database connectivity
=======================================================================================================================================
Request Payload:
{
  // No payload required
}

Success Response:
{
  "return_code": "SUCCESS",
  "server_status": "running",        // string, server operational status
  "database_status": "connected",    // string, database connection status
  "timestamp": "2024-01-01T12:00:00Z" // string, current server time
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"DATABASE_ERROR"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { pool } = require('../config/database');
const router = express.Router();

router.post('/health', async (req, res) => {
    try {
        console.log('📊 Health check requested');
        
        // Test database connection
        let databaseStatus = 'disconnected';
        try {
            const client = await pool.connect();
            await client.query('SELECT 1');
            client.release();
            databaseStatus = 'connected';
            console.log('✅ Database health check passed');
        } catch (dbError) {
            console.error('❌ Database health check failed:', dbError.message);
            return res.status(500).json({
                return_code: 'DATABASE_ERROR',
                server_status: 'running',
                database_status: 'disconnected',
                timestamp: new Date().toISOString(),
                error: dbError.message
            });
        }

        // Return success response
        const response = {
            return_code: 'SUCCESS',
            server_status: 'running',
            database_status: databaseStatus,
            timestamp: new Date().toISOString()
        };

        console.log('✅ Health check completed successfully');
        res.json(response);

    } catch (error) {
        console.error('❌ Health check server error:', error.message);
        res.status(500).json({
            return_code: 'SERVER_ERROR',
            server_status: 'error',
            database_status: 'unknown',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

module.exports = router;