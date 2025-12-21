/**
 * Frontend Guards - Mirror of Backend Guards
 * 
 * These guards provide client-side validation to:
 * 1. Prevent invalid actions from being attempted
 * 2. Disable UI controls for blocked transitions
 * 3. Show appropriate error messages before API calls
 * 
 * IMPORTANT: These are for UX only - backend guards are authoritative.
 */

import type { Platform } from '@/types';

// ============================================================================
// TYPES
// ============================================================================

export interface GuardResult {
  allowed: boolean;
  reason?: string;
  severity?: 'error' | 'warning' | 'info';
}

// ============================================================================
// BUDGET GUARDS
// ============================================================================

/**
 * Platform minimum daily budgets in USD
 * Based on platform requirements
 */
export const PLATFORM_MINIMUM_BUDGETS: Record<Platform, number> = {
  google: 5,
  tiktok: 20,
  snapchat: 20,
};

/**
 * Absolute minimum budget (applies to all platforms)
 */
export const ABSOLUTE_MINIMUM_BUDGET = 1;

/**
 * Maximum daily budget (sanity check)
 */
export const MAXIMUM_DAILY_BUDGET = 1000000;

export interface BudgetGuardInput {
  dailyBudget: number;
  selectedPlatforms: Platform[];
}

/**
 * Guard: Budget must be positive and meet platform minimums
 */
export function guardBudget(input: BudgetGuardInput): GuardResult {
  const { dailyBudget, selectedPlatforms } = input;

  // Check for zero/negative
  if (dailyBudget <= 0) {
    return {
      allowed: false,
      reason: 'Budget must be greater than zero',
      severity: 'error',
    };
  }

  // Check absolute minimum
  if (dailyBudget < ABSOLUTE_MINIMUM_BUDGET) {
    return {
      allowed: false,
      reason: `Minimum budget is $${ABSOLUTE_MINIMUM_BUDGET}`,
      severity: 'error',
    };
  }

  // Check maximum
  if (dailyBudget > MAXIMUM_DAILY_BUDGET) {
    return {
      allowed: false,
      reason: `Maximum budget is $${MAXIMUM_DAILY_BUDGET.toLocaleString()}`,
      severity: 'error',
    };
  }

  // Check platform minimums
  for (const platform of selectedPlatforms) {
    const minimum = PLATFORM_MINIMUM_BUDGETS[platform];
    if (dailyBudget < minimum) {
      return {
        allowed: false,
        reason: `${platform.charAt(0).toUpperCase() + platform.slice(1)} Ads requires minimum $${minimum}/day budget`,
        severity: 'error',
      };
    }
  }

  // Budget is valid but check for warnings
  const maxMinimum = Math.max(...selectedPlatforms.map(p => PLATFORM_MINIMUM_BUDGETS[p]));
  if (dailyBudget < maxMinimum * 2) {
    return {
      allowed: true,
      reason: `Low budget may limit campaign reach. Consider $${maxMinimum * 2}+/day for better results.`,
      severity: 'warning',
    };
  }

  return { allowed: true };
}

/**
 * Get minimum required budget for selected platforms
 */
export function getMinimumBudget(selectedPlatforms: Platform[]): number {
  if (selectedPlatforms.length === 0) return ABSOLUTE_MINIMUM_BUDGET;
  return Math.max(...selectedPlatforms.map(p => PLATFORM_MINIMUM_BUDGETS[p]));
}

// ============================================================================
// ASSET GUARDS
// ============================================================================

export interface AssetGuardInput {
  state: string;
  riskScore?: number | null;
  platformCompatibility?: string[];
}

/**
 * Risk score threshold for approval
 */
export const ASSET_RISK_THRESHOLD = 50;

/**
 * Guard: Asset can be marked ready for launch
 */
