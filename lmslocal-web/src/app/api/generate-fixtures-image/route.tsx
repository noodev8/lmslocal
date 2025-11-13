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
    // Design using Slate Grey theme:
    // - Slate grey background (#334155 - Tailwind slate-700)
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
            justifyContent: 'space-between',
            backgroundColor: '#334155',
            padding: '50px 60px',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}
        >
          {/* Header Section */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Competition Name */}
            <div
              style={{
                display: 'flex',
                fontSize: 46,
                fontWeight: 'bold',
                color: '#ffffff',
                marginBottom: 6,
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
                fontSize: 42,
                fontWeight: 'bold',
                color: '#ffffff',
                marginBottom: 4,
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
                fontSize: 22,
                fontWeight: '600',
                color: '#ffffff',
                textAlign: 'center'
              }}
            >
              {String(lockTime || '').toUpperCase()}
            </div>
          </div>

          {/* Fixtures List */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              flex: 1,
              justifyContent: 'center',
              paddingTop: '20px',
              paddingBottom: '20px'
            }}
          >
            {fixtures.slice(0, 10).map((fixture: { home: string; away: string }, index: number) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  fontSize: 36,
                  fontWeight: '600',
                  color: '#ffffff',
                  textAlign: 'center',
                  letterSpacing: '0.02em'
                }}
              >
                {fixture.home.toUpperCase()} v {fixture.away.toUpperCase()}
              </div>
            ))}
          </div>

          {/* Footer Section */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            {/* Call to Action */}
            <div
              style={{
                display: 'flex',
                fontSize: 30,
                fontWeight: 'bold',
                color: '#ffffff',
                textAlign: 'center',
                letterSpacing: '0.05em'
              }}
            >
              JUST PICK A TEAM TO WIN
            </div>

            {/* LMSLocal Branding */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  fontSize: 16,
                  color: '#cbd5e1',
                  textAlign: 'center',
                  letterSpacing: '0.02em'
                }}
              >
                Hosted by LMS Local
              </div>
              <div
                style={{
                  display: 'flex',
                  fontSize: 18,
                  fontWeight: '600',
                  color: '#ffffff',
                  textAlign: 'center',
                  letterSpacing: '0.03em'
                }}
              >
                www.lmslocal.co.uk
              </div>
            </div>
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
