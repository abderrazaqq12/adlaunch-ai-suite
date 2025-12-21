/**
 * AUTOMATION SAFETY v2 - Hard Safety Rules (NON-NEGOTIABLE)
 * 
 * This module implements fail-closed safety mechanisms for all automation actions.
 * Default to SKIP if uncertain. Never fail OPEN.
 */

// ============================================================================
// GLOBAL CONSTANTS (NON-NEGOTIABLE)
// ============================================================================

/** Maximum automation actions per campaign per day */
export const MAX_ACTIONS_PER_CAMPAIGN_PER_DAY = 3;

/** Maximum budget increase per day (as percentage) */
export const MAX_BUDGET_INCREASE_PER_DAY_PERCENT = 20;

/** Action-specific cooldowns in MINUTES */
export const ACTION_COOLDOWNS: Record<string, number> = {
  PAUSE_CAMPAIGN: 180,      // 3 hours
  RESUME_CAMPAIGN: 180,     // 3 hours (NEVER auto-enable, but if manual)
  ROTATE_CREATIVE: 60,      // 1 hour
  STOP_PLATFORM: 360,       // 6 hours
  INCREASE_BUDGET: 180,     // 3 hours
  DECREASE_BUDGET: 120,     // 2 hours
  PAUSE_AD: 60,             // 1 hour
  PAUSE_ADSET: 90,          // 1.5 hours
  DEFAULT: 60,              // Fallback: 1 hour
};

/** Campaign states that block ALL automation */
export const BLOCKED_CAMPAIGN_STATES = [
  'RECOVERY',
  'USER_PAUSED',
  'STOPPED',
  'DISAPPROVED',
] as const;

/** Actions that are NEVER allowed by automation (require manual intervention) */
export const FORBIDDEN_AUTOMATION_ACTIONS = [
  'ENABLE_PAUSED_CAMPAIGN',   // NEVER auto-enable paused campaigns
  'RESUME_USER_PAUSED',       // NEVER resume user-paused campaigns
] as const;

/** Actions forbidden in RECOVERY state */
export const RECOVERY_FORBIDDEN_ACTIONS = [
  'INCREASE_BUDGET',
  'SCALE_UP',
  'RESUME_CAMPAIGN',
] as const;

/** Minimum data requirements before automation can act */
export const DATA_FLOOR = {
  MIN_MINUTES_SINCE_FIRST_SPEND: 60,
  MIN_IMPRESSIONS: 1000,
} as const;

// ============================================================================
// TYPES
// ============================================================================

export interface SafetyGuardResult {
  allowed: boolean;
  reason?: string;
  skipReason?: SkipReason;
}

export type SkipReason = 
  | 'INSUFFICIENT_DATA'
  | 'CAMPAIGN_IN_BLOCKED_STATE'
  | 'USER_PAUSED'
  | 'RECOVERY_STATE'
  | 'COOLDOWN_ACTIVE'
  | 'DAILY_LIMIT_EXCEEDED'
  | 'BUDGET_LIMIT_EXCEEDED'
  | 'FORBIDDEN_ACTION'
  | 'ACCOUNT_PERMISSION_DENIED'
  | 'KILL_SWITCH_ACTIVE'
  | 'SINGLE_ACTION_RULE';

export interface CampaignSafetyContext {
  id: string;
  state: string;
  pausedByUser: boolean;
  firstSpendTimestamp?: number | null;
  impressions?: number;
  actionsToday: number;
  budgetIncreasedTodayPercent: number;
  lastActionTimestamp?: number | null;
  lastActionType?: string | null;
}

export interface AdAccountSafetyContext {
  id: string;
  state: string;
  permission: 'READ_ONLY' | 'LIMITED_PERMISSION' | 'FULL_ACCESS';
}

export interface RuleSafetyContext {
  id: string;
  state: string;
  actionType: string;
  cooldownMinutes?: number;
  lastTriggeredAt?: number | null;
}

export interface SafetyEvaluationInput {
  campaign: CampaignSafetyContext;
  adAccount: AdAccountSafetyContext;
  rule: RuleSafetyContext;
  actionType: string;
  actionValue?: number; // For budget changes, the percentage
}

export interface GlobalSafetyConfig {
  automationEnabled: boolean; // KILL SWITCH
  maxActionsPerCampaignPerDay: number;
  maxBudgetIncreasePerDayPercent: number;
}

// ============================================================================
// NORMALIZED EVENT TYPES FOR AUTOMATION
// ============================================================================

export type AutomationEventType =
  | 'AUTOMATION_TRIGGERED'
  | 'AUTOMATION_SKIPPED'
  | 'AUTOMATION_ACTION_EXECUTED'
  | 'AUTOMATION_BLOCKED'
  | 'AUTOMATION_COOLDOWN_STARTED'
  | 'STATE_GUARD_BLOCKED';

