/*
=======================================================================================================================================
API Route: delete-marketing-post
=======================================================================================================================================
Method: POST
Purpose: Permanently delete a marketing post from the database
=======================================================================================================================================
Request Payload:
{
  "post_id": 456                           // integer, required
}

Success Response:
{
  "return_code": "SUCCESS",
  "message": "Marketing post deleted successfully"
}

Error Response:
{
  "return_code": "NOT_FOUND",
  "message": "Marketing post not found"
}

{
  "return_code": "UNAUTHORIZED",
  "message": "You do not have permission to delete this post"
}

{
  "return_code": "VALIDATION_ERROR",
  "message": "Post ID is required and must be a number"
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
  logApiCall('delete-marketing-post');

  try {
    // User authentication handled by verifyToken middleware
    const user_id = req.user.id;
    const { post_id } = req.body;

    // Validate required fields
    if (!post_id || typeof post_id !== 'number') {
      
      return res.status(200).json({
        return_code: 'VALIDATION_ERROR',
        message: 'Post ID is required and must be a number'
      });
    }

    // Use transaction wrapper for atomic operations
    const result = await transaction(async (client) => {

      // First, get the existing post and verify ownership
      const postQuery = await client.query(`
        SELECT mp.id, mp.title, mp.competition_id, c.organiser_id
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
          message: 'You do not have permission to delete this post'
        };
      }

      // Delete the marketing post permanently
      const deleteResult = await client.query(
        'DELETE FROM marketing_posts WHERE id = $1',
        [post_id]
      );

      // Verify the deletion was successful
      if (deleteResult.rowCount === 0) {
        throw {
          return_code: 'NOT_FOUND',
          message: 'Marketing post not found or already deleted'
        };
      }

      return {
        deleted_post_id: post_id,
        post_title: post.title,
        competition_id: post.competition_id
      };
    });

    // Log successful response
    

    // Return success response
    return res.status(200).json({
      return_code: 'SUCCESS',
      message: 'Marketing post deleted successfully'
    });

  } catch (error) {
    console.error('Error in delete-marketing-post:', error);

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