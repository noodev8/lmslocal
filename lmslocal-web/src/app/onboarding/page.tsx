'use client';

import { useState } from 'react';
import { CheckCircleIcon, HeartIcon } from '@heroicons/react/24/outline';
import PublicHeader from '@/components/public/PublicHeader';
import PublicFooter from '@/components/public/PublicFooter';
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
    <div className="min-h-screen bg-stock font-body text-ink">
      <PublicHeader />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-ink py-16">
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <h1 className="mb-6 font-display text-6xl font-semibold uppercase leading-[0.88] text-stock-lit sm:text-7xl">
            Done-For-You Launch Package
          </h1>

          <p className="mb-4 max-w-2xl text-xl leading-relaxed text-stock/85 md:text-2xl">
            Get your Last Man Standing competition up and running with full support
          </p>

          <div className="mb-8 inline-block border border-stock/30 px-8 py-4">
            <p className="font-display text-4xl font-semibold uppercase text-stock-lit">
              <span className="mr-3 text-2xl text-stock/60 line-through">£30</span>
              FREE
            </p>
            <p className="mt-1 font-body text-xs font-semibold uppercase tracking-[0.12em] text-stock/70">Limited availability</p>
          </div>

          <p className="max-w-2xl text-[17px] leading-relaxed text-stock/85">
            We&apos;ll personally set up your competition, guide you through your first full cycle, and ensure you&apos;re confident running it independently.
          </p>
        </div>
      </section>

      {/* What's Included */}
      <section className="border-y border-ink/30 bg-stock-deep py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-12 max-w-2xl">
            <h2 className="mb-4 font-display text-4xl font-semibold uppercase leading-[0.9] text-ink sm:text-5xl">
              What&apos;s Included
            </h2>
            <p className="max-w-2xl text-xl leading-relaxed text-ink">
              Complete hands-on support from setup to your first winner
            </p>
          </div>

          <div className="mb-12 grid gap-8 md:grid-cols-3">
            {/* Setup Phase */}
            <div className="border border-ink/30 bg-stock-lit p-8">
              <div className="w-12 h-12 bg-overprint rounded-none flex items-center justify-center mb-4">
                <span className="font-display text-2xl text-stock-lit">1</span>
              </div>
              <h3 className="mb-3 font-display text-2xl uppercase tracking-[0.03em] text-ink">Complete Setup</h3>
              <p className="mb-4 text-[17px] leading-relaxed text-ink">Week 1</p>
              <ul className="space-y-3 text-[17px] leading-relaxed text-ink">
                <li className="flex items-start">
                  <CheckCircleIcon className="mr-2 mt-0.5 h-5 w-5 flex-shrink-0 text-overprint" />
                  <span>30-minute onboarding call</span>
                </li>
                <li className="flex items-start">
                  <CheckCircleIcon className="mr-2 mt-0.5 h-5 w-5 flex-shrink-0 text-overprint" />
                  <span>Competition configuration (rules, format, fixtures)</span>
                </li>
                <li className="flex items-start">
                  <CheckCircleIcon className="mr-2 mt-0.5 h-5 w-5 flex-shrink-0 text-overprint" />
                  <span>Custom promotional materials (coming soon)</span>
                </li>
                <li className="flex items-start">
                  <CheckCircleIcon className="mr-2 mt-0.5 h-5 w-5 flex-shrink-0 text-overprint" />
                  <span>Player invitation system ready to go</span>
                </li>
              </ul>
            </div>

            {/* Support Phase */}
            <div className="border border-ink/30 bg-stock-lit p-8">
              <div className="mb-4 flex h-12 w-12 items-center justify-center bg-overprint">
                <span className="font-display text-2xl text-stock-lit">2</span>
              </div>
              <h3 className="mb-3 font-display text-2xl uppercase tracking-[0.03em] text-ink">Full Competition Support</h3>
              <p className="mb-4 text-[17px] leading-relaxed text-ink">4-8 Weeks</p>
              <ul className="space-y-3 text-[17px] leading-relaxed text-ink">
                <li className="flex items-start">
                  <CheckCircleIcon className="mr-2 mt-0.5 h-5 w-5 flex-shrink-0 text-overprint" />
                  <span>Weekly check-ins throughout first competition</span>
                </li>
                <li className="flex items-start">
                  <CheckCircleIcon className="mr-2 mt-0.5 h-5 w-5 flex-shrink-0 text-overprint" />
                  <span>Direct WhatsApp/email support</span>
                </li>
                <li className="flex items-start">
                  <CheckCircleIcon className="mr-2 mt-0.5 h-5 w-5 flex-shrink-0 text-overprint" />
                  <span>Help with player questions and issues</span>
                </li>
                <li className="flex items-start">
                  <CheckCircleIcon className="mr-2 mt-0.5 h-5 w-5 flex-shrink-0 text-overprint" />
                  <span>Guidance on round progression</span>
                </li>
              </ul>
            </div>

            {/* Handover Phase */}
            <div className="border border-ink/30 bg-stock-lit p-8">
              <div className="mb-4 flex h-12 w-12 items-center justify-center bg-overprint">
                <span className="font-display text-2xl text-stock-lit">3</span>
              </div>
              <h3 className="mb-3 font-display text-2xl uppercase tracking-[0.03em] text-ink">Handover & Independence</h3>
              <p className="mb-4 text-[17px] leading-relaxed text-ink">End of Competition</p>
              <ul className="space-y-3 text-[17px] leading-relaxed text-ink">
                <li className="flex items-start">
                  <CheckCircleIcon className="mr-2 mt-0.5 h-5 w-5 flex-shrink-0 text-overprint" />
                  <span>Documentation of your setup</span>
                </li>
                <li className="flex items-start">
                  <CheckCircleIcon className="mr-2 mt-0.5 h-5 w-5 flex-shrink-0 text-overprint" />
                  <span>Access to self-serve tools and resources</span>
                </li>
                <li className="flex items-start">
                  <CheckCircleIcon className="mr-2 mt-0.5 h-5 w-5 flex-shrink-0 text-overprint" />
                  <span>You&apos;re ready to run future competitions independently</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Who This Is For */}
      <section className="py-16 bg-stock-lit">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-12 max-w-2xl">
            <h2 className="mb-4 font-display text-4xl font-semibold uppercase leading-[0.9] text-ink sm:text-5xl">
              Is This For You?
            </h2>
            <p className="text-xl leading-relaxed text-ink">
              This package is perfect if you meet these criteria:
            </p>
          </div>

          <div className="border border-ink/30 bg-stock-lit p-6 sm:p-8">
            <ul className="space-y-4">
              <li className="flex items-start">
                <CheckCircleIcon className="mr-3 mt-0.5 h-6 w-6 flex-shrink-0 text-overprint" />
                <div>
                  <p className="mb-1 font-semibold text-ink">Active Venue or Organization</p>
                  <p className="text-ink-fade">You run a pub, club, workplace, or have an active community with regular members/customers</p>
                </div>
              </li>
              <li className="flex items-start">
                <CheckCircleIcon className="mr-3 mt-0.5 h-6 w-6 flex-shrink-0 text-overprint" />
                <div>
                  <p className="mb-1 font-semibold text-ink">Ready Participants</p>
                  <p className="text-ink-fade">You have at least 10-15 potential players ready to join when you launch</p>
                </div>
              </li>
              <li className="flex items-start">
                <CheckCircleIcon className="mr-3 mt-0.5 h-6 w-6 flex-shrink-0 text-overprint" />
                <div>
                  <p className="mb-1 font-semibold text-ink">Commitment to Complete</p>
                  <p className="text-ink-fade">You&apos;re committed to running your first competition through to completion with our support</p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Why We're Doing This */}
      <section className="bg-ink py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="border border-stock/25 p-8">
            <div className="flex items-start space-x-4 mb-6">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-overprint rounded-none flex items-center justify-center">
                  <HeartIcon className="h-6 w-6 text-stock-lit" />
                </div>
              </div>
              <div>
                <h3 className="mb-2 font-display text-2xl uppercase tracking-[0.03em] text-stock-lit">Why Are We Doing This?</h3>
                <p className="text-stock/85 mb-4">
                  We&apos;re using our early launch phase to refine our onboarding process, build better resources, and truly understand what venues need to succeed.
                </p>
                <p className="text-stock/85 mb-4">
                  Your feedback during this process will help us build a better product for everyone. In exchange, you get complete hands-on support that would normally cost £30.
                </p>
                <p className="text-stock/85">
                  <strong>After the free onboarding period</strong>, we&apos;ll transition to:
                </p>
                <ul className="mt-3 space-y-2 text-stock/85">
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span><strong>Free Self-Serve</strong>: Documentation and videos for DIY setup</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span><strong>£30 Launch Package</strong>: Same hands-on onboarding for those who want it</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Application Form */}
      <section className="py-16 bg-stock-lit">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-12 max-w-2xl">
            <h2 className="mb-4 font-display text-4xl font-semibold uppercase leading-[0.9] text-ink sm:text-5xl">
              Apply For Free Onboarding
            </h2>
            <p className="text-xl leading-relaxed text-ink">
              Fill out the form below and we&apos;ll be in touch within 24 hours
            </p>
          </div>

          {submitStatus === 'success' ? (
            <div className="border border-ink/30 bg-stock-lit p-8 text-center">
              <div className="mb-6">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-overprint rounded-none mb-4">
                  <CheckCircleIcon className="h-12 w-12 text-stock-lit" />
                </div>
              </div>
              <h3 className="mb-3 font-display text-3xl uppercase tracking-[0.03em] text-ink">Application Submitted Successfully!</h3>
              <div className="bg-stock-lit rounded-none p-6 mb-6 text-left max-w-xl mx-auto">
                <h4 className="mb-3 font-body text-xs font-semibold uppercase tracking-[0.12em] text-ink-fade">What happens next?</h4>
                <ul className="space-y-2 text-ink">
                  <li className="flex items-start">
                    <CheckCircleIcon className="mr-2 mt-0.5 h-5 w-5 flex-shrink-0 text-overprint" />
                    <span>We&apos;ll review your application within 24 hours</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircleIcon className="mr-2 mt-0.5 h-5 w-5 flex-shrink-0 text-overprint" />
                    <span>You&apos;ll receive a confirmation email shortly</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircleIcon className="mr-2 mt-0.5 h-5 w-5 flex-shrink-0 text-overprint" />
                    <span>We&apos;ll contact you to schedule your onboarding call</span>
                  </li>
                </ul>
              </div>
              <p className="text-ink-fade mb-6">
                Check your email inbox for confirmation. If you don&apos;t see it, check your spam folder.
              </p>
              <button
                onClick={() => setSubmitStatus('idle')}
                className="font-semibold text-ink underline decoration-dotted underline-offset-4 hover:text-overprint"
              >
                Submit another application
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="border border-ink/30 bg-stock-lit p-6 sm:p-8">
              <div className="space-y-6">
                {/* Venue Name */}
                <div>
                  <label htmlFor="venueName" className="mb-2 block font-body text-xs font-semibold uppercase tracking-[0.12em] text-ink-fade">
                    Venue/Organization Name
                  </label>
                  <input
                    type="text"
                    id="venueName"
                    name="venueName"
                    value={formData.venueName}
                    onChange={handleChange}
                    className="block w-full rounded-sm border border-ink/40 bg-stock-lit px-3 py-2.5 text-[17px] text-ink placeholder:text-ink-fade/70 focus:border-ink focus:outline-none"
                    placeholder="e.g., The Red Lion Pub"
                  />
                </div>

                {/* Venue Type */}
                <div>
                  <label htmlFor="venueType" className="mb-2 block font-body text-xs font-semibold uppercase tracking-[0.12em] text-ink-fade">
                    Type
                  </label>
                  <select
                    id="venueType"
                    name="venueType"
                    value={formData.venueType}
                    onChange={handleChange}
                    className="block w-full rounded-sm border border-ink/40 bg-stock-lit px-3 py-2.5 text-[17px] text-ink placeholder:text-ink-fade/70 focus:border-ink focus:outline-none"
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
                  <label htmlFor="contactName" className="mb-2 block font-body text-xs font-semibold uppercase tracking-[0.12em] text-ink-fade">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    id="contactName"
                    name="contactName"
                    required
                    value={formData.contactName}
                    onChange={handleChange}
                    className="block w-full rounded-sm border border-ink/40 bg-stock-lit px-3 py-2.5 text-[17px] text-ink placeholder:text-ink-fade/70 focus:border-ink focus:outline-none"
                    placeholder="John Smith"
                  />
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="email" className="mb-2 block font-body text-xs font-semibold uppercase tracking-[0.12em] text-ink-fade">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="block w-full rounded-sm border border-ink/40 bg-stock-lit px-3 py-2.5 text-[17px] text-ink placeholder:text-ink-fade/70 focus:border-ink focus:outline-none"
                    placeholder="john@example.com"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label htmlFor="phone" className="mb-2 block font-body text-xs font-semibold uppercase tracking-[0.12em] text-ink-fade">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="block w-full rounded-sm border border-ink/40 bg-stock-lit px-3 py-2.5 text-[17px] text-ink placeholder:text-ink-fade/70 focus:border-ink focus:outline-none"
                    placeholder="+44 7700 900000"
                  />
                </div>

                {/* Estimated Players */}
                <div>
                  <label htmlFor="estimatedPlayers" className="mb-2 block font-body text-xs font-semibold uppercase tracking-[0.12em] text-ink-fade">
                    Estimated Number of Players
                  </label>
                  <input
                    type="number"
                    id="estimatedPlayers"
                    name="estimatedPlayers"
                    min="10"
                    value={formData.estimatedPlayers}
                    onChange={handleChange}
                    className="block w-full rounded-sm border border-ink/40 bg-stock-lit px-3 py-2.5 text-[17px] text-ink placeholder:text-ink-fade/70 focus:border-ink focus:outline-none"
                    placeholder="e.g., 25"
                  />
                  <p className="text-sm text-ink-fade mt-1">Minimum 10 players if provided</p>
                </div>

                {/* Preferred Start Date */}
                <div>
                  <label htmlFor="preferredStartDate" className="mb-2 block font-body text-xs font-semibold uppercase tracking-[0.12em] text-ink-fade">
                    Preferred Start Date
                  </label>
                  <input
                    type="date"
                    id="preferredStartDate"
                    name="preferredStartDate"
                    value={formData.preferredStartDate}
                    onChange={handleChange}
                    className="block w-full rounded-sm border border-ink/40 bg-stock-lit px-3 py-2.5 text-[17px] text-ink placeholder:text-ink-fade/70 focus:border-ink focus:outline-none"
                  />
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="description" className="mb-2 block font-body text-xs font-semibold uppercase tracking-[0.12em] text-ink-fade">
                    Tell Us About Your Venue/Audience
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    rows={4}
                    value={formData.description}
                    onChange={handleChange}
                    className="block w-full rounded-sm border border-ink/40 bg-stock-lit px-3 py-2.5 text-[17px] text-ink placeholder:text-ink-fade/70 focus:border-ink focus:outline-none"
                    placeholder="Brief description of your venue and what you're looking to achieve..."
                  />
                </div>

                {submitStatus === 'error' && (
                  <div className="bg-red-50 border border-red-300 rounded-none p-4 text-red-700">
                    <p>There was an error submitting your application. Please try again.</p>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-sm bg-overprint px-8 py-4 font-display text-2xl uppercase tracking-[0.06em] text-stock-lit transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-70"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Application'}
                </button>

                <p className="text-sm text-ink-fade text-center">
                  By submitting, you agree to be contacted by our team about your onboarding.
                </p>
              </div>
            </form>
          )}
        </div>
      </section>

      {/* FAQ Section */}
      <section className="border-y border-ink/30 bg-stock-deep py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="mb-8 font-display text-4xl font-semibold uppercase leading-[0.9] text-ink sm:text-5xl">
            Frequently Asked Questions
          </h2>

          <div className="space-y-6">
            <div className="border border-ink/30 bg-stock-lit p-6">
              <h3 className="mb-2 font-display text-xl uppercase tracking-[0.03em] text-ink">
                What happens after I submit the application?
              </h3>
              <p className="text-ink">
                We&apos;ll review your application within 24 hours and reach out to schedule your 30-minute onboarding call. From there, we&apos;ll get your competition set up and support you through to completion.
              </p>
            </div>

            <div className="border border-ink/30 bg-stock-lit p-6">
              <h3 className="mb-2 font-display text-xl uppercase tracking-[0.03em] text-ink">
                How long does support last?
              </h3>
              <p className="text-ink">
                Support continues until your first competition completes (when you have a winner). This typically takes 4-8 weeks depending on your format and round frequency.
              </p>
            </div>

            <div className="border border-ink/30 bg-stock-lit p-6">
              <h3 className="mb-2 font-display text-xl uppercase tracking-[0.03em] text-ink">
                What if I need more than 20 player slots?
              </h3>
              <p className="text-ink">
                The platform includes 20 free player slots. If you need more, you can purchase additional credits at any time. The onboarding package is free regardless of your player count.
              </p>
            </div>

            <div className="border border-ink/30 bg-stock-lit p-6">
              <h3 className="mb-2 font-display text-xl uppercase tracking-[0.03em] text-ink">
                Can I run multiple competitions?
              </h3>
              <p className="text-ink">
                Yes! The free onboarding covers your first competition. After that, you&apos;ll have all the knowledge and resources to run unlimited competitions independently. Continued support is also available if needed.
              </p>
            </div>

            <div className="border border-ink/30 bg-stock-lit p-6">
              <h3 className="mb-2 font-display text-xl uppercase tracking-[0.03em] text-ink">
                Is there really no catch?
              </h3>
              <p className="text-ink">
                No catch. We genuinely want to learn from early venues to build better self-serve resources. You&apos;re helping us improve the product while getting free support that will normally cost £30.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-ink py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="mb-4 font-display text-5xl font-semibold uppercase leading-[0.9] text-stock-lit sm:text-6xl">
            Ready to Get Started?
          </h2>
          <p className="mb-8 max-w-xl text-xl leading-relaxed text-stock/85">
            Limited free onboarding spots available
          </p>
          <a
            href="#apply"
            onClick={(e) => {
              e.preventDefault();
              document.querySelector('form')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="inline-block rounded-sm bg-overprint px-10 py-4 font-display text-2xl uppercase tracking-[0.06em] text-stock-lit transition-opacity hover:opacity-90"
          >
            Apply Now - It&apos;s Free
          </a>
          <p className="mt-4 text-[17px] text-stock/85">
            Questions? Email us at <a href="mailto:lmslocal8@gmail.com" className="font-data underline decoration-dotted underline-offset-4 hover:text-stock">lmslocal8@gmail.com</a>
          </p>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