export interface AutomationEvent {
  eventId: string;
  eventType: AutomationEventType;
  source: 'AUTOMATION';
  entityType: 'CAMPAIGN' | 'RULE';
  entityId: string;
  previousState?: string;
  newState?: string;
  action?: string;
  reason?: string;
  metadata?: {
    ruleId?: string;
    campaignId?: string;
    actionType?: string;
    skipReason?: SkipReason;
    guardName?: string;
    [key: string]: unknown;
  };
  timestamp: string;
}

// ============================================================================
// PURE GUARD FUNCTIONS (No Side Effects)
// ============================================================================

/**
 * KILL SWITCH CHECK
 * If global automation is disabled, log intent only - do not execute
 */
export function guardKillSwitch(config: GlobalSafetyConfig): SafetyGuardResult {
  if (!config.automationEnabled) {
    return {
      allowed: false,
      reason: 'Global automation kill switch is ACTIVE. Actions are logged but not executed.',
      skipReason: 'KILL_SWITCH_ACTIVE',
    };
  }
  return { allowed: true };
}

/**
 * DATA FLOOR CHECK
 * Automation rules require minimum data before execution
 * - min 60 minutes since first spend OR
 * - min 1000 impressions
 */
export function guardDataFloor(campaign: CampaignSafetyContext): SafetyGuardResult {
  const now = Date.now();
  const firstSpend = campaign.firstSpendTimestamp || now;
  
  // Time-based floor: 60 minutes since first spend
  const minutesSinceFirstSpend = (now - firstSpend) / 1000 / 60;
  if (minutesSinceFirstSpend >= DATA_FLOOR.MIN_MINUTES_SINCE_FIRST_SPEND) {
    return { allowed: true };
  }
  
  // Impression-based floor: 1000 impressions
  const impressions = campaign.impressions || 0;
  if (impressions >= DATA_FLOOR.MIN_IMPRESSIONS) {
    return { allowed: true };
  }
  
  return {
    allowed: false,
    reason: `Insufficient data: ${Math.floor(minutesSinceFirstSpend)}/${DATA_FLOOR.MIN_MINUTES_SINCE_FIRST_SPEND} minutes, ${impressions}/${DATA_FLOOR.MIN_IMPRESSIONS} impressions`,
    skipReason: 'INSUFFICIENT_DATA',
  };
}

/**
 * CAMPAIGN STATE CHECK
 * Automation MUST NOT execute if campaign is in blocked state
 */
export function guardCampaignState(campaign: CampaignSafetyContext): SafetyGuardResult {
  // Check blocked states
  if (BLOCKED_CAMPAIGN_STATES.includes(campaign.state as typeof BLOCKED_CAMPAIGN_STATES[number])) {
    const skipReason: SkipReason = campaign.state === 'RECOVERY' 
      ? 'RECOVERY_STATE' 
      : campaign.state === 'USER_PAUSED' 
        ? 'USER_PAUSED' 
        : 'CAMPAIGN_IN_BLOCKED_STATE';
    
    return {
      allowed: false,
      reason: `Campaign in ${campaign.state} state blocks automation`,
      skipReason,
    };
  }
  
  // Explicit user-paused check
  if (campaign.pausedByUser) {
    return {
      allowed: false,
      reason: 'Campaign was paused by user - automation cannot modify',
      skipReason: 'USER_PAUSED',
    };
  }
  
  return { allowed: true };
}

/**
 * FORBIDDEN ACTION CHECK
 * Certain actions are NEVER allowed by automation
 */
export function guardForbiddenAction(actionType: string, campaign: CampaignSafetyContext): SafetyGuardResult {
  // Never auto-enable paused campaigns
  if (
    FORBIDDEN_AUTOMATION_ACTIONS.includes(actionType as typeof FORBIDDEN_AUTOMATION_ACTIONS[number])
  ) {
    return {
      allowed: false,
      reason: `Action ${actionType} is forbidden for automation`,
      skipReason: 'FORBIDDEN_ACTION',
    };
  }
  
  // Never auto-resume user-paused campaigns
  if (
    (actionType === 'RESUME_CAMPAIGN' || actionType === 'ENABLE_CAMPAIGN') &&
    campaign.pausedByUser
  ) {
    return {
      allowed: false,
      reason: 'Cannot auto-resume user-paused campaigns',
      skipReason: 'FORBIDDEN_ACTION',
    };
  }
  
  // Never increase budget in RECOVERY state
  if (
    campaign.state === 'RECOVERY' &&
    RECOVERY_FORBIDDEN_ACTIONS.includes(actionType as typeof RECOVERY_FORBIDDEN_ACTIONS[number])
  ) {
    return {
      allowed: false,
      reason: `Action ${actionType} is forbidden during RECOVERY state`,
      skipReason: 'RECOVERY_STATE',
    };
  }
  
  return { allowed: true };
}

