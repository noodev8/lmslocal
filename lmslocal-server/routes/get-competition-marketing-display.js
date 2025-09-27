/*
=======================================================================================================================================
API Route: get-competition-marketing-display
=======================================================================================================================================
Method: POST
Purpose: Get active marketing posts for display on player competition dashboard (increments view count automatically)
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123                    // integer, required
}

Success Response:
{
  "return_code": "SUCCESS",
  "has_marketing_content": true,           // boolean, indicates if any posts exist
  "venue_name": "The Crown & Anchor",      // string, venue/organizer name for display
  "posts": [
    {
      "id": 1,                             // integer, post ID
      "title": "Derby Screening",          // string, post title
      "description": "Man City vs...",     // string, optional description
      "image_url": "https://...",          // string, optional image URL
      "display_priority": 1                // integer, display order
    }
  ]
}

Success Response - No Marketing Content:
{
  "return_code": "SUCCESS",
  "has_marketing_content": false,
  "posts": []
}

Error Response:
{
  "return_code": "NOT_FOUND",
  "message": "Competition not found"
}

{
  "return_code": "VALIDATION_ERROR",
  "message": "Competition ID is required and must be a number"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"NOT_FOUND"
"SERVER_ERROR"
=======================================================================================================================================
*/

const { query, transaction } = require('../database');
const apiLogger = require('../utils/apiLogger');

const getCompetitionMarketingDisplay = async (req, res) => {
  // Start API logging
  apiLogger.logRequest(req, 'get-competition-marketing-display');

  try {
    const { competition_id } = req.body;

    // Validate required fields
    if (!competition_id || typeof competition_id !== 'number') {
      apiLogger.logResponse(req, 'get-competition-marketing-display', 'VALIDATION_ERROR', 'Competition ID is required and must be a number');
      return res.status(200).json({
        return_code: 'VALIDATION_ERROR',
        message: 'Competition ID is required and must be a number'
      });
    }

    // Use transaction wrapper for atomic operations
    const result = await transaction(async (client) => {

      // First, verify the competition exists and get organizer info
      const competitionQuery = await client.query(`
        SELECT c.id, c.name as competition_name, u.display_name as organizer_name
        FROM competition c
        JOIN app_user u ON c.organiser_id = u.id
        WHERE c.id = $1
      `, [competition_id]);

      // Check if competition exists
      if (competitionQuery.rows.length === 0) {
        throw {
          return_code: 'NOT_FOUND',
          message: 'Competition not found'
        };
      }

      const competition = competitionQuery.rows[0];

      // Get all active marketing posts for this competition
      // Order by display_priority ASC (lowest numbers first), then by created_at DESC for newest first within same priority
      const postsQuery = await client.query(`
        SELECT
          id,
          title,
          description,
          image_url,
          display_priority
        FROM marketing_posts
        WHERE competition_id = $1
          AND is_active = true
        ORDER BY display_priority ASC, created_at DESC
        LIMIT 4
      `, [competition_id]);

      const posts = postsQuery.rows;
      const has_marketing_content = posts.length > 0;

      // If there are posts to display, increment view counts for all of them
      // This tracks that the marketing content was shown to a player
      if (has_marketing_content) {
        const postIds = posts.map(post => post.id);

        // Batch update all view counts in a single query for efficiency
        await client.query(`
          UPDATE marketing_posts
          SET view_count = view_count + 1
          WHERE id = ANY($1)
        `, [postIds]);
      }

      return {
        has_marketing_content,
        venue_name: competition.organizer_name, // Use organizer display name as venue name
        posts
      };
    });

    // Log successful response
    const postCount = result.posts.length;
    apiLogger.logResponse(req, 'get-competition-marketing-display', 'SUCCESS', `Retrieved ${postCount} active marketing posts for competition ${competition_id}`);

    // Return success response
    return res.status(200).json({
      return_code: 'SUCCESS',
      has_marketing_content: result.has_marketing_content,
      venue_name: result.venue_name,
      posts: result.posts
    });

  } catch (error) {
    console.error('Error in get-competition-marketing-display:', error);

    // Handle custom thrown errors with specific return codes
    if (error.return_code) {
      apiLogger.logResponse(req, 'get-competition-marketing-display', error.return_code, error.message);
      return res.status(200).json({
        return_code: error.return_code,
        message: error.message
      });
    }

    // Handle unexpected server errors
    apiLogger.logResponse(req, 'get-competition-marketing-display', 'SERVER_ERROR', 'Internal server error occurred');
    return res.status(200).json({
      return_code: 'SERVER_ERROR',
      message: 'An internal server error occurred'
    });
  }
};

module.exports = getCompetitionMarketingDisplay;