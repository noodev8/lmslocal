/*
=======================================================================================================================================
Validate Access Code Route - Check if access code is valid for competition
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../database');
const router = express.Router();


/*
=======================================================================================================================================
API Route: /validate-access-code
=======================================================================================================================================
Method: POST
Purpose: Validate access code for a competition
=======================================================================================================================================
Request Payload:
{
  "slug": "10001",
  "access_code": "ABC123"
}

Success Response:
{
  "return_code": "SUCCESS",
  "message": "Access code valid",
  "competition": {
    "id": 22,
    "name": "Premier League",
    "slug": "10001",
    "status": "LOCKED"
  }
}
=======================================================================================================================================
*/
router.post('/', async (req, res) => {
  try {
    const { slug, access_code } = req.body;

    // Basic validation
    if (!slug || typeof slug !== 'string') {
      return res.status(400).json({
        return_code: "VALIDATION_ERROR",
        message: "Slug is required"
      });
    }

    if (!access_code || typeof access_code !== 'string') {
      return res.status(400).json({
        return_code: "VALIDATION_ERROR", 
        message: "Access code is required"
      });
    }

    // Get competition and validate access code
    const competitionResult = await query(`
      SELECT id, name, slug, status, invite_code
      FROM competition
      WHERE slug = $1
    `, [slug]);

    if (competitionResult.rows.length === 0) {
      return res.status(404).json({
        return_code: "COMPETITION_NOT_FOUND",
        message: "Competition not found"
      });
    }

    const competition = competitionResult.rows[0];

    // Validate access code
    if (competition.invite_code !== access_code.trim()) {
      return res.status(400).json({
        return_code: "INVALID_ACCESS_CODE",
        message: "Invalid access code"
      });
    }

    res.json({
      return_code: "SUCCESS",
      message: "Access code valid",
      competition: {
        id: competition.id,
        name: competition.name,
        slug: competition.slug,
        status: competition.status
      }
    });

  } catch (error) {
    console.error('Validate access code error:', error);
    res.status(500).json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;