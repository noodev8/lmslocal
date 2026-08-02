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
import { adminApi, clearSession, getToken, getAdmin, AdminStats, AdminUser } from '@/lib/api';

// One number plus its label. `hint` is for the qualifier that stops a number being misread.
function StatCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: 'default' | 'warn';
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p
        className={`mt-1 text-3xl font-semibold tabular-nums ${
          tone === 'warn' && value > 0 ? 'text-amber-600' : 'text-slate-900'
        }`}
      >
        {value.toLocaleString()}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
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
      setError('Could not reach the server. Is it running on port 3015?');
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
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="font-semibold text-slate-900">LMSLocal Admin</h1>
            {admin && <p className="text-xs text-slate-500">{admin.email}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadStats}
              disabled={loading}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Refresh
            </button>
            <button
              onClick={handleSignOut}
              className="rounded-md px-3 py-1.5 text-sm text-slate-500 transition hover:text-slate-900"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {error && (
          <div className="mb-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {loading && !stats && <p className="text-sm text-slate-500">Loading...</p>}

        {stats && (
          <>
            <Section title="Competitions">
              <StatCard label="Total" value={stats.competitions.total} />
              <StatCard
                label="Active"
                value={stats.competitions.active}
                hint="currently running"
              />
              <StatCard
                label="Setup"
                value={stats.competitions.setup}
                hint="created, not started"
              />
              <StatCard label="Complete" value={stats.competitions.complete} />
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
              />
              <StatCard
                label="Memberships"
                value={stats.players.total_memberships}
                hint="one per competition joined"
              />
              <StatCard label="Still in" value={stats.players.still_in} />
              <StatCard label="Eliminated" value={stats.players.eliminated} />
            </Section>

            <Section title="Accounts">
              <StatCard label="Registered" value={stats.users.total} />
              <StatCard label="Verified" value={stats.users.verified} />
              <StatCard
                label="New"
                value={stats.users.new_last_30_days}
                hint="last 30 days"
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
