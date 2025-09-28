'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { userApi, cacheUtils, UserSubscription, PlanLimits, BillingHistoryItem } from '@/lib/api';

export default function BillingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [planLimits, setPlanLimits] = useState<PlanLimits | null>(null);
  const [billingHistory, setBillingHistory] = useState<BillingHistoryItem[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<'lite' | 'starter' | 'pro'>('lite');
  const [isYearly, setIsYearly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if user returned from successful payment
    const sessionId = searchParams.get('session_id');
    const success = searchParams.get('success');

    if (sessionId && success === 'true') {
      // Payment was successful - invalidate cache to show fresh data
      cacheUtils.invalidateBilling();

      // Clean up URL parameters
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }

    const fetchSubscriptionData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch both subscription data and billing history in parallel
        const [subscriptionResponse, billingResponse] = await Promise.all([
          userApi.getUserSubscription(),
          userApi.getBillingHistory()
        ]);

        if (subscriptionResponse.data.return_code === 'SUCCESS') {
          if (subscriptionResponse.data.subscription && subscriptionResponse.data.plan_limits) {
            setSubscription(subscriptionResponse.data.subscription);
            setPlanLimits(subscriptionResponse.data.plan_limits);
            setSelectedPlan(subscriptionResponse.data.subscription.plan);
          } else {
            setError('No subscription data received');
          }
        } else {
          setError(subscriptionResponse.data.message || 'Failed to load subscription data');
        }

        // Handle billing history response
        if (billingResponse.data.return_code === 'SUCCESS' && billingResponse.data.billing_history) {
          setBillingHistory(billingResponse.data.billing_history);
        }
        // Note: We don't show error for billing history failure, just keep empty array

      } catch (err) {
        console.error('Error fetching subscription data:', err);
        setError('Failed to load subscription data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchSubscriptionData();
  }, []);

  const planPrices = {
    lite: { monthly: 0, yearly: 0 },
    starter: { monthly: 29, yearly: 232 },
    pro: { monthly: 79, yearly: 632 }
  };

  const handlePlanChange = (plan: 'lite' | 'starter' | 'pro') => {
    setSelectedPlan(plan);
  };

  const handleUpgrade = async () => {
    if (selectedPlan === subscription?.plan) {
      alert('You&apos;re already on this plan');
      return;
    }

    if (selectedPlan === 'lite') {
      alert('Lite plan is free - no upgrade needed');
      return;
    }

    try {
      setLoading(true);

      const billingCycle = isYearly ? 'yearly' : 'monthly';
      const response = await userApi.createCheckoutSession(selectedPlan, billingCycle);

      if (response.data.return_code === 'SUCCESS' && response.data.checkout_url) {
        // Redirect to Stripe checkout
        window.location.href = response.data.checkout_url;
      } else {
        alert(response.data.message || 'Failed to create checkout session');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Failed to start checkout process. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading billing information...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Error Loading Subscription</h2>
          <p className="text-slate-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!subscription || !planLimits) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600">No subscription data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center text-slate-600 hover:text-slate-900 mr-4 transition-colors"
            >
              <span className="mr-2">←</span>
              Back
            </button>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Billing & Subscription</h1>
          <p className="text-slate-600 mt-2">Manage your subscription and view billing information</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Current Plan */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Current Plan</h2>

            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center">
                  <span className="text-2xl mr-2">
                    {subscription.plan === 'lite' && '🎯'}
                    {subscription.plan === 'starter' && '🚀'}
                    {subscription.plan === 'pro' && '🏢'}
                  </span>
                  <span className="text-lg font-medium capitalize">{subscription.plan} Plan</span>
                </div>
                {subscription.expiry && (
                  <p className="text-sm text-slate-500 mt-1">
                    Expires: {new Date(subscription.expiry).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-slate-900">
                  £{subscription.plan === 'lite' ? '0' :
                     subscription.plan === 'starter' ? '29' : '79'}
                </div>
                <div className="text-sm text-slate-500">per month</div>
              </div>
            </div>

            {/* Player Usage */}
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">Player Usage</span>
                <span className="text-sm text-slate-900 font-semibold">
                  {subscription.player_count} / {subscription.player_limit} players
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${subscription.usage_percentage}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Plan Selection */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Change Plan</h2>

            {/* Billing Toggle */}
            <div className="flex items-center justify-center mb-6">
              <span className={`mr-3 text-sm ${!isYearly ? 'text-slate-900 font-semibold' : 'text-slate-500'}`}>Monthly</span>
              <button
                onClick={() => setIsYearly(!isYearly)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isYearly ? 'bg-slate-900' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isYearly ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className={`ml-3 text-sm ${isYearly ? 'text-slate-900 font-semibold' : 'text-slate-500'}`}>
                Yearly
                <span className="ml-1 text-emerald-600 font-bold text-xs">(Save 33%)</span>
              </span>
            </div>

            {/* Plan Options */}
            <div className="space-y-3 mb-6">
              {(['lite', 'starter', 'pro'] as const).map((plan) => (
                <label key={plan} className="block">
                  <input
                    type="radio"
                    name="plan"
                    value={plan}
                    checked={selectedPlan === plan}
                    onChange={() => handlePlanChange(plan)}
                    className="sr-only"
                  />
                  <div className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedPlan === plan ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center">
                          <span className="text-lg mr-2">
                            {plan === 'lite' && '🎯'}
                            {plan === 'starter' && '🚀'}
                            {plan === 'pro' && '🏢'}
                          </span>
                          <span className="font-medium capitalize">{plan}</span>
                        </div>
                        <div className="text-sm text-slate-600">
                          Up to {planLimits[plan]} players
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">
                          £{isYearly ? planPrices[plan].yearly : planPrices[plan].monthly}
                        </div>
                        <div className="text-sm text-slate-500">
                          {isYearly ? 'per year' : 'per month'}
                        </div>
                      </div>
                    </div>
                  </div>
                </label>
              ))}
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={handleUpgrade}
                disabled={selectedPlan === subscription.plan}
                className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
                  selectedPlan === subscription.plan
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                {selectedPlan === subscription.plan
                  ? 'Current Plan'
                  : `Upgrade to ${selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)}`
                }
              </button>

              <Link
                href="/pricing"
                className="block w-full py-3 px-4 border border-slate-300 rounded-lg font-semibold text-center text-slate-700 hover:bg-slate-50 transition-colors"
              >
                View Detailed Pricing
              </Link>
            </div>
          </div>
        </div>

        {/* Billing History */}
        <div className="mt-8 bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Billing History</h2>

          {billingHistory.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p>No billing history available</p>
              <p className="text-sm mt-1">Subscription payments will appear here</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-medium text-slate-700">Date</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-700">Plan</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-700">Billing Cycle</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-700">Amount</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {billingHistory.map((payment) => (
                    <tr key={payment.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 text-slate-900">
                        {new Date(payment.payment_date).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center">
                          <span className="mr-2">
                            {payment.plan_name === 'starter' && '🚀'}
                            {payment.plan_name === 'pro' && '🏢'}
                            {payment.plan_name === 'lite' && '🎯'}
                          </span>
                          <span className="font-medium text-slate-900 capitalize">
                            {payment.plan_name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 capitalize">
                        {payment.billing_cycle}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-900">
                        £{payment.paid_amount.toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                          ✓ Paid
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}