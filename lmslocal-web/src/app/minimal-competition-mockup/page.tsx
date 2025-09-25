'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  TrophyIcon,
  ArrowLeftIcon,
  UserGroupIcon,
  ClipboardDocumentIcon,
  CalendarDaysIcon,
  PlayIcon,
  ClockIcon,
  MapPinIcon,
  CheckIcon
} from '@heroicons/react/24/outline';

const MinimalCompetitionMockup = () => {
  const [showBooking, setShowBooking] = useState(false);

  // Mock data - Minimal organizer setup (just the basics)
  const mockData = {
    competition: {
      name: "Last Man Standing",
      venue: null, // No venue info
      round: 3,
      invite_code: "QUICK123",
      user_status: "active",
      needs_pick: true,
      // No optional details - organizer just created basic competition
      description: null,
      prize_pool: null,
      entry_fee: null,
      organizer_name: null,
      rules_summary: null
    },
    stats: {
      survived_round: 2,
      eliminated_this_round: 15,
      survivors: 24,
      total_started: 39,
      user_picked: "Liverpool",
      lives_remaining: 1
    },
    pickProgress: {
      made_picks: 18,
      total_players: 24,
      hours_left: 6,
      minutes_left: 15
    },
    featuredEvent: null // No venue events available
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Clean minimal header */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard" className="flex items-center space-x-2 text-gray-500 hover:text-gray-700">
                <ArrowLeftIcon className="h-4 w-4" />
                <span className="text-sm font-medium">Dashboard</span>
              </Link>
              <div className="h-4 w-px bg-gray-200" />
              <h1 className="text-lg font-semibold text-gray-900">{mockData.competition.name}</h1>
            </div>
            {mockData.competition.venue && (
              <div className="text-sm text-gray-500">{mockData.competition.venue}</div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* Competition Details - Only show if admin has added info */}
        {(mockData.competition.description || mockData.competition.prize_pool || mockData.competition.entry_fee || mockData.competition.organizer_name) && (
          <div className="bg-white rounded-lg border border-gray-100 shadow-sm">
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mockData.competition.description && (
                  <div className="md:col-span-2">
                    <div className="text-sm text-gray-900">{mockData.competition.description}</div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {mockData.competition.prize_pool && (
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Prize Pool</div>
                      <div className="text-lg font-semibold text-green-600">{mockData.competition.prize_pool}</div>
                    </div>
                  )}

                  {mockData.competition.entry_fee && (
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Entry Fee</div>
                      <div className="text-lg font-semibold text-gray-900">{mockData.competition.entry_fee}</div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {mockData.competition.organizer_name && (
                    <div>
                      <div className="text-xs text-gray-500">Organized by</div>
                      <div className="text-sm font-medium text-gray-900">{mockData.competition.organizer_name}</div>
                    </div>
                  )}

                  {mockData.competition.rules_summary && (
                    <div>
                      <div className="text-xs text-gray-500">Rules</div>
                      <div className="text-sm text-gray-700">{mockData.competition.rules_summary}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Current Status Card - Much smaller and cleaner */}
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm">
          <div className="p-4 border-b border-gray-50">
            <div className="flex items-center space-x-2">
              <CheckIcon className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium text-gray-900">Your Status: Still In</span>
            </div>
          </div>

          <div className="p-4">
            <div className="text-center mb-4">
              <div className="text-2xl font-bold text-gray-900 mb-1">Round {mockData.competition.round}</div>
              <div className="text-sm text-red-600 font-medium">Pick your team to continue</div>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-lg font-semibold text-green-600">{mockData.stats.survivors}</div>
                <div className="text-xs text-gray-500">Still In</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-red-500">{mockData.stats.eliminated_this_round}</div>
                <div className="text-xs text-gray-500">Eliminated</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-gray-600">{mockData.stats.total_started}</div>
                <div className="text-xs text-gray-500">Started</div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons - Much cleaner */}
        <div className="grid grid-cols-2 gap-4">
          <button className="group bg-white rounded-lg border border-gray-100 shadow-sm p-4 hover:shadow-md transition-all">
            <div className="flex flex-col items-center space-y-2">
              <div className="p-2 bg-red-50 rounded-lg group-hover:bg-red-100">
                <PlayIcon className="h-5 w-5 text-red-600" />
              </div>
              <div className="text-center">
                <div className="text-sm font-semibold text-gray-900">Make Pick</div>
                <div className="text-xs text-red-600 font-medium">Round {mockData.competition.round}</div>
              </div>
            </div>
          </button>

          <Link href="#" className="group bg-white rounded-lg border border-gray-100 shadow-sm p-4 hover:shadow-md transition-all">
            <div className="flex flex-col items-center space-y-2">
              <div className="p-2 bg-gray-50 rounded-lg group-hover:bg-gray-100">
                <TrophyIcon className="h-5 w-5 text-gray-600" />
              </div>
              <div className="text-center">
                <div className="text-sm font-semibold text-gray-900">Standings</div>
                <div className="text-xs text-gray-500">View leaderboard</div>
              </div>
            </div>
          </Link>
        </div>

        {/* Event Card - Only show if venue events exist */}
        {mockData.featuredEvent && (
          <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-slate-600 to-slate-700 px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white font-medium text-sm">{mockData.featuredEvent.title}</div>
                  <div className="text-slate-200 text-xs">{mockData.featuredEvent.subtitle}</div>
                </div>
                <div className="text-right">
                  <div className="text-white text-sm font-medium">{mockData.featuredEvent.date}</div>
                  <div className="text-slate-200 text-xs">{mockData.featuredEvent.time}</div>
                </div>
              </div>
            </div>

            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-sm text-gray-700">{mockData.featuredEvent.bonus}</span>
                </div>
                <button
                  onClick={() => setShowBooking(true)}
                  className="bg-slate-600 text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-slate-700 transition-colors"
                >
                  Book Table
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Round Progress - Clean and minimal */}
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium text-gray-900">Round {mockData.competition.round} Progress</div>
            <div className="text-xs text-gray-500">
              {mockData.pickProgress.made_picks} of {mockData.pickProgress.total_players} picked
            </div>
          </div>

          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(mockData.pickProgress.made_picks / mockData.pickProgress.total_players) * 100}%` }}
            ></div>
          </div>

          <div className="flex items-center justify-between mt-2">
            <div className="text-xs text-gray-500">
              Pick locks in {mockData.pickProgress.hours_left}h {mockData.pickProgress.minutes_left}m
            </div>
            <div className="text-xs text-gray-600 font-medium">
              {Math.round((mockData.pickProgress.made_picks / mockData.pickProgress.total_players) * 100)}%
            </div>
          </div>
        </div>

        {/* Invite Code - Compact */}
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4">
          <div className="text-center">
            <div className="text-sm font-medium text-gray-900 mb-2">Invite Code</div>
            <div className="flex items-center justify-center space-x-2">
              <code className="text-lg font-mono font-bold text-gray-800 tracking-wider">
                {mockData.competition.invite_code}
              </code>
              <button
                onClick={() => navigator.clipboard.writeText(mockData.competition.invite_code)}
                className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200 hover:border-gray-300"
              >
                Copy
              </button>
            </div>
          </div>
        </div>

        {/* No events message when venue not set up */}
        {!mockData.featuredEvent && !mockData.competition.venue && (
          <div className="text-center py-4">
            <div className="text-sm text-gray-400">
              No venue events available for this competition
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default MinimalCompetitionMockup;