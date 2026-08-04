'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';
import { competitionApi, teamApi, UpdateCompetitionRequest, ResetCompetitionRequest, DeleteCompetitionRequest } from '@/lib/api';
import { useAppData } from '@/contexts/AppDataContext';
import CloudinaryUpload from '@/components/CloudinaryUpload';
import { LABEL, EYEBROW, HEADING, PANEL, BTN_PRIMARY, BTN_OUTLINE, BTN_DARK } from '@/lib/design';

const INPUT = 'w-full rounded-sm border border-ink bg-transparent px-3 py-2 text-[15px] text-ink placeholder-ink-fade/60 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

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
    logo_url: '',
    venue_name: '',
    address_line_1: '',
    address_line_2: '',
    city: '',
    postcode: '',
    phone: '',
    email: '',
    lives_per_player: 0,
    no_team_twice: true,
    prize_structure: '',
  });

  // Track if competition has started (derived from invite_code presence)
  const [hasStarted, setHasStarted] = useState(false);

  // Fixture service switch. Saved on its own, not via Save Changes - the server can refuse it
  // for round-state reasons that need explaining, and that must not block other edits.
  const [fixtureServiceOffered, setFixtureServiceOffered] = useState(false);
  const [switchingFixtureService, setSwitchingFixtureService] = useState(false);
  const [fixtureServiceError, setFixtureServiceError] = useState<string | null>(null);
  const [fixtureServiceNotice, setFixtureServiceNotice] = useState<string | null>(null);
  // Set when the switch is blocked only by an unstarted round the organiser can choose to discard.
  const [stalledRound, setStalledRound] = useState<{ round_number: number; fixture_count: number } | null>(null);

  // The service only pushes to team lists we stage fixtures for, so the switch is hidden
  // entirely on lists it does not cover rather than shown and then refused.
  useEffect(() => {
    if (!competition?.team_list_id) return;

    let cancelled = false;
    teamApi.getTeamLists()
      .then((response) => {
        if (cancelled || response.data.return_code !== 'SUCCESS') return;
        const lists = (response.data.team_lists || []) as { id: number; fixture_service_available?: boolean }[];
        const match = lists.find(tl => tl.id === competition.team_list_id);
        setFixtureServiceOffered(match?.fixture_service_available === true);
      })
      .catch(() => { /* Leave the switch hidden if we cannot confirm coverage */ });

    return () => { cancelled = true; };
  }, [competition?.team_list_id]);

  const handleFixtureServiceChange = async (enabled: boolean, clearStalledRound = false) => {
    if (!competition) return;
    // Allow a repeat call when confirming a clear - the flag has not changed yet at that point.
    if (!clearStalledRound && enabled === (competition.fixture_service === true)) return;

    setSwitchingFixtureService(true);
    setFixtureServiceError(null);
    setFixtureServiceNotice(null);

    try {
      const response = await competitionApi.setFixtureService(competition.id, enabled, clearStalledRound);

      if (response.data.return_code === 'SUCCESS') {
        setStalledRound(null);
        setFixtureServiceNotice(response.data.message || 'Setting saved');
        await refreshCompetitions();
      } else if (response.data.return_code === 'STALLED_ROUND_NEEDS_CLEARING') {
        // Nothing has been deleted yet. Confirm with the organiser, naming what goes.
        setStalledRound({
          round_number: response.data.round_number ?? 0,
          fixture_count: response.data.fixture_count ?? 0
        });
      } else {
        // ROUND_IN_PROGRESS, ROUND_NOT_PROCESSED and ROUND_NO_LONGER_CLEARABLE each explain
        // exactly what is blocking the switch, so show the server's message.
        setStalledRound(null);
        setFixtureServiceError(response.data.message || 'Could not change this setting');
      }
    } catch {
      setFixtureServiceError('Could not change this setting. Please try again.');
    } finally {
      setSwitchingFixtureService(false);
    }
  };

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
            logo_url: competition.logo_url || '',
            venue_name: competition.venue_name || '',
            address_line_1: competition.address_line_1 || '',
            address_line_2: competition.address_line_2 || '',
            city: competition.city || '',
            postcode: competition.postcode || '',
            phone: competition.phone || '',
            email: competition.email || '',
            lives_per_player: competition.lives_per_player || 0,
            no_team_twice: competition.no_team_twice !== undefined ? competition.no_team_twice : true,
            prize_structure: competition.prize_structure || '',
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

      // Always include description (allow clearing it by sending empty string)
      updateData.description = formData.description.trim() || '';

      if (formData.venue_name.trim()) {
        updateData.venue_name = formData.venue_name.trim();
      }

      // Include address and contact fields if provided
      if (formData.address_line_1.trim()) {
        updateData.address_line_1 = formData.address_line_1.trim();
      }

      if (formData.address_line_2.trim()) {
        updateData.address_line_2 = formData.address_line_2.trim();
      }

      if (formData.city.trim()) {
        updateData.city = formData.city.trim();
      }

      if (formData.postcode.trim()) {
        updateData.postcode = formData.postcode.trim();
      }

      if (formData.phone.trim()) {
        updateData.phone = formData.phone.trim();
      }

      if (formData.email.trim()) {
        updateData.email = formData.email.trim();
      }

      // Prize structure
      if (formData.prize_structure.trim()) {
        updateData.prize_structure = formData.prize_structure.trim();
      }

      // Always include logo_url to allow clearing it (send empty string to clear)
      updateData.logo_url = formData.logo_url.trim();


      // Only include restricted fields if competition hasn't started
      if (!hasStarted) {
        updateData.lives_per_player = formData.lives_per_player;
        updateData.no_team_twice = formData.no_team_twice;
      }

      const response = await competitionApi.update(updateData);

      if (response.data.return_code === 'SUCCESS') {
        setSuccess(true);

        // Clear the cache and refresh competitions to ensure fresh data
        const { cacheUtils } = await import('@/lib/api');
        cacheUtils.invalidateCompetitions();

        // Also invalidate promote data cache (used by leaflet page)
        cacheUtils.invalidateKey(`promote-data-${competition.id}`);

        // Refresh competitions to update the context with new data
        await refreshCompetitions(true); // Bypass cache to get fresh data

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

  // Removed Cancel button - users can navigate away if needed

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
          router.push(`/game/${competitionId}/dashboard`);
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

    // Validate confirmation text - must match competition name
    if (deleteConfirmText !== competition.name) {
      setError(`Please type "${competition.name}" exactly to confirm`);
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
      <div className="min-h-screen bg-stock font-body text-ink">
        <header className="border-b border-ink/30">
          <div className="mx-auto flex max-w-3xl items-center px-4 py-4 sm:px-6">
            <Link href={`/game/${competitionId}`} className={`${LABEL} flex items-center gap-1.5 text-ink-fade transition-colors hover:text-ink`}>
              <ArrowLeftIcon className="h-4 w-4" />
              Dashboard
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <div className={`${PANEL} p-8 text-center`}>
            <div className="mb-4 inline-flex h-8 w-8 animate-spin items-center justify-center rounded-full border-2 border-ink border-t-transparent" />
            <p className={EYEBROW}>Loading</p>
            <p className="mt-2 text-[17px] text-ink-fade">Fetching your competition settings&hellip;</p>
          </div>
        </main>
      </div>
    );
  }

  if (!contextLoading && !competition) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stock font-body text-ink">
        <div className="text-center">
          <h1 className={`${HEADING} text-2xl`}>Competition not found</h1>
          <Link href={`/game/${competitionId}`} className={`${LABEL} mt-4 inline-block text-ink-fade underline decoration-dotted underline-offset-4 transition-colors hover:text-ink`}>
            Return to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stock font-body text-ink">
      <header className="border-b border-ink/30">
        <div className="mx-auto flex max-w-3xl items-center px-4 py-4 sm:px-6">
          <Link href={`/game/${competitionId}`} className={`${LABEL} flex items-center gap-1.5 text-ink-fade transition-colors hover:text-ink`}>
            <ArrowLeftIcon className="h-4 w-4" />
            Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">

        <p className={EYEBROW}>Settings</p>
        <h1 className={`${HEADING} mt-1 text-3xl`}>{competition?.name}</h1>

        {/* Status Messages */}
        {success && (
          <div className={`${PANEL} mt-5 flex items-center justify-center gap-2 p-4`}>
            <CheckCircleIcon className="h-5 w-5 text-moss" />
            <p className="text-[15px] font-medium text-ink">Settings saved successfully</p>
          </div>
        )}

        {error && (
          <div className={`${PANEL} mt-5 border-overprint p-4`}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[15px] text-ink">{error}</p>
              <button onClick={() => setError(null)} className="flex-shrink-0 text-ink-fade transition-colors hover:text-ink">
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Settings Form */}
        <div className={`${PANEL} mt-5`}>
          <div className="border-b border-ink/30 p-5 sm:p-6">
            <p className={`${HEADING} text-xl`}>Competition details</p>
            <p className="mt-1 text-[14px] text-ink-fade">Update your competition name and description at any time.</p>
          </div>

          <div className="space-y-5 p-5 sm:p-6">
            {/* Competition Name */}
            <div>
              <label htmlFor="name" className={`${LABEL} mb-2 block text-ink-fade`}>
                Competition name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className={INPUT}
                placeholder="Enter competition name"
                required
              />
            </div>

            {/* Competition Description */}
            <div>
              <label htmlFor="description" className={`${LABEL} mb-2 block text-ink-fade`}>
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={3}
                maxLength={250}
                className={`${INPUT} resize-none`}
                placeholder="Enter competition description (optional)"
              />
              <p className="mt-1 text-[12px] text-ink-fade">
                {formData.description.length}/250 characters
              </p>
            </div>

            {/* Logo Upload */}
            <div>
              <label className={`${LABEL} mb-2 block text-ink-fade`}>
                Competition logo <span className="normal-case text-ink-fade/70">(optional)</span>
              </label>
              <CloudinaryUpload
                value={formData.logo_url}
                onChange={async (url) => {
                  setFormData(prev => ({ ...prev, logo_url: url }));

                  // Auto-save logo immediately
                  if (competition) {
                    try {
                      const response = await competitionApi.update({
                        competition_id: competition.id,
                        logo_url: url || ''  // Send empty string to clear logo
                      });

                      if (response.data.return_code === 'SUCCESS') {
                        setSuccess(true);
                        // Clear the dashboard cache so next page load gets fresh data
                        const { cacheUtils } = await import('@/lib/api');
                        cacheUtils.invalidateCompetitions();
                        setTimeout(() => setSuccess(false), 3000);
                      } else {
                        setError(response.data.message || 'Failed to save logo');
                      }
                    } catch (err) {
                      console.error('Auto-save logo error:', err);
                      setError('Failed to save logo');
                    }
                  }
                }}
                className="mt-1"
              />
            </div>

            {/* Venue Name */}
            <div>
              <label htmlFor="venue_name" className={`${LABEL} mb-2 block text-ink-fade`}>
                Venue/organisation name <span className="normal-case text-ink-fade/70">(optional)</span>
              </label>
              <input
                type="text"
                id="venue_name"
                name="venue_name"
                value={formData.venue_name}
                onChange={handleInputChange}
                className={INPUT}
                placeholder="e.g., The Red Barn, Crown & Anchor"
                maxLength={100}
              />
              <p className="mt-1 text-[12px] text-ink-fade">
                This name will appear in marketing messages instead of your personal name
              </p>
            </div>

            {/* Address Section */}
            <div>
              <label htmlFor="address_line_1" className={`${LABEL} mb-2 block text-ink-fade`}>
                Address line 1 <span className="normal-case text-ink-fade/70">(optional)</span>
              </label>
              <input
                type="text"
                id="address_line_1"
                name="address_line_1"
                value={formData.address_line_1}
                onChange={handleInputChange}
                className={INPUT}
                placeholder="e.g., 123 High Street"
                maxLength={100}
              />
            </div>

            <div>
              <label htmlFor="address_line_2" className={`${LABEL} mb-2 block text-ink-fade`}>
                Address line 2 <span className="normal-case text-ink-fade/70">(optional)</span>
              </label>
              <input
                type="text"
                id="address_line_2"
                name="address_line_2"
                value={formData.address_line_2}
                onChange={handleInputChange}
                className={INPUT}
                placeholder="e.g., City Centre, District"
                maxLength={100}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="city" className={`${LABEL} mb-2 block text-ink-fade`}>
                  City/town <span className="normal-case text-ink-fade/70">(optional)</span>
                </label>
                <input
                  type="text"
                  id="city"
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  className={INPUT}
                  placeholder="e.g., Manchester"
                  maxLength={50}
                />
              </div>

              <div>
                <label htmlFor="postcode" className={`${LABEL} mb-2 block text-ink-fade`}>
                  Postcode <span className="normal-case text-ink-fade/70">(optional)</span>
                </label>
                <input
                  type="text"
                  id="postcode"
                  name="postcode"
                  value={formData.postcode}
                  onChange={handleInputChange}
                  className={INPUT}
                  placeholder="e.g., M1 2AB"
                  maxLength={20}
                />
              </div>
            </div>

            {/* Contact Section */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="phone" className={`${LABEL} mb-2 block text-ink-fade`}>
                  Phone number <span className="normal-case text-ink-fade/70">(optional)</span>
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className={INPUT}
                  placeholder="e.g., 01234 567890"
                  maxLength={20}
                />
              </div>

              <div>
                <label htmlFor="email" className={`${LABEL} mb-2 block text-ink-fade`}>
                  Contact email <span className="normal-case text-ink-fade/70">(optional)</span>
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={INPUT}
                  placeholder="e.g., contact@venue.com"
                  maxLength={255}
                />
              </div>
            </div>

            {/* Prize Structure */}
            <div>
              <label htmlFor="prize_structure" className={`${LABEL} mb-2 block text-ink-fade`}>
                Prize structure <span className="normal-case text-ink-fade/70">(optional)</span>
              </label>
              <input
                type="text"
                id="prize_structure"
                name="prize_structure"
                value={formData.prize_structure}
                onChange={handleInputChange}
                className={INPUT}
                placeholder="e.g., FREE entry - £20 Prize for Winner!"
                maxLength={60}
              />
              <p className="mt-1 text-[12px] text-ink-fade">
                {formData.prize_structure.length}/60 characters
              </p>
            </div>
          </div>

          {/* Fixture Service Section - only on team lists the service covers */}
          {fixtureServiceOffered && (
            <div className="border-t border-ink/30">
              <div className="border-b border-ink/30 p-5 sm:p-6">
                <p className={`${HEADING} text-xl`}>Fixtures &amp; results</p>
                <p className="mt-1 text-[14px] text-ink-fade">
                  Choose whether we handle the fixtures and results, or you do them yourself.
                  This saves as soon as you choose.
                </p>
              </div>

              <div className="space-y-4 p-5 sm:p-6">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => handleFixtureServiceChange(true)}
                    disabled={switchingFixtureService}
                    className={`h-full border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                      competition?.fixture_service === true
                        ? 'border-ink bg-ink text-stock-lit'
                        : 'border-ink/30 hover:border-ink'
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className={`${LABEL} flex items-center gap-1.5`}>
                        <CalendarDaysIcon className="h-4 w-4" />
                        Do it for me
                      </span>
                      <span className={`${LABEL} border px-1.5 py-0.5 ${
                        competition?.fixture_service === true ? 'border-stock-lit' : 'border-ink/30 text-ink-fade'
                      }`}>
                        Free
                      </span>
                    </div>
                    <p className={`text-[13px] ${competition?.fixture_service === true ? 'text-stock/85' : 'text-ink-fade'}`}>
                      We add each round&apos;s fixtures and enter the results for you.
                    </p>
                    <p className={`mt-2 text-[12px] ${competition?.fixture_service === true ? 'text-stock/70' : 'text-ink-fade'}`}>
                      Free for this competition &mdash; normally <span className="line-through">£10</span>
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleFixtureServiceChange(false)}
                    disabled={switchingFixtureService}
                    className={`h-full border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                      competition?.fixture_service === false
                        ? 'border-ink bg-ink text-stock-lit'
                        : 'border-ink/30 hover:border-ink'
                    }`}
                  >
                    <p className={`${LABEL} mb-1`}>I&apos;ll do my own</p>
                    <p className={`text-[13px] ${competition?.fixture_service === false ? 'text-stock/85' : 'text-ink-fade'}`}>
                      You add the fixtures and enter results each round yourself.
                    </p>
                    <p className={`mt-2 text-[12px] ${competition?.fixture_service === false ? 'text-stock/70' : 'text-ink-fade'}`}>
                      Full control over kick-off times and lock times
                    </p>
                  </button>
                </div>

                {switchingFixtureService && (
                  <p className="text-[13px] text-ink-fade">Saving&hellip;</p>
                )}

                {fixtureServiceNotice && (
                  <div className="border border-ink/30 p-4">
                    <p className="text-[14px] text-ink">{fixtureServiceNotice}</p>
                  </div>
                )}

                {fixtureServiceError && (
                  <div className="border border-overprint p-4">
                    <p className="text-[14px] text-ink">{fixtureServiceError}</p>
                  </div>
                )}

                {/* Nothing has been deleted at this point - this is the confirmation step */}
                {stalledRound && (
                  <div className="border border-overprint p-4">
                    <p className="text-[14px] font-medium text-ink">
                      This will remove the {stalledRound.fixture_count} fixtures you added to
                      round {stalledRound.round_number}
                    </p>
                    <p className="mt-1 text-[13px] text-ink-fade">
                      Nobody has picked yet, so nothing else is lost. We&apos;ll set up round 1
                      for you and take it from there.
                    </p>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => handleFixtureServiceChange(true, true)}
                        disabled={switchingFixtureService}
                        className={`${BTN_DARK} px-4 py-2 disabled:opacity-50`}
                      >
                        Remove it and take over
                      </button>
                      <button
                        type="button"
                        onClick={() => setStalledRound(null)}
                        disabled={switchingFixtureService}
                        className={`${BTN_OUTLINE} px-4 py-2 disabled:opacity-50`}
                      >
                        Keep my fixtures
                      </button>
                    </div>
                  </div>
                )}

                <p className="text-[13px] text-ink-fade">
                  Switching does not backfill. Rounds already played stay as they are, and we pick
                  up from the next round.
                </p>
              </div>
            </div>
          )}

          {/* Game Rules Section */}
          <div className="border-t border-ink/30">
            <div className="border-b border-ink/30 p-5 sm:p-6">
              <p className={`${HEADING} text-xl`}>Game rules</p>
              <p className="mt-1 text-[14px] text-ink-fade">
                {hasStarted
                  ? 'These settings cannot be changed after the competition has started.'
                  : 'Configure the rules for your competition before players start making picks.'
                }
              </p>
            </div>

            <div className="p-5 sm:p-6">
              {/* Lives Per Player */}
              <div>
                <p className={`${LABEL} mb-3 text-ink-fade`}>Lives per player</p>
                <div className="grid grid-cols-3 gap-3">
                  {[0, 1, 2].map((lives) => (
                    <label key={lives} className="relative">
                      <input
                        type="radio"
                        name="lives_per_player"
                        value={lives}
                        checked={formData.lives_per_player === lives}
                        onChange={handleInputChange}
                        disabled={hasStarted}
                        className="peer sr-only"
                      />
                      <div className={`border p-3 text-center transition-colors sm:p-4 ${
                        formData.lives_per_player === lives ? 'border-ink bg-ink text-stock-lit' : 'border-ink/30 hover:border-ink'
                      } ${hasStarted ? 'pointer-events-none opacity-40' : 'cursor-pointer'}`}>
                        <div className="font-display text-2xl">{lives}</div>
                        <div className={`${LABEL} mt-0.5`}>
                          {lives === 0 ? 'Knockout' : lives === 1 ? 'Life' : 'Lives'}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-[13px] text-ink-fade">
                  How many wrong picks can players make before being eliminated?
                </p>
              </div>

              {/* No Team Twice Rule - HIDDEN (always enabled) */}
            </div>
          </div>

          {/* Actions */}
          <div className="border-t border-ink/30 p-5 sm:p-6">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !formData.name.trim() || success}
                className={`${success ? BTN_DARK : BTN_PRIMARY} flex items-center gap-2 px-6 py-3 text-base disabled:cursor-not-allowed disabled:opacity-60 sm:px-8`}
              >
                {saving && (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-stock-lit border-t-transparent" />
                )}
                {success && <CheckCircleIcon className="h-5 w-5" />}
                {success ? 'Saved!' : saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className={`${PANEL} mt-6 border-overprint`}>
          <div className="border-b border-overprint/40 p-5 sm:p-6">
            <p className={`${EYEBROW} text-overprint`}>Danger zone</p>
            <p className="mt-1 text-[14px] text-ink-fade">Irreversible and destructive actions.</p>
          </div>

          <div className="p-5 sm:p-6">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
              <div className="flex-1">
                <p className={`${HEADING} mb-3 text-lg`}>Competition management</p>

                <div className="space-y-4">
                  <div>
                    <p className="mb-1 text-[14px] font-medium text-ink">Reset competition</p>
                    <p className="mb-1 text-[13px] text-ink-fade">
                      Clears all game data but keeps the competition and players:
                    </p>
                    <ul className="list-disc space-y-0.5 pl-4 text-[12px] text-ink-fade">
                      <li>Deletes rounds, fixtures, picks, and results</li>
                      <li>Resets players to active with full lives</li>
                      <li>Keeps competition and all players</li>
                    </ul>
                  </div>

                  <div>
                    <p className="mb-1 text-[14px] font-medium text-ink">Delete competition</p>
                    <p className="mb-1 text-[13px] text-ink-fade">
                      Permanently removes the entire competition:
                    </p>
                    <ul className="list-disc space-y-0.5 pl-4 text-[12px] text-ink-fade">
                      <li>Deletes the competition completely</li>
                      <li>Deletes all game data and history</li>
                      <li>Cannot be recovered</li>
                    </ul>
                  </div>
                </div>

                <p className={`${LABEL} mt-3 flex items-center gap-1.5 text-overprint`}>
                  <ExclamationTriangleIcon className="h-4 w-4" />
                  Both actions cannot be undone.
                </p>
              </div>

              <div className="flex flex-shrink-0 flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setShowResetModal(true)}
                  disabled={saving || resetting || deleting}
                  className={`${LABEL} flex items-center justify-center gap-2 border border-overprint px-4 py-3 text-overprint transition-colors hover:bg-overprint hover:text-stock-lit disabled:cursor-not-allowed disabled:opacity-50 sm:px-6`}
                >
                  Reset competition
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  disabled={saving || resetting || deleting}
                  className={`${BTN_PRIMARY} px-4 py-3 text-base disabled:cursor-not-allowed disabled:opacity-50 sm:px-6`}
                >
                  Delete competition
                </button>
              </div>
            </div>
          </div>
        </div>

      </main>

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
          <div className={`${PANEL} w-full max-w-md`}>
            <div className="p-6">
              <p className={EYEBROW}>Confirm</p>
              <h3 className={`${HEADING} mt-1 text-2xl`}>Reset competition?</h3>

              <div className="mt-4 space-y-3 text-left">
                <div className="border border-overprint p-3">
                  <p className={`${LABEL} mb-2 text-overprint`}>This will permanently delete</p>
                  <ul className="list-disc space-y-0.5 pl-4 text-[12px] text-ink">
                    <li>All rounds and fixtures</li>
                    <li>All player picks and results</li>
                    <li>All game progress and statistics</li>
                    <li>All player states (status, lives, payments)</li>
                  </ul>
                </div>

                <div className="border border-ink/30 p-3">
                  <p className={`${LABEL} mb-2 text-ink-fade`}>This will preserve</p>
                  <ul className="list-disc space-y-0.5 pl-4 text-[12px] text-ink">
                    <li>Competition name and description</li>
                    <li>Players (they remain in competition)</li>
                    <li>Competition settings and rules</li>
                  </ul>
                </div>

                <p className="text-center text-[14px] font-medium text-ink">
                  Are you absolutely sure? This cannot be undone.
                </p>
              </div>

              <div className="mt-4">
                <label htmlFor="confirmReset" className={`${LABEL} mb-2 block text-ink-fade`}>
                  Type RESET to confirm
                </label>
                <input
                  id="confirmReset"
                  type="text"
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  placeholder="RESET"
                  className={`${INPUT} text-center font-data`}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-ink/30 p-4 sm:flex-row">
              <button
                type="button"
                onClick={handleCloseResetModal}
                disabled={resetting}
                className={`${BTN_OUTLINE} flex-1 justify-center py-2 disabled:opacity-50`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetCompetition}
                disabled={resetting || resetConfirmText.toLowerCase() !== 'reset'}
                className={`${BTN_PRIMARY} flex-1 py-2 text-base disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {resetting ? 'Resetting…' : 'Reset competition'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
          <div className={`${PANEL} w-full max-w-md`}>
            <div className="p-6">
              <p className={EYEBROW}>Confirm</p>
              <h3 className={`${HEADING} mt-1 text-2xl`}>Delete competition?</h3>

              <div className="mt-4 space-y-3 text-left">
                <div className="border border-overprint p-3">
                  <p className={`${LABEL} mb-2 text-overprint`}>This will permanently delete</p>
                  <ul className="list-disc space-y-0.5 pl-4 text-[12px] text-ink">
                    <li>The entire competition</li>
                    <li>All rounds, fixtures, and results</li>
                    <li>All picks and game history</li>
                  </ul>
                </div>

                <p className="text-center text-[14px] font-medium text-ink">
                  Are you absolutely sure? This cannot be undone.
                </p>
              </div>

              <div className="mt-4">
                <label htmlFor="confirmDelete" className={`${LABEL} mb-2 block text-ink-fade`}>
                  Type the competition name <span className="font-data normal-case text-ink">{competition?.name}</span> to confirm
                </label>
                <input
                  id="confirmDelete"
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={competition?.name}
                  className={`${INPUT} text-center font-data`}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-ink/30 p-4 sm:flex-row">
              <button
                type="button"
                onClick={handleCloseDeleteModal}
                disabled={deleting}
                className={`${BTN_OUTLINE} flex-1 justify-center py-2 disabled:opacity-50`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteCompetition}
                disabled={deleting || deleteConfirmText !== competition?.name}
                className={`${BTN_PRIMARY} flex-1 py-2 text-base disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {deleting ? 'Deleting…' : 'Delete competition'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
