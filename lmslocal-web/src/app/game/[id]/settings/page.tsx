'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeftIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  XMarkIcon,
  HeartIcon,
  ShieldCheckIcon,
  TrashIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { competitionApi, UpdateCompetitionRequest, ResetCompetitionRequest, DeleteCompetitionRequest } from '@/lib/api';
import { useAppData } from '@/contexts/AppDataContext';

export default function CompetitionSettings() {
  const router = useRouter();
  const params = useParams();
  const competitionId = params.id as string;
  
  // Use AppDataProvider context for competitions data
  const { competitions, loading: contextLoading, refreshCompetitions } = useAppData();
  
  // Find the specific competition
  const competition = competitions?.find(c => c.id.toString() === competitionId);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Reset modal state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetting, setResetting] = useState(false);
  
  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    lives_per_player: 0,
    no_team_twice: true,
  });

  // Track if competition has started (derived from invite_code presence)
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    const initializeData = async () => {
      try {
        // Check authentication
        const token = localStorage.getItem('jwt_token');
        if (!token) {
          router.push('/login');
          return;
        }

        // Wait for competitions data to load from context
        if (contextLoading) {
          return;
        }

        // If context has loaded but we don't have competitions data, let the render handle it
        if (!competitions) {
          setLoading(false);
          return;
        }

        if (competition && competition.is_organiser) {
          // Initialize form with competition data
          setFormData({
            name: competition.name || '',
            description: competition.description || '',
            lives_per_player: competition.lives_per_player || 0,
            no_team_twice: competition.no_team_twice !== undefined ? competition.no_team_twice : true,
          });

          // Check if competition has started (no invite code means started)
          setHasStarted(!competition.invite_code);
          
        } else if (!contextLoading) {
          // Only redirect if context has finished loading and we still don't have access
          console.warn('Competition not found or no access');
          router.push('/dashboard');
          return;
        }

      } catch (error) {
        console.error('Failed to load competition data:', error);
        router.push('/dashboard');
      } finally {
        setLoading(false);
      }
    };

    initializeData();
  }, [competitionId, router, competition, competitions, contextLoading]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({
        ...prev,
        [name]: checked
      }));
    } else if (type === 'radio' && name === 'lives_per_player') {
      const numValue = parseInt(value);
      setFormData(prev => ({
        ...prev,
        [name]: numValue
      }));
    } else if (name === 'lives_per_player') {
      const numValue = parseInt(value) || 0;
      setFormData(prev => ({
        ...prev,
        [name]: numValue
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }

    // Clear success/error messages when user starts typing
    if (success) setSuccess(false);
    if (error) setError(null);
  };

  const handleSave = async () => {
    if (!competition) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      // Prepare update request with only changed fields
      const updateData: UpdateCompetitionRequest = {
        competition_id: competition.id,
      };

      // Only include fields that have values
      if (formData.name.trim()) {
        updateData.name = formData.name.trim();
      }
      
      if (formData.description.trim()) {
        updateData.description = formData.description.trim();
      }

      // Only include restricted fields if competition hasn't started
      if (!hasStarted) {
        updateData.lives_per_player = formData.lives_per_player;
        updateData.no_team_twice = formData.no_team_twice;
      }

      const response = await competitionApi.update(updateData);

      if (response.data.return_code === 'SUCCESS') {
        setSuccess(true);
        // Refresh competitions to update the context with new data
        refreshCompetitions();
        
        // Auto-hide success message after 3 seconds
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(response.data.message || 'Failed to update competition');
      }

    } catch (err: unknown) {
      console.error('Update competition error:', err);
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to update competition');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset form to original values
    if (competition) {
      setFormData({
        name: competition.name || '',
        description: competition.description || '',
        lives_per_player: competition.lives_per_player || 0,
        no_team_twice: competition.no_team_twice !== undefined ? competition.no_team_twice : true,
      });
    }
    setError(null);
    setSuccess(false);
  };

  const handleResetCompetition = async () => {
    if (!competition) return;

    // Validate confirmation text
    if (resetConfirmText.toLowerCase() !== 'reset') {
      setError('Please type "RESET" to confirm');
      return;
    }

    setResetting(true);
    setError(null);

    try {
      const resetData: ResetCompetitionRequest = {
        competition_id: competition.id,
      };

      const response = await competitionApi.reset(resetData);

      if (response.data.return_code === 'SUCCESS') {
        // Reset successful - clear cache and refresh data
        // Clear all relevant caches to ensure fresh data after reset
        const { cacheUtils } = await import('@/lib/api');
        cacheUtils.invalidateCompetitions();
        
        // Clear competition-specific caches
        const competitionId = competition.id;
        cacheUtils.invalidateKey(`competition-standings-${competitionId}`);
        cacheUtils.invalidateKey(`competition-status-${competitionId}`);
        cacheUtils.invalidateKey(`competition-players-${competitionId}`);
        cacheUtils.invalidateKey(`pick-statistics-${competitionId}`);
        cacheUtils.invalidateKey(`rounds-${competitionId}`);
        cacheUtils.invalidateKey(`allowed-teams-${competitionId}-current`);
        
        refreshCompetitions();
        
        // Close modal and reset form
        setShowResetModal(false);
        setResetConfirmText('');
        
        // Small delay to ensure context updates before navigation
        setTimeout(() => {
          router.push(`/competition/${competitionId}/dashboard`);
        }, 200);
      } else {
        setError(response.data.message || 'Failed to reset competition');
      }

    } catch (err: unknown) {
      console.error('Reset competition error:', err);
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to reset competition');
    } finally {
      setResetting(false);
    }
  };

  const handleCloseResetModal = () => {
    setShowResetModal(false);
    setResetConfirmText('');
    setError(null);
  };

  const handleDeleteCompetition = async () => {
    if (!competition) return;

    // Validate confirmation text
    if (deleteConfirmText.toLowerCase() !== 'delete') {
      setError('Please type "DELETE" to confirm');
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      const deleteData: DeleteCompetitionRequest = {
        competition_id: competition.id,
      };

      const response = await competitionApi.delete(deleteData);

      if (response.data.return_code === 'SUCCESS') {
        // Delete successful - clear all caches
        const { cacheUtils } = await import('@/lib/api');
        cacheUtils.invalidateCompetitions();
        
        // Clear user-specific competitions cache
        const userData = localStorage.getItem('user');
        if (userData) {
          try {
            const user = JSON.parse(userData);
            const userId = user.id?.toString();
            if (userId) {
              cacheUtils.invalidateKey(`competitions-user-${userId}`);
            }
          } catch (error) {
            console.warn('Failed to get user ID for cache clearing:', error);
          }
        }
        
        // Clear all competition-specific caches
        const competitionId = competition.id;
        cacheUtils.invalidateKey(`competition-standings-${competitionId}`);
        cacheUtils.invalidateKey(`competition-status-${competitionId}`);
        cacheUtils.invalidateKey(`competition-players-${competitionId}`);
        cacheUtils.invalidateKey(`pick-statistics-${competitionId}`);
        cacheUtils.invalidateKey(`rounds-${competitionId}`);
        cacheUtils.invalidateKey(`allowed-teams-${competitionId}-current`);
        
        // Refresh competitions context to remove deleted competition
        refreshCompetitions();
        
        // Small delay to ensure context updates before navigation
        setTimeout(() => {
          router.push('/dashboard');
        }, 100);
      } else {
        setError(response.data.message || 'Failed to delete competition');
      }

    } catch (err: unknown) {
      console.error('Delete competition error:', err);
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to delete competition');
    } finally {
      setDeleting(false);
    }
  };

  const handleCloseDeleteModal = () => {
    setShowDeleteModal(false);
    setDeleteConfirmText('');
    setError(null);
  };

  if (loading || contextLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200 shadow-sm">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <Link href={`/game/${competitionId}`} className="flex items-center space-x-2 text-slate-600 hover:text-slate-800 transition-colors">
                  <ArrowLeftIcon className="h-5 w-5" />
                  <span className="font-medium">Back</span>
                </Link>
                <div className="h-6 w-px bg-slate-300" />
                <div>
                  <h1 className="text-lg font-semibold text-slate-900">Settings</h1>
                </div>
              </div>
            </div>
          </div>
        </header>
        
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
            <div className="flex items-center justify-center">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-50 rounded-full mb-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-600 border-t-transparent"></div>
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">Loading Settings</h3>
                <p className="text-slate-500">Please wait while we fetch your competition settings...</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!contextLoading && !competition) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-slate-900 mb-2">Competition Not Found</h1>
          <Link href={`/game/${competitionId}`} className="text-slate-600 hover:text-slate-800">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link href={`/game/${competitionId}`} className="flex items-center space-x-2 text-slate-600 hover:text-slate-800 transition-colors">
                <ArrowLeftIcon className="h-5 w-5" />
                <span className="font-medium">Dashboard</span>
              </Link>
              <div className="h-6 w-px bg-slate-300" />
              <div>
                <h1 className="text-lg font-semibold text-slate-900">Settings</h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Status Messages */}
        {success && (
          <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <div className="flex items-center">
              <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2" />
              <p className="text-emerald-800 font-medium">Settings updated successfully!</p>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <XMarkIcon className="h-5 w-5 text-red-600 mr-2" />
                <p className="text-red-800 font-medium">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-600"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Competition Started Info */}
        {hasStarted && (
          <div className="mb-6 bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="flex items-center">
              <InformationCircleIcon className="h-5 w-5 text-slate-500 mr-2" />
              <p className="text-slate-700">
                Your competition is now active. Name and description can still be updated, but game rules are locked in.
              </p>
            </div>
          </div>
        )}


        {/* Settings Form */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-xl font-semibold text-slate-900">Competition Details</h2>
            <p className="mt-1 text-slate-600">Update your competition name and description at any time.</p>
          </div>

          <div className="p-6 space-y-6">
            {/* Competition Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-2">
                Competition Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                placeholder="Enter competition name"
                required
              />
            </div>

            {/* Competition Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-2">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                placeholder="Enter competition description (optional)"
              />
            </div>
          </div>

          {/* Game Rules Section */}
          <div className="border-t border-slate-200">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-semibold text-slate-900">Game Rules</h2>
              <p className="mt-1 text-slate-600">
                {hasStarted 
                  ? "These settings cannot be changed after the competition has started."
                  : "Configure the rules for your competition before players start making picks."
                }
              </p>
            </div>

            <div className="p-6 space-y-6">
              {/* Lives Per Player */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">
                  <HeartIcon className="h-5 w-5 inline mr-2 text-slate-500" />
                  Lives Per Player
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                  {[0, 1, 2, 3].map((lives) => (
                    <label key={lives} className="relative">
                      <input
                        type="radio"
                        name="lives_per_player"
                        value={lives}
                        checked={formData.lives_per_player === lives}
                        onChange={handleInputChange}
                        disabled={hasStarted}
                        className="sr-only peer"
                      />
                      <div className={`p-3 sm:p-4 border border-slate-300 rounded-xl cursor-pointer peer-checked:border-slate-800 peer-checked:bg-slate-50 peer-checked:shadow-md hover:bg-slate-50 transition-all ${
                        hasStarted ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
                      }`}>
                        <div className="text-center">
                          <div className="text-xl sm:text-2xl font-bold text-slate-900">{lives}</div>
                          <div className="text-xs sm:text-sm text-slate-600">
                            {lives === 0 ? 'Knockout' : lives === 1 ? 'Life' : 'Lives'}
                          </div>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  How many wrong picks can players make before being eliminated?
                </p>
              </div>

              {/* No Team Twice Rule */}
              <div>
                <label className="flex items-start space-x-3">
                  <input
                    type="checkbox"
                    name="no_team_twice"
                    checked={formData.no_team_twice}
                    onChange={handleInputChange}
                    disabled={hasStarted}
                    className={`mt-1 h-4 w-4 text-slate-600 focus:ring-slate-500 border-slate-300 rounded ${
                      hasStarted ? 'cursor-not-allowed' : ''
                    }`}
                  />
                  <div>
                    <div className="text-sm font-medium text-slate-700">
                      <ShieldCheckIcon className="h-5 w-5 inline mr-2 text-slate-500" />
                      No Team Twice Rule
                    </div>
                    <div className="text-sm text-slate-500">
                      Players cannot pick the same team in different rounds
                      {formData.no_team_twice && (
                        <span className="block mt-1">
                          Teams automatically reset when players run out of options.
                        </span>
                      )}
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-6 border-t border-slate-200 bg-slate-50 rounded-b-xl">
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="inline-flex items-center justify-center px-4 sm:px-6 py-3 bg-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 transition-all text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !formData.name.trim()}
                className="inline-flex items-center justify-center px-4 sm:px-6 py-3 bg-slate-800 text-white rounded-xl font-medium hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 shadow-md hover:shadow-lg transition-all text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving && (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                )}
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>

        {/* Danger Zone - Reset Competition */}
        <div className="bg-white rounded-xl border border-red-200 shadow-sm mt-8">
          <div className="p-6 border-b border-red-200">
            <h2 className="text-xl font-semibold text-red-900">Danger Zone</h2>
            <p className="mt-1 text-red-600">Irreversible and destructive actions.</p>
          </div>

          <div className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between">
              <div className="flex-1 mb-4 sm:mb-0 sm:mr-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-3">
                  <TrashIcon className="h-5 w-5 inline mr-2 text-red-500" />
                  Competition Management
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-amber-700 mb-2">Reset Competition</h4>
                    <p className="text-slate-600 text-sm mb-1">
                      Clears all game data but keeps the competition and players:
                    </p>
                    <ul className="text-xs text-slate-600 list-disc list-inside space-y-1">
                      <li>Deletes rounds, fixtures, picks, and results</li>
                      <li>Resets players to active with full lives</li>
                      <li>Keeps competition and all players</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-red-700 mb-2">Delete Competition</h4>
                    <p className="text-slate-600 text-sm mb-1">
                      Permanently removes the entire competition:
                    </p>
                    <ul className="text-xs text-slate-600 list-disc list-inside space-y-1">
                      <li>Deletes the competition completely</li>
                      <li>Removes all players from competition</li>
                      <li>Deletes all game data and history</li>
                      <li>Cannot be recovered</li>
                    </ul>
                  </div>
                </div>
                
                <div className="flex items-center text-red-600 text-sm mt-3">
                  <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                  <strong>Both actions cannot be undone.</strong>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => setShowResetModal(true)}
                  disabled={saving || resetting || deleting}
                  className="inline-flex items-center justify-center px-4 sm:px-6 py-3 bg-amber-600 text-white rounded-xl font-medium hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 shadow-md hover:shadow-lg transition-all text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                >
                  <TrashIcon className="h-4 w-4 mr-2" />
                  Reset Competition
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  disabled={saving || resetting || deleting}
                  className="inline-flex items-center justify-center px-4 sm:px-6 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 shadow-md hover:shadow-lg transition-all text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                >
                  <TrashIcon className="h-4 w-4 mr-2" />
                  Delete Competition
                </button>
              </div>
            </div>
          </div>
        </div>

      </main>

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                  <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
                </div>
              </div>
              
              <div className="text-center">
                <h3 className="text-lg font-semibold text-slate-900 mb-3">
                  Reset Competition?
                </h3>
                
                <div className="text-sm text-slate-600 space-y-3 mb-6 text-left">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="font-medium text-red-800 mb-2">⚠️ This will permanently delete:</p>
                    <ul className="text-red-700 text-xs space-y-1 list-disc list-inside">
                      <li>All rounds and fixtures</li>
                      <li>All player picks and results</li>
                      <li>All game progress and statistics</li>
                      <li>All player states (status, lives, payments)</li>
                    </ul>
                  </div>
                  
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <p className="font-medium text-slate-800 mb-2">✅ This will preserve:</p>
                    <ul className="text-slate-700 text-xs space-y-1 list-disc list-inside">
                      <li>Competition name and description</li>
                      <li>Players (they remain in competition)</li>
                      <li>Competition settings and rules</li>
                    </ul>
                  </div>
                  
                  <p className="text-center text-slate-800 font-medium">
                    Are you absolutely sure? This cannot be undone.
                  </p>
                </div>

                <div className="mb-4">
                  <label htmlFor="confirmReset" className="block text-sm font-medium text-slate-700 mb-2">
                    Type <strong>RESET</strong> to confirm:
                  </label>
                  <input
                    id="confirmReset"
                    type="text"
                    value={resetConfirmText}
                    onChange={(e) => setResetConfirmText(e.target.value)}
                    placeholder="RESET"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-center font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 px-6 py-4 bg-slate-50 rounded-b-xl">
              <button
                type="button"
                onClick={handleCloseResetModal}
                disabled={resetting}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetCompetition}
                disabled={resetting || resetConfirmText.toLowerCase() !== 'reset'}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resetting && (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                )}
                {resetting ? 'Resetting...' : 'Reset Competition'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                  <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
                </div>
              </div>
              
              <div className="text-center">
                <h3 className="text-lg font-semibold text-slate-900 mb-3">
                  Delete Competition?
                </h3>
                
                <div className="text-sm text-slate-600 space-y-3 mb-6 text-left">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="font-medium text-red-800 mb-2">⚠️ This will permanently delete:</p>
                    <ul className="text-red-700 text-xs space-y-1 list-disc list-inside">
                      <li>The entire competition</li>
                      <li>All players and their accounts</li>
                      <li>All rounds, fixtures, and results</li>
                      <li>All picks and game history</li>
                      <li>All settings and configuration</li>
                    </ul>
                  </div>
                  
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <p className="font-medium text-slate-800 mb-1">❌ Nothing can be recovered</p>
                    <p className="text-slate-700 text-xs">
                      This is completely different from &quot;Reset&quot; - the competition will be gone forever.
                    </p>
                  </div>
                  
                  <p className="text-center text-slate-800 font-medium">
                    Are you absolutely sure? This cannot be undone.
                  </p>
                </div>

                <div className="mb-4">
                  <label htmlFor="confirmDelete" className="block text-sm font-medium text-slate-700 mb-2">
                    Type <strong>DELETE</strong> to confirm:
                  </label>
                  <input
                    id="confirmDelete"
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="DELETE"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-center font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 px-6 py-4 bg-slate-50 rounded-b-xl">
              <button
                type="button"
                onClick={handleCloseDeleteModal}
                disabled={deleting}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteCompetition}
                disabled={deleting || deleteConfirmText.toLowerCase() !== 'delete'}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting && (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                )}
                {deleting ? 'Deleting...' : 'Delete Competition'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}