import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * AUTOMATION SAFETY v2 - State Machine + Hard Safety Rules
 * 
 * GLOBAL LIMITS (NON-NEGOTIABLE):
 * - Max automation actions per campaign per day = 3
 * - Max budget increase per day = 20%
 * - NEVER auto-enable paused campaigns
 * - NEVER increase budgets in Recovery state
 * 
 * COOLDOWNS (Action-Specific):
 * - PAUSE_CAMPAIGN: 180 minutes
 * - ROTATE_CREATIVE: 60 minutes
 * - STOP_PLATFORM: 360 minutes
 * 
 * STATE AWARENESS:
 * - campaign.state === "RECOVERY" → BLOCK
 * - campaign.pausedByUser === true → BLOCK
 * - adAccount.permission !== "FULL_ACCESS" → BLOCK
 * 
 * DATA FLOOR:
 * - min 60 minutes since first spend OR min 1000 impressions
 * 
 * SINGLE ACTION RULE:
 * - Only ONE automation action per campaign per evaluation cycle
 * 
 * KILL SWITCH:
 * - Global flag: automationEnabled
 * - If false → log intent only, no execution
 */

// ============================================================================
// SAFETY CONSTANTS (NON-NEGOTIABLE)
// ============================================================================

const MAX_ACTIONS_PER_CAMPAIGN_PER_DAY = 3;
const MAX_BUDGET_INCREASE_PER_DAY_PERCENT = 20;

const ACTION_COOLDOWNS: Record<string, number> = {
  PAUSE_CAMPAIGN: 180,
  RESUME_CAMPAIGN: 180,
  ROTATE_CREATIVE: 60,
  STOP_PLATFORM: 360,
  INCREASE_BUDGET: 180,
  DECREASE_BUDGET: 120,
  PAUSE_AD: 60,
  PAUSE_ADSET: 90,
  DEFAULT: 60,
};

const BLOCKED_CAMPAIGN_STATES = ['RECOVERY', 'USER_PAUSED', 'STOPPED', 'DISAPPROVED'];

const FORBIDDEN_AUTOMATION_ACTIONS = ['ENABLE_PAUSED_CAMPAIGN', 'RESUME_USER_PAUSED'];

const RECOVERY_FORBIDDEN_ACTIONS = ['INCREASE_BUDGET', 'SCALE_UP', 'RESUME_CAMPAIGN'];

const DATA_FLOOR = {
  MIN_MINUTES_SINCE_FIRST_SPEND: 60,
  MIN_IMPRESSIONS: 1000,
};

// ============================================================================
// TYPES
// ============================================================================

type RuleState = 'DISABLED' | 'ACTIVE' | 'COOLDOWN' | 'ERROR';
type RuleScope = 'CAMPAIGN' | 'ADSET' | 'AD';
type RuleAction = 'ENABLE' | 'DISABLE' | 'EDIT' | 'DELETE' | 'RESET_COOLDOWN' | 'EXECUTE';
type SkipReason = 
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

interface SafetyGuardResult {
  allowed: boolean;
  reason?: string;
  skipReason?: SkipReason;
  guardName?: string;
}

interface GlobalSafetyConfig {
  automationEnabled: boolean;
  maxActionsPerCampaignPerDay: number;
  maxBudgetIncreasePerDayPercent: number;
}

// GLOBAL SAFETY CONFIG (KILL SWITCH)
const GLOBAL_CONFIG: GlobalSafetyConfig = {
  automationEnabled: true, // KILL SWITCH - set to false to disable all automation
  maxActionsPerCampaignPerDay: MAX_ACTIONS_PER_CAMPAIGN_PER_DAY,
  maxBudgetIncreasePerDayPercent: MAX_BUDGET_INCREASE_PER_DAY_PERCENT,
};

// ============================================================================
// PURE GUARD FUNCTIONS (NO SIDE EFFECTS)
// ============================================================================

function guardKillSwitch(): SafetyGuardResult {
  if (!GLOBAL_CONFIG.automationEnabled) {
    return {
      allowed: false,
      reason: 'Global automation kill switch is ACTIVE. Actions are logged but not executed.',
      skipReason: 'KILL_SWITCH_ACTIVE',
      guardName: 'guardKillSwitch',
    };
  }
  return { allowed: true };
}

function guardDataFloor(campaign: any): SafetyGuardResult {
  const now = Date.now();
  const firstSpend = campaign.firstSpendTimestamp || now;
  const minutesSinceFirstSpend = (now - firstSpend) / 1000 / 60;
  
  if (minutesSinceFirstSpend >= DATA_FLOOR.MIN_MINUTES_SINCE_FIRST_SPEND) {
    return { allowed: true };
  }
  
  const impressions = campaign.impressions || 0;
  if (impressions >= DATA_FLOOR.MIN_IMPRESSIONS) {
    return { allowed: true };
  }
  
  return {
    allowed: false,
    reason: `Insufficient data: ${Math.floor(minutesSinceFirstSpend)}/${DATA_FLOOR.MIN_MINUTES_SINCE_FIRST_SPEND} minutes, ${impressions}/${DATA_FLOOR.MIN_IMPRESSIONS} impressions`,
    skipReason: 'INSUFFICIENT_DATA',
    guardName: 'guardDataFloor',
  };
}

