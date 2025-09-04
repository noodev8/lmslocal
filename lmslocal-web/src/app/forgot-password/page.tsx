'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import Link from 'next/link';
import { TrophyIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { authApi } from '@/lib/api';

interface ForgotPasswordForm {
  email: string;
}

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<ForgotPasswordForm>();

  const onSubmit = async (data: ForgotPasswordForm) => {
    setIsLoading(true);
    setError('');

    try {
      const response = await authApi.forgotPassword(data.email);
      
      if (response.data.return_code === 'SUCCESS') {
        setSuccess(true);
      } else {
        setError(response.data.message || 'Failed to send reset email');
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
              <TrophyIcon className="h-12 w-12 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Check Your Email</h2>
            <p className="text-slate-600 mb-6">
              We&apos;ve sent a password reset link to your email address. Click the link in the email to reset your password.
            </p>
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
            Reset your password
          </h2>
          <p className="text-slate-600">
            Enter your email address and we&apos;ll send you a link to reset your password.
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
              <label htmlFor="email" className="block text-sm font-semibold text-slate-900">
                Email address
              </label>
              <input
                id="email"
                {...register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^\S+@\S+$/i,
                    message: 'Please enter a valid email address'
                  }
                })}
                type="email"
                autoComplete="email"
                className="block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/20 transition-all"
                placeholder="Enter your email"
              />
              {errors.email && (
                <p className="text-sm text-red-600 font-medium">{errors.email.message}</p>
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
                  Sending reset link...
                </>
              ) : (
                'Send reset link'
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