/*
=======================================================================================================================================
API Route: update-marketing-post
=======================================================================================================================================
Method: POST
Purpose: Update an existing marketing post with new title, description, image, active status or display priority
=======================================================================================================================================
Request Payload:
{
  "post_id": 456,                          // integer, required
  "title": "Derby Screening Updated",      // string, optional, max 50 chars
  "description": "Updated description",    // string, optional, max 200 chars
  "image_url": "https://...",              // string, optional
  "is_active": true,                       // boolean, optional
  "display_priority": 2                    // integer, optional
}

Success Response:
{
  "return_code": "SUCCESS",
  "message": "Marketing post updated successfully"
}

Error Response:
{
  "return_code": "NOT_FOUND",
  "message": "Marketing post not found"
}

{
  "return_code": "UNAUTHORIZED",
  "message": "You do not have permission to edit this post"
}

{
  "return_code": "VALIDATION_ERROR",
  "message": "Title must be 50 characters or less"
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

const updateMarketingPost = async (req, res) => {
  // Start API logging
  apiLogger.logRequest(req, 'update-marketing-post');

  try {
    // Extract and validate JWT token
    const authResult = verifyToken(req);
    if (!authResult.success) {
      apiLogger.logResponse(req, 'update-marketing-post', 'UNAUTHORIZED', authResult.message);
      return res.status(200).json({
        return_code: 'UNAUTHORIZED',
        message: authResult.message
      });
    }

    const { user_id } = authResult.decoded;
    const {
      post_id,
      title,
      description,
      image_url,
      is_active,
      display_priority
    } = req.body;

    // Validate required fields
    if (!post_id || typeof post_id !== 'number') {
      apiLogger.logResponse(req, 'update-marketing-post', 'VALIDATION_ERROR', 'Post ID is required and must be a number');
      return res.status(200).json({
        return_code: 'VALIDATION_ERROR',
        message: 'Post ID is required and must be a number'
      });
    }

    // Validate title length if provided (max 50 characters)
    if (title !== undefined && (typeof title !== 'string' || title.length > 50)) {
      apiLogger.logResponse(req, 'update-marketing-post', 'VALIDATION_ERROR', 'Title must be a string of 50 characters or less');
      return res.status(200).json({
        return_code: 'VALIDATION_ERROR',
        message: 'Title must be a string of 50 characters or less'
      });
    }

    // Validate description length if provided (max 200 characters)
    if (description !== undefined && (typeof description !== 'string' || description.length > 200)) {
      apiLogger.logResponse(req, 'update-marketing-post', 'VALIDATION_ERROR', 'Description must be a string of 200 characters or less');
      return res.status(200).json({
        return_code: 'VALIDATION_ERROR',
        message: 'Description must be a string of 200 characters or less'
      });
    }

    // Validate is_active if provided (must be boolean)
    if (is_active !== undefined && typeof is_active !== 'boolean') {
      apiLogger.logResponse(req, 'update-marketing-post', 'VALIDATION_ERROR', 'Active status must be a boolean value');
      return res.status(200).json({
        return_code: 'VALIDATION_ERROR',
        message: 'Active status must be a boolean value'
      });
    }

    // Validate display_priority if provided (must be positive integer)
    if (display_priority !== undefined && (!Number.isInteger(display_priority) || display_priority < 1)) {
      apiLogger.logResponse(req, 'update-marketing-post', 'VALIDATION_ERROR', 'Display priority must be a positive integer');
      return res.status(200).json({
        return_code: 'VALIDATION_ERROR',
        message: 'Display priority must be a positive integer'
      });
    }

    // Check that at least one field is being updated
    const updateFields = [title, description, image_url, is_active, display_priority];
    const hasUpdateData = updateFields.some(field => field !== undefined);

    if (!hasUpdateData) {
      apiLogger.logResponse(req, 'update-marketing-post', 'VALIDATION_ERROR', 'At least one field must be provided for update');
      return res.status(200).json({
        return_code: 'VALIDATION_ERROR',
        message: 'At least one field must be provided for update'
      });
    }

    // Use transaction wrapper for atomic operations
    const result = await transaction(async (client) => {

      // First, get the existing post and verify ownership
      const postQuery = await client.query(`
        SELECT mp.*, c.organiser_id
        FROM marketing_posts mp
        JOIN competition c ON mp.competition_id = c.id
        WHERE mp.id = $1
      `, [post_id]);

      // Check if post exists
      if (postQuery.rows.length === 0) {
        throw {
          return_code: 'NOT_FOUND',
          message: 'Marketing post not found'
        };
      }

      const post = postQuery.rows[0];

      // Check if user is the organizer of the competition
      if (post.organiser_id !== user_id) {
        throw {
          return_code: 'UNAUTHORIZED',
          message: 'You do not have permission to edit this post'
        };
      }

      // Build dynamic UPDATE query based on provided fields
      const updateValues = [];
      const updateClauses = [];
      let paramCounter = 1;

      // Add fields to update based on what was provided
      if (title !== undefined) {
        updateClauses.push(`title = $${paramCounter}`);
        updateValues.push(title.trim());
        paramCounter++;
      }

      if (description !== undefined) {
        updateClauses.push(`description = $${paramCounter}`);
        updateValues.push(description ? description.trim() : null);
        paramCounter++;
      }

      if (image_url !== undefined) {
        updateClauses.push(`image_url = $${paramCounter}`);
        updateValues.push(image_url || null);
        paramCounter++;
      }

      if (is_active !== undefined) {
        updateClauses.push(`is_active = $${paramCounter}`);
        updateValues.push(is_active);
        paramCounter++;
      }

      if (display_priority !== undefined) {
        updateClauses.push(`display_priority = $${paramCounter}`);
        updateValues.push(display_priority);
        paramCounter++;
      }

      // Always update the updated_at timestamp
      updateClauses.push(`updated_at = CURRENT_TIMESTAMP`);

      // Add the post_id as the last parameter for the WHERE clause
      updateValues.push(post_id);

      // Execute the UPDATE query
      const updateQuery = `
        UPDATE marketing_posts
        SET ${updateClauses.join(', ')}
        WHERE id = $${paramCounter}
      `;

      await client.query(updateQuery, updateValues);

      return { success: true };
    });

    // Log successful response
    apiLogger.logResponse(req, 'update-marketing-post', 'SUCCESS', `Updated marketing post ${post_id}`);

    // Return success response
    return res.status(200).json({
      return_code: 'SUCCESS',
      message: 'Marketing post updated successfully'
    });

  } catch (error) {
    console.error('Error in update-marketing-post:', error);

    // Handle custom thrown errors with specific return codes
    if (error.return_code) {
      apiLogger.logResponse(req, 'update-marketing-post', error.return_code, error.message);
      return res.status(200).json({
        return_code: error.return_code,
        message: error.message
      });
    }

    // Handle unexpected server errors
    apiLogger.logResponse(req, 'update-marketing-post', 'SERVER_ERROR', 'Internal server error occurred');
    return res.status(200).json({
      return_code: 'SERVER_ERROR',
      message: 'An internal server error occurred'
    });
  }
};

module.exports = updateMarketingPost;