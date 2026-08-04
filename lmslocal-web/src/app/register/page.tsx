'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { authApi, RegisterRequest } from '@/lib/api';
import AuthShell, { authInput, authButton, Notice, AuthLink } from '@/components/public/AuthShell';
import { LABEL } from '@/lib/design';

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm<RegisterRequest>();

  const password = watch('password');

  const onSubmit = async (data: RegisterRequest) => {
    setIsLoading(true);
    setError('');

    try {
      const response = await authApi.register({ ...data, display_name: data.name });

      if (response.data.return_code === 'SUCCESS') {
        router.push('/login?message=Account created. Sign in to get going.');
        return;
      }

      switch (response.data.return_code) {
        case 'EMAIL_EXISTS':
          setError('There is already an account with that email. Sign in instead.');
          break;
        case 'WEAK_PASSWORD':
          setError('That password is too easy to guess. Try a longer one.');
          break;
        default:
          setError('Could not create your account. Please try again.');
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
      eyebrow="Get started"
      title="Create your account"
      intro="Twenty player places, free, for as long as you run it. No card needed to start."
      footer={
        <>
          Already have an account? <AuthLink href="/login">Sign in</AuthLink>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        {error && <Notice tone="error">{error}</Notice>}

        <label className="block">
          <span className={`${LABEL} text-ink-fade`}>Your name</span>
          <input
            {...register('name', {
              required: 'Enter your name',
              minLength: { value: 2, message: 'That is a little short' }
            })}
            type="text"
            autoComplete="name"
            placeholder="How you appear to your players"
            className={authInput}
          />
          {errors.name && <span className="mt-2 block text-[15px] text-overprint">{errors.name.message}</span>}
        </label>

        <label className="mt-5 block">
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
                required: 'Choose a password',
                minLength: { value: 6, message: 'Use at least 6 characters' }
              })}
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
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
          <span className="mt-2 block text-[15px] text-ink-fade">At least 6 characters.</span>
        </label>

        <label className="mt-5 block">
          <span className={`${LABEL} text-ink-fade`}>Confirm password</span>
          <input
            {...register('confirmPassword', {
              required: 'Type your password again',
              validate: (value) => value === password || 'Those two passwords do not match'
            })}
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            className={authInput}
          />
          {errors.confirmPassword && (
            <span className="mt-2 block text-[15px] text-overprint">{errors.confirmPassword.message}</span>
          )}
        </label>

        <label className="mt-6 flex items-start gap-3">
          <input
            {...register('acceptTerms', { required: 'Accept the terms to create an account' })}
            type="checkbox"
            className="mt-1 h-4 w-4 accent-overprint"
          />
          <span className="text-[16px] leading-relaxed text-ink">
            I agree to the <AuthLink href="/terms">terms</AuthLink> and{' '}
            <AuthLink href="/privacy">privacy policy</AuthLink>.
          </span>
        </label>
        {errors.acceptTerms && (
          <span className="mt-2 block text-[15px] text-overprint">{errors.acceptTerms.message}</span>
        )}

        <button type="submit" disabled={isLoading} aria-busy={isLoading} className={`${authButton} mt-7`}>
          {isLoading ? 'Creating your account…' : 'Create account'}
        </button>
      </form>
    </AuthShell>
  );
}
