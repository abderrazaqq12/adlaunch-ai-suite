/**
 * State Machine Types for AdLaunch AI
 * 
 * CORE PRINCIPLE: UI only reflects backend state.
 * Every button shown MUST be valid for the current state.
 */

// ============================================
// ASSET STATE MACHINE
// ============================================

/**
 * Asset States (Strict Order):
 * UPLOADED → ANALYZING → APPROVED → READY_FOR_LAUNCH
 *                    ↘ BLOCKED
 */
export type AssetState = 
  | 'UPLOADED'        // Asset uploaded, no AI analysis yet
  | 'ANALYZING'       // AI compliance running
  | 'APPROVED'        // Passed AI compliance
  | 'READY_FOR_LAUNCH'// Approved + user confirmed ready
  | 'BLOCKED';        // Failed compliance

export interface AssetStateConfig {
  state: AssetState;
  canRunAnalysis: boolean;
  canViewDecision: boolean;
  canMarkReady: boolean;
  canSelectForPublish: boolean;
  canGenerateVariant: boolean;
  canReanalyze: boolean;
  showSpinner: boolean;
}

export const ASSET_STATE_CONFIG: Record<AssetState, Omit<AssetStateConfig, 'state'>> = {
  UPLOADED: {
    canRunAnalysis: true,
    canViewDecision: false,
    canMarkReady: false,
    canSelectForPublish: false,
    canGenerateVariant: false,
    canReanalyze: false,
    showSpinner: false,
  },
  ANALYZING: {
    canRunAnalysis: false,
    canViewDecision: false,
    canMarkReady: false,
    canSelectForPublish: false,
    canGenerateVariant: false,
    canReanalyze: false,
    showSpinner: true,
  },
  APPROVED: {
    canRunAnalysis: false,
    canViewDecision: true,
    canMarkReady: true,
    canSelectForPublish: false,
    canGenerateVariant: false,
    canReanalyze: false,
    showSpinner: false,
  },
  READY_FOR_LAUNCH: {
    canRunAnalysis: false,
    canViewDecision: true,
    canMarkReady: false,
    canSelectForPublish: true,
    canGenerateVariant: false,
    canReanalyze: false,
    showSpinner: false,
  },
  BLOCKED: {
    canRunAnalysis: false,
    canViewDecision: true,
    canMarkReady: false,
    canSelectForPublish: false,
    canGenerateVariant: true,
    canReanalyze: true,
    showSpinner: false,
  },
};

export function getAssetStateConfig(state: AssetState): AssetStateConfig {
  return { state, ...ASSET_STATE_CONFIG[state] };
}

// ============================================
// PUBLISH FLOW STATE MACHINE
// ============================================

/**
 * Publish Flow States (Strict Linear Order):
 * PUBLISH_INIT → ASSETS_SELECTED → ACCOUNTS_SELECTED → 
 * AUDIENCE_DEFINED → READY_TO_PUBLISH → EXECUTING → PUBLISHED
 */
export type PublishFlowState = 
  | 'PUBLISH_INIT'      // Starting state, need to select assets
  | 'ASSETS_SELECTED'   // Assets selected, need accounts
  | 'ACCOUNTS_SELECTED' // Accounts selected, need audience
  | 'AUDIENCE_DEFINED'  // Audience defined, ready to review
  | 'READY_TO_PUBLISH'  // All set, can publish
  | 'EXECUTING'         // Publishing in progress
  | 'PUBLISHED';        // Complete, redirect to monitoring

export interface PublishFlowStateConfig {
  state: PublishFlowState;
  stepIndex: number;
  canGoBack: boolean;
  canGoNext: boolean;
  canPublish: boolean;
  showProgress: boolean;
  blockNavigation: boolean;
}

export const PUBLISH_FLOW_STEPS: PublishFlowState[] = [
  'PUBLISH_INIT',
  'ASSETS_SELECTED',
  'ACCOUNTS_SELECTED',
  'AUDIENCE_DEFINED',
  'READY_TO_PUBLISH',
  'EXECUTING',
  'PUBLISHED',
];

export function getPublishFlowStepIndex(state: PublishFlowState): number {
  return PUBLISH_FLOW_STEPS.indexOf(state);
}

export function canTransitionPublishFlow(current: PublishFlowState, next: PublishFlowState): boolean {
  const currentIndex = getPublishFlowStepIndex(current);
  const nextIndex = getPublishFlowStepIndex(next);
  
  // Can only go forward by 1 step or backward by 1 step (except from EXECUTING/PUBLISHED)
  if (current === 'EXECUTING' || current === 'PUBLISHED') return false;
  
  return nextIndex === currentIndex + 1 || nextIndex === currentIndex - 1;
}

// ============================================
// AD ACCOUNT STATE MACHINE
// ============================================

/**
 * Ad Account States:
 * DISCONNECTED → CONNECTING → CONNECTED
 */
export type AdAccountState = 
  | 'DISCONNECTED'  // Not connected
  | 'CONNECTING'    // OAuth in progress
  | 'CONNECTED';    // Connected with permissions

export interface AdAccountPermissions {
  canAnalyze: boolean;
  canLaunch: boolean;
  canOptimize: boolean;
}

