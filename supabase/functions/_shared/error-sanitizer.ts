/**
 * ERROR SANITIZER
 * 
 * Prevents leaking internal details to clients.
 * Converts raw errors to safe, user-friendly messages.
 */

// Error codes that map to safe messages
export const ERROR_CODES = {
  // Auth errors
  AUTH_INVALID_TOKEN: 'AUTH_INVALID_TOKEN',
  AUTH_EXPIRED_TOKEN: 'AUTH_EXPIRED_TOKEN',
  AUTH_MISSING_TOKEN: 'AUTH_MISSING_TOKEN',
  AUTH_UNAUTHORIZED: 'AUTH_UNAUTHORIZED',
  
  // Rate limit errors
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  DAILY_LIMIT_EXCEEDED: 'DAILY_LIMIT_EXCEEDED',
  COOLDOWN_ACTIVE: 'COOLDOWN_ACTIVE',
  GLOBAL_LIMIT_EXCEEDED: 'GLOBAL_LIMIT_EXCEEDED',
  
  // Automation errors
  AUTOMATION_BLOCKED: 'AUTOMATION_BLOCKED',
  AUTOMATION_LOCK_FAILED: 'AUTOMATION_LOCK_FAILED',
  AUTOMATION_DISABLED: 'AUTOMATION_DISABLED',
  
  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN',
  CONFLICT: 'CONFLICT',
  
  // Generic errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

// Safe messages for each error code (no internal details)
const SAFE_MESSAGES: Record<ErrorCode, string> = {
  AUTH_INVALID_TOKEN: 'Invalid authentication token',
  AUTH_EXPIRED_TOKEN: 'Authentication token has expired',
  AUTH_MISSING_TOKEN: 'Authentication required',
  AUTH_UNAUTHORIZED: 'You are not authorized to perform this action',
  
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded. Please try again later.',
  DAILY_LIMIT_EXCEEDED: 'Daily action limit reached. Resets at midnight.',
  COOLDOWN_ACTIVE: 'Action is in cooldown. Please wait before retrying.',
  GLOBAL_LIMIT_EXCEEDED: 'Global action limit reached for today.',
  
  AUTOMATION_BLOCKED: 'Automation action was blocked by safety rules.',
  AUTOMATION_LOCK_FAILED: 'Another automation process is running. Please wait.',
  AUTOMATION_DISABLED: 'Automation is currently disabled.',
  
  NOT_FOUND: 'Resource not found.',
  FORBIDDEN: 'Access denied.',
  CONFLICT: 'Resource conflict. Please refresh and try again.',
  
  INTERNAL_ERROR: 'An unexpected error occurred. Please try again.',
  VALIDATION_ERROR: 'Invalid input provided.',
  BAD_REQUEST: 'Invalid request.',
};

// Patterns to detect sensitive information
const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /api.?key/i,
  /auth/i,
  /bearer/i,
  /jwt/i,
  /supabase/i,
  /postgres/i,
  /database/i,
  /connection/i,
  /\.ts\b/i,        // TypeScript file references
  /\.js\b/i,        // JavaScript file references
  /at\s+\w+\s*\(/,  // Stack trace patterns
  /line\s+\d+/i,
  /column\s+\d+/i,
  /internal/i,
  /function\s+\w+/i,
  /sql/i,
  /query/i,
  /schema/i,
  /table\s+\w+/i,
];

export interface SanitizedError {
  code: ErrorCode;
  message: string;
  retryable: boolean;
  retryAfterSeconds?: number;
}

/**
 * Check if an error message contains sensitive information
 */
export function containsSensitiveInfo(message: string): boolean {
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(message));
}

/**
 * Map raw error to a safe error code
 */
export function classifyError(error: unknown): ErrorCode {
  if (!error) return ERROR_CODES.INTERNAL_ERROR;
  
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  
  // Auth errors
  if (message.includes('jwt') || message.includes('token')) {
    if (message.includes('expired')) return ERROR_CODES.AUTH_EXPIRED_TOKEN;
    if (message.includes('invalid')) return ERROR_CODES.AUTH_INVALID_TOKEN;
    return ERROR_CODES.AUTH_UNAUTHORIZED;
  }
  
  if (message.includes('unauthorized') || message.includes('not authenticated')) {
    return ERROR_CODES.AUTH_UNAUTHORIZED;
  }
  
  // Rate limit errors
  if (message.includes('rate limit') || message.includes('too many')) {
    return ERROR_CODES.RATE_LIMIT_EXCEEDED;
  }
  
  if (message.includes('daily limit') || message.includes('limit exceeded')) {
    return ERROR_CODES.DAILY_LIMIT_EXCEEDED;
  }
  
  if (message.includes('cooldown')) {
    return ERROR_CODES.COOLDOWN_ACTIVE;
  }
  
  // Resource errors
  if (message.includes('not found') || message.includes('no rows')) {
    return ERROR_CODES.NOT_FOUND;
  }
  
  if (message.includes('forbidden') || message.includes('permission')) {
    return ERROR_CODES.FORBIDDEN;
  }
  
  if (message.includes('conflict') || message.includes('already exists')) {
    return ERROR_CODES.CONFLICT;
  }
  
  if (message.includes('validation') || message.includes('invalid')) {
    return ERROR_CODES.VALIDATION_ERROR;
  }
  
  // Lock errors
  if (message.includes('lock') || message.includes('concurrent')) {
    return ERROR_CODES.AUTOMATION_LOCK_FAILED;
  }
  
  return ERROR_CODES.INTERNAL_ERROR;
}

