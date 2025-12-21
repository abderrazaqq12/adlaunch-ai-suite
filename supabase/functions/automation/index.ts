import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * AUTOMATION RULE STATE MACHINE with STATE GUARDS
 * 
 * States:
 * - DISABLED: Rule is off
 * - ACTIVE: Rule is running
 * - COOLDOWN: Rule triggered recently, waiting cooldown period
 * - ERROR: Rule has an error (bad config, etc.)
 * 
 * GUARDS for ACTION_EXECUTION:
 * - campaign.state NOT IN ["RECOVERY", "USER_PAUSED", "STOPPED", "DISAPPROVED"]
 * - cooldownExpired === true
 * - maxActionsPerDay NOT exceeded
 */

type RuleState = 'DISABLED' | 'ACTIVE' | 'COOLDOWN' | 'ERROR';
type RuleScope = 'CAMPAIGN' | 'ADSET' | 'AD';
type RuleAction = 'ENABLE' | 'DISABLE' | 'EDIT' | 'DELETE' | 'RESET_COOLDOWN' | 'EXECUTE';

// Campaign states that block automation
const BLOCKED_CAMPAIGN_STATES = ['RECOVERY', 'USER_PAUSED', 'STOPPED', 'DISAPPROVED'];

// ============================================================================
// PURE GUARD FUNCTIONS
// ============================================================================

interface GuardResult {
  allowed: boolean;
  reason?: string;
}

interface AutomationActionGuardInput {
  rule: {
    id: string;
    state: string;
    cooldownMinutes: number;
    lastTriggeredAt?: string | null;
    actionsToday?: number;
    maxActionsPerDay?: number;
  };
  campaign: {
    id: string;
    state: string;
  };
}

interface AutomationGuardConfig {
  maxActionsPerDay: number;
}

/**
 * AUTOMATION → ACTION_EXECUTION Guard (Pure Function)
 */
