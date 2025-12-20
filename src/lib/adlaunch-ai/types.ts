import { Platform, PlatformPermissions, ExecutionStatus, CampaignObjective, PlatformConfig, Campaign } from '../../types';

// Engine-specific types

// 1. Permission Interpreter
export type PermissionAction = 'NONE' | 'REQUEST_ADMIN_ACCESS';

export interface PermissionAnalysis extends PlatformPermissions {
  requiredAction: PermissionAction;
}

// 2. Campaign Translator
export interface TranslatedCampaign {
  platform: Platform;
  campaign: any; // Ideally this would be a strict schema per platform
  validationErrors?: string[];
}

// 3. Pre-Launch Decision
export type LaunchDecision = 'BLOCK' | 'SOFT_LAUNCH' | 'FULL_LAUNCH';

export interface LaunchDecisionResult {
  decision: LaunchDecision;
  reason: string;
  notes?: string;
}

// 4. Optimization Engine
export type OptimizationActionType = 'SCALE' | 'PAUSE' | 'MODIFY' | 'NO_ACTION';

export interface OptimizationChange {
  budget?: number; // New daily budget
  creativeId?: string; // ID of creative to swap/enable
  status?: 'PAUSED' | 'ACTIVE'; // Status change
}

export interface OptimizationResult {
  action: OptimizationActionType;
  changes: OptimizationChange;
  reason: string;
}

// 5. Recovery Engine
export interface SafeVariant {
  hook: string;
  body: string;
  cta: string;
}

export interface RecoveryResult {
  safeVariants: SafeVariant[];
}

// 6. Memory Engine
export type MemoryEventType = 'CAMPAIGN_LAUNCH' | 'CAMPAIGN_FAILURE' | 'AD_DISAPPROVAL' | 'OPTIMIZATION_SUCCESS';

export interface MemoryEvent {
  type: MemoryEventType;
  platform: Platform;
  timestamp: string;
  details: Record<string, any>;
  outcome: 'positive' | 'negative' | 'neutral';
}
