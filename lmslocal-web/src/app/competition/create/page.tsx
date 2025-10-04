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
import { competitionApi, teamApi, cacheUtils } from '@/lib/api';
import { useAppData } from '@/contexts/AppDataContext';
import CloudinaryUpload from '@/components/CloudinaryUpload';

interface TeamList {
  id: number;
  name: string;
  description?: string;
  team_count?: number;
}

interface CreateCompetitionForm {
  name: string;
  description?: string;
  logo_url?: string;
  venue_name?: string;
  team_list_id: number;
  lives_per_player: number;
  no_team_twice: boolean;
  organiser_joins_as_player: boolean;
}

export default function CreateCompetitionPage() {
  const router = useRouter();
  const { refreshCompetitions } = useAppData();
  const [teamLists, setTeamLists] = useState<TeamList[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
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
        setTeamLists((response.data.team_lists as TeamList[]) || []);
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
        
        // Update user data in localStorage since they're now an admin
        const currentUser = localStorage.getItem('user');
        if (currentUser) {
          const userData = JSON.parse(currentUser);
          userData.user_type = 'admin'; // Update to admin since they created a competition
          localStorage.setItem('user', JSON.stringify(userData));
        }
        
        // Clear cache and refresh data properly
        setError('');
        cacheUtils.invalidateCompetitions();
        
        // Refresh the context data before navigation (bypass cache)
        await refreshCompetitions();
        
        // Navigate smoothly without page reload
        router.push('/dashboard');
        return;
      } else {
        setError(response.data.message || 'Failed to create competition');
      }
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setError((err as any)?.response?.data?.message || 'An error occurred. Please try again.');
    } finally {
      // Only set loading to false on error - success keeps loading state until navigation
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-sm border-b border-slate-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3 sm:space-x-4">
              <Link 
                href="/dashboard" 
                className="inline-flex items-center text-slate-500 hover:text-slate-700 px-2 sm:px-3 py-2 rounded-2xl hover:bg-slate-50 transition-colors text-sm sm:text-base"
              >
                <ArrowLeftIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
                <span className="hidden xs:inline">Back to Dashboard</span>
                <span className="xs:hidden">Back</span>
              </Link>
              <div className="p-2 sm:p-3 bg-slate-100 rounded-2xl">
                <TrophyIcon className="h-6 w-6 sm:h-8 sm:w-8 text-slate-600" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Create Competition</h1>
                <p className="text-xs sm:text-sm text-slate-500">Set up your tournament</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Progress Steps */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center">
            <div className={`flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full text-xs sm:text-sm font-medium ${
              step >= 1 ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-600'
            }`}>
              1
            </div>
            <div className={`flex-1 h-0.5 sm:h-1 mx-2 sm:mx-4 ${
              step >= 2 ? 'bg-slate-800' : 'bg-slate-200'
            }`}></div>
            <div className={`flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full text-xs sm:text-sm font-medium ${
              step >= 2 ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-600'
            }`}>
              2
            </div>
            <div className={`flex-1 h-0.5 sm:h-1 mx-2 sm:mx-4 ${
              step >= 3 ? 'bg-slate-800' : 'bg-slate-200'
            }`}></div>
            <div className={`flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full text-xs sm:text-sm font-medium ${
              step >= 3 ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-600'
            }`}>
              3
            </div>
          </div>
          <div className="flex justify-between mt-2 text-xs sm:text-sm text-slate-600 px-1">
            <span className="text-center flex-1">Basic Details</span>
            <span className="text-center flex-1">Rules & Settings</span>
            <span className="text-center flex-1">Review & Create</span>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Step 1: Basic Details */}
          {step === 1 && (
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 lg:p-8">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4 sm:mb-6">Competition Details</h2>
              
              {error && (
                <div className="mb-6 rounded-md bg-red-50 p-4">
                  <div className="text-sm text-red-700">{error}</div>
                </div>
              )}

              <div className="space-y-4 sm:space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-2">
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
                    className="block w-full appearance-none rounded-xl border border-slate-300 px-3 sm:px-4 py-3 placeholder-slate-400 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-slate-500 text-sm sm:text-base"
                    placeholder="e.g., Premier League Last Man Standing 2025"
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-2">
                    Description <span className="text-slate-400">(optional)</span>
                  </label>
                  <textarea
                    {...register('description')}
                    rows={3}
                    className="block w-full appearance-none rounded-xl border border-slate-300 px-3 sm:px-4 py-3 placeholder-slate-400 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-slate-500 text-sm sm:text-base"
                    placeholder="Tell your players what this competition is about..."
                  />
                </div>

                {/* Logo Upload */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Competition Logo <span className="text-slate-400">(optional)</span>
                  </label>
                  <CloudinaryUpload
                    value={watch('logo_url') || ''}
                    onChange={(url) => setValue('logo_url', url)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <label htmlFor="venue_name" className="block text-sm font-medium text-slate-700 mb-2">
                    Venue/Organization Name <span className="text-slate-400">(optional)</span>
                  </label>
                  <input
                    {...register('venue_name', {
                      maxLength: {
                        value: 100,
                        message: 'Venue name must be 100 characters or less'
                      }
                    })}
                    type="text"
                    className="block w-full appearance-none rounded-xl border border-slate-300 px-3 sm:px-4 py-3 placeholder-slate-400 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-slate-500 text-sm sm:text-base"
                    placeholder="e.g., The Red Barn, Crown & Anchor"
                  />
                  {errors.venue_name && (
                    <p className="mt-1 text-sm text-red-600">{errors.venue_name.message}</p>
                  )}
                  <p className="mt-1 text-xs text-slate-500">
                    This will be shown to players in marketing messages. If not provided, your display name will be used.
                  </p>
                </div>

                <div>
                  <label htmlFor="team_list_id" className="block text-sm font-medium text-slate-700 mb-2">
                    Team List *
                  </label>
                  <select
                    {...register('team_list_id', {
                      required: 'Please select a team list',
                      valueAsNumber: true
                    })}
                    className="block w-full appearance-none rounded-xl border border-slate-300 px-3 sm:px-4 py-3 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-slate-500 text-sm sm:text-base"
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
                  <p className="mt-1 text-sm text-slate-500">
                    Choose which teams players can pick from in your competition
                  </p>
                </div>
              </div>

              <div className="flex justify-end mt-6 sm:mt-8">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!watchedValues.name || !watchedValues.team_list_id}
                  className="inline-flex items-center px-4 sm:px-6 py-3 bg-slate-800 text-white rounded-xl font-medium hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all text-sm sm:text-base"
                >
                  <span className="hidden sm:inline">Next: Rules & Settings</span>
                  <span className="sm:hidden">Next: Rules</span>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Rules & Settings */}
          {step === 2 && (
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 lg:p-8">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4 sm:mb-6">Competition Rules</h2>

              <div className="space-y-6 sm:space-y-8">
                {/* Lives per player */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    <HeartIcon className="h-5 w-5 inline mr-2 text-slate-500" />
                    Lives per Player
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                    {[0, 1, 2].map((lives) => (
                      <label key={lives} className="relative">
                        <input
                          {...register('lives_per_player', { valueAsNumber: true })}
                          type="radio"
                          value={lives}
                          defaultChecked={lives === 1}
                          className="sr-only peer"
                        />
                        <div className="p-3 sm:p-4 border border-slate-300 rounded-xl cursor-pointer peer-checked:border-slate-800 peer-checked:bg-slate-50 peer-checked:shadow-md hover:bg-slate-50 transition-all">
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
                  <p className="mt-2 text-sm text-slate-500">
                    How many wrong picks can players make before being eliminated?
                  </p>
                </div>

                {/* No team twice rule */}
                <div>
                  <label className="flex items-start space-x-3">
                    <input
                      {...register('no_team_twice')}
                      type="checkbox"
                      className="mt-1 h-4 w-4 text-slate-600 focus:ring-slate-500 border-slate-300 rounded"
                    />
                    <div>
                      <div className="text-sm font-medium text-slate-700">
                        <ShieldCheckIcon className="h-5 w-5 inline mr-2 text-slate-500" />
                        No Team Twice Rule
                      </div>
                      <div className="text-sm text-slate-500">
                        Players cannot pick the same team in different rounds
                        {watchedValues.no_team_twice && (
                          <span className="block mt-1">
                            Teams automatically reset when players run out of options.
                          </span>
                        )}
                      </div>
                    </div>
                  </label>
                </div>

                {/* Organiser joins as player */}
                <div>
                  <label className="flex items-start space-x-3">
                    <input
                      {...register('organiser_joins_as_player')}
                      type="checkbox"
                      className="mt-1 h-4 w-4 text-slate-600 focus:ring-slate-500 border-slate-300 rounded"
                    />
                    <div>
                      <div className="text-sm font-medium text-slate-700">
                        <UserGroupIcon className="h-5 w-5 inline mr-2 text-slate-500" />
                        Join as Player
                      </div>
                      <div className="text-sm text-slate-500">
                        You&apos;ll participate in the competition as well as organise it
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-between mt-6 sm:mt-8 gap-3 sm:gap-0">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex items-center justify-center px-4 sm:px-6 py-3 bg-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 transition-all text-sm sm:text-base order-2 sm:order-1"
                >
                  <span className="hidden sm:inline">Back: Competition Details</span>
                  <span className="sm:hidden">Back</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="inline-flex items-center justify-center px-4 sm:px-6 py-3 bg-slate-800 text-white rounded-xl font-medium hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 shadow-md hover:shadow-lg transition-all text-sm sm:text-base order-1 sm:order-2"
                >
                  <span className="hidden sm:inline">Next: Review & Create</span>
                  <span className="sm:hidden">Next: Review</span>
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Review & Create */}
          {step === 3 && (
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 lg:p-8">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4 sm:mb-6">Review Your Competition</h2>

              <div className="space-y-4 sm:space-y-6">
                <div className="bg-slate-50 rounded-xl p-4 sm:p-6">
                  <h3 className="font-medium text-slate-900 mb-3 text-sm sm:text-base">Competition Summary</h3>
                  <dl className="space-y-2 sm:space-y-3">
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                      <dt className="text-xs sm:text-sm text-slate-600">Name:</dt>
                      <dd className="text-xs sm:text-sm font-medium text-slate-900 sm:text-right">{watchedValues.name}</dd>
                    </div>
                    {watchedValues.description && (
                      <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                        <dt className="text-xs sm:text-sm text-slate-600">Description:</dt>
                        <dd className="text-xs sm:text-sm text-slate-900 sm:text-right sm:max-w-xs">{watchedValues.description}</dd>
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                      <dt className="text-xs sm:text-sm text-slate-600">Team List:</dt>
                      <dd className="text-xs sm:text-sm font-medium text-slate-900 sm:text-right">
                        {teamLists.find(tl => tl.id === watchedValues.team_list_id)?.name}
                      </dd>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                      <dt className="text-xs sm:text-sm text-slate-600">Lives per Player:</dt>
                      <dd className="text-xs sm:text-sm font-medium text-slate-900 sm:text-right">{watchedValues.lives_per_player}</dd>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                      <dt className="text-xs sm:text-sm text-slate-600">No Team Twice:</dt>
                      <dd className="text-xs sm:text-sm font-medium text-slate-900 sm:text-right">
                        {watchedValues.no_team_twice ? 'Yes' : 'No'}
                      </dd>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                      <dt className="text-xs sm:text-sm text-slate-600">You&apos;re Playing:</dt>
                      <dd className="text-xs sm:text-sm font-medium text-slate-900 sm:text-right">
                        {watchedValues.organiser_joins_as_player ? 'Yes' : 'No'}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-6">
                  <div className="flex items-start">
                    <InformationCircleIcon className="h-4 w-4 sm:h-5 sm:w-5 text-slate-600 mt-0.5 mr-2 sm:mr-3 flex-shrink-0" />
                    <div className="text-xs sm:text-sm text-slate-800">
                      <p className="font-medium mb-2">What happens next?</p>
                      <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm">
                        <li>Your competition will be created with a unique access code</li>
                        <li>You can invite players using the access code or link</li>
                        <li>Start by creating rounds and adding fixtures</li>
                        <li>Your competition starts locked - unlock it when ready!</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-between mt-6 sm:mt-8 gap-3 sm:gap-0">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex items-center justify-center px-4 sm:px-6 py-3 bg-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 transition-all text-sm sm:text-base order-2 sm:order-1"
                >
                  <span className="hidden sm:inline">Back: Rules & Settings</span>
                  <span className="sm:hidden">Back</span>
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center justify-center px-6 sm:px-8 py-3 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:cursor-not-allowed shadow-md transition-all text-sm sm:text-base order-1 sm:order-2 bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-50 hover:shadow-lg"
                >
                  {loading ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      <span className="hidden sm:inline">Creating Competition...</span>
                      <span className="sm:hidden">Creating...</span>
                    </div>
                  ) : (
                    <>
                      <TrophyIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                      <span className="hidden sm:inline">Create Competition</span>
                      <span className="sm:hidden">Create</span>
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