/**
 * AD ACCOUNT PERMISSION CHECK
 * Automation requires FULL_ACCESS permission
 */
export function guardAccountPermission(adAccount: AdAccountSafetyContext): SafetyGuardResult {
  if (adAccount.permission !== 'FULL_ACCESS') {
    return {
      allowed: false,
      reason: `Ad account permission is ${adAccount.permission}, requires FULL_ACCESS`,
      skipReason: 'ACCOUNT_PERMISSION_DENIED',
    };
  }
  return { allowed: true };
}

/**
 * COOLDOWN CHECK
 * Action-specific cooldown periods
 */
export function guardCooldown(rule: RuleSafetyContext, actionType: string): SafetyGuardResult {
  if (!rule.lastTriggeredAt) {
    return { allowed: true };
  }
  
  const cooldownMinutes = rule.cooldownMinutes || ACTION_COOLDOWNS[actionType] || ACTION_COOLDOWNS.DEFAULT;
  const cooldownMs = cooldownMinutes * 60 * 1000;
  const cooldownEndsAt = rule.lastTriggeredAt + cooldownMs;
  const now = Date.now();
  
  if (now < cooldownEndsAt) {
    const remainingMs = cooldownEndsAt - now;
    const remainingMins = Math.ceil(remainingMs / 60000);
    return {
      allowed: false,
      reason: `Action in cooldown. ${remainingMins} minute(s) remaining (${actionType}: ${cooldownMinutes}min cooldown)`,
      skipReason: 'COOLDOWN_ACTIVE',
    };
  }
  
  return { allowed: true };
}

/**
 * DAILY ACTION LIMIT CHECK
 * Max automation actions per campaign per day = 3
 */
export function guardDailyLimit(
  campaign: CampaignSafetyContext,
  config: GlobalSafetyConfig = { automationEnabled: true, maxActionsPerCampaignPerDay: MAX_ACTIONS_PER_CAMPAIGN_PER_DAY, maxBudgetIncreasePerDayPercent: MAX_BUDGET_INCREASE_PER_DAY_PERCENT }
): SafetyGuardResult {
  const maxActions = config.maxActionsPerCampaignPerDay;
  
  if (campaign.actionsToday >= maxActions) {
    return {
      allowed: false,
      reason: `Daily action limit reached (${campaign.actionsToday}/${maxActions} per campaign)`,
      skipReason: 'DAILY_LIMIT_EXCEEDED',
    };
  }
  
  return { allowed: true };
}

/**
 * BUDGET INCREASE LIMIT CHECK
 * Max budget increase per day = 20%
 */
export function guardBudgetIncrease(
  campaign: CampaignSafetyContext,
  actionType: string,
  actionValue: number = 0,
  config: GlobalSafetyConfig = { automationEnabled: true, maxActionsPerCampaignPerDay: MAX_ACTIONS_PER_CAMPAIGN_PER_DAY, maxBudgetIncreasePerDayPercent: MAX_BUDGET_INCREASE_PER_DAY_PERCENT }
): SafetyGuardResult {
  if (actionType !== 'INCREASE_BUDGET') {
    return { allowed: true };
  }
  
  const maxIncrease = config.maxBudgetIncreasePerDayPercent;
  const totalAfterAction = campaign.budgetIncreasedTodayPercent + actionValue;
  
  if (totalAfterAction > maxIncrease) {
    return {
      allowed: false,
      reason: `Budget increase would exceed daily limit (${campaign.budgetIncreasedTodayPercent}% already, +${actionValue}% requested, max ${maxIncrease}%)`,
      skipReason: 'BUDGET_LIMIT_EXCEEDED',
    };
  }
  
  return { allowed: true };
}

// ============================================================================
// COMPOSITE SAFETY EVALUATOR
// ============================================================================

/**
 * Full automation safety evaluation
 * Runs ALL guards in order - fails closed on first failure
 */
