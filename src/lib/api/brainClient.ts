/**
 * Antigravity Brain API Client
 * 
 * Central API gateway for all backend calls to the Brain service.
 * All methods handle errors consistently using the unified error model.
 */

import type { 
  Platform, 
  CampaignIntent, 
  PlatformConfig, 
  PlatformPermissions,
  ExecutionStatus,
  CampaignMetrics,
  AutomationRule,
} from '@/types';

import { supabase } from '@/integrations/supabase/client';

// ============================================
// CONFIGURATION
// ============================================

const BRAIN_API_BASE_URL = import.meta.env.VITE_BRAIN_API_BASE_URL || '';
const BRAIN_API_TOKEN = import.meta.env.VITE_BRAIN_API_TOKEN || '';

// Supabase Edge Function URL for AI analysis
const SUPABASE_FUNCTIONS_URL = 'https://fzngibjbhrirkdbpxmii.supabase.co/functions/v1';

// ============================================
// ERROR HANDLING
// ============================================

export interface BrainAPIError {
  error: string;
  message: string;
  context?: Record<string, unknown>;
}

export class BrainClientError extends Error {
  public readonly error: string;
  public readonly context?: Record<string, unknown>;

  constructor(apiError: BrainAPIError) {
    super(apiError.message);
    this.name = 'BrainClientError';
    this.error = apiError.error;
    this.context = apiError.context;
  }
}

function generateRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorData: BrainAPIError;
    try {
      errorData = await response.json();
    } catch {
      errorData = {
        error: 'NETWORK_ERROR',
        message: `Request failed with status ${response.status}: ${response.statusText}`,
        context: { status: response.status },
      };
    }
    throw new BrainClientError(errorData);
  }
  return response.json();
}

