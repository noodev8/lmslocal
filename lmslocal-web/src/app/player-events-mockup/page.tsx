'use client';

import React, { useState } from 'react';
import { CalendarIcon, ClockIcon, UserGroupIcon, StarIcon, MapPinIcon, GiftIcon, TrophyIcon } from '@heroicons/react/24/outline';
import { FireIcon, CheckCircleIcon } from '@heroicons/react/24/solid';

const PlayerEventsMockup = () => {
  const [showBooking, setShowBooking] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  const playerInfo = {
    name: "Sarah M.",
    status: "Round 7 Survivor",
    rank: "12th of 156",
    survivorPerks: true
  };

  const featuredEvent = {
    id: 'derby-screening',
    title: 'Manchester Derby Screening',
    date: '2025-01-18',
    time: '3:00 PM',
    description: 'Big screen showing with match day specials',
    survivorBonus: 'Free pint + priority seating for survivors',
    spotsLeft: 8,
    totalSpots: 60
  };

  const upcomingEvents = [
    {
      id: 'quiz-night',
      title: 'Quiz Night',
      date: '2025-01-15',
      time: '8:00 PM',
      description: 'Weekly pub quiz with cash prizes',
      survivorBonus: 'Double points for competition players',
      spotsLeft: 16,
      icon: '🧠'
    },
    {
      id: 'karaoke',
      title: 'Karaoke Night',
      date: '2025-01-20',
      time: '9:00 PM',
      description: 'Sing your heart out!',
      survivorBonus: 'Skip the queue - sing first!',
      spotsLeft: 20,
      icon: '🎤'
    },
    {
      id: 'live-music',
      title: 'Live Music: Local Band',
      date: '2025-01-25',
      time: '8:30 PM',
      description: 'Great indie rock band from Manchester',
      survivorBonus: 'Reserved table near the stage',
      spotsLeft: 12,
      icon: '🎸'
    }
  ];

  const openBookingModal = (event: any) => {
    setSelectedEvent(event);
    setShowBooking(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Player Status */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">The Crown & Anchor</h1>
              <p className="text-gray-600">Your competition venue</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Competition Status</div>
              <div className="font-semibold text-green-600">{playerInfo.status}</div>
              <div className="text-sm text-gray-500">{playerInfo.rank}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6">

        {/* Survivor Perks Banner */}
        {playerInfo.survivorPerks && (
          <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-lg p-4 mb-6 text-white">
            <div className="flex items-center space-x-2 mb-2">
              <TrophyIcon className="h-5 w-5" />
              <span className="font-semibold">🎉 SURVIVOR PERKS UNLOCKED!</span>
            </div>
            <p className="text-sm opacity-95">
              As a Round 7 survivor, you get exclusive bonuses at all pub events. Keep surviving for more rewards!
            </p>
          </div>
        )}

        {/* Featured Event - Big Banner */}
        <div className="relative bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl overflow-hidden mb-8 text-white">
          <div className="absolute top-4 right-4">
            <div className="flex items-center space-x-1 bg-red-500 px-2 py-1 rounded-full text-xs font-bold">
              <FireIcon className="h-3 w-3" />
              <span>THIS WEEKEND</span>
            </div>
          </div>

          <div className="p-8">
            <div className="flex items-center space-x-2 mb-3">
              <StarIcon className="h-5 w-5 text-yellow-300" />
              <span className="text-sm font-semibold">FEATURED EVENT</span>
            </div>

            <h2 className="text-3xl font-bold mb-3">{featuredEvent.title}</h2>
            <p className="text-lg mb-4 opacity-95">{featuredEvent.description}</p>

            <div className="flex items-center space-x-6 mb-6">
              <div className="flex items-center space-x-2">
                <CalendarIcon className="h-5 w-5" />
                <span>{new Date(featuredEvent.date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric'
                })}</span>
              </div>
              <div className="flex items-center space-x-2">
                <ClockIcon className="h-5 w-5" />
                <span>{featuredEvent.time}</span>
              </div>
              <div className="flex items-center space-x-2">
                <UserGroupIcon className="h-5 w-5" />
                <span>{featuredEvent.spotsLeft} spots left</span>
              </div>
            </div>

            {/* Survivor Bonus Highlight */}
            <div className="bg-yellow-400 bg-opacity-20 border border-yellow-300 rounded-lg p-4 mb-6">
              <div className="flex items-center space-x-2 mb-2">
                <GiftIcon className="h-5 w-5 text-yellow-200" />
                <span className="font-semibold text-yellow-200">YOUR SURVIVOR BONUS</span>
              </div>
              <p className="text-yellow-100">{featuredEvent.survivorBonus}</p>
            </div>

            <button
              onClick={() => openBookingModal(featuredEvent)}
              className="bg-white text-blue-700 px-8 py-3 rounded-full font-bold text-lg hover:bg-gray-100 transition-colors shadow-lg"
            >
              Book Your Table
            </button>
          </div>
        </div>

        {/* Other Upcoming Events */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-xl font-semibold text-gray-900">More Upcoming Events</h3>
            <p className="text-gray-600 mt-1">Don't miss out on the fun at your competition venue</p>
          </div>

          <div className="divide-y divide-gray-200">
            {upcomingEvents.map((event) => (
              <div key={event.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4">
                    <div className="text-3xl">{event.icon}</div>
                    <div className="flex-1">
                      <h4 className="text-lg font-semibold text-gray-900 mb-1">{event.title}</h4>
                      <p className="text-gray-600 mb-3">{event.description}</p>

                      <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
                        <div className="flex items-center space-x-1">
                          <CalendarIcon className="h-4 w-4" />
                          <span>{new Date(event.date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <ClockIcon className="h-4 w-4" />
                          <span>{event.time}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <UserGroupIcon className="h-4 w-4" />
                          <span>{event.spotsLeft} spots left</span>
                        </div>
                      </div>

                      {/* Survivor Bonus */}
                      {playerInfo.survivorPerks && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
                          <div className="flex items-center space-x-2">
                            <CheckCircleIcon className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium text-green-800">Survivor Bonus: </span>
                            <span className="text-sm text-green-700">{event.survivorBonus}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => openBookingModal(event)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Book Table
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Venue Info Footer */}
        <div className="bg-white rounded-lg shadow-sm mt-6 p-6">
          <h3 className="text-lg font-semibold mb-4">Venue Details</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center space-x-2 text-gray-600">
                <MapPinIcon className="h-4 w-4" />
                <span>123 High Street, Manchester M1 2AB</span>
              </div>
            </div>
            <div>
              <div className="text-gray-600">
                📞 0161 123 4567 • Open daily 12pm-11pm
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Booking Modal */}
      {showBooking && selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Book Table</h3>
              <p className="text-gray-600">{selectedEvent.title}</p>
              <p className="text-sm text-gray-500">
                {new Date(selectedEvent.date).toLocaleDateString()} at {selectedEvent.time}
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
                  <option>8+ people</option>
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

              {/* Survivor Perks Reminder */}
              {playerInfo.survivorPerks && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <TrophyIcon className="h-5 w-5 text-yellow-600" />
                    <span className="font-semibold text-yellow-800">Your Survivor Benefits</span>
                  </div>
                  <p className="text-sm text-yellow-700">
                    {selectedEvent.survivorBonus || 'Special perks available for competition survivors!'}
                  </p>
                </div>
              )}

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

export default PlayerEventsMockup;