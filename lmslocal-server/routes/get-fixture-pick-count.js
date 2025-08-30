/*
=======================================================================================================================================
API Route: get-fixture-pick-count
=======================================================================================================================================
Method: POST
Purpose: Get the count of players who picked each team for a specific round
=======================================================================================================================================
Request Payload:
{
  "round_id": 123                          // number, required - The round ID to get pick counts for
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "pick_counts": {                         // object, pick counts by team short name
    "ARS": 12,                            // number, count of players who picked this team
    "LIV": 8,                             // number, count of players who picked this team  
    "MCI": 15                             // etc...
  }
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"NOT_FOUND"
"SERVER_ERROR"
=======================================================================================================================================
*/

const { Pool } = require('pg');

// Database configuration
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

module.exports = (req, res) => {
  const getFixturePickCount = async () => {
    try {
      const { round_id } = req.body;

      // Validation
      if (!round_id || typeof round_id !== 'number') {
        return res.status(200).json({
          return_code: "VALIDATION_ERROR",
          message: "round_id is required and must be a number"
        });
      }

      // Verify round exists
      const roundCheck = await pool.query(
        'SELECT id FROM round WHERE id = $1',
        [round_id]
      );

      if (roundCheck.rows.length === 0) {
        return res.status(200).json({
          return_code: "NOT_FOUND",
          message: "Round not found"
        });
      }

      // Get pick counts for each team in this round
      // Join picks with fixtures to get team info and count picks per team
      const pickCountQuery = `
        SELECT 
          CASE 
            WHEN p.team = 'home' THEN f.home_team_short
            WHEN p.team = 'away' THEN f.away_team_short
            ELSE p.team
          END as team_short,
          COUNT(*) as pick_count
        FROM pick p
        JOIN fixture f ON p.fixture_id = f.id
        WHERE f.round_id = $1
        GROUP BY 
          CASE 
            WHEN p.team = 'home' THEN f.home_team_short
            WHEN p.team = 'away' THEN f.away_team_short
            ELSE p.team
          END
        ORDER BY pick_count DESC
      `;

      const pickCountResult = await pool.query(pickCountQuery, [round_id]);

      // Convert to object format { team_short: count }
      const pick_counts = {};
      pickCountResult.rows.forEach(row => {
        pick_counts[row.team_short] = parseInt(row.pick_count);
      });

      return res.status(200).json({
        return_code: "SUCCESS",
        pick_counts: pick_counts
      });

    } catch (error) {
      console.error('Error in get-fixture-pick-count:', error);
      return res.status(200).json({
        return_code: "SERVER_ERROR",
        message: "Internal server error"
      });
    }
  };

  getFixturePickCount();
};