function guardCampaignState(campaign: any): SafetyGuardResult {
  if (BLOCKED_CAMPAIGN_STATES.includes(campaign.state)) {
    const skipReason: SkipReason = campaign.state === 'RECOVERY' 
      ? 'RECOVERY_STATE' 
      : campaign.state === 'USER_PAUSED' 
        ? 'USER_PAUSED' 
        : 'CAMPAIGN_IN_BLOCKED_STATE';
    
    return {
      allowed: false,
      reason: `Campaign in ${campaign.state} state blocks automation`,
      skipReason,
      guardName: 'guardCampaignState',
    };
  }
  
  if (campaign.pausedByUser) {
    return {
      allowed: false,
      reason: 'Campaign was paused by user - automation cannot modify',
      skipReason: 'USER_PAUSED',
      guardName: 'guardCampaignState',
    };
  }
  
  return { allowed: true };
}

function guardForbiddenAction(actionType: string, campaign: any): SafetyGuardResult {
  if (FORBIDDEN_AUTOMATION_ACTIONS.includes(actionType)) {
    return {
      allowed: false,
      reason: `Action ${actionType} is forbidden for automation`,
      skipReason: 'FORBIDDEN_ACTION',
      guardName: 'guardForbiddenAction',
    };
  }
  
  if (
    (actionType === 'RESUME_CAMPAIGN' || actionType === 'ENABLE_CAMPAIGN') &&
    campaign.pausedByUser
  ) {
    return {
      allowed: false,
      reason: 'Cannot auto-resume user-paused campaigns',
      skipReason: 'FORBIDDEN_ACTION',
      guardName: 'guardForbiddenAction',
    };
  }
  
  if (
    campaign.state === 'RECOVERY' &&
    RECOVERY_FORBIDDEN_ACTIONS.includes(actionType)
  ) {
    return {
      allowed: false,
      reason: `Action ${actionType} is forbidden during RECOVERY state`,
      skipReason: 'RECOVERY_STATE',
      guardName: 'guardForbiddenAction',
    };
  }
  
  return { allowed: true };
}

function guardAccountPermission(adAccount: any): SafetyGuardResult {
  if (adAccount.permission !== 'FULL_ACCESS') {
    return {
      allowed: false,
      reason: `Ad account permission is ${adAccount.permission}, requires FULL_ACCESS`,
      skipReason: 'ACCOUNT_PERMISSION_DENIED',
      guardName: 'guardAccountPermission',
    };
  }
  return { allowed: true };
}

function guardCooldown(rule: any, actionType: string): SafetyGuardResult {
  if (!rule.lastTriggeredAt) {
    return { allowed: true };
  }
  
  const cooldownMinutes = ACTION_COOLDOWNS[actionType] || ACTION_COOLDOWNS.DEFAULT;
  const lastTriggered = new Date(rule.lastTriggeredAt).getTime();
  const cooldownMs = cooldownMinutes * 60 * 1000;
  const cooldownEndsAt = lastTriggered + cooldownMs;
  const now = Date.now();
  
  if (now < cooldownEndsAt) {
    const remainingMs = cooldownEndsAt - now;
    const remainingMins = Math.ceil(remainingMs / 60000);
    return {
      allowed: false,
      reason: `Action in cooldown. ${remainingMins} minute(s) remaining (${actionType}: ${cooldownMinutes}min cooldown)`,
      skipReason: 'COOLDOWN_ACTIVE',
      guardName: 'guardCooldown',
    };
  }
  
  return { allowed: true };
}

function guardDailyLimit(campaign: any): SafetyGuardResult {
  const actionsToday = campaign.actionsToday || 0;
  const maxActions = GLOBAL_CONFIG.maxActionsPerCampaignPerDay;
  
  if (actionsToday >= maxActions) {
    return {
      allowed: false,
      reason: `Daily action limit reached (${actionsToday}/${maxActions} per campaign)`,
      skipReason: 'DAILY_LIMIT_EXCEEDED',
      guardName: 'guardDailyLimit',
    };
  }
  
  return { allowed: true };
}

function guardBudgetIncrease(campaign: any, actionType: string, actionValue: number = 0): SafetyGuardResult {
  if (actionType !== 'INCREASE_BUDGET') {
    return { allowed: true };
  }
  
  const budgetIncreasedToday = campaign.budgetIncreasedTodayPercent || 0;
  const maxIncrease = GLOBAL_CONFIG.maxBudgetIncreasePerDayPercent;
  const totalAfterAction = budgetIncreasedToday + actionValue;
  
  if (totalAfterAction > maxIncrease) {
    return {
      allowed: false,
      reason: `Budget increase would exceed daily limit (${budgetIncreasedToday}% already, +${actionValue}% requested, max ${maxIncrease}%)`,
      skipReason: 'BUDGET_LIMIT_EXCEEDED',
      guardName: 'guardBudgetIncrease',
    };
  }
  
  return { allowed: true };
}

