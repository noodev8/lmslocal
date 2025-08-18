/*
=======================================================================================================================================
API Route: /organisation/create
=======================================================================================================================================
Method: POST
Purpose: Create a new organisation (pub, workplace, club)
=======================================================================================================================================
Request Payload:
{
  "name": "The Red Lion Pub",           // string, required - organisation name
  "owner_email": "owner@redlion.com",   // string, required - owner's email address
  "owner_name": "John Smith"            // string, required - owner's display name
}

Success Response:
{
  "return_code": "SUCCESS",
  "organisation_id": 123,               // number, unique organisation ID
  "slug": "red-lion-pub",               // string, URL-friendly identifier
  "name": "The Red Lion Pub",           // string, organisation name
  "owner_user_id": 456                  // number, user ID of the owner
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"DUPLICATE_NAME_ERROR"
"DATABASE_ERROR"
"SERVER_ERROR"
=======================================================================================================================================

=======================================================================================================================================
API Route: /organisation/get
=======================================================================================================================================
Method: POST
Purpose: Get organisation details by ID or slug
=======================================================================================================================================
Request Payload:
{
  "organisation_id": 123               // number, optional - organisation ID
  "slug": "red-lion-pub"               // string, optional - organisation slug
}
// Note: Provide either organisation_id OR slug, not both

Success Response:
{
  "return_code": "SUCCESS",
  "organisation_id": 123,              // number, unique organisation ID
  "slug": "red-lion-pub",              // string, URL-friendly identifier
  "name": "The Red Lion Pub",          // string, organisation name
  "owner_user_id": 456,                // number, user ID of the owner
  "owner_name": "John Smith",          // string, owner's display name
  "is_active": true,                   // boolean, organisation status
  "created_at": "2024-01-01T12:00:00Z" // string, creation timestamp
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"ORGANISATION_NOT_FOUND"
"DATABASE_ERROR"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { pool } = require('../config/database');
const router = express.Router();

// Helper function to generate slug from name
function generateSlug(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-')         // Replace spaces with hyphens
        .replace(/-+/g, '-')          // Replace multiple hyphens with single
        .trim();
}

// Create organisation
router.post('/create', async (req, res) => {
    try {
        console.log('🏢 Creating new organisation');
        
        const { name, owner_email, owner_name } = req.body;

        // Validation
        if (!name || !owner_email || !owner_name) {
            console.log('❌ Validation failed: missing required fields');
            return res.status(400).json({
                return_code: 'VALIDATION_ERROR',
                message: 'Missing required fields: name, owner_email, owner_name'
            });
        }

        const slug = generateSlug(name);
        console.log(`📝 Generated slug: ${slug}`);

        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            // Check if organisation name or slug already exists
            const existingOrg = await client.query(
                'SELECT id FROM organisation WHERE name = $1 OR slug = $2',
                [name, slug]
            );

            if (existingOrg.rows.length > 0) {
                await client.query('ROLLBACK');
                console.log('❌ Organisation already exists');
                return res.status(400).json({
                    return_code: 'DUPLICATE_NAME_ERROR',
                    message: 'Organisation with this name already exists'
                });
            }

            // Create or get user (owner)
            let ownerUser = await client.query(
                'SELECT id FROM app_user WHERE email = $1',
                [owner_email]
            );

            let ownerUserId;
            if (ownerUser.rows.length === 0) {
                // Create new user
                const newUser = await client.query(
                    'INSERT INTO app_user (email, display_name, is_managed, email_verified) VALUES ($1, $2, $3, $4) RETURNING id',
                    [owner_email, owner_name, false, false]
                );
                ownerUserId = newUser.rows[0].id;
                console.log(`👤 Created new user with ID: ${ownerUserId}`);
            } else {
                ownerUserId = ownerUser.rows[0].id;
                console.log(`👤 Using existing user with ID: ${ownerUserId}`);
            }

            // Create organisation
            const result = await client.query(
                'INSERT INTO organisation (name, slug, owner_user_id, is_active) VALUES ($1, $2, $3, $4) RETURNING id',
                [name, slug, ownerUserId, true]
            );

            const organisationId = result.rows[0].id;

            await client.query('COMMIT');
            console.log(`✅ Organisation created successfully with ID: ${organisationId}`);

            res.json({
                return_code: 'SUCCESS',
                organisation_id: organisationId,
                slug: slug,
                name: name,
                owner_user_id: ownerUserId
            });

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('❌ Organisation creation failed:', error.message);
        res.status(500).json({
            return_code: 'DATABASE_ERROR',
            message: 'Failed to create organisation',
            error: error.message
        });
    }
});

// Get organisation
router.post('/get', async (req, res) => {
    try {
        console.log('🔍 Getting organisation details');
        
        const { organisation_id, slug } = req.body;

        // Validation - need either organisation_id or slug
        if (!organisation_id && !slug) {
            console.log('❌ Validation failed: missing organisation_id or slug');
            return res.status(400).json({
                return_code: 'VALIDATION_ERROR',
                message: 'Provide either organisation_id or slug'
            });
        }

        const client = await pool.connect();
        
        try {
            let query;
            let params;
            
            if (organisation_id) {
                query = `
                    SELECT o.id, o.name, o.slug, o.owner_user_id, o.is_active, o.created_at,
                           u.display_name as owner_name
                    FROM organisation o
                    JOIN app_user u ON o.owner_user_id = u.id
                    WHERE o.id = $1
                `;
                params = [organisation_id];
            } else {
                query = `
                    SELECT o.id, o.name, o.slug, o.owner_user_id, o.is_active, o.created_at,
                           u.display_name as owner_name
                    FROM organisation o
                    JOIN app_user u ON o.owner_user_id = u.id
                    WHERE o.slug = $1
                `;
                params = [slug];
            }

            const result = await client.query(query, params);

            if (result.rows.length === 0) {
                console.log('❌ Organisation not found');
                return res.status(404).json({
                    return_code: 'ORGANISATION_NOT_FOUND',
                    message: 'Organisation not found'
                });
            }

            const org = result.rows[0];
            console.log(`✅ Organisation found: ${org.name}`);

            res.json({
                return_code: 'SUCCESS',
                organisation_id: org.id,
                slug: org.slug,
                name: org.name,
                owner_user_id: org.owner_user_id,
                owner_name: org.owner_name,
                is_active: org.is_active,
                created_at: org.created_at
            });

        } finally {
            client.release();
        }

    } catch (error) {
        console.error('❌ Get organisation failed:', error.message);
        res.status(500).json({
            return_code: 'DATABASE_ERROR',
            message: 'Failed to get organisation',
            error: error.message
        });
    }
});

module.exports = router;