function buildHeaders(projectId: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${BRAIN_API_TOKEN}`,
    'X-Project-Id': projectId,
    'X-Request-Id': generateRequestId(),
  };
}

// ============================================
// API TYPES
// ============================================

export interface InterpretPermissionsRequest {
  platform: Platform;
  account: {
    id: string;
    name: string;
    tokenMetadata: Record<string, unknown>;
  };
}

export interface InterpretPermissionsResponse {
  permissions: PlatformPermissions;
  status: 'connected' | 'limited_access';
  warnings?: string[];
}

export interface TranslateCampaignRequest {
  intent: CampaignIntent;
  platform: Platform;
  accountId: string;
  platformConfig: PlatformConfig[Platform];
}

export interface TranslateCampaignResponse {
  translatedCampaign: {
    id: string;
    platformCampaignId?: string;
    name: string;
    platform: Platform;
    accountId: string;
    status: 'pending' | 'active' | 'rejected';
    platformSpecificData: Record<string, unknown>;
  };
  warnings?: string[];
}

export interface DecideLaunchRequest {
  executionStatus: ExecutionStatus;
  policyRiskScore: number;
  platform: Platform;
  permissions: PlatformPermissions;
}

export interface DecideLaunchResponse {
  decision: 'proceed' | 'block' | 'review';
  reason: string;
  riskLevel: 'low' | 'medium' | 'high';
  recommendations?: string[];
}

// ============================================
// LAUNCH RUN TYPES (Single Entry Point)
// ============================================

// Real execution status - reflects actual ad platform execution
export type RealExecutionStatus = 
  | 'EXECUTED'           // Successfully created in ad platform
  | 'EXECUTION_FAILED'   // API call failed
  | 'EXECUTION_BLOCKED'; // Blocked by platform policy

export type LaunchAccountStatus = 'DECIDED_FULL' | 'DECIDED_SOFT' | 'BLOCKED' | 'SKIPPED';

export interface LaunchAccountResult {
  accountId: string;
  accountName: string;
  status: LaunchAccountStatus;
  campaignId?: string;
  platformCampaignId?: string;
  reason?: string;
  // Real execution feedback
  executionStatus?: RealExecutionStatus;
  platformError?: string;
}

export interface LaunchPlatformResult {
  platform: Platform;
  accounts: LaunchAccountResult[];
  totalLaunched: number;
  totalSkipped: number;
}

export interface LaunchRunRequest {
  intent: CampaignIntent;
  executionReadiness: {
    status: ExecutionStatus;
    canLaunch: boolean;
    platformStatuses: Array<{
      platform: Platform;
      readyAccounts: string[];
      blockedAccounts: Array<{ id: string; name: string; reason: string }>;
    }>;
  };
  platformConfigs: PlatformConfig;
}

export interface LaunchRunResponse {
  runId: string;
  status: 'success' | 'partial' | 'failed';
  platformResults: LaunchPlatformResult[];
  totalCampaignsLaunched: number;
  totalCampaignsSkipped: number;
  memoryEventIds: string[];
  warnings?: string[];
}

export interface OptimizeRequest {
  platform: Platform;
  metrics: CampaignMetrics;
  rules: AutomationRule[];
}

export interface OptimizeResponse {
  actions: {
    id: string;
    action: string;
    reason: string;
    result?: string;
    timestamp: string;
  }[];
  recommendations?: string[];
}

export interface RecoverRequest {
  platform: Platform;
  disapprovalReason: string;
  originalAd: {
    id: string;
    content: string;
    type: 'video' | 'image' | 'text';
  };
}

export interface RecoverResponse {
  alternatives: {
    id: string;
    original: string;
    suggestion: string;
    reason: string;
    confidence: number;
  }[];
  canRelaunch: boolean;
}

export interface MemoryWriteRequest {
  platform: Platform;
  accountId: string;
  event: 'launch' | 'pause' | 'resume' | 'disapproval' | 'recovery' | 'optimization';
  details: Record<string, unknown>;
}

export interface MemoryWriteResponse {
  success: boolean;
  eventId: string;
}

// ============================================
// AI COMPLIANCE ANALYSIS TYPES
// ============================================

export interface ComplianceIssue {
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'policy' | 'creative' | 'content' | 'technical';
  message: string;
  recommendation?: string;
}

export interface AnalyzeAssetRequest {
  asset: {
    id: string;
    type: 'video' | 'image' | 'text';
    name: string;
    url?: string;
    content?: string;
  };
}

export interface AnalyzeAssetResponse {
  assetId: string;
  approved: boolean;
  policyRiskScore: number;
  creativeQualityScore: number;
  issues: ComplianceIssue[];
  rejectionReasons: string[];
  analyzedAt: string;
}

export interface AnalyzeBatchRequest {
  assets: Array<{
    id: string;
    type: 'video' | 'image' | 'text';
    name: string;
    url?: string;
    content?: string;
  }>;
}

export interface AnalyzeBatchResponse {
  results: AnalyzeAssetResponse[];
  summary: {
    total: number;
    approved: number;
    rejected: number;
  };
}

// ============================================
// API CLIENT
// ============================================

export const brainClient = {
  /**
   * Interpret permissions from OAuth token metadata
   * Called after OAuth connect flow completes
   */
  async interpretPermissions(
    projectId: string,
    request: InterpretPermissionsRequest
  ): Promise<InterpretPermissionsResponse> {
    if (!BRAIN_API_BASE_URL) {
      // Fallback for development without backend
      console.warn('[BrainClient] No API URL configured, using fallback');
      return {
        permissions: {
          canAnalyze: true,
          canLaunch: Math.random() > 0.3,
          canOptimize: Math.random() > 0.5,
        },
        status: Math.random() > 0.3 ? 'connected' : 'limited_access',
      };
    }

    const response = await fetch(`${BRAIN_API_BASE_URL}/v1/permissions/interpret`, {
      method: 'POST',
      headers: buildHeaders(projectId),
      body: JSON.stringify(request),
    });

    return handleResponse<InterpretPermissionsResponse>(response);
  },

  /**
   * Translate a Campaign Intent into a platform-specific campaign
   */
  async translateCampaign(
    projectId: string,
    request: TranslateCampaignRequest
  ): Promise<TranslateCampaignResponse> {
    if (!BRAIN_API_BASE_URL) {
      console.warn('[BrainClient] No API URL configured, using fallback');
      return {
        translatedCampaign: {
          id: `campaign-${Date.now()}-${request.platform}-${request.accountId}`,
          name: `${request.intent.name} - ${request.platform}`,
          platform: request.platform,
          accountId: request.accountId,
          status: 'pending',
          platformSpecificData: {},
        },
      };
    }

    const response = await fetch(`${BRAIN_API_BASE_URL}/v1/translator/campaign`, {
      method: 'POST',
      headers: buildHeaders(projectId),
      body: JSON.stringify(request),
    });

    return handleResponse<TranslateCampaignResponse>(response);
  },

  /**
   * Get AI decision on whether to proceed with launch
   * @deprecated Use launchRun() for all launch operations
   */
  async decideLaunch(
    projectId: string,
    request: DecideLaunchRequest
  ): Promise<DecideLaunchResponse> {
    if (!BRAIN_API_BASE_URL) {
      console.warn('[BrainClient] No API URL configured, using fallback');
      const canProceed = request.policyRiskScore < 70 && 
                         request.executionStatus !== 'BLOCKED' &&
                         request.permissions.canLaunch;
      return {
        decision: canProceed ? 'proceed' : 'block',
        reason: canProceed 
          ? 'All checks passed' 
          : 'Risk score too high or permissions insufficient',
        riskLevel: request.policyRiskScore < 30 ? 'low' : 
                   request.policyRiskScore < 70 ? 'medium' : 'high',
      };
    }

    const response = await fetch(`${BRAIN_API_BASE_URL}/v1/decider/launch`, {
      method: 'POST',
      headers: buildHeaders(projectId),
      body: JSON.stringify(request),
    });

    return handleResponse<DecideLaunchResponse>(response);
  },

  /**
   * SINGLE ENTRY POINT FOR LAUNCHING CAMPAIGNS
   * 
   * This is the only API that should be used for launching campaigns.
   * The Brain service handles all orchestration:
   * - Decision making per platform/account
   * - Campaign translation
   * - Memory logging
   */
  async launchRun(
    projectId: string,
    request: LaunchRunRequest
  ): Promise<LaunchRunResponse> {
    if (!BRAIN_API_BASE_URL) {
      console.warn('[BrainClient] No API URL configured, using fallback');
      
      // Build fallback response based on execution readiness
      const platformResults: LaunchPlatformResult[] = request.executionReadiness.platformStatuses.map(ps => {
        const launchedAccounts: LaunchAccountResult[] = ps.readyAccounts.map(accountId => ({
          accountId,
          accountName: accountId,
          status: request.intent.softLaunch ? 'DECIDED_SOFT' : 'DECIDED_FULL' as LaunchAccountStatus,
          campaignId: `campaign-${Date.now()}-${ps.platform}-${accountId}`,
          platformCampaignId: `plat-${Date.now()}`,
        }));
        
        const skippedAccounts: LaunchAccountResult[] = ps.blockedAccounts.map(blocked => ({
          accountId: blocked.id,
          accountName: blocked.name,
          status: 'BLOCKED' as LaunchAccountStatus,
          reason: blocked.reason,
        }));

        return {
          platform: ps.platform,
          accounts: [...launchedAccounts, ...skippedAccounts],
          totalLaunched: launchedAccounts.length,
          totalSkipped: skippedAccounts.length,
        };
      });

      const totalLaunched = platformResults.reduce((sum, pr) => sum + pr.totalLaunched, 0);
      const totalSkipped = platformResults.reduce((sum, pr) => sum + pr.totalSkipped, 0);

      return {
        runId: `run-${Date.now()}`,
        status: totalSkipped > 0 && totalLaunched > 0 ? 'partial' : totalLaunched > 0 ? 'success' : 'failed',
        platformResults,
        totalCampaignsLaunched: totalLaunched,
        totalCampaignsSkipped: totalSkipped,
        memoryEventIds: platformResults.flatMap(pr => 
          pr.accounts.filter(a => a.status !== 'BLOCKED' && a.status !== 'SKIPPED').map(() => `evt-${Date.now()}`)
        ),
      };
    }

    const response = await fetch(`${BRAIN_API_BASE_URL}/v1/launch/run`, {
      method: 'POST',
      headers: buildHeaders(projectId),
      body: JSON.stringify(request),
    });

    return handleResponse<LaunchRunResponse>(response);
  },

  /**
   * Get AI optimization recommendations
   */
  async optimize(
    projectId: string,
    request: OptimizeRequest
  ): Promise<OptimizeResponse> {
    if (!BRAIN_API_BASE_URL) {
      console.warn('[BrainClient] No API URL configured, using fallback');
      return {
        actions: [],
        recommendations: ['No backend configured - optimization unavailable'],
      };
    }

    const response = await fetch(`${BRAIN_API_BASE_URL}/v1/optimizer/analyze`, {
      method: 'POST',
      headers: buildHeaders(projectId),
      body: JSON.stringify(request),
    });

    return handleResponse<OptimizeResponse>(response);
  },

  /**
   * Generate AI-powered recovery alternatives for disapproved ads
   */
  async recover(
    projectId: string,
    request: RecoverRequest
  ): Promise<RecoverResponse> {
    if (!BRAIN_API_BASE_URL) {
      console.warn('[BrainClient] No API URL configured, using fallback');
      return {
        alternatives: [
          {
            id: '1',
            original: request.originalAd.content,
            suggestion: 'AI-generated safe variant (backend not configured)',
            reason: 'Fallback response - connect Brain API for real suggestions',
            confidence: 0.5,
          },
        ],
        canRelaunch: true,
      };
    }

    const response = await fetch(`${BRAIN_API_BASE_URL}/v1/recovery/generate`, {
      method: 'POST',
      headers: buildHeaders(projectId),
      body: JSON.stringify(request),
    });

    return handleResponse<RecoverResponse>(response);
  },

  /**
   * Write an event to the platform memory
   */
  async memoryWrite(
    projectId: string,
    request: MemoryWriteRequest
  ): Promise<MemoryWriteResponse> {
    if (!BRAIN_API_BASE_URL) {
      console.warn('[BrainClient] No API URL configured, using fallback');
      return {
        success: true,
        eventId: `evt-${Date.now()}`,
      };
    }

    const response = await fetch(`${BRAIN_API_BASE_URL}/v1/memory/write`, {
      method: 'POST',
      headers: buildHeaders(projectId),
      body: JSON.stringify(request),
    });

    return handleResponse<MemoryWriteResponse>(response);
  },

  /**
   * Analyze a single asset for AI compliance
   * Returns policy risk score, creative quality score, and rejection reasons
   */
  async analyzeAsset(
    projectId: string,
    request: AnalyzeAssetRequest
  ): Promise<AnalyzeAssetResponse> {
    console.log('[BrainClient] Analyzing asset via Supabase Edge Function:', request.asset.id);
    
    try {
      const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/analyze-asset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ asset: request.asset }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[BrainClient] Edge function error:', errorData);
        throw new BrainClientError({
          error: 'AI_ANALYSIS_ERROR',
          message: errorData.error || `Analysis failed with status ${response.status}`,
        });
      }

      const result = await response.json();
      console.log('[BrainClient] Analysis complete:', result.assetId, result.approved ? 'APPROVED' : 'REJECTED');
      return result;
    } catch (error) {
      console.error('[BrainClient] analyzeAsset error:', error);
      
      if (error instanceof BrainClientError) {
        throw error;
      }
      
      throw new BrainClientError({
        error: 'AI_ANALYSIS_ERROR',
        message: error instanceof Error ? error.message : 'AI analysis failed',
      });
    }
  },

  /**
   * Analyze multiple assets in batch for AI compliance
   */
  async analyzeAssetBatch(
    projectId: string,
    request: AnalyzeBatchRequest
  ): Promise<AnalyzeBatchResponse> {
    console.log('[BrainClient] Analyzing batch via Supabase Edge Function:', request.assets.length, 'assets');
    
    try {
      const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/analyze-asset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ assets: request.assets }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[BrainClient] Edge function batch error:', errorData);
        throw new BrainClientError({
          error: 'AI_ANALYSIS_ERROR',
          message: errorData.error || `Batch analysis failed with status ${response.status}`,
        });
      }

      const result = await response.json();
      console.log('[BrainClient] Batch analysis complete:', result.summary);
      return result;
    } catch (error) {
      console.error('[BrainClient] analyzeAssetBatch error:', error);
      
      if (error instanceof BrainClientError) {
        throw error;
      }
      
      throw new BrainClientError({
        error: 'AI_ANALYSIS_ERROR',
        message: error instanceof Error ? error.message : 'Batch AI analysis failed',
      });
    }
  },
};

export default brainClient;
