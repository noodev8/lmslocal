'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { 
  TrophyIcon,
  ArrowLeftIcon,
  InformationCircleIcon,
  UserGroupIcon,
  HeartIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';
import { competitionApi, teamApi } from '@/lib/api';

interface TeamList {
  id: number;
  name: string;
  description?: string;
  team_count?: number;
}

interface CreateCompetitionForm {
  name: string;
  description?: string;
  team_list_id: number;
  lives_per_player: number;
  no_team_twice: boolean;
  organiser_joins_as_player: boolean;
}

export default function CreateCompetitionPage() {
  const router = useRouter();
  const [teamLists, setTeamLists] = useState<TeamList[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm<CreateCompetitionForm>({
    defaultValues: {
      lives_per_player: 1,
      no_team_twice: true,
      organiser_joins_as_player: true
    }
  });

  const watchedValues = watch();

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      router.push('/login');
      return;
    }

    loadTeamLists();
  }, [router]);

  const loadTeamLists = async () => {
    try {
      const response = await teamApi.getTeamLists();
      if (response.data.return_code === 'SUCCESS') {
        setTeamLists(response.data.team_lists || []);
      }
    } catch (error) {
      console.error('Failed to load team lists:', error);
    }
  };

  const onSubmit = async (data: CreateCompetitionForm) => {
    setLoading(true);
    setError('');

    try {
      const response = await competitionApi.create({
        name: data.name,
        description: data.description || undefined,
        team_list_id: data.team_list_id,
        lives_per_player: data.lives_per_player,
        no_team_twice: data.no_team_twice,
        organiser_joins_as_player: data.organiser_joins_as_player
      });

      if (response.data.return_code === 'SUCCESS') {
        // Store the new competition ID for highlighting on dashboard
        localStorage.setItem('new_competition_id', response.data.competition.id.toString());
        // Redirect back to dashboard to show the new competition
        router.push('/dashboard');
      } else {
        setError(response.data.message || 'Failed to create competition');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center">
              <Link 
                href="/dashboard" 
                className="inline-flex items-center text-gray-500 hover:text-gray-700 mr-4"
              >
                <ArrowLeftIcon className="h-5 w-5 mr-1" />
                Back to Dashboard
              </Link>
              <TrophyIcon className="h-8 w-8 text-green-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">Create Competition</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
              step >= 1 ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              1
            </div>
            <div className={`flex-1 h-1 mx-4 ${
              step >= 2 ? 'bg-green-600' : 'bg-gray-200'
            }`}></div>
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
              step >= 2 ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              2
            </div>
            <div className={`flex-1 h-1 mx-4 ${
              step >= 3 ? 'bg-green-600' : 'bg-gray-200'
            }`}></div>
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
              step >= 3 ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              3
            </div>
          </div>
          <div className="flex justify-between mt-2 text-sm text-gray-600">
            <span>Basic Details</span>
            <span>Rules & Settings</span>
            <span>Review & Create</span>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Step 1: Basic Details */}
          {step === 1 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Competition Details</h2>
              
              {error && (
                <div className="mb-6 rounded-md bg-red-50 p-4">
                  <div className="text-sm text-red-700">{error}</div>
                </div>
              )}

              <div className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                    Competition Name *
                  </label>
                  <input
                    {...register('name', {
                      required: 'Competition name is required',
                      minLength: {
                        value: 3,
                        message: 'Competition name must be at least 3 characters'
                      }
                    })}
                    type="text"
                    className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-green-500 focus:outline-none focus:ring-green-500 sm:text-sm"
                    placeholder="e.g., Premier League Last Man Standing 2025"
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                    Description <span className="text-gray-400">(optional)</span>
                  </label>
                  <textarea
                    {...register('description')}
                    rows={3}
                    className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-green-500 focus:outline-none focus:ring-green-500 sm:text-sm"
                    placeholder="Tell your players what this competition is about..."
                  />
                </div>

                <div>
                  <label htmlFor="team_list_id" className="block text-sm font-medium text-gray-700 mb-2">
                    Team List *
                  </label>
                  <select
                    {...register('team_list_id', {
                      required: 'Please select a team list',
                      valueAsNumber: true
                    })}
                    className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-green-500 focus:outline-none focus:ring-green-500 sm:text-sm"
                  >
                    <option value="">Choose team list...</option>
                    {teamLists.map((teamList) => (
                      <option key={teamList.id} value={teamList.id}>
                        {teamList.name} {teamList.team_count && `(${teamList.team_count} teams)`}
                      </option>
                    ))}
                  </select>
                  {errors.team_list_id && (
                    <p className="mt-1 text-sm text-red-600">{errors.team_list_id.message}</p>
                  )}
                  <p className="mt-1 text-sm text-gray-500">
                    Choose which teams players can pick from in your competition
                  </p>
                </div>
              </div>

              <div className="flex justify-end mt-8">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!watchedValues.name || !watchedValues.team_list_id}
                  className="inline-flex items-center px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next: Rules & Settings
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Rules & Settings */}
          {step === 2 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Competition Rules</h2>

              <div className="space-y-8">
                {/* Lives per player */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    <HeartIcon className="h-5 w-5 inline mr-2 text-red-500" />
                    Lives per Player
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[1, 2, 3].map((lives) => (
                      <label key={lives} className="relative">
                        <input
                          {...register('lives_per_player', { valueAsNumber: true })}
                          type="radio"
                          value={lives}
                          className="sr-only peer"
                        />
                        <div className="p-4 border border-gray-300 rounded-lg cursor-pointer peer-checked:border-green-500 peer-checked:bg-green-50 hover:bg-gray-50">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-gray-900">{lives}</div>
                            <div className="text-sm text-gray-600">
                              {lives === 1 ? 'Life' : 'Lives'}
                            </div>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                  <p className="mt-2 text-sm text-gray-500">
                    How many wrong picks can players make before being eliminated?
                  </p>
                </div>

                {/* No team twice rule */}
                <div>
                  <label className="flex items-start space-x-3">
                    <input
                      {...register('no_team_twice')}
                      type="checkbox"
                      className="mt-1 h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                    />
                    <div>
                      <div className="text-sm font-medium text-gray-700">
                        <ShieldCheckIcon className="h-5 w-5 inline mr-2 text-blue-500" />
                        No Team Twice Rule
                      </div>
                      <div className="text-sm text-gray-500">
                        Players cannot pick the same team in different rounds
                      </div>
                      {watchedValues.no_team_twice && (
                        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                          <strong>Auto-reset:</strong> When a player runs out of available teams, all teams will automatically become available again at the start of the next round.
                        </div>
                      )}
                    </div>
                  </label>
                </div>

                {/* Organiser joins as player */}
                <div>
                  <label className="flex items-start space-x-3">
                    <input
                      {...register('organiser_joins_as_player')}
                      type="checkbox"
                      className="mt-1 h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                    />
                    <div>
                      <div className="text-sm font-medium text-gray-700">
                        <UserGroupIcon className="h-5 w-5 inline mr-2 text-purple-500" />
                        Join as Player
                      </div>
                      <div className="text-sm text-gray-500">
                        You'll participate in the competition as well as organise it
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex justify-between mt-8">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex items-center px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  Back: Competition Details
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="inline-flex items-center px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                >
                  Next: Review & Create
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Review & Create */}
          {step === 3 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Review Your Competition</h2>

              <div className="space-y-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-3">Competition Summary</h3>
                  <dl className="space-y-2">
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-600">Name:</dt>
                      <dd className="text-sm font-medium text-gray-900">{watchedValues.name}</dd>
                    </div>
                    {watchedValues.description && (
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-600">Description:</dt>
                        <dd className="text-sm text-gray-900 text-right max-w-xs">{watchedValues.description}</dd>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-600">Team List:</dt>
                      <dd className="text-sm font-medium text-gray-900">
                        {teamLists.find(tl => tl.id === watchedValues.team_list_id)?.name}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-600">Lives per Player:</dt>
                      <dd className="text-sm font-medium text-gray-900">{watchedValues.lives_per_player}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-600">No Team Twice:</dt>
                      <dd className="text-sm font-medium text-gray-900">
                        {watchedValues.no_team_twice ? 'Yes' : 'No'}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-600">You're Playing:</dt>
                      <dd className="text-sm font-medium text-gray-900">
                        {watchedValues.organiser_joins_as_player ? 'Yes' : 'No'}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <InformationCircleIcon className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
                    <div className="text-sm text-blue-800">
                      <p className="font-medium mb-1">What happens next?</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Your competition will be created with a unique access code</li>
                        <li>You can invite players using the access code or link</li>
                        <li>Start by creating rounds and adding fixtures</li>
                        <li>Your competition starts locked - unlock it when ready!</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between mt-8">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex items-center px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  Back: Rules & Settings
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center px-8 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                >
                  {loading ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Creating Competition...
                    </div>
                  ) : (
                    <>
                      <TrophyIcon className="h-5 w-5 mr-2" />
                      Create Competition
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </form>
      </main>
    </div>
  );
}