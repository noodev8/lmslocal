/*
=======================================================================================================================================
Get Calculated Fixtures Route - Check which fixtures have calculated picks
=======================================================================================================================================
*/

const express = require('express');
const jwt = require('jsonwebtoken');
const { query } = require('../database');
const router = express.Router();

// Middleware to verify JWT token
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        return_code: "UNAUTHORIZED",
        message: "No token provided"
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const result = await query('SELECT id, email, display_name, email_verified FROM app_user WHERE id = $1', [decoded.user_id || decoded.userId]);
    if (result.rows.length === 0) {
      return res.status(401).json({
        return_code: "UNAUTHORIZED",
        message: "Invalid token"
      });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    return res.status(401).json({
      return_code: "UNAUTHORIZED",
      message: "Invalid token"
    });
  }
};

router.post('/', verifyToken, async (req, res) => {
  try {
    const { round_id } = req.body;

    if (!round_id || !Number.isInteger(round_id)) {
      return res.status(400).json({
        return_code: "VALIDATION_ERROR",
        message: "Round ID is required and must be a number"
      });
    }

    // Get fixtures that have been processed (have processed timestamp)
    const calculatedFixtures = await query(`
      SELECT f.id
      FROM fixture f
      WHERE f.round_id = $1 AND f.processed IS NOT NULL
    `, [round_id]);

    const calculatedFixtureIds = calculatedFixtures.rows.map(row => row.id);

    res.json({
      return_code: "SUCCESS",
      calculated_fixture_ids: calculatedFixtureIds
    });

  } catch (error) {
    console.error('Get calculated fixtures error:', error);
    res.status(500).json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;