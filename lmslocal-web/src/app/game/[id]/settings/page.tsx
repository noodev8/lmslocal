'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { competitionApi, UpdateCompetitionRequest, ResetCompetitionRequest, ResetQuoteResponse, DeleteCompetitionRequest, StartOption } from '@/lib/api';
import StartDateChooser from '@/components/StartDateChooser';
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
  const [resetQuote, setResetQuote] = useState<ResetQuoteResponse | null>(null);
  // 'price' is the cost on its own; 'detail' is what a reset does plus type-to-confirm.
  const [resetStep, setResetStep] = useState<'price' | 'detail'>('price');
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [resetQuoteError, setResetQuoteError] = useState<string | null>(null);

  // The start date for the round 1 a reset rebuilds. Null is legitimate - the calendar may have
  // nothing far enough ahead - and the reset then falls back to waiting on Ready.
  const [resetStartOption, setResetStartOption] = useState<StartOption | null>(null);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  // Set once the delete succeeds and never cleared. `deleting` cannot do this job: it is reset in
  // a finally block that runs before the navigation timeout fires.
  const [deleted, setDeleted] = useState(false);

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

  // Guards the form-populating effect below so a background competitions refresh (e.g. the one
  // handleSave triggers after saving) can't stomp over an in-progress edit by re-running with a
  // new `competition` object reference. Only re-populate when we switch to a different competition.
  const initializedForIdRef = useRef<string | null>(null);

  // Who supplies fixtures and results is fixed at creation. Switching mid-competition has
  // knock-on effects on rounds, lock times and the staged batch that are not settled yet, so
  // it is changed in the database on request rather than offered here.

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

          // Only populate the form the first time we see this competition - a later refresh
          // (e.g. triggered by our own save) must not overwrite an in-progress edit.
          if (initializedForIdRef.current !== competitionId) {
            initializedForIdRef.current = competitionId;

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
          }

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

      // Name is required, so only send it when non-empty - the backend rejects a blank one.
      if (formData.name.trim()) {
        updateData.name = formData.name.trim();
      }

      // Every optional text field is sent unconditionally, including when empty. Omitting a
      // field means "leave it alone" to update-competition, so a field that was only sent when
      // non-empty could be changed but never cleared - emptying it silently restored the old
      // value on the next load. The backend maps '' to NULL.
      updateData.description = formData.description.trim();
      updateData.venue_name = formData.venue_name.trim();
      updateData.address_line_1 = formData.address_line_1.trim();
      updateData.address_line_2 = formData.address_line_2.trim();
      updateData.city = formData.city.trim();
      updateData.postcode = formData.postcode.trim();
      updateData.phone = formData.phone.trim();
      updateData.email = formData.email.trim();
      updateData.prize_structure = formData.prize_structure.trim();

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

  /*
   * What starting again will cost, fetched when the modal opens so the price is on screen before
   * the button rather than arriving as a surprise debit. Re-fetched on every open, so an organiser
   * who closes the dialog, removes a player and comes back sees the lower number.
   */
  const loadResetQuote = async (competitionIdToQuote: number) => {
    setResetQuote(null);
    setQuoteLoading(true);
    try {
      const response = await competitionApi.getResetQuote({ competition_id: competitionIdToQuote });
      if (response.data.return_code === 'SUCCESS') {
        setResetQuote(response.data);
      } else {
        setResetQuoteError(response.data.message || 'Could not work out what starting again will cost');
      }
    } catch (err) {
      console.error('Reset quote error:', err);
      setResetQuoteError('Could not work out what starting again will cost');
    } finally {
      setQuoteLoading(false);
    }
  };

  const handleOpenResetModal = () => {
    if (!competition) return;
    setResetQuoteError(null);
    setResetStep('price');
    setShowResetModal(true);
    loadResetQuote(competition.id);
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
        // The figure they actually saw. The server refuses rather than charging above it.
        ...(resetQuote ? { quoted_cost: resetQuote.cost } : {}),
        // The date they picked for the new round 1. Omitted when the calendar had nothing to
        // offer, which puts the competition back to waiting on Ready instead.
        ...(resetStartOption ? { start_block_id: resetStartOption.block_id } : {}),
      };

      const response = await competitionApi.reset(resetData);

      if (response.data.return_code === 'SUCCESS') {
        // Reset successful - clear cache and refresh data
        // Clear all relevant caches to ensure fresh data after reset
        const { cacheUtils } = await import('@/lib/api');
        cacheUtils.invalidateCompetitions();

        // One call covers standings, status, players, pick statistics, rounds and allowed teams.
        // Several of the individual keys above never matched: standings and players carry
        // pagination and filters on the end, so they can only be cleared by prefix.
        cacheUtils.invalidateCompetition(competition.id);

        refreshCompetitions();

        // Close modal and reset form
        setShowResetModal(false);
        setResetConfirmText('');

        // Small delay to ensure context updates before navigation
        setTimeout(() => {
          // /game/[id] IS the competition dashboard - there is no /dashboard child route, so the
          // old path 404'd on every successful reset. The competition still exists after a reset;
          // only its contents are gone, so this goes back to the competition rather than out to
          // the competition list the way delete does.
          router.push(`/game/${competitionId}`);
        }, 200);
      } else {
        setError(response.data.message || 'Failed to reset competition');

        /*
         * Both billing refusals mean the number on screen is out of date - either someone joined
         * while they were confirming, or the balance moved. Re-fetch so they are looking at the
         * real figure rather than the one that just failed.
         */
        if (response.data.return_code === 'INSUFFICIENT_CREDITS' || response.data.return_code === 'QUOTE_STALE') {
          // Back to the price screen, not just a refreshed number behind a confirm box. The
          // figure they agreed to is no longer the figure, so it has to be read again.
          setResetStep('price');
          setResetConfirmText('');
          loadResetQuote(competition.id);
        }
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
    setResetQuote(null);
    setResetQuoteError(null);
    setResetStep('price');
  };

  /*
   * Whether the price gets its own screen before the detail.
   *
   * Only when there is a price to show. A free reset skips straight to the detail, so an
   * organiser inside their free allowance sees exactly the dialog they saw before this change -
   * no extra click, and nothing implying a charge that is not happening.
   *
   * When the quote could not be fetched at all, the price step is skipped too rather than
   * blocking on a number we do not have. That is safe: the price is authoritatively recalculated
   * inside the reset transaction, so the worst case is the server refusing with
   * INSUFFICIENT_CREDITS and deleting nothing - a better failure than an organiser unable to
   * reset their own competition because one read-only call did not answer.
   */
  const showPriceStep = resetStep === 'price' && !!resetQuote && resetQuote.cost > 0;

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
        // Before refreshCompetitions() drops it from the context - see the `deleted` branch in
        // the render, which this keeps from flashing "Competition not found".
        setDeleted(true);

        // Delete successful - clear all caches
        const { cacheUtils } = await import('@/lib/api');
        cacheUtils.invalidateCompetitions();

        // One call covers standings, status, players, pick statistics, rounds and allowed teams.
        // Several of the individual keys above never matched: standings and players carry
        // pagination and filters on the end, so they can only be cleared by prefix.
        cacheUtils.invalidateCompetition(competition.id);

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

  /*
   * A just-deleted competition is not a missing one.
   *
   * handleDeleteCompetition calls refreshCompetitions() and then navigates on a timeout. In the
   * gap between those two, the context has already dropped the competition, so `competition`
   * goes undefined and this branch rendered "Competition not found" for a tenth of a second
   * before the redirect landed - reading as a 404 flash on a successful delete.
   *
   * `deleted` is set on success and never cleared, so we hold the transitional screen below
   * instead of accusing the organiser of visiting something that does not exist.
   */
  if (deleted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stock font-body text-ink">
        <div className="text-center">
          <div className="mb-4 inline-flex h-8 w-8 animate-spin items-center justify-center rounded-full border-2 border-ink border-t-transparent" />
          <p className={EYEBROW}>Deleted</p>
          <p className="mt-2 text-[17px] text-ink-fade">Taking you back to your competitions&hellip;</p>
        </div>
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
                <div className="grid grid-cols-2 gap-3">
                  {[0, 1].map((lives) => (
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
                          {lives === 0 ? 'Knockout' : 'Life'}
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
                  onClick={handleOpenResetModal}
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

      {/*
        Reset Confirmation Modal - TWO STEPS when the reset costs something.

        The price used to sit at the bottom of the existing dialog, below two bulleted lists and
        a "this cannot be undone" line. It was the fourth thing on the screen and the least likely
        to be read, which is exactly backwards: the delete/preserve lists describe what a reset has
        always done, while the charge is the new fact and the only one that costs money.

        So the price gets a screen of its own, first, with nothing competing with it. Only once
        the organiser presses Continue do they see the detail and the type-to-confirm.

        When the reset is free there is no price step at all - it opens straight onto the detail,
        exactly as it did before this change.
      */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
          <div className={`${PANEL} w-full max-w-md`}>

            {/* Step 0: waiting on the quote. Deliberately does NOT render the detail underneath -
                showing the busy screen first and then replacing it with the price would train the
                organiser to click past the thing we most want them to read. */}
            {quoteLoading && (
              <div className="p-6">
                <p className={EYEBROW}>Confirm</p>
                <h3 className={`${HEADING} mt-1 text-2xl`}>Reset competition?</h3>
                <p className="mt-4 text-[13px] text-ink-fade">Working out what this will use…</p>
              </div>
            )}

            {/* Step 1: the price, on its own. */}
            {!quoteLoading && showPriceStep && resetQuote && (
              <>
                <div className="p-6">
                  <p className={EYEBROW}>Before you start again</p>
                  <h3 className={`${HEADING} mt-1 text-2xl`}>
                    {resetQuote.affordable
                      ? `Starting again costs ${resetQuote.cost} ${resetQuote.cost === 1 ? 'credit' : 'credits'}`
                      : `You need ${resetQuote.cost} ${resetQuote.cost === 1 ? 'credit' : 'credits'}`}
                  </h3>

                  {/* The sum, not a sentence about the sum. The heading already says the price;
                      repeating it in prose underneath was the first thing that made this screen
                      unreadable. Three figures let the organiser check the arithmetic at a glance. */}
                  <dl className="mt-4 border border-ink/30 text-[14px]">
                    <div className="flex items-center justify-between border-b border-ink/15 px-3 py-2">
                      <dt className="text-ink-fade">Credits now</dt>
                      <dd className="font-data text-ink">{resetQuote.balance}</dd>
                    </div>
                    <div className="flex items-center justify-between border-b border-ink/15 px-3 py-2">
                      <dt className="text-ink-fade">
                        {resetQuote.chargeable_players}{' '}
                        {resetQuote.chargeable_players === 1 ? 'player' : 'players'} back in
                      </dt>
                      <dd className="font-data text-overprint">−{resetQuote.cost}</dd>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2">
                      <dt className="font-medium text-ink">
                        {resetQuote.affordable ? 'Left after' : 'Short by'}
                      </dt>
                      <dd className="font-data font-medium text-ink">
                        {resetQuote.affordable
                          ? resetQuote.balance - resetQuote.cost
                          : resetQuote.cost - resetQuote.balance}
                      </dd>
                    </div>
                  </dl>

                  {resetQuote.affordable ? (
                    /* The escape hatch, in two short lines rather than one long one. An organiser
                       who only knows about the first will rebuild a competition from scratch to
                       avoid a charge they could have undone in one click. */
                    <div className="mt-4 space-y-2 text-[14px] text-ink-fade">
                      <p>Everyone stays in, and each of them costs a credit.</p>
                      <p>
                        Someone not playing? Remove them first and you won&apos;t spend a credit on
                        them. Remove them later — any time before the game starts — and the credit
                        comes back.
                      </p>
                    </div>
                  ) : (
                    /* Billing is named in words, not linked. A dialog that sends someone to
                       Stripe owns getting them back, and the return trip cannot be made
                       reliable - see docs/reset-billing.md §7. */
                    <div className="mt-4 space-y-2 text-[14px] text-ink-fade">
                      <p>Everyone stays in, and each of them costs a credit.</p>
                      <p>Buy more credits from Billing, or remove players who aren&apos;t playing.</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-3 border-t border-ink/30 p-4 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleCloseResetModal}
                    className={`${BTN_OUTLINE} flex-1 justify-center py-2`}
                  >
                    {resetQuote.affordable ? 'Cancel' : 'Close'}
                  </button>
                  {resetQuote.affordable && (
                    <button
                      type="button"
                      onClick={() => setResetStep('detail')}
                      className={`${BTN_PRIMARY} flex-1 py-2 text-base`}
                    >
                      Agree
                    </button>
                  )}
                </div>
              </>
            )}

            {/* Step 2: what a reset does, and the type-to-confirm. Unchanged from before, minus
                the price - which has already been read by the time anyone gets here. */}
            {!quoteLoading && !showPriceStep && (
              <>
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

                  {/* A one-line reminder of the price they agreed to on the previous screen, so
                      the figure is still on screen at the moment they commit to it. */}
                  {resetQuote && resetQuote.cost > 0 && (
                    <p className="mt-4 text-center text-[13px] text-ink-fade">
                      Costs {resetQuote.cost} {resetQuote.cost === 1 ? 'credit' : 'credits'},
                      leaving you {resetQuote.balance - resetQuote.cost}.
                    </p>
                  )}

                  {resetQuoteError && (
                    <p className="mt-4 border border-overprint p-3 text-[13px] text-overprint">
                      {resetQuoteError}
                    </p>
                  )}

                  {/* A reset empties the competition back to nothing, which is the same situation
                      as creating one: an empty screen that players are about to be invited into.
                      So it asks the same question, with the same three dates - and the new round 1
                      is built the moment the reset goes through. See docs/competition-start.md.

                      The chooser handles having nothing to offer, in which case start_block_id is
                      omitted below and the competition falls back to waiting on Ready. */}
                  {competition?.fixture_service === true && (
                    <div className="mt-4">
                      <StartDateChooser
                        teamListId={competition.team_list_id}
                        value={resetStartOption}
                        onChange={setResetStartOption}
                        disabled={resetting}
                      />
                    </div>
                  )}

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
              </>
            )}
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
