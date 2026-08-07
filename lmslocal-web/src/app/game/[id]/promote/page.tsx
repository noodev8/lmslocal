'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  ClipboardDocumentIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  PrinterIcon,
  PhotoIcon
} from '@heroicons/react/24/outline';
import QRCode from 'qrcode';
import { promoteApi, roundApi, fixtureApi, Round } from '@/lib/api';
import { templates, replaceTemplateVariables, Template } from '@/lib/templates';
import { useToast, ToastContainer } from '@/components/Toast';
import { LABEL, EYEBROW, HEADING, PANEL, BTN_OUTLINE, BTN_DARK } from '@/lib/design';

interface PromoteData {
  competition: {
    id: number;
    name: string;
    status: string;
    invite_code: string;
    join_url: string;
    game_url: string;
    total_players: number;
    entry_fee?: number | null;
    prize_structure?: string | null;
    lives_per_player?: number;
  };
  current_round: {
    round_number: number;
    lock_time: string | null;
    lock_time_formatted: string | null;
    is_locked: boolean;
    fixture_count: number;
    completed_fixtures: number;
    next_round_info: {
      exists: boolean;
      round_number?: number;
      has_fixtures?: boolean;
      message: string | null;
    } | null;
  } | null;
  player_stats: {
    total_active_players: number;
    players_eliminated_this_round: number;
    pick_percentage: number;
    players_with_picks: number;
    players_without_picks: number;
  };
  top_players: Array<{
    display_name: string;
    lives_remaining: number;
  }>;
  template_context: {
    show_pre_launch: boolean;
    show_round_update: boolean;
    show_pick_reminder: boolean;
    show_winner: boolean;
    show_draw: boolean;
  };
}

