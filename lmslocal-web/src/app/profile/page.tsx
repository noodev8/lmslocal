'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import {
  ArrowLeftIcon,
  CheckIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { userApi, type Competition } from '@/lib/api';
import { logout } from '@/lib/auth';
import { invalidateCache } from '@/lib/cache';

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
  // Competition display names state
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loadingCompetitions, setLoadingCompetitions] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<number | null>(null);
  const [playerDisplayName, setPlayerDisplayName] = useState('');
  const [savingDisplayName, setSavingDisplayName] = useState(false);

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
  }, [router, reset]);


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

  // Load competitions for player display name management
  const loadCompetitions = async () => {
    setLoadingCompetitions(true);
    try {
      const response = await userApi.getUserDashboard();
      if (response.data.return_code === 'SUCCESS' && response.data.competitions) {
        // Only show competitions where user is a participant
        const participantCompetitions = response.data.competitions.filter(c => c.is_participant);
        setCompetitions(participantCompetitions);
      }
    } catch (error) {
      console.error('Failed to load competitions:', error);
    } finally {
      setLoadingCompetitions(false);
    }
  };

  // Open modal for managing player display name
  const handleManageNames = () => {
    loadCompetitions();
    setShowNameModal(true);
  };

  // Handle competition selection in modal
  const handleCompetitionSelect = (competitionId: number) => {
    setSelectedCompetitionId(competitionId);
    const competition = competitions.find(c => c.id === competitionId);
    if (competition) {
      setPlayerDisplayName(competition.player_display_name || '');
    }
  };

  // Reset player display name to global name
  const handleResetToGlobal = async () => {
    if (!selectedCompetitionId) return;

    setSavingDisplayName(true);
    try {
      const response = await userApi.updatePlayerDisplayName(selectedCompetitionId, null);
      if (response.data.return_code === 'SUCCESS') {
        // Invalidate dashboard cache to ensure fresh data
        if (user?.id) {
          invalidateCache.invalidateKey(`user-dashboard-${user.id}`);
        }

        // Update local state
        setCompetitions(prev => prev.map(c =>
          c.id === selectedCompetitionId
            ? { ...c, player_display_name: null }
            : c
        ));
        setPlayerDisplayName('');
        alert('Display name reset to profile name successfully');
      } else {
        alert(response.data.message || 'Failed to reset display name');
      }
    } catch (error) {
      console.error('Reset display name error:', error);
      alert('Failed to reset display name. Please try again.');
    } finally {
      setSavingDisplayName(false);
    }
  };

  // Save player display name for selected competition
  const handleSaveDisplayName = async () => {
    if (!selectedCompetitionId) return;

    setSavingDisplayName(true);
    try {
      const nameValue = playerDisplayName.trim() || null;
      const response = await userApi.updatePlayerDisplayName(selectedCompetitionId, nameValue);
      if (response.data.return_code === 'SUCCESS') {
        // Invalidate dashboard cache to ensure fresh data
        if (user?.id) {
          invalidateCache.invalidateKey(`user-dashboard-${user.id}`);
        }

        // Update local state
        setCompetitions(prev => prev.map(c =>
          c.id === selectedCompetitionId
            ? { ...c, player_display_name: response.data.player_display_name || null }
            : c
        ));
        alert('Player display name updated successfully');
      } else {
        alert(response.data.message || 'Failed to update display name');
      }
    } catch (error) {
      console.error('Update display name error:', error);
      alert('Failed to update display name. Please try again.');
    } finally {
      setSavingDisplayName(false);
    }
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

        {/* Competition Display Names Section */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 mt-6">
          <div className="p-4 sm:p-6">
            <div className="mb-4">
              <h3 className="text-lg font-medium text-slate-900">Competition Display Names</h3>
              <p className="text-sm text-slate-500 mt-1">
                Choose how your name appears in each competition. By default, your profile name is used.
              </p>
            </div>

            <button
              type="button"
              onClick={handleManageNames}
              className="inline-flex items-center px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white font-medium text-sm rounded-lg transition-colors duration-200"
            >
              Manage Competition Names
            </button>
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

      {/* Player Display Name Modal */}
      {showNameModal && (
        <div className="fixed inset-0 bg-slate-900 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-slate-900">Edit Competition Display Name</h3>
                <button
                  onClick={() => {
                    setShowNameModal(false);
                    setSelectedCompetitionId(null);
                    setPlayerDisplayName('');
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <span className="text-2xl">&times;</span>
                </button>
              </div>

              {loadingCompetitions ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Competition Dropdown */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Competition
                    </label>
                    <select
                      value={selectedCompetitionId || ''}
                      onChange={(e) => handleCompetitionSelect(Number(e.target.value))}
                      className="block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                    >
                      <option value="">Select a competition...</option>
                      {competitions.map((comp) => (
                        <option key={comp.id} value={comp.id}>
                          {comp.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Show current name and input when competition is selected */}
                  {selectedCompetitionId && (() => {
                    const selectedComp = competitions.find(c => c.id === selectedCompetitionId);
                    return (
                      <>
                        <div className="bg-slate-50 rounded-md p-3">
                          <p className="text-sm text-slate-600">
                            Current name in &quot;{selectedComp?.name}&quot;:
                          </p>
                          <p className="text-sm font-medium text-slate-900 mt-1">
                            {selectedComp?.player_display_name || user?.display_name}{' '}
                            <span className="text-slate-500 text-xs">
                              ({selectedComp?.player_display_name ? 'custom' : 'using profile name'})
                            </span>
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Custom display name (leave blank for profile name)
                          </label>
                          <input
                            type="text"
                            value={playerDisplayName}
                            onChange={(e) => setPlayerDisplayName(e.target.value)}
                            className="block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                            placeholder={user?.display_name || 'Your name'}
                            disabled={savingDisplayName}
                          />
                          <p className="mt-1 text-xs text-slate-500">
                            2-50 characters. Letters, numbers, spaces, hyphens, underscores, apostrophes, and periods allowed.
                          </p>
                        </div>

                        <div className="flex justify-between space-x-3 pt-2">
                          {selectedComp?.player_display_name && (
                            <button
                              type="button"
                              onClick={handleResetToGlobal}
                              disabled={savingDisplayName}
                              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:opacity-50"
                            >
                              Reset to Profile Name
                            </button>
                          )}
                          <div className="flex-1"></div>
                          <button
                            type="button"
                            onClick={() => {
                              setShowNameModal(false);
                              setSelectedCompetitionId(null);
                              setPlayerDisplayName('');
                            }}
                            disabled={savingDisplayName}
                            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveDisplayName}
                            disabled={savingDisplayName}
                            className="px-4 py-2 text-sm font-medium text-white bg-slate-600 rounded-md hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:opacity-50"
                          >
                            {savingDisplayName ? (
                              <div className="flex items-center">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Saving...
                              </div>
                            ) : (
                              'Save'
                            )}
                          </button>
                        </div>
                      </>
                    );
                  })()}

                  {/* Show message if no competitions */}
                  {!selectedCompetitionId && competitions.length === 0 && (
                    <div className="text-center py-8 text-slate-500">
                      <p>You are not a participant in any competitions yet.</p>
                      <p className="text-sm mt-2">Join a competition to customize your display name.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}