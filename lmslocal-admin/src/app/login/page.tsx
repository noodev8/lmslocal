'use client';

/*
=======================================================================================================================================
Admin Login
=======================================================================================================================================
Purpose: Sign in to the admin tool using an existing LMSLocal account that has is_admin set.
         The server refuses non-admin accounts with a generic INVALID_CREDENTIALS, so this
         page never reveals whether an address is an administrator.
=======================================================================================================================================
*/

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheckIcon } from '@heroicons/react/24/solid';
import { adminApi, saveSession, getToken } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Already signed in? Skip straight through.
  // Reading location directly rather than useSearchParams keeps this page out of a
  // Suspense boundary, which Next would otherwise require at build time.
  useEffect(() => {
    if (getToken()) {
      router.replace('/dashboard');
      return;
    }
    if (window.location.search.includes('expired=1')) {
      setError('Your session expired. Please sign in again.');
    }
  }, [router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const result = await adminApi.login(email, password);

      if (result.return_code === 'SUCCESS' && result.token && result.admin) {
        saveSession(result.token, result.admin);
        router.replace('/dashboard');
        return;
      }

      setError(result.message || 'Sign in failed');
    } catch {
      // Network level failure - the server itself answers 200 for auth failures
      setError('Could not reach the server. Is it running on port 3015?');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-indigo-600/30 blur-3xl" />
        <div className="absolute bottom-[-12rem] right-[-8rem] h-[28rem] w-[28rem] rounded-full bg-cyan-500/20 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-400 shadow-lg shadow-indigo-950/50">
            <ShieldCheckIcon className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-white">LMSLocal Admin</h1>
          <p className="mt-1 text-sm text-slate-400">Internal tool &middot; authorised access only</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/40 backdrop-blur-xl"
        >
          <label htmlFor="email" className="block text-sm font-medium text-slate-300">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 mb-4 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none transition focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
          />

          <label htmlFor="password" className="block text-sm font-medium text-slate-300">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none transition focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
          />

          {error && (
            <p className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 w-full rounded-lg bg-gradient-to-r from-indigo-500 to-cyan-400 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-950/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  );
}