export default function PromotePage() {
  const router = useRouter();
  const params = useParams();
  const competitionId = params.id as string;

  const [data, setData] = useState<PromoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fixturesLoading, setFixturesLoading] = useState(false);
  const [fixtures, setFixtures] = useState<Array<{
    home_team: string;
    away_team: string;
    kickoff_time?: string;
  }> | null>(null);
  const [fixtureResults, setFixtureResults] = useState<Array<{
    home_team: string;
    away_team: string;
    result: string | null;
    outcome: 'home_win' | 'away_win' | 'draw' | null;
    survivors: number;
    eliminated: number;
  }> | null>(null);
  const [unluckyPick, setUnluckyPick] = useState<{
    team: string;
    team_short: string;
    eliminated: number;
  } | null>(null);
  const [roundStats, setRoundStats] = useState<{
    total_players: number;
    won: number;
    lost: number;
    eliminated: number;
  } | null>(null);
  const [completedRoundNumber, setCompletedRoundNumber] = useState<number | null>(null);

  // Template selection and editing
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [editedContent, setEditedContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Facebook fixtures image generation
  const [generatingImage, setGeneratingImage] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  // Invite image generation
  const [generatingInviteImage, setGeneratingInviteImage] = useState(false);
  const [inviteImagePreviewUrl, setInviteImagePreviewUrl] = useState<string | null>(null);

  // Join QR code. Generated in the browser from the join URL - no server round trip, and it
  // stays correct automatically because it is built from the same join_url the templates use.
  const [joinQrCodeUrl, setJoinQrCodeUrl] = useState<string>('');

  const { toasts, showToast, removeToast } = useToast();

  useEffect(() => {
    // Simple auth check
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      router.push('/login');
      return;
    }

    // Fetch promote data
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await promoteApi.getPromoteData(parseInt(competitionId));

        if (response.data.return_code === 'SUCCESS') {
          setData({
            competition: response.data.competition!,
            current_round: response.data.current_round || null,
            player_stats: response.data.player_stats!,
            top_players: response.data.top_players || [],
            template_context: response.data.template_context!
          });
          setError(null);

          // 'H' error correction because this ends up printed, screenshotted and photographed
          // off a screen rather than scanned from a pristine display.
          try {
            setJoinQrCodeUrl(await QRCode.toDataURL(response.data.competition!.join_url, {
              width: 600,
              margin: 2,
              errorCorrectionLevel: 'H',
              color: { dark: '#000000', light: '#FFFFFF' }
            }));
          } catch (qrError) {
            // The URL is shown beside it, so a missing QR costs the organiser a convenience
            // rather than the ability to share.
            console.error('Error generating join QR code:', qrError);
          }
        } else {
          setError(response.data.message || 'Failed to load promotion data');
        }
      } catch (err) {
        console.error('Error fetching promote data:', err);
        setError('Network error - please check your connection');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router, competitionId]);

  // Fetch fixture results and round statistics when show_round_update is true
  useEffect(() => {
    if (data && data.template_context.show_round_update) {
      const fetchRoundData = async () => {
        try {
          // Get all rounds to find the most recently completed one
          const roundsResponse = await roundApi.getRounds(parseInt(competitionId));
          if (roundsResponse.data.return_code === 'SUCCESS' && roundsResponse.data.rounds) {
            // Find the most recently completed round (has status 'COMPLETE' or highest round number with results)
            const completedRound = roundsResponse.data.rounds
              .filter((r: Round) => r.status === 'COMPLETE')
              .sort((a: Round, b: Round) => b.round_number - a.round_number)[0];

            if (completedRound) {
              // Store the completed round number for template variable replacement
              setCompletedRoundNumber(completedRound.round_number);

              // Fetch fixture results for completed round
              const fixturesResponse = await promoteApi.getRoundResultsBreakdown(
                parseInt(competitionId),
                completedRound.round_number
              );

              if (fixturesResponse.data.return_code === 'SUCCESS' && fixturesResponse.data.fixture_results) {
                setFixtureResults(fixturesResponse.data.fixture_results);
                // Set unlucky pick if available (team that eliminated most players, >= 3, no tie)
                setUnluckyPick(fixturesResponse.data.unlucky_pick || null);
              }

              // Fetch round statistics for completed round
              const statsResponse = await promoteApi.getRoundStatistics(
                parseInt(competitionId),
                completedRound.id
              );

              if (statsResponse.data.return_code === 'SUCCESS' && statsResponse.data.statistics) {
                setRoundStats(statsResponse.data.statistics);
              }
            }
          }
        } catch (err) {
          console.error('Error fetching round data:', err);
        }
      };

      fetchRoundData();
    }
  }, [data, competitionId]);

  // Fetch fixtures when round is not locked and has fixtures
  // This is independent of pick reminder status - organizers can share fixtures even if all players have picked
  useEffect(() => {
    if (data && data.current_round && !data.current_round.is_locked && data.current_round.fixture_count > 0) {
      const fetchFixtures = async () => {
        try {
          setFixturesLoading(true);
          const roundsResponse = await roundApi.getRounds(parseInt(competitionId));
          if (roundsResponse.data.return_code === 'SUCCESS' && roundsResponse.data.rounds) {
            const currentRound = roundsResponse.data.rounds.find(
              (r: Round) => r.round_number === data.current_round?.round_number
            );

            if (currentRound && currentRound.id) {
              const fixturesResponse = await fixtureApi.get(currentRound.id.toString());
              if (fixturesResponse.data.return_code === 'SUCCESS' && fixturesResponse.data.fixtures) {
                setFixtures(fixturesResponse.data.fixtures);
              }
            }
          }
        } catch (err) {
          console.error('Error fetching fixtures:', err);
        } finally {
          setFixturesLoading(false);
        }
      };

      fetchFixtures();
    }
  }, [data, competitionId]);

  const handleTemplateSelect = (template: Template) => {
    if (!data) return;

    // For round_update templates, use the completed round number; otherwise use current round
    const roundNumberToUse = template.category === 'round_update'
      ? completedRoundNumber
      : data.current_round?.round_number || null;

    // Fill template with data
    const filledTemplate = replaceTemplateVariables(template.content, {
      competition_name: data.competition.name,
      round_number: roundNumberToUse,
      players_remaining: data.player_stats.total_active_players,
      players_eliminated: data.player_stats.players_eliminated_this_round,
      top_players: data.top_players,
      pick_deadline: data.current_round?.lock_time_formatted || null,
      next_round_info: data.current_round?.next_round_info?.message || null,
      join_code: data.competition.invite_code,
      join_url: data.competition.join_url,
      game_url: data.competition.game_url,
      total_players: data.competition.total_players,
      players_without_picks: data.player_stats.players_without_picks,
      pick_percentage: data.player_stats.pick_percentage,
      entry_fee: data.competition.entry_fee,
      prize_structure: data.competition.prize_structure,
      fixtures: fixtures || undefined,
      fixture_results: fixtureResults || undefined,
      round_stats: roundStats || undefined,
      lives_per_player: data.competition.lives_per_player,
      unlucky_pick: unluckyPick
    });

    setSelectedTemplate(template);
    setEditedContent(filledTemplate);
    setOriginalContent(filledTemplate);
    setCopied(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(editedContent);
    setCopied(true);
    showToast('Message copied! Paste it into WhatsApp, email, or any messaging app', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setEditedContent(originalContent);
    showToast('Template reset to original', 'success');
  };

  const handleGenerateFacebookImage = async () => {
    if (!data || !data.current_round || !fixtures || generatingImage) return;

    try {
      setGeneratingImage(true);

      // Call API to generate image
      const response = await fetch(`/api/generate-fixtures-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          competitionName: data.competition.name,
          roundNumber: data.current_round.round_number,
          lockTime: data.current_round.lock_time_formatted,
          fixtures: fixtures.map(f => ({
            home: f.home_team,
            away: f.away_team
          }))
        }),
      });

      // Check if we got an error response (JSON) or success (image)
      const contentType = response.headers.get('Content-Type');

      if (contentType?.includes('application/json')) {
        // Error response following API-Rules.md
        const errorData = await response.json();
        showToast(errorData.message || 'Failed to generate image', 'error');
        return;
      }

      // Success - we got an image
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setImagePreviewUrl(url);

      showToast('Image generated successfully!', 'success');
    } catch (error) {
      console.error('Error generating image:', error);
      showToast('Network error - please check your connection', 'error');
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleGenerateInviteImage = async () => {
    if (!data || generatingInviteImage) return;

    try {
      setGeneratingInviteImage(true);

      // Call API to generate invite image
      const response = await fetch(`/api/generate-invite-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          competitionName: data.competition.name,
          inviteCode: data.competition.invite_code,
          lockTime: data.current_round?.lock_time_formatted || null,
          entryFee: data.competition.entry_fee,
          prizeStructure: data.competition.prize_structure
        }),
      });

      // Check if we got an error response (JSON) or success (image)
      const contentType = response.headers.get('Content-Type');

      if (contentType?.includes('application/json')) {
        // Error response following API-Rules.md
        const errorData = await response.json();
        showToast(errorData.message || 'Failed to generate image', 'error');
        return;
      }

      // Success - we got an image
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setInviteImagePreviewUrl(url);

      showToast('Invitation image generated successfully!', 'success');
    } catch (error) {
      console.error('Error generating invite image:', error);
      showToast('Network error - please check your connection', 'error');
    } finally {
      setGeneratingInviteImage(false);
    }
  };

  const handleDownloadImage = () => {
    if (!imagePreviewUrl || !data) return;

    const link = document.createElement('a');
    link.href = imagePreviewUrl;
    link.download = `${data.competition.name}-Round-${data.current_round?.round_number}-Fixtures.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Image downloaded!', 'success');
  };

  const handleCloseImagePreview = () => {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImagePreviewUrl(null);
  };

  const handleDownloadJoinQr = () => {
    if (!joinQrCodeUrl || !data) return;

    const link = document.createElement('a');
    link.href = joinQrCodeUrl;
    link.download = `${data.competition.name}-Join-QR.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('QR code downloaded', 'success');
  };

  const handleCopyJoinUrl = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.competition.join_url);
      showToast('Join link copied', 'success');
    } catch {
      showToast('Could not copy the link', 'error');
    }
  };

  const handleDownloadInviteImage = () => {
    if (!inviteImagePreviewUrl || !data) return;

    const link = document.createElement('a');
    link.href = inviteImagePreviewUrl;
    link.download = `${data.competition.name}-Invitation.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Invitation image downloaded!', 'success');
  };

  const handleCloseInviteImagePreview = () => {
    if (inviteImagePreviewUrl) {
      URL.revokeObjectURL(inviteImagePreviewUrl);
    }
    setInviteImagePreviewUrl(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stock font-body text-ink">
        <ToastContainer toasts={toasts} onClose={removeToast} />
        <header className="border-b border-ink/30">
          <div className="mx-auto flex max-w-3xl items-center px-4 py-4 sm:px-6">
            <Link href={`/game/${competitionId}`} className={`${LABEL} flex items-center gap-1.5 text-ink-fade transition-colors hover:text-ink`}>
              <ArrowLeftIcon className="h-4 w-4" />
              Back to competition
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <div className={`${PANEL} p-8 text-center`}>
            <div className="mb-4 inline-flex h-8 w-8 animate-spin items-center justify-center rounded-full border-2 border-ink border-t-transparent" />
            <p className={EYEBROW}>Loading</p>
            <p className="mt-2 text-[17px] text-ink-fade">Fetching your marketing tools&hellip;</p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-stock font-body text-ink">
        <ToastContainer toasts={toasts} onClose={removeToast} />
        <header className="border-b border-ink/30">
          <div className="mx-auto flex max-w-3xl items-center px-4 py-4 sm:px-6">
            <Link href={`/game/${competitionId}`} className={`${LABEL} flex items-center gap-1.5 text-ink-fade transition-colors hover:text-ink`}>
              <ArrowLeftIcon className="h-4 w-4" />
              Back to competition
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <div className={`${PANEL} p-8 text-center`}>
            <p className={`${HEADING} text-2xl`}>Error loading data</p>
            <p className="mt-2 text-[15px] text-ink-fade">{error || 'Failed to load promotion data'}</p>
            <Link href={`/game/${competitionId}`} className={`${BTN_DARK} mt-5 inline-flex items-center gap-2 px-5 py-2.5 text-base`}>
              <ArrowLeftIcon className="h-4 w-4" />
              Back to competition
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stock font-body text-ink">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <header className="border-b border-ink/30">
        <div className="mx-auto flex max-w-3xl items-center px-4 py-4 sm:px-6">
          <Link href={`/game/${competitionId}`} className={`${LABEL} flex items-center gap-1.5 text-ink-fade transition-colors hover:text-ink`}>
            <ArrowLeftIcon className="h-4 w-4" />
            Back to competition
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-8 sm:px-6 sm:py-10">

        <div>
          <p className={EYEBROW}>Promote</p>
          <h1 className={`${HEADING} mt-1 text-3xl`}>Share your competition</h1>
          <p className="mt-1 text-[15px] text-ink-fade">Choose a template, customise it, and share with your players.</p>
        </div>

        {/* Promotional Leaflet - Only show before round 1 locks or if in round 1 */}
        {(!data.current_round ||
          (data.current_round.round_number === 1 && !data.current_round.is_locked) ||
          data.current_round.round_number < 1) && (
          <div className={`${PANEL} flex items-center justify-between gap-4 p-5 sm:p-6`}>
            <div>
              <p className={`${HEADING} text-xl`}>Promotional leaflet</p>
              <p className="mt-1 text-[14px] text-ink-fade">Print-ready A4 leaflet for pubs and venues</p>
            </div>
            <Link
              href={`/leaflet/${competitionId}`}
              className={`${BTN_DARK} flex-shrink-0 inline-flex items-center gap-2 px-5 py-2.5 text-base`}
            >
              <PrinterIcon className="h-4 w-4" />
              View &amp; print
            </Link>
          </div>
        )}

        {/*
          Join QR - shown on the same terms as the leaflet, because it is the same artifact in a
          different form: something an organiser sticks on their own poster, puts on the pub TV,
          or posts to Facebook. Hidden once joining closes, since a QR nobody can act on is worse
          than none.
        */}
        {(!data.current_round ||
          (data.current_round.round_number === 1 && !data.current_round.is_locked) ||
          data.current_round.round_number < 1) && (
          <div className={`${PANEL} p-5 sm:p-6`}>
            <p className={`${HEADING} text-xl`}>Join QR code</p>
            <p className="mt-1 text-[14px] text-ink-fade">Put it on a poster, a screen, or a social post</p>

            <div className="mt-4 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
              <div className="border border-ink/30 bg-white p-3">
                {joinQrCodeUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={joinQrCodeUrl} alt="QR code to join this competition" className="h-[160px] w-[160px]" />
                ) : (
                  <div className="h-[160px] w-[160px] animate-pulse bg-ink/10" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className={`${LABEL} text-ink-fade`}>Scanning it opens</p>
                <p className="mt-1 break-all font-data text-[15px] text-ink">{data.competition.join_url}</p>
                <p className="mt-3 text-[14px] text-ink-fade">
                  Anyone who scans goes straight to the join page — no code to type, no app to
                  install.
                </p>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    onClick={handleDownloadJoinQr}
                    disabled={!joinQrCodeUrl}
                    className={`${BTN_DARK} inline-flex items-center gap-2 px-5 py-2.5 text-base disabled:opacity-50`}
                  >
                    <PhotoIcon className="h-4 w-4" />
                    Download QR
                  </button>
                  <button
                    onClick={handleCopyJoinUrl}
                    className={`${BTN_OUTLINE} inline-flex items-center gap-2 px-5 py-2.5 text-base`}
                  >
                    <ClipboardDocumentIcon className="h-4 w-4" />
                    Copy link
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Invitation Image for Social Media - Only show before round 1 locks or if in round 1 */}
        {(!data.current_round ||
          (data.current_round.round_number === 1 && !data.current_round.is_locked) ||
          data.current_round.round_number < 1) && (
          <div className={`${PANEL} p-5 sm:p-6`}>
            <p className={`${HEADING} text-xl`}>Invitation image</p>
            <p className="mt-1 text-[14px] text-ink-fade">Share on Facebook, Instagram, or X</p>

            {!inviteImagePreviewUrl ? (
              <button
                onClick={handleGenerateInviteImage}
                disabled={generatingInviteImage}
                className={`${BTN_DARK} mt-4 flex w-full items-center justify-center gap-2 px-6 py-3 text-base disabled:opacity-50`}
              >
                {generatingInviteImage ? (
                  <>
                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                    Generating invitation&hellip;
                  </>
                ) : (
                  <>
                    <PhotoIcon className="h-5 w-5" />
                    Generate invitation
                  </>
                )}
              </button>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="border border-ink/30">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={inviteImagePreviewUrl} alt="Invitation preview" className="h-auto w-full" />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleDownloadInviteImage}
                    className={`${BTN_DARK} flex flex-1 items-center justify-center gap-2 px-6 py-3 text-base`}
                  >
                    Download PNG
                  </button>
                  <button onClick={handleCloseInviteImagePreview} className={`${BTN_OUTLINE} px-6 py-3`}>
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* WhatsApp Messages Section */}
        {(() => {
          // Get all visible templates based on template_context
          const visibleTemplates = templates.filter(template => {
            if (template.category === 'pre_launch') return data.template_context.show_pre_launch;
            if (template.category === 'pick_reminder') return data.template_context.show_pick_reminder;
            if (template.category === 'round_update') return data.template_context.show_round_update;
            if (template.category === 'winner') return data.template_context.show_winner;
            if (template.category === 'draw') return data.template_context.show_draw;
            return false;
          });

          if (visibleTemplates.length === 0) {
            return null;
          }

          return (
            <div className={`${PANEL} p-5 sm:p-6`}>
              <p className={`${HEADING} text-xl`}>WhatsApp messages</p>
              <p className="mt-1 text-[14px] text-ink-fade">Copy messages for your players</p>

              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {visibleTemplates.map((template) => {
                  const isPickReminder = template.category === 'pick_reminder';
                  const isDisabled = isPickReminder && fixturesLoading;

                  return (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateSelect(template)}
                      disabled={isDisabled}
                      className={`${LABEL} flex items-center justify-center gap-2 border px-4 py-3 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                        selectedTemplate?.id === template.id
                          ? 'border-ink bg-ink text-stock-lit'
                          : 'border-ink/30 text-ink hover:border-ink'
                      }`}
                    >
                      {isDisabled ? (
                        <>
                          <ArrowPathIcon className="h-4 w-4 animate-spin" />
                          {template.name}
                        </>
                      ) : (
                        <>
                          <ClipboardDocumentIcon className="h-4 w-4" />
                          {template.name}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>

              <p className="mt-4 border-t border-ink/30 pt-3 text-[13px] text-ink-fade">
                Tap a message, edit it, then copy to your clipboard and paste into WhatsApp.
              </p>
            </div>
          );
        })()}

        {/* Edit Area (shows when template is selected) */}
        {selectedTemplate && (
          <div className={`${PANEL} p-5 sm:p-6`}>
            <p className={`${HEADING} text-xl`}>Edit your message</p>
            <p className="mt-1 text-[14px] text-ink-fade">Customise the template below, then copy to share</p>

            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="mt-4 h-64 w-full resize-none rounded-sm border border-ink bg-transparent p-4 text-[15px] text-ink focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              placeholder="Your message will appear here…"
            />

            <div className="mt-4 flex items-center justify-between">
              <p className="text-[13px] text-ink-fade">{editedContent.length} characters</p>

              <div className="flex items-center gap-3">
                <button onClick={handleReset} className={`${BTN_OUTLINE} flex items-center gap-1.5`}>
                  <ArrowPathIcon className="h-4 w-4" />
                  Reset
                </button>

                <button
                  onClick={handleCopy}
                  className={`${BTN_DARK} flex items-center gap-2 px-6 py-2 text-base`}
                >
                  {copied ? (
                    <>
                      <CheckCircleIcon className="h-5 w-5" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <ClipboardDocumentIcon className="h-5 w-5" />
                      Copy to clipboard
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Social Media Fixtures Image Section */}
        {data.current_round &&
         !data.current_round.is_locked &&
         data.current_round.fixture_count > 0 &&
         fixtures && (
          <div className={`${PANEL} p-5 sm:p-6`}>
            <p className={`${HEADING} text-xl`}>Fixtures image</p>
            <p className="mt-1 text-[14px] text-ink-fade">Share on Facebook, Instagram, or X</p>

            {!imagePreviewUrl ? (
              <button
                onClick={handleGenerateFacebookImage}
                disabled={generatingImage}
                className={`${BTN_DARK} mt-4 flex w-full items-center justify-center gap-2 px-6 py-3 text-base disabled:opacity-50`}
              >
                {generatingImage ? (
                  <>
                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                    Generating image&hellip;
                  </>
                ) : (
                  <>
                    <PhotoIcon className="h-5 w-5" />
                    Generate fixtures image
                  </>
                )}
              </button>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="border border-ink/30">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePreviewUrl} alt="Fixtures preview" className="h-auto w-full" />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleDownloadImage}
                    className={`${BTN_DARK} flex flex-1 items-center justify-center gap-2 px-6 py-3 text-base`}
                  >
                    Download PNG
                  </button>
                  <button onClick={handleCloseImagePreview} className={`${BTN_OUTLINE} px-6 py-3`}>
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
