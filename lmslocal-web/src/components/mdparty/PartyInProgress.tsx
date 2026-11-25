'use client';

/*
  "Your Matchday Party game is in progress" - a line at the top of the dashboard (2026-11-25).

  A party is not a competition, so it has no card on the dashboard; without this, the only way back
  into a game in play was through Create competition. It reads the game this device remembers
  (mdparty_session, set by /mdparty) and shows only while that game is live and unfinished. The TV
  link is for the host; another player just gets back to their game.
*/

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { partyApi } from '@/lib/api';
import { LABEL } from '@/lib/design';

const SESSION_KEY = 'mdparty_session';

export default function PartyInProgress() {
  const [game, setGame] = useState<{ code: string; isHost: boolean; round: number; of: number } | null>(null);

  useEffect(() => {
    let saved: { code: string; player_token: string } | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    } catch {
      saved = null;
    }
    if (!saved) return;
    partyApi.state(saved.code, saved.player_token)
      .then((res) => {
        const d = res.data;
        if (d.return_code !== 'SUCCESS' || !d.room || d.room.state === 'finished' || !d.me) return;
        setGame({ code: d.room.code, isHost: d.me.is_host, round: d.room.current_round, of: d.room.rounds_total });
      })
      .catch(() => {});
  }, []);

  if (!game) return null;

  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border border-ink/30 bg-stock-lit px-5 py-4">
      <p className="text-[16px]">
        Your Matchday Party game <span className="font-data">{game.code}</span> is in progress
        {game.round > 0 && <> &middot; round {game.round} of {game.of}</>}.
      </p>
      <span className="flex items-center gap-5">
        {game.isHost && (
          <a href={`/mdparty/tv?code=${game.code}`} target="_blank" rel="noopener noreferrer" className={`${LABEL} text-ink-fade underline decoration-dotted underline-offset-4 hover:text-ink`}>
            Open TV screen &#8599;
          </a>
        )}
        <Link href="/mdparty" className={`${LABEL} text-ink underline decoration-dotted underline-offset-4 hover:text-overprint`}>
          Back to the game &rarr;
        </Link>
      </span>
    </div>
  );
}