// ============================================================================
// COMPOSITE SAFETY EVALUATOR
// ============================================================================

function evaluateFullSafety(
  campaign: any,
  adAccount: any,
  rule: any,
  actionType: string,
  actionValue?: number
): SafetyGuardResult {
  // Run all guards in strict order - fail closed on first failure
  const guards = [
    () => guardKillSwitch(),
    () => guardDataFloor(campaign),
    () => guardCampaignState(campaign),
    () => guardForbiddenAction(actionType, campaign),
    () => guardAccountPermission(adAccount),
    () => guardCooldown(rule, actionType),
    () => guardDailyLimit(campaign),
    () => guardBudgetIncrease(campaign, actionType, actionValue || 0),
  ];
  
  for (const guard of guards) {
    const result = guard();
    if (!result.allowed) {
      return result;
    }
  }
  
  return { allowed: true };
}

// ============================================================================
// SINGLE ACTION ENFORCER (per evaluation cycle)
// ============================================================================

const executedCampaignsThisCycle: Set<string> = new Set();

function checkSingleActionRule(campaignId: string): SafetyGuardResult {
  if (executedCampaignsThisCycle.has(campaignId)) {
    return {
      allowed: false,
      reason: 'Campaign already received an action this evaluation cycle (single action rule)',
      skipReason: 'SINGLE_ACTION_RULE',
      guardName: 'singleActionRule',
    };
  }
  return { allowed: true };
}

function markCampaignExecuted(campaignId: string): void {
  executedCampaignsThisCycle.add(campaignId);
}

function resetCycleEnforcer(): void {
  executedCampaignsThisCycle.clear();
}

// ============================================================================
// STATE MACHINE CONFIGURATION
// ============================================================================

interface RuleStateConfig {
  allowedActions: RuleAction[];
  canTransitionTo: RuleState[];
}

const RULE_STATE_CONFIG: Record<RuleState, RuleStateConfig> = {
  DISABLED: {
    allowedActions: ['ENABLE', 'EDIT', 'DELETE'],
    canTransitionTo: ['ACTIVE'],
  },
  ACTIVE: {
    allowedActions: ['DISABLE', 'EDIT', 'EXECUTE'],
    canTransitionTo: ['DISABLED', 'COOLDOWN', 'ERROR'],
  },
  COOLDOWN: {
    allowedActions: ['DISABLE', 'RESET_COOLDOWN'],
    canTransitionTo: ['ACTIVE', 'DISABLED'],
  },
  ERROR: {
    allowedActions: ['DISABLE', 'EDIT', 'DELETE'],
    canTransitionTo: ['DISABLED'],
  },
};

function getAllowedActions(state: RuleState): RuleAction[] {
  return RULE_STATE_CONFIG[state]?.allowedActions || [];
}

function isActionAllowed(state: RuleState, action: RuleAction): boolean {
  return getAllowedActions(state).includes(action);
}

// ============================================================================
// NORMALIZED EVENT EMISSION
// ============================================================================

type AutomationEventType = 
  | 'AUTOMATION_RULE_CREATED' | 'AUTOMATION_RULE_ENABLED' | 'AUTOMATION_RULE_DISABLED'
  | 'AUTOMATION_TRIGGERED' | 'AUTOMATION_SKIPPED' | 'AUTOMATION_ACTION_EXECUTED'
  | 'AUTOMATION_BLOCKED' | 'AUTOMATION_COOLDOWN_STARTED' | 'AUTOMATION_COOLDOWN_RESET'
  | 'STATE_GUARD_BLOCKED' | 'STATE_TRANSITION_BLOCKED';

type EventSource = 'UI' | 'AI' | 'AUTOMATION' | 'SYSTEM';

