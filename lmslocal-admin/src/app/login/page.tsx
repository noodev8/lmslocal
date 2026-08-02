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
import { adminApi, saveSession, getToken, apiBaseUrl } from '@/lib/api';

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
      setError(`Could not reach ${apiBaseUrl}. The server may be down, or this site's address may not be in the server's CORS allowlist (CLIENT_URL).`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900">
            <ShieldCheckIcon className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">LMSLocal Admin</h1>
          <p className="mt-1 text-sm text-slate-500">Internal tool &middot; authorised access only</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <label htmlFor="email" className="block text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
          />

          <label htmlFor="password" className="block text-sm font-medium text-slate-700">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
          />

          {error && (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  );
}
