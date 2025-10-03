'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import {
  ArrowLeftIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  BellIcon,
  BellSlashIcon
} from '@heroicons/react/24/outline';
import { userApi, type EmailPreferences } from '@/lib/api';
import { logout } from '@/lib/auth';

interface ProfileForm {
  display_name: string;
}

interface PasswordForm {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

interface User {
  id: number;
  email?: string;
  display_name: string;
  is_managed: boolean;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [dashboardLink, setDashboardLink] = useState('/dashboard');
  const [emailPrefs, setEmailPrefs] = useState<EmailPreferences | null>(null);
  const [loadingPrefs, setLoadingPrefs] = useState(false);
  const [emailPrefsChanged, setEmailPrefsChanged] = useState<EmailPreferences | null>(null);
  const [savingEmailPrefs, setSavingEmailPrefs] = useState(false);
  const [emailPrefsSaveSuccess, setEmailPrefsSaveSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty }
  } = useForm<ProfileForm>();

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    reset: resetPassword,
    watch,
    formState: { errors: passwordErrors }
  } = useForm<PasswordForm>();

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      router.push('/login');
      return;
    }

    // Get user info from localStorage (or could fetch from API)
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        reset({ display_name: userData.display_name });
      } catch (error) {
        console.error('Failed to parse user data:', error);
        logout(router);
      }
    }

    // All users now go to unified dashboard
    setDashboardLink('/dashboard');
    setLoading(false);

    // Load email preferences
    loadEmailPreferences();
  }, [router, reset]);

  const loadEmailPreferences = async () => {
    setLoadingPrefs(true);
    try {
      const response = await userApi.getEmailPreferences();
      if (response.data.return_code === 'SUCCESS' && response.data.preferences) {
        setEmailPrefs(response.data.preferences);
      }
    } catch (error) {
      console.error('Failed to load email preferences:', error);
    } finally {
      setLoadingPrefs(false);
    }
  };

  const toggleEmailPreference = (competition_id: number, email_type: string | null, currentValue: boolean) => {
    // Update local state (don't save to API yet)
    const updatedPrefs = emailPrefsChanged || emailPrefs;
    if (!updatedPrefs) return;

    const newPrefs: EmailPreferences = JSON.parse(JSON.stringify(updatedPrefs));

    if (competition_id === 0) {
      // Global preference
      if (email_type === 'all') {
        const newAllValue = !currentValue;
        newPrefs.global.all_emails = newAllValue;

        // When turning OFF "all emails", turn off all sub-preferences too
        if (!newAllValue) {
          newPrefs.global.pick_reminder = false;
          newPrefs.global.results = false;
          newPrefs.competition_specific.forEach(comp => {
            comp.all_emails = false;
          });
        } else {
          // When turning ON "all emails", turn on competition toggles (but leave sub-preferences as they were)
          newPrefs.competition_specific.forEach(comp => {
            comp.all_emails = true;
          });
        }
      } else if (email_type === 'pick_reminder') {
        const newValue = !currentValue;
        newPrefs.global.pick_reminder = newValue;
        // If turning ON a sub-preference, automatically turn ON "all emails" too
        if (newValue) {
          newPrefs.global.all_emails = true;
        }
      } else if (email_type === 'results') {
        const newValue = !currentValue;
        newPrefs.global.results = newValue;
        // If turning ON a sub-preference, automatically turn ON "all emails" too
        if (newValue) {
          newPrefs.global.all_emails = true;
        }
      }
    } else {
      // Competition-specific preference
      const compIndex = newPrefs.competition_specific.findIndex(c => c.competition_id === competition_id);
      if (compIndex !== -1) {
        if (email_type === null) {
          // Toggle "mute all emails for this competition"
          newPrefs.competition_specific[compIndex].all_emails = !currentValue;
        }
      }
    }

    setEmailPrefsChanged(newPrefs);
  };

  const saveEmailPreferences = async () => {
    if (!emailPrefsChanged) return;

    setSavingEmailPrefs(true);
    setEmailPrefsSaveSuccess(false);

    try {
      // Collect all changes to send
      const updates = [];

      // Global preferences
      updates.push({ competition_id: 0, email_type: 'all', enabled: emailPrefsChanged.global.all_emails });
      updates.push({ competition_id: 0, email_type: 'pick_reminder', enabled: emailPrefsChanged.global.pick_reminder });
      updates.push({ competition_id: 0, email_type: 'results', enabled: emailPrefsChanged.global.results });

      // Competition-specific preferences
      for (const comp of emailPrefsChanged.competition_specific) {
        updates.push({ competition_id: comp.competition_id, email_type: null, enabled: comp.all_emails });
      }

      // Send all updates in a single batch request
      const response = await userApi.updateEmailPreferencesBatch(updates);
      if (response.data.return_code !== 'SUCCESS') {
        throw new Error(response.data.message || 'Failed to update preferences');
      }

      // Update saved state and clear changed state
      setEmailPrefs(emailPrefsChanged);
      setEmailPrefsChanged(null);

      // Show success indicator
      setEmailPrefsSaveSuccess(true);
      setTimeout(() => setEmailPrefsSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save email preferences:', error);
      alert('Failed to save email preferences. Please try again.');
    } finally {
      setSavingEmailPrefs(false);
    }
  };


  const onSubmit = async (data: ProfileForm) => {
    if (!user || !isDirty) return;

    setSaving(true);
    setSaveSuccess(false);

    try {
      const response = await userApi.updateProfile({
        display_name: data.display_name.trim()
      });

      if (response.data.return_code === 'SUCCESS') {
        // Update stored user data
        const updatedUser = { ...user, display_name: data.display_name.trim() };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        // Reset form dirty state
        reset({ display_name: data.display_name.trim() });
        
        // Show success indicator
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        alert(`Failed to update profile: ${response.data.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Profile update error:', error);
      alert('Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const onPasswordSubmit = async (data: PasswordForm) => {
    if (!user || user.is_managed) return;

    setChangingPassword(true);
    setPasswordSuccess(false);

    try {
      const response = await userApi.changePassword(data.current_password, data.new_password);

      if (response.data.return_code === 'SUCCESS') {
        // Clear password form
        resetPassword();
        
        // Show success indicator
        setPasswordSuccess(true);
        setTimeout(() => setPasswordSuccess(false), 3000);
      } else {
        alert(`Failed to change password: ${response.data.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Password change error:', error);
      alert('Failed to change password. Please try again.');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || user.is_managed || deleteConfirmation !== 'DELETE_MY_ACCOUNT') return;

    setDeletingAccount(true);

    try {
      const response = await userApi.deleteAccount(deleteConfirmation);

      if (response.data.return_code === 'SUCCESS') {
        // Clear all local storage and redirect to home page
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('user');
        router.push('/');
      } else {
        alert(`Failed to delete account: ${response.data.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Delete account error:', error);
      alert('Failed to delete account. Please try again.');
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleLogout = () => {
    logout(router);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b border-slate-700"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <Link 
              href={dashboardLink} 
              className="inline-flex items-center text-slate-500 hover:text-slate-700"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="p-4 sm:p-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Your Profile</h2>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Display Name */}
              <div>
                <label htmlFor="display_name" className="block text-sm font-medium text-slate-700 mb-2">
                  Display Name
                </label>
                <input
                  {...register('display_name', {
                    required: 'Display name is required',
                    minLength: {
                      value: 2,
                      message: 'Display name must be at least 2 characters'
                    },
                    maxLength: {
                      value: 100,
                      message: 'Display name must be 100 characters or less'
                    }
                  })}
                  type="text"
                  className="block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-slate-500 focus:border-slate-500 sm:text-sm"
                  placeholder="Your display name"
                  disabled={saving}
                />
                {errors.display_name && (
                  <p className="mt-1 text-sm text-red-600">{errors.display_name.message}</p>
                )}
              </div>

              {/* Email (read-only) */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={user.email || 'No email'}
                  className="block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm bg-slate-50 text-slate-500 sm:text-sm"
                  disabled
                />
                <p className="mt-1 text-xs text-slate-500">
                  {user.is_managed ? 'Managed player account' : 'Email cannot be changed'}
                </p>
              </div>

              {/* Save Button */}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving || !isDirty}
                  className="inline-flex items-center px-4 py-2 bg-slate-600 text-white rounded-md font-medium hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Saving...
                    </>
                  ) : saveSuccess ? (
                    <>
                      <CheckIcon className="h-4 w-4 mr-2" />
                      Saved!
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Email Preferences Section */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 mt-6">
          <div className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-medium text-slate-900">Email Notifications</h3>
                <p className="text-sm text-slate-500 mt-1">Manage your email preferences</p>
              </div>
              {loadingPrefs && (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-slate-600"></div>
              )}
            </div>

            {emailPrefs && (() => {
              const displayPrefs = emailPrefsChanged || emailPrefs;
              const hasChanges = emailPrefsChanged !== null;

              return (
                <div className="space-y-6">
                  {/* Global Preferences */}
                  <div>
                    <h4 className="text-sm font-medium text-slate-700 mb-3">Global Settings</h4>
                    <div className="space-y-3">
                      {/* All Emails Toggle */}
                      <div className="flex items-center justify-between py-2">
                        <div className="flex items-center">
                          {displayPrefs.global.all_emails ? (
                            <BellIcon className="h-5 w-5 text-slate-600 mr-3" />
                          ) : (
                            <BellSlashIcon className="h-5 w-5 text-slate-400 mr-3" />
                          )}
                          <div>
                            <p className="text-sm font-medium text-slate-900">All Email Notifications</p>
                            <p className="text-xs text-slate-500">Master switch for all emails</p>
                          </div>
                        </div>
                        <button
                          onClick={() => toggleEmailPreference(0, 'all', displayPrefs.global.all_emails)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            displayPrefs.global.all_emails ? 'bg-slate-600' : 'bg-slate-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              displayPrefs.global.all_emails ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Pick Reminder Toggle */}
                      <div className="flex items-center justify-between py-2">
                        <div className="flex items-center ml-8">
                          <p className="text-sm text-slate-700">Pick Reminders</p>
                        </div>
                        <button
                          onClick={() => toggleEmailPreference(0, 'pick_reminder', displayPrefs.global.pick_reminder)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            displayPrefs.global.pick_reminder ? 'bg-slate-600' : 'bg-slate-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              displayPrefs.global.pick_reminder ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Results Toggle */}
                      <div className="flex items-center justify-between py-2">
                        <div className="flex items-center ml-8">
                          <p className="text-sm text-slate-700">Results Notifications</p>
                        </div>
                        <button
                          onClick={() => toggleEmailPreference(0, 'results', displayPrefs.global.results)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            displayPrefs.global.results ? 'bg-slate-600' : 'bg-slate-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              displayPrefs.global.results ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Per-Competition Preferences - Only show when global emails are enabled */}
                  {displayPrefs.global.all_emails && displayPrefs.competition_specific && displayPrefs.competition_specific.length > 0 && (
                    <div className="pt-4 border-t border-slate-200">
                      <h4 className="text-sm font-medium text-slate-700 mb-1">Enable competition emails for:</h4>
                      <div className="space-y-2 mt-3">
                        {displayPrefs.competition_specific.map((comp) => (
                          <div key={comp.competition_id} className="flex items-center justify-between py-2">
                            <p className="text-sm text-slate-900">{comp.personal_name || comp.competition_name}</p>
                            <button
                              onClick={() => toggleEmailPreference(comp.competition_id, null, comp.all_emails)}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                comp.all_emails ? 'bg-slate-600' : 'bg-slate-300'
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  comp.all_emails ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Save Button */}
                  <div className="flex justify-end pt-4 border-t border-slate-200">
                    <button
                      onClick={saveEmailPreferences}
                      disabled={savingEmailPrefs || !hasChanges}
                      className="inline-flex items-center px-4 py-2 bg-slate-600 text-white rounded-md font-medium hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savingEmailPrefs ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Saving...
                        </>
                      ) : emailPrefsSaveSuccess ? (
                        <>
                          <CheckIcon className="h-4 w-4 mr-2" />
                          Saved!
                        </>
                      ) : (
                        'Update Notifications'
                      )}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Sign Out Section */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 mt-6">
          <div className="p-4 sm:p-6">
            <h3 className="text-lg font-medium text-slate-900 mb-4">Account Actions</h3>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-slate-600">
                  Sign out of your account on this device
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="px-6 py-3 bg-slate-600 text-white rounded-lg font-medium hover:bg-slate-700 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>

        {/* Change Password Section - Only for online users */}
        {!user.is_managed && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 mt-6">
            <div className="p-4 sm:p-6">
              <h3 className="text-lg font-medium text-slate-900 mb-4">Change Password</h3>

              <form onSubmit={handlePasswordSubmit(onPasswordSubmit)} className="space-y-4">
                {/* Current Password */}
                <div>
                  <label htmlFor="current_password" className="block text-sm font-medium text-slate-700 mb-1">
                    Current Password
                  </label>
                  <input
                    {...registerPassword('current_password', {
                      required: 'Current password is required'
                    })}
                    type="password"
                    className="block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-slate-500 focus:border-slate-500 sm:text-sm"
                    disabled={changingPassword}
                  />
                  {passwordErrors.current_password && (
                    <p className="mt-1 text-sm text-red-600">{passwordErrors.current_password.message}</p>
                  )}
                </div>

                {/* New Password */}
                <div>
                  <label htmlFor="new_password" className="block text-sm font-medium text-slate-700 mb-1">
                    New Password
                  </label>
                  <input
                    {...registerPassword('new_password', {
                      required: 'New password is required',
                      minLength: {
                        value: 6,
                        message: 'Password must be at least 6 characters long'
                      }
                    })}
                    type="password"
                    className="block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-slate-500 focus:border-slate-500 sm:text-sm"
                    disabled={changingPassword}
                  />
                  {passwordErrors.new_password && (
                    <p className="mt-1 text-sm text-red-600">{passwordErrors.new_password.message}</p>
                  )}
                </div>

                {/* Confirm New Password */}
                <div>
                  <label htmlFor="confirm_password" className="block text-sm font-medium text-slate-700 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    {...registerPassword('confirm_password', {
                      required: 'Please confirm your new password',
                      validate: (value) => {
                        const newPassword = watch('new_password');
                        return value === newPassword || 'Passwords do not match';
                      }
                    })}
                    type="password"
                    className="block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-slate-500 focus:border-slate-500 sm:text-sm"
                    disabled={changingPassword}
                  />
                  {passwordErrors.confirm_password && (
                    <p className="mt-1 text-sm text-red-600">{passwordErrors.confirm_password.message}</p>
                  )}
                </div>

                {/* Change Password Button */}
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={changingPassword}
                    className="inline-flex items-center px-4 py-2 bg-slate-600 text-white rounded-md font-medium hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {changingPassword ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Changing Password...
                      </>
                    ) : passwordSuccess ? (
                      <>
                        <CheckIcon className="h-4 w-4 mr-2" />
                        Password Changed!
                      </>
                    ) : (
                      'Change Password'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Danger Zone - Delete Account - Only for online users */}
        {!user.is_managed && (
          <div className="bg-red-50 border border-red-200 rounded-lg shadow-sm mt-6">
            <div className="p-4 sm:p-6">
              <h3 className="text-lg font-medium text-red-900 mb-2 flex items-center">
                <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
                Danger Zone
              </h3>
              <p className="text-sm text-red-700 mb-4">
                Delete your account and all associated data permanently. This action cannot be undone.
              </p>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-4 py-2 bg-slate-600 text-white rounded-md font-medium hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 transition-colors"
              >
                Delete My Account
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Delete Account Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-4 sm:p-6">
              <div className="flex items-center mb-4">
                <ExclamationTriangleIcon className="h-8 w-8 text-red-600 mr-3" />
                <h3 className="text-lg font-medium text-slate-900">Delete Account</h3>
              </div>
              
              <div className="mb-6">
                <p className="text-sm text-slate-700 mb-4">
                  <strong>This will permanently delete:</strong>
                </p>
                <ul className="text-sm text-slate-600 space-y-1 mb-4">
                  <li>• Your account and profile information</li>
                  <li>• All competitions you&apos;ve organized</li>
                  <li>• All your game picks and history</li>
                  <li>• All associated data from our servers</li>
                </ul>
                <p className="text-sm text-red-600 font-medium">
                  This action cannot be undone.
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Type <strong>DELETE_MY_ACCOUNT</strong> to confirm:
                </label>
                <input
                  type="text"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  className="block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm"
                  placeholder="DELETE_MY_ACCOUNT"
                  disabled={deletingAccount}
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteConfirmation('');
                  }}
                  disabled={deletingAccount}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deletingAccount || deleteConfirmation !== 'DELETE_MY_ACCOUNT'}
                  className="px-4 py-2 text-sm font-medium text-white bg-slate-600 rounded-md hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:opacity-50"
                >
                  {deletingAccount ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Deleting...
                    </div>
                  ) : (
                    'Delete My Account'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}