'use client';

import { useEffect } from 'react';

export default function GlobalErrorHandler() {
  useEffect(() => {
    // Handle unhandled promise rejections (like chunk loading errors)
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason;

      // Check if this is a chunk loading error
      const isChunkLoadError = (
        error?.name === 'ChunkLoadError' ||
        error?.message?.includes('Loading chunk') ||
        error?.message?.includes('timeout') ||
        error?.message?.includes('_next/static/chunks')
      );

      if (isChunkLoadError) {
        console.log('Detected chunk loading error - refreshing page');
        // Prevent the error from showing in console as "Uncaught"
        event.preventDefault();

        // Show a brief message before reload
        const shouldReload = confirm(
          'The application has been updated. The page will refresh to load the latest version.'
        );

        if (shouldReload) {
          window.location.reload();
        }
      }
    };

    // Handle regular JavaScript errors
    const handleError = (event: ErrorEvent) => {
      const error = event.error;

      const isChunkLoadError = (
        error?.name === 'ChunkLoadError' ||
        error?.message?.includes('Loading chunk') ||
        error?.message?.includes('timeout') ||
        error?.message?.includes('_next/static/chunks')
      );

      if (isChunkLoadError) {
        console.log('Detected chunk loading error - refreshing page');
        // Prevent the default error handling
        event.preventDefault();

        // Reload the page after a short delay
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    };

    // Add event listeners
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    // Cleanup event listeners
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  // This component doesn't render anything
  return null;
}