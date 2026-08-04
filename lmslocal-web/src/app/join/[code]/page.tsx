'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { authApi, userApi, competitionApi, cacheUtils } from '@/lib/api';
import { setAuthData } from '@/lib/auth';
import { LABEL, EYEBROW } from '@/lib/design';

/**
 * The join page. A player arrives here with a code — from the landing page strip, a poster, a
 * WhatsApp message, or the join_url the promote screen hands organisers.
 *
 * The order matters: look the code up FIRST and show them what they are joining, then deal with
 * identity. Making someone create an account before telling them whether their code is even real
 * means a typo costs them the whole journey.
 *
 * Session state is never assumed from localStorage. If the join call comes back unauthorised, the
 * sign-in form appears in place — a stale token is just "you are logged out", handled here, with
 * the code still safe in the URL.
 */

type Competition = {
  id: number;
  name: string;
  venue_name: string | null;
  organiser_name: string | null;
  player_count: number;
  can_join: boolean;
  closed_reason: string | null;
};

type Stage = 'looking-up' | 'not-found' | 'closed' | 'ready' | 'lookup-failed';

/** 'navigating' means a full page load is already under way — leave the button busy. */
type JoinOutcome = 'navigating' | 'signed-out' | 'failed';

export default function JoinPage() {
  const params = useParams();
  const code = decodeURIComponent(String(params?.code ?? '')).toUpperCase();

  const [stage, setStage] = useState<Stage>('looking-up');
  const [competition, setCompetition] = useState<Competition | null>(null);

  // Identity: we only believe we are signed in once the server agrees, but we
  // still name whoever the stored session claims to be — "not you?" is
  // meaningless unless the page says who it thinks you are.
  const [hasSession, setHasSession] = useState(false);
  const [sessionLabel, setSessionLabel] = useState<{ name: string; email: string } | null>(null);
  const [mode, setMode] = useState<'create' | 'signin'>('create');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [busy, setBusy] = useState(false);
  // Held true through the page load that follows a successful join, so the button
  // never springs back to looking clickable while the browser is still working.
  const [navigating, setNavigating] = useState(false);
  const [formError, setFormError] = useState('');

  // ---------------------------------------------------------------- lookup
  useEffect(() => {
    if (!code) {
      setStage('not-found');
      return;
    }

    const token = localStorage.getItem('jwt_token');
    setHasSession(!!token);

    if (token) {
      try {
        const stored = JSON.parse(localStorage.getItem('user') || 'null');
        if (stored) {
          setSessionLabel({
            name: stored.display_name || stored.email || 'your account',
            email: stored.email || ''
          });
        }
      } catch {
        setSessionLabel(null);
      }
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await competitionApi.getByCode(code);
        if (cancelled) return;

        if (res.data.return_code === 'SUCCESS' && res.data.competition) {
          setCompetition(res.data.competition);
          setStage(res.data.competition.can_join ? 'ready' : 'closed');
        } else if (res.data.return_code === 'COMPETITION_NOT_FOUND') {
          setStage('not-found');
        } else {
          setStage('lookup-failed');
        }
      } catch {
        if (!cancelled) setStage('lookup-failed');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code]);

  // ---------------------------------------------------------------- joining
  /** Joins with whatever session we have. Returns false if the server says we are not signed in. */
  const attemptJoin = useCallback(async (): Promise<JoinOutcome> => {
    try {
      const res = await userApi.joinCompetitionByCode(code);
      const rc = res.data.return_code;

      if (rc === 'SUCCESS' || rc === 'ALREADY_JOINED') {
        const id = res.data.competition?.id ?? competition?.id;
        cacheUtils.clearAll();
        // Full navigation, not router.push. The competition page reads from
        // AppDataContext, which still holds the pre-join list — a client-side
        // push leaves it looking for a competition that is not there yet and
        // spinning forever. Reloading rebuilds the context from scratch, which
        // is what the dashboard's own join does too.
        window.location.href = id ? `/game/${id}` : '/dashboard';
        return 'navigating';
      }

      if (rc === 'UNAUTHORIZED') return 'signed-out';

      setFormError(res.data.message || 'Could not join this competition.');
      return 'failed';
    } catch (err) {
      // The axios interceptor clears the session on a 401; treat it as signed out
      if ((err as { response?: { status?: number } })?.response?.status === 401) return 'signed-out';
      setFormError('Could not join this competition. Please try again.');
      return 'failed';
    }
  }, [code, competition?.id]);

  const onJoinAsSelf = async () => {
    setBusy(true);
    setFormError('');
    const outcome = await attemptJoin();

    if (outcome === 'navigating') {
      setNavigating(true);
      return; // stay busy until the browser leaves the page
    }

    if (outcome === 'signed-out') {
      // Stale token — fall back to the form rather than bouncing anywhere
      setHasSession(false);
      setSessionLabel(null);
      setMode('signin');
      setFormError('Your session has expired. Sign in and we will get you straight in.');
    }
    setBusy(false);
  };

  const onSubmitIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError('');

    try {
      if (mode === 'create') {
        if (!acceptTerms) {
          setFormError('Please accept the terms and privacy policy to continue.');
          setBusy(false);
          return;
        }

        const reg = await authApi.register({
          name,
          display_name: name,
          email,
          password,
          confirmPassword: password,
          acceptTerms
        });

        if (reg.data.return_code !== 'SUCCESS') {
          setFormError(
            reg.data.return_code === 'EMAIL_EXISTS'
              ? 'There is already an account with that email. Sign in instead.'
              : 'Could not create your account. Please try again.'
          );
          if (reg.data.return_code === 'EMAIL_EXISTS') setMode('signin');
          setBusy(false);
          return;
        }
      }

      // Registration does not issue a token, so sign in either way
      const login = await authApi.login({ email, password });
      if (login.data.return_code !== 'SUCCESS') {
        setFormError(
          login.data.return_code === 'INVALID_CREDENTIALS'
            ? 'That email and password do not match an account.'
            : 'Could not sign you in. Please try again.'
        );
        setBusy(false);
        return;
      }

      cacheUtils.clearAll();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setAuthData(login.data.token as string, login.data.user as any);
      window.dispatchEvent(new CustomEvent('auth-success'));

      const outcome = await attemptJoin();
      if (outcome === 'navigating') {
        setNavigating(true);
        return; // stay busy until the browser leaves the page
      }
      setBusy(false);
    } catch {
      setFormError('Something went wrong. Please try again.');
      setBusy(false);
    }
  };

  // ---------------------------------------------------------------- chrome
  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-stock font-body text-ink">
      <header className="border-b border-ink/30">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link
            href="/"
            className="font-display text-2xl font-semibold uppercase tracking-[0.1em] text-ink"
          >
            LMSLocal
          </Link>
          <Link href="/help" className={`${LABEL} text-ink-fade transition-colors hover:text-ink`}>
            Help
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">{children}</main>
    </div>
  );

  const inputClass =
    'mt-2 block w-full rounded-sm border border-ink/40 bg-stock-lit px-3 py-2.5 text-[17px] text-ink placeholder:text-ink-fade/70 focus:border-ink focus:outline-none';

  // ---------------------------------------------------------------- states
  if (stage === 'looking-up') {
    return shell(
      <p className={`${LABEL} text-ink-fade`}>Looking up {code}…</p>
    );
  }

  if (stage === 'not-found' || stage === 'lookup-failed') {
    const notFound = stage === 'not-found';
    return shell(
      <div>
        <p className={`${EYEBROW} text-overprint`}>{notFound ? 'No match' : 'Try again'}</p>
        <h1 className="mt-4 font-display text-5xl font-semibold uppercase leading-[0.9] text-ink sm:text-6xl">
          {notFound ? 'That code is not working' : 'We could not check that code'}
        </h1>
        <p className="mt-6 max-w-lg text-xl leading-relaxed text-ink">
          {notFound ? (
            <>
              Nothing is open under <span className="font-data font-bold">{code || '—'}</span>.
              Either it has been typed wrong, or that competition has already started — codes stop
              working the moment round one locks.
            </>
          ) : (
            'Something went wrong at our end, not yours. Give it a moment and try again.'
          )}
        </p>
        <p className="mt-4 max-w-lg text-[17px] leading-relaxed text-ink-fade">
          {notFound
            ? 'Worth checking with whoever gave it to you. Nothing has been created and no account was set up.'
            : 'Nothing has been created and no account was set up.'}
        </p>
        <div className="mt-8">
          <Link
            href="/"
            className="inline-block rounded-sm bg-overprint px-7 py-3.5 font-display text-2xl uppercase tracking-[0.06em] text-stock-lit transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Try another code
          </Link>
        </div>
      </div>
    );
  }

  if (stage === 'closed' && competition) {
    const isFull = competition.closed_reason === 'FULL';
    const organiser = competition.organiser_name ?? 'your organiser';
    return shell(
      <div>
        <p className={`${EYEBROW} text-overprint`}>{isFull ? 'No room' : 'Closed'}</p>
        <h1 className="mt-4 font-display text-5xl font-semibold uppercase leading-[0.9] text-ink sm:text-6xl">
          {isFull ? `${competition.name} is full` : `${competition.name} has started`}
        </h1>
        <p className="mt-6 max-w-lg text-xl leading-relaxed text-ink">
          {isFull ? (
            <>
              {organiser} has taken on as many players as their competitions can hold at the moment.
              Let them know you are trying to join — they can make room from their end.
            </>
          ) : (
            <>
              Round one has locked, so nobody else can join this one. Ask {organiser} to let you
              know when the next competition opens.
            </>
          )}
        </p>
        {isFull && (
          <p className="mt-4 max-w-lg text-[17px] leading-relaxed text-ink-fade">
            Nothing has gone wrong at your end, and no account has been created.
          </p>
        )}
        <div className="mt-8">
          <Link href="/" className={`${LABEL} text-ink underline decoration-dotted underline-offset-[6px]`}>
            Back to LMSLocal
          </Link>
        </div>
      </div>
    );
  }

  if (!competition) return shell(null);

  // ---------------------------------------------------------------- ready
  return shell(
    <div>
      <p className={`${EYEBROW} text-overprint`}>You have been invited</p>
      <h1 className="mt-4 font-display text-5xl font-semibold uppercase leading-[0.9] text-ink sm:text-6xl">
        {competition.name}
      </h1>

      <dl className="mt-7 border-y border-ink/30">
        {competition.venue_name && (
          <div className="flex items-baseline justify-between gap-4 border-b border-ink/30 py-3">
            <dt className={`${LABEL} text-ink-fade`}>Venue</dt>
            <dd className="font-data text-[15px] text-ink">{competition.venue_name}</dd>
          </div>
        )}
        {competition.organiser_name && (
          <div className="flex items-baseline justify-between gap-4 border-b border-ink/30 py-3">
            <dt className={`${LABEL} text-ink-fade`}>Run by</dt>
            <dd className="font-data text-[15px] text-ink">{competition.organiser_name}</dd>
          </div>
        )}
        <div className="flex items-baseline justify-between gap-4 border-b border-ink/30 py-3">
          <dt className={`${LABEL} text-ink-fade`}>Playing so far</dt>
          <dd className="font-data text-[15px] text-ink">{competition.player_count}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 py-3">
          <dt className={`${LABEL} text-ink-fade`}>Code</dt>
          <dd className="font-data text-[15px] font-bold tracking-widest text-ink">{code}</dd>
        </div>
      </dl>

      {formError && (
        <p className="mt-6 border-l-2 border-overprint bg-stock-lit px-4 py-3 text-[17px] text-ink">
          {formError}
        </p>
      )}

      {hasSession ? (
        <div className="mt-8">
          {sessionLabel && (
            <p className="mb-4 text-[17px] leading-relaxed text-ink">
              Signed in as <strong className="font-semibold">{sessionLabel.name}</strong>
              {sessionLabel.email && (
                <>
                  {' '}
                  <span className="font-data text-[15px] text-ink-fade">{sessionLabel.email}</span>
                </>
              )}
            </p>
          )}
          <button
            type="button"
            onClick={onJoinAsSelf}
            disabled={busy}
            aria-busy={busy}
            className="rounded-sm bg-overprint px-8 py-4 font-display text-2xl uppercase tracking-[0.06em] text-stock-lit transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            {navigating ? 'Taking you in…' : busy ? 'Joining…' : `Join ${competition.name}`}
          </button>
          <p className={`mt-4 text-[16px] text-ink-fade ${busy ? 'invisible' : ''}`}>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setHasSession(false);
                setSessionLabel(null);
                setMode('signin');
              }}
              className="underline decoration-dotted underline-offset-4 hover:text-ink"
            >
              Use a different account
            </button>
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmitIdentity} className="mt-8 max-w-md">
          <h2 className="font-display text-2xl uppercase tracking-[0.03em] text-ink">
            {mode === 'create' ? 'Create your account' : 'Sign in to join'}
          </h2>

          {mode === 'create' && (
            <label className="mt-5 block">
              <span className={`${LABEL} text-ink-fade`}>Your name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                className={inputClass}
                placeholder="How you appear on the sheet"
              />
            </label>
          )}

          <label className="mt-5 block">
            <span className={`${LABEL} text-ink-fade`}>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className={inputClass}
            />
          </label>

          <label className="mt-5 block">
            <span className={`${LABEL} text-ink-fade`}>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
              className={inputClass}
            />
          </label>

          {mode === 'create' && (
            <label className="mt-5 flex items-start gap-3">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-1 h-4 w-4 accent-overprint"
              />
              <span className="text-[16px] leading-relaxed text-ink">
                I agree to the{' '}
                <Link href="/terms" target="_blank" className="underline underline-offset-4">
                  terms
                </Link>{' '}
                and{' '}
                <Link href="/privacy" target="_blank" className="underline underline-offset-4">
                  privacy policy
                </Link>
                .
              </span>
            </label>
          )}

          <button
            type="submit"
            disabled={busy}
            aria-busy={busy}
            className="mt-7 w-full rounded-sm bg-overprint px-8 py-4 font-display text-2xl uppercase tracking-[0.06em] text-stock-lit transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            {navigating ? 'Taking you in…' : busy ? 'One moment…' : `Join ${competition.name}`}
          </button>

          <p className="mt-5 text-[16px] text-ink-fade">
            {mode === 'create' ? 'Already have an account? ' : 'Not got an account yet? '}
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'create' ? 'signin' : 'create');
                setFormError('');
              }}
              className="underline decoration-dotted underline-offset-4 hover:text-ink"
            >
              {mode === 'create' ? 'Sign in instead' : 'Create one'}
            </button>
          </p>
        </form>
      )}
    </div>
  );
}