export function guardAssetReadyForLaunch(
  asset: AssetGuardInput,
  targetPlatform?: string
): GuardResult {
  // Must be APPROVED
  if (asset.state !== 'APPROVED') {
    return {
      allowed: false,
      reason: `Asset must be APPROVED first. Current: ${asset.state}`,
      severity: 'error',
    };
  }

  // Risk score check
  if (asset.riskScore !== null && asset.riskScore !== undefined) {
    if (asset.riskScore > ASSET_RISK_THRESHOLD) {
      return {
        allowed: false,
        reason: `Risk score (${asset.riskScore}%) exceeds threshold (${ASSET_RISK_THRESHOLD}%)`,
        severity: 'error',
      };
    }
  }

  // Platform compatibility
  if (targetPlatform && asset.platformCompatibility) {
    const upperPlatform = targetPlatform.toUpperCase();
    if (!asset.platformCompatibility.includes(upperPlatform)) {
      return {
        allowed: false,
        reason: `Asset not compatible with ${targetPlatform}`,
        severity: 'error',
      };
    }
  }

  return { allowed: true };
}

// ============================================================================
// CAMPAIGN PUBLISH GUARDS
// ============================================================================

export interface CampaignPublishGuardInput {
  assets: Array<{
    id: string;
    state: string;
    riskScore?: number | null;
  }>;
  accounts: Array<{
    id: string;
    permissions: { canLaunch: boolean };
    platform: Platform;
  }>;
  audience: {
    countries: string[];
    languages: string[];
  };
  campaignName: string;
  landingPageUrl: string;
  dailyBudget: number;
  selectedPlatforms: Platform[];
}

/**
 * Guard: Full campaign publish validation
 */
export function guardCampaignPublish(input: CampaignPublishGuardInput): GuardResult {
  const {
    assets,
    accounts,
    audience,
    campaignName,
    landingPageUrl,
    dailyBudget,
    selectedPlatforms,
  } = input;

  // Guard 1: At least 1 READY_FOR_LAUNCH asset
  const readyAssets = assets.filter(a => a.state === 'READY_FOR_LAUNCH');
  if (readyAssets.length === 0) {
    return {
      allowed: false,
      reason: 'Select at least one asset marked "Ready for Launch"',
      severity: 'error',
    };
  }

  // Guard 2: At least 1 platform selected
  if (selectedPlatforms.length === 0) {
    return {
      allowed: false,
      reason: 'Select at least one platform',
      severity: 'error',
    };
  }

  // Guard 3: All selected accounts must have launch permission
  const accountsWithoutLaunch = accounts.filter(a => !a.permissions.canLaunch);
  if (accountsWithoutLaunch.length > 0) {
    return {
      allowed: false,
      reason: `${accountsWithoutLaunch.length} account(s) missing launch permission`,
      severity: 'error',
    };
  }

  // Guard 4: Audience validation
  if (audience.countries.length === 0) {
    return {
      allowed: false,
      reason: 'Select at least one target country',
      severity: 'error',
    };
  }

  if (audience.languages.length === 0) {
    return {
      allowed: false,
      reason: 'Select at least one target language',
      severity: 'error',
    };
  }

  // Guard 5: Campaign name required
  if (!campaignName.trim()) {
    return {
      allowed: false,
      reason: 'Campaign name is required',
      severity: 'error',
    };
  }

  // Guard 6: Landing page URL required
  if (!landingPageUrl.trim()) {
    return {
      allowed: false,
      reason: 'Landing page URL is required',
      severity: 'error',
    };
  }

  // Guard 7: Budget validation
  const budgetGuard = guardBudget({ dailyBudget, selectedPlatforms });
  if (!budgetGuard.allowed) {
    return budgetGuard;
  }

  // All guards passed
  if (budgetGuard.severity === 'warning') {
    return budgetGuard; // Pass with warning
  }

  return { allowed: true };
}

// ============================================================================
// AUTOMATION GUARDS (Read-only for UI display)
// ============================================================================

/**
 * Campaign states that block automation actions
 */
export const BLOCKED_CAMPAIGN_STATES = [
  'RECOVERY',
  'USER_PAUSED',
  'STOPPED',
  'DISAPPROVED',
] as const;

/**
 * Check if campaign state blocks automation
 */
export function isCampaignStateBlocked(state: string): boolean {
  return BLOCKED_CAMPAIGN_STATES.includes(state as typeof BLOCKED_CAMPAIGN_STATES[number]);
}

