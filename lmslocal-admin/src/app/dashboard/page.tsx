'use client';

/*
=======================================================================================================================================
Admin Dashboard
=======================================================================================================================================
Purpose: Platform-wide snapshot - competition counts by status, player participation, and
         account totals. First screen of the admin tool; fixtures, competition drill-down and
         bulk email will hang off this shell.
=======================================================================================================================================
*/

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheckIcon,
  ArrowPathIcon,
  ArrowRightStartOnRectangleIcon,
} from '@heroicons/react/24/outline';
import { adminApi, clearSession, getToken, getAdmin, AdminStats, AdminUser, apiBaseUrl } from '@/lib/api';

const TONES = {
  default: 'from-indigo-500 to-cyan-400',
  warn: 'from-amber-500 to-orange-400',
  good: 'from-emerald-500 to-teal-400',
  neutral: 'from-slate-500 to-slate-400',
} as const;

// One number plus its label. `hint` is for the qualifier that stops a number being misread.
function StatCard({
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
  const highlight = tone === 'warn' && value > 0;
  const content = (
    <>
      <div
        className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${
          highlight ? TONES.warn : TONES[tone]
        }`}
      />
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p
        className={`mt-1.5 text-3xl font-semibold tabular-nums ${
          highlight ? 'text-amber-600' : 'text-slate-900'
        }`}
      >
        {value.toLocaleString()}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </>
  );
  const className =
    'group relative block overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md';

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }
  return <div className={className}>{content}</div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
        <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
        {title}
      </h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{children}</div>
    </section>
  );
}

export default function DashboardPage() {
  const router = useRouter();

  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await adminApi.getStats();

      if (result.return_code === 'SUCCESS' && result.competitions) {
        setStats(result as AdminStats);
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
    setAdmin(getAdmin());
    loadStats();
  }, [router, loadStats]);

  const handleSignOut = () => {
    clearSession();
    router.replace('/login');
  };

  return (
    <div className="min-h-screen">
      <header className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 shadow-lg shadow-indigo-950/50">
              <ShieldCheckIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-white">LMSLocal Admin</h1>
              {admin && <p className="text-xs text-slate-400">{admin.email}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadStats}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
            >
              <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-slate-400 transition hover:text-white"
            >
              <ArrowRightStartOnRectangleIcon className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && !stats && <p className="text-sm text-slate-500">Loading...</p>}

        {stats && (
          <>
            <Section title="Competitions">
              <StatCard
                label="Total"
                value={stats.competitions.total}
                tone="neutral"
                href="/dashboard/competitions"
              />
              <StatCard
                label="Active"
                value={stats.competitions.active}
                hint="currently running"
                tone="good"
                href="/dashboard/competitions?status=active"
              />
              <StatCard
                label="Setup"
                value={stats.competitions.setup}
                hint="created, not started"
                tone="default"
                href="/dashboard/competitions?status=setup"
              />
              <StatCard
                label="Complete"
                value={stats.competitions.complete}
                tone="neutral"
                href="/dashboard/competitions?status=complete"
              />
            </Section>

            <Section title="Needs attention">
              <StatCard
                label="Inactive"
                value={stats.competitions.inactive}
                hint="active but no picks in 30 days"
                tone="warn"
              />
            </Section>

            <Section title="Players">
              <StatCard
                label="Unique players"
                value={stats.players.unique_players}
                hint="distinct people"
                tone="default"
              />
              <StatCard
                label="Memberships"
                value={stats.players.total_memberships}
                hint="one per competition joined"
                tone="neutral"
              />
              <StatCard label="Still in" value={stats.players.still_in} tone="good" />
              <StatCard label="Eliminated" value={stats.players.eliminated} tone="warn" />
            </Section>

            <Section title="Accounts">
              <StatCard label="Registered" value={stats.users.total} tone="neutral" />
              <StatCard label="Verified" value={stats.users.verified} tone="good" />
              <StatCard
                label="New"
                value={stats.users.new_last_30_days}
                hint="last 30 days"
                tone="default"
              />
            </Section>

            <p className="text-xs text-slate-400">
              Snapshot taken {new Date(stats.generated_at).toLocaleString('en-GB')}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
