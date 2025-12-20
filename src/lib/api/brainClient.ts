/**
 * Brain API Client
 * 
 * Centralized gateway for all Antigravity Brain service calls.
 * All mock API calls in the UI should be replaced with calls to this module.
 */

import type {
  Platform,
  AdAccountConnection,
  CampaignIntent,
  PlatformConfig,
  PlatformPermissions,
  CampaignMetrics,
  AutomationRule,
  ExecutionStatus,
} from '@/types';

// ============================================
// TYPES
// ============================================

export interface BrainApiError {
  error: string;
  message: string;
  context?: Record<string, unknown>;
}

export interface PermissionInterpretationResult {
  permissions: PlatformPermissions;
  requiredAction: 'NONE' | 'REQUEST_ADMIN_ACCESS';
  scopes: string[];
  role?: string;
}

export interface TranslatedCampaignResult {
  platform: Platform;
  campaign: Record<string, unknown>;
  validationErrors?: string[];
}

export interface LaunchDecisionResult {
  decision: 'BLOCK' | 'SOFT_LAUNCH' | 'FULL_LAUNCH';
  reason: string;
  notes?: string;
}

export interface OptimizationResult {
  action: 'SCALE' | 'PAUSE' | 'MODIFY' | 'NO_ACTION';
  changes: {
    budget?: number;
    creativeId?: string;
    status?: 'PAUSED' | 'ACTIVE';
  };
  reason: string;
}

export interface SafeVariant {
  hook: string;
  body: string;
  cta: string;
}

export interface RecoveryResult {
  safeVariants: SafeVariant[];
}

export interface MemoryEventPayload {
  type: 'CAMPAIGN_LAUNCH' | 'CAMPAIGN_FAILURE' | 'AD_DISAPPROVAL' | 'OPTIMIZATION_SUCCESS';
  platform: Platform;
  accountId: string;
  timestamp: string;
  details: Record<string, unknown>;
  outcome: 'positive' | 'negative' | 'neutral';
}

// ============================================
// CONFIG
// ============================================

const getBaseUrl = (): string => {
  const url = import.meta.env.VITE_BRAIN_API_BASE_URL;
  if (!url) {
    console.warn('VITE_BRAIN_API_BASE_URL not set, using default');
    return 'https://api.adlaunch.ai/brain';
  }
  return url;
};

const getToken = (): string => {
  return import.meta.env.VITE_BRAIN_API_TOKEN || '';
};

const getProjectId = (): string => {
  // Try to get from localStorage (set by project store) or env
  try {
    const storage = localStorage.getItem('adlaunch-storage');
    if (storage) {
      const parsed = JSON.parse(storage);
      return parsed.state?.currentProject?.id || '';
    }
  } catch {
    // Ignore parse errors
  }
  return import.meta.env.VITE_PROJECT_ID || '';
};

const generateRequestId = (): string => {
  return `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

// ============================================
// HTTP UTILITIES
// ============================================

interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  endpoint: string;
  body?: Record<string, unknown>;
}

async function request<T>(options: RequestOptions): Promise<T> {
  const { method, endpoint, body } = options;
  const baseUrl = getBaseUrl();
  const token = getToken();
  const projectId = getProjectId();
  const requestId = generateRequestId();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Project-Id': projectId,
    'X-Request-Id': requestId,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${baseUrl}${endpoint}`;

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      const apiError: BrainApiError = {
        error: data.error || 'API_ERROR',
        message: data.message || `Request failed with status ${response.status}`,
        context: {
          status: response.status,
          endpoint,
          requestId,
          ...data.context,
        },
      };
      throw apiError;
    }

    return data as T;
  } catch (error) {
    // If it's already our error format, rethrow
    if (error && typeof error === 'object' && 'error' in error && 'message' in error) {
      throw error;
    }

    // Network or parsing error
    const apiError: BrainApiError = {
      error: 'NETWORK_ERROR',
      message: error instanceof Error ? error.message : 'Failed to connect to Brain API',
      context: {
        endpoint,
        requestId,
      },
    };
    throw apiError;
  }
}

