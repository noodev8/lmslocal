'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Wordmark from './Wordmark';
import { LABEL } from '@/lib/design';

/**
 * Header for every signed-out page. Built to the coupon design system — see
 * docs/design-system.md.
 *
 * Auth-aware in the mildest way: localStorage is only a hint here, used to
 * decide whether the last link reads "Dashboard" or "Sign in". Nothing on a
 * public page depends on it being right.
 */

type Props = {
  /** Set on the page the header sits on, so its own nav link is not shown. */
  current?: 'pricing' | 'help';
  /** Constrain to the narrower measure used by single-column pages. */
  width?: 'wide' | 'narrow';
};

export default function PublicHeader({ current, width = 'wide' }: Props) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem('jwt_token'));
  }, []);

  const measure = width === 'narrow' ? 'max-w-3xl' : 'max-w-6xl';

  return (
    <header className="border-b border-ink/30">
      <div className={`mx-auto flex ${measure} items-center justify-between gap-4 px-4 py-4 sm:px-6`}>
        <Wordmark />
        <nav className="flex items-center gap-5 sm:gap-7">
          {current !== 'pricing' && (
            <Link href="/pricing" className={`${LABEL} text-ink-fade transition-colors hover:text-ink`}>
              Pricing
            </Link>
          )}
          {current !== 'help' && (
            <Link
              href="/help"
              className={`${LABEL} hidden text-ink-fade transition-colors hover:text-ink sm:block`}
            >
              Help
            </Link>
          )}
          <Link
            href={isLoggedIn ? '/dashboard' : '/login'}
            className={`${LABEL} rounded-sm border border-ink px-3.5 py-2 text-ink transition-colors hover:bg-ink hover:text-stock-lit`}
          >
            {isLoggedIn ? 'Dashboard' : 'Sign in'}
          </Link>
        </nav>
      </div>
    </header>
  );
}
