'use client';

import { useState, useEffect } from 'react';
import { marketingApi, MarketingDisplay as MarketingDisplayType, User } from '@/lib/api';
import Image from 'next/image';

interface MarketingDisplayProps {
  competitionId: number;
  className?: string;
  user?: User | null;
}

export default function MarketingDisplay({ competitionId, className = '', user }: MarketingDisplayProps) {
  const [marketingData, setMarketingData] = useState<MarketingDisplayType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMarketingContent = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await marketingApi.getCompetitionDisplay(competitionId);

        if (response.data.return_code === 'SUCCESS') {
          setMarketingData({
            has_marketing_content: response.data.has_marketing_content,
            venue_name: response.data.venue_name,
            logo_url: response.data.logo_url,
            posts: response.data.posts || []
          });
        } else {
          // If no marketing content or other non-error status, just set empty data
          setMarketingData({
            has_marketing_content: false,
            posts: []
          });
        }
      } catch (err) {
        console.error('Failed to fetch marketing content:', err);
        setError('Failed to load marketing content');
        setMarketingData({
          has_marketing_content: false,
          posts: []
        });
      } finally {
        setLoading(false);
      }
    };

    fetchMarketingContent();
  }, [competitionId]);

  // Don't render anything while loading or if no marketing content
  if (loading || !marketingData?.has_marketing_content || marketingData.posts.length === 0) {
    return null;
  }

  // Don't render if there's an error (fail silently for marketing content)
  if (error) {
    return null;
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-100 shadow-sm ${className}`}>
      <div className="p-4 border-b border-gray-50">
        <div className="flex items-center space-x-3">
          {marketingData.logo_url && (
            <div className="flex-shrink-0">
              <Image
                src={marketingData.logo_url}
                alt="Competition logo"
                width={32}
                height={32}
                className="w-8 h-8 rounded-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          )}
          <h3 className="text-sm font-medium text-gray-900">
            {marketingData.venue_name
              ? marketingData.venue_name
              : user?.display_name
              ? user.display_name
              : 'Updates'
            }
          </h3>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {marketingData.posts.map((post) => (
          <div key={post.id} className="space-y-2">
            {/* Post Title */}
            <h4 className="text-sm font-semibold text-gray-900">
              {post.title}
            </h4>

            {/* Post Description */}
            {post.description && (
              <p className="text-sm text-gray-600 leading-relaxed">
                {post.description}
              </p>
            )}


            {/* Post metadata */}
            <div className="mt-3 pt-2 border-t border-gray-100">
              <div className="text-xs text-gray-500">
                {(() => {
                  const dateToShow = post.updated_at || post.created_at;
                  if (!dateToShow) return 'Recently added';

                  const date = new Date(dateToShow);
                  if (isNaN(date.getTime())) return 'Recently added';

                  return `Updated: ${date.toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })} at ${date.toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}`;
                })()}
              </div>
            </div>

            {/* Separator between posts (except for last post) */}
            {marketingData.posts.length > 1 && post.id !== marketingData.posts[marketingData.posts.length - 1].id && (
              <div className="border-t border-gray-100 pt-4 mt-4"></div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}