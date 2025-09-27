/*
=======================================================================================================================================
API Route: get-marketing-posts
=======================================================================================================================================
Method: POST
Purpose: Retrieve all marketing posts for a specific competition (organizer view with management capabilities)
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123                    // integer, required
}

Success Response:
{
  "return_code": "SUCCESS",
  "posts": [
    {
      "id": 1,                             // integer, post ID
      "competition_id": 123,               // integer, competition ID
      "title": "Derby Screening",          // string, post title
      "description": "Man City vs...",     // string, optional description
      "image_url": "https://...",          // string, optional image URL
      "is_active": true,                   // boolean, active status
      "display_priority": 1,               // integer, display order
      "view_count": 47,                    // integer, total views
      "created_at": "2025-01-22T10:00:00Z", // ISO string, creation time
      "updated_at": "2025-01-22T10:00:00Z"  // ISO string, last update
    }
  ],
  "active_post_count": 3,                  // integer, currently active posts
  "max_posts_allowed": 4                   // integer, subscription limit
}

Error Response:
{
  "return_code": "VALIDATION_ERROR",
  "message": "Competition ID is required"
}

{
  "return_code": "UNAUTHORIZED",
  "message": "You do not have permission to view posts for this competition"
}

{
  "return_code": "NOT_FOUND",
  "message": "Competition not found"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"UNAUTHORIZED"
"NOT_FOUND"
"SERVER_ERROR"
=======================================================================================================================================
*/

const { query, transaction } = require('../database');
const { verifyToken } = require('../middleware/auth_middleware');
const apiLogger = require('../utils/apiLogger');

const getMarketingPosts = async (req, res) => {
  // Start API logging
  apiLogger.logRequest(req, 'get-marketing-posts');

  try {
    // Extract and validate JWT token
    const authResult = verifyToken(req);
    if (!authResult.success) {
      apiLogger.logResponse(req, 'get-marketing-posts', 'UNAUTHORIZED', authResult.message);
      return res.status(200).json({
        return_code: 'UNAUTHORIZED',
        message: authResult.message
      });
    }

    const { user_id } = authResult.decoded;
    const { competition_id } = req.body;

    // Validate required fields
    if (!competition_id || typeof competition_id !== 'number') {
      apiLogger.logResponse(req, 'get-marketing-posts', 'VALIDATION_ERROR', 'Competition ID is required and must be a number');
      return res.status(200).json({
        return_code: 'VALIDATION_ERROR',
        message: 'Competition ID is required and must be a number'
      });
    }

    // Use transaction wrapper for atomic queries
    const result = await transaction(async (client) => {

      // First, verify the user is the organizer of this competition
      const competitionCheck = await client.query(
        'SELECT organiser_id FROM competition WHERE id = $1',
        [competition_id]
      );

      // Check if competition exists
      if (competitionCheck.rows.length === 0) {
        throw {
          return_code: 'NOT_FOUND',
          message: 'Competition not found'
        };
      }

      // Check if user is the organizer
      const organiser_id = competitionCheck.rows[0].organiser_id;
      if (organiser_id !== user_id) {
        throw {
          return_code: 'UNAUTHORIZED',
          message: 'You do not have permission to view posts for this competition'
        };
      }

      // Get all marketing posts for this competition (including inactive)
      // Order by display_priority ASC, then by created_at DESC for newest first within same priority
      const postsQuery = await client.query(`
        SELECT
          id,
          competition_id,
          created_by_user_id,
          title,
          description,
          image_url,
          is_active,
          display_priority,
          view_count,
          created_at,
          updated_at
        FROM marketing_posts
        WHERE competition_id = $1
        ORDER BY display_priority ASC, created_at DESC
      `, [competition_id]);

      // Count active posts for limit checking
      const activePostsQuery = await client.query(`
        SELECT COUNT(*) as active_count
        FROM marketing_posts
        WHERE competition_id = $1 AND is_active = true
      `, [competition_id]);

      const active_post_count = parseInt(activePostsQuery.rows[0].active_count);
      const max_posts_allowed = 4; // Current limit for all users during beta

      return {
        posts: postsQuery.rows,
        active_post_count,
        max_posts_allowed
      };
    });

    // Log successful response
    apiLogger.logResponse(req, 'get-marketing-posts', 'SUCCESS', `Retrieved ${result.posts.length} posts for competition ${competition_id}`);

    // Return success response
    return res.status(200).json({
      return_code: 'SUCCESS',
      posts: result.posts,
      active_post_count: result.active_post_count,
      max_posts_allowed: result.max_posts_allowed
    });

  } catch (error) {
    console.error('Error in get-marketing-posts:', error);

    // Handle custom thrown errors with specific return codes
    if (error.return_code) {
      apiLogger.logResponse(req, 'get-marketing-posts', error.return_code, error.message);
      return res.status(200).json({
        return_code: error.return_code,
        message: error.message
      });
    }

    // Handle unexpected server errors
    apiLogger.logResponse(req, 'get-marketing-posts', 'SERVER_ERROR', 'Internal server error occurred');
    return res.status(200).json({
      return_code: 'SERVER_ERROR',
      message: 'An internal server error occurred'
    });
  }
};

module.exports = getMarketingPosts;