/*
=======================================================================================================================================
API Route: generate-invite-image
=======================================================================================================================================
Method: POST
Purpose: Generates a Facebook-ready PNG image for competition invitations.
         This is a special case image endpoint that returns binary PNG data on success,
         but follows standard API-Rules.md for errors (HTTP 200 with return_code).
=======================================================================================================================================
Request Payload:
{
  "competitionName": "Premier League LMS",  // string, required
  "inviteCode": "PREM2024",                 // string, required
  "lockTime": "Saturday 1st November @ 3:00PM", // string, optional
  "entryFee": 5.00,                         // number, optional
  "prizeStructure": "Winner takes all"      // string, optional
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
    const { competitionName, inviteCode, lockTime, entryFee, prizeStructure } = body;

    // Validate required fields
    if (!competitionName || !inviteCode) {
      return new Response(
        JSON.stringify({
          return_code: 'MISSING_FIELDS',
          message: 'Missing required fields: competitionName, inviteCode'
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Format entry details
    let entryDetails = '';
    if (entryFee && entryFee > 0) {
      entryDetails = `💷 Entry: £${Number(entryFee).toFixed(2)}`;
      if (prizeStructure) {
        entryDetails += ` • 🏆 ${prizeStructure}`;
      }
    } else if (prizeStructure) {
      entryDetails = `🏆 ${prizeStructure}`;
    }

    // QR Code URL - using QR Server API (free, no signup needed)
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent('https://lmslocal.co.uk')}`;

    // Generate image using @vercel/og
    // Design using Slate Grey theme matching fixtures image
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
            padding: '50px',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}
        >
          {/* Header Section */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            {/* Competition Name */}
            <div
              style={{
                display: 'flex',
                fontSize: 48,
                fontWeight: 'bold',
                color: '#ffffff',
                textAlign: 'center',
                letterSpacing: '0.1em'
              }}
            >
              {competitionName.toUpperCase()}
            </div>

            {/* Last Man Standing subtitle */}
            <div
              style={{
                display: 'flex',
                fontSize: 28,
                fontWeight: '600',
                color: '#cbd5e1',
                textAlign: 'center',
                letterSpacing: '0.05em'
              }}
            >
              LAST MAN STANDING
            </div>
          </div>

          {/* Main Content Section - Mobile App */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '24px',
              flex: 1,
              justifyContent: 'center'
            }}
          >
            {/* Download App Section */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  display: 'flex',
                  fontSize: 28,
                  fontWeight: 'bold',
                  color: '#ffffff',
                  textAlign: 'center'
                }}
              >
                📱 DOWNLOAD THE APP:
              </div>
              <div
                style={{
                  display: 'flex',
                  fontSize: 24,
                  fontWeight: '500',
                  color: '#e2e8f0',
                  textAlign: 'center'
                }}
              >
                Search &ldquo;LMS Local&rdquo; in App Store or Google Play
              </div>
              <div
                style={{
                  display: 'flex',
                  fontSize: 22,
                  fontWeight: '500',
                  color: '#e2e8f0',
                  textAlign: 'center'
                }}
              >
                Then join using this code:
              </div>
            </div>

            {/* Invite Code - HUGE and prominent */}
            <div
              style={{
                display: 'flex',
                fontSize: 72,
                fontWeight: 'black',
                color: '#ffffff',
                backgroundColor: '#1e293b',
                padding: '20px 50px',
                borderRadius: '16px',
                letterSpacing: '0.15em',
                border: '4px solid #ffffff'
              }}
            >
              {inviteCode.toUpperCase()}
            </div>

            {/* Lock Time */}
            {lockTime && (
              <div
                style={{
                  display: 'flex',
                  fontSize: 22,
                  fontWeight: '600',
                  color: '#fbbf24',
                  textAlign: 'center'
                }}
              >
                ⏰ FIRST ROUND LOCKS: {String(lockTime).toUpperCase()}
              </div>
            )}

            {/* Entry Details */}
            {entryDetails && (
              <div
                style={{
                  display: 'flex',
                  fontSize: 20,
                  fontWeight: '600',
                  color: '#e2e8f0',
                  textAlign: 'center'
                }}
              >
                {entryDetails}
              </div>
            )}
          </div>

          {/* Footer Section */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            {/* Tagline */}
            <div
              style={{
                display: 'flex',
                fontSize: 24,
                fontWeight: 'bold',
                color: '#ffffff',
                textAlign: 'center',
                letterSpacing: '0.05em'
              }}
            >
              PICK A TEAM EACH ROUND - IF THEY WIN, YOU SURVIVE!
            </div>

            {/* Divider line */}
            <div
              style={{
                display: 'flex',
                width: '80%',
                height: '2px',
                backgroundColor: '#475569'
              }}
            />

            {/* Web Option with QR Code */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: '20px',
                marginTop: '8px'
              }}
            >
              {/* QR Code - smaller */}
              <div
                style={{
                  display: 'flex',
                  backgroundColor: '#ffffff',
                  padding: '8px',
                  borderRadius: '8px'
                }}
              >
                <img
                  src={qrCodeUrl}
                  alt="QR Code"
                  width="100"
                  height="100"
                  style={{
                    display: 'block'
                  }}
                />
              </div>

              {/* Web join text */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '4px'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    fontSize: 16,
                    fontWeight: '600',
                    color: '#cbd5e1',
                    textAlign: 'left'
                  }}
                >
                  🌐 Or join on web:
                </div>
                <div
                  style={{
                    display: 'flex',
                    fontSize: 18,
                    fontWeight: 'bold',
                    color: '#ffffff',
                    textAlign: 'left'
                  }}
                >
                  lmslocal.co.uk
                </div>
                <div
                  style={{
                    display: 'flex',
                    fontSize: 14,
                    color: '#94a3b8',
                    textAlign: 'left'
                  }}
                >
                  (Scan QR or type URL)
                </div>
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
