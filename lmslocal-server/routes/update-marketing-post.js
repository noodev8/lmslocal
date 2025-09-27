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

const express = require('express');
const { query, transaction } = require('../database');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');

const router = express.Router();

// POST endpoint with JWT authentication middleware
router.post('/', verifyToken, async (req, res) => {
  // Start API logging
  logApiCall('update-marketing-post');

  try {
    // User authentication handled by verifyToken middleware
    const user_id = req.user.id;
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
      
      return res.status(200).json({
        return_code: 'VALIDATION_ERROR',
        message: 'Post ID is required and must be a number'
      });
    }

    // Validate title length if provided (max 50 characters)
    if (title !== undefined && (typeof title !== 'string' || title.length > 50)) {
      
      return res.status(200).json({
        return_code: 'VALIDATION_ERROR',
        message: 'Title must be a string of 50 characters or less'
      });
    }

    // Validate description length if provided (max 200 characters)
    if (description !== undefined && (typeof description !== 'string' || description.length > 200)) {
      
      return res.status(200).json({
        return_code: 'VALIDATION_ERROR',
        message: 'Description must be a string of 200 characters or less'
      });
    }

    // Validate is_active if provided (must be boolean)
    if (is_active !== undefined && typeof is_active !== 'boolean') {
      
      return res.status(200).json({
        return_code: 'VALIDATION_ERROR',
        message: 'Active status must be a boolean value'
      });
    }

    // Validate display_priority if provided (must be positive integer)
    if (display_priority !== undefined && (!Number.isInteger(display_priority) || display_priority < 1)) {
      
      return res.status(200).json({
        return_code: 'VALIDATION_ERROR',
        message: 'Display priority must be a positive integer'
      });
    }

    // Check that at least one field is being updated
    const updateFields = [title, description, image_url, is_active, display_priority];
    const hasUpdateData = updateFields.some(field => field !== undefined);

    if (!hasUpdateData) {
      
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
    

    // Return success response
    return res.status(200).json({
      return_code: 'SUCCESS',
      message: 'Marketing post updated successfully'
    });

  } catch (error) {
    console.error('Error in update-marketing-post:', error);

    // Handle custom thrown errors with specific return codes
    if (error.return_code) {
      
      return res.status(200).json({
        return_code: error.return_code,
        message: error.message
      });
    }

    // Handle unexpected server errors
    
    return res.status(200).json({
      return_code: 'SERVER_ERROR',
      message: 'An internal server error occurred'
    });
  }
});

module.exports = router;