export interface AdAccountStateConfig {
  state: AdAccountState;
  canConnect: boolean;
  canDisconnect: boolean;
  canRefresh: boolean;
  showSpinner: boolean;
}

export const AD_ACCOUNT_STATE_CONFIG: Record<AdAccountState, Omit<AdAccountStateConfig, 'state'>> = {
  DISCONNECTED: {
    canConnect: true,
    canDisconnect: false,
    canRefresh: false,
    showSpinner: false,
  },
  CONNECTING: {
    canConnect: false,
    canDisconnect: false,
    canRefresh: false,
    showSpinner: true,
  },
  CONNECTED: {
    canConnect: false,
    canDisconnect: true,
    canRefresh: true,
    showSpinner: false,
  },
};

// ============================================
// MONITORING STATE MACHINE
// ============================================

/**
 * Monitoring States:
 * NO_ACTIVE_CAMPAIGNS | ACTIVE | PAUSED | STOPPED
 */
export type MonitoringState = 
  | 'NO_ACTIVE_CAMPAIGNS'
  | 'ACTIVE'
  | 'PAUSED'
  | 'STOPPED';

export interface MonitoringStateConfig {
  state: MonitoringState;
  showMetrics: boolean;
  showAIActions: boolean;
  showEmptyState: boolean;
}

export const MONITORING_STATE_CONFIG: Record<MonitoringState, Omit<MonitoringStateConfig, 'state'>> = {
  NO_ACTIVE_CAMPAIGNS: {
    showMetrics: false,
    showAIActions: false,
    showEmptyState: true,
  },
  ACTIVE: {
    showMetrics: true,
    showAIActions: true,
    showEmptyState: false,
  },
  PAUSED: {
    showMetrics: true,
    showAIActions: false,
    showEmptyState: false,
  },
  STOPPED: {
    showMetrics: true,
    showAIActions: false,
    showEmptyState: false,
  },
};

// ============================================
// DISAPPROVAL RECOVERY STATE MACHINE
// ============================================

/**
 * Recovery States:
 * NO_ISSUES → DISAPPROVED_DETECTED → FIX_GENERATED → USER_APPROVED → RELAUNCHED
 */
export type RecoveryState = 
  | 'NO_ISSUES'           // No disapproved campaigns
  | 'DISAPPROVED_DETECTED'// Disapproval found
  | 'FIX_GENERATED'       // AI generated safe variant
  | 'USER_APPROVED'       // User approved the fix
  | 'RELAUNCHED';         // Successfully relaunched

export interface RecoveryStateConfig {
  state: RecoveryState;
  canGenerateFix: boolean;
  canApproveFix: boolean;
  canRelaunch: boolean;
  showEmptyState: boolean;
}

export const RECOVERY_STATE_CONFIG: Record<RecoveryState, Omit<RecoveryStateConfig, 'state'>> = {
  NO_ISSUES: {
    canGenerateFix: false,
    canApproveFix: false,
    canRelaunch: false,
    showEmptyState: true,
  },
  DISAPPROVED_DETECTED: {
    canGenerateFix: true,
    canApproveFix: false,
    canRelaunch: false,
    showEmptyState: false,
  },
  FIX_GENERATED: {
    canGenerateFix: false,
    canApproveFix: true,
    canRelaunch: false,
    showEmptyState: false,
  },
  USER_APPROVED: {
    canGenerateFix: false,
    canApproveFix: false,
    canRelaunch: true,
    showEmptyState: false,
  },
  RELAUNCHED: {
    canGenerateFix: false,
    canApproveFix: false,
    canRelaunch: false,
    showEmptyState: false,
  },
};

// ============================================
// GLOBAL APP STATE
// ============================================

/**
 * App States:
 * APP_INIT → READY
 */
export type AppState = 'APP_INIT' | 'READY';

// ============================================
// STATE VALIDATION HELPERS
// ============================================

export interface StateBlocker {
  blocked: boolean;
  message: string;
}

export function validatePublishRequirements(
  readyAssetCount: number,
  connectedAccountCount: number,
  launchableAccountCount: number
): StateBlocker {
  if (readyAssetCount === 0) {
    return {
      blocked: true,
      message: 'No assets ready for launch. Mark at least one approved asset as "Ready for Launch".',
    };
  }
  
  if (connectedAccountCount === 0) {
    return {
      blocked: true,
      message: 'No ad accounts connected. Connect at least one ad account.',
    };
  }
  
  if (launchableAccountCount === 0) {
    return {
      blocked: true,
      message: 'No accounts with launch permission. Check account permissions.',
    };
  }
  
  return { blocked: false, message: '' };
}

export function validateAssetTransition(current: AssetState, next: AssetState): boolean {
  const validTransitions: Record<AssetState, AssetState[]> = {
    UPLOADED: ['ANALYZING'],
    ANALYZING: ['APPROVED', 'BLOCKED'],
    APPROVED: ['READY_FOR_LAUNCH', 'ANALYZING'], // Can re-analyze
    READY_FOR_LAUNCH: ['APPROVED'], // Can unmark
    BLOCKED: ['ANALYZING'], // Can re-analyze
  };
  
  return validTransitions[current]?.includes(next) ?? false;
}