/**
 * Sanitize an error for client response
 * NEVER exposes internal details, stack traces, or sensitive information
 */
export function sanitizeError(
  error: unknown,
  overrideCode?: ErrorCode
): SanitizedError {
  const code = overrideCode || classifyError(error);
  const message = SAFE_MESSAGES[code];
  
  // Determine if error is retryable
  const retryableCodes: ErrorCode[] = [
    ERROR_CODES.RATE_LIMIT_EXCEEDED,
    ERROR_CODES.COOLDOWN_ACTIVE,
    ERROR_CODES.AUTOMATION_LOCK_FAILED,
    ERROR_CODES.INTERNAL_ERROR,
  ];
  const retryable = retryableCodes.includes(code);
  
  // Add retry hints for specific errors
  let retryAfterSeconds: number | undefined;
  if (code === ERROR_CODES.RATE_LIMIT_EXCEEDED) {
    retryAfterSeconds = 60;
  } else if (code === ERROR_CODES.COOLDOWN_ACTIVE) {
    retryAfterSeconds = 300; // 5 minutes default
  } else if (code === ERROR_CODES.AUTOMATION_LOCK_FAILED) {
    retryAfterSeconds = 5;
  }
  
  return {
    code,
    message,
    retryable,
    ...(retryAfterSeconds && { retryAfterSeconds }),
  };
}

/**
 * Create a safe error response for HTTP
 */
export function createErrorResponse(
  error: unknown,
  corsHeaders: Record<string, string>,
  overrideCode?: ErrorCode,
  statusCode?: number
): Response {
  const sanitized = sanitizeError(error, overrideCode);
  
  // Determine HTTP status from error code
  let status = statusCode || 500;
  if (!statusCode) {
    if (sanitized.code.startsWith('AUTH_')) {
      status = 401;
    } else if (sanitized.code === ERROR_CODES.FORBIDDEN) {
      status = 403;
    } else if (sanitized.code === ERROR_CODES.NOT_FOUND) {
      status = 404;
    } else if (sanitized.code === ERROR_CODES.CONFLICT) {
      status = 409;
    } else if (sanitized.code === ERROR_CODES.RATE_LIMIT_EXCEEDED || 
               sanitized.code === ERROR_CODES.DAILY_LIMIT_EXCEEDED ||
               sanitized.code === ERROR_CODES.COOLDOWN_ACTIVE) {
      status = 429;
    } else if (sanitized.code === ERROR_CODES.VALIDATION_ERROR ||
               sanitized.code === ERROR_CODES.BAD_REQUEST) {
      status = 400;
    }
  }
  
  const headers: Record<string, string> = {
    ...corsHeaders,
    'Content-Type': 'application/json',
  };
  
  // Add Retry-After header for rate limits
  if (sanitized.retryAfterSeconds) {
    headers['Retry-After'] = String(sanitized.retryAfterSeconds);
  }
  
  // Log the real error internally (but not in the response)
  console.error('[ERROR]', {
    code: sanitized.code,
    originalError: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  
  return new Response(JSON.stringify({
    error: sanitized.code,
    message: sanitized.message,
    retryable: sanitized.retryable,
    ...(sanitized.retryAfterSeconds && { retryAfterSeconds: sanitized.retryAfterSeconds }),
  }), {
    status,
    headers,
  });
}

/**
 * Sanitize a reason string for client display
 * Removes any potentially sensitive information
 */
export function sanitizeReason(reason: string): string {
  if (!reason) return 'Action blocked';
  
  // If it contains sensitive info, return generic message
  if (containsSensitiveInfo(reason)) {
    return 'Action blocked by safety rules';
  }
  
  // Truncate if too long
  if (reason.length > 200) {
    return reason.substring(0, 197) + '...';
  }
  
  return reason;
}
