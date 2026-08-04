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
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          />
          <div className={`
            border border-dashed border-ink/40 p-6 text-center transition-colors
            ${uploading ? 'cursor-not-allowed bg-stock' : 'cursor-pointer hover:border-ink'}
          `}>
            <CloudArrowUpIcon className="mx-auto h-9 w-9 text-ink-fade" />
            <p className="mt-2 text-[15px] text-ink">
              {uploading ? 'Uploading…' : 'Upload logo'}
            </p>
            <p className="mt-1 text-[12px] text-ink-fade">
              PNG, JPG, GIF, WebP up to {maxFileSize}MB
            </p>
            {uploading && (
              <div className="mx-auto mt-3 h-[3px] w-full max-w-xs bg-ink/15">
                <div className="h-[3px] w-3/5 bg-ink" />
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
            className="h-24 w-24 border border-ink/30 object-cover"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute -right-2 -top-2 border border-ink bg-stock-lit p-1 text-ink transition-colors hover:border-overprint hover:text-overprint"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <p className="text-[13px] text-overprint">{error}</p>
      )}

      {/* Help Text */}
      <p className="text-[12px] text-ink-fade">
        Images will be automatically resized to 200x200px and optimized for web
      </p>
    </div>
  );
}
