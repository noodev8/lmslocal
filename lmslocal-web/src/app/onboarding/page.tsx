'use client';

import { useState } from 'react';
import Link from 'next/link';
import { TrophyIcon, CheckCircleIcon, SparklesIcon, HeartIcon } from '@heroicons/react/24/outline';
import { onboardingApi, OnboardingApplicationRequest } from '@/lib/api';

export default function OnboardingPage() {
  const [formData, setFormData] = useState({
    venueName: '',
    venueType: '',
    contactName: '',
    email: '',
    phone: '',
    estimatedPlayers: '',
    preferredStartDate: '',
    description: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      // Prepare API request data
      const applicationData: OnboardingApplicationRequest = {
        venueName: formData.venueName || undefined,
        venueType: formData.venueType ? (formData.venueType as 'pub' | 'club' | 'workplace' | 'friends' | 'other') : undefined,
        contactName: formData.contactName,
        email: formData.email,
        phone: formData.phone || undefined,
        estimatedPlayers: formData.estimatedPlayers ? parseInt(formData.estimatedPlayers) : undefined,
        preferredStartDate: formData.preferredStartDate || undefined,
        description: formData.description || undefined
      };

      // Call API
      const response = await onboardingApi.submitApplication(applicationData);

      // Check response
      if (response.data.return_code === 'SUCCESS') {
        setSubmitStatus('success');
        // Reset form
        setFormData({
          venueName: '',
          venueType: '',
          contactName: '',
          email: '',
          phone: '',
          estimatedPlayers: '',
          preferredStartDate: '',
          description: ''
        });
      } else {
        // API returned error
        console.error('API error:', response.data.message);
        setSubmitStatus('error');
      }
    } catch (error) {
      console.error('Error submitting application:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-sm shadow-sm border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <Link href="/" className="flex items-center">
              <TrophyIcon className="h-8 w-8 text-slate-700 mr-2" />
              <span className="text-2xl font-bold text-slate-900">LMSLocal</span>
            </Link>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <Link
                href="/login"
                className="text-slate-600 hover:text-slate-900 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-100 transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="bg-slate-800 hover:bg-slate-900 text-white px-4 sm:px-6 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
              >
                Register
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-800 py-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-emerald-900 bg-opacity-20"></div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center bg-white/20 backdrop-blur-sm rounded-full px-6 py-2 mb-6 border border-white/30">
            <SparklesIcon className="h-5 w-5 text-white mr-2" />
            <span className="text-white font-semibold text-sm">Limited Time Offer</span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
            Done-For-You Launch Package
          </h1>

          <p className="text-xl md:text-2xl text-emerald-100 mb-4">
            Get your Last Man Standing competition up and running with full support
          </p>

          <div className="inline-block bg-white rounded-2xl px-8 py-4 mb-8">
            <p className="text-3xl md:text-4xl font-bold text-slate-900">
              <span className="line-through text-slate-400 text-2xl mr-3">£149</span>
              FREE
            </p>
            <p className="text-slate-600 font-semibold mt-1">Limited availability</p>
          </div>

          <p className="text-emerald-100 text-lg max-w-2xl mx-auto">
            We&apos;ll personally set up your competition, guide you through your first full cycle, and ensure you&apos;re confident running it independently.
          </p>
        </div>
      </section>

      {/* What's Included */}
      <section className="py-16 bg-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              What&apos;s Included
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Complete hands-on support from setup to your first winner
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-12">
            {/* Setup Phase */}
            <div className="bg-slate-50 rounded-xl p-8 border-2 border-slate-200">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
                <span className="text-2xl font-bold text-emerald-700">1</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Complete Setup</h3>
              <p className="text-slate-600 mb-4">Week 1</p>
              <ul className="space-y-3 text-slate-700">
                <li className="flex items-start">
                  <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 flex-shrink-0 mt-0.5" />
                  <span>30-minute onboarding call</span>
                </li>
                <li className="flex items-start">
                  <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 flex-shrink-0 mt-0.5" />
                  <span>Competition configuration (rules, format, fixtures)</span>
                </li>
                <li className="flex items-start">
                  <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 flex-shrink-0 mt-0.5" />
                  <span>Custom promotional materials (coming soon)</span>
                </li>
                <li className="flex items-start">
                  <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 flex-shrink-0 mt-0.5" />
                  <span>Player invitation system ready to go</span>
                </li>
              </ul>
            </div>

            {/* Support Phase */}
            <div className="bg-emerald-50 rounded-xl p-8 border-2 border-emerald-500">
              <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center mb-4">
                <span className="text-2xl font-bold text-white">2</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Full Competition Support</h3>
              <p className="text-slate-600 mb-4">4-8 Weeks</p>
              <ul className="space-y-3 text-slate-700">
                <li className="flex items-start">
                  <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 flex-shrink-0 mt-0.5" />
                  <span>Weekly check-ins throughout first competition</span>
                </li>
                <li className="flex items-start">
                  <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 flex-shrink-0 mt-0.5" />
                  <span>Direct WhatsApp/email support</span>
                </li>
                <li className="flex items-start">
                  <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 flex-shrink-0 mt-0.5" />
                  <span>Help with player questions and issues</span>
                </li>
                <li className="flex items-start">
                  <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 flex-shrink-0 mt-0.5" />
                  <span>Guidance on round progression</span>
                </li>
              </ul>
            </div>

            {/* Handover Phase */}
            <div className="bg-slate-50 rounded-xl p-8 border-2 border-slate-200">
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mb-4">
                <span className="text-2xl font-bold text-slate-700">3</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Handover & Independence</h3>
              <p className="text-slate-600 mb-4">End of Competition</p>
              <ul className="space-y-3 text-slate-700">
                <li className="flex items-start">
                  <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 flex-shrink-0 mt-0.5" />
                  <span>Documentation of your setup</span>
                </li>
                <li className="flex items-start">
                  <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 flex-shrink-0 mt-0.5" />
                  <span>Access to self-serve tools and resources</span>
                </li>
                <li className="flex items-start">
                  <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 flex-shrink-0 mt-0.5" />
                  <span>You&apos;re ready to run future competitions independently</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Who This Is For */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Is This For You?
            </h2>
            <p className="text-xl text-slate-600">
              This package is perfect if you meet these criteria:
            </p>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-lg border-2 border-slate-200">
            <ul className="space-y-4">
              <li className="flex items-start">
                <CheckCircleIcon className="h-6 w-6 text-emerald-600 mr-3 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-900 mb-1">Active Venue or Organization</p>
                  <p className="text-slate-600">You run a pub, club, workplace, or have an active community with regular members/customers</p>
                </div>
              </li>
              <li className="flex items-start">
                <CheckCircleIcon className="h-6 w-6 text-emerald-600 mr-3 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-900 mb-1">Ready Participants</p>
                  <p className="text-slate-600">You have at least 10-15 potential players ready to join when you launch</p>
                </div>
              </li>
              <li className="flex items-start">
                <CheckCircleIcon className="h-6 w-6 text-emerald-600 mr-3 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-900 mb-1">Commitment to Complete</p>
                  <p className="text-slate-600">You&apos;re committed to running your first competition through to completion with our support</p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Why We're Doing This */}
      <section className="py-16 bg-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-slate-700/50 rounded-2xl p-8 border-2 border-slate-600">
            <div className="flex items-start space-x-4 mb-6">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center">
                  <HeartIcon className="h-6 w-6 text-white" />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white mb-2">Why Are We Doing This?</h3>
                <p className="text-slate-200 mb-4">
                  We&apos;re using our early launch phase to refine our onboarding process, build better resources, and truly understand what venues need to succeed.
                </p>
                <p className="text-slate-200 mb-4">
                  Your feedback during this process will help us build a better product for everyone. In exchange, you get complete hands-on support that would normally cost £149.
                </p>
                <p className="text-slate-200">
                  <strong>After the free onboarding period</strong>, we&apos;ll transition to:
                </p>
                <ul className="mt-3 space-y-2 text-slate-200">
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span><strong>Free Self-Serve</strong>: Documentation and videos for DIY setup</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span><strong>£149 Launch Package</strong>: Same hands-on onboarding for those who want it</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Application Form */}
      <section className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Apply For Free Onboarding
            </h2>
            <p className="text-xl text-slate-600">
              Fill out the form below and we&apos;ll be in touch within 24 hours
            </p>
          </div>

          {submitStatus === 'success' ? (
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-500 rounded-2xl p-8 text-center shadow-lg animate-fade-in">
              <div className="mb-6">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-600 rounded-full mb-4 animate-bounce">
                  <CheckCircleIcon className="h-12 w-12 text-white" />
                </div>
              </div>
              <h3 className="text-3xl font-bold text-slate-900 mb-3">Application Submitted Successfully!</h3>
              <div className="bg-white rounded-lg p-6 mb-6 text-left max-w-xl mx-auto">
                <h4 className="font-bold text-slate-900 mb-3 text-center">What happens next?</h4>
                <ul className="space-y-2 text-slate-700">
                  <li className="flex items-start">
                    <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 flex-shrink-0 mt-0.5" />
                    <span>We&apos;ll review your application within 24 hours</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 flex-shrink-0 mt-0.5" />
                    <span>You&apos;ll receive a confirmation email shortly</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 flex-shrink-0 mt-0.5" />
                    <span>We&apos;ll contact you to schedule your onboarding call</span>
                  </li>
                </ul>
              </div>
              <p className="text-slate-600 mb-6">
                Check your email inbox for confirmation. If you don&apos;t see it, check your spam folder.
              </p>
              <button
                onClick={() => setSubmitStatus('idle')}
                className="text-emerald-700 font-semibold hover:text-emerald-800 underline"
              >
                Submit another application
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-8 shadow-lg border-2 border-slate-200">
              <div className="space-y-6">
                {/* Venue Name */}
                <div>
                  <label htmlFor="venueName" className="block text-sm font-semibold text-slate-900 mb-2">
                    Venue/Organization Name
                  </label>
                  <input
                    type="text"
                    id="venueName"
                    name="venueName"
                    value={formData.venueName}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-900"
                    placeholder="e.g., The Red Lion Pub"
                  />
                </div>

                {/* Venue Type */}
                <div>
                  <label htmlFor="venueType" className="block text-sm font-semibold text-slate-900 mb-2">
                    Type
                  </label>
                  <select
                    id="venueType"
                    name="venueType"
                    value={formData.venueType}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-900"
                  >
                    <option value="">Select type...</option>
                    <option value="pub">Pub/Bar</option>
                    <option value="club">Club/Social Club</option>
                    <option value="workplace">Workplace</option>
                    <option value="friends">Friend Group</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Contact Name */}
                <div>
                  <label htmlFor="contactName" className="block text-sm font-semibold text-slate-900 mb-2">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    id="contactName"
                    name="contactName"
                    required
                    value={formData.contactName}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-900"
                    placeholder="John Smith"
                  />
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-slate-900 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-900"
                    placeholder="john@example.com"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label htmlFor="phone" className="block text-sm font-semibold text-slate-900 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-900"
                    placeholder="+44 7700 900000"
                  />
                </div>

                {/* Estimated Players */}
                <div>
                  <label htmlFor="estimatedPlayers" className="block text-sm font-semibold text-slate-900 mb-2">
                    Estimated Number of Players
                  </label>
                  <input
                    type="number"
                    id="estimatedPlayers"
                    name="estimatedPlayers"
                    min="10"
                    value={formData.estimatedPlayers}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-900"
                    placeholder="e.g., 25"
                  />
                  <p className="text-sm text-slate-500 mt-1">Minimum 10 players if provided</p>
                </div>

                {/* Preferred Start Date */}
                <div>
                  <label htmlFor="preferredStartDate" className="block text-sm font-semibold text-slate-900 mb-2">
                    Preferred Start Date
                  </label>
                  <input
                    type="date"
                    id="preferredStartDate"
                    name="preferredStartDate"
                    value={formData.preferredStartDate}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-900"
                  />
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="description" className="block text-sm font-semibold text-slate-900 mb-2">
                    Tell Us About Your Venue/Audience
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    rows={4}
                    value={formData.description}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-900"
                    placeholder="Brief description of your venue and what you're looking to achieve..."
                  />
                </div>

                {submitStatus === 'error' && (
                  <div className="bg-red-50 border border-red-300 rounded-lg p-4 text-red-700">
                    <p>There was an error submitting your application. Please try again.</p>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white px-8 py-4 rounded-lg text-lg font-semibold transition-colors shadow-lg"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Application'}
                </button>

                <p className="text-sm text-slate-500 text-center">
                  By submitting, you agree to be contacted by our team about your onboarding.
                </p>
              </div>
            </form>
          )}
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-slate-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-8 text-center">
            Frequently Asked Questions
          </h2>

          <div className="space-y-6">
            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                What happens after I submit the application?
              </h3>
              <p className="text-slate-700">
                We&apos;ll review your application within 24 hours and reach out to schedule your 30-minute onboarding call. From there, we&apos;ll get your competition set up and support you through to completion.
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                How long does support last?
              </h3>
              <p className="text-slate-700">
                Support continues until your first competition completes (when you have a winner). This typically takes 4-8 weeks depending on your format and round frequency.
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                What if I need more than 20 player slots?
              </h3>
              <p className="text-slate-700">
                The platform includes 20 free player slots. If you need more, you can purchase additional credits at any time. The onboarding package is free regardless of your player count.
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                Can I run multiple competitions?
              </h3>
              <p className="text-slate-700">
                Yes! The free onboarding covers your first competition. After that, you&apos;ll have all the knowledge and resources to run unlimited competitions independently. Continued support is also available if needed.
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                Is there really no catch?
              </h3>
              <p className="text-slate-700">
                No catch. We genuinely want to learn from early venues to build better self-serve resources. You&apos;re helping us improve the product while getting free support that will normally cost £149.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 bg-gradient-to-br from-emerald-600 to-emerald-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-emerald-100 mb-8">
            Limited free onboarding spots available
          </p>
          <a
            href="#apply"
            onClick={(e) => {
              e.preventDefault();
              document.querySelector('form')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="inline-block bg-white text-emerald-700 px-12 py-4 rounded-xl text-lg font-bold hover:bg-emerald-50 transition-colors shadow-lg"
          >
            Apply Now - It&apos;s Free
          </a>
          <p className="text-emerald-100 mt-4">
            Questions? Email us at <a href="mailto:hello@lmslocal.com" className="underline font-semibold">hello@lmslocal.com</a>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-6 lg:space-y-0">
            <div className="flex items-center">
              <TrophyIcon className="h-6 w-6 text-slate-400 mr-2" />
              <span className="text-xl font-bold">LMSLocal</span>
            </div>

            <div className="flex flex-col lg:flex-row items-start lg:items-center space-y-4 lg:space-y-0 lg:space-x-8">
              <div className="flex space-x-6">
                <Link href="/terms" className="text-sm text-slate-400 hover:text-white transition-colors">
                  Terms of Service
                </Link>
                <Link href="/privacy" className="text-sm text-slate-400 hover:text-white transition-colors">
                  Privacy Policy
                </Link>
                <Link href="/help" className="text-sm text-slate-400 hover:text-white transition-colors">
                  Help Center
                </Link>
              </div>

              <div className="text-sm text-slate-400 space-y-1">
                <p>&copy; 2025 LMSLocal. All rights reserved.</p>
                <p>Operated by Noodev8 Ltd • Company Number: 16222537</p>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
