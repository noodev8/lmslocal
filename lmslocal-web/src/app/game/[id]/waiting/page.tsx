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
import { LABEL, EYEBROW, HEADING, PANEL } from '@/lib/design';

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
      <div className="min-h-screen bg-stock font-body text-ink">
        <header className="border-b border-ink/30">
          <div className="mx-auto flex max-w-3xl items-center px-4 py-4 sm:px-6">
            <Link href={`/game/${competitionId}`} className={`${LABEL} flex items-center gap-1.5 text-ink-fade transition-colors hover:text-ink`}>
              <ArrowLeftIcon className="h-4 w-4" />
              Dashboard
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <div className={`${PANEL} p-8 text-center`}>
            <div className="mb-4 inline-flex h-8 w-8 animate-spin items-center justify-center rounded-full border-2 border-ink border-t-transparent" />
            <p className={EYEBROW}>Loading</p>
            <p className="mt-2 text-[17px] text-ink-fade">Checking the competition status&hellip;</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stock font-body text-ink">
      <header className="border-b border-ink/30">
        <div className="mx-auto flex max-w-3xl items-center px-4 py-4 sm:px-6">
          <Link href={`/game/${competitionId}`} className={`${LABEL} flex items-center gap-1.5 text-ink-fade transition-colors hover:text-ink`}>
            <ArrowLeftIcon className="h-4 w-4" />
            Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <p className={EYEBROW}>{competition.name}</p>

        <div className={`${PANEL} mt-4 p-8 text-center`}>
          <ClockIcon className="mx-auto h-8 w-8 text-ink-fade" />
          <p className={`${HEADING} mt-4 text-2xl`}>Waiting for the next round</p>
          <p className="mt-2 text-[15px] text-ink-fade">
            Matches haven&apos;t been set yet. This page will move on as soon as they&apos;re in.
          </p>
        </div>
      </main>
    </div>
  );
}
