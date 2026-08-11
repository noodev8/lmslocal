'use client';

/*
What a /game/[id]/* screen shows when the competition isn't on this account. Paired with
useCompetitionGate, which decides when that is true.

It names the signed-in email because that is what makes the page self-diagnosing: the person who
was forwarded the link, or who is on the venue's shared laptop, sees the reason at a glance
instead of guessing. Everyone else it tells nothing they didn't know.
*/

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { clearAuthData, getCurrentUser } from '@/lib/auth';
import { EYEBROW, HEADING, PANEL, BTN_PRIMARY, BTN_OUTLINE } from '@/lib/design';

export default function CompetitionUnavailable() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  // In an effect because localStorage does not exist while this prerenders.
  useEffect(() => {
    setEmail(getCurrentUser()?.email ?? null);
  }, []);

  const handleSwitchAccount = async () => {
    // Keep the destination across the switch, so signing in with the right account lands on the
    // page the link was pointing at rather than the dashboard.
    const returnTo = `${window.location.pathname}${window.location.search}`;

    clearAuthData();
    const { cacheUtils } = await import('@/lib/cache');
    cacheUtils.clearAll();
    // No `expired` flag: this is a deliberate sign-out, and the flag is what turns the event into
    // a redirect to /login. This navigates itself, and two redirects would race.
    window.dispatchEvent(new CustomEvent('auth-expired'));

    router.push(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  };

  return (
    <div className="min-h-screen bg-stock font-body text-ink">
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <p className={EYEBROW}>Competition</p>
        <h1 className={`${HEADING} mt-1 text-3xl`}>We can&rsquo;t show this one</h1>

        <div className={`${PANEL} mt-5 p-6`}>
          {/* Deliberately vague about which case this is: from here they look identical, and
              guessing out loud ("someone deleted it") would be wrong more often than right. */}
          <p className="text-[15px] text-ink-fade">
            It isn&rsquo;t on {email ? <span className="font-data text-ink">{email}</span> : 'this account'}.
            It may belong to a different sign-in, or it may have been removed.
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/dashboard" className={`${BTN_PRIMARY} inline-flex px-6 py-3 text-base`}>
              Go to your competitions
            </Link>
            <button type="button" onClick={handleSwitchAccount} className={BTN_OUTLINE}>
              Sign in as someone else
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
