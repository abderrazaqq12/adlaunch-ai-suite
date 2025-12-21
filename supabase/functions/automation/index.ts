import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * AUTOMATION RULE STATE MACHINE
 * 
 * States:
 * - DISABLED: Rule is off
 * - ACTIVE: Rule is running
 * - COOLDOWN: Rule triggered recently, waiting cooldown period
 * - ERROR: Rule has an error (bad config, etc.)
 * 
 * Scope: CAMPAIGN, ADSET, AD
 */

type RuleState = 'DISABLED' | 'ACTIVE' | 'COOLDOWN' | 'ERROR';
type RuleScope = 'CAMPAIGN' | 'ADSET' | 'AD';
type RuleAction = 'ENABLE' | 'DISABLE' | 'EDIT' | 'DELETE' | 'RESET_COOLDOWN';

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
    allowedActions: ['DISABLE', 'EDIT'],
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

// Mock database
const mockRules: Map<string, any> = new Map();

// Initialize with sample rules
mockRules.set('rule_1', {
  id: 'rule_1',
  name: 'Pause High CPA Ads',
  scope: 'AD',
  condition: { metric: 'cpa', operator: '>', value: 50 },
  action: { type: 'PAUSE' },
  state: 'ACTIVE',
  cooldownMinutes: 60,
  lastTriggeredAt: null,
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
  lastTriggeredAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 mins ago
  cooldownEndsAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 mins from now
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

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
      const { name, scope, condition, action, cooldownMinutes } = body;

      // Validate required fields
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
        state: 'DISABLED' as RuleState, // Always start disabled
        cooldownMinutes: cooldownMinutes || 60,
        lastTriggeredAt: null,
        cooldownEndsAt: null,
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

    // POST /automation/rules/{id}/enable - Enable rule
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

    // POST /automation/rules/{id}/disable - Disable rule
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

    // POST /automation/rules/{id}/reset-cooldown - Reset cooldown
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

    // DELETE /automation/rules/{id} - Delete rule
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
