'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  MegaphoneIcon,
  ClipboardDocumentIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { promoteApi } from '@/lib/api';
import { templates, replaceTemplateVariables, Template } from '@/lib/templates';
import { useToast, ToastContainer } from '@/components/Toast';

interface PromoteData {
  competition: {
    id: number;
    name: string;
    status: string;
    invite_code: string;
    join_url: string;
    total_players: number;
  };
  current_round: {
    round_number: number;
    lock_time: string | null;
    lock_time_formatted: string | null;
    is_locked: boolean;
    fixture_count: number;
    completed_fixtures: number;
    next_round_start: string | null;
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
    show_weekly_update: boolean;
    show_pick_reminder: boolean;
    show_results: boolean;
    show_elimination: boolean;
    show_final_hype: boolean;
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
  const [copiedTemplateId, setCopiedTemplateId] = useState<string | null>(null);

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

  const handleCopyTemplate = (template: Template) => {
    if (!data) return;

    // Replace variables with actual data
    const filledTemplate = replaceTemplateVariables(template.content, {
      competition_name: data.competition.name,
      round_number: data.current_round?.round_number || null,
      players_remaining: data.player_stats.total_active_players,
      players_eliminated: data.player_stats.players_eliminated_this_round,
      top_players: data.top_players,
      pick_deadline: data.current_round?.lock_time_formatted || null,
      next_round_start: data.current_round?.next_round_start || null,
      join_code: data.competition.invite_code,
      join_url: data.competition.join_url,
      total_players: data.competition.total_players,
      players_without_picks: data.player_stats.players_without_picks,
      pick_percentage: data.player_stats.pick_percentage
    });

    // Copy to clipboard
    navigator.clipboard.writeText(filledTemplate);

    // Show feedback
    setCopiedTemplateId(template.id);
    showToast('Template copied! Paste it into WhatsApp, email, or any messaging app', 'success');

    // Reset after 2 seconds
    setTimeout(() => {
      setCopiedTemplateId(null);
    }, 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <ToastContainer toasts={toasts} onClose={removeToast} />

        <header className="bg-white border-b border-gray-100">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Link
                href={`/game/${competitionId}`}
                className="flex items-center space-x-2 text-gray-500 hover:text-gray-700"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                <span className="text-sm font-medium">Back to Competition</span>
              </Link>
            </div>
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
            <div className="flex items-center justify-between">
              <Link
                href={`/game/${competitionId}`}
                className="flex items-center space-x-2 text-gray-500 hover:text-gray-700"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                <span className="text-sm font-medium">Back to Competition</span>
              </Link>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-6">
          <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-8">
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Data</h3>
              <p className="text-gray-500 mb-4">{error || 'Failed to load promotion data'}</p>
              <Link
                href={`/game/${competitionId}`}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-900 transition-colors text-sm"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                <span>Back to Competition</span>
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Filter templates based on visibility context
  const visibleCategories: Array<{
    key: keyof typeof data.template_context;
    title: string;
    description: string;
    icon: string;
    category: Template['category'];
  }> = [];

  if (data.template_context.show_pre_launch) {
    visibleCategories.push({
      key: 'show_pre_launch',
      title: 'Pre-Launch Invitations',
      description: 'Invite players to join your competition',
      icon: '🎯',
      category: 'pre_launch'
    });
  }

  if (data.template_context.show_pick_reminder) {
    visibleCategories.push({
      key: 'show_pick_reminder',
      title: 'Pick Reminders',
      description: 'Remind players to make their picks',
      icon: '⏰',
      category: 'pick_reminder'
    });
  }

  if (data.template_context.show_weekly_update) {
    visibleCategories.push({
      key: 'show_weekly_update',
      title: 'Weekly Updates',
      description: 'Share round results and standings',
      icon: '📊',
      category: 'weekly_update'
    });
  }

  // Get templates for each visible category
  const categorizedTemplates = visibleCategories.map(cat => ({
    ...cat,
    templates: templates.filter(t => t.category === cat.category)
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      {/* Header */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              href={`/game/${competitionId}`}
              className="flex items-center space-x-2 text-gray-500 hover:text-gray-700"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              <span className="text-sm font-medium">Back to Competition</span>
            </Link>
          </div>
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
            Copy-paste ready messages for WhatsApp, Facebook, email, and more
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

        {/* No templates available message */}
        {categorizedTemplates.length === 0 && (
          <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-50 rounded-full mb-4">
                <MegaphoneIcon className="h-8 w-8 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">
                No Marketing Templates Available Right Now
              </h2>
              <p className="text-gray-600 mb-4 max-w-md mx-auto">
                Templates will appear here at the right moments during your competition - like when it's time to remind players to pick or announce round results.
              </p>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 max-w-md mx-auto">
                <p className="text-sm text-gray-600">
                  <strong className="text-gray-900">Tip:</strong> Use the invite code on your competition dashboard to share with players via WhatsApp or email.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Template Categories */}
        {categorizedTemplates.map((category) => (
          <div key={category.key} className="bg-white rounded-lg border border-gray-100 shadow-sm">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center space-x-3">
                <span className="text-3xl">{category.icon}</span>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{category.title}</h2>
                  <p className="text-sm text-gray-600">{category.description}</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {category.templates.map((template) => {
                const isCopied = copiedTemplateId === template.id;
                const filledPreview = replaceTemplateVariables(template.content, {
                  competition_name: data.competition.name,
                  round_number: data.current_round?.round_number || null,
                  players_remaining: data.player_stats.total_active_players,
                  players_eliminated: data.player_stats.players_eliminated_this_round,
                  top_players: data.top_players,
                  pick_deadline: data.current_round?.lock_time_formatted || null,
                  next_round_start: data.current_round?.next_round_start || null,
                  join_code: data.competition.invite_code,
                  join_url: data.competition.join_url,
                  total_players: data.competition.total_players,
                  players_without_picks: data.player_stats.players_without_picks,
                  pick_percentage: data.player_stats.pick_percentage
                });

                return (
                  <div
                    key={template.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">{template.name}</h3>
                        {template.tone && (
                          <span className="text-xs text-gray-500 capitalize">
                            {template.tone} tone
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleCopyTemplate(template)}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all ${
                          isCopied
                            ? 'bg-green-100 text-green-700 border border-green-300'
                            : 'bg-gray-800 text-white hover:bg-gray-900'
                        }`}
                      >
                        {isCopied ? (
                          <>
                            <CheckCircleIcon className="h-4 w-4" />
                            <span className="text-sm">Copied!</span>
                          </>
                        ) : (
                          <>
                            <ClipboardDocumentIcon className="h-4 w-4" />
                            <span className="text-sm">Copy</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
                        {filledPreview}
                      </pre>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Help Section */}
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
          <h3 className="font-semibold text-blue-900 mb-2">💡 How to Use</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Click "Copy" on any template</li>
            <li>• Paste into WhatsApp, Facebook, email, or SMS</li>
            <li>• All details are automatically filled in for you</li>
            <li>• Templates update based on your competition progress</li>
          </ul>
        </div>

      </main>
    </div>
  );
}
