/*
=======================================================================================================================================
API Route: submit-contact-message
=======================================================================================================================================
Method: POST
Purpose: Takes a message from the public contact form in the help centre and emails it to the
         LMSLocal inbox, with reply_to set to the sender so a reply goes straight back to them.

         Deliberately unauthenticated. Someone who cannot sign in is exactly the person most
         likely to need to get hold of us, so requiring a session would lock out the case that
         matters most.

         Nothing is written to the database — the message is the email. If contact volume ever
         justifies a queue or a ticket table, that is the point to add one.

         Rate limited in server.js by contactLimit, because a public form that sends email is a
         spam target. A hidden honeypot field catches the simplest bots: real people never fill it
         in, so anything that does is accepted with a SUCCESS response and quietly dropped.
=======================================================================================================================================
Request Payload:
{
  "name": "Dave Roberts",              // string, required - 2 to 100 characters
  "email": "dave@example.com",         // string, required - valid email address
  "subject": "Joining a competition",  // string, required - one of the allowed subjects
  "message": "I cannot get my code...", // string, required - 10 to 4000 characters
  "website": ""                        // string, optional - honeypot, must be empty
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Thanks — your message is with us."
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"  - A field is missing, too short, too long, or not a valid email
"SEND_FAILED"       - The email provider rejected the message
"SERVER_ERROR"      - Unexpected server failure
=======================================================================================================================================
*/

const express = require('express');
const { sendContactMessage } = require('../services/emailService');
const router = express.Router();

// Kept in step with the options offered on /help/support
const SUBJECTS = [
  'Joining a competition',
  'Running a competition',
  'Picks and results',
  'Billing and credits',
  'Something is broken',
  'Something else'
];

router.post('/', async (req, res) => {
  try {
    const { name, email, subject, message, website } = req.body;

    // Honeypot: accept and drop, so a bot gets no signal that it was spotted
    if (website && String(website).trim().length > 0) {
      return res.status(200).json({
        return_code: "SUCCESS",
        message: "Thanks — your message is with us."
      });
    }

    const trimmedName = typeof name === 'string' ? name.trim() : '';
    if (trimmedName.length < 2 || trimmedName.length > 100) {
      return res.status(200).json({
        return_code: "VALIDATION_ERROR",
        message: "Please give us your name."
      });
    }

    const trimmedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail) || trimmedEmail.length > 255) {
      return res.status(200).json({
        return_code: "VALIDATION_ERROR",
        message: "We need a valid email address to reply to."
      });
    }

    const chosenSubject = SUBJECTS.includes(subject) ? subject : 'Something else';

    const trimmedMessage = typeof message === 'string' ? message.trim() : '';
    if (trimmedMessage.length < 10) {
      return res.status(200).json({
        return_code: "VALIDATION_ERROR",
        message: "Tell us a little more so we can actually help."
      });
    }
    if (trimmedMessage.length > 4000) {
      return res.status(200).json({
        return_code: "VALIDATION_ERROR",
        message: "That message is too long. Please keep it under 4000 characters."
      });
    }

    // Resend resolves rather than throws on failure, so check the result explicitly
    const sendResult = await sendContactMessage({
      name: trimmedName,
      email: trimmedEmail,
      subject: chosenSubject,
      body: trimmedMessage
    });

    if (!sendResult.success) {
      console.error('Contact message failed to send:', sendResult.error);
      return res.status(200).json({
        return_code: "SEND_FAILED",
        message: "We could not send that just now. Please email lmslocal8@gmail.com instead."
      });
    }

    return res.status(200).json({
      return_code: "SUCCESS",
      message: "Thanks — your message is with us."
    });

  } catch (error) {
    console.error('Error in submit-contact-message:', error);
    return res.status(200).json({
      return_code: "SEND_FAILED",
      message: "We could not send that just now. Please email lmslocal8@gmail.com instead."
    });
  }
});

module.exports = router;
