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

// Execute transaction
async function transaction(queries) {
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
    console.error('Transaction error:', error.message);
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

// Populate allowed teams for a user in a competition
async function populateAllowedTeams(competition_id, user_id) {
  try {
    // Input validation
    if (!competition_id || !Number.isInteger(competition_id)) {
      throw new Error('Invalid competition_id - must be a valid integer');
    }
    if (!user_id || !Number.isInteger(user_id)) {
      throw new Error('Invalid user_id - must be a valid integer');
    }

    // Check if user is already in this competition
    const memberCheck = await query(`
      SELECT id FROM competition_user 
      WHERE competition_id = $1 AND user_id = $2
    `, [competition_id, user_id]);

    if (memberCheck.rows.length === 0) {
      throw new Error(`User ${user_id} is not a member of competition ${competition_id}`);
    }

    // Check if teams are already populated (avoid unnecessary work)
    const existingCheck = await query(`
      SELECT COUNT(*) as count FROM allowed_teams 
      WHERE competition_id = $1 AND user_id = $2
    `, [competition_id, user_id]);

    if (parseInt(existingCheck.rows[0].count) > 0) {
      console.log(`User ${user_id} already has ${existingCheck.rows[0].count} allowed teams in competition ${competition_id}`);
      return { rows: [] }; // Return empty result to indicate no new teams added
    }

    // Give player all teams from the competition's team list
    const result = await query(`
      INSERT INTO allowed_teams (competition_id, user_id, team_id)
      SELECT $1, $2, t.id
      FROM team t
      JOIN competition c ON t.team_list_id = c.team_list_id
      WHERE c.id = $1 AND t.is_active = true
      ON CONFLICT (competition_id, user_id, team_id) DO NOTHING
      RETURNING team_id
    `, [competition_id, user_id]);
    
    if (result.rows.length > 0) {
      console.log(`✅ Populated ${result.rows.length} allowed teams for user ${user_id} in competition ${competition_id}`);
    } else {
      console.log(`⚠️ No teams found to populate for user ${user_id} in competition ${competition_id} - check if competition has fixtures`);
    }
    
    return result;
  } catch (error) {
    console.error(`❌ Error populating allowed teams for user ${user_id} in competition ${competition_id}:`, error.message);
    throw error;
  }
}

// Graceful shutdown
async function closePool() {
  await pool.end();
  console.log('Database pool closed');
}

// Initialize connection test on startup
testConnection();

module.exports = {
  query,
  transaction,
  testConnection,
  getPoolStatus,
  closePool,
  populateAllowedTeams,
  pool
};