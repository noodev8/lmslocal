'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { useAppData } from '@/contexts/AppDataContext';
import { roundApi, cacheUtils } from '@/lib/api';

export default function WaitingForFixtures() {
  const params = useParams();
  const router = useRouter();
  const competitionId = params.id as string;

  // Use AppDataProvider context for competitions data
  const { competitions, loading: contextLoading } = useAppData();

  // Find the specific competition
  const competition = competitions?.find(c => c.id.toString() === competitionId);

  useEffect(() => {
    const checkRoundsStatus = async () => {
      if (!competition) return;

      // Invalidate rounds cache to ensure fresh data on page load
      cacheUtils.invalidateKey(`rounds-${competitionId}`);

      try {
        const response = await roundApi.getRounds(parseInt(competitionId));

        if (response.data.return_code !== 'SUCCESS') {
          return; // Stay on waiting page
        }

        const rounds = response.data.rounds || [];

        if (rounds.length === 0) {
          return; // Stay on waiting page - no rounds yet
        }

        const latestRound = rounds[0];
        if (latestRound.fixture_count === 0) {
          return; // Stay on waiting page - no fixtures yet
        }

        // Fixtures exist! Redirect to appropriate page
        const now = new Date();
        const lockTime = new Date(latestRound.lock_time || '');
        const isLocked = !!(latestRound.lock_time && now >= lockTime);

        if (isLocked) {
          // Round is locked - show results view
          router.push(`/game/${competitionId}/player-results`);
        } else {
          // Round is unlocked - show pick screen
          router.push(`/game/${competitionId}/pick`);
        }
      } catch (error) {
        console.error('Error checking rounds:', error);
        // Stay on waiting page on error
      }
    };

    if (competition) {
      checkRoundsStatus();
    }
  }, [competition, competitionId, router]);
  
  if (contextLoading || !competition) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200 shadow-sm">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <Link href={`/game/${competitionId}`} className="flex items-center space-x-2 text-slate-600 hover:text-slate-800 transition-colors">
                  <ArrowLeftIcon className="h-5 w-5" />
                  <span className="font-medium">Back</span>
                </Link>
                <div className="h-6 w-px bg-slate-300" />
                <div>
                  <h1 className="text-lg font-semibold text-slate-900">Waiting for Fixtures</h1>
                </div>
              </div>
            </div>
          </div>
        </header>
        
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
            <div className="flex items-center justify-center">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-50 rounded-full mb-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-600 border-t-transparent"></div>
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">Loading</h3>
                <p className="text-slate-500">Please wait while we check the competition status...</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link href={`/game/${competitionId}`} className="flex items-center space-x-2 text-slate-600 hover:text-slate-800 transition-colors">
                <ArrowLeftIcon className="h-5 w-5" />
                <span className="font-medium">Back</span>
              </Link>
              <div className="h-6 w-px bg-slate-300" />
              <div>
                <h1 className="text-lg font-semibold text-slate-900">Waiting for Fixtures</h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Competition Name */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">{competition.name}</h1>
        </div>

        {/* Main Waiting Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6">
            <div className="flex items-center mb-4">
              <ClockIcon className="h-6 w-6 text-amber-600 mr-3" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Waiting for next round of fixtures</h2>
              </div>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}