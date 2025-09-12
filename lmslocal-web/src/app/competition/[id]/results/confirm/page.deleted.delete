'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeftIcon,
  TrophyIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';

interface Competition {
  id: number;
  name: string;
  status: string;
}

interface Round {
  id: number;
  round_number: number;
}

interface Fixture {
  id: number;
  home_team: string;
  away_team: string;
  home_team_short: string;
  away_team_short: string;
  kickoff_time: string;
  result: string;
}

export default function ResultsConfirmationPage() {
  const router = useRouter();
  const params = useParams();
  const competitionId = params.id as string;

  const [competition, setCompetition] = useState<Competition | null>(null);
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  // Mock data for now
  useEffect(() => {
    // Simulate loading competition data
    setTimeout(() => {
      setCompetition({
        id: parseInt(competitionId),
        name: "Premier League LMS 2025",
        status: "UNLOCKED"
      });
      
      setCurrentRound({
        id: 17,
        round_number: 2
      });

      // Mock fixtures with results
      setFixtures([
        {
          id: 1,
          home_team: "Arsenal",
          away_team: "Chelsea",
          home_team_short: "ARS",
          away_team_short: "CHE",
          kickoff_time: "2025-01-25T15:00:00Z",
          result: "HOME_WIN"
        },
        {
          id: 2,
          home_team: "Liverpool",
          away_team: "Tottenham",
          home_team_short: "LIV", 
          away_team_short: "TOT",
          kickoff_time: "2025-01-25T17:30:00Z",
          result: "DRAW"
        },
        {
          id: 3,
          home_team: "Manchester United",
          away_team: "Brighton",
          home_team_short: "MUN",
          away_team_short: "BRI",
          kickoff_time: "2025-01-26T14:00:00Z",
          result: "AWAY_WIN"
        }
      ]);

      setLoading(false);
    }, 500);
  }, [competitionId]);

  const getResultText = (fixture: Fixture) => {
    switch (fixture.result) {
      case 'HOME_WIN':
        return `${fixture.home_team} Win`;
      case 'AWAY_WIN':
        return `${fixture.away_team} Win`;
      case 'DRAW':
        return 'Draw';
      default:
        return 'No result';
    }
  };

  const getResultIcon = (fixture: Fixture) => {
    if (fixture.result) {
      return <CheckCircleIcon className="h-5 w-5 text-green-600" />;
    }
    return <ExclamationTriangleIcon className="h-5 w-5 text-orange-600" />;
  };

  const handleConfirmResults = async () => {
    setConfirming(true);
    
    // Mock API call delay
    setTimeout(() => {
      console.log('Results confirmed, advancing to next round...');
      // In reality, this would call an API to confirm results and advance round
      router.push(`/competition/${competitionId}/results`);
    }, 1500);
  };

  const handleGoBack = () => {
    router.push(`/competition/${competitionId}/results`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  // Mock totals - in reality these would come from API
  const mockEliminated = 32;
  const mockAdvancing = 163;
  const mockTotal = mockEliminated + mockAdvancing;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Link href={`/competition/${competitionId}/dashboard`} className="flex items-center">
                <TrophyIcon className="h-8 w-8 text-green-600" />
                <span className="ml-2 text-xl font-bold text-gray-900">LMSLocal</span>
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Admin Dashboard</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation */}
        <div className="mb-6">
          <button
            onClick={handleGoBack}
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Results
          </button>
        </div>

        {/* Header */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Confirm Round {currentRound?.round_number} Results</h1>
              <p className="text-gray-600 mt-1">{competition?.name}</p>
              <p className="text-sm text-gray-600 mt-2">
                Player eliminations will be calculated automatically based on these results. 
                You can make adjustments later using the admin tools if needed.
              </p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-center">
                <div className="text-sm text-blue-600 font-medium">Round Summary</div>
                <div className="text-2xl font-bold text-blue-900 mt-1">{mockTotal} players</div>
                <div className="text-xs text-blue-700 mt-1">
                  {mockEliminated} eliminated • {mockAdvancing} advancing
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Results Review */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
          
          <div className="divide-y divide-gray-200">
            {fixtures.map((fixture) => (
              <div key={fixture.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900">{fixture.home_team}</span>
                        <span className="text-gray-500">vs</span>
                        <span className="font-medium text-gray-900">{fixture.away_team}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      {getResultIcon(fixture)}
                      <span className="font-medium text-gray-900">
                        {getResultText(fixture)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleGoBack}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            Go Back & Edit Results
          </button>
          
          <button
            onClick={handleConfirmResults}
            disabled={confirming}
            className="px-8 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
          >
            {confirming ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Confirming Results...
              </>
            ) : (
              <>
                Confirm Results & Continue
                <ArrowRightIcon className="h-4 w-4 ml-2" />
              </>
            )}
          </button>
        </div>
      </main>
    </div>
  );
}