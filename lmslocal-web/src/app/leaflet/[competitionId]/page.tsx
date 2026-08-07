'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import QRCode from 'qrcode';
import { promoteApi } from '@/lib/api';

interface LeafletData {
  competition: {
    id: number;
    name: string;
    description?: string | null;
    invite_code: string;
    join_url: string;
    logo_url?: string | null;
    entry_fee?: number | null;
    prize_structure?: string | null;
    start_date?: string;
    lives_per_player?: number;
  };
}

export default function LeafletPage() {
  const params = useParams();
  const router = useRouter();
  const competitionId = params.competitionId as string;

  const [data, setData] = useState<LeafletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joinQrCodeUrl, setJoinQrCodeUrl] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await promoteApi.getPromoteData(parseInt(competitionId));

        if (response.data.return_code === 'SUCCESS' && response.data.competition) {
          const leafletData: LeafletData = {
            competition: {
              id: response.data.competition.id,
              name: response.data.competition.name,
              description: response.data.competition.description,
              invite_code: response.data.competition.invite_code,
              join_url: response.data.competition.join_url,
              logo_url: response.data.competition.logo_url,
              entry_fee: response.data.competition.entry_fee,
              prize_structure: response.data.competition.prize_structure,
              start_date: response.data.competition.start_date,
              lives_per_player: response.data.competition.lives_per_player,
            }
          };
          setData(leafletData);

          // One QR code, and it goes straight to the join page.
          //
          // This used to be two, both pointing at app stores. That made the leaflet's first ask
          // "install an app" - the highest-friction path in the system, aimed at the least patient
          // audience, and on a printed sheet the two codes competed: scan the wrong one and you
          // land in an app store with no idea what the competition was. See §5.3 of
          // docs/player-onboarding.md.
          //
          // Error correction is bumped to 'H' because this ends up on paper in a pub, where it
          // will be creased, smudged and photographed at an angle.
          try {
            const joinDataUrl = await QRCode.toDataURL(response.data.competition.join_url, {
              width: 400,
              margin: 2,
              errorCorrectionLevel: 'H',
              color: {
                dark: '#000000',
                light: '#FFFFFF'
              }
            });
            setJoinQrCodeUrl(joinDataUrl);
          } catch (qrError) {
            // The URL and code are printed underneath, so a missing QR is a degraded leaflet
            // rather than a useless one.
            console.error('Error generating join QR code:', qrError);
          }

          setError(null);
        } else {
          setError(response.data.message || 'Competition not found');
        }
      } catch (err) {
        console.error('Error fetching leaflet data:', err);
        setError('Failed to load competition data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [competitionId]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full mb-4 shadow-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-600 border-t-transparent"></div>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Loading Leaflet</h3>
          <p className="text-gray-500">Please wait...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Leaflet</h3>
          <p className="text-gray-500 mb-4">{error || 'Failed to load leaflet data'}</p>
          <p className="text-sm text-gray-400">Competition ID: {competitionId}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
          }
          .no-print {
            display: none !important;
          }
          .leaflet-container {
            width: 210mm;
            height: 297mm;
            margin: 0;
            padding: 15mm;
            page-break-after: avoid;
            box-shadow: none !important;
          }
        }

        @page {
          size: A4;
          margin: 0;
        }
      `}</style>

      {/* Screen Controls */}
      <div className="no-print bg-gray-900 text-white p-4 sticky top-0 z-50 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.back()}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back</span>
            </button>
            <div>
              <h1 className="text-lg font-bold">{data.competition.name}</h1>
              <p className="text-sm text-gray-300">Promotional Leaflet</p>
            </div>
          </div>
          <button
            onClick={handlePrint}
            className="flex items-center space-x-2 px-6 py-2 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            <span>Print Leaflet</span>
          </button>
        </div>
      </div>

      {/* Leaflet Content - A4 Size */}
      <div className="min-h-screen bg-gray-100 py-8 no-print">
        <div className="leaflet-container max-w-[210mm] mx-auto bg-white shadow-2xl p-[15mm]">

          {/* Header */}
          <div className="mb-3">
            {data.competition.logo_url ? (
              // Centered horizontal layout with logo
              <div className="flex items-center justify-center gap-6">
                <Image
                  src={data.competition.logo_url}
                  alt={`${data.competition.name} logo`}
                  width={100}
                  height={100}
                  className="rounded-lg flex-shrink-0"
                  unoptimized
                />
                <div>
                  <h1 className="text-4xl font-black text-gray-900 mb-2 uppercase tracking-tight leading-tight">
                    Last Man Standing
                  </h1>
                  <p className="text-xl font-bold text-gray-700 uppercase tracking-wide">
                    {data.competition.name}
                  </p>
                </div>
              </div>
            ) : (
              // Centered layout without logo
              <div className="text-center">
                <h1 className="text-5xl font-black text-gray-900 mb-3 uppercase tracking-tight leading-tight">
                  Last Man Standing
                </h1>
                <div className="w-24 h-1 bg-gray-900 mx-auto mb-4"></div>
                <p className="text-2xl font-bold text-gray-700 uppercase tracking-wide">
                  {data.competition.name}
                </p>
              </div>
            )}

            {/* Description */}
            {data.competition.description && (
              <div className="mt-4 text-center">
                <p className="text-base text-gray-700 italic max-w-2xl mx-auto">
                  {data.competition.description}
                </p>
              </div>
            )}
          </div>

          {/* Join Section - one QR, straight to the join page */}
          <div className="border-4 border-gray-900 p-4 bg-gray-50 mb-4">
            <h3 className="text-2xl font-black text-gray-900 mb-3 uppercase text-center">Scan to Join</h3>

            <div className="flex flex-col items-center">
              <div className="border-2 border-gray-300 p-3 bg-white rounded-lg mb-3">
                {joinQrCodeUrl ? (
                  <Image src={joinQrCodeUrl} alt="QR code to join this competition" width={200} height={200} className="mx-auto" unoptimized />
                ) : (
                  <div className="w-[200px] h-[200px] bg-gray-200 animate-pulse mx-auto"></div>
                )}
              </div>

              {/* Printed underneath so the leaflet still works for anyone who cannot or will not
                  scan - an older phone, a bad camera, or simple suspicion of QR codes. */}
              <p className="text-sm text-gray-600 mb-1">Or go to</p>
              <p className="text-lg font-bold text-gray-900 break-all text-center">{data.competition.join_url}</p>
            </div>
          </div>

          {/* Access Code and Instructions - Full Width */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Access Code Box */}
            <div className="border-4 border-gray-900 p-4 text-center bg-white flex flex-col justify-center">
              <p className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide">Access Code</p>
              <p className="text-4xl font-black text-gray-900 tracking-wider">
                {data.competition.invite_code}
              </p>
            </div>

            {/*
              Two steps, and neither is "install something". The old first step was download the
              app, which meant install, register, sign in, then find the code again - four things
              before seeing the competition. The web join needs none of them; the app is for
              players who are already in. See §5.3 of docs/player-onboarding.md.
            */}
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-gray-900 uppercase">How to Join</h3>
              <ol className="space-y-3 text-base text-gray-700">
                <li className="flex items-start">
                  <span className="font-bold mr-2 text-gray-900">1.</span>
                  <span>Scan the code above, or type the address into your phone</span>
                </li>
                <li className="flex items-start">
                  <span className="font-bold mr-2 text-gray-900">2.</span>
                  <span>Pick your team each week before kick-off</span>
                </li>
              </ol>
              <p className="text-sm text-gray-500 pt-1">
                Nothing to type in if you scan. Playing already? The <strong>LMS Local</strong> app
                is on the App Store and Google Play.
              </p>
            </div>
          </div>

          {/* Competition Details - Full Width */}
          <div className="border-4 border-gray-900 bg-white p-4 mb-4">
            <h3 className="text-xl font-black text-gray-900 mb-2 uppercase text-center border-b-2 border-gray-300 pb-2">Competition Details</h3>
            <div className="grid grid-cols-1 gap-2 text-sm text-gray-900">
              <div className="flex items-start">
                <span className="font-bold min-w-[120px] text-gray-700">Entry Fee:</span>
                <span className="font-semibold">{data.competition.entry_fee ? `£${Number(data.competition.entry_fee).toFixed(2)}` : 'Contact organiser'}</span>
              </div>
              <div className="flex items-start">
                <span className="font-bold min-w-[120px] text-gray-700">Start Date:</span>
                <span className="font-semibold">{data.competition.start_date || 'Check with organiser'}</span>
              </div>
              <div className="flex items-start">
                <span className="font-bold min-w-[120px] text-gray-700 flex-shrink-0">Prize:</span>
                <span className="font-semibold flex-1">{data.competition.prize_structure || 'To be confirmed'}</span>
              </div>
            </div>
          </div>

          {/* Rules Section */}
          <div className="border-t-2 border-gray-300 pt-4 mb-3">
            <h3 className="text-xl font-bold text-gray-900 mb-3 uppercase text-center">How to Play</h3>
            <div className="grid grid-cols-2 gap-3 text-sm text-gray-700">
              <div className="flex items-start space-x-2">
                <span className="text-2xl">⚽</span>
                <div>
                  <p className="font-bold text-gray-900">Pick One Team</p>
                  <p>Choose one team to win each round</p>
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-2xl">🏆</span>
                <div>
                  <p className="font-bold text-gray-900">Win = Survive</p>
                  <p>Your team wins, you advance to next round</p>
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-2xl">❌</span>
                <div>
                  {data.competition.lives_per_player === 0 ? (
                    <>
                      <p className="font-bold text-gray-900">Draw or Loss = Out</p>
                      <p>Your team draws or loses, you&apos;re eliminated</p>
                    </>
                  ) : (
                    <>
                      <p className="font-bold text-gray-900">Wrong Result Costs a Life</p>
                      <p>Out at zero lives</p>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-2xl">🚫</span>
                <div>
                  <p className="font-bold text-gray-900">No Repeats</p>
                  <p>Can&apos;t pick the same team twice</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-xs text-gray-500 border-t border-gray-200 pt-3">
            <p className="font-semibold text-gray-700">Powered by LMS Local &bull; www.lmslocal.co.uk</p>
            <p className="text-xs">The easiest way to run Last Man Standing competitions</p>
          </div>

        </div>
      </div>

      {/* Print Version (Hidden on Screen) */}
      <div className="hidden print:block">
        <div className="leaflet-container">

          {/* Header */}
          <div className="mb-3">
            {data.competition.logo_url ? (
              // Centered horizontal layout with logo
              <div className="flex items-center justify-center gap-6">
                <Image
                  src={data.competition.logo_url}
                  alt={`${data.competition.name} logo`}
                  width={100}
                  height={100}
                  className="rounded-lg flex-shrink-0"
                  unoptimized
                />
                <div>
                  <h1 className="text-4xl font-black text-gray-900 mb-2 uppercase tracking-tight leading-tight">
                    Last Man Standing
                  </h1>
                  <p className="text-xl font-bold text-gray-700 uppercase tracking-wide">
                    {data.competition.name}
                  </p>
                </div>
              </div>
            ) : (
              // Centered layout without logo
              <div className="text-center">
                <h1 className="text-5xl font-black text-gray-900 mb-3 uppercase tracking-tight leading-tight">
                  Last Man Standing
                </h1>
                <div className="w-24 h-1 bg-gray-900 mx-auto mb-4"></div>
                <p className="text-2xl font-bold text-gray-700 uppercase tracking-wide">
                  {data.competition.name}
                </p>
              </div>
            )}

            {/* Description */}
            {data.competition.description && (
              <div className="mt-4 text-center">
                <p className="text-base text-gray-700 italic max-w-2xl mx-auto">
                  {data.competition.description}
                </p>
              </div>
            )}
          </div>

          {/* Join Section - one QR, straight to the join page (print) */}
          <div className="border-4 border-gray-900 p-4 bg-gray-50 mb-4">
            <h3 className="text-2xl font-black text-gray-900 mb-3 uppercase text-center">Scan to Join</h3>

            <div className="flex flex-col items-center">
              <div className="border-2 border-gray-300 p-3 bg-white rounded-lg mb-3">
                {joinQrCodeUrl && (
                  <Image src={joinQrCodeUrl} alt="QR code to join this competition" width={200} height={200} className="mx-auto" unoptimized />
                )}
              </div>
              <p className="text-sm text-gray-600 mb-1">Or go to</p>
              <p className="text-lg font-bold text-gray-900 break-all text-center">{data.competition.join_url}</p>
            </div>
          </div>

          {/* Access Code and Instructions - Full Width */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Access Code Box */}
            <div className="border-4 border-gray-900 p-4 text-center bg-white flex flex-col justify-center">
              <p className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide">Access Code</p>
              <p className="text-4xl font-black text-gray-900 tracking-wider">
                {data.competition.invite_code}
              </p>
            </div>

            {/*
              Two steps, and neither is "install something". The old first step was download the
              app, which meant install, register, sign in, then find the code again - four things
              before seeing the competition. The web join needs none of them; the app is for
              players who are already in. See §5.3 of docs/player-onboarding.md.
            */}
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-gray-900 uppercase">How to Join</h3>
              <ol className="space-y-3 text-base text-gray-700">
                <li className="flex items-start">
                  <span className="font-bold mr-2 text-gray-900">1.</span>
                  <span>Scan the code above, or type the address into your phone</span>
                </li>
                <li className="flex items-start">
                  <span className="font-bold mr-2 text-gray-900">2.</span>
                  <span>Pick your team each week before kick-off</span>
                </li>
              </ol>
              <p className="text-sm text-gray-500 pt-1">
                Nothing to type in if you scan. Playing already? The <strong>LMS Local</strong> app
                is on the App Store and Google Play.
              </p>
            </div>
          </div>

          {/* Competition Details - Full Width */}
          <div className="border-4 border-gray-900 bg-white p-4 mb-4">
            <h3 className="text-xl font-black text-gray-900 mb-2 uppercase text-center border-b-2 border-gray-300 pb-2">Competition Details</h3>
            <div className="grid grid-cols-1 gap-2 text-sm text-gray-900">
              <div className="flex items-start">
                <span className="font-bold min-w-[120px] text-gray-700">Entry Fee:</span>
                <span className="font-semibold">{data.competition.entry_fee ? `£${Number(data.competition.entry_fee).toFixed(2)}` : 'Contact organiser'}</span>
              </div>
              <div className="flex items-start">
                <span className="font-bold min-w-[120px] text-gray-700">Start Date:</span>
                <span className="font-semibold">{data.competition.start_date || 'Check with organiser'}</span>
              </div>
              <div className="flex items-start">
                <span className="font-bold min-w-[120px] text-gray-700 flex-shrink-0">Prize:</span>
                <span className="font-semibold flex-1">{data.competition.prize_structure || 'To be confirmed'}</span>
              </div>
            </div>
          </div>

          {/* Rules Section */}
          <div className="border-t-2 border-gray-300 pt-4 mb-3">
            <h3 className="text-xl font-bold text-gray-900 mb-3 uppercase text-center">How to Play</h3>
            <div className="grid grid-cols-2 gap-3 text-sm text-gray-700">
              <div className="flex items-start space-x-2">
                <span className="text-2xl">⚽</span>
                <div>
                  <p className="font-bold text-gray-900">Pick One Team</p>
                  <p>Choose one team to win each round</p>
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-2xl">🏆</span>
                <div>
                  <p className="font-bold text-gray-900">Win = Survive</p>
                  <p>Your team wins, you advance to next round</p>
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-2xl">❌</span>
                <div>
                  {data.competition.lives_per_player === 0 ? (
                    <>
                      <p className="font-bold text-gray-900">Draw or Loss = Out</p>
                      <p>Your team draws or loses, you&apos;re eliminated</p>
                    </>
                  ) : (
                    <>
                      <p className="font-bold text-gray-900">Wrong Result Costs a Life</p>
                      <p>Out at zero lives</p>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-2xl">🚫</span>
                <div>
                  <p className="font-bold text-gray-900">No Repeats</p>
                  <p>Can&apos;t pick the same team twice</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-xs text-gray-500 border-t border-gray-200 pt-3">
            <p className="font-semibold text-gray-700">Powered by LMS Local &bull; www.lmslocal.co.uk</p>
            <p className="text-xs">The easiest way to run Last Man Standing competitions</p>
          </div>

        </div>
      </div>
    </>
  );
}
