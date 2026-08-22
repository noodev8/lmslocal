'use client';

/*
=======================================================================================================================================
Admin Dashboard
=======================================================================================================================================
Purpose: How many real people are on the platform. The first screen of the admin tool, and
         deliberately nothing more than that.

It carried sixteen numbers across four cards and four panels, and most of them were competition
counts the Competitions screen now answers better - that screen excludes stalled competitions and
this one did not, so the two disagreed: 16 active here against 14 there. Duplicated figures that
drift apart are worse than no figures.

What is left is the one thing that lives nowhere else: registered people, split by whether
anything ever came of the signup. Seven numbers, one screen, no overlap with the workspaces in
the nav.
=======================================================================================================================================
*/

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowPathIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import AdminHeader from '@/components/AdminHeader';
import { adminApi, getToken, AdminStats, apiBaseUrl } from '@/lib/api';

const TONES = {
  default: 'from-indigo-500 to-cyan-400',
  warn: 'from-amber-500 to-orange-400',
  good: 'from-emerald-500 to-teal-400',
  neutral: 'from-slate-500 to-slate-400',
} as const;

// One of the four numbers along the top. Clickable where there is a screen behind it.
function HeadlineCard({
  label,
  value,
  hint,
  tone = 'default',
  href,
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: keyof typeof TONES;
  href?: string;
}) {
  const content = (
    <>
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${TONES[tone]}`} />
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1.5 text-3xl font-semibold tabular-nums text-slate-900">
        {value.toLocaleString()}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      {href && (
        <ChevronRightIcon className="absolute right-3 top-4 h-4 w-4 text-slate-300 transition group-hover:text-indigo-400" />
      )}
    </>
  );
  const className =
    'group relative block overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md';

  return href ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

// A titled panel of label/number rows. Rows with an href behave as links.
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <h2 className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
        {title}
      </h2>
      <dl className="divide-y divide-slate-100">{children}</dl>
    </section>
  );
}

function Row({
  label,
  value,
  hint,
  href,
  highlight,
}: {
  label: string;
  value: number;
  hint?: string;
  href?: string;
  /* Draws the eye when the number means something needs doing - and only when it is non-zero. */
  highlight?: boolean;
}) {
  const on = highlight && value > 0;
  const inner = (
    <>
      <dt className="min-w-0">
        <span className={`text-sm ${on ? 'font-medium text-amber-700' : 'text-slate-700'}`}>{label}</span>
        {hint && <span className="ml-2 text-xs text-slate-400">{hint}</span>}
      </dt>
      <dd
        className={`shrink-0 text-sm font-semibold tabular-nums ${
          on ? 'text-amber-600' : 'text-slate-900'
        }`}
      >
        {value.toLocaleString()}
      </dd>
    </>
  );
  const className = `flex items-center justify-between gap-3 px-4 py-2.5 ${
    href ? 'transition hover:bg-slate-50' : ''
  }`;

  return href ? (
    <Link href={href} className={className}>
      {inner}
    </Link>
  ) : (
    <div className={className}>{inner}</div>
  );
}

export default function DashboardPage() {
  const router = useRouter();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await adminApi.getStats();

      if (result.return_code === 'SUCCESS' && result.users) {
        // The admin tool and the server deploy separately, so a build of this page can briefly
        // be talking to a server that predates it. genuine/wasters/lurkers are the newest
        // fields here - fall back to zeros rather than crashing on a missing one.
        setStats({
          ...(result as AdminStats),
          organisers: result.organisers ?? { total: 0, paying: 0, with_active_competition: 0 },
          users: {
            total: result.users?.total ?? 0,
            new_last_30_days: result.users?.new_last_30_days ?? 0,
            guests: result.users?.guests ?? 0,
            genuine: result.users?.genuine ?? 0,
            wasters: result.users?.wasters ?? 0,
            returned: result.users?.returned ?? 0,
            signup_only: result.users?.signup_only ?? 0,
          },
        });
      } else if (result.return_code !== 'UNAUTHORIZED' && result.return_code !== 'TOKEN_EXPIRED') {
        // Auth failures are handled by the response interceptor, which redirects to /login
        setError(result.message || 'Could not load statistics');
      }
    } catch {
      setError(`Could not reach ${apiBaseUrl}. The server may be down, or this site's address may not be in the server's CORS allowlist (CLIENT_URL).`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    loadStats();
  }, [router, loadStats]);

  return (
    <div className="min-h-screen">
      <AdminHeader>
        <button
          onClick={loadStats}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
        >
          <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </AdminHeader>

      <main className="mx-auto max-w-7xl px-4 py-8">
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && !stats && <p className="text-sm text-slate-500">Loading...</p>}

        {stats && (
          <>
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {/*
                The headline is genuine people, not "Registered". Registered counted every signup
                that ever happened, and a quarter of it had never joined or organised anything -
                which made the one number this screen exists for the one number you could not
                trust. It is still here, as the hint and in the panel, because the gap between
                the two is itself worth seeing.
              */}
              <HeadlineCard
                label="Genuine people"
                value={stats.users.genuine}
                hint={`of ${stats.users.total.toLocaleString()} registered`}
                tone="good"
              />
              <HeadlineCard
                label="Wasters"
                value={stats.users.wasters}
                hint="never joined, not seen in 30 days"
                tone="warn"
              />
              {/*
                Live, not all-time. Every person who has ever joined anything only ever rises -
                one finished competition of 52 sat in that figure for months and made the
                platform look busier than it was. All-time is the hint.
              */}
              <HeadlineCard
                label="In a live competition"
                value={stats.players.players_in_live_competition}
                hint={`of ${stats.players.unique_players.toLocaleString()} who ever joined`}
                tone="default"
              />
            </div>

            {/* Only what is NOT already a card above - a number repeated twice on one screen is
                a number you have to check against itself. */}
            <Panel title="Registered accounts">
              <Row
                label="Registered"
                hint="every signup, genuine or not"
                value={stats.users.total}
              />
              <Row
                label="New in 30 days"
                hint="registered recently"
                value={stats.users.new_last_30_days}
              />
              {/*
                The two halves of "genuine because we have seen them, and nothing else" - neither
                has joined or organised anything. They were one row reading "Coming back, never
                joined", which was untrue of most of it: last_active_at was the registration
                itself for nineteen of the twenty-seven. Split, both rows are true and they say
                different things - one is a nudge worth sending, the other is a signup that never
                started.
              */}
              <Row
                label="Came back, never joined"
                hint="returned after signing up, but has not joined anything"
                value={stats.users.returned}
                highlight
              />
              <Row
                label="Signed up, never seen since"
                hint="not been back since registering"
                value={stats.users.signup_only}
              />
              {/*
                Guests are real people and are counted in the players figure above, but the
                account is created by joining and dies with the competition, so it is not a
                signup and is not in "Registered".
              */}
              <Row
                label="Guests"
                hint="joined without registering"
                value={stats.users.guests}
              />
            </Panel>

            <p className="mt-6 text-xs text-slate-400">
              Snapshot taken {new Date(stats.generated_at).toLocaleString('en-GB')}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
