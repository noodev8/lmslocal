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

// Template tone colors
const toneColors: Record<string, string> = {
  casual: 'bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-300',
  excited: 'bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-300',
  dramatic: 'bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-300',
  professional: 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-300',
  gentle: 'bg-green-100 text-green-700 hover:bg-green-200 border-green-300',
  urgent: 'bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-300',
  critical: 'bg-red-100 text-red-700 hover:bg-red-200 border-red-300'
};

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

  // Fetch fixtures when pick reminders are shown
  useEffect(() => {
    if (data && data.template_context.show_pick_reminder && data.current_round) {
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
      fixtures: fixtures || undefined,
      fixture_results: fixtureResults || undefined,
      round_stats: roundStats || undefined
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
            <div className="p-2 bg-gray-100 rounded-lg">
              <MegaphoneIcon className="h-6 w-6 text-gray-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Promote Your Competition</h1>
          </div>
          <p className="text-gray-600 text-sm">
            Choose a template, customize it, and share with your players
          </p>
        </div>

        {/* Competition Info Card */}
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">{data.competition.name}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-500">Status</div>
              <div className="font-medium text-gray-900 capitalize">{data.competition.status}</div>
            </div>
            {data.current_round && (
              <div>
                <div className="text-gray-500">Round</div>
                <div className="font-medium text-gray-900">{data.current_round.round_number}</div>
              </div>
            )}
            <div>
              <div className="text-gray-500">Active Players</div>
              <div className="font-medium text-gray-900">{data.player_stats.total_active_players}</div>
            </div>
            <div>
              <div className="text-gray-500">Total Players</div>
              <div className="font-medium text-gray-900">{data.competition.total_players}</div>
            </div>
          </div>
        </div>

        {/* Template Buttons */}
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
            return (
              <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-8">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-50 rounded-full mb-4">
                    <MegaphoneIcon className="h-8 w-8 text-blue-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-3">No Marketing Templates Available Right Now</h2>
                  <p className="text-gray-600 mb-4 max-w-md mx-auto">
                    Templates will appear here at the right moments during your competition.
                  </p>
                </div>
              </div>
            );
          }

          return (
            <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-4">Select a Template</h3>
              <div className="flex flex-wrap gap-3">
                {visibleTemplates.map((template) => {
                  const colorClass = toneColors[template.tone || 'casual'] || toneColors.casual;
                  const isSelected = selectedTemplate?.id === template.id;
                  const isPickReminder = template.category === 'pick_reminder';
                  const isDisabled = isPickReminder && fixturesLoading;

                  return (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateSelect(template)}
                      disabled={isDisabled}
                      className={`px-4 py-2 rounded-full font-medium text-sm border-2 transition-all ${
                        isSelected
                          ? 'ring-2 ring-offset-2 ring-gray-400'
                          : ''
                      } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''} ${colorClass}`}
                    >
                      {isDisabled ? (
                        <span className="flex items-center gap-2">
                          <ArrowPathIcon className="h-4 w-4 animate-spin" />
                          {template.name}
                        </span>
                      ) : (
                        template.name
                      )}
                    </button>
                  );
                })}
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
                      ? 'bg-green-100 text-green-700 border-2 border-green-300'
                      : 'bg-gray-800 text-white hover:bg-gray-900'
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

        {/* Help Section */}
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
          <h3 className="font-semibold text-blue-900 mb-2">💡 How to Use</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Click any template pill to load it</li>
            <li>• Edit the message to match your style</li>
            <li>• Click &quot;Copy to Clipboard&quot; when ready</li>
            <li>• Paste into WhatsApp, Facebook, email, or SMS</li>
          </ul>
        </div>

      </main>
    </div>
  );
}