export function evaluateAutomationSafety(
  input: SafetyEvaluationInput,
  config: GlobalSafetyConfig = { 
    automationEnabled: true, 
    maxActionsPerCampaignPerDay: MAX_ACTIONS_PER_CAMPAIGN_PER_DAY, 
    maxBudgetIncreasePerDayPercent: MAX_BUDGET_INCREASE_PER_DAY_PERCENT 
  }
): SafetyGuardResult {
  // 1. KILL SWITCH (highest priority)
  const killSwitchResult = guardKillSwitch(config);
  if (!killSwitchResult.allowed) return killSwitchResult;
  
  // 2. DATA FLOOR
  const dataFloorResult = guardDataFloor(input.campaign);
  if (!dataFloorResult.allowed) return dataFloorResult;
  
  // 3. CAMPAIGN STATE
  const campaignStateResult = guardCampaignState(input.campaign);
  if (!campaignStateResult.allowed) return campaignStateResult;
  
  // 4. FORBIDDEN ACTION
  const forbiddenActionResult = guardForbiddenAction(input.actionType, input.campaign);
  if (!forbiddenActionResult.allowed) return forbiddenActionResult;
  
  // 5. AD ACCOUNT PERMISSION
  const accountPermissionResult = guardAccountPermission(input.adAccount);
  if (!accountPermissionResult.allowed) return accountPermissionResult;
  
  // 6. COOLDOWN
  const cooldownResult = guardCooldown(input.rule, input.actionType);
  if (!cooldownResult.allowed) return cooldownResult;
  
  // 7. DAILY ACTION LIMIT
  const dailyLimitResult = guardDailyLimit(input.campaign, config);
  if (!dailyLimitResult.allowed) return dailyLimitResult;
  
  // 8. BUDGET INCREASE LIMIT
  const budgetLimitResult = guardBudgetIncrease(
    input.campaign, 
    input.actionType, 
    input.actionValue || 0, 
    config
  );
  if (!budgetLimitResult.allowed) return budgetLimitResult;
  
  // All guards passed
  return { allowed: true };
}

// ============================================================================
// SINGLE ACTION RULE ENFORCER
// ============================================================================

/**
 * Tracks which campaigns have already had an action this evaluation cycle
 * Used to enforce: Only ONE automation action per campaign per evaluation cycle
 */
export class SingleActionEnforcer {
  private executedCampaigns: Set<string> = new Set();
  
  /**
   * Check if campaign can receive an action this cycle
   */
  canExecute(campaignId: string): SafetyGuardResult {
    if (this.executedCampaigns.has(campaignId)) {
      return {
        allowed: false,
        reason: 'Campaign already received an action this evaluation cycle (single action rule)',
        skipReason: 'SINGLE_ACTION_RULE',
      };
    }
    return { allowed: true };
  }
  
  /**
   * Mark campaign as having received an action
   */
  markExecuted(campaignId: string): void {
    this.executedCampaigns.add(campaignId);
  }
  
  /**
   * Reset for next evaluation cycle
   */
  reset(): void {
    this.executedCampaigns.clear();
  }
  
  /**
   * Get all campaigns that received actions
   */
  getExecutedCampaigns(): string[] {
    return Array.from(this.executedCampaigns);
  }
}

// ============================================================================
// EVENT CREATION HELPERS
// ============================================================================

export function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function createAutomationSkippedEvent(
  campaignId: string,
  ruleId: string,
  actionType: string,
  skipReason: SkipReason,
  reason: string
): AutomationEvent {
  return {
    eventId: generateEventId(),
    eventType: 'AUTOMATION_SKIPPED',
    source: 'AUTOMATION',
    entityType: 'CAMPAIGN',
    entityId: campaignId,
    action: actionType,
    reason,
    metadata: {
      ruleId,
      campaignId,
      actionType,
      skipReason,
    },
    timestamp: new Date().toISOString(),
  };
}

export function createAutomationExecutedEvent(
  campaignId: string,
  ruleId: string,
  actionType: string,
  previousState?: string,
  newState?: string
): AutomationEvent {
  return {
    eventId: generateEventId(),
    eventType: 'AUTOMATION_ACTION_EXECUTED',
    source: 'AUTOMATION',
    entityType: 'CAMPAIGN',
    entityId: campaignId,
    previousState,
    newState,
    action: actionType,
    reason: `Rule ${ruleId} executed ${actionType}`,
    metadata: {
      ruleId,
      campaignId,
      actionType,
    },
    timestamp: new Date().toISOString(),
  };
}

export function createAutomationBlockedEvent(
  campaignId: string,
  ruleId: string,
  actionType: string,
  skipReason: SkipReason,
  reason: string,
  guardName: string
): AutomationEvent {
  return {
    eventId: generateEventId(),
    eventType: 'AUTOMATION_BLOCKED',
    source: 'AUTOMATION',
    entityType: 'CAMPAIGN',
    entityId: campaignId,
    action: actionType,
    reason,
    metadata: {
      ruleId,
      campaignId,
      actionType,
      skipReason,
      guardName,
    },
    timestamp: new Date().toISOString(),
  };
}
