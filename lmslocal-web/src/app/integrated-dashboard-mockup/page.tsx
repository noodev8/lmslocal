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
  GiftIcon,
  FireIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

const IntegratedDashboardMockup = () => {
  const [showBooking, setShowBooking] = useState(false);

  // Mock data - replicating what would come from the actual dashboard
  const mockData = {
    competition: {
      name: "The Crown & Anchor Last Man Standing",
      invite_code: "CROWN2025",
      is_organiser: false,
      user_status: "active",
      needs_pick: true,
      lives_remaining: 2
    },
    latestRoundStats: {
      round_number: 7,
      eliminated_this_round: 8,
      survivors: 12,
      total_eliminated: 144,
      total_players: 156,
      user_outcome: "WIN",
      user_picked_team: "Arsenal",
      competition_id: 1
    },
    currentRound: {
      round_number: 8,
      is_locked: false,
      fixture_count: 10,
      status: "ACTIVE"
    },
    pickStats: {
      players_with_picks: 8,
      total_active_players: 12,
      pick_percentage: 67
    },
    // NEW: Event data
    featuredEvent: {
      title: "Manchester Derby Screening",
      date: "2025-01-18",
      time: "3:00 PM",
      description: "Big screen showing with match day specials",
      survivorBonus: "Free pint + priority seating for Round 7 survivors",
      spotsLeft: 5,
      urgency: "THIS WEEKEND"
    },
    upcomingEvents: [
      {
        id: 'quiz-night',
        title: 'Quiz Night',
        date: '2025-01-21',
        time: '8:00 PM',
        survivorBonus: 'Double points for competition players',
        icon: '🧠'
      },
      {
        id: 'karaoke',
        title: 'Karaoke Night',
        date: '2025-01-25',
        time: '9:00 PM',
        survivorBonus: 'Skip the queue - sing first!',
        icon: '🎤'
      }
    ]
  };

  const openBookingModal = () => {
    setShowBooking(true);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header - Exactly like current dashboard */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between min-h-[4rem] py-2">
            <div className="flex items-center space-x-2 sm:space-x-4 flex-1 min-w-0">
              <Link
                href="/dashboard"
                className="flex items-center space-x-1 sm:space-x-2 text-slate-600 hover:text-slate-800 transition-colors flex-shrink-0"
              >
                <ArrowLeftIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="font-medium text-sm sm:text-base">Dashboard</span>
              </Link>
              <div className="h-4 sm:h-6 w-px bg-slate-300 flex-shrink-0" />
              <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
                <div className="min-w-0">
                  <h1 className="text-base sm:text-lg font-semibold text-slate-900 truncate">
                    Game Dashboard + Events
                  </h1>
                  <p className="text-xs text-slate-500">Integrated Mockup</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">

        {/* Latest Round Results Card - Exactly like current dashboard */}
        <div className="mb-6 sm:mb-8">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <TrophyIcon className="h-6 w-6 text-yellow-400 mr-3" />
                  <h2 className="text-lg font-bold text-white">
                    Round {mockData.latestRoundStats.round_number} Results
                  </h2>
                </div>
                <span className="text-slate-200 text-sm font-medium">Latest Eliminations</span>
              </div>
            </div>

            {/* Main Content */}
            <div className="px-6 py-6">
              <div className="text-center mb-6">
                <div className="bg-blue-50 rounded-xl p-6 border-2 border-blue-300 shadow-sm">
                  <p className="text-3xl text-blue-700 font-bold mb-1">
                    {mockData.latestRoundStats.survivors} players still in
                  </p>
                  <p className="text-base text-blue-600">
                    Advance to Round {mockData.latestRoundStats.round_number + 1}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center mb-6">
                <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                  <p className="text-2xl font-bold text-red-600 mb-1">
                    {mockData.latestRoundStats.eliminated_this_round}
                  </p>
                  <p className="text-xs text-red-700 font-medium">Players Eliminated</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <p className="text-2xl font-bold text-blue-600 mb-1">
                    {mockData.latestRoundStats.total_players}
                  </p>
                  <p className="text-xs text-blue-700 font-medium">Started With</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <p className="text-2xl font-bold text-slate-600 mb-1">
                    {mockData.latestRoundStats.total_eliminated}
                  </p>
                  <p className="text-xs text-slate-700 font-medium">Total Out</p>
                </div>
              </div>

              {/* Personal Status */}
              <div className="p-6 rounded-xl border-2 border-slate-300 bg-white shadow-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold mb-2 text-green-600">
                    ✅ You Advanced!
                  </div>
                  <div className="text-lg text-slate-700 mb-1">
                    Round {mockData.latestRoundStats.round_number}: Advanced
                  </div>
                  <div className="text-base text-slate-600 font-medium">
                    Picked: {mockData.latestRoundStats.user_picked_team}
                  </div>
                  <div className="text-base text-slate-600 font-medium mt-1">
                    Lives Remaining: {mockData.competition.lives_remaining}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Player Action Buttons - Exactly like current dashboard */}
        <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-slate-200 mb-6 sm:mb-8">
          <div className="grid grid-cols-2 gap-4 sm:gap-6">
            <button className="relative group text-center hover:opacity-80 transition-opacity duration-200 cursor-pointer">
              <div className="mb-4">
                <PlayIcon className="h-12 w-12 mx-auto group-hover:text-slate-800 transition-colors text-red-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-red-900">Play</h3>
              <div className="inline-flex items-center px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-semibold">
                Make your pick now!
              </div>
            </button>

            <Link href="#" className="group text-center hover:opacity-80 transition-opacity duration-200 cursor-pointer">
              <div className="mb-4">
                <TrophyIcon className="h-12 w-12 text-slate-600 mx-auto group-hover:text-slate-800 transition-colors" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Standings</h3>
              <p className="text-sm text-slate-600">View leaderboard and results</p>
            </Link>
          </div>
        </div>

        {/* 🔥 NEW: FEATURED EVENT BANNER - Positioned right after action buttons */}
        <div className="mb-6 sm:mb-8">
          <div className="relative bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl overflow-hidden text-white shadow-lg">
            {/* Urgency Badge */}
            <div className="absolute top-4 right-4 z-10">
              <div className="flex items-center space-x-1 bg-red-500 px-3 py-1 rounded-full text-xs font-bold animate-pulse">
                <FireIcon className="h-3 w-3" />
                <span>{mockData.featuredEvent.urgency}</span>
              </div>
            </div>

            <div className="p-6 sm:p-8">
              <div className="flex items-center space-x-2 mb-3">
                <span className="text-sm font-semibold bg-white bg-opacity-20 px-2 py-1 rounded">
                  🍺 YOUR COMPETITION VENUE
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-bold mb-3">{mockData.featuredEvent.title}</h2>
              <p className="text-lg mb-4 opacity-95">{mockData.featuredEvent.description}</p>

              <div className="flex flex-wrap items-center gap-4 mb-6">
                <div className="flex items-center space-x-2">
                  <CalendarDaysIcon className="h-5 w-5" />
                  <span>{new Date(mockData.featuredEvent.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric'
                  })}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <ClockIcon className="h-5 w-5" />
                  <span>{mockData.featuredEvent.time}</span>
                </div>
                <div className="flex items-center space-x-2 bg-white bg-opacity-20 px-2 py-1 rounded">
                  <span className="text-sm font-medium">Only {mockData.featuredEvent.spotsLeft} spots left!</span>
                </div>
              </div>

              {/* Round 7 Survivor Bonus */}
              <div className="bg-yellow-400 bg-opacity-20 border border-yellow-300 rounded-lg p-4 mb-6">
                <div className="flex items-center space-x-2 mb-2">
                  <GiftIcon className="h-5 w-5 text-yellow-200" />
                  <span className="font-semibold text-yellow-200">ROUND 7 SURVIVOR BONUS</span>
                </div>
                <p className="text-yellow-100">{mockData.featuredEvent.survivorBonus}</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={openBookingModal}
                  className="bg-white text-blue-700 px-6 py-3 rounded-full font-bold text-lg hover:bg-gray-100 transition-colors shadow-lg"
                >
                  Book Your Table
                </button>
                <button className="border-2 border-white text-white px-6 py-3 rounded-full font-bold hover:bg-white hover:text-blue-700 transition-colors">
                  View Venue Details
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Invite Code - Exactly like current dashboard */}
        <div className="mb-6 sm:mb-8">
          <div className="bg-white rounded-xl p-4 sm:p-6 border border-slate-200 shadow-sm">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center justify-center">
                <ClipboardDocumentIcon className="h-5 w-5 mr-2" />
                Invite Code
              </h3>
              <code className="text-2xl font-mono font-bold text-slate-800 tracking-wider block mb-2">
                {mockData.competition.invite_code}
              </code>
              <button
                onClick={() => navigator.clipboard.writeText(mockData.competition.invite_code)}
                className="px-3 py-1 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
              >
                Click to copy
              </button>
              <p className="text-xs text-slate-500 mt-2">Share this code to invite players</p>
            </div>
          </div>
        </div>

        {/* 🔥 NEW: More Upcoming Events Section */}
        <div className="mb-6 sm:mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="p-4 sm:p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">More Events at Your Venue</h3>
              <p className="text-sm text-slate-600 mt-1">Don't miss out on the action at The Crown & Anchor</p>
            </div>

            <div className="p-4 sm:p-6">
              <div className="grid gap-4">
                {mockData.upcomingEvents.map((event) => (
                  <div key={event.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className="text-2xl">{event.icon}</div>
                      <div>
                        <h4 className="font-semibold text-slate-900">{event.title}</h4>
                        <p className="text-sm text-slate-600">
                          {new Date(event.date).toLocaleDateString()} at {event.time}
                        </p>
                        <div className="flex items-center space-x-2 mt-1">
                          <CheckCircleIcon className="h-4 w-4 text-green-600" />
                          <span className="text-sm text-green-700">{event.survivorBonus}</span>
                        </div>
                      </div>
                    </div>
                    <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm">
                      Book
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Pick Statistics - Exactly like current dashboard */}
        <div className="mb-6 sm:mb-8">
          <div className="bg-white rounded-xl p-4 sm:p-6 border border-slate-200 shadow-sm">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-900 mb-1">
                Round {mockData.currentRound.round_number} Pick Status
              </h3>
              <p className="text-sm text-slate-600">
                {mockData.pickStats.players_with_picks} of {mockData.pickStats.total_active_players} players made their pick
              </p>
            </div>

            <div className="mb-4">
              <div className="w-full bg-slate-200 rounded-full h-8 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500 flex items-center justify-center"
                  style={{ width: `${mockData.pickStats.pick_percentage}%` }}
                >
                  <span className="text-white text-sm font-medium">
                    {mockData.pickStats.pick_percentage}%
                  </span>
                </div>
              </div>
            </div>

            <div className="text-center">
              <p className="text-sm font-medium text-blue-700">
                Almost there - {mockData.pickStats.total_active_players - mockData.pickStats.players_with_picks} players remaining
              </p>
            </div>
          </div>
        </div>

        {/* Venue Info Footer */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-3">The Crown & Anchor</h3>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4 text-sm text-slate-600">
              <div className="flex items-center space-x-1">
                <MapPinIcon className="h-4 w-4" />
                <span>123 High Street, Manchester M1 2AB</span>
              </div>
              <div>📞 0161 123 4567 • Open daily 12pm-11pm</div>
            </div>
          </div>
        </div>

      </main>

      {/* Booking Modal */}
      {showBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Book Table</h3>
              <p className="text-gray-600">{mockData.featuredEvent.title}</p>
              <p className="text-sm text-gray-500">
                {new Date(mockData.featuredEvent.date).toLocaleDateString()} at {mockData.featuredEvent.time}
              </p>
            </div>

            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Party Size</label>
                <select className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  <option>Just me</option>
                  <option>2 people</option>
                  <option>4 people</option>
                  <option>6 people</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                <input
                  type="tel"
                  className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="For booking confirmation"
                />
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <TrophyIcon className="h-5 w-5 text-yellow-600" />
                  <span className="font-semibold text-yellow-800">Round 7 Survivor Benefits</span>
                </div>
                <p className="text-sm text-yellow-700">{mockData.featuredEvent.survivorBonus}</p>
              </div>

              <div className="flex space-x-3 pt-6">
                <button
                  type="button"
                  onClick={() => setShowBooking(false)}
                  className="flex-1 border border-gray-300 rounded-lg py-3 px-4 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white rounded-lg py-3 px-4 font-medium hover:bg-blue-700 transition-colors"
                >
                  Confirm Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default IntegratedDashboardMockup;