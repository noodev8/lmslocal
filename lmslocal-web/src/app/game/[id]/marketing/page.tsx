'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MegaphoneIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import { marketingApi, MarketingPost, cacheUtils } from '@/lib/api';

export default function MarketingPage() {
  const router = useRouter();
  const params = useParams();
  const competitionId = params.id as string;

  const [posts, setPosts] = useState<MarketingPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePostCount, setActivePostCount] = useState(0);
  const [maxPostsAllowed, setMaxPostsAllowed] = useState(4);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPost, setEditingPost] = useState<MarketingPost | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    image_url: '',
    is_active: true,
    display_priority: 1
  });

  // Load marketing posts
  const loadPosts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await marketingApi.getMarketingPosts(parseInt(competitionId));

      if (response.data.return_code === 'SUCCESS') {
        setPosts(response.data.posts || []);
        setActivePostCount(response.data.active_post_count || 0);
        setMaxPostsAllowed(response.data.max_posts_allowed || 4);
      } else {
        setError(response.data.message || 'Failed to load marketing posts');
      }
    } catch (err) {
      console.error('Failed to load posts:', err);
      setError('Failed to load marketing posts');
    } finally {
      setLoading(false);
    }
  }, [competitionId]);

  useEffect(() => {
    // Simple auth check
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      router.push('/login');
      return;
    }

    loadPosts();
  }, [competitionId, router, loadPosts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setError(null);

      if (editingPost) {
        // Update existing post
        const response = await marketingApi.updateMarketingPost({
          post_id: editingPost.id,
          title: formData.title,
          description: formData.description || undefined,
          is_active: formData.is_active,
          display_priority: formData.display_priority
        });

        if (response.data.return_code === 'SUCCESS') {
          resetForm();
          loadPosts(); // Reload to show updated data
          // Clear cache to ensure display updates
          cacheUtils.invalidateKey(`marketing-display-${competitionId}`);
        } else {
          setError(response.data.message || 'Failed to update post');
        }
      } else {
        // Create new post
        const response = await marketingApi.createMarketingPost({
          competition_id: parseInt(competitionId),
          title: formData.title,
          description: formData.description || undefined,
          is_active: formData.is_active,
          display_priority: formData.display_priority
        });

        if (response.data.return_code === 'SUCCESS') {
          resetForm();
          loadPosts(); // Reload to show new post
          // Clear cache to ensure display updates
          cacheUtils.invalidateKey(`marketing-display-${competitionId}`);
        } else {
          setError(response.data.message || 'Failed to create post');
        }
      }
    } catch (err) {
      console.error('Failed to submit form:', err);
      setError('Failed to save post');
    }
  };

  const handleEdit = (post: MarketingPost) => {
    // Always set editing post and show form (even if another edit is in progress)
    setEditingPost(post);
    setFormData({
      title: post.title,
      description: post.description || '',
      image_url: '', // Keep for consistency but don't populate from existing data
      is_active: post.is_active ?? true,
      display_priority: post.display_priority
    });
    setShowAddForm(true);
    setError(null); // Clear any existing errors
  };

  const handleDelete = async (postId: number) => {
    if (!confirm('Are you sure you want to delete this marketing post?')) {
      return;
    }

    try {
      setError(null);

      const response = await marketingApi.deleteMarketingPost(postId);

      if (response.data.return_code === 'SUCCESS') {
        loadPosts(); // Reload to show updated list
        // Clear cache to ensure display updates
        cacheUtils.invalidateKey(`marketing-display-${competitionId}`);
      } else {
        setError(response.data.message || 'Failed to delete post');
      }
    } catch (err) {
      console.error('Failed to delete post:', err);
      setError('Failed to delete post');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      image_url: '',
      is_active: true,
      display_priority: 1
    });
    setEditingPost(null);
    setShowAddForm(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-100">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center space-x-4">
              <Link
                href={`/game/${competitionId}`}
                className="flex items-center space-x-2 text-gray-500 hover:text-gray-700"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                <span className="text-sm font-medium">Dashboard</span>
              </Link>
              <div className="h-4 w-px bg-gray-200" />
              <h1 className="text-lg font-semibold text-gray-900">Marketing</h1>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-6">
          <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-8">
            <div className="flex items-center justify-center">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-50 rounded-full mb-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-600 border-t-transparent"></div>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Loading Marketing Posts</h3>
                <p className="text-gray-500">Please wait while we fetch your marketing content...</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                href={`/game/${competitionId}`}
                className="flex items-center space-x-2 text-gray-500 hover:text-gray-700"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                <span className="text-sm font-medium">Dashboard</span>
              </Link>
              <div className="h-4 w-px bg-gray-200" />
              <h1 className="text-lg font-semibold text-gray-900">Marketing Posts</h1>
            </div>

            <div className="text-sm text-gray-500">
              {activePostCount} of {maxPostsAllowed} active posts
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <div className="text-red-800">
                <p className="text-sm font-medium">Error loading marketing posts</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Add New Post Button */}
        {!showAddForm && activePostCount < maxPostsAllowed && (
          <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Add Marketing Post</h3>
                <p className="text-sm text-gray-500">Create a new post to display to players in this competition</p>
              </div>
              <button
                onClick={() => {
                  setEditingPost(null); // Clear any existing edit
                  setShowAddForm(true);
                }}
                className="inline-flex items-center px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Add Post
              </button>
            </div>
          </div>
        )}

        {/* Show edit prompt when editing */}
        {showAddForm && editingPost && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <div className="text-blue-800 text-sm">
                <p className="font-medium">Editing: &ldquo;{editingPost.title}&rdquo;</p>
                <p>Make your changes below and click &ldquo;Update Post&rdquo; to save.</p>
              </div>
            </div>
          </div>
        )}

        {/* Add/Edit Form */}
        {showAddForm && (
          <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {editingPost ? 'Edit Marketing Post' : 'Add New Marketing Post'}
              </h3>
              <button
                onClick={resetForm}
                className="text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter post title (max 50 characters)"
                  maxLength={50}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                />
                <div className="text-xs text-gray-500 mt-1">{formData.title.length}/50 characters</div>
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter post description (max 200 characters)"
                  maxLength={200}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                />
                <div className="text-xs text-gray-500 mt-1">{formData.description.length}/200 characters</div>
              </div>


              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="display_priority" className="block text-sm font-medium text-gray-700 mb-1">
                    Display Priority
                  </label>
                  <select
                    id="display_priority"
                    value={formData.display_priority}
                    onChange={(e) => setFormData(prev => ({ ...prev, display_priority: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                  >
                    <option value={1}>1 (Highest)</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                    <option value={4}>4 (Lowest)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <div className="flex items-center space-x-4 pt-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={formData.is_active}
                        onChange={() => setFormData(prev => ({ ...prev, is_active: true }))}
                        className="mr-2"
                      />
                      Active
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={!formData.is_active}
                        onChange={() => setFormData(prev => ({ ...prev, is_active: false }))}
                        className="mr-2"
                      />
                      Inactive
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors"
                >
                  {editingPost ? 'Update Post' : 'Create Post'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Posts List */}
        {posts.length > 0 ? (
          <div className="space-y-4">
            {posts.map((post) => (
              <div key={post.id} className={`rounded-lg border shadow-sm p-6 ${
                editingPost?.id === post.id
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-white border-gray-100'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="text-lg font-medium text-gray-900">{post.title}</h3>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        post.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {post.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Priority {post.display_priority}
                      </span>
                    </div>

                    {post.description && (
                      <p className="text-gray-600 mb-3">{post.description}</p>
                    )}


                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <div className="flex items-center">
                        <EyeIcon className="h-4 w-4 mr-1" />
                        {post.view_count} views
                      </div>
                      <div>
                        Created: {post.created_at ? new Date(post.created_at).toLocaleDateString() : 'Unknown'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => handleEdit(post)}
                      className="inline-flex items-center px-3 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
                    >
                      <PencilIcon className="h-4 w-4 mr-1" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(post.id)}
                      className="inline-flex items-center px-3 py-1 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                    >
                      <TrashIcon className="h-4 w-4 mr-1" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-8">
            <div className="text-center">
              <MegaphoneIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Marketing Posts Yet</h3>
              <p className="text-gray-500 mb-4">Create your first marketing post to start engaging with players.</p>
              <button
                onClick={() => setShowAddForm(true)}
                className="inline-flex items-center px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Create Your First Post
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}