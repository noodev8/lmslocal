'use client';

/*
=======================================================================================================================================
Admin Bridge
=======================================================================================================================================
Purpose: Landing page for lmslocal-admin's "View as organiser" feature. The admin tool opens
         this page in a new tab with a short-lived login token in the URL fragment (never sent
         to any server, unlike a query string) and this page's only job is to plant that token
         exactly the way a normal login would, then hand off to the competition.
=======================================================================================================================================
*/

import { useEffect, useState } from 'react';
import { setAuthData } from '@/lib/auth';
import type { User } from '@/lib/api';

export default function AdminBridgePage() {
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get('token');
    // URLSearchParams already percent-decodes values, so this is already plain JSON.
    const userRaw = params.get('user');
    const competitionId = params.get('competition_id');

    if (!token || !userRaw) {
      setError('This link is missing its login token.');
      return;
    }

    try {
      const user = JSON.parse(userRaw) as User;
      setAuthData(token, user);
      // Hard navigation, not router.replace - AppDataContext initialises once on first
      // mount of this page (with no token yet) and does not recheck localStorage on a
      // client-side route change, so a soft navigation leaves it stuck unauthenticated.
      window.location.href = competitionId ? `/game/${competitionId}` : '/dashboard';
    } catch {
      setError('This link is malformed.');
    }
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <p className="text-sm text-slate-500">{error || 'Signing in...'}</p>
    </main>
  );
}
