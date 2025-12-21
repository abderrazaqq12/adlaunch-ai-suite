import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest, createUserClient, extractBearerToken, unauthorizedResponse } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * AUTOMATION SAFETY v2 + JWT Authentication
 * 
 * All operations require a valid JWT token and are scoped to auth.uid()
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

interface GlobalSafetyConfig {
  automationEnabled: boolean;
  maxActionsPerCampaignPerDay: number;
  maxBudgetIncreasePerDayPercent: number;
}

const GLOBAL_CONFIG: GlobalSafetyConfig = {
  automationEnabled: true,
  maxActionsPerCampaignPerDay: MAX_ACTIONS_PER_CAMPAIGN_PER_DAY,
  maxBudgetIncreasePerDayPercent: MAX_BUDGET_INCREASE_PER_DAY_PERCENT,
};

// ============================================================================
// PURE GUARD FUNCTIONS
// ============================================================================

interface SafetyGuardResult {
  allowed: boolean;
  reason?: string;
  skipReason?: string;
  guardName?: string;
}

function guardKillSwitch(): SafetyGuardResult {
  if (!GLOBAL_CONFIG.automationEnabled) {
    return {
      allowed: false,
      reason: 'Global automation kill switch is ACTIVE',
      skipReason: 'KILL_SWITCH_ACTIVE',
      guardName: 'guardKillSwitch',
    };
  }
  return { allowed: true };
}

function guardDataFloor(campaign: any): SafetyGuardResult {
  const now = Date.now();
  const firstSpend = campaign.first_spend_timestamp 
    ? new Date(campaign.first_spend_timestamp).getTime() 
    : now;
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
    return {
      allowed: false,
      reason: `Campaign in ${campaign.state} state blocks automation`,
      skipReason: campaign.state === 'RECOVERY' ? 'RECOVERY_STATE' : 'CAMPAIGN_IN_BLOCKED_STATE',
      guardName: 'guardCampaignState',
    };
  }
  
  if (campaign.paused_by_user) {
    return {
      allowed: false,
      reason: 'Campaign was paused by user - automation cannot modify',
      skipReason: 'USER_PAUSED',
      guardName: 'guardCampaignState',
    };
  }
  
  return { allowed: true };
}

function guardCooldown(rule: any, actionType: string): SafetyGuardResult {
  if (!rule.last_triggered_at) return { allowed: true };
  
  const cooldownMinutes = ACTION_COOLDOWNS[actionType] || ACTION_COOLDOWNS.DEFAULT;
  const lastTriggered = new Date(rule.last_triggered_at).getTime();
  const cooldownMs = cooldownMinutes * 60 * 1000;
  const cooldownEndsAt = lastTriggered + cooldownMs;
  const now = Date.now();
  
  if (now < cooldownEndsAt) {
    const remainingMins = Math.ceil((cooldownEndsAt - now) / 60000);
    return {
      allowed: false,
      reason: `Action in cooldown. ${remainingMins} minute(s) remaining`,
      skipReason: 'COOLDOWN_ACTIVE',
      guardName: 'guardCooldown',
    };
  }
  
  return { allowed: true };
}

function guardDailyLimit(campaign: any): SafetyGuardResult {
  const actionsToday = campaign.actions_today || 0;
  if (actionsToday >= GLOBAL_CONFIG.maxActionsPerCampaignPerDay) {
    return {
      allowed: false,
      reason: `Daily action limit reached (${actionsToday}/${GLOBAL_CONFIG.maxActionsPerCampaignPerDay})`,
      skipReason: 'DAILY_LIMIT_EXCEEDED',
      guardName: 'guardDailyLimit',
    };
  }
  return { allowed: true };
}

// ============================================================================
// STATE MACHINE
// ============================================================================

type RuleState = 'DISABLED' | 'ACTIVE' | 'COOLDOWN' | 'ERROR';

const RULE_STATE_CONFIG: Record<RuleState, { allowedActions: string[] }> = {
  DISABLED: { allowedActions: ['ENABLE', 'EDIT', 'DELETE'] },
  ACTIVE: { allowedActions: ['DISABLE', 'EDIT', 'EXECUTE'] },
  COOLDOWN: { allowedActions: ['DISABLE', 'RESET_COOLDOWN'] },
  ERROR: { allowedActions: ['DISABLE', 'EDIT', 'DELETE'] },
};

