'use client';

/*
=======================================================================================================================================
Admin Header
=======================================================================================================================================
Purpose: The dark bar across the top of every signed-in admin page, plus the nav between them.

This markup used to be copy-pasted into each page. It was tolerable at two and stopped being so
at three, mostly because the nav has to know about every page - a link added in one copy and
forgotten in another is a page you can only reach by typing the URL.

Two shapes:
  - Root pages pass no backHref and get the brand mark and the signed-in address.
  - Drill-downs pass backHref and get a back arrow and their own title instead.

Laid out as two rows. Everything shared one row until there were three nav items plus a page
action plus Sign out, at which point the nav had to hide below sm: and a fourth item would have
had nowhere to go. Identity and session controls now sit on the top row and the nav gets a row
of its own, so it survives adding pages and stays visible on a phone.
=======================================================================================================================================
*/

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ShieldCheckIcon,
  ArrowLeftIcon,
  ArrowRightStartOnRectangleIcon,
} from '@heroicons/react/24/outline';
import { clearSession, getAdmin } from '@/lib/api';

const NAV = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/competitions', label: 'Competitions' },
  { href: '/dashboard/organisers', label: 'Organisers' },
  { href: '/dashboard/fixtures', label: 'Fixtures' },
  { href: '/dashboard/bots', label: 'Bots' },
  { href: '/dashboard/emails', label: 'Emails' },
];

export default function AdminHeader({
  title,
  backHref,
  children,
}: {
  title?: string;
  backHref?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const admin = getAdmin();

  const handleSignOut = () => {
    clearSession();
    router.replace('/login');
  };

  return (
    <header className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 pb-3 pt-4">
        <div className="flex items-center gap-3">
          {backHref ? (
            <>
              <Link
                href={backHref}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
                aria-label="Back"
              >
                <ArrowLeftIcon className="h-4 w-4" />
              </Link>
              <h1 className="font-semibold text-white">{title}</h1>
            </>
          ) : (
            <>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 shadow-lg shadow-indigo-950/50">
                <ShieldCheckIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-white">{title || 'LMSLocal Admin'}</h1>
                {admin && <p className="text-xs text-slate-400">{admin.email}</p>}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {children}

          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-slate-400 transition hover:text-white"
          >
            <ArrowRightStartOnRectangleIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>

      {/*
      Tabs sit on the page boundary rather than floating, so the active one reads as the page
      you are on. Scrolls sideways on a narrow screen instead of wrapping or disappearing.
      */}
      <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4">
        {NAV.map((item) => {
          // Exact match only - /dashboard would otherwise light up on every child route.
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap rounded-t-lg border-b-2 px-3 py-2 text-sm transition ${
                active
                  ? 'border-indigo-400 font-medium text-white'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
