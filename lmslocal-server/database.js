/*
=======================================================================================================================================
Database Connection Module
=======================================================================================================================================
Purpose: PostgreSQL database connection and query utilities
Database: PostgreSQL with connection pooling
=======================================================================================================================================
*/

const { Pool } = require('pg');

// Database configuration from environment variables
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20, // Maximum number of connections in pool
  idleTimeoutMillis: 30000, // How long to keep idle connections
  connectionTimeoutMillis: 2000, // How long to wait for connection
});

// Test database connection
async function testConnection() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, version() as db_version');
    client.release();
    
    console.log('Database connected successfully:');
    console.log(`- Time: ${result.rows[0].current_time}`);
    console.log(`- Version: ${result.rows[0].db_version.substring(0, 50)}...`);
    
    return { 
      success: true, 
      timestamp: result.rows[0].current_time,
      version: result.rows[0].db_version 
    };
  } catch (error) {
    console.error('Database connection failed:', error.message);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

// Execute query with error handling
async function query(text, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } catch (error) {
    console.error('Database query error:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

// Execute transaction with callback function
async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Execute transaction (legacy array format - kept for backward compatibility)
async function transactionQueries(queries) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const results = [];
    
    for (const { text, params } of queries) {
      const result = await client.query(text, params);
      results.push(result);
    }
    
    await client.query('COMMIT');
    return results;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Get pool status
function getPoolStatus() {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount
  };
}


// Graceful shutdown
async function closePool() {
  await pool.end();
  console.log('Database pool closed');
}

// Connection test is now handled by server.js startup

module.exports = {
  query,
  transaction,
  transactionQueries,
  testConnection,
  getPoolStatus,
  closePool,
  pool
};