/*
=======================================================================================================================================
API Route: generate-fixtures-image
=======================================================================================================================================
Method: POST
Purpose: Generates a Facebook-ready PNG image of fixtures for a competition round.
         This is a special case image endpoint that returns binary PNG data on success,
         but follows standard API-Rules.md for errors (HTTP 200 with return_code).
=======================================================================================================================================
Request Payload:
{
  "competitionName": "Premier League LMS",  // string, required
  "roundNumber": 5,                         // number, required
  "lockTime": "Saturday 1st November @ 3:00PM", // string, required
  "fixtures": [                             // array, required
    { "home": "Brighton", "away": "Leeds" },
    { "home": "Burnley", "away": "Arsenal" }
  ]
}

Success Response:
- HTTP 200
- Content-Type: image/png
- Binary PNG data (1080x1080px square format for Instagram, Facebook, X)

Error Response (HTTP 200):
{
  "return_code": "MISSING_FIELDS" | "VALIDATION_ERROR" | "SERVER_ERROR",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"MISSING_FIELDS" - Required fields are missing
"VALIDATION_ERROR" - Invalid input data
"SERVER_ERROR" - Image generation failed
=======================================================================================================================================
*/

import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

// Using Node.js runtime for better dev stability
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const body = await req.json();
    const { competitionName, roundNumber, lockTime, fixtures } = body;

    // Validate required fields
    if (!competitionName || !roundNumber || !lockTime || !fixtures) {
      return new Response(
        JSON.stringify({
          return_code: 'MISSING_FIELDS',
          message: 'Missing required fields: competitionName, roundNumber, lockTime, fixtures'
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate fixtures is an array
    if (!Array.isArray(fixtures) || fixtures.length === 0) {
      return new Response(
        JSON.stringify({
          return_code: 'VALIDATION_ERROR',
          message: 'Fixtures must be a non-empty array'
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Generate image using @vercel/og
    // Design matches Fixture-Sample-FB.png:
    // - Dark blue background (#1e3a5f)
    // - White text throughout
    // - Clean, professional look
    // - 1080x1080px (Instagram square - works for Facebook, Instagram, X)
    const imageResponse = new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#1e3a5f',
            padding: '60px',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}
        >
          {/* Competition Name */}
          <div
            style={{
              display: 'flex',
              fontSize: 48,
              fontWeight: 'bold',
              color: '#ffffff',
              marginBottom: 10,
              textAlign: 'center',
              letterSpacing: '0.1em'
            }}
          >
            {competitionName.toUpperCase()}
          </div>

          {/* Round X Fixtures Title */}
          <div
            style={{
              display: 'flex',
              fontSize: 44,
              fontWeight: 'bold',
              color: '#ffffff',
              marginBottom: 8,
              textAlign: 'center',
              letterSpacing: '0.05em'
            }}
          >
            ROUND {roundNumber} FIXTURES
          </div>

          {/* Lock Time */}
          <div
            style={{
              display: 'flex',
              fontSize: 24,
              fontWeight: '600',
              color: '#ffffff',
              marginBottom: 40,
              textAlign: 'center'
            }}
          >
            {String(lockTime || '').toUpperCase()}
          </div>

          {/* Fixtures List */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              marginBottom: 40
            }}
          >
            {fixtures.slice(0, 10).map((fixture: { home: string; away: string }, index: number) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  fontSize: 30,
                  fontWeight: '500',
                  color: '#ffffff',
                  textAlign: 'center',
                  letterSpacing: '0.02em'
                }}
              >
                {fixture.home} v {fixture.away}
              </div>
            ))}
          </div>

          {/* Call to Action */}
          <div
            style={{
              display: 'flex',
              fontSize: 32,
              fontWeight: 'bold',
              color: '#ffffff',
              marginTop: 20,
              marginBottom: 15,
              textAlign: 'center',
              letterSpacing: '0.05em'
            }}
          >
            JUST PICK A TEAM TO WIN
          </div>

          {/* LMSLocal Branding Footer */}
          <div
            style={{
              display: 'flex',
              fontSize: 18,
              color: '#b0c4de',
              textAlign: 'center',
              letterSpacing: '0.02em'
            }}
          >
            Hosted by LMS Local
          </div>
        </div>
      ),
      {
        width: 1080,
        height: 1080,
      }
    );

    return imageResponse;
  } catch {

    return new Response(
      JSON.stringify({
        return_code: 'SERVER_ERROR',
        message: 'Failed to generate image. Please try again.'
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
