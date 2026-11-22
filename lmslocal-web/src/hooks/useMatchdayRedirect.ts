'use client';

/*
The Last Man Standing player pages (pick, standings, player-results) are the other game's screens.
A Matchday competition reaching one - an old bookmark, a link in an LMS email, a typed URL - would
render an LMS screen over refusals from the server's LMS routes (docs/matchday.md §7.3). This sends
it to the Matchday screen that answers the same question instead (§8.4).

Read from AppDataContext rather than fetched: the competition list is already loaded on every
/game/[id] screen, and a page that has to ask the server which game it is before redirecting
would flash the wrong screen first.
*/

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppData } from '@/contexts/AppDataContext';

/**
 * @param competitionId - the [id] route param
 * @param matchdayPath - where this page's question is answered for Matchday, e.g. 'coupon'
 * @returns true while a redirect is under way, so the page can render nothing meanwhile
 */
export function useMatchdayRedirect(competitionId: string, matchdayPath: 'coupon' | 'table'): boolean {
  const router = useRouter();
  const { competitions } = useAppData();
  const competition = competitions?.find(c => c.id.toString() === competitionId);
  const isMatchday = competition?.game_type === 'matchday';

  useEffect(() => {
    if (isMatchday) router.replace(`/game/${competitionId}/${matchdayPath}`);
  }, [isMatchday, competitionId, matchdayPath, router]);

  return isMatchday;
}
