'use client';

import { useState, useEffect, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter, useSearchParams } from 'next/navigation';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { authApi, LoginRequest } from '@/lib/api';
import { setAuthData } from '@/lib/auth';
import AuthShell, { authInput, authButton, Notice, AuthLink } from '@/components/public/AuthShell';
import { LABEL } from '@/lib/design';

/*
Where to land after signing in. Pages that need a session send the one they were on as `returnTo`,
so an emailed link opened on a signed-out device still reaches what it pointed at instead of
dumping the organiser on the dashboard to find it themselves.

Only a path on this site is accepted - it must start with a single slash. Anything else, including
a protocol-relative "//evil.example" that a browser reads as another host, falls back to the
dashboard. Without that check this parameter is an open redirect, and it arrives in a link we
email, which is exactly the shape phishing wants.
*/
const safeReturnTo = (value: string | null): string =>
  value && value.startsWith('/') && !value.startsWith('//') ? value : '/dashboard';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginRequest>();

  useEffect(() => {
    const message = searchParams.get('message');
    if (message) {
      setSuccessMessage(decodeURIComponent(message));
    }
  }, [searchParams]);

  const onSubmit = async (data: LoginRequest, e?: React.BaseSyntheticEvent) => {
    e?.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await authApi.login(data);

      if (response.data.return_code === 'SUCCESS') {
        if (typeof window !== 'undefined') {
          const { cacheUtils } = await import('@/lib/api');
          cacheUtils.clearAll();
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setAuthData(response.data.token as string, response.data.user as any);
        window.dispatchEvent(new CustomEvent('auth-success'));
        router.push(safeReturnTo(searchParams.get('returnTo')));
      } else {
        setError(
          response.data.return_code === 'INVALID_CREDENTIALS'
            ? 'That email and password do not match an account.'
            : 'Could not sign you in. Please try again.'
        );
      }
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Something went wrong. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in"
      intro="Manage your competitions, or make this week's pick."
      footer={
        <>
          Not got an account yet? <AuthLink href="/register">Create one</AuthLink>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(onSubmit)(e); }}>
        {successMessage && <Notice tone="success">{successMessage}</Notice>}
        {error && <Notice tone="error">{error}</Notice>}

        <label className="block">
          <span className={`${LABEL} text-ink-fade`}>Email</span>
          <input
            {...register('email', {
              required: 'Enter your email address',
              pattern: { value: /^\S+@\S+$/i, message: 'That does not look like an email address' }
            })}
            type="email"
            autoComplete="email"
            className={authInput}
          />
          {errors.email && <span className="mt-2 block text-[15px] text-overprint">{errors.email.message}</span>}
        </label>

        <label className="mt-5 block">
          <span className={`${LABEL} text-ink-fade`}>Password</span>
          <span className="relative block">
            <input
              {...register('password', {
                required: 'Enter your password',
                minLength: { value: 6, message: 'Passwords are at least 6 characters' }
              })}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              className={`${authInput} pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 mt-2 flex items-center pr-3 text-ink-fade transition-colors hover:text-ink"
            >
              {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
            </button>
          </span>
          {errors.password && (
            <span className="mt-2 block text-[15px] text-overprint">{errors.password.message}</span>
          )}
        </label>

        <p className="mt-3 text-[16px] text-ink-fade">
          <AuthLink href="/forgot-password">Forgotten your password?</AuthLink>
        </p>

        <button type="submit" disabled={isLoading} aria-busy={isLoading} className={`${authButton} mt-7`}>
          {isLoading ? 'Signing you in…' : 'Sign in'}
        </button>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
