'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import Link from 'next/link';
import { TrophyIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { authApi, RegisterRequest } from '@/lib/api';

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
      const response = await authApi.register({
        ...data,
        display_name: data.name
      });
      
      if (response.data.return_code === 'SUCCESS') {
        setError(''); // Clear any previous errors
        setSuccess('Account created successfully! Please check your email and click the verification link before logging in.');
      } else {
        switch (response.data.return_code) {
          case 'EMAIL_EXISTS':
            setError('An account with this email already exists.');
            break;
          case 'WEAK_PASSWORD':
            setError('Password is too weak. Please choose a stronger password.');
            break;
          default:
            setError('Registration failed. Please try again.');
        }
      }
    } catch (err: unknown) {
      setError((err as {response?: {data?: {message?: string}}}).response?.data?.message || 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Header Section - Material 3 Style */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="p-3 bg-blue-50 rounded-2xl group-hover:bg-blue-100 transition-colors">
              <TrophyIcon className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">LMSLocal</h1>
              <p className="text-sm text-slate-500">Last Man Standing</p>
            </div>
          </Link>
        </div>
        
        <div className="text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-3">
            Create your account
          </h2>
          <p className="text-slate-600">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-semibold text-blue-600 hover:text-blue-700 transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Register Form - Material 3 Card */}
      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-4">
                <div className="text-sm text-red-700 font-medium">{error}</div>
              </div>
            )}

            {success && (
              <div className="rounded-xl bg-green-50 border border-green-200 p-4">
                <div className="text-sm text-green-700 font-medium">{success}</div>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="name" className="block text-sm font-semibold text-slate-900">
                Full name
              </label>
              <input
                id="name"
                {...register('name', {
                  required: 'Full name is required',
                  minLength: {
                    value: 2,
                    message: 'Name must be at least 2 characters'
                  }
                })}
                type="text"
                autoComplete="name"
                className="block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                placeholder="Enter your full name"
              />
              {errors.name && (
                <p className="text-sm text-red-600 font-medium">{errors.name.message}</p>
              )}
            </div>

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
                className="block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                placeholder="Enter your email"
              />
              {errors.email && (
                <p className="text-sm text-red-600 font-medium">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-semibold text-slate-900">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  {...register('password', {
                    required: 'Password is required',
                    minLength: {
                      value: 6,
                      message: 'Password must be at least 6 characters'
                    }
                  })}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  className="block w-full rounded-xl border border-slate-300 px-4 py-3 pr-12 text-slate-900 placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  placeholder="Create a password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 hover:text-slate-600 transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-red-600 font-medium">{errors.password.message}</p>
              )}
              <p className="text-xs text-slate-500">
                Must be at least 6 characters long
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="block text-sm font-semibold text-slate-900">
                Confirm password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  {...register('confirmPassword', {
                    required: 'Please confirm your password',
                    validate: (value) =>
                      value === password || 'The passwords do not match'
                  })}
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  className="block w-full rounded-xl border border-slate-300 px-4 py-3 pr-12 text-slate-900 placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  placeholder="Confirm your password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 hover:text-slate-600 transition-colors"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeSlashIcon className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-sm text-red-600 font-medium">{errors.confirmPassword.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-3"></div>
                  Creating account...
                </>
              ) : (
                'Create account'
              )}
            </button>
          </form>

          {/* Terms and Privacy */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <p className="text-xs text-slate-500 text-center leading-relaxed">
              By creating an account, you agree to our{' '}
              <a href="https://www.noodev8.com/terms-of-service/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 font-medium">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="https://www.noodev8.com/privacy-policy/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 font-medium">
                Privacy Policy
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}