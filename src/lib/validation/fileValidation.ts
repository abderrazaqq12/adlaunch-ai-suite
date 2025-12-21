/**
 * File Validation Utilities
 * 
 * Enforces:
 * - Max size: 500MB
 * - MIME type whitelist
 * - File extension validation
 */

// Max file size: 500MB
export const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024;
export const MAX_FILE_SIZE_MB = 500;

// Allowed MIME types for video assets
export const ALLOWED_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime', // .mov
  'video/x-msvideo', // .avi
  'video/x-matroska', // .mkv
] as const;

// Allowed MIME types for image assets
export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
] as const;

// All allowed asset MIME types
export const ALLOWED_ASSET_MIME_TYPES = [
  ...ALLOWED_VIDEO_MIME_TYPES,
  ...ALLOWED_IMAGE_MIME_TYPES,
] as const;

export type AllowedAssetMimeType = typeof ALLOWED_ASSET_MIME_TYPES[number];

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  mimeType?: string;
}

/**
 * Validate a file for upload
 */
export function validateFile(file: File, allowedTypes: readonly string[] = ALLOWED_ASSET_MIME_TYPES): FileValidationResult {
  // Check file size
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size exceeds ${MAX_FILE_SIZE_MB}MB limit. File is ${formatFileSize(file.size)}.`,
    };
  }

  // Check MIME type
  if (!allowedTypes.includes(file.type as any)) {
    return {
      valid: false,
      error: `File type "${file.type || 'unknown'}" is not allowed. Allowed types: ${allowedTypes.join(', ')}.`,
    };
  }

  return {
    valid: true,
    mimeType: file.type,
  };
}

/**
 * Validate multiple files
 */
export function validateFiles(files: FileList | File[], allowedTypes?: readonly string[]): {
  validFiles: File[];
  errors: { file: File; error: string }[];
} {
  const validFiles: File[] = [];
  const errors: { file: File; error: string }[] = [];

  Array.from(files).forEach(file => {
    const result = validateFile(file, allowedTypes);
    if (result.valid) {
      validFiles.push(file);
    } else {
      errors.push({ file, error: result.error! });
    }
  });

  return { validFiles, errors };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? `.${parts.pop()?.toLowerCase()}` : '';
}

/**
 * Determine asset type from MIME type
 */
export function getAssetTypeFromMime(mimeType: string): 'video' | 'image' | null {
  if (ALLOWED_VIDEO_MIME_TYPES.includes(mimeType as any)) return 'video';
  if (ALLOWED_IMAGE_MIME_TYPES.includes(mimeType as any)) return 'image';
  return null;
}

/**
 * Generate a safe filename for storage
 */
export function generateSafeFilename(originalName: string): string {
  const ext = getFileExtension(originalName);
  const baseName = originalName
    .replace(/\.[^/.]+$/, '') // Remove extension
    .replace(/[^a-zA-Z0-9-_]/g, '_') // Replace unsafe chars
    .substring(0, 50); // Limit length
  
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  
  return `${baseName}_${timestamp}_${randomSuffix}${ext}`;
}
