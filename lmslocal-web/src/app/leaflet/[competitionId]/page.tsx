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

// App store URLs
const IOS_APP_URL = 'https://apps.apple.com/gb/app/lms-local/id6755344736';
const ANDROID_APP_URL = 'https://play.google.com/store/apps/details?id=uk.co.lmslocal.lmslocal_flutter';

export default function LeafletPage() {
  const params = useParams();
  const router = useRouter();
  const competitionId = params.competitionId as string;

  const [data, setData] = useState<LeafletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [iosQrCodeUrl, setIosQrCodeUrl] = useState<string>('');
  const [androidQrCodeUrl, setAndroidQrCodeUrl] = useState<string>('');

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

          // Generate QR codes for both app stores
          try {
            // iOS App Store QR code
            const iosDataUrl = await QRCode.toDataURL(IOS_APP_URL, {
              width: 400,
              margin: 2,
              color: {
                dark: '#000000',
                light: '#FFFFFF'
              }
            });
            setIosQrCodeUrl(iosDataUrl);

            // Android Play Store QR code
            const androidDataUrl = await QRCode.toDataURL(ANDROID_APP_URL, {
              width: 400,
              margin: 2,
              color: {
                dark: '#000000',
                light: '#FFFFFF'
              }
            });
            setAndroidQrCodeUrl(androidDataUrl);

            console.log('QR Codes generated successfully');
          } catch (qrError) {
            console.error('Error generating QR codes:', qrError);
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

          {/* Download App Section - Full Width with Two QR Codes */}
          <div className="border-4 border-gray-900 p-4 bg-gray-50 mb-4">
            <h3 className="text-2xl font-black text-gray-900 mb-3 uppercase text-center">Download the App</h3>

            <div className="grid grid-cols-2 gap-4">
              {/* iOS QR Code */}
              <div className="flex flex-col items-center">
                <div className="border-2 border-gray-300 p-3 bg-white rounded-lg mb-2">
                  {iosQrCodeUrl ? (
                    <Image src={iosQrCodeUrl} alt="iOS App Store QR Code" width={140} height={140} className="mx-auto" unoptimized />
                  ) : (
                    <div className="w-[140px] h-[140px] bg-gray-200 animate-pulse mx-auto"></div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* Apple Logo SVG */}
                  <svg className="w-6 h-6" viewBox="0 0 384 512" fill="currentColor">
                    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
                  </svg>
                  <div>
                    <p className="text-sm font-bold text-gray-900">iPhone / iPad</p>
                    <p className="text-xs text-gray-500">App Store</p>
                  </div>
                </div>
              </div>

              {/* Android QR Code */}
              <div className="flex flex-col items-center">
                <div className="border-2 border-gray-300 p-3 bg-white rounded-lg mb-2">
                  {androidQrCodeUrl ? (
                    <Image src={androidQrCodeUrl} alt="Google Play QR Code" width={140} height={140} className="mx-auto" unoptimized />
                  ) : (
                    <div className="w-[140px] h-[140px] bg-gray-200 animate-pulse mx-auto"></div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* Google Play Logo SVG */}
                  <svg className="w-6 h-6" viewBox="0 0 512 512" fill="currentColor">
                    <path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z"/>
                  </svg>
                  <div>
                    <p className="text-sm font-bold text-gray-900">Android</p>
                    <p className="text-xs text-gray-500">Google Play</p>
                  </div>
                </div>
              </div>
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

            {/* Join Instructions */}
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-gray-900 uppercase">How to Join</h3>
              <ol className="space-y-3 text-base text-gray-700">
                <li className="flex items-start">
                  <span className="font-bold mr-2 text-gray-900">1.</span>
                  <span>Download or open the <strong>LMS Local</strong> app</span>
                </li>
                <li className="flex items-start">
                  <span className="font-bold mr-2 text-gray-900">2.</span>
                  <span>Tap <strong>Join Competition</strong>, enter code: <strong className="text-lg">{data.competition.invite_code}</strong></span>
                </li>
                <li className="flex items-start">
                  <span className="font-bold mr-2 text-gray-900">3.</span>
                  <span>Tap <strong>PLAY</strong> to start!</span>
                </li>
              </ol>
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

          {/* Download App Section - Full Width with Two QR Codes */}
          <div className="border-4 border-gray-900 p-4 bg-gray-50 mb-4">
            <h3 className="text-2xl font-black text-gray-900 mb-3 uppercase text-center">Download the App</h3>

            <div className="grid grid-cols-2 gap-4">
              {/* iOS QR Code */}
              <div className="flex flex-col items-center">
                <div className="border-2 border-gray-300 p-3 bg-white rounded-lg mb-2">
                  {iosQrCodeUrl && (
                    <Image src={iosQrCodeUrl} alt="iOS App Store QR Code" width={140} height={140} className="mx-auto" unoptimized />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* Apple Logo SVG */}
                  <svg className="w-6 h-6" viewBox="0 0 384 512" fill="currentColor">
                    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
                  </svg>
                  <div>
                    <p className="text-sm font-bold text-gray-900">iPhone / iPad</p>
                    <p className="text-xs text-gray-500">App Store</p>
                  </div>
                </div>
              </div>

              {/* Android QR Code */}
              <div className="flex flex-col items-center">
                <div className="border-2 border-gray-300 p-3 bg-white rounded-lg mb-2">
                  {androidQrCodeUrl && (
                    <Image src={androidQrCodeUrl} alt="Google Play QR Code" width={140} height={140} className="mx-auto" unoptimized />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* Google Play Logo SVG */}
                  <svg className="w-6 h-6" viewBox="0 0 512 512" fill="currentColor">
                    <path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z"/>
                  </svg>
                  <div>
                    <p className="text-sm font-bold text-gray-900">Android</p>
                    <p className="text-xs text-gray-500">Google Play</p>
                  </div>
                </div>
              </div>
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

            {/* Join Instructions */}
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-gray-900 uppercase">How to Join</h3>
              <ol className="space-y-3 text-base text-gray-700">
                <li className="flex items-start">
                  <span className="font-bold mr-2 text-gray-900">1.</span>
                  <span>Download or open the <strong>LMS Local</strong> app</span>
                </li>
                <li className="flex items-start">
                  <span className="font-bold mr-2 text-gray-900">2.</span>
                  <span>Tap <strong>Join Competition</strong>, enter code: <strong className="text-lg">{data.competition.invite_code}</strong></span>
                </li>
                <li className="flex items-start">
                  <span className="font-bold mr-2 text-gray-900">3.</span>
                  <span>Tap <strong>PLAY</strong> to start!</span>
                </li>
              </ol>
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