function guardAutomationAction(
  input: AutomationActionGuardInput,
  config: AutomationGuardConfig = { maxActionsPerDay: 10 }
): GuardResult {
  // Guard 1: Campaign state must allow automation
  if (BLOCKED_CAMPAIGN_STATES.includes(input.campaign.state)) {
    return {
      allowed: false,
      reason: `Campaign in ${input.campaign.state} state blocks automation actions`,
    };
  }

  // Guard 2: Rule must be ACTIVE
  if (input.rule.state !== 'ACTIVE') {
    return {
      allowed: false,
      reason: `Rule must be ACTIVE to execute. Current state: ${input.rule.state}`,
    };
  }

  // Guard 3: Cooldown must be expired
  if (input.rule.lastTriggeredAt) {
    const lastTriggered = new Date(input.rule.lastTriggeredAt);
    const cooldownMs = input.rule.cooldownMinutes * 60 * 1000;
    const cooldownEnds = new Date(lastTriggered.getTime() + cooldownMs);
    const now = new Date();
    
    if (now < cooldownEnds) {
      const remainingMs = cooldownEnds.getTime() - now.getTime();
      const remainingMins = Math.ceil(remainingMs / 60000);
      return {
        allowed: false,
        reason: `Rule in cooldown. ${remainingMins} minute(s) remaining`,
      };
    }
  }

  // Guard 4: Max actions per day not exceeded
  const actionsToday = input.rule.actionsToday || 0;
  const maxActions = input.rule.maxActionsPerDay || config.maxActionsPerDay;
  
  if (actionsToday >= maxActions) {
    return {
      allowed: false,
      reason: `Daily action limit reached (${actionsToday}/${maxActions})`,
    };
  }

  return { allowed: true };
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

// Blocked event log
const blockedEvents: any[] = [];

function logBlockedEvent(
  entityId: string,
  action: string,
  reason: string,
  guardName: string,
  context?: Record<string, unknown>
) {
  const event = {
    id: `blocked_${Date.now()}`,
    type: 'GUARD_BLOCKED',
    entity: 'RULE',
    entityId,
    action,
    reason,
    metadata: { guardName, ...context },
    timestamp: new Date().toISOString(),
  };
  blockedEvents.push(event);
  console.log(`[automation] GUARD_BLOCKED: ${guardName} - ${reason}`);
  return event;
}

// Mock database
const mockRules: Map<string, any> = new Map();

// Mock campaigns for guard validation
const mockCampaigns: Map<string, any> = new Map();

// Initialize with sample data
mockRules.set('rule_1', {
  id: 'rule_1',
  name: 'Pause High CPA Ads',
  scope: 'AD',
  condition: { metric: 'cpa', operator: '>', value: 50 },
  action: { type: 'PAUSE' },
  state: 'ACTIVE',
  cooldownMinutes: 60,
  lastTriggeredAt: null,
  actionsToday: 0,
  maxActionsPerDay: 10,
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
  cooldownMinutes: 120,
  lastTriggeredAt: null,
  actionsToday: 0,
  maxActionsPerDay: 5,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

mockRules.set('rule_3', {
  id: 'rule_3',
  name: 'Stop Low Performers',
  scope: 'ADSET',
  condition: { metric: 'ctr', operator: '<', value: 0.5 },
  action: { type: 'STOP' },
  state: 'COOLDOWN',
  cooldownMinutes: 30,
  lastTriggeredAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  cooldownEndsAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  actionsToday: 3,
  maxActionsPerDay: 10,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

mockRules.set('rule_4', {
  id: 'rule_4',
  name: 'Daily Limit Test',
  scope: 'AD',
  condition: { metric: 'cpc', operator: '>', value: 2 },
  action: { type: 'PAUSE' },
  state: 'ACTIVE',
  cooldownMinutes: 30,
  lastTriggeredAt: null,
  actionsToday: 10,
  maxActionsPerDay: 10, // Already at limit
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

// Mock campaigns
mockCampaigns.set('camp_1', { id: 'camp_1', state: 'ACTIVE' });
mockCampaigns.set('camp_2', { id: 'camp_2', state: 'USER_PAUSED' }); // Blocked state
mockCampaigns.set('camp_3', { id: 'camp_3', state: 'RECOVERY' }); // Blocked state

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  
  console.log(`[automation] ${req.method} ${url.pathname}`);

  try {
    // GET /automation/rules - List all rules
    if (req.method === 'GET' && pathParts.length === 2 && pathParts[1] === 'rules') {
      const rules = Array.from(mockRules.values()).map(rule => ({
        id: rule.id,
        name: rule.name,
        scope: rule.scope,
        condition: rule.condition,
        action: rule.action,
        state: rule.state,
        cooldownMinutes: rule.cooldownMinutes,
        lastTriggeredAt: rule.lastTriggeredAt,
        cooldownEndsAt: rule.cooldownEndsAt,
        actionsToday: rule.actionsToday,
        maxActionsPerDay: rule.maxActionsPerDay,
        allowedActions: getAllowedActions(rule.state),
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
        allowedActions: getAllowedActions(rule.state),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /automation/rules - Create new rule
    if (req.method === 'POST' && pathParts.length === 2 && pathParts[1] === 'rules') {
      const body = await req.json();
      const { name, scope, condition, action, cooldownMinutes, maxActionsPerDay } = body;

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
        cooldownMinutes: cooldownMinutes || 60,
        maxActionsPerDay: maxActionsPerDay || 10,
        lastTriggeredAt: null,
        cooldownEndsAt: null,
        actionsToday: 0,
        createdAt: now,
        updatedAt: now,
      };
      
      mockRules.set(ruleId, newRule);
      console.log(`[automation] Created rule ${ruleId}`);

      return new Response(JSON.stringify({
        ...newRule,
        allowedActions: getAllowedActions(newRule.state),
      }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /automation/rules/{id}/execute - Execute rule action (WITH GUARDS)
    if (req.method === 'POST' && pathParts.length === 4 && pathParts[1] === 'rules' && pathParts[3] === 'execute') {
      const ruleId = pathParts[2];
      const body = await req.json();
      const { campaignId } = body;

      const rule = mockRules.get(ruleId);
      if (!rule) {
        return new Response(JSON.stringify({ error: 'Rule not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get campaign for guard validation
      const campaign = mockCampaigns.get(campaignId);
      if (!campaign) {
        return new Response(JSON.stringify({ error: 'Campaign not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // STATE MACHINE CHECK
      if (!isActionAllowed(rule.state, 'EXECUTE')) {
        logBlockedEvent(ruleId, 'EXECUTE', `Action not allowed in ${rule.state} state`, 'STATE_MACHINE');
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

      // RUN AUTOMATION ACTION GUARD (Pure function)
      const guardResult = guardAutomationAction(
        {
          rule: {
            id: rule.id,
            state: rule.state,
            cooldownMinutes: rule.cooldownMinutes,
            lastTriggeredAt: rule.lastTriggeredAt,
            actionsToday: rule.actionsToday,
            maxActionsPerDay: rule.maxActionsPerDay,
          },
          campaign: {
            id: campaign.id,
            state: campaign.state,
          },
        },
        { maxActionsPerDay: rule.maxActionsPerDay || 10 }
      );

      if (!guardResult.allowed) {
        // Log BLOCKED_EVENT
        logBlockedEvent(
          ruleId,
          'EXECUTE',
          guardResult.reason!,
          'guardAutomationAction',
          { 
            campaignId, 
            campaignState: campaign.state,
            actionsToday: rule.actionsToday,
            maxActionsPerDay: rule.maxActionsPerDay,
          }
        );

        return new Response(JSON.stringify({
          error: 'GUARD_BLOCKED',
          guardName: 'guardAutomationAction',
          message: guardResult.reason,
          currentState: rule.state,
          campaignState: campaign.state,
          allowedActions: getAllowedActions(rule.state),
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // All guards passed - execute action
      const now = new Date();
      rule.lastTriggeredAt = now.toISOString();
      rule.cooldownEndsAt = new Date(now.getTime() + rule.cooldownMinutes * 60 * 1000).toISOString();
      rule.state = 'COOLDOWN';
      rule.actionsToday = (rule.actionsToday || 0) + 1;
      rule.updatedAt = now.toISOString();
      mockRules.set(ruleId, rule);

      console.log(`[automation] Executed rule ${ruleId} on campaign ${campaignId} (guards passed)`);

      return new Response(JSON.stringify({
        success: true,
        ruleId,
        campaignId,
        action: rule.action,
        state: rule.state,
        cooldownEndsAt: rule.cooldownEndsAt,
        actionsToday: rule.actionsToday,
        allowedActions: getAllowedActions(rule.state),
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
        logBlockedEvent(ruleId, 'ENABLE', `Action not allowed in ${rule.state} state`, 'STATE_MACHINE');
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

      rule.state = 'ACTIVE';
      rule.updatedAt = new Date().toISOString();
      mockRules.set(ruleId, rule);
      console.log(`[automation] Enabled rule ${ruleId}`);

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
        logBlockedEvent(ruleId, 'DISABLE', `Action not allowed in ${rule.state} state`, 'STATE_MACHINE');
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

      rule.state = 'DISABLED';
      rule.cooldownEndsAt = null;
      rule.updatedAt = new Date().toISOString();
      mockRules.set(ruleId, rule);
      console.log(`[automation] Disabled rule ${ruleId}`);

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
        logBlockedEvent(ruleId, 'RESET_COOLDOWN', `Action not allowed in ${rule.state} state`, 'STATE_MACHINE');
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

      rule.state = 'ACTIVE';
      rule.cooldownEndsAt = null;
      rule.updatedAt = new Date().toISOString();
      mockRules.set(ruleId, rule);
      console.log(`[automation] Reset cooldown for rule ${ruleId}`);

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
        logBlockedEvent(ruleId, 'DELETE', `Action not allowed in ${rule.state} state`, 'STATE_MACHINE');
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
      console.log(`[automation] Deleted rule ${ruleId}`);

      return new Response(JSON.stringify({ success: true, deletedId: ruleId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /automation/blocked-events - Get blocked event log
    if (req.method === 'GET' && pathParts.length === 2 && pathParts[1] === 'blocked-events') {
      return new Response(JSON.stringify({ events: blockedEvents }), {
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
