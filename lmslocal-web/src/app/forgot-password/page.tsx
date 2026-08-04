'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { authApi } from '@/lib/api';
import AuthShell, { authInput, authButton, Notice, AuthLink } from '@/components/public/AuthShell';
import { LABEL } from '@/lib/design';

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
        setError(response.data.message || 'Could not send the reset email. Please try again.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <AuthShell
        eyebrow="On its way"
        title="Check your email"
        intro="We have sent you a link to set a new password. It is good for one use."
        footer={
          <>
            Nothing arrived? Check the spam folder, or{' '}
            <AuthLink href="/help/support">get in touch</AuthLink>.
          </>
        }
      >
        <AuthLink href="/login">Back to sign in</AuthLink>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Password reset"
      title="Forgotten your password"
      intro="Give us the email you signed up with and we will send you a link to set a new one."
      footer={
        <>
          Remembered it? <AuthLink href="/login">Back to sign in</AuthLink>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)}>
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

        <button type="submit" disabled={isLoading} aria-busy={isLoading} className={`${authButton} mt-7`}>
          {isLoading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
    </AuthShell>
  );
}