// ============================================
// API METHODS
// ============================================

/**
 * 1. Interpret Permissions
 * 
 * Analyzes OAuth scopes and account metadata to determine what actions are allowed.
 * Called after OAuth connect completes.
 */
export async function interpretPermissions(
  platform: Platform,
  account: {
    accountId: string;
    accountName: string;
    scopes: string[];
    role?: string;
  }
): Promise<PermissionInterpretationResult> {
  return request<PermissionInterpretationResult>({
    method: 'POST',
    endpoint: '/v1/permissions/interpret',
    body: {
      platform,
      accountId: account.accountId,
      accountName: account.accountName,
      scopes: account.scopes,
      role: account.role,
    },
  });
}

/**
 * 2. Translate Campaign
 * 
 * Maps generic CampaignIntent to platform-specific API structures.
 */
export async function translateCampaign(
  intent: CampaignIntent,
  platform: Platform,
  accountId: string,
  platformConfig: PlatformConfig
): Promise<TranslatedCampaignResult> {
  return request<TranslatedCampaignResult>({
    method: 'POST',
    endpoint: '/v1/campaigns/translate',
    body: {
      intent: {
        id: intent.id,
        name: intent.name,
        objective: intent.objective,
        assetIds: intent.assetIds,
        landingPageUrl: intent.landingPageUrl,
        audience: intent.audience,
        dailyBudget: intent.dailyBudget,
        softLaunch: intent.softLaunch,
      },
      platform,
      accountId,
      platformConfig,
    },
  });
}

/**
 * 3. Decide Launch
 * 
 * Final safety gate before campaign creation.
 * Checks execution readiness and policy risk scores.
 */
export async function decideLaunch(
  executionStatus: ExecutionStatus,
  policyRiskScore: number,
  platform: Platform,
  permissions: PlatformPermissions
): Promise<LaunchDecisionResult> {
  return request<LaunchDecisionResult>({
    method: 'POST',
    endpoint: '/v1/launch/decide',
    body: {
      executionStatus,
      policyRiskScore,
      platform,
      permissions,
    },
  });
}

/**
 * 4. Optimize Campaign
 * 
 * Analyzes live performance metrics against user-defined rules.
 * Suggests actions (SCALE, PAUSE, MODIFY).
 */
export async function optimize(
  platform: Platform,
  metrics: CampaignMetrics,
  rules: AutomationRule[]
): Promise<OptimizationResult> {
  return request<OptimizationResult>({
    method: 'POST',
    endpoint: '/v1/campaigns/optimize',
    body: {
      platform,
      metrics,
      rules: rules.map(r => ({
        id: r.id,
        name: r.name,
        enabled: r.enabled,
        condition: r.condition,
        action: r.action,
      })),
    },
  });
}

/**
 * 5. Recover Disapproved Ad
 * 
 * Generates compliant alternatives for disapproved ads.
 */
export async function recover(
  platform: Platform,
  disapprovalReason: string,
  originalAd: { hook: string; body: string; cta: string }
): Promise<RecoveryResult> {
  return request<RecoveryResult>({
    method: 'POST',
    endpoint: '/v1/recovery/generate',
    body: {
      platform,
      disapprovalReason,
      originalAd,
    },
  });
}

/**
 * 6. Memory Write
 * 
 * Records events for persistent learning.
 * Called when campaign outcomes happen.
 */
export async function memoryWrite(
  platform: Platform,
  accountId: string,
  event: MemoryEventPayload
): Promise<{ success: boolean }> {
  return request<{ success: boolean }>({
    method: 'POST',
    endpoint: '/v1/memory/write',
    body: {
      platform,
      accountId,
      event,
    },
  });
}

// ============================================
// ERROR HELPERS
// ============================================

export function isBrainApiError(error: unknown): error is BrainApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'error' in error &&
    'message' in error
  );
}

export function formatBrainError(error: unknown): string {
  if (isBrainApiError(error)) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
}
