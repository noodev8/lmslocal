/*
=======================================================================================================================================
API Route: create-marketing-post
=======================================================================================================================================
Method: POST
Purpose: Create a new marketing post for a competition with title, description and optional image
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123,                   // integer, required
  "title": "Derby Screening",              // string, required, max 50 chars
  "description": "Man City vs Man United", // string, optional, max 200 chars
  "image_url": "https://...",              // string, optional
  "display_priority": 1                    // integer, optional, default 1
}

Success Response:
{
  "return_code": "SUCCESS",
  "post_id": 456,                          // integer, newly created post ID
  "message": "Marketing post created successfully"
}

Error Response:
{
  "return_code": "VALIDATION_ERROR",
  "message": "Title is required and must be 50 characters or less"
}

{
  "return_code": "POST_LIMIT_EXCEEDED",
  "message": "Maximum of 4 active posts allowed. Please deactivate an existing post first."
}

{
  "return_code": "UNAUTHORIZED",
  "message": "You do not have permission to create posts for this competition"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"UNAUTHORIZED"
"POST_LIMIT_EXCEEDED"
"NOT_FOUND"
"SERVER_ERROR"
=======================================================================================================================================
*/

const { query, transaction } = require('../database');
const { verifyToken } = require('../middleware/auth_middleware');
const apiLogger = require('../utils/apiLogger');

const createMarketingPost = async (req, res) => {
  // Start API logging
  apiLogger.logRequest(req, 'create-marketing-post');

  try {
    // Extract and validate JWT token
    const authResult = verifyToken(req);
    if (!authResult.success) {
      apiLogger.logResponse(req, 'create-marketing-post', 'UNAUTHORIZED', authResult.message);
      return res.status(200).json({
        return_code: 'UNAUTHORIZED',
        message: authResult.message
      });
    }

    const { user_id } = authResult.decoded;
    const {
      competition_id,
      title,
      description,
      image_url,
      display_priority = 1
    } = req.body;

    // Validate required fields
    if (!competition_id || typeof competition_id !== 'number') {
      apiLogger.logResponse(req, 'create-marketing-post', 'VALIDATION_ERROR', 'Competition ID is required and must be a number');
      return res.status(200).json({
        return_code: 'VALIDATION_ERROR',
        message: 'Competition ID is required and must be a number'
      });
    }

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      apiLogger.logResponse(req, 'create-marketing-post', 'VALIDATION_ERROR', 'Title is required');
      return res.status(200).json({
        return_code: 'VALIDATION_ERROR',
        message: 'Title is required'
      });
    }

    // Validate title length (max 50 characters)
    if (title.length > 50) {
      apiLogger.logResponse(req, 'create-marketing-post', 'VALIDATION_ERROR', 'Title must be 50 characters or less');
      return res.status(200).json({
        return_code: 'VALIDATION_ERROR',
        message: 'Title must be 50 characters or less'
      });
    }

    // Validate description length if provided (max 200 characters)
    if (description && description.length > 200) {
      apiLogger.logResponse(req, 'create-marketing-post', 'VALIDATION_ERROR', 'Description must be 200 characters or less');
      return res.status(200).json({
        return_code: 'VALIDATION_ERROR',
        message: 'Description must be 200 characters or less'
      });
    }

    // Validate display_priority is a positive integer
    if (display_priority && (!Number.isInteger(display_priority) || display_priority < 1)) {
      apiLogger.logResponse(req, 'create-marketing-post', 'VALIDATION_ERROR', 'Display priority must be a positive integer');
      return res.status(200).json({
        return_code: 'VALIDATION_ERROR',
        message: 'Display priority must be a positive integer'
      });
    }

    // Use transaction wrapper for atomic operations
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
          message: 'You do not have permission to create posts for this competition'
        };
      }

      // Check current active post count (4 post limit during beta)
      const activePostsQuery = await client.query(`
        SELECT COUNT(*) as active_count
        FROM marketing_posts
        WHERE competition_id = $1 AND is_active = true
      `, [competition_id]);

      const active_post_count = parseInt(activePostsQuery.rows[0].active_count);
      const max_posts_allowed = 4; // Current limit for all users during beta

      if (active_post_count >= max_posts_allowed) {
        throw {
          return_code: 'POST_LIMIT_EXCEEDED',
          message: `Maximum of ${max_posts_allowed} active posts allowed. Please deactivate an existing post first.`
        };
      }

      // Create the new marketing post
      // Set created_at and updated_at to CURRENT_TIMESTAMP (handled by database defaults)
      const insertQuery = await client.query(`
        INSERT INTO marketing_posts (
          competition_id,
          created_by_user_id,
          title,
          description,
          image_url,
          display_priority
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [
        competition_id,
        user_id,
        title.trim(),
        description ? description.trim() : null,
        image_url || null,
        display_priority
      ]);

      const post_id = insertQuery.rows[0].id;

      return { post_id };
    });

    // Log successful response
    apiLogger.logResponse(req, 'create-marketing-post', 'SUCCESS', `Created marketing post ${result.post_id} for competition ${competition_id}`);

    // Return success response
    return res.status(200).json({
      return_code: 'SUCCESS',
      post_id: result.post_id,
      message: 'Marketing post created successfully'
    });

  } catch (error) {
    console.error('Error in create-marketing-post:', error);

    // Handle custom thrown errors with specific return codes
    if (error.return_code) {
      apiLogger.logResponse(req, 'create-marketing-post', error.return_code, error.message);
      return res.status(200).json({
        return_code: error.return_code,
        message: error.message
      });
    }

    // Handle unexpected server errors
    apiLogger.logResponse(req, 'create-marketing-post', 'SERVER_ERROR', 'Internal server error occurred');
    return res.status(200).json({
      return_code: 'SERVER_ERROR',
      message: 'An internal server error occurred'
    });
  }
};

module.exports = createMarketingPost;