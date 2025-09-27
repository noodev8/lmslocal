'use client';

import { useState, useRef } from 'react';
import { CloudArrowUpIcon, XMarkIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';

interface CloudinaryUploadProps {
  value?: string;
  onChange: (url: string) => void;
  onRemove?: () => void;
  uploadPreset?: string;
  cloudName?: string;
  folder?: string;
  className?: string;
  maxFileSize?: number; // in MB
  acceptedFileTypes?: string[];
}

export default function CloudinaryUpload({
  value,
  onChange,
  onRemove,
  uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'lms_logos',
  cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '',
  folder = 'competition-logos',
  className = '',
  maxFileSize = 5, // 5MB default
  acceptedFileTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
}: CloudinaryUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper function to resize image client-side
  const resizeImage = (file: File, maxWidth = 200, maxHeight = 200): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new window.Image();

      img.onload = () => {
        // Calculate dimensions maintaining aspect ratio
        let { width, height } = img;

        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to resize image'));
            }
          },
          'image/jpeg',
          0.85 // Good quality compression
        );
      };

      img.onerror = () => reject(new Error('Failed to load image for resizing'));
      img.src = URL.createObjectURL(file);
    });
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);

    try {
      // Check if Cloudinary is configured
      if (!cloudName || !uploadPreset) {
        throw new Error('Cloudinary is not properly configured. Please contact support.');
      }
      // Validate file type
      if (!acceptedFileTypes.includes(file.type)) {
        throw new Error('Please select a valid image file (JPEG, PNG, GIF, or WebP)');
      }

      // Validate file size
      if (file.size > maxFileSize * 1024 * 1024) {
        throw new Error(`File size must be less than ${maxFileSize}MB`);
      }

      // Resize image client-side to 200x200 for logos
      const resizedBlob = await resizeImage(file, 200, 200);

      // Create form data for Cloudinary upload
      const formData = new FormData();
      formData.append('file', resizedBlob, 'logo.jpg');
      formData.append('upload_preset', uploadPreset);
      formData.append('folder', folder);

      // Upload to Cloudinary
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error('Upload failed. Please try again.');
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message || 'Upload failed');
      }

      // Return the secure URL with auto-optimization transformations
      const optimizedUrl = data.secure_url.replace('/upload/', '/upload/f_auto,q_auto/');
      onChange(optimizedUrl);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    if (value) {
      // Clean up object URL if it's a local preview
      if (value.startsWith('blob:')) {
        URL.revokeObjectURL(value);
      }
    }
    if (onRemove) {
      onRemove();
    } else {
      onChange('');
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Upload Area */}
      {!value && (
        <div className="relative">
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedFileTypes.join(',')}
            onChange={handleFileSelect}
            disabled={uploading}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          />
          <div className={`
            border-2 border-dashed border-gray-300 rounded-lg p-6 text-center
            hover:border-gray-400 transition-colors duration-200
            ${uploading ? 'bg-gray-50 cursor-not-allowed' : 'hover:bg-gray-50 cursor-pointer'}
          `}>
            <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
            <div className="mt-2">
              <p className="text-sm font-medium text-gray-900">
                {uploading ? 'Uploading...' : 'Upload logo'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                PNG, JPG, GIF, WebP up to {maxFileSize}MB
              </p>
            </div>
            {uploading && (
              <div className="mt-3">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Preview */}
      {value && (
        <div className="relative inline-block">
          <Image
            src={value}
            alt="Upload preview"
            width={100}
            height={100}
            className="h-24 w-24 object-cover rounded-lg border border-gray-200 shadow-sm"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <p className="text-sm text-red-600 flex items-center">
          <span className="mr-1">⚠️</span>
          {error}
        </p>
      )}

      {/* Help Text */}
      <p className="text-xs text-gray-500">
        Images will be automatically resized to 200x200px and optimized for web
      </p>
    </div>
  );
}