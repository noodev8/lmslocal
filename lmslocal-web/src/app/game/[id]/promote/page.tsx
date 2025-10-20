'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  MegaphoneIcon,
  ClipboardDocumentIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronUpIcon
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
    show_weekly_update: boolean;
    show_pick_reminder: boolean;
    show_results: boolean;
    show_elimination: boolean;
    show_final_hype: boolean;
    show_winner: boolean;
  };
}

// Template category definitions with colors
const categoryDefinitions = [
  {
    key: 'show_pre_launch' as const,
    title: 'Pre-Launch Invitations',
    description: 'Invite players to join your competition',
    icon: '🎯',
    category: 'pre_launch' as const,
    expanded: true
  },
  {
    key: 'show_pick_reminder' as const,
    title: 'Pick Reminders',
    description: 'Remind players to make their picks',
    icon: '⏰',
    category: 'pick_reminder' as const,
    expanded: true
  },
  {
    key: 'show_weekly_update' as const,
    title: 'Weekly Updates',
    description: 'Share round results and standings',
    icon: '📊',
    category: 'weekly_update' as const,
    expanded: true
  }
];

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

  // Template selection and editing
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [editedContent, setEditedContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Category expansion state
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    show_pre_launch: true,
    show_pick_reminder: true,
    show_weekly_update: true
  });

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

  const handleTemplateSelect = (template: Template) => {
    if (!data) return;

    // Fill template with data
    const filledTemplate = replaceTemplateVariables(template.content, {
      competition_name: data.competition.name,
      round_number: data.current_round?.round_number || null,
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
      pick_percentage: data.player_stats.pick_percentage
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

  const toggleCategory = (key: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
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

  // Filter visible categories
  const visibleCategories = categoryDefinitions.filter(cat => data.template_context[cat.key]);

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

        {/* No templates available */}
        {visibleCategories.length === 0 && (
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
        )}

        {/* Template Categories with Pills */}
        {visibleCategories.map((category) => {
          const categoryTemplates = templates.filter(t => t.category === category.category);
          const isExpanded = expandedCategories[category.key];

          return (
            <div key={category.key} className="bg-white rounded-lg border border-gray-100 shadow-sm">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category.key)}
                className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <span className="text-3xl">{category.icon}</span>
                  <div className="text-left">
                    <h2 className="text-xl font-bold text-gray-900">{category.title}</h2>
                    <p className="text-sm text-gray-600">{category.description}</p>
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronUpIcon className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                )}
              </button>

              {/* Template Pills */}
              {isExpanded && (
                <div className="px-6 pb-6 border-t border-gray-100">
                  <div className="flex flex-wrap gap-3 mt-4">
                    {categoryTemplates.map((template) => {
                      const colorClass = toneColors[template.tone || 'casual'] || toneColors.casual;
                      const isSelected = selectedTemplate?.id === template.id;

                      return (
                        <button
                          key={template.id}
                          onClick={() => handleTemplateSelect(template)}
                          className={`px-4 py-2 rounded-full font-medium text-sm border-2 transition-all ${
                            isSelected
                              ? 'ring-2 ring-offset-2 ring-gray-400'
                              : ''
                          } ${colorClass}`}
                        >
                          {template.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}

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
            <li>• Click "Copy to Clipboard" when ready</li>
            <li>• Paste into WhatsApp, Facebook, email, or SMS</li>
          </ul>
        </div>

      </main>
    </div>
  );
}