interface NormalizedEvent {
  eventId: string;
  eventType: AutomationEventType;
  source: EventSource;
  entityType: 'RULE' | 'CAMPAIGN';
  entityId: string;
  previousState?: string;
  newState?: string;
  action?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

const eventStore: NormalizedEvent[] = [];

function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function emitEvent(
  eventType: AutomationEventType,
  source: EventSource,
  entityType: 'RULE' | 'CAMPAIGN',
  entityId: string,
  options: {
    previousState?: string;
    newState?: string;
    action?: string;
    reason?: string;
    metadata?: Record<string, unknown>;
  } = {}
): NormalizedEvent {
  const event: NormalizedEvent = {
    eventId: generateEventId(),
    eventType,
    source,
    entityType,
    entityId,
    timestamp: new Date().toISOString(),
    ...options,
  };
  eventStore.unshift(event);
  console.log(`[automation] EVENT: ${eventType} | ${entityType}/${entityId} | source=${source}`);
  return event;
}

// ============================================================================
// MOCK DATA
// ============================================================================

const mockRules: Map<string, any> = new Map();
const mockCampaigns: Map<string, any> = new Map();
const mockAccounts: Map<string, any> = new Map();

// Initialize with sample data
mockRules.set('rule_1', {
  id: 'rule_1',
  name: 'Pause High CPA Ads',
  scope: 'AD',
  condition: { metric: 'cpa', operator: '>', value: 50 },
  action: { type: 'PAUSE_AD' },
  state: 'ACTIVE',
  cooldownMinutes: 60,
  lastTriggeredAt: null,
  actionsToday: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

mockRules.set('rule_2', {
  id: 'rule_2',
  name: 'Scale Winning Campaigns',
  scope: 'CAMPAIGN',
  condition: { metric: 'roas', operator: '>', value: 3 },
  action: { type: 'INCREASE_BUDGET', value: 20 },
  state: 'DISABLED',
  cooldownMinutes: 180,
  lastTriggeredAt: null,
  actionsToday: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

mockRules.set('rule_3', {
  id: 'rule_3',
  name: 'Stop Platform Bleed',
  scope: 'CAMPAIGN',
  condition: { metric: 'spend_no_result', operator: '>', value: 100 },
  action: { type: 'STOP_PLATFORM' },
  state: 'COOLDOWN',
  cooldownMinutes: 360,
  lastTriggeredAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
  cooldownEndsAt: new Date(Date.now() + 300 * 60 * 1000).toISOString(), // 5 hours remaining
  actionsToday: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

// Mock campaigns with full safety context
mockCampaigns.set('camp_1', {
  id: 'camp_1',
  name: 'Summer Sale 2024',
  state: 'ACTIVE',
  pausedByUser: false,
  firstSpendTimestamp: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
  impressions: 5000,
  actionsToday: 1,
  budgetIncreasedTodayPercent: 0,
});

mockCampaigns.set('camp_2', {
  id: 'camp_2',
  name: 'Brand Awareness Q4',
  state: 'USER_PAUSED',
  pausedByUser: true,
  firstSpendTimestamp: Date.now() - 24 * 60 * 60 * 1000, // 24 hours ago
  impressions: 50000,
  actionsToday: 0,
  budgetIncreasedTodayPercent: 0,
});

mockCampaigns.set('camp_3', {
  id: 'camp_3',
  name: 'Holiday Promo',
  state: 'RECOVERY',
  pausedByUser: false,
  firstSpendTimestamp: Date.now() - 12 * 60 * 60 * 1000,
  impressions: 20000,
  actionsToday: 2,
  budgetIncreasedTodayPercent: 15,
});

mockCampaigns.set('camp_4', {
  id: 'camp_4',
  name: 'New Launch',
  state: 'ACTIVE',
  pausedByUser: false,
  firstSpendTimestamp: Date.now() - 30 * 60 * 1000, // Only 30 minutes ago
  impressions: 500, // Below threshold
  actionsToday: 0,
  budgetIncreasedTodayPercent: 0,
});

mockCampaigns.set('camp_5', {
  id: 'camp_5',
  name: 'At Limit Campaign',
  state: 'ACTIVE',
  pausedByUser: false,
  firstSpendTimestamp: Date.now() - 5 * 60 * 60 * 1000,
  impressions: 10000,
  actionsToday: 3, // At daily limit
  budgetIncreasedTodayPercent: 18,
});

// Mock ad accounts
mockAccounts.set('acc_1', {
  id: 'acc_1',
  platform: 'GOOGLE',
  state: 'CONNECTED',
  permission: 'FULL_ACCESS',
});

mockAccounts.set('acc_2', {
  id: 'acc_2',
  platform: 'TIKTOK',
  state: 'CONNECTED',
  permission: 'LIMITED_PERMISSION',
});

mockAccounts.set('acc_3', {
  id: 'acc_3',
  platform: 'SNAPCHAT',
  state: 'CONNECTED',
  permission: 'FULL_ACCESS',
});

// ============================================================================
// REQUEST HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  
  console.log(`[automation] ${req.method} ${url.pathname}`);

  try {
    // GET /automation/config - Get global safety config
    if (req.method === 'GET' && pathParts.length === 2 && pathParts[1] === 'config') {
      return new Response(JSON.stringify({
        config: {
          ...GLOBAL_CONFIG,
          actionCooldowns: ACTION_COOLDOWNS,
          blockedCampaignStates: BLOCKED_CAMPAIGN_STATES,
          forbiddenActions: FORBIDDEN_AUTOMATION_ACTIONS,
          recoveryForbiddenActions: RECOVERY_FORBIDDEN_ACTIONS,
          dataFloor: DATA_FLOOR,
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /automation/config/kill-switch - Toggle kill switch
    if (req.method === 'POST' && pathParts.length === 3 && pathParts[1] === 'config' && pathParts[2] === 'kill-switch') {
      const body = await req.json();
      const { enabled } = body;
      
      if (typeof enabled !== 'boolean') {
        return new Response(JSON.stringify({ error: 'enabled must be boolean' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      GLOBAL_CONFIG.automationEnabled = enabled;
      
      emitEvent(
        enabled ? 'AUTOMATION_RULE_ENABLED' : 'AUTOMATION_RULE_DISABLED',
        'SYSTEM',
        'RULE',
        'GLOBAL_KILL_SWITCH',
        {
          action: enabled ? 'ENABLE' : 'DISABLE',
          reason: `Global automation ${enabled ? 'enabled' : 'disabled'}`,
        }
      );
      
      console.log(`[automation] Kill switch ${enabled ? 'DISABLED' : 'ACTIVATED'}`);
      
      return new Response(JSON.stringify({
        success: true,
        automationEnabled: GLOBAL_CONFIG.automationEnabled,
        message: enabled 
          ? 'Automation is now ENABLED' 
          : 'Automation is now DISABLED (kill switch active)',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /automation/rules - List all rules with safety info
    if (req.method === 'GET' && pathParts.length === 2 && pathParts[1] === 'rules') {
      const rules = Array.from(mockRules.values()).map(rule => ({
        id: rule.id,
        name: rule.name,
        scope: rule.scope,
        condition: rule.condition,
        action: rule.action,
        state: rule.state,
        cooldownMinutes: ACTION_COOLDOWNS[rule.action?.type] || ACTION_COOLDOWNS.DEFAULT,
        lastTriggeredAt: rule.lastTriggeredAt,
        cooldownEndsAt: rule.cooldownEndsAt,
        actionsToday: rule.actionsToday,
        allowedActions: getAllowedActions(rule.state),
        safetyConfig: {
          maxActionsPerCampaignPerDay: GLOBAL_CONFIG.maxActionsPerCampaignPerDay,
          maxBudgetIncreasePerDayPercent: GLOBAL_CONFIG.maxBudgetIncreasePerDayPercent,
          automationEnabled: GLOBAL_CONFIG.automationEnabled,
        },
      }));

      return new Response(JSON.stringify({ rules }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /automation/rules/{id} - Get single rule
    if (req.method === 'GET' && pathParts.length === 3 && pathParts[1] === 'rules') {
      const ruleId = pathParts[2];
      const rule = mockRules.get(ruleId);
      
      if (!rule) {
        return new Response(JSON.stringify({ error: 'Rule not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        ...rule,
        cooldownMinutes: ACTION_COOLDOWNS[rule.action?.type] || ACTION_COOLDOWNS.DEFAULT,
        allowedActions: getAllowedActions(rule.state),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /automation/rules - Create new rule
    if (req.method === 'POST' && pathParts.length === 2 && pathParts[1] === 'rules') {
      const body = await req.json();
      const { name, scope, condition, action } = body;

      if (!name || !scope || !condition || !action) {
        return new Response(JSON.stringify({ 
          error: 'Missing required fields: name, scope, condition, action' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!['CAMPAIGN', 'ADSET', 'AD'].includes(scope)) {
        return new Response(JSON.stringify({ 
          error: 'Invalid scope. Must be CAMPAIGN, ADSET, or AD' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const ruleId = `rule_${Date.now()}`;
      const now = new Date().toISOString();
      
      const newRule = {
        id: ruleId,
        name,
        scope,
        condition,
        action,
        state: 'DISABLED' as RuleState,
        cooldownMinutes: ACTION_COOLDOWNS[action.type] || ACTION_COOLDOWNS.DEFAULT,
        lastTriggeredAt: null,
        cooldownEndsAt: null,
        actionsToday: 0,
        createdAt: now,
        updatedAt: now,
      };
      
      mockRules.set(ruleId, newRule);
      
      emitEvent('AUTOMATION_RULE_CREATED', 'UI', 'RULE', ruleId, {
        newState: 'DISABLED',
        metadata: { name, scope, actionType: action.type },
      });

      return new Response(JSON.stringify({
        ...newRule,
        allowedActions: getAllowedActions(newRule.state),
      }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /automation/rules/{id}/execute - Execute rule with FULL SAFETY GUARDS
    if (req.method === 'POST' && pathParts.length === 4 && pathParts[1] === 'rules' && pathParts[3] === 'execute') {
      const ruleId = pathParts[2];
      const body = await req.json();
      const { campaignId, accountId } = body;

      const rule = mockRules.get(ruleId);
      if (!rule) {
        return new Response(JSON.stringify({ error: 'Rule not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const campaign = mockCampaigns.get(campaignId);
      if (!campaign) {
        return new Response(JSON.stringify({ error: 'Campaign not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const adAccount = mockAccounts.get(accountId) || mockAccounts.get('acc_1'); // Default for demo
      
      const actionType = rule.action?.type || 'UNKNOWN';
      const actionValue = rule.action?.value;

      // STATE MACHINE CHECK
      if (!isActionAllowed(rule.state, 'EXECUTE')) {
        emitEvent('STATE_TRANSITION_BLOCKED', 'SYSTEM', 'RULE', ruleId, {
          action: 'EXECUTE',
          reason: `Action not allowed in ${rule.state} state`,
        });
        return new Response(JSON.stringify({
          error: 'INVALID_TRANSITION',
          message: `Cannot execute rule in ${rule.state} state`,
          currentState: rule.state,
          allowedActions: getAllowedActions(rule.state),
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // SINGLE ACTION RULE CHECK
      const singleActionResult = checkSingleActionRule(campaignId);
      if (!singleActionResult.allowed) {
        emitEvent('AUTOMATION_SKIPPED', 'AUTOMATION', 'CAMPAIGN', campaignId, {
          action: actionType,
          reason: singleActionResult.reason,
          metadata: { 
            ruleId, 
            skipReason: singleActionResult.skipReason,
            guardName: singleActionResult.guardName,
          },
        });
        return new Response(JSON.stringify({
          error: 'GUARD_BLOCKED',
          guardName: 'singleActionRule',
          message: singleActionResult.reason,
          skipReason: singleActionResult.skipReason,
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // FULL SAFETY EVALUATION
      const safetyResult = evaluateFullSafety(
        campaign,
        adAccount,
        rule,
        actionType,
        actionValue
      );

      if (!safetyResult.allowed) {
        emitEvent('AUTOMATION_SKIPPED', 'AUTOMATION', 'CAMPAIGN', campaignId, {
          action: actionType,
          reason: safetyResult.reason,
          metadata: {
            ruleId,
            skipReason: safetyResult.skipReason,
            guardName: safetyResult.guardName,
            campaignState: campaign.state,
            accountPermission: adAccount.permission,
          },
        });

        return new Response(JSON.stringify({
          error: 'GUARD_BLOCKED',
          guardName: safetyResult.guardName,
          message: safetyResult.reason,
          skipReason: safetyResult.skipReason,
          campaignState: campaign.state,
          accountPermission: adAccount.permission,
          safetyContext: {
            actionsToday: campaign.actionsToday,
            maxActionsPerDay: GLOBAL_CONFIG.maxActionsPerCampaignPerDay,
            budgetIncreasedToday: campaign.budgetIncreasedTodayPercent,
            maxBudgetIncrease: GLOBAL_CONFIG.maxBudgetIncreasePerDayPercent,
            automationEnabled: GLOBAL_CONFIG.automationEnabled,
          },
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ALL GUARDS PASSED - Execute action
      const now = new Date();
      const cooldownMinutes = ACTION_COOLDOWNS[actionType] || ACTION_COOLDOWNS.DEFAULT;
      
      // Update rule
      rule.lastTriggeredAt = now.toISOString();
      rule.cooldownEndsAt = new Date(now.getTime() + cooldownMinutes * 60 * 1000).toISOString();
      rule.state = 'COOLDOWN';
      rule.actionsToday = (rule.actionsToday || 0) + 1;
      rule.updatedAt = now.toISOString();
      mockRules.set(ruleId, rule);

      // Update campaign
      campaign.actionsToday = (campaign.actionsToday || 0) + 1;
      if (actionType === 'INCREASE_BUDGET' && actionValue) {
        campaign.budgetIncreasedTodayPercent = (campaign.budgetIncreasedTodayPercent || 0) + actionValue;
      }
      mockCampaigns.set(campaignId, campaign);

      // Mark campaign as having received action this cycle
      markCampaignExecuted(campaignId);

      // Emit execution event
      emitEvent('AUTOMATION_ACTION_EXECUTED', 'AUTOMATION', 'CAMPAIGN', campaignId, {
        previousState: 'ACTIVE',
        newState: rule.state,
        action: actionType,
        reason: `Rule ${ruleId} executed ${actionType}`,
        metadata: {
          ruleId,
          cooldownMinutes,
          actionsToday: campaign.actionsToday,
          budgetIncreasedTodayPercent: campaign.budgetIncreasedTodayPercent,
        },
      });

      emitEvent('AUTOMATION_COOLDOWN_STARTED', 'AUTOMATION', 'RULE', ruleId, {
        previousState: 'ACTIVE',
        newState: 'COOLDOWN',
        metadata: { cooldownMinutes, cooldownEndsAt: rule.cooldownEndsAt },
      });

      console.log(`[automation] EXECUTED: ${actionType} on campaign ${campaignId} via rule ${ruleId}`);

      return new Response(JSON.stringify({
        success: true,
        ruleId,
        campaignId,
        action: rule.action,
        actionType,
        state: rule.state,
        cooldownMinutes,
        cooldownEndsAt: rule.cooldownEndsAt,
        campaignActionsToday: campaign.actionsToday,
        budgetIncreasedTodayPercent: campaign.budgetIncreasedTodayPercent,
        allowedActions: getAllowedActions(rule.state),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /automation/evaluate - Evaluate all rules for a campaign (dry run)
    if (req.method === 'POST' && pathParts.length === 2 && pathParts[1] === 'evaluate') {
      const body = await req.json();
      const { campaignId, accountId } = body;

      const campaign = mockCampaigns.get(campaignId);
      if (!campaign) {
        return new Response(JSON.stringify({ error: 'Campaign not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const adAccount = mockAccounts.get(accountId) || mockAccounts.get('acc_1');
      const results: any[] = [];

      // Reset cycle enforcer for fresh evaluation
      resetCycleEnforcer();

      for (const rule of mockRules.values()) {
        if (rule.state !== 'ACTIVE') {
          results.push({
            ruleId: rule.id,
            ruleName: rule.name,
            wouldExecute: false,
            reason: `Rule not ACTIVE (state: ${rule.state})`,
          });
          continue;
        }

        const actionType = rule.action?.type || 'UNKNOWN';
        const actionValue = rule.action?.value;

        // Check single action rule
        const singleActionResult = checkSingleActionRule(campaignId);
        if (!singleActionResult.allowed) {
          results.push({
            ruleId: rule.id,
            ruleName: rule.name,
            wouldExecute: false,
            skipReason: singleActionResult.skipReason,
            reason: singleActionResult.reason,
          });
          continue;
        }

        // Full safety evaluation
        const safetyResult = evaluateFullSafety(campaign, adAccount, rule, actionType, actionValue);

        if (safetyResult.allowed) {
          // Would execute - mark for single action rule
          markCampaignExecuted(campaignId);
          results.push({
            ruleId: rule.id,
            ruleName: rule.name,
            wouldExecute: true,
            actionType,
            actionValue,
            note: 'First valid rule wins - all subsequent rules will be skipped (single action rule)',
          });
        } else {
          results.push({
            ruleId: rule.id,
            ruleName: rule.name,
            wouldExecute: false,
            skipReason: safetyResult.skipReason,
            guardName: safetyResult.guardName,
            reason: safetyResult.reason,
          });
        }
      }

      // Reset for next evaluation
      resetCycleEnforcer();

      return new Response(JSON.stringify({
        campaignId,
        campaignState: campaign.state,
        accountPermission: adAccount.permission,
        automationEnabled: GLOBAL_CONFIG.automationEnabled,
        safetyContext: {
          actionsToday: campaign.actionsToday,
          maxActionsPerDay: GLOBAL_CONFIG.maxActionsPerCampaignPerDay,
          budgetIncreasedToday: campaign.budgetIncreasedTodayPercent,
          maxBudgetIncrease: GLOBAL_CONFIG.maxBudgetIncreasePerDayPercent,
        },
        evaluationResults: results,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /automation/rules/{id}/enable
    if (req.method === 'POST' && pathParts.length === 4 && pathParts[1] === 'rules' && pathParts[3] === 'enable') {
      const ruleId = pathParts[2];
      const rule = mockRules.get(ruleId);
      
      if (!rule) {
        return new Response(JSON.stringify({ error: 'Rule not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!isActionAllowed(rule.state, 'ENABLE')) {
        emitEvent('STATE_TRANSITION_BLOCKED', 'UI', 'RULE', ruleId, {
          action: 'ENABLE',
          reason: `Action not allowed in ${rule.state} state`,
        });
        return new Response(JSON.stringify({
          error: 'INVALID_TRANSITION',
          message: `Cannot enable rule in ${rule.state} state`,
          currentState: rule.state,
          allowedActions: getAllowedActions(rule.state),
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const previousState = rule.state;
      rule.state = 'ACTIVE';
      rule.updatedAt = new Date().toISOString();
      mockRules.set(ruleId, rule);

      emitEvent('AUTOMATION_RULE_ENABLED', 'UI', 'RULE', ruleId, {
        previousState,
        newState: 'ACTIVE',
      });

      return new Response(JSON.stringify({
        ...rule,
        allowedActions: getAllowedActions(rule.state),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /automation/rules/{id}/disable
    if (req.method === 'POST' && pathParts.length === 4 && pathParts[1] === 'rules' && pathParts[3] === 'disable') {
      const ruleId = pathParts[2];
      const rule = mockRules.get(ruleId);
      
      if (!rule) {
        return new Response(JSON.stringify({ error: 'Rule not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!isActionAllowed(rule.state, 'DISABLE')) {
        emitEvent('STATE_TRANSITION_BLOCKED', 'UI', 'RULE', ruleId, {
          action: 'DISABLE',
          reason: `Action not allowed in ${rule.state} state`,
        });
        return new Response(JSON.stringify({
          error: 'INVALID_TRANSITION',
          message: `Cannot disable rule in ${rule.state} state`,
          currentState: rule.state,
          allowedActions: getAllowedActions(rule.state),
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const previousState = rule.state;
      rule.state = 'DISABLED';
      rule.cooldownEndsAt = null;
      rule.updatedAt = new Date().toISOString();
      mockRules.set(ruleId, rule);

      emitEvent('AUTOMATION_RULE_DISABLED', 'UI', 'RULE', ruleId, {
        previousState,
        newState: 'DISABLED',
      });

      return new Response(JSON.stringify({
        ...rule,
        allowedActions: getAllowedActions(rule.state),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /automation/rules/{id}/reset-cooldown
    if (req.method === 'POST' && pathParts.length === 4 && pathParts[1] === 'rules' && pathParts[3] === 'reset-cooldown') {
      const ruleId = pathParts[2];
      const rule = mockRules.get(ruleId);
      
      if (!rule) {
        return new Response(JSON.stringify({ error: 'Rule not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!isActionAllowed(rule.state, 'RESET_COOLDOWN')) {
        emitEvent('STATE_TRANSITION_BLOCKED', 'UI', 'RULE', ruleId, {
          action: 'RESET_COOLDOWN',
          reason: `Action not allowed in ${rule.state} state`,
        });
        return new Response(JSON.stringify({
          error: 'INVALID_TRANSITION',
          message: `Cannot reset cooldown in ${rule.state} state`,
          currentState: rule.state,
          allowedActions: getAllowedActions(rule.state),
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const previousState = rule.state;
      rule.state = 'ACTIVE';
      rule.cooldownEndsAt = null;
      rule.updatedAt = new Date().toISOString();
      mockRules.set(ruleId, rule);

      emitEvent('AUTOMATION_COOLDOWN_RESET', 'UI', 'RULE', ruleId, {
        previousState,
        newState: 'ACTIVE',
      });

      return new Response(JSON.stringify({
        ...rule,
        allowedActions: getAllowedActions(rule.state),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // DELETE /automation/rules/{id}
    if (req.method === 'DELETE' && pathParts.length === 3 && pathParts[1] === 'rules') {
      const ruleId = pathParts[2];
      const rule = mockRules.get(ruleId);
      
      if (!rule) {
        return new Response(JSON.stringify({ error: 'Rule not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!isActionAllowed(rule.state, 'DELETE')) {
        emitEvent('STATE_TRANSITION_BLOCKED', 'UI', 'RULE', ruleId, {
          action: 'DELETE',
          reason: `Action not allowed in ${rule.state} state`,
        });
        return new Response(JSON.stringify({
          error: 'INVALID_TRANSITION',
          message: `Cannot delete rule in ${rule.state} state. Disable it first.`,
          currentState: rule.state,
          allowedActions: getAllowedActions(rule.state),
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      mockRules.delete(ruleId);

      return new Response(JSON.stringify({ success: true, deletedId: ruleId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /automation/events - Get all automation events
    if (req.method === 'GET' && pathParts.length === 2 && pathParts[1] === 'events') {
      const blockedOnly = url.searchParams.get('blocked') === 'true';
      const skippedOnly = url.searchParams.get('skipped') === 'true';
      const limit = parseInt(url.searchParams.get('limit') || '100');
      
      let filtered = eventStore;
      if (blockedOnly) {
        filtered = filtered.filter(e => e.eventType.includes('BLOCKED'));
      }
      if (skippedOnly) {
        filtered = filtered.filter(e => e.eventType === 'AUTOMATION_SKIPPED');
      }
      
      return new Response(JSON.stringify({ 
        events: filtered.slice(0, limit),
        total: filtered.length,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /automation/campaigns - Get campaigns with safety context
    if (req.method === 'GET' && pathParts.length === 2 && pathParts[1] === 'campaigns') {
      const campaigns = Array.from(mockCampaigns.values()).map(c => ({
        ...c,
        safetyContext: {
          canReceiveAutomation: !BLOCKED_CAMPAIGN_STATES.includes(c.state) && !c.pausedByUser,
          actionsRemaining: Math.max(0, GLOBAL_CONFIG.maxActionsPerCampaignPerDay - (c.actionsToday || 0)),
          budgetIncreaseRemaining: Math.max(0, GLOBAL_CONFIG.maxBudgetIncreasePerDayPercent - (c.budgetIncreasedTodayPercent || 0)),
          meetsDataFloor: (
            ((Date.now() - (c.firstSpendTimestamp || Date.now())) / 1000 / 60 >= DATA_FLOOR.MIN_MINUTES_SINCE_FIRST_SPEND) ||
            ((c.impressions || 0) >= DATA_FLOOR.MIN_IMPRESSIONS)
          ),
        },
      }));

      return new Response(JSON.stringify({ campaigns }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[automation] Error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Internal error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
