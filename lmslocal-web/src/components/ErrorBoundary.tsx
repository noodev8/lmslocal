'use client';

import React from 'react';
import { ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Check if this is a chunk loading error (common during development)
    const isChunkLoadError = error.name === 'ChunkLoadError' ||
                           error.message.includes('Loading chunk') ||
                           error.message.includes('timeout');

    if (isChunkLoadError) {
      console.log('Detected chunk loading error - likely due to code changes during development');
    }
  }

  handleReload = () => {
    // Clear any cached data and reload the page
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      const isChunkLoadError = this.state.error?.name === 'ChunkLoadError' ||
                              this.state.error?.message?.includes('Loading chunk') ||
                              this.state.error?.message?.includes('timeout');

      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <ExclamationTriangleIcon className="h-8 w-8 text-amber-500" />
              </div>
              <div className="ml-3">
                <h2 className="text-lg font-semibold text-slate-900">
                  {isChunkLoadError ? 'Page Refresh Required' : 'Something went wrong'}
                </h2>
              </div>
            </div>

            <div className="mb-6">
              {isChunkLoadError ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600">
                    The application has been updated. Please refresh the page to load the latest version.
                  </p>
                  <p className="text-xs text-slate-500">
                    This typically happens during development when code changes are made.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600">
                    An unexpected error occurred. Please try refreshing the page.
                  </p>
                  {this.state.error?.message && (
                    <details className="text-xs text-slate-500">
                      <summary className="cursor-pointer hover:text-slate-700">
                        Error details
                      </summary>
                      <pre className="mt-2 p-2 bg-slate-100 rounded text-xs overflow-auto">
                        {this.state.error.message}
                      </pre>
                    </details>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={this.handleReload}
              className="w-full inline-flex items-center justify-center px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-900 transition-colors"
            >
              <ArrowPathIcon className="h-4 w-4 mr-2" />
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;