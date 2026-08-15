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
  CalendarDaysIcon
} from '@heroicons/react/24/outline';
import { competitionApi, teamApi, cacheUtils, CreateCompetitionRequest, StartOption } from '@/lib/api';
import { useAppData } from '@/contexts/AppDataContext';
import CloudinaryUpload from '@/components/CloudinaryUpload';
import StartDateChooser, { formatLockTime } from '@/components/StartDateChooser';
import { LABEL, EYEBROW, HEADING, PANEL, BTN_PRIMARY, BTN_OUTLINE } from '@/lib/design';

const INPUT = 'block w-full rounded-sm border border-ink bg-transparent px-3 py-2.5 text-[15px] text-ink placeholder-ink-fade/60 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

interface TeamList {
  id: number;
  name: string;
  description?: string;
  team_count?: number;
  fixture_service_available?: boolean;
}

interface CreateCompetitionForm {
  name: string;
  description?: string;
  logo_url?: string;
  venue_name?: string;
  entry_fee?: string;
  prize_structure?: string;
  team_list_id: number;
  lives_per_player: number;
  no_team_twice: boolean;
  organiser_joins_as_player: boolean;
}

const STEPS = ['Basic details', 'Rules & settings', 'Review & create'];

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
      lives_per_player: 0,
      no_team_twice: true,
      organiser_joins_as_player: true,
    }
  });

  const watchedValues = watch();

  // Deliberately plain state rather than a react-hook-form field. Registering two radios under
  // one name makes RHF manage the group's value as the string from the value attribute, so a
  // boolean comparison never matches - and since "Do it for me" is selected by default, clicking
  // it fires no change event at all, leaving the value untouched.
  const [useFixtureService, setUseFixtureService] = useState(true);

  // Which calendar block round 1 comes from. Null is a legitimate state, not an unanswered
  // question: the calendar can have nothing far enough ahead, and the competition is still
  // created - it falls back to the Ready button.
  const [startOption, setStartOption] = useState<StartOption | null>(null);

  // The fixture service only pushes to team lists we stage fixtures for, so the offer is hidden
  // entirely on lists it does not cover rather than shown and then rejected on submit.
  const selectedTeamList = teamLists.find(tl => tl.id === watchedValues.team_list_id);
  const fixtureServiceOffered = selectedTeamList?.fixture_service_available === true;
  const usingFixtureService = fixtureServiceOffered && useFixtureService;

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
      // Build request with required fields
      const requestData: CreateCompetitionRequest = {
        name: data.name,
        team_list_id: data.team_list_id,
        lives_per_player: data.lives_per_player,
        no_team_twice: data.no_team_twice,
        organiser_joins_as_player: data.organiser_joins_as_player,
        fixture_service: usingFixtureService,
        // Only when there is one to send. Omitted, the server falls back to the Ready button
        // rather than refusing, so an empty calendar never blocks a competition being created.
        ...(usingFixtureService && startOption ? { start_block_id: startOption.block_id } : {})
      };

      // Add optional text fields if provided
      if (data.description && data.description.trim()) {
        requestData.description = data.description.trim();
      }

      if (data.venue_name && data.venue_name.trim()) {
        requestData.venue_name = data.venue_name.trim();
      }

      if (data.logo_url && data.logo_url.trim()) {
        requestData.logo_url = data.logo_url.trim();
      }

      // Add entry_fee if provided
      if (data.entry_fee && data.entry_fee.trim()) {
        const fee = parseFloat(data.entry_fee.trim());
        if (!isNaN(fee) && fee >= 0) {
          requestData.entry_fee = fee;
        }
      }

      // Add prize_structure if provided
      if (data.prize_structure && data.prize_structure.trim()) {
        requestData.prize_structure = data.prize_structure.trim();
      }

      const response = await competitionApi.create(requestData);

      if (response.data.return_code === 'SUCCESS') {

        // Clear cache and refresh data properly
        setError('');
        cacheUtils.invalidateCompetitions();

        // Refresh the context data before navigation (bypass cache)
        await refreshCompetitions();

        // With the fixture service on there are no fixtures to enter, so send them to the
        // competition itself where the next job is inviting players. Only competitions the
        // organiser runs manually go straight to the fixture screen.
        const competitionId = response.data.competition?.id;
        if (competitionId && !usingFixtureService) {
          router.push(`/game/${competitionId}/organizer-fixtures`);
        } else if (competitionId) {
          router.push(`/game/${competitionId}`);
        } else {
          router.push('/dashboard');
        }
        // Deliberately stays loading. router.push resolves long before the next
        // screen paints, so releasing the button here flips it from a spinner
        // back to "Create competition" while the user is still looking at this
        // page — it reads as though nothing happened, on the one action they
        // must not press twice. Only the failure paths below re-enable it.
        return;
      }

      setError(response.data.message || 'Failed to create competition');
      setLoading(false);
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setError((err as any)?.response?.data?.message || 'An error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stock font-body text-ink">
      <header className="border-b border-ink/30">
        <div className="mx-auto flex max-w-3xl items-center px-4 py-4 sm:px-6">
          <Link href="/dashboard" className={`${LABEL} flex items-center gap-1.5 text-ink-fade transition-colors hover:text-ink`}>
            <ArrowLeftIcon className="h-4 w-4" />
            Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <p className={EYEBROW}>Create</p>
        <h1 className={`${HEADING} mt-1 text-3xl`}>Create competition</h1>

        {/* Progress Steps */}
        <div className="mt-6">
          <div className="flex items-center">
            {STEPS.map((label, i) => {
              const num = i + 1;
              return (
                <div key={label} className="flex flex-1 items-center last:flex-none">
                  <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center border font-display text-sm ${
                    step >= num ? 'border-ink bg-ink text-stock-lit' : 'border-ink/30 text-ink-fade'
                  }`}>
                    {num}
                  </div>
                  {num < STEPS.length && (
                    <div className={`mx-2 h-px flex-1 sm:mx-4 ${step > num ? 'bg-ink' : 'bg-ink/20'}`} />
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between px-1">
            {STEPS.map((label) => (
              <span key={label} className={`${LABEL} flex-1 text-center text-ink-fade first:text-left last:text-right`}>
                {label}
              </span>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6">
          {/* Step 1: Basic Details */}
          {step === 1 && (
            <div className={`${PANEL} p-5 sm:p-6 lg:p-8`}>
              <p className={`${HEADING} mb-5 text-2xl`}>Competition details</p>

              {error && (
                <div className="mb-5 border border-overprint p-3">
                  <p className="text-[14px] text-ink">{error}</p>
                </div>
              )}

              <div className="space-y-5">
                <div>
                  <label htmlFor="name" className={`${LABEL} mb-2 block text-ink-fade`}>
                    Competition name *
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
                    className={INPUT}
                    placeholder="e.g., Premier League Last Man Standing 2025"
                  />
                  {errors.name && (
                    <p className="mt-1 text-[13px] text-overprint">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="description" className={`${LABEL} mb-2 block text-ink-fade`}>
                    Description <span className="normal-case text-ink-fade/70">(optional)</span>
                  </label>
                  <textarea
                    {...register('description', {
                      maxLength: {
                        value: 250,
                        message: 'Description must be 250 characters or less'
                      }
                    })}
                    rows={3}
                    maxLength={250}
                    className={`${INPUT} resize-none`}
                    placeholder="Tell your players what this competition is about…"
                  />
                  {errors.description && (
                    <p className="mt-1 text-[13px] text-overprint">{errors.description.message}</p>
                  )}
                  <p className="mt-1 text-[12px] text-ink-fade">
                    {(watchedValues.description?.length || 0)}/250 characters
                  </p>
                </div>

                {/* Logo Upload */}
                <div>
                  <label className={`${LABEL} mb-2 block text-ink-fade`}>
                    Competition logo <span className="normal-case text-ink-fade/70">(optional)</span>
                  </label>
                  <CloudinaryUpload
                    value={watch('logo_url') || ''}
                    onChange={(url) => setValue('logo_url', url)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <label htmlFor="venue_name" className={`${LABEL} mb-2 block text-ink-fade`}>
                    Venue/organisation name <span className="normal-case text-ink-fade/70">(optional)</span>
                  </label>
                  <input
                    {...register('venue_name', {
                      maxLength: {
                        value: 100,
                        message: 'Venue name must be 100 characters or less'
                      }
                    })}
                    type="text"
                    className={INPUT}
                    placeholder="e.g., The Red Barn, Crown & Anchor"
                  />
                  {errors.venue_name && (
                    <p className="mt-1 text-[13px] text-overprint">{errors.venue_name.message}</p>
                  )}
                  <p className="mt-1 text-[12px] text-ink-fade">
                    This will be shown to players in marketing messages. If not provided, your display name will be used.
                  </p>
                </div>

                {/* Prize Structure */}
                <div>
                  <label htmlFor="prize_structure" className={`${LABEL} mb-2 block text-ink-fade`}>
                    Prize structure <span className="normal-case text-ink-fade/70">(optional)</span>
                  </label>
                  <input
                    {...register('prize_structure', {
                      maxLength: {
                        value: 60,
                        message: 'Prize structure must be 60 characters or less'
                      }
                    })}
                    type="text"
                    maxLength={60}
                    className={INPUT}
                    placeholder="e.g., FREE entry - £20 Prize for Winner!"
                  />
                  {errors.prize_structure && (
                    <p className="mt-1 text-[13px] text-overprint">{errors.prize_structure.message}</p>
                  )}
                  <p className="mt-1 text-[12px] text-ink-fade">
                    {(watchedValues.prize_structure?.length || 0)}/60 characters
                  </p>
                </div>

                <div>
                  <label htmlFor="team_list_id" className={`${LABEL} mb-2 block text-ink-fade`}>
                    Team list *
                  </label>
                  <select
                    {...register('team_list_id', {
                      required: 'Please select a team list',
                      valueAsNumber: true
                    })}
                    className={INPUT}
                  >
                    <option value="">Choose team list…</option>
                    {teamLists.map((teamList) => (
                      <option key={teamList.id} value={teamList.id}>
                        {teamList.name} {teamList.team_count && `(${teamList.team_count} teams)`}
                      </option>
                    ))}
                  </select>
                  {errors.team_list_id && (
                    <p className="mt-1 text-[13px] text-overprint">{errors.team_list_id.message}</p>
                  )}
                  <p className="mt-1 text-[13px] text-ink-fade">
                    Choose which teams players can pick from in your competition
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end sm:mt-8">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!watchedValues.name || !watchedValues.team_list_id}
                  className={`${BTN_PRIMARY} px-6 py-3 text-base disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  Next: Rules &amp; settings
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Rules & Settings */}
          {step === 2 && (
            <div className={`${PANEL} p-5 sm:p-6 lg:p-8`}>
              <p className={`${HEADING} mb-5 text-2xl`}>Competition rules</p>

              <div className="space-y-6 sm:space-y-8">
                {/* Fixture service opt-in - only offered on team lists we stage fixtures for */}
                {fixtureServiceOffered && (
                  <div>
                    <p className={`${LABEL} mb-3 flex items-center gap-1.5 text-ink-fade`}>
                      <CalendarDaysIcon className="h-4 w-4" />
                      Matches &amp; results
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setUseFixtureService(true)}
                        className={`h-full border p-4 text-left transition-colors ${
                          useFixtureService ? 'border-ink bg-ink text-stock-lit' : 'border-ink/30 hover:border-ink'
                        }`}
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className={LABEL}>Do it for me</span>
                          <span className={`${LABEL} border px-1.5 py-0.5 ${
                            useFixtureService ? 'border-stock-lit' : 'border-ink/30 text-ink-fade'
                          }`}>
                            Free
                          </span>
                        </div>
                        <p className={`text-[13px] ${useFixtureService ? 'text-stock/85' : 'text-ink-fade'}`}>
                          We add each round&apos;s matches and enter the results for you. You just invite players.
                        </p>
                        <p className={`mt-2 text-[12px] ${useFixtureService ? 'text-stock/70' : 'text-ink-fade'}`}>
                          Free for this competition &mdash; normally <span className="line-through">20 credits</span>
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setUseFixtureService(false)}
                        className={`h-full border p-4 text-left transition-colors ${
                          !useFixtureService ? 'border-ink bg-ink text-stock-lit' : 'border-ink/30 hover:border-ink'
                        }`}
                      >
                        <p className={`${LABEL} mb-1`}>I&apos;ll do my own</p>
                        <p className={`text-[13px] ${!useFixtureService ? 'text-stock/85' : 'text-ink-fade'}`}>
                          You add the matches and enter results each round yourself.
                        </p>
                        <p className={`mt-2 text-[12px] ${!useFixtureService ? 'text-stock/70' : 'text-ink-fade'}`}>
                          Full control over kick-off times and lock times
                        </p>
                      </button>
                    </div>
                  </div>
                )}

                {/* The start date. Asked here, up front, because a competition with no round is
                    an empty screen - and the week the organiser spends recruiting is exactly the
                    week their recruits are looking at it. Joining closes when round 1 locks, so
                    that week is the only window there is. See docs/competition-start.md.

                    Sits under the fixtures/results choice because the answer depends on it, and
                    stays put either way rather than appearing and shunting the fields below. */}
                {usingFixtureService ? (
                  <StartDateChooser
                    teamListId={watchedValues.team_list_id}
                    value={startOption}
                    onChange={setStartOption}
                    disabled={loading}
                  />
                ) : (
                  <div className="border border-ink/30 p-4">
                    <p className={`${LABEL} mb-1 flex items-center gap-1.5 text-ink-fade`}>
                      <CalendarDaysIcon className="h-4 w-4" />
                      Starting
                    </p>
                    <p className="text-[13px] text-ink-fade">
                      Nothing starts until you say so. Once the competition exists, invite your
                      players, then add your first round&apos;s matches when you&apos;re ready to
                      begin.
                    </p>
                  </div>
                )}

                {/* Lives per player */}
                <div>
                  <p className={`${LABEL} mb-3 flex items-center gap-1.5 text-ink-fade`}>
                    <HeartIcon className="h-4 w-4" />
                    Lives per player
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {[0, 1].map((lives) => (
                      <label key={lives} className="relative">
                        <input
                          {...register('lives_per_player', { valueAsNumber: true })}
                          type="radio"
                          value={lives}
                          defaultChecked={lives === 0}
                          className="peer sr-only"
                        />
                        <div className="cursor-pointer border border-ink/30 p-3 text-center transition-colors hover:border-ink peer-checked:border-ink peer-checked:bg-ink peer-checked:text-stock-lit sm:p-4">
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

                {/* No team twice rule - HIDDEN (always enabled) */}
                <input
                  {...register('no_team_twice')}
                  type="hidden"
                  value="true"
                />

                {/* Organiser joins as player */}
                <div>
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      {...register('organiser_joins_as_player')}
                      type="checkbox"
                      className="mt-1 h-4 w-4 accent-[#1C2620]"
                    />
                    <div>
                      <p className="flex items-center gap-1.5 text-[15px] font-medium text-ink">
                        <UserGroupIcon className="h-4 w-4 text-ink-fade" />
                        Join as player
                      </p>
                      <p className="text-[13px] text-ink-fade">
                        You&apos;ll participate in the competition as well as organise it
                      </p>
                    </div>
                  </label>
                </div>

              </div>

              <div className="mt-6 flex flex-col justify-between gap-3 sm:mt-8 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className={`${BTN_OUTLINE} order-2 justify-center px-6 py-3 sm:order-1`}
                >
                  Back: Competition details
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className={`${BTN_PRIMARY} order-1 px-6 py-3 text-base sm:order-2`}
                >
                  Next: Review &amp; create
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Review & Create */}
          {step === 3 && (
            <div className={`${PANEL} p-5 sm:p-6 lg:p-8`}>
              <p className={`${HEADING} mb-5 text-2xl`}>Review your competition</p>

              <div className="space-y-4">
                <div className="border border-ink/30 p-4 sm:p-5">
                  <p className={`${LABEL} mb-3 text-ink-fade`}>Competition summary</p>
                  <dl className="divide-y divide-ink/30 font-data text-[14px]">
                    <div className="flex justify-between gap-3 py-2">
                      <dt className="text-ink-fade">Name</dt>
                      <dd className="text-right text-ink">{watchedValues.name}</dd>
                    </div>
                    {watchedValues.description && (
                      <div className="flex justify-between gap-3 py-2">
                        <dt className="flex-shrink-0 text-ink-fade">Description</dt>
                        <dd className="text-right text-ink">{watchedValues.description}</dd>
                      </div>
                    )}
                    <div className="flex justify-between gap-3 py-2">
                      <dt className="text-ink-fade">Team list</dt>
                      <dd className="text-right text-ink">
                        {teamLists.find(tl => tl.id === watchedValues.team_list_id)?.name}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3 py-2">
                      <dt className="text-ink-fade">Lives per player</dt>
                      <dd className="text-right text-ink">{watchedValues.lives_per_player}</dd>
                    </div>
                    {fixtureServiceOffered && (
                      <div className="flex justify-between gap-3 py-2">
                        <dt className="flex-shrink-0 text-ink-fade">Matches &amp; results</dt>
                        <dd className="text-right text-ink">
                          {usingFixtureService ? 'We do them for you (free, normally 20 credits)' : 'You enter them yourself'}
                        </dd>
                      </div>
                    )}
                    {usingFixtureService && startOption && (
                      <div className="flex justify-between gap-3 py-2">
                        <dt className="flex-shrink-0 text-ink-fade">Round 1 kicks off</dt>
                        <dd className="text-right text-ink">{formatLockTime(startOption.lock_time)}</dd>
                      </div>
                    )}
                    <div className="flex justify-between gap-3 py-2">
                      <dt className="text-ink-fade">You&apos;re playing</dt>
                      <dd className="text-right text-ink">
                        {watchedValues.organiser_joins_as_player ? 'Yes' : 'No'}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="border border-ink/30 p-4 sm:p-5">
                  <div className="flex items-start gap-2.5">
                    <InformationCircleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink-fade" />
                    <div className="text-[14px] text-ink">
                      <p className="font-medium">What happens next?</p>
                      <ul className="mt-2 list-disc space-y-1 pl-4 text-ink-fade">
                        <li>Your competition will be created with a unique access code</li>
                        <li>You can invite players using the access code or link</li>
                        {usingFixtureService ? (
                          <li>We&apos;ll add the matches and results each round &mdash; nothing for you to do</li>
                        ) : (
                          <li>Start by creating rounds and adding matches</li>
                        )}
                        {usingFixtureService && startOption ? (
                          <>
                            <li>
                              Round 1 is already there &mdash; anyone you invite can pick straight away
                            </li>
                            <li>
                              Get your players in before {formatLockTime(startOption.lock_time)}, when
                              picks lock and joining closes
                            </li>
                          </>
                        ) : (
                          <li>Your competition starts locked - unlock it when ready!</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col justify-between gap-3 sm:mt-8 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className={`${BTN_OUTLINE} order-2 justify-center px-6 py-3 sm:order-1`}
                >
                  Back: Rules &amp; settings
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={`${BTN_PRIMARY} order-1 flex items-center justify-center gap-2 px-6 py-3 text-base disabled:cursor-not-allowed disabled:opacity-50 sm:order-2 sm:px-8`}
                >
                  {loading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-stock-lit border-t-transparent" />
                      Creating competition&hellip;
                    </>
                  ) : (
                    <>
                      <TrophyIcon className="h-4 w-4" />
                      Create competition
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
