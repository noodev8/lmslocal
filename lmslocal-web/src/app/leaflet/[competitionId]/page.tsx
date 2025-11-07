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
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

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

          // Generate QR code - points to main site
          const qrUrl = 'https://lmslocal.co.uk';
          try {
            // Generate data URL for both screen and print
            const dataUrl = await QRCode.toDataURL(qrUrl, {
              width: 400,
              margin: 2,
              color: {
                dark: '#000000',
                light: '#FFFFFF'
              }
            });
            setQrCodeUrl(dataUrl);
            console.log('QR Code generated successfully');
          } catch (qrError) {
            console.error('Error generating QR code:', qrError);
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
          <div className="mb-6">
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
                    {data.competition.name}
                  </h1>
                  <p className="text-xl font-bold text-gray-700 uppercase tracking-wide">
                    Last Man Standing Competition
                  </p>
                </div>
              </div>
            ) : (
              // Centered layout without logo
              <div className="text-center">
                <h1 className="text-5xl font-black text-gray-900 mb-3 uppercase tracking-tight leading-tight">
                  {data.competition.name}
                </h1>
                <div className="w-24 h-1 bg-gray-900 mx-auto mb-4"></div>
                <p className="text-2xl font-bold text-gray-700 uppercase tracking-wide">
                  Last Man Standing Competition
                </p>
              </div>
            )}
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-2 gap-8 mb-8">

            {/* Left Column - Join Info */}
            <div className="space-y-6">

              {/* Access Code Box */}
              <div className="border-4 border-gray-900 p-6 text-center bg-gray-50">
                <p className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide">Access Code</p>
                <p className="text-4xl font-black text-gray-900 tracking-wider">
                  {data.competition.invite_code}
                </p>
              </div>

              {/* Join Instructions */}
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-gray-900 uppercase">How to Join</h3>
                <ol className="space-y-3 text-base text-gray-700">
                  <li className="flex items-start">
                    <span className="font-bold mr-2 text-gray-900">1.</span>
                    <div>
                      <div>Scan QR code or visit:</div>
                      <div className="text-sm font-mono mt-1">https://lmslocal.co.uk</div>
                    </div>
                  </li>
                  <li className="flex items-start">
                    <span className="font-bold mr-2 text-gray-900">2.</span>
                    <span>Press &quot;Join Competition&quot; and enter access code: <strong>{data.competition.invite_code}</strong></span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-bold mr-2 text-gray-900">3.</span>
                    <span>Press &quot;PLAY&quot; to start playing</span>
                  </li>
                </ol>
              </div>

              {/* Entry Details */}
              <div className="bg-gray-900 text-white p-4 rounded-lg">
                <h3 className="text-lg font-bold mb-2 uppercase">Competition Details</h3>
                <div className="space-y-1 text-sm">
                  <p><strong>Entry Fee:</strong> {data.competition.entry_fee ? `£${Number(data.competition.entry_fee).toFixed(2)}` : 'Contact organiser'}</p>
                  <p><strong>Starts:</strong> {data.competition.start_date || 'Check with organiser'}</p>
                  <p><strong>Prize:</strong> {data.competition.prize_structure || 'To be confirmed'}</p>
                </div>
              </div>
            </div>

            {/* Right Column - QR Code */}
            <div className="flex flex-col items-center justify-start">
              <div className="border-4 border-gray-900 p-6 bg-white">
                <p className="text-center font-bold text-gray-900 mb-3 uppercase text-sm">Scan to Join</p>
                {qrCodeUrl ? (
                  <Image src={qrCodeUrl} alt="QR Code" width={200} height={200} className="mx-auto" unoptimized />
                ) : (
                  <div className="w-[200px] h-[200px] bg-gray-200 animate-pulse mx-auto"></div>
                )}
              </div>
            </div>
          </div>

          {/* Rules Section */}
          <div className="border-t-2 border-gray-300 pt-6 mb-6">
            <h3 className="text-2xl font-bold text-gray-900 mb-4 uppercase text-center">How to Play</h3>
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-700">
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
          <div className="text-center text-sm text-gray-500 border-t border-gray-200 pt-4">
            <p className="font-semibold text-gray-700">Powered by LMS Local</p>
            <p className="text-xs mt-1">The easiest way to run Last Man Standing competitions</p>
          </div>

        </div>
      </div>

      {/* Print Version (Hidden on Screen) */}
      <div className="hidden print:block">
        <div className="leaflet-container">

          {/* Header */}
          <div className="mb-6">
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
                    {data.competition.name}
                  </h1>
                  <p className="text-xl font-bold text-gray-700 uppercase tracking-wide">
                    Last Man Standing Competition
                  </p>
                </div>
              </div>
            ) : (
              // Centered layout without logo
              <div className="text-center">
                <h1 className="text-5xl font-black text-gray-900 mb-3 uppercase tracking-tight leading-tight">
                  {data.competition.name}
                </h1>
                <div className="w-24 h-1 bg-gray-900 mx-auto mb-4"></div>
                <p className="text-2xl font-bold text-gray-700 uppercase tracking-wide">
                  Last Man Standing Competition
                </p>
              </div>
            )}
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-2 gap-8 mb-8">

            {/* Left Column - Join Info */}
            <div className="space-y-6">

              {/* Access Code Box */}
              <div className="border-4 border-gray-900 p-6 text-center bg-gray-50">
                <p className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide">Access Code</p>
                <p className="text-4xl font-black text-gray-900 tracking-wider">
                  {data.competition.invite_code}
                </p>
              </div>

              {/* Join Instructions */}
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-gray-900 uppercase">How to Join</h3>
                <ol className="space-y-3 text-base text-gray-700">
                  <li className="flex items-start">
                    <span className="font-bold mr-2 text-gray-900">1.</span>
                    <div>
                      <div>Scan QR code or visit:</div>
                      <div className="text-sm font-mono mt-1">https://lmslocal.co.uk</div>
                    </div>
                  </li>
                  <li className="flex items-start">
                    <span className="font-bold mr-2 text-gray-900">2.</span>
                    <span>Press &quot;Join Competition&quot; and enter access code: <strong>{data.competition.invite_code}</strong></span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-bold mr-2 text-gray-900">3.</span>
                    <span>Press &quot;PLAY&quot; to start playing</span>
                  </li>
                </ol>
              </div>

              {/* Entry Details */}
              <div className="bg-gray-900 text-white p-4 rounded-lg">
                <h3 className="text-lg font-bold mb-2 uppercase">Competition Details</h3>
                <div className="space-y-1 text-sm">
                  <p><strong>Entry Fee:</strong> {data.competition.entry_fee ? `£${Number(data.competition.entry_fee).toFixed(2)}` : 'Contact organiser'}</p>
                  <p><strong>Starts:</strong> {data.competition.start_date || 'Check with organiser'}</p>
                  <p><strong>Prize:</strong> {data.competition.prize_structure || 'To be confirmed'}</p>
                </div>
              </div>
            </div>

            {/* Right Column - QR Code */}
            <div className="flex flex-col items-center justify-start">
              <div className="border-4 border-gray-900 p-6 bg-white mb-4">
                <p className="text-center font-bold text-gray-900 mb-3 uppercase text-sm">Scan to Join</p>
                {qrCodeUrl && (
                  <Image src={qrCodeUrl} alt="QR Code" width={200} height={200} className="mx-auto" unoptimized />
                )}
              </div>
              <p className="text-xs text-gray-500 text-center max-w-[200px]">
                Scan to visit website
              </p>
            </div>
          </div>

          {/* Rules Section */}
          <div className="border-t-2 border-gray-300 pt-6 mb-6">
            <h3 className="text-2xl font-bold text-gray-900 mb-4 uppercase text-center">How to Play</h3>
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-700">
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
          <div className="text-center text-sm text-gray-500 border-t border-gray-200 pt-4">
            <p className="font-semibold text-gray-700">Powered by LMS Local</p>
            <p className="text-xs mt-1">The easiest way to run Last Man Standing competitions</p>
          </div>

        </div>
      </div>
    </>
  );
}
