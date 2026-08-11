'use client';

/*
Every /game/[id]/* screen finds its competition the same way: look for the id in the list
AppDataContext holds. When it isn't there, all of them used to render a spinner forever, because
"not loaded yet" and "loaded, and it isn't here" are the same thing to `competitions?.find(...)`.

The list is legitimately empty in three ordinary cases - signed out, signed in as someone else,
and a competition since deleted - and the first is the one that reached real organisers: every
competition email links into one of these pages, and opening one on a device without a session
left them stuck. With no token in localStorage AppDataContext never calls the API at all, so no
UNAUTHORIZED comes back and none of the expiry handling fires.

This is a hook rather than three copies because the third copy is where the cases drift apart.
*/

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppData } from '@/contexts/AppDataContext';
import { isAuthenticated } from '@/lib/auth';
import type { Competition } from '@/lib/api';

interface CompetitionGate {
  competition: Competition | undefined;
  /** The list has resolved and this competition is not in it. Render CompetitionUnavailable. */
  unavailable: boolean;
}

export function useCompetitionGate(competitionId: string): CompetitionGate {
  const router = useRouter();
  const { competitions, loading } = useAppData();

  const competition = useMemo(
    () => competitions?.find((c) => c.id.toString() === competitionId),
    [competitions, competitionId]
  );

  const [unavailable, setUnavailable] = useState(false);

  /*
  An effect rather than a derived value because it reads localStorage and can navigate, neither of
  which a render may do. `competitions === null` means the context never fetched - which for a
  signed-out visitor is the normal resting state, not a failure.
  */
  useEffect(() => {
    if (competition || loading) {
      setUnavailable(false);
      return;
    }

    if (competitions === null && !isAuthenticated()) {
      // The link still says where they were going, so come back to it after signing in rather
      // than dropping them on the dashboard to find it themselves.
      const returnTo = `${window.location.pathname}${window.location.search}`;
      router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }

    setUnavailable(true);
  }, [competition, competitions, loading, router]);

  return { competition, unavailable };
}
