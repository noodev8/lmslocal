'use client';

/*
=======================================================================================================================================
Admin Dashboard
=======================================================================================================================================
Purpose: Platform-wide snapshot - competitions, organisers, players and accounts. The first
         screen of the admin tool and a reference point rather than a workspace: the day-to-day
         work happens on the Competitions, Organisers and Fixtures screens in the nav.

Laid out as four headline numbers and four compact breakdown panels. It was twelve equal tiles
in four stacked sections, which pushed accounts below the fold and gave "Eliminated" the same
visual weight as the total number of competitions. Headline first, detail underneath, one screen.
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

      if (result.return_code === 'SUCCESS' && result.competitions) {
        // The organisers block was added after this screen shipped. The admin tool and the
        // server deploy separately, so a build of this page can briefly be talking to a server
        // that predates it - fall back to zeros rather than crashing on a missing object.
        setStats({
          ...(result as AdminStats),
          organisers: result.organisers ?? { total: 0, paying: 0, with_active_competition: 0 },
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
            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <HeadlineCard
                label="Competitions"
                value={stats.competitions.total}
                hint={`${stats.competitions.active} running`}
                tone="default"
                href="/dashboard/competitions"
              />
              <HeadlineCard
                label="Organisers"
                value={stats.organisers.total}
                hint={`${stats.organisers.paying} paying`}
                tone="good"
                href="/dashboard/organisers"
              />
              <HeadlineCard
                label="Players"
                value={stats.players.unique_players}
                hint="distinct people"
                tone="default"
              />
              <HeadlineCard
                label="Accounts"
                value={stats.users.total}
                hint={`${stats.users.new_last_30_days} new in 30 days`}
                tone="neutral"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Competitions">
                <Row
                  label="Active"
                  hint="currently running"
                  value={stats.competitions.active}
                  href="/dashboard/competitions?status=active"
                />
                <Row
                  label="Setup"
                  hint="created, not started"
                  value={stats.competitions.setup}
                  href="/dashboard/competitions?status=setup"
                />
                <Row
                  label="Complete"
                  value={stats.competitions.complete}
                  href="/dashboard/competitions?status=complete"
                />
                <Row
                  label="Inactive"
                  hint="active but no picks in 30 days"
                  value={stats.competitions.inactive}
                  highlight
                />
              </Panel>

              {/*
                No Organisers or Accounts panel. Every row they held was either already on a
                headline card (organisers total/paying, accounts registered/new) or told us
                nothing - "Verified" has equalled "Registered" since verification became
                mandatory. Only the two panels below carry numbers the cards do not.
              */}
              <Panel title="Players">
                <Row
                  label="Memberships"
                  hint="one per competition joined"
                  value={stats.players.total_memberships}
                />
                <Row label="Still in" value={stats.players.still_in} />
                <Row label="Eliminated" value={stats.players.eliminated} />
              </Panel>
            </div>

            <p className="mt-6 text-xs text-slate-400">
              Snapshot taken {new Date(stats.generated_at).toLocaleString('en-GB')}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
