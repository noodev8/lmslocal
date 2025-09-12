'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeftIcon,
  ClockIcon,
  InformationCircleIcon,
  CalendarDaysIcon
} from '@heroicons/react/24/outline';
import { useAppData } from '@/contexts/AppDataContext';
import { roundApi } from '@/lib/api';

export default function WaitingForFixtures() {
  const params = useParams();
  const competitionId = params.id as string;
  
  // Use AppDataProvider context for competitions data
  const { competitions, loading: contextLoading } = useAppData();
  
  // Find the specific competition
  const competition = competitions?.find(c => c.id.toString() === competitionId);
  
  // State to determine the waiting scenario
  const [waitingReason, setWaitingReason] = useState<'loading' | 'no_rounds' | 'no_fixtures'>('loading');
  
  useEffect(() => {
    const checkRoundsStatus = async () => {
      if (!competition) return;
      
      try {
        const response = await roundApi.getRounds(parseInt(competitionId));
        
        if (response.data.return_code !== 'SUCCESS') {
          setWaitingReason('no_rounds'); // Default to no rounds on API failure
          return;
        }
        
        const rounds = response.data.rounds || [];
        
        if (rounds.length === 0) {
          setWaitingReason('no_rounds');
        } else {
          const latestRound = rounds[0];
          if (latestRound.fixture_count === 0) {
            setWaitingReason('no_fixtures');
          }
        }
      } catch (error) {
        console.error('Error checking rounds:', error);
        setWaitingReason('no_rounds'); // Default to no rounds on error
      }
    };
    
    if (competition) {
      checkRoundsStatus();
    }
  }, [competition, competitionId]);
  
  if (contextLoading || !competition) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200 shadow-sm">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <Link href={`/game/${competitionId}`} className="flex items-center space-x-2 text-slate-600 hover:text-slate-800 transition-colors">
                  <ArrowLeftIcon className="h-5 w-5" />
                  <span className="font-medium">Back</span>
                </Link>
                <div className="h-6 w-px bg-slate-300" />
                <div>
                  <h1 className="text-lg font-semibold text-slate-900">Waiting for Fixtures</h1>
                </div>
              </div>
            </div>
          </div>
        </header>
        
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
            <div className="flex items-center justify-center">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-50 rounded-full mb-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-600 border-t-transparent"></div>
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">Loading</h3>
                <p className="text-slate-500">Please wait while we check the competition status...</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link href={`/game/${competitionId}`} className="flex items-center space-x-2 text-slate-600 hover:text-slate-800 transition-colors">
                <ArrowLeftIcon className="h-5 w-5" />
                <span className="font-medium">Back</span>
              </Link>
              <div className="h-6 w-px bg-slate-300" />
              <div>
                <h1 className="text-lg font-semibold text-slate-900">Waiting for Fixtures</h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Competition Name */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">{competition.name}</h1>
        </div>

        {/* Main Waiting Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {waitingReason === 'no_rounds' ? (
            // Large detailed message when no rounds exist at all
            <>
              {/* Header with Icon */}
              <div className="bg-amber-50 border-b border-amber-200 px-6 py-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ClockIcon className="h-8 w-8 text-amber-600" />
                  </div>
                  <div className="ml-4">
                    <h2 className="text-xl font-semibold text-amber-900">Competition Setup in Progress</h2>
                    <p className="text-amber-700">The organizer is still setting up rounds for this competition.</p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <div className="space-y-6">
                  {/* What's happening */}
                  <div>
                    <h3 className="text-lg font-medium text-slate-900 mb-3 flex items-center">
                      <InformationCircleIcon className="h-5 w-5 text-slate-500 mr-2" />
                      What&apos;s happening?
                    </h3>
                    <p className="text-slate-600 mb-4">
                      Your competition organizer is currently creating rounds and adding fixtures (games) to the competition. 
                      Once the setup is complete, you&apos;ll be able to start making your picks.
                    </p>
                    
                    <div className="bg-slate-50 rounded-lg p-4">
                      <h4 className="font-medium text-slate-800 mb-2">Competition Status:</h4>
                      <div className="space-y-2 text-sm text-slate-600">
                        <div className="flex items-center">
                          <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                          Competition created and players can join
                        </div>
                        <div className="flex items-center">
                          <div className="w-2 h-2 bg-amber-500 rounded-full mr-3"></div>
                          Waiting for rounds and fixtures to be added
                        </div>
                        <div className="flex items-center">
                          <div className="w-2 h-2 bg-slate-300 rounded-full mr-3"></div>
                          Game will start once setup is complete
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* What to do next */}
                  <div>
                    <h3 className="text-lg font-medium text-slate-900 mb-3 flex items-center">
                      <CalendarDaysIcon className="h-5 w-5 text-slate-500 mr-2" />
                      What should I do?
                    </h3>
                    <div className="space-y-3 text-slate-600">
                      <p>
                        <strong>Nothing at the moment!</strong> The organizer needs to complete the initial setup first.
                      </p>
                      <p>
                        You can check back here later once the rounds and fixtures are ready and you can start making your picks.
                      </p>
                      <p>
                        Feel free to browse around the competition area or return to your dashboard. The &quot;Play&quot; button will work once setup is complete.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            // Smaller, simpler message when rounds exist but just need fixtures
            <div className="p-6">
              <div className="flex items-center mb-4">
                <ClockIcon className="h-6 w-6 text-amber-600 mr-3" />
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Waiting for Fixtures</h2>
                  <p className="text-slate-600">The current round needs fixtures to be added.</p>
                </div>
              </div>
              
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-amber-800 text-sm">
                  <strong>Almost ready!</strong> The organizer just needs to add the fixtures (games) for the current round. 
                  Once that&apos;s done, you&apos;ll be able to make your picks and start playing.
                </p>
              </div>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}