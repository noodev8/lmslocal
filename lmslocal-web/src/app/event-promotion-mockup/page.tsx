'use client';

import React, { useState } from 'react';
import { CalendarIcon, ClockIcon, UserGroupIcon, StarIcon, MapPinIcon, PhoneIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon, TrophyIcon, FireIcon } from '@heroicons/react/24/solid';

const EventPromotionMockup = () => {
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [showBooking, setShowBooking] = useState(false);

  const events = [
    {
      id: 'quiz-tonight',
      title: 'Quiz Night',
      date: '2025-01-15',
      time: '8:00 PM',
      type: 'quiz',
      description: 'Weekly pub quiz with cash prizes! Last Man Standing players get bonus points.',
      attendees: 24,
      maxCapacity: 40,
      prize: '£100 cash prize',
      featured: true,
      bookingsFromCompetition: 12
    },
    {
      id: 'derby-screening',
      title: 'Manchester Derby Screening',
      date: '2025-01-18',
      time: '3:00 PM',
      type: 'match',
      description: 'Big screen showing with match day specials. Book your table now!',
      attendees: 45,
      maxCapacity: 60,
      prize: 'Free pints for correct score predictions',
      featured: true,
      bookingsFromCompetition: 18
    },
    {
      id: 'karaoke',
      title: 'Karaoke Night',
      date: '2025-01-20',
      time: '9:00 PM',
      type: 'entertainment',
      description: 'Sing your heart out! Competition survivors get priority song selection.',
      attendees: 15,
      maxCapacity: 35,
      prize: null,
      featured: false,
      bookingsFromCompetition: 3
    }
  ];

  const competitionStats = {
    totalPlayers: 156,
    activeViewers: 89,
    weeklyEngagement: '4.2 visits per player',
    lastWeekBookings: 23,
    revenue: 287.50
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Event Promotion Dashboard</h1>
          <p className="text-gray-600">Turn your Last Man Standing competition into a marketing machine</p>
        </div>

        {/* Competition Performance Banner */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-6 mb-8 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold mb-2">Your Competition Marketing Power</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-2xl font-bold">{competitionStats.totalPlayers}</div>
                  <div className="text-sm opacity-90">Total Players</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{competitionStats.activeViewers}</div>
                  <div className="text-sm opacity-90">Weekly Active</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{competitionStats.weeklyEngagement}</div>
                  <div className="text-sm opacity-90">Avg Visits/Week</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">£{competitionStats.revenue}</div>
                  <div className="text-sm opacity-90">Revenue This Week</div>
                </div>
              </div>
            </div>
            <TrophyIcon className="h-16 w-16 opacity-80" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Event Management */}
          <div className="lg:col-span-2 space-y-6">

            {/* Featured Event Banner */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white relative overflow-hidden">
              <div className="absolute top-2 right-2">
                <FireIcon className="h-6 w-6 text-yellow-300" />
              </div>
              <div className="flex items-center space-x-2 mb-3">
                <StarIcon className="h-5 w-5 text-yellow-300" />
                <span className="text-sm font-semibold">FEATURED EVENT</span>
              </div>
              <h3 className="text-2xl font-bold mb-2">Quiz Night Tonight!</h3>
              <p className="text-lg mb-4">£100 cash prize • Competition players get double points</p>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-1">
                  <ClockIcon className="h-4 w-4" />
                  <span>8:00 PM</span>
                </div>
                <div className="flex items-center space-x-1">
                  <UserGroupIcon className="h-4 w-4" />
                  <span>24/40 booked</span>
                </div>
              </div>
              <button
                onClick={() => setShowBooking(true)}
                className="mt-4 bg-white text-blue-600 px-6 py-2 rounded-full font-semibold hover:bg-gray-100 transition-colors"
              >
                Book Table
              </button>
            </div>

            {/* All Events List */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold">Upcoming Events</h3>
              </div>
              <div className="divide-y divide-gray-200">
                {events.map((event) => (
                  <div key={event.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h4 className="text-lg font-semibold">{event.title}</h4>
                          {event.featured && (
                            <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-semibold">
                              FEATURED
                            </span>
                          )}
                        </div>
                        <p className="text-gray-600 mb-3">{event.description}</p>
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
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
                            <span>{event.attendees}/{event.maxCapacity}</span>
                          </div>
                        </div>
                        {event.prize && (
                          <div className="mt-2 text-sm text-green-600 font-semibold">
                            🏆 {event.prize}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-500 mb-2">From Competition</div>
                        <div className="text-2xl font-bold text-green-600">{event.bookingsFromCompetition}</div>
                        <div className="text-xs text-gray-500">bookings</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Analytics & Tools */}
          <div className="space-y-6">

            {/* Quick Stats */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">This Week's Performance</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Event Views</span>
                  <span className="font-semibold">1,247</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Bookings Made</span>
                  <span className="font-semibold text-green-600">23</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Revenue Generated</span>
                  <span className="font-semibold text-green-600">£287.50</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Conversion Rate</span>
                  <span className="font-semibold">18.4%</span>
                </div>
              </div>
            </div>

            {/* Competition Integration */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Competition Integration</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-2 text-sm text-green-600">
                  <CheckCircleIcon className="h-4 w-4" />
                  <span>Auto-notify remaining players</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-green-600">
                  <CheckCircleIcon className="h-4 w-4" />
                  <span>Survivor rewards program</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-green-600">
                  <CheckCircleIcon className="h-4 w-4" />
                  <span>Match day predictions</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-green-600">
                  <CheckCircleIcon className="h-4 w-4" />
                  <span>Social media auto-posting</span>
                </div>
              </div>
            </div>

            {/* Calendar Widget */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Event Calendar</h3>
              <div className="grid grid-cols-7 gap-1 text-xs mb-2">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
                  <div key={day} className="text-center font-semibold text-gray-500 p-2">{day}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1 text-sm">
                {Array.from({ length: 35 }, (_, i) => {
                  const day = i - 6;
                  const hasEvent = [8, 11, 15, 18, 20, 25].includes(day);
                  return (
                    <div key={i} className={`p-2 text-center hover:bg-gray-100 rounded ${
                      day <= 0 ? 'text-gray-300' :
                      hasEvent ? 'bg-blue-100 text-blue-800 font-semibold' : 'text-gray-700'
                    }`}>
                      {day > 0 ? day : ''}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Contact Info */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Pub Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center space-x-2">
                  <MapPinIcon className="h-4 w-4 text-gray-500" />
                  <span>123 High Street, Manchester</span>
                </div>
                <div className="flex items-center space-x-2">
                  <PhoneIcon className="h-4 w-4 text-gray-500" />
                  <span>0161 123 4567</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Booking Modal */}
        {showBooking && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h3 className="text-lg font-semibold mb-4">Book Table for Quiz Night</h3>
              <form className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Party Size</label>
                  <select className="w-full border border-gray-300 rounded-lg p-2">
                    <option>2 people</option>
                    <option>4 people</option>
                    <option>6 people</option>
                    <option>8 people</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input type="text" className="w-full border border-gray-300 rounded-lg p-2" placeholder="Your name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input type="tel" className="w-full border border-gray-300 rounded-lg p-2" placeholder="Your phone number" />
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="text-sm text-green-800">
                    <strong>Competition Player Bonus:</strong> Double quiz points tonight!
                  </div>
                </div>
                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowBooking(false)}
                    className="flex-1 border border-gray-300 rounded-lg py-2 px-4 text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white rounded-lg py-2 px-4 hover:bg-blue-700"
                  >
                    Book Table
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventPromotionMockup;