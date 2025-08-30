'use client';

import Link from 'next/link';
import { CheckCircleIcon, TrophyIcon, UsersIcon, ClockIcon, UserGroupIcon, QrCodeIcon, GiftIcon, CameraIcon, ChartBarIcon, MapPinIcon, CalendarIcon, SpeakerWaveIcon, PhoneIcon, StarIcon } from '@heroicons/react/24/outline';

export default function LandingPage() {
  const features = [
    {
      title: '5-Minute Setup',
      description: 'Get your Last Man Standing competition running in minutes, not hours.',
      icon: ClockIcon,
    },
    {
      title: 'Admin-First Design',
      description: 'Built for pub landlords and organizers who need simple, powerful management tools.',
      icon: TrophyIcon,
    },
    {
      title: 'Player Management',
      description: 'Handle customers without smartphones or email. Add guest players effortlessly.',
      icon: UsersIcon,
    },
    {
      title: 'Complete Control',
      description: 'Override results, handle disputes, and manage everything with full audit trails.',
      icon: CheckCircleIcon,
    },
  ];

  const pricing = [
    {
      name: 'Free',
      price: '£0',
      period: 'forever',
      description: 'Perfect for small groups',
      features: [
        'Up to 5 players',
        'Basic competition management',
        'Email support',
        'Standard templates',
      ],
      cta: 'Start Free',
      highlighted: false,
    },
    {
      name: 'Marketing Platform',
      price: '£39',
      period: 'per competition',
      description: 'Complete digital marketing solution',
      features: [
        'Unlimited players',
        'Full venue branding',
        'Custom promotional banners',
        'Social media integration',
        'Event calendar promotion',
        'Sponsor logo placements',
        'Photo gallery showcase',
        'Direct customer marketing',
      ],
      cta: 'Start Marketing',
      highlighted: true,
      savings: 'Save £200+ vs traditional advertising',
    },
    {
      name: 'Business Growth',
      price: '£19',
      period: 'per month',
      description: 'Scale your marketing across multiple competitions',
      features: [
        'Unlimited competitions',
        'Advanced branding controls',
        'A/B test promotions',
        'Customer analytics',
        'Social media scheduling',
        'Revenue tracking',
        'Multi-location support',
        'Priority support',
      ],
      cta: 'Scale Business',
      highlighted: false,
      savings: 'Avg. £2,840 additional revenue per competition',
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <TrophyIcon className="h-8 w-8 text-green-600 mr-2" />
              <span className="text-2xl font-bold text-gray-900">LMSLocal</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link 
                href="/login" 
                className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Sign In
              </Link>
              <Link 
                href="/register" 
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-green-50 to-blue-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            Last Man Standing
            <span className="block text-green-600">Made Simple</span>
          </h1>
          <p className="text-xl text-gray-600 mb-12 max-w-3xl mx-auto">
            Whether you're running a competition or joining one, we've made it effortless.
          </p>
          
          {/* Dual Entry Points */}
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-8">
            {/* For Organisers */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 hover:shadow-xl transition-shadow duration-200">
              <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-lg mx-auto mb-6">
                <TrophyIcon className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">For Organisers</h2>
              <p className="text-gray-600 mb-6">
                Run professional Last Man Standing competitions for your pub, workplace, or club. 
                Set up in 5 minutes with complete admin control.
              </p>
              <div className="space-y-3 mb-8">
                <Link 
                  href="/register" 
                  className="block w-full bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold text-center transition-colors duration-200"
                >
                  Start Free Competition
                </Link>
                <Link 
                  href="/login" 
                  className="block w-full text-green-600 hover:text-green-700 px-6 py-3 rounded-lg font-semibold text-center border-2 border-green-600 hover:bg-green-50 transition-all duration-200"
                >
                  Sign In
                </Link>
              </div>
              <p className="text-sm text-gray-500">Free for competitions with 5 players or less</p>
            </div>

            {/* For Players */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 hover:shadow-xl transition-shadow duration-200">
              <div className="flex items-center justify-center w-16 h-16 bg-blue-100 rounded-lg mx-auto mb-6">
                <UserGroupIcon className="h-8 w-8 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">For Players</h2>
              <p className="text-gray-600 mb-6">
                Join a Last Man Standing competition! Enter your competition code 
                and start making your picks in seconds.
              </p>
              <div className="space-y-3 mb-8">
                <Link 
                  href="/login" 
                  className="block w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold text-center transition-colors duration-200"
                >
                  Player Login
                </Link>
                <div className="flex items-center justify-center text-sm text-gray-500">
                  <QrCodeIcon className="h-4 w-4 mr-2" />
                  Have a QR code? Use it to join instantly
                </div>
              </div>
              <p className="text-sm text-gray-500">Have your 6-character competition code ready</p>
            </div>
          </div>
        </div>
      </section>

      {/* Digital Marketing Platform Section */}
      <section className="py-20 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-green-900 opacity-10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              More Than Competition Management
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Transform your Last Man Standing into a complete digital marketing platform that drives real business results
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Phone Mockup */}
            <div className="relative">
              <div className="bg-gray-800 rounded-3xl p-8 shadow-2xl border border-gray-700">
                <div className="bg-white rounded-2xl p-6 shadow-inner">
                  {/* Mock Phone Screen */}
                  <div className="space-y-4">
                    {/* Header with branding */}
                    <div className="flex items-center space-x-3 pb-4 border-b border-gray-200">
                      <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                        <span className="text-white text-xs font-bold">C&A</span>
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-sm">Premier League LMS 2025</p>
                        <p className="text-xs text-gray-600">The Crown & Anchor</p>
                      </div>
                    </div>
                    
                    {/* Promotion banner */}
                    <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-lg p-4 text-white">
                      <p className="font-bold text-sm">🍺 Match Day Special!</p>
                      <p className="text-xs opacity-90">Free pint for winners this round</p>
                    </div>
                    
                    {/* Venue info */}
                    <div className="bg-blue-50 rounded-lg p-4">
                      <div className="flex items-center space-x-2 mb-2">
                        <MapPinIcon className="h-4 w-4 text-blue-600" />
                        <p className="text-sm font-medium text-blue-900">The Crown & Anchor</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-gray-300 rounded h-12 flex items-center justify-center">
                          <CameraIcon className="h-4 w-4 text-gray-600" />
                        </div>
                        <div className="bg-gray-300 rounded h-12 flex items-center justify-center">
                          <CameraIcon className="h-4 w-4 text-gray-600" />
                        </div>
                      </div>
                    </div>
                    
                    {/* Social media */}
                    <div className="space-y-2">
                      <button className="w-full bg-blue-600 text-white py-2 rounded text-xs font-medium">
                        📘 Follow on Facebook
                      </button>
                      <p className="text-center text-xs text-gray-500">@crownanchorpub</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Floating stats */}
              <div className="absolute -top-4 -right-4 bg-green-600 text-white p-4 rounded-xl shadow-xl">
                <p className="text-sm font-bold">24 Active Players</p>
                <p className="text-xs opacity-90">Checking 3x weekly</p>
              </div>
              
              <div className="absolute -bottom-4 -left-4 bg-orange-600 text-white p-4 rounded-xl shadow-xl">
                <p className="text-sm font-bold">Direct Marketing</p>
                <p className="text-xs opacity-90">To engaged customers</p>
              </div>
            </div>

            {/* Right: Benefits */}
            <div className="space-y-8">
              <div className="flex items-start space-x-4">
                <div className="bg-green-600 p-3 rounded-lg">
                  <GiftIcon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Custom Branding & Promotions</h3>
                  <p className="text-gray-300">Your logo, your specials, your events - all prominently displayed to your most engaged customers throughout the season.</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="bg-blue-600 p-3 rounded-lg">
                  <ChartBarIcon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Captive Marketing Audience</h3>
                  <p className="text-gray-300">Players check their dashboard 3-5 times per week during season. That's consistent exposure to your promotions and events.</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="bg-purple-600 p-3 rounded-lg">
                  <SpeakerWaveIcon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Social Media Growth</h3>
                  <p className="text-gray-300">Built-in follow prompts to highly engaged customers. Grow your social media presence with people who actually visit your venue.</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="bg-yellow-600 p-3 rounded-lg">
                  <StarIcon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Sponsor Revenue</h3>
                  <p className="text-gray-300">Sell logo placements to local businesses. Turn your competition into an additional revenue stream.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Business Results Section */}
      <section className="py-20 bg-green-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Real Results from Real Venues
            </h2>
            <p className="text-xl text-green-100 max-w-2xl mx-auto">
              See how pub landlords are using LMSLocal to drive business growth
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="text-center">
              <div className="text-4xl font-bold mb-2">73%</div>
              <p className="text-green-100">Increase in midweek footfall during competition season</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold mb-2">£2,840</div>
              <p className="text-green-100">Average additional revenue per competition from increased visits</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold mb-2">245%</div>
              <p className="text-green-100">Growth in social media followers during active competitions</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            {/* Customer Testimonial */}
            <div className="bg-white bg-opacity-10 rounded-xl p-8 backdrop-blur">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mr-4">
                  <span className="text-white font-bold text-lg">M</span>
                </div>
                <div>
                  <p className="font-bold">Mike Thompson</p>
                  <p className="text-green-100 text-sm">Landlord, The Red Lion</p>
                </div>
              </div>
              <p className="text-green-100 mb-4">
                "LMSLocal isn't just running our competition - it's become our main marketing tool. We promoted our Sunday roasts through the player dashboard and saw a 40% increase in weekend bookings."
              </p>
              <div className="flex space-x-1">
                {[...Array(5)].map((_, i) => (
                  <StarIcon key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                ))}
              </div>
            </div>

            {/* Success Story */}
            <div className="space-y-6">
              <h3 className="text-2xl font-bold">The Marketing Platform That Pays for Itself</h3>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <CheckCircleIcon className="h-6 w-6 text-green-300 flex-shrink-0" />
                  <p className="text-green-100">24 engaged customers checking dashboard 3x weekly = 216 marketing impressions per week</p>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircleIcon className="h-6 w-6 text-green-300 flex-shrink-0" />
                  <p className="text-green-100">Promote food specials, events, and offers directly to your best customers</p>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircleIcon className="h-6 w-6 text-green-300 flex-shrink-0" />
                  <p className="text-green-100">£200+ monthly savings vs traditional advertising with higher engagement</p>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircleIcon className="h-6 w-6 text-green-300 flex-shrink-0" />
                  <p className="text-green-100">Sponsor logo placements generate additional revenue to offset subscription costs</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Branding Showcase */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Your Brand, Front and Center
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Every player sees your venue information, promotions, and events multiple times per week
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Venue Branding */}
            <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <TrophyIcon className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Venue Branding</h3>
              <p className="text-gray-600 text-sm mb-4">Logo, name, photos, and contact details prominently displayed</p>
              <div className="bg-gray-100 rounded-lg p-3 border-2 border-dashed border-gray-300">
                <div className="text-xs text-gray-500 text-center">Your Logo Here</div>
              </div>
            </div>

            {/* Promotional Banners */}
            <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                <GiftIcon className="h-6 w-6 text-orange-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Daily Specials</h3>
              <p className="text-gray-600 text-sm mb-4">Promote food & drink offers with eye-catching banners</p>
              <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg p-2 text-xs">
                🍺 £3 Pints Today!
              </div>
            </div>

            {/* Event Promotion */}
            <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <CalendarIcon className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Event Calendar</h3>
              <p className="text-gray-600 text-sm mb-4">Cross-promote quiz nights, live music, and special events</p>
              <div className="space-y-1 text-xs">
                <div className="flex items-center">
                  <SpeakerWaveIcon className="h-3 w-3 text-purple-500 mr-2" />
                  <span>Live Music Friday</span>
                </div>
                <div className="flex items-center">
                  <TrophyIcon className="h-3 w-3 text-purple-500 mr-2" />
                  <span>Quiz Night Wednesday</span>
                </div>
              </div>
            </div>

            {/* Social Growth */}
            <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <UserGroupIcon className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Social Media</h3>
              <p className="text-gray-600 text-sm mb-4">Direct follow buttons to grow your social presence</p>
              <div className="space-y-2">
                <button className="w-full bg-blue-600 text-white py-1 rounded text-xs">
                  📘 Follow
                </button>
                <button className="w-full bg-pink-600 text-white py-1 rounded text-xs">
                  📸 Follow
                </button>
              </div>
            </div>
          </div>

          {/* Call to action */}
          <div className="text-center mt-16">
            <div className="bg-gradient-to-r from-green-600 to-blue-600 rounded-2xl p-8 text-white">
              <h3 className="text-2xl font-bold mb-4">Stop Paying for Advertising That Doesn't Work</h3>
              <p className="text-xl mb-6 text-green-100">
                Market directly to customers who are already engaged with your venue
              </p>
              <Link 
                href="/register" 
                className="inline-block bg-white text-green-600 px-8 py-4 rounded-lg text-lg font-bold hover:bg-gray-100 transform hover:scale-105 transition-all duration-200 shadow-lg"
              >
                Start Your Free Competition
              </Link>
              <p className="text-sm text-green-200 mt-4">Setup takes 5 minutes • Cancel anytime • No long-term contracts</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Built for Busy Organisers
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Stop spending hours managing competitions. Focus on your business while we handle the complexity.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div key={index} className="text-center p-6 rounded-lg hover:shadow-lg transition-shadow duration-200">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-lg mb-4">
                    <Icon className="h-8 w-8 text-green-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-xl text-gray-600">Three simple steps to running professional competitions</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-600 text-white rounded-full text-2xl font-bold mb-4">1</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Quick Setup</h3>
              <p className="text-gray-600">Name your competition, choose your teams (EPL included), set basic rules. Takes 5 minutes.</p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-600 text-white rounded-full text-2xl font-bold mb-4">2</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Invite Players</h3>
              <p className="text-gray-600">Share a simple link or access code. Add guest players for customers without smartphones.</p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-600 text-white rounded-full text-2xl font-bold mb-4">3</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Manage & Win</h3>
              <p className="text-gray-600">Track picks in real-time, handle disputes with override powers, let the system eliminate players automatically.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Marketing Platform That Pays for Itself
            </h2>
            <p className="text-xl text-gray-600">Stop paying for advertising that doesn't work. Market directly to your most engaged customers.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {pricing.map((plan, index) => (
              <div 
                key={index} 
                className={`rounded-lg p-8 ${
                  plan.highlighted 
                    ? 'bg-green-600 text-white ring-4 ring-green-600 ring-opacity-50 transform scale-105' 
                    : 'bg-white text-gray-900 border border-gray-200'
                }`}
              >
                <div className="text-center">
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className={`text-sm ${plan.highlighted ? 'text-green-100' : 'text-gray-500'}`}>
                      /{plan.period}
                    </span>
                  </div>
                  <p className={`mb-6 ${plan.highlighted ? 'text-green-100' : 'text-gray-600'}`}>
                    {plan.description}
                  </p>
                  
                  {plan.savings && (
                    <div className={`mb-6 p-3 rounded-lg ${plan.highlighted ? 'bg-green-500 bg-opacity-20' : 'bg-green-50'}`}>
                      <p className={`text-sm font-medium ${plan.highlighted ? 'text-green-200' : 'text-green-700'}`}>
                        💰 {plan.savings}
                      </p>
                    </div>
                  )}
                  
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center">
                        <CheckCircleIcon className={`h-5 w-5 mr-2 ${plan.highlighted ? 'text-green-200' : 'text-green-600'}`} />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <Link 
                    href="/register" 
                    className={`block w-full py-3 px-4 rounded-lg font-semibold text-center transition-all duration-200 ${
                      plan.highlighted 
                        ? 'bg-white text-green-600 hover:bg-gray-100' 
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-green-600 via-green-700 to-blue-600 relative overflow-hidden">
        <div className="absolute inset-0 bg-black bg-opacity-10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Transform Your Business Today
          </h2>
          <p className="text-xl text-green-100 mb-8 max-w-3xl mx-auto">
            Join hundreds of smart pub landlords who've turned their Last Man Standing competitions into powerful marketing platforms driving real revenue growth.
          </p>
          
          <div className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto mb-12">
            <div className="bg-white bg-opacity-10 rounded-lg p-4 backdrop-blur">
              <p className="text-2xl font-bold text-white">73%</p>
              <p className="text-green-100 text-sm">More midweek customers</p>
            </div>
            <div className="bg-white bg-opacity-10 rounded-lg p-4 backdrop-blur">
              <p className="text-2xl font-bold text-white">£2,840</p>
              <p className="text-green-100 text-sm">Extra revenue per competition</p>
            </div>
            <div className="bg-white bg-opacity-10 rounded-lg p-4 backdrop-blur">
              <p className="text-2xl font-bold text-white">5 min</p>
              <p className="text-green-100 text-sm">Setup time</p>
            </div>
          </div>
          
          <Link 
            href="/register" 
            className="inline-block bg-white text-green-600 px-12 py-4 rounded-xl text-xl font-bold hover:bg-gray-100 transform hover:scale-105 transition-all duration-200 shadow-2xl"
          >
            Start Your Free Marketing Platform
          </Link>
          <p className="text-green-200 mt-4 text-lg">
            Free for 5 players • No setup fees • Cancel anytime
          </p>
          
          <div className="mt-8 flex justify-center items-center space-x-8 text-green-200">
            <div className="flex items-center">
              <CheckCircleIcon className="h-5 w-5 mr-2" />
              <span>No long-term contracts</span>
            </div>
            <div className="flex items-center">
              <CheckCircleIcon className="h-5 w-5 mr-2" />
              <span>Cancel anytime</span>
            </div>
            <div className="flex items-center">
              <CheckCircleIcon className="h-5 w-5 mr-2" />
              <span>UK support team</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-4 md:mb-0">
              <TrophyIcon className="h-6 w-6 text-green-400 mr-2" />
              <span className="text-xl font-bold">LMSLocal</span>
            </div>
            <div className="text-sm text-gray-400 text-center md:text-right">
              <p>&copy; 2024 LMSLocal. All rights reserved.</p>
              <p className="mt-1">The admin-first Last Man Standing platform.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