/**
 * Actions that are never allowed by automation
 */
export const FORBIDDEN_AUTOMATION_ACTIONS = [
  'ENABLE_PAUSED_CAMPAIGN',
  'RESUME_USER_PAUSED',
] as const;

/**
 * Check if action is forbidden for automation
 */
export function isAutomationActionForbidden(action: string): boolean {
  return FORBIDDEN_AUTOMATION_ACTIONS.includes(action as typeof FORBIDDEN_AUTOMATION_ACTIONS[number]);
}

// ============================================================================
// AD ACCOUNT GUARDS
// ============================================================================

export interface AdAccountGuardInput {
  state: string;
  permissions: {
    canAnalyze: boolean;
    canLaunch: boolean;
    canOptimize: boolean;
  };
}

/**
 * Guard: Account can be used for launching
 */
export function guardAccountForLaunch(account: AdAccountGuardInput): GuardResult {
  if (!account.permissions.canLaunch) {
    return {
      allowed: false,
      reason: 'Account missing launch permission',
      severity: 'error',
    };
  }

  if (account.state === 'disconnected' || account.state === 'DISCONNECTED') {
    return {
      allowed: false,
      reason: 'Account is disconnected',
      severity: 'error',
    };
  }

  return { allowed: true };
}

/**
 * Guard: Account can be used for automation
 */
export function guardAccountForAutomation(account: AdAccountGuardInput): GuardResult {
  // Automation requires full access (canOptimize)
  if (!account.permissions.canOptimize) {
    return {
      allowed: false,
      reason: 'Account missing optimization permission. Automation requires full access.',
      severity: 'error',
    };
  }

  return { allowed: true };
}

// ============================================================================
// COMPOSITE VALIDATION
// ============================================================================

/**
 * Collect all blockers for publish flow
 */
export interface PublishBlocker {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export function collectPublishBlockers(input: CampaignPublishGuardInput): PublishBlocker[] {
  const blockers: PublishBlocker[] = [];

  // Asset blockers
  const readyAssets = input.assets.filter(a => a.state === 'READY_FOR_LAUNCH');
  if (readyAssets.length === 0) {
    blockers.push({
      field: 'assets',
      message: 'No assets marked "Ready for Launch"',
      severity: 'error',
    });
  }

  // Platform blockers
  if (input.selectedPlatforms.length === 0) {
    blockers.push({
      field: 'platforms',
      message: 'No platforms selected',
      severity: 'error',
    });
  }

  // Account blockers
  const accountsWithoutLaunch = input.accounts.filter(a => !a.permissions.canLaunch);
  if (accountsWithoutLaunch.length > 0) {
    blockers.push({
      field: 'accounts',
      message: `${accountsWithoutLaunch.length} account(s) missing launch permission`,
      severity: 'error',
    });
  }

  // Audience blockers
  if (input.audience.countries.length === 0) {
    blockers.push({
      field: 'countries',
      message: 'No target countries selected',
      severity: 'error',
    });
  }

  if (input.audience.languages.length === 0) {
    blockers.push({
      field: 'languages',
      message: 'No target languages selected',
      severity: 'error',
    });
  }

  // Campaign details blockers
  if (!input.campaignName.trim()) {
    blockers.push({
      field: 'campaignName',
      message: 'Campaign name required',
      severity: 'error',
    });
  }

  if (!input.landingPageUrl.trim()) {
    blockers.push({
      field: 'landingPageUrl',
      message: 'Landing page URL required',
      severity: 'error',
    });
  }

  // Budget blockers
  const budgetGuard = guardBudget({
    dailyBudget: input.dailyBudget,
    selectedPlatforms: input.selectedPlatforms,
  });
  
  if (!budgetGuard.allowed) {
    blockers.push({
      field: 'budget',
      message: budgetGuard.reason || 'Invalid budget',
      severity: 'error',
    });
  } else if (budgetGuard.severity === 'warning') {
    blockers.push({
      field: 'budget',
      message: budgetGuard.reason || 'Budget warning',
      severity: 'warning',
    });
  }

  return blockers;
}
