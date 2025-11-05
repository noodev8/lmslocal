/*
=======================================================================================================================================
API Route: submit-onboarding-application
=======================================================================================================================================
Method: POST
Purpose: Submits an onboarding application from a venue/organizer interested in free setup support
=======================================================================================================================================
Request Payload:
{
  "venueName": "The Red Lion Pub",              // string, optional - Venue or organization name
  "venueType": "pub",                            // string, optional - Type: pub, club, workplace, friends, other
  "contactName": "John Smith",                   // string, required - Contact person's full name
  "email": "john@venue.com",                     // string, required - Contact email address
  "phone": "+44 7700 900000",                    // string, optional - Contact phone number
  "estimatedPlayers": 25,                        // number, optional - Estimated number of players (min 10)
  "preferredStartDate": "2025-12-01",            // string, optional - ISO date format (YYYY-MM-DD)
  "description": "Local pub with regular..."     // string, optional - Additional information
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Application submitted successfully. We'll contact you within 24 hours.",
  "application_id": 123                          // integer, unique application ID
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"MISSING_FIELDS"
"VALIDATION_ERROR"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../database');
const emailService = require('../services/emailService');
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    // Extract request parameters
    const {
      venueName,
      venueType,
      contactName,
      email,
      phone,
      estimatedPlayers,
      preferredStartDate,
      description
    } = req.body;

    // === VALIDATE REQUIRED FIELDS (ONLY EMAIL AND CONTACT NAME) ===
    if (!contactName || !email) {
      return res.json({
        return_code: "MISSING_FIELDS",
        message: "Contact name and email are required"
      });
    }

    // === VALIDATE CONTACT NAME ===
    const trimmedContactName = contactName.trim();
    if (trimmedContactName.length < 2 || trimmedContactName.length > 255) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Contact name must be between 2 and 255 characters"
      });
    }

    // === VALIDATE EMAIL ===
    const trimmedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Please enter a valid email address"
      });
    }

    // === VALIDATE VENUE NAME (OPTIONAL) ===
    let trimmedVenueName = null;
    if (venueName) {
      trimmedVenueName = venueName.trim();
      if (trimmedVenueName.length < 2 || trimmedVenueName.length > 255) {
        return res.json({
          return_code: "VALIDATION_ERROR",
          message: "Venue name must be between 2 and 255 characters"
        });
      }
    }

    // === VALIDATE VENUE TYPE (OPTIONAL) ===
    let validatedVenueType = null;
    if (venueType) {
      const validVenueTypes = ['pub', 'club', 'workplace', 'friends', 'other'];
      if (!validVenueTypes.includes(venueType)) {
        return res.json({
          return_code: "VALIDATION_ERROR",
          message: "Invalid venue type"
        });
      }
      validatedVenueType = venueType;
    }

    // === VALIDATE PHONE (OPTIONAL) ===
    let trimmedPhone = null;
    if (phone) {
      trimmedPhone = phone.trim();
      if (trimmedPhone.length < 8 || trimmedPhone.length > 50) {
        return res.json({
          return_code: "VALIDATION_ERROR",
          message: "Please enter a valid phone number"
        });
      }
    }

    // === VALIDATE ESTIMATED PLAYERS (OPTIONAL) ===
    let playersNum = null;
    if (estimatedPlayers) {
      playersNum = parseInt(estimatedPlayers);
      if (isNaN(playersNum) || playersNum < 10) {
        return res.json({
          return_code: "VALIDATION_ERROR",
          message: "Estimated players must be at least 10"
        });
      }
    }

    // === VALIDATE PREFERRED START DATE (OPTIONAL) ===
    let validatedStartDate = null;
    if (preferredStartDate) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(preferredStartDate)) {
        return res.json({
          return_code: "VALIDATION_ERROR",
          message: "Invalid date format. Please use YYYY-MM-DD"
        });
      }

      // Check if date is valid
      const startDate = new Date(preferredStartDate);
      if (isNaN(startDate.getTime())) {
        return res.json({
          return_code: "VALIDATION_ERROR",
          message: "Invalid date"
        });
      }

      validatedStartDate = preferredStartDate;
    }

    // === INSERT INTO DATABASE ===
    const insertQuery = `
      INSERT INTO onboarding_applications (
        venue_name,
        venue_type,
        contact_name,
        email,
        phone,
        estimated_players,
        preferred_start_date,
        description,
        status,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING id
    `;

    const result = await query(insertQuery, [
      trimmedVenueName,
      validatedVenueType,
      trimmedContactName,
      trimmedEmail,
      trimmedPhone,
      playersNum,
      validatedStartDate,
      description || null,
      'pending'
    ]);

    const applicationId = result.rows[0].id;

    console.log(`✅ Onboarding application #${applicationId} received from ${trimmedVenueName || 'N/A'} (${trimmedEmail})`);

    // === SEND NOTIFICATION EMAIL TO ADMIN ===
    try {
      console.log('Attempting to send admin notification email...');
      const adminEmailResult = await emailService.sendOnboardingNotification({
        applicationId,
        venueName: trimmedVenueName || 'Not specified',
        venueType: validatedVenueType || 'Not specified',
        contactName: trimmedContactName,
        email: trimmedEmail,
        phone: trimmedPhone || 'Not specified',
        estimatedPlayers: playersNum || 'Not specified',
        preferredStartDate: validatedStartDate || 'Not specified',
        description
      });
      console.log('Admin notification email sent successfully:', adminEmailResult);
    } catch (emailError) {
      // Log error but don't fail the request - application was saved successfully
      console.error('❌ Failed to send notification email:', emailError);
      console.error('Error details:', emailError.message, emailError.stack);
    }

    // === SEND CONFIRMATION EMAIL TO APPLICANT ===
    try {
      console.log('Attempting to send confirmation email to applicant...');
      const confirmationResult = await emailService.sendOnboardingConfirmation(trimmedEmail, trimmedContactName);
      console.log('Confirmation email sent successfully:', confirmationResult);
    } catch (emailError) {
      // Log error but don't fail the request
      console.error('❌ Failed to send confirmation email:', emailError);
      console.error('Error details:', emailError.message, emailError.stack);
    }

    // === RETURN SUCCESS RESPONSE ===
    return res.json({
      return_code: "SUCCESS",
      message: "Application submitted successfully. We'll contact you within 24 hours.",
      application_id: applicationId
    });

  } catch (error) {
    console.error('Error submitting onboarding application:', error);
    return res.json({
      return_code: "SERVER_ERROR",
      message: "An error occurred while processing your application. Please try again."
    });
  }
});

module.exports = router;
