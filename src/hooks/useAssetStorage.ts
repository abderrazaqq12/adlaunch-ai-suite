import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  validateFile,
  validateFiles,
  formatFileSize,
  generateSafeFilename,
  getAssetTypeFromMime,
  ALLOWED_VIDEO_MIME_TYPES,
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_FILE_SIZE_MB,
} from '@/lib/validation/fileValidation';

const BUCKET_NAME = 'assets';

interface UploadResult {
  success: boolean;
  url?: string;
  path?: string;
  error?: string;
  assetType?: 'video' | 'image';
}

interface UseAssetStorageOptions {
  projectId?: string;
}

/**
 * Hook for managing asset uploads to Supabase Storage
 * 
 * Features:
 * - File validation (size, MIME type)
 * - Automatic URL management
 * - Object URL cleanup on unmount
 */
export function useAssetStorage(options: UseAssetStorageOptions = {}) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Track object URLs for cleanup
  const objectUrlsRef = useRef<Set<string>>(new Set());

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach(url => {
        URL.revokeObjectURL(url);
      });
      objectUrlsRef.current.clear();
    };
  }, []);

  /**
   * Revoke a specific object URL
   */
  const revokeObjectUrl = useCallback((url: string) => {
    if (url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
      objectUrlsRef.current.delete(url);
    }
  }, []);

  /**
   * Create a tracked object URL that will be cleaned up
   */
  const createTrackedObjectUrl = useCallback((file: File): string => {
    const url = URL.createObjectURL(file);
    objectUrlsRef.current.add(url);
    return url;
  }, []);

  /**
   * Get the current user ID
   */
  const getUserId = async (): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  };

  /**
   * Upload a single file to Supabase Storage
   */
  const uploadFile = useCallback(async (
    file: File,
    type: 'video' | 'image'
  ): Promise<UploadResult> => {
    const allowedTypes = type === 'video' ? ALLOWED_VIDEO_MIME_TYPES : ALLOWED_IMAGE_MIME_TYPES;
    
    // Validate file
    const validation = validateFile(file, allowedTypes);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const userId = await getUserId();
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    const safeFilename = generateSafeFilename(file.name);
    const filePath = `${userId}/${options.projectId || 'default'}/${safeFilename}`;

    try {
      setIsUploading(true);
      setUploadProgress(0);

      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        console.error('[useAssetStorage] Upload error:', error);
        return { success: false, error: error.message };
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(data.path);

      setUploadProgress(100);

      return {
        success: true,
        url: publicUrl,
        path: data.path,
        assetType: getAssetTypeFromMime(file.type) || type,
      };
    } catch (err) {
      console.error('[useAssetStorage] Upload failed:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Upload failed',
      };
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [options.projectId]);

  /**
   * Upload multiple files
   */
  const uploadFiles = useCallback(async (
    files: FileList | File[],
    type: 'video' | 'image'
  ): Promise<{
    results: UploadResult[];
    successCount: number;
    failCount: number;
  }> => {
    const allowedTypes = type === 'video' ? ALLOWED_VIDEO_MIME_TYPES : ALLOWED_IMAGE_MIME_TYPES;
    const { validFiles, errors } = validateFiles(Array.from(files), allowedTypes);

    // Report validation errors
    errors.forEach(({ file, error }) => {
      toast({
        title: 'Upload Blocked',
        description: `${file.name}: ${error}`,
        variant: 'destructive',
      });
    });

    const results: UploadResult[] = errors.map(({ error }) => ({
      success: false,
      error,
    }));

    // Upload valid files
    for (const file of validFiles) {
      const result = await uploadFile(file, type);
      results.push(result);
    }

    return {
      results,
      successCount: results.filter(r => r.success).length,
      failCount: results.filter(r => !r.success).length,
    };
  }, [uploadFile, toast]);

  /**
   * Delete a file from storage
   */
  const deleteFile = useCallback(async (path: string): Promise<boolean> => {
    try {
      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([path]);

      if (error) {
        console.error('[useAssetStorage] Delete error:', error);
        return false;
      }

      return true;
    } catch (err) {
      console.error('[useAssetStorage] Delete failed:', err);
      return false;
    }
  }, []);

  /**
   * Get the public URL for a stored file
   */
  const getPublicUrl = useCallback((path: string): string => {
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(path);
    return publicUrl;
  }, []);

  return {
    uploadFile,
    uploadFiles,
    deleteFile,
    getPublicUrl,
    revokeObjectUrl,
    createTrackedObjectUrl,
    isUploading,
    uploadProgress,
    maxFileSizeMB: MAX_FILE_SIZE_MB,
    formatFileSize,
  };
}
