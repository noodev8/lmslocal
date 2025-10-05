'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { userApi, cacheUtils, UserSubscription, PlanLimits, BillingHistoryItem } from '@/lib/api';

function BillingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [planLimits, setPlanLimits] = useState<PlanLimits | null>(null);
  const [billingHistory, setBillingHistory] = useState<BillingHistoryItem[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<'free' | 'club' | 'venue'>('free');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);

  useEffect(() => {
    // Check if user returned from successful payment
    const sessionId = searchParams.get('session_id');
    const success = searchParams.get('success');

    if (sessionId && success === 'true') {
      // Payment was successful - invalidate cache to show fresh data
      cacheUtils.invalidateBilling();

      // Show success banner
      setShowSuccessBanner(true);

      // Clean up URL parameters
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);

      // Hide success banner after 5 seconds
      setTimeout(() => setShowSuccessBanner(false), 5000);
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
  }, [searchParams]);

  const planPrices = {
    free: 0,
    club: 79,
    venue: 179
  };

  // Helper function to get upgrade text (downgrades are disabled)
  const getPlanChangeText = (currentPlan: string, selectedPlan: string) => {
    const planName = selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1);
    return `Upgrade to ${planName}`;
  };

  const handlePlanChange = (plan: 'free' | 'club' | 'venue') => {
    setSelectedPlan(plan);
  };

  const handlePlanSwitch = async () => {
    if (selectedPlan === subscription?.plan) {
      alert('You are already on this plan');
      return;
    }

    if (selectedPlan === 'free') {
      alert('You are already on a higher plan.');
      return;
    }

    try {
      setLoading(true);

      const billingCycle = 'yearly';
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
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Error Loading Plan</h2>
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
          <p className="text-slate-600">No plan data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success Banner */}
        {showSuccessBanner && (
          <div className="mb-6 bg-green-50 border-2 border-green-500 rounded-lg p-4 flex items-center justify-between animate-fade-in">
            <div className="flex items-center">
              <span className="text-2xl mr-3">✓</span>
              <div>
                <h3 className="font-semibold text-green-900">Payment Successful!</h3>
                <p className="text-sm text-green-700">Your plan has been upgraded. Welcome aboard!</p>
              </div>
            </div>
            <button
              onClick={() => setShowSuccessBanner(false)}
              className="text-green-600 hover:text-green-800 text-xl font-bold"
            >
              ×
            </button>
          </div>
        )}

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
          <h1 className="text-3xl font-bold text-slate-900">Billing & Plans</h1>
          <p className="text-slate-600 mt-2 text-sm">
            12 months access • One-time payments • No auto-renewal
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Current Plan */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Current Plan</h2>

            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center">
                  <span className="text-2xl mr-2">
                    {subscription.plan === 'free' && '🎯'}
                    {subscription.plan === 'club' && '🏆'}
                    {subscription.plan === 'venue' && '🍺'}
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
                  £{subscription.plan === 'free' ? '0' :
                     subscription.plan === 'club' ? '79' : '179'}
                </div>
                <div className="text-sm text-slate-500">per year</div>
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


            {/* Plan Options */}
            <div className="space-y-3 mb-6">
              {(['free', 'club', 'venue'] as const).map((plan) => {
                const planOrder = { free: 0, club: 1, venue: 2 };
                const currentLevel = planOrder[subscription.plan as keyof typeof planOrder] ?? 0;
                const planLevel = planOrder[plan] ?? 0;
                const isLowerTier = planLevel < currentLevel;

                return (
                  <label key={plan} className="block">
                    <input
                      type="radio"
                      name="plan"
                      value={plan}
                      checked={selectedPlan === plan}
                      onChange={() => handlePlanChange(plan)}
                      disabled={isLowerTier}
                      className="sr-only"
                    />
                    <div className={`border-2 rounded-lg p-4 transition-colors ${
                      isLowerTier
                        ? 'border-slate-100 bg-slate-50 cursor-not-allowed opacity-60'
                        : selectedPlan === plan
                          ? 'border-slate-900 bg-slate-50 cursor-pointer'
                          : 'border-slate-200 hover:border-slate-300 cursor-pointer'
                    }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center">
                          <span className="text-lg mr-2">
                            {plan === 'free' && '🎯'}
                            {plan === 'club' && '🏆'}
                            {plan === 'venue' && '🍺'}
                          </span>
                          <span className="font-medium capitalize">{plan}</span>
                        </div>
                        <div className="text-sm text-slate-600">
                          Up to {planLimits[plan]} players
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">
                          £{planPrices[plan]}
                        </div>
                        <div className="text-sm text-slate-500">
                          per year
                        </div>
                      </div>
                    </div>
                  </div>
                </label>
                );
              })}
            </div>

            {/* Contact for higher limits */}
            <div className="text-center mb-6">
              <p className="text-sm text-slate-500">
                Need more than 200 players? <a href="mailto:hello@lmslocal.co.uk" className="text-slate-700 font-medium hover:text-slate-900 transition-colors">Contact us</a> for custom pricing.
              </p>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={handlePlanSwitch}
                disabled={selectedPlan === subscription.plan}
                className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
                  selectedPlan === subscription.plan
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                {selectedPlan === subscription.plan
                  ? 'Current Plan'
                  : getPlanChangeText(subscription.plan, selectedPlan)
                }
              </button>

            </div>
          </div>
        </div>

        {/* Billing History */}
        <div className="mt-8 bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Billing History</h2>

          {billingHistory.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p>No billing history available</p>
              <p className="text-sm mt-1">Plan payments will appear here</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-medium text-slate-700">Date</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-700">Plan</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-700">Amount</th>
                    <th className="text-center py-3 px-4 font-medium text-slate-700">Status</th>
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
                            {payment.plan_name === 'club' && '🏆'}
                            {payment.plan_name === 'venue' && '🍺'}
                            {payment.plan_name === 'free' && '🎯'}
                          </span>
                          <span className="font-medium text-slate-900 capitalize">
                            {payment.plan_name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-900">
                        £{payment.paid_amount.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center">
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

export default function BillingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading billing information...</p>
        </div>
      </div>
    }>
      <BillingPageContent />
    </Suspense>
  );
}