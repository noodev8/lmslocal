'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { userApi, cacheUtils } from '@/lib/api';
import type { UserCredits, CreditBillingHistoryItem } from '@/lib/api';

export default function BillingPage() {
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState<UserCredits | null>(null);
  const [purchases, setPurchases] = useState<CreditBillingHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Credit pack configuration (matches backend config/credit-packs.js)
  const creditPacks = [
    {
      pack_type: 'starter_10',
      name: 'Starter Pack',
      credits: 10,
      price: 10,
      description: 'Extra capacity as you grow',
      badge: null
    },
    {
      pack_type: 'popular_50',
      name: 'Popular Pack',
      credits: 40,
      price: 25,
      description: 'For regular competitions',
      badge: 'SAVE 37%',
      popular: true
    },
    {
      pack_type: 'value_200',
      name: 'Best Value Pack',
      credits: 120,
      price: 40,
      description: 'For venues & busy organizers',
      badge: 'SAVE 67%'
    }
  ];

  // Fetch credit data and billing history on component mount
  useEffect(() => {
    const fetchBillingData = async () => {
      try {
        setLoading(true);

        // Fetch credit balance
        const creditsResponse = await userApi.getUserCredits();
        if (creditsResponse.data.return_code === 'SUCCESS' && creditsResponse.data.credits) {
          setCredits(creditsResponse.data.credits);
        } else if (creditsResponse.data.return_code === 'GUEST_USER_NO_CREDITS') {
          setError('Guest users cannot purchase credits. Please contact your competition organizer.');
          return;
        } else {
          setError('Failed to load credit information');
        }

        // Fetch billing history
        const historyResponse = await userApi.getBillingHistory();
        if (historyResponse.data.return_code === 'SUCCESS' && historyResponse.data.purchases) {
          setPurchases(historyResponse.data.purchases);
        }

      } catch (err) {
        console.error('Error fetching billing data:', err);
        setError('Failed to load billing information');
      } finally {
        setLoading(false);
      }
    };

    fetchBillingData();

    // Check for successful payment (Stripe redirect)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
      // Invalidate cache to show updated credits
      cacheUtils.invalidateCredits();
      // Reload data after payment
      setTimeout(() => {
        window.location.href = '/billing'; // Remove query params and reload
      }, 100);
    }
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const handlePurchase = async (packType: string) => {
    try {
      // Create Stripe checkout session
      const response = await userApi.createCheckoutSession(packType);

      if (response.data.return_code === 'SUCCESS' && response.data.checkout_url) {
        // Redirect to Stripe checkout
        window.location.href = response.data.checkout_url;
      } else {
        alert(response.data.message || 'Failed to create checkout session');
      }
    } catch (err) {
      console.error('Error creating checkout session:', err);
      alert('Failed to start payment process. Please try again.');
    }
  };

  // Calculate available slots (only if credits loaded)
  const freeLimit = credits?.free_player_limit || 20; // Use dynamic limit from backend
  const totalCapacity = credits ? freeLimit + credits.paid_credit : 0; // Free limit + purchased credits
  const slotsUsed = credits?.total_players || 0;
  const slotsAvailable = totalCapacity - slotsUsed;

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading billing information...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !credits) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold text-gray-900">Credits & Billing</h1>
              <Link
                href="/dashboard"
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                ← Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800">{error || 'Failed to load billing information'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Credits & Billing</h1>
              <p className="mt-1 text-sm text-gray-500">
                Manage your credits and view purchase history
              </p>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Slots Balance Card */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow-lg p-8 mb-8">
          <div className="text-white text-center">
            <p className="text-sm font-medium text-blue-100 mb-2">Available Slots</p>
            <p className="text-6xl font-bold mb-3">{slotsAvailable}</p>
            <p className="text-blue-100 mb-4">
              You can add {slotsAvailable} more {slotsAvailable === 1 ? 'player' : 'players'} to your competitions
            </p>
            <div className="text-sm text-blue-200">
              Current slots used: {slotsUsed} ({freeLimit} free • {credits.paid_players_used} purchased)
            </div>
          </div>
        </div>

        {/* Credit Packs */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Buy More Slots</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* FREE Tier Card */}
            <div className="relative bg-white rounded-lg shadow-md overflow-hidden">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Free Tier</h3>
                <p className="text-sm text-gray-500 mb-4">Perfect for small groups</p>

                <div className="mb-6">
                  <div className="flex items-baseline">
                    <span className="text-4xl font-bold text-gray-900">£0</span>
                  </div>
                  <div className="mt-2 text-sm text-gray-600">
                    {freeLimit} slots
                  </div>
                </div>

                <div className="w-full py-3 px-4 rounded-md font-medium bg-gray-100 text-gray-900 text-center">
                  Included
                </div>
              </div>
            </div>

            {/* Paid Packs */}
            {creditPacks.map((pack) => (
              <div
                key={pack.pack_type}
                className="relative bg-white rounded-lg shadow-md overflow-hidden transition-all hover:shadow-lg"
              >
                {pack.badge && (
                  <div className="absolute top-4 right-4 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500 text-white">
                    {pack.badge}
                  </div>
                )}
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{pack.name}</h3>
                  <p className="text-sm text-gray-500 mb-4">{pack.description}</p>

                  <div className="mb-6">
                    <div className="flex items-baseline">
                      <span className="text-4xl font-bold text-gray-900">£{pack.price}</span>
                    </div>
                    <div className="mt-2 text-sm text-gray-600">
                      +{pack.credits} slots
                    </div>
                  </div>

                  <button
                    onClick={() => handlePurchase(pack.pack_type)}
                    className="w-full py-3 px-4 rounded-md font-medium transition-colors bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Buy Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Important Information */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-12">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Important Information</h3>
          <div className="text-sm text-gray-600 space-y-2">
            <p>• Your first <strong>{freeLimit} slots</strong> are completely free across all competitions</p>
            <p>• Each additional slot costs <strong>1 credit</strong> when a player joins</p>
            <p>• If the same person joins multiple competitions, each join uses a slot</p>
            <p>• You&apos;ll get 1 credit back if you remove a player during setup (when using paid credits)</p>
            <p>• No refunds are available once your competition becomes active</p>
            <p>• Unused credits expire after 12 months</p>
          </div>
        </div>

        {/* Purchase History */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Purchase History</h2>
          <div className="bg-white shadow-md rounded-lg overflow-hidden">
            {purchases.length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="mt-4 text-gray-500">No purchases yet</p>
                <p className="text-sm text-gray-400 mt-1">Your credit purchases will appear here</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Pack
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Credits
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount Paid
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Promo Code
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {purchases.map((purchase) => (
                      <tr key={purchase.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(purchase.purchased_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{purchase.pack_name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            +{purchase.credits_purchased} credits
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div>£{purchase.paid_amount.toFixed(2)}</div>
                          {purchase.promo_code && purchase.original_price && (
                            <div className="text-xs text-gray-500">
                              Was £{purchase.original_price.toFixed(2)} (saved £{purchase.discount_amount?.toFixed(2)})
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {purchase.promo_code ? (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
                              {purchase.promo_code}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
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
    </div>
  );
}
