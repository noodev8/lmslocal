'use client';

import { useState, useEffect, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { TrophyIcon, ArrowLeftIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { authApi } from '@/lib/api';

interface ResetPasswordForm {
  new_password: string;
  confirm_password: string;
}

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm<ResetPasswordForm>();

  const password = watch('new_password');

  useEffect(() => {
    const tokenParam = searchParams.get('token');
    if (!tokenParam) {
      setError('Invalid reset link. Please request a new password reset.');
    } else {
      setToken(tokenParam);
    }
  }, [searchParams]);

  const onSubmit = async (data: ResetPasswordForm) => {
    if (!token) {
      setError('Invalid reset link');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await authApi.resetPassword(token, data.new_password);

      if (response.data.return_code === 'SUCCESS') {
        setSuccess(true);
        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      } else {
        // Handle specific error codes
        if (response.data.return_code === 'TOKEN_EXPIRED') {
          setError('This reset link has expired. Please request a new one.');
        } else if (response.data.return_code === 'INVALID_TOKEN') {
          setError('Invalid reset link. Please request a new password reset.');
        } else {
          setError(response.data.message || 'Failed to reset password');
        }
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-6 sm:py-12 px-4 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 text-center">
            <div className="flex justify-center mb-6">
              <CheckCircleIcon className="h-12 w-12 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Password Reset Successful!</h2>
            <p className="text-slate-600 mb-6">
              Your password has been reset successfully. You can now log in with your new password.
            </p>
            <p className="text-sm text-slate-500 mb-6">
              Redirecting to login page in 3 seconds...
            </p>
            <Link
              href="/login"
              className="inline-flex items-center text-slate-600 hover:text-slate-800 font-medium"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-1" />
              Go to Login Now
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-6 sm:py-12 px-4 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 text-center">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Invalid Reset Link</h2>
            <p className="text-slate-600 mb-6">
              This password reset link is invalid or has been used already.
            </p>
            <Link
              href="/forgot-password"
              className="inline-flex items-center text-slate-600 hover:text-slate-800 font-medium"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-1" />
              Request New Reset Link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-6 sm:py-12 px-4 sm:px-6 lg:px-8">
      {/* Header Section */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-6 sm:mb-8">
          <Link href="/" className="flex items-center space-x-2 sm:space-x-3 group">
            <div className="p-3 bg-slate-100 rounded-2xl group-hover:bg-slate-200 transition-colors">
              <TrophyIcon className="h-8 w-8 text-slate-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">LMSLocal</h1>
              <p className="text-sm text-slate-500">Last Man Standing</p>
            </div>
          </Link>
        </div>

        <div className="text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-3">
            Set your new password
          </h2>
          <p className="text-slate-600">
            Enter a new password for your account.
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="mt-6 sm:mt-10 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-4">
                <div className="text-sm text-red-700 font-medium">{error}</div>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="new_password" className="block text-sm font-semibold text-slate-900">
                New Password
              </label>
              <input
                id="new_password"
                {...register('new_password', {
                  required: 'Password is required',
                  minLength: {
                    value: 6,
                    message: 'Password must be at least 6 characters'
                  }
                })}
                type="password"
                autoComplete="new-password"
                className="block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/20 transition-all"
                placeholder="Enter new password"
              />
              {errors.new_password && (
                <p className="text-sm text-red-600 font-medium">{errors.new_password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="confirm_password" className="block text-sm font-semibold text-slate-900">
                Confirm New Password
              </label>
              <input
                id="confirm_password"
                {...register('confirm_password', {
                  required: 'Please confirm your password',
                  validate: value =>
                    value === password || 'Passwords do not match'
                })}
                type="password"
                autoComplete="new-password"
                className="block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/20 transition-all"
                placeholder="Confirm new password"
              />
              {errors.confirm_password && (
                <p className="text-sm text-red-600 font-medium">{errors.confirm_password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center rounded-xl bg-slate-800 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-3"></div>
                  Resetting password...
                </>
              ) : (
                'Reset password'
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100">
            <div className="text-center">
              <Link
                href="/login"
                className="inline-flex items-center text-slate-600 hover:text-slate-800 font-medium"
              >
                <ArrowLeftIcon className="h-4 w-4 mr-1" />
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-300 border-t-slate-800"></div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
