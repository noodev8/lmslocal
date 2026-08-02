'use client';

/*
Entry point - bounces to the dashboard or the login page depending on whether a token is
present. The real check happens server-side on every /admin/* call; this is only about
not flashing an empty dashboard at a signed-out user.
*/

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/api';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(getToken() ? '/dashboard' : '/login');
  }, [router]);

  return null;
}