function getAllowedActions(state: RuleState): string[] {
  return RULE_STATE_CONFIG[state]?.allowedActions || [];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ===================== JWT AUTHENTICATION =====================
  const authResult = await authenticateRequest(req);
  if (!authResult.authenticated) {
    console.error('[automation] Auth failed:', authResult.error);
    return unauthorizedResponse(authResult.error || 'Unauthorized', corsHeaders);
  }
  
  const userId = authResult.userId!;
  const token = extractBearerToken(req)!;
  const supabase = createUserClient(token);
  
  console.log(`[automation] Authenticated user: ${userId}`);
  // ==============================================================

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  
  console.log(`[automation] ${req.method} ${url.pathname}`);

  try {
    // GET /automation/rules - List user's rules
    if (req.method === 'GET' && pathParts.length === 2 && pathParts[1] === 'rules') {
      const { data: rules, error } = await supabase
        .from('automation_rules')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const enrichedRules = (rules || []).map(r => ({
        ...r,
        allowedActions: getAllowedActions(r.state as RuleState),
      }));

      return new Response(JSON.stringify({ rules: enrichedRules }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /automation/rules - Create new rule
    if (req.method === 'POST' && pathParts.length === 2 && pathParts[1] === 'rules') {
      const body = await req.json();
      
      let projectId = body.project_id;
      if (!projectId) {
        const { data: projects } = await supabase.from('projects').select('id').limit(1);
        if (projects && projects.length > 0) {
          projectId = projects[0].id;
        } else {
          const { data: newProject, error: projectError } = await supabase
            .from('projects')
            .insert({ user_id: userId })
            .select()
            .single();
          if (projectError) throw projectError;
          projectId = newProject.id;
        }
      }

      const { data: rule, error } = await supabase
        .from('automation_rules')
        .insert({
          project_id: projectId,
          user_id: userId,
          name: body.name,
          scope: body.scope || 'CAMPAIGN',
          condition: body.condition,
          action: body.action,
          state: 'DISABLED',
          cooldown_minutes: body.cooldown_minutes || 60,
        })
        .select()
        .single();

      if (error) throw error;

      await supabase.from('events').insert({
        event_id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        event_type: 'AUTOMATION_RULE_CREATED',
        source: 'UI',
        entity_type: 'RULE',
        entity_id: rule.id,
        user_id: userId,
        new_state: 'DISABLED',
      });

      return new Response(JSON.stringify({
        ...rule,
        allowedActions: getAllowedActions('DISABLED'),
      }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /automation/rules/{id}/enable - Enable rule
    if (req.method === 'POST' && pathParts.length === 4 && pathParts[1] === 'rules' && pathParts[3] === 'enable') {
      const ruleId = pathParts[2];
      
      const { data: rule, error: fetchError } = await supabase
        .from('automation_rules')
        .select('*')
        .eq('id', ruleId)
        .maybeSingle();
      
      if (fetchError) throw fetchError;
      if (!rule) {
        return new Response(JSON.stringify({ error: 'Rule not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: updated, error } = await supabase
        .from('automation_rules')
        .update({ state: 'ACTIVE' })
        .eq('id', ruleId)
        .select()
        .single();

      if (error) throw error;

      await supabase.from('events').insert({
        event_id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        event_type: 'AUTOMATION_RULE_ENABLED',
        source: 'UI',
        entity_type: 'RULE',
        entity_id: ruleId,
        user_id: userId,
        previous_state: rule.state,
        new_state: 'ACTIVE',
      });

      return new Response(JSON.stringify({
        ...updated,
        allowedActions: getAllowedActions('ACTIVE'),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /automation/rules/{id}/disable - Disable rule
    if (req.method === 'POST' && pathParts.length === 4 && pathParts[1] === 'rules' && pathParts[3] === 'disable') {
      const ruleId = pathParts[2];
      
      const { data: rule, error: fetchError } = await supabase
        .from('automation_rules')
        .select('*')
        .eq('id', ruleId)
        .maybeSingle();
      
      if (fetchError) throw fetchError;
      if (!rule) {
        return new Response(JSON.stringify({ error: 'Rule not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: updated, error } = await supabase
        .from('automation_rules')
        .update({ state: 'DISABLED' })
        .eq('id', ruleId)
        .select()
        .single();

      if (error) throw error;

      await supabase.from('events').insert({
        event_id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        event_type: 'AUTOMATION_RULE_DISABLED',
        source: 'UI',
        entity_type: 'RULE',
        entity_id: ruleId,
        user_id: userId,
        previous_state: rule.state,
        new_state: 'DISABLED',
      });

      return new Response(JSON.stringify({
        ...updated,
        allowedActions: getAllowedActions('DISABLED'),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /automation/run - Evaluate and execute automation rules
    if (req.method === 'POST' && pathParts.length === 2 && pathParts[1] === 'run') {
      // Check kill switch first
      const killSwitchResult = guardKillSwitch();
      if (!killSwitchResult.allowed) {
        await supabase.from('events').insert({
          event_id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          event_type: 'AUTOMATION_SKIPPED',
          source: 'SYSTEM',
          entity_type: 'SYSTEM',
          entity_id: 'automation_engine',
          user_id: userId,
          reason: killSwitchResult.reason,
          metadata: { skipReason: killSwitchResult.skipReason },
        });

        return new Response(JSON.stringify({
          executed: false,
          reason: killSwitchResult.reason,
          skipReason: killSwitchResult.skipReason,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get active rules
      const { data: rules, error: rulesError } = await supabase
        .from('automation_rules')
        .select('*')
        .eq('state', 'ACTIVE');

      if (rulesError) throw rulesError;

      // Get user's campaigns
      const { data: campaigns, error: campaignsError } = await supabase
        .from('campaigns')
        .select('*');

      if (campaignsError) throw campaignsError;

      const results = [];
      const executedCampaigns = new Set<string>();

      for (const rule of (rules || [])) {
        for (const campaign of (campaigns || [])) {
          // Single action rule
          if (executedCampaigns.has(campaign.id)) {
            await supabase.from('events').insert({
              event_id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              event_type: 'AUTOMATION_SKIPPED',
              source: 'AUTOMATION',
              entity_type: 'RULE',
              entity_id: rule.id,
              user_id: userId,
              reason: 'Single action rule - campaign already executed this cycle',
              metadata: { campaignId: campaign.id, skipReason: 'SINGLE_ACTION_RULE' },
            });
            continue;
          }

          // Run all safety guards
          const stateResult = guardCampaignState(campaign);
          if (!stateResult.allowed) {
            await supabase.from('events').insert({
              event_id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              event_type: 'AUTOMATION_SKIPPED',
              source: 'AUTOMATION',
              entity_type: 'RULE',
              entity_id: rule.id,
              user_id: userId,
              reason: stateResult.reason,
              metadata: { campaignId: campaign.id, skipReason: stateResult.skipReason },
            });
            continue;
          }

          const dataResult = guardDataFloor(campaign);
          if (!dataResult.allowed) {
            await supabase.from('events').insert({
              event_id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              event_type: 'AUTOMATION_SKIPPED',
              source: 'AUTOMATION',
              entity_type: 'RULE',
              entity_id: rule.id,
              user_id: userId,
              reason: dataResult.reason,
              metadata: { campaignId: campaign.id, skipReason: dataResult.skipReason },
            });
            continue;
          }

          const cooldownResult = guardCooldown(rule, rule.action?.type || 'DEFAULT');
          if (!cooldownResult.allowed) {
            await supabase.from('events').insert({
              event_id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              event_type: 'AUTOMATION_SKIPPED',
              source: 'AUTOMATION',
              entity_type: 'RULE',
              entity_id: rule.id,
              user_id: userId,
              reason: cooldownResult.reason,
              metadata: { campaignId: campaign.id, skipReason: cooldownResult.skipReason },
            });
            continue;
          }

          const dailyResult = guardDailyLimit(campaign);
          if (!dailyResult.allowed) {
            await supabase.from('events').insert({
              event_id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              event_type: 'AUTOMATION_SKIPPED',
              source: 'AUTOMATION',
              entity_type: 'RULE',
              entity_id: rule.id,
              user_id: userId,
              reason: dailyResult.reason,
              metadata: { campaignId: campaign.id, skipReason: dailyResult.skipReason },
            });
            continue;
          }

          // All guards passed - log as triggered (actual execution would happen here)
          executedCampaigns.add(campaign.id);

          await supabase
            .from('automation_rules')
            .update({ 
              last_triggered_at: new Date().toISOString(),
              actions_today: (rule.actions_today || 0) + 1,
            })
            .eq('id', rule.id);

          await supabase
            .from('campaigns')
            .update({ actions_today: (campaign.actions_today || 0) + 1 })
            .eq('id', campaign.id);

          await supabase.from('events').insert({
            event_id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            event_type: 'AUTOMATION_TRIGGERED',
            source: 'AUTOMATION',
            entity_type: 'RULE',
            entity_id: rule.id,
            user_id: userId,
            action: rule.action?.type,
            metadata: { campaignId: campaign.id, ruleName: rule.name },
          });

          results.push({
            ruleId: rule.id,
            ruleName: rule.name,
            campaignId: campaign.id,
            action: rule.action?.type,
            executed: true,
          });
        }
      }

      return new Response(JSON.stringify({
        success: true,
        rulesEvaluated: rules?.length || 0,
        actionsExecuted: results.length,
        results,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /automation/config - Get safety configuration
    if (req.method === 'GET' && pathParts.length === 2 && pathParts[1] === 'config') {
      return new Response(JSON.stringify({
        ...GLOBAL_CONFIG,
        actionCooldowns: ACTION_COOLDOWNS,
        blockedCampaignStates: BLOCKED_CAMPAIGN_STATES,
        forbiddenActions: FORBIDDEN_AUTOMATION_ACTIONS,
        dataFloor: DATA_FLOOR,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // DELETE /automation/rules/{id} - Delete rule
    if (req.method === 'DELETE' && pathParts.length === 3 && pathParts[1] === 'rules') {
      const ruleId = pathParts[2];
      
      const { error } = await supabase
        .from('automation_rules')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
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
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
