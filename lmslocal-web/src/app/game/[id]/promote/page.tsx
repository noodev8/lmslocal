'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  MegaphoneIcon,
  ClipboardDocumentIcon,
  CheckCircleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { promoteApi, roundApi, fixtureApi, Round } from '@/lib/api';
import { templates, replaceTemplateVariables, Template } from '@/lib/templates';
import { useToast, ToastContainer } from '@/components/Toast';

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

  // Facebook image generation
  const [generatingImage, setGeneratingImage] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <ToastContainer toasts={toasts} onClose={removeToast} />
        <header className="bg-white border-b border-gray-100">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <Link href={`/game/${competitionId}`} className="flex items-center space-x-2 text-gray-500 hover:text-gray-700">
              <ArrowLeftIcon className="h-4 w-4" />
              <span className="text-sm font-medium">Back to Competition</span>
            </Link>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-6">
          <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-8">
            <div className="flex items-center justify-center">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-50 rounded-full mb-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-600 border-t-transparent"></div>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Loading Marketing Tools</h3>
                <p className="text-gray-500">Please wait...</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50">
        <ToastContainer toasts={toasts} onClose={removeToast} />
        <header className="bg-white border-b border-gray-100">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <Link href={`/game/${competitionId}`} className="flex items-center space-x-2 text-gray-500 hover:text-gray-700">
              <ArrowLeftIcon className="h-4 w-4" />
              <span className="text-sm font-medium">Back to Competition</span>
            </Link>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-6">
          <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-8">
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Data</h3>
              <p className="text-gray-500 mb-4">{error || 'Failed to load promotion data'}</p>
              <Link href={`/game/${competitionId}`} className="inline-flex items-center space-x-2 px-4 py-2 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-900 transition-colors text-sm">
                <ArrowLeftIcon className="h-4 w-4" />
                <span>Back to Competition</span>
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      {/* Header */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link href={`/game/${competitionId}`} className="flex items-center space-x-2 text-gray-500 hover:text-gray-700">
            <ArrowLeftIcon className="h-4 w-4" />
            <span className="text-sm font-medium">Back to Competition</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* Page Title */}
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-slate-100 rounded-lg">
              <MegaphoneIcon className="h-6 w-6 text-slate-700" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Promote Your Competition</h1>
          </div>
          <p className="text-gray-600 text-sm">
            Choose a template, customize it, and share with your players
          </p>
        </div>

        {/* Promotional Leaflet - Only show before round 1 locks or if in round 1 */}
        {(!data.current_round ||
          (data.current_round.round_number === 1 && !data.current_round.is_locked) ||
          data.current_round.round_number < 1) && (
          <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Promotional Leaflet</h3>
                <p className="text-sm text-gray-600">
                  Print-ready A4 leaflet for pubs and venues
                </p>
              </div>
              <Link
                href={`/leaflet/${competitionId}`}
                className="inline-flex items-center space-x-2 px-6 py-3 bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                <span>View & Print</span>
              </Link>
            </div>
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
            return false;
          });

          if (visibleTemplates.length === 0) {
            return null;
          }

          return (
            <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <svg className="h-6 w-6 text-slate-700" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">WhatsApp Messages</h3>
                  <p className="text-sm text-gray-600">
                    Copy messages for your players
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                {visibleTemplates.map((template) => {
                  const isPickReminder = template.category === 'pick_reminder';
                  const isDisabled = isPickReminder && fixturesLoading;

                  return (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateSelect(template)}
                      disabled={isDisabled}
                      className="flex items-center justify-center space-x-2 px-6 py-3 bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isDisabled ? (
                        <>
                          <ArrowPathIcon className="h-5 w-5 animate-spin" />
                          <span>{template.name}</span>
                        </>
                      ) : (
                        <>
                          <ClipboardDocumentIcon className="h-5 w-5" />
                          <span>{template.name}</span>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Quick Help */}
              <div className="text-xs text-gray-600 border-t border-gray-200 pt-3">
                Click a button, edit the message, then copy to your clipboard and paste into WhatsApp
              </div>
            </div>
          );
        })()}

        {/* Edit Area (shows when template is selected) */}
        {selectedTemplate && (
          <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                Edit Your Message
              </h3>
              <p className="text-sm text-gray-600">
                Customize the template below, then copy to share
              </p>
            </div>

            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="w-full h-64 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 font-sans text-sm resize-none"
              placeholder="Your message will appear here..."
            />

            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                {editedContent.length} characters
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={handleReset}
                  className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <ArrowPathIcon className="h-4 w-4" />
                  <span>Reset</span>
                </button>

                <button
                  onClick={handleCopy}
                  className={`flex items-center space-x-2 px-6 py-2 rounded-lg font-medium transition-all ${
                    copied
                      ? 'bg-slate-100 text-slate-700 border-2 border-slate-300'
                      : 'bg-slate-700 text-white hover:bg-slate-800'
                  }`}
                >
                  {copied ? (
                    <>
                      <CheckCircleIcon className="h-5 w-5" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <ClipboardDocumentIcon className="h-5 w-5" />
                      <span>Copy to Clipboard</span>
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
          <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-slate-100 rounded-lg">
                <svg className="h-6 w-6 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Fixtures Image</h3>
                <p className="text-sm text-gray-600">
                  Share on Facebook, Instagram, or X
                </p>
              </div>
            </div>

            {!imagePreviewUrl ? (
              <button
                onClick={handleGenerateFacebookImage}
                disabled={generatingImage}
                className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generatingImage ? (
                  <>
                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                    <span>Generating Image...</span>
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>Fixtures</span>
                  </>
                )}
              </button>
            ) : (
              <div className="space-y-4">
                <div className="border-2 border-gray-200 rounded-lg overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreviewUrl}
                    alt="Fixtures preview"
                    className="w-full h-auto"
                  />
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleDownloadImage}
                    className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>Download PNG</span>
                  </button>
                  <button
                    onClick={handleCloseImagePreview}
                    className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                  >
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
