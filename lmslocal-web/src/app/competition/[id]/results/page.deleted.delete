'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';
import { roundApi, fixtureApi } from '@/lib/api';
import { useAppData } from '@/contexts/AppDataContext';

interface Round {
  id: number;
  round_number: number;
  lock_time?: string;
}

interface Fixture {
  id: number;
  home_team: string;
  away_team: string;
  home_team_short: string;
  away_team_short: string;
  kickoff_time: string;
  result?: string;
}

export default function CompetitionResultsPage() {
  const router = useRouter();
  const params = useParams();
  const competitionId = params.id as string;
  
  // SINGLE SOURCE OF TRUTH: Use only context data
  const { competitions, loading: contextLoading } = useAppData();
  
  // Find the competition from context
  const competition = useMemo(() => {
    return competitions?.find(c => c.id.toString() === competitionId);
  }, [competitions, competitionId]);

  // Component state - only for UI data, not competition data
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load round and fixture data when competition is available
  const loadData = useCallback(async () => {
    if (!competition) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Load rounds and fixtures in parallel when possible
      const roundsResponse = await roundApi.getRounds(competition.id);
      if (roundsResponse.data.return_code === 'SUCCESS') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rounds = (roundsResponse.data.rounds as any[]) || [];
        if (rounds.length > 0) {
          const latestRound = rounds[rounds.length - 1];
          
          // Load fixtures for current round
          const fixturesResponse = await fixtureApi.get(latestRound.id.toString());
          
          // Set all state at once to prevent multiple re-renders
          setCurrentRound(latestRound);
          if (fixturesResponse.data.return_code === 'SUCCESS') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setFixtures((fixturesResponse.data.fixtures as any[]) || []);
          }
        }
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load competition data');
    } finally {
      setLoading(false);
    }
  }, [competition]);

  // Load data when competition becomes available
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Authentication check
  useEffect(() => {
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      router.push('/login');
      return;
    }
  }, [router]);

  // Helper functions
  const isRoundLocked = useCallback(() => {
    if (!currentRound?.lock_time) return false;
    return new Date() >= new Date(currentRound.lock_time);
  }, [currentRound]);

  // CLEAN LOADING STATES
  
  // Show loading while context is loading OR data is loading
  if (contextLoading || !competitions || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show error if competition not found
  if (!competition) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Competition Not Found</h1>
          <Link href={`/competition/${competitionId}/dashboard`} className="text-green-600 hover:text-green-700">
            Return to Competition Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Check if user is organizer
  if (!competition.is_organiser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-4">Only the competition organizer can access this page.</p>
          <Link href={`/competition/${competitionId}/dashboard`} className="text-green-600 hover:text-green-700">
            Return to Competition Dashboard
          </Link>
        </div>
      </div>
    );
  }


  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-900 mb-4">Error</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={loadData}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // MAIN RENDER - Clean and simple
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Link href={`/competition/${competitionId}/dashboard`} className="mr-4 p-2 hover:bg-gray-100 rounded-lg">
                <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
              </Link>
              <h1 className="text-2xl font-bold text-slate-900">
                {competition.name} - {isRoundLocked() ? 'Results' : 'Picks'}
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Competition and Round Info */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-semibold text-slate-900">Competition Status</h2>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              competition.status === 'LOCKED' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
            }`}>
              {competition.status}
            </span>
          </div>
          
          {currentRound && (
            <div className="mt-4">
              <p className="text-sm text-gray-600">
                <strong>Round {currentRound.round_number}</strong>
                {currentRound.lock_time && (
                  <span> - {new Date(currentRound.lock_time).toLocaleDateString('en-GB', { 
                    weekday: 'long', 
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}</span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Fixtures */}
        {fixtures.length > 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Fixtures</h3>
            <div className="space-y-4">
              {fixtures.map((fixture) => (
                <div key={fixture.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <span className="font-medium">{fixture.home_team}</span>
                    <span className="text-gray-400">vs</span>
                    <span className="font-medium">{fixture.away_team}</span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="text-sm text-gray-600">
                      {new Date(fixture.kickoff_time).toLocaleTimeString('en-GB', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                    {fixture.result && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm font-medium">
                        {fixture.result}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
            <p className="text-gray-600">No fixtures available for this round.</p>
          </div>
        )}
      </main>
    </div>
  );
}