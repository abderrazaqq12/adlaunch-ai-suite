/**
 * Text Sanitization Utilities
 * 
 * Provides XSS-safe text handling for ad copy and user input
 */

// Max lengths for different text types
export const TEXT_LIMITS = {
  AD_COPY: 5000,
  ASSET_NAME: 200,
  CAMPAIGN_NAME: 100,
  RULE_NAME: 100,
  PROJECT_NAME: 100,
} as const;

/**
 * HTML entities to escape
 */
const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(str: string): string {
  return str.replace(/[&<>"'`=/]/g, char => HTML_ESCAPE_MAP[char] || char);
}

/**
 * Remove potentially dangerous HTML/script content
 */
export function stripHtml(str: string): string {
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
}

/**
 * Sanitize text input with length limit
 */
export function sanitizeText(
  input: string,
  maxLength: number = TEXT_LIMITS.AD_COPY
): { value: string; truncated: boolean; originalLength: number } {
  // Remove null bytes and control characters (except newlines and tabs)
  let sanitized = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Strip dangerous HTML
  sanitized = stripHtml(sanitized);
  
  // Normalize whitespace (but preserve intentional line breaks)
  sanitized = sanitized
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n');
  
  // Trim
  sanitized = sanitized.trim();
  
  const originalLength = sanitized.length;
  const truncated = originalLength > maxLength;
  
  if (truncated) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  return {
    value: sanitized,
    truncated,
    originalLength,
  };
}

/**
 * Validate and sanitize ad copy
 */
export function sanitizeAdCopy(input: string): {
  value: string;
  isValid: boolean;
  error?: string;
} {
  const { value, truncated, originalLength } = sanitizeText(input, TEXT_LIMITS.AD_COPY);
  
  if (!value) {
    return { value: '', isValid: false, error: 'Ad copy cannot be empty' };
  }
  
  if (truncated) {
    return {
      value,
      isValid: false,
      error: `Ad copy exceeds ${TEXT_LIMITS.AD_COPY} characters (${originalLength} provided)`,
    };
  }
  
  return { value, isValid: true };
}

/**
 * Sanitize asset name
 */
export function sanitizeAssetName(input: string): string {
  const { value } = sanitizeText(input, TEXT_LIMITS.ASSET_NAME);
  return value || 'Untitled Asset';
}

/**
 * Create a safe display string that won't cause XSS when rendered
 */
export function safeDisplayText(text: string): string {
  return escapeHtml(stripHtml(text));
}

/**
 * Validate input length without modifying
 */
export function validateLength(
  input: string,
  maxLength: number,
  fieldName: string = 'Input'
): { valid: boolean; error?: string } {
  if (input.length > maxLength) {
    return {
      valid: false,
      error: `${fieldName} must be ${maxLength} characters or less (currently ${input.length})`,
    };
  }
  return { valid: true };
}
