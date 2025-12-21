import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest, createUserClient, extractBearerToken, unauthorizedResponse } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * CAMPAIGN STATE MACHINE with STATE GUARDS + JWT Authentication
 * 
 * All operations require a valid JWT token and are scoped to auth.uid()
 */

type CampaignIntentState = 'DRAFT' | 'VALIDATING' | 'READY_TO_PUBLISH' | 'PUBLISHING' | 'FAILED';
type CampaignState = 'ACTIVE' | 'PAUSED' | 'STOPPED' | 'DISAPPROVED' | 'RECOVERY' | 'USER_PAUSED';

const CONVERSION_SUPPORTED_PLATFORMS = ['GOOGLE', 'TIKTOK', 'SNAPCHAT'];

// ============================================================================
// PURE GUARD FUNCTIONS
// ============================================================================

interface GuardResult {
  allowed: boolean;
  reason?: string;
}

interface CampaignPublishGuardInput {
  assets: Array<{
    id: string;
    state: string;
    risk_score?: number | null;
    platform_compatibility?: string[];
  }>;
  accounts: Array<{
    id: string;
    status: string;
    permissions: { canLaunch?: boolean };
    platform: string;
  }>;
  audience: {
    country?: string;
    language?: string;
  };
  objective: string;
  targetPlatforms: string[];
}

function guardCampaignPublish(input: CampaignPublishGuardInput): GuardResult {
  const readyAssets = input.assets.filter(a => a.state === 'READY_FOR_LAUNCH');
  if (readyAssets.length === 0) {
    return {
      allowed: false,
      reason: 'At least one asset must be in READY_FOR_LAUNCH state',
    };
  }

  const accountsWithoutLaunch = input.accounts.filter(a => !a.permissions?.canLaunch);
  if (accountsWithoutLaunch.length > 0) {
    const accountIds = accountsWithoutLaunch.map(a => a.id).join(', ');
    return {
      allowed: false,
      reason: `Ad accounts missing LAUNCH permission: ${accountIds}`,
    };
  }

  if (!input.audience.country || !input.audience.language) {
    const missingFields: string[] = [];
    if (!input.audience.country) missingFields.push('country');
    if (!input.audience.language) missingFields.push('language');
    
    return {
      allowed: false,
      reason: `Invalid audience configuration. Missing: ${missingFields.join(', ')}`,
    };
  }

  if (input.objective !== 'CONVERSION') {
    return {
      allowed: false,
      reason: `Only CONVERSION objective is supported. Received: ${input.objective}`,
    };
  }

  const unsupportedPlatforms = input.targetPlatforms.filter(
    p => !CONVERSION_SUPPORTED_PLATFORMS.includes(p.toUpperCase())
  );
  if (unsupportedPlatforms.length > 0) {
    return {
      allowed: false,
      reason: `Platform(s) do not support conversion campaigns: ${unsupportedPlatforms.join(', ')}`,
    };
  }

  for (const platform of input.targetPlatforms) {
    const compatibleAssets = readyAssets.filter(
      a => !a.platform_compatibility || a.platform_compatibility.includes(platform.toUpperCase())
    );
    if (compatibleAssets.length === 0) {
      return {
        allowed: false,
        reason: `No compatible assets for platform: ${platform}`,
      };
    }
  }

  return { allowed: true };
}

// ============================================================================
// STATE MACHINE CONFIG
// ============================================================================

const CAMPAIGN_INTENT_STATE_CONFIG: Record<CampaignIntentState, { allowedActions: string[] }> = {
  DRAFT: { allowedActions: ['VALIDATE', 'EDIT', 'DISCARD'] },
  VALIDATING: { allowedActions: [] },
  READY_TO_PUBLISH: { allowedActions: ['PUBLISH', 'EDIT', 'DISCARD'] },
  PUBLISHING: { allowedActions: [] },
  FAILED: { allowedActions: ['EDIT', 'DISCARD'] },
};

const CAMPAIGN_STATE_CONFIG: Record<CampaignState, { allowedActions: string[] }> = {
  ACTIVE: { allowedActions: ['PAUSE', 'STOP', 'VIEW_METRICS'] },
  PAUSED: { allowedActions: ['RESUME', 'STOP', 'VIEW_METRICS'] },
  USER_PAUSED: { allowedActions: ['RESUME', 'STOP', 'VIEW_METRICS'] },
  STOPPED: { allowedActions: ['VIEW_METRICS'] },
  DISAPPROVED: { allowedActions: ['VIEW_METRICS'] },
  RECOVERY: { allowedActions: ['VIEW_METRICS'] },
};

function getIntentAllowedActions(state: CampaignIntentState): string[] {
  return CAMPAIGN_INTENT_STATE_CONFIG[state]?.allowedActions || [];
}

function getCampaignAllowedActions(state: CampaignState): string[] {
  return CAMPAIGN_STATE_CONFIG[state]?.allowedActions || [];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ===================== JWT AUTHENTICATION =====================
  const authResult = await authenticateRequest(req);
  if (!authResult.authenticated) {
    console.error('[campaigns] Auth failed:', authResult.error);
    return unauthorizedResponse(authResult.error || 'Unauthorized', corsHeaders);
  }
  
  const userId = authResult.userId!;
  const token = extractBearerToken(req)!;
  const supabase = createUserClient(token);
  
  console.log(`[campaigns] Authenticated user: ${userId}`);
  // ==============================================================

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  
  console.log(`[campaigns] ${req.method} ${url.pathname}`);

  try {
    // GET /campaigns - List user's campaigns
    if (req.method === 'GET' && pathParts.length === 1) {
      const { data: campaigns, error } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const enrichedCampaigns = (campaigns || []).map(c => ({
        ...c,
        allowedActions: getCampaignAllowedActions(c.state as CampaignState),
      }));

      return new Response(JSON.stringify({ campaigns: enrichedCampaigns }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /campaigns/intents - List campaign intents
    if (req.method === 'GET' && pathParts.length === 2 && pathParts[1] === 'intents') {
      const { data: intents, error } = await supabase
        .from('campaign_intents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const enrichedIntents = (intents || []).map(i => ({
        ...i,
        allowedActions: getIntentAllowedActions(i.state as CampaignIntentState),
      }));

      return new Response(JSON.stringify({ intents: enrichedIntents }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /campaigns/validate - Create and validate campaign intent
    if (req.method === 'POST' && pathParts.length === 2 && pathParts[1] === 'validate') {
      const body = await req.json();
      const { name, asset_ids, account_ids, audience, objective, budget, schedule, project_id } = body;

      const errors: string[] = [];
      if (!asset_ids || asset_ids.length === 0) errors.push('At least one asset is required');
      if (!account_ids || account_ids.length === 0) errors.push('At least one ad account is required');
      if (!audience?.country) errors.push('Target country is required');
      if (!audience?.language) errors.push('Target language is required');
      if (objective !== 'CONVERSION') errors.push('Only CONVERSION objective is supported');

      if (errors.length > 0) {
        return new Response(JSON.stringify({
          state: 'FAILED',
          errors,
          allowedActions: ['EDIT', 'DISCARD'],
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get or create project
      let projectId = project_id;
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

      const { data: intent, error } = await supabase
        .from('campaign_intents')
        .insert({
          project_id: projectId,
          user_id: userId,
          name: name || 'New Campaign',
          asset_ids,
          account_ids,
          audience,
          objective: objective || 'CONVERSION',
          budget,
          schedule,
          state: 'READY_TO_PUBLISH',
        })
        .select()
        .single();

      if (error) throw error;

      await supabase.from('events').insert({
        event_id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        event_type: 'CAMPAIGN_INTENT_CREATED',
        source: 'UI',
        entity_type: 'INTENT',
        entity_id: intent.id,
        user_id: userId,
        new_state: 'READY_TO_PUBLISH',
      });

      return new Response(JSON.stringify({
        ...intent,
        allowedActions: getIntentAllowedActions('READY_TO_PUBLISH'),
      }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /campaigns/intents/{id}/publish - Publish campaign (WITH GUARDS)
    if (req.method === 'POST' && pathParts.length === 4 && pathParts[1] === 'intents' && pathParts[3] === 'publish') {
      const intentId = pathParts[2];
      
      const { data: intent, error: intentError } = await supabase
        .from('campaign_intents')
        .select('*')
        .eq('id', intentId)
        .maybeSingle();
      
      if (intentError) throw intentError;
      if (!intent) {
        return new Response(JSON.stringify({ error: 'Intent not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!getIntentAllowedActions(intent.state as CampaignIntentState).includes('PUBLISH')) {
        await supabase.from('events').insert({
          event_id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          event_type: 'STATE_TRANSITION_BLOCKED',
          source: 'SYSTEM',
          entity_type: 'INTENT',
          entity_id: intentId,
          user_id: userId,
          action: 'PUBLISH',
          reason: `Cannot publish in ${intent.state} state`,
        });
        
        return new Response(JSON.stringify({
          error: 'INVALID_TRANSITION',
          message: `Cannot publish in ${intent.state} state. Must be READY_TO_PUBLISH.`,
          currentState: intent.state,
          allowedActions: getIntentAllowedActions(intent.state as CampaignIntentState),
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Fetch assets and accounts for guard validation
      const { data: assets } = await supabase
        .from('assets')
        .select('*')
        .in('id', intent.asset_ids || []);

      const { data: accounts } = await supabase
        .from('ad_account_connections')
        .select('*')
        .in('id', intent.account_ids || []);

      const targetPlatforms = [...new Set((accounts || []).map(a => a.platform))];

      // RUN GUARDS
      const guardResult = guardCampaignPublish({
        assets: (assets || []).map(a => ({
          id: a.id,
          state: a.state,
          risk_score: a.risk_score,
          platform_compatibility: a.platform_compatibility,
        })),
        accounts: (accounts || []).map(a => ({
          id: a.id,
          status: a.status,
          permissions: a.permissions || {},
          platform: a.platform,
        })),
        audience: intent.audience || {},
        objective: intent.objective,
        targetPlatforms,
      });

      if (!guardResult.allowed) {
        await supabase.from('events').insert({
          event_id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          event_type: 'CAMPAIGN_BLOCKED',
          source: 'SYSTEM',
          entity_type: 'INTENT',
          entity_id: intentId,
          user_id: userId,
          action: 'PUBLISH',
          reason: guardResult.reason,
          metadata: { guardName: 'guardCampaignPublish' },
        });

        return new Response(JSON.stringify({
          error: 'GUARD_BLOCKED',
          guardName: 'guardCampaignPublish',
          message: guardResult.reason,
          currentState: intent.state,
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Create campaigns for each platform
      const createdCampaigns = [];
      for (const account of (accounts || [])) {
        const { data: campaign, error: campaignError } = await supabase
          .from('campaigns')
          .insert({
            intent_id: intentId,
            project_id: intent.project_id,
            user_id: userId,
            platform: account.platform,
            account_id: account.id,
            name: intent.name,
            objective: intent.objective,
            state: 'ACTIVE',
            budget_daily: intent.budget?.daily,
            budget_total: intent.budget?.total,
          })
          .select()
          .single();

        if (campaignError) throw campaignError;
        createdCampaigns.push(campaign);

        await supabase.from('events').insert({
          event_id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          event_type: 'CAMPAIGN_PUBLISHED',
          source: 'UI',
          entity_type: 'CAMPAIGN',
          entity_id: campaign.id,
          user_id: userId,
          new_state: 'ACTIVE',
          metadata: { platform: account.platform, accountId: account.id },
        });
      }

      // Update intent state
      await supabase
        .from('campaign_intents')
        .update({ state: 'PUBLISHING' })
        .eq('id', intentId);

      return new Response(JSON.stringify({
        success: true,
        campaigns: createdCampaigns,
        message: `Published ${createdCampaigns.length} campaign(s)`,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /campaigns/{id}/pause - Pause campaign
    if (req.method === 'POST' && pathParts.length === 3 && pathParts[2] === 'pause') {
      const campaignId = pathParts[1];
      
      const { data: campaign, error: fetchError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .maybeSingle();
      
      if (fetchError) throw fetchError;
      if (!campaign) {
        return new Response(JSON.stringify({ error: 'Campaign not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!getCampaignAllowedActions(campaign.state as CampaignState).includes('PAUSE')) {
        return new Response(JSON.stringify({
          error: 'INVALID_TRANSITION',
          message: `Cannot pause campaign in ${campaign.state} state`,
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: updated, error } = await supabase
        .from('campaigns')
        .update({ state: 'USER_PAUSED', paused_by_user: true })
        .eq('id', campaignId)
        .select()
        .single();

      if (error) throw error;

      await supabase.from('events').insert({
        event_id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        event_type: 'CAMPAIGN_PAUSED',
        source: 'UI',
        entity_type: 'CAMPAIGN',
        entity_id: campaignId,
        user_id: userId,
        previous_state: campaign.state,
        new_state: 'USER_PAUSED',
      });

      return new Response(JSON.stringify({
        ...updated,
        allowedActions: getCampaignAllowedActions('USER_PAUSED'),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /campaigns/{id}/resume - Resume campaign
    if (req.method === 'POST' && pathParts.length === 3 && pathParts[2] === 'resume') {
      const campaignId = pathParts[1];
      
      const { data: campaign, error: fetchError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .maybeSingle();
      
      if (fetchError) throw fetchError;
      if (!campaign) {
        return new Response(JSON.stringify({ error: 'Campaign not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!getCampaignAllowedActions(campaign.state as CampaignState).includes('RESUME')) {
        return new Response(JSON.stringify({
          error: 'INVALID_TRANSITION',
          message: `Cannot resume campaign in ${campaign.state} state`,
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: updated, error } = await supabase
        .from('campaigns')
        .update({ state: 'ACTIVE', paused_by_user: false })
        .eq('id', campaignId)
        .select()
        .single();

      if (error) throw error;

      await supabase.from('events').insert({
        event_id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        event_type: 'CAMPAIGN_RESUMED',
        source: 'UI',
        entity_type: 'CAMPAIGN',
        entity_id: campaignId,
        user_id: userId,
        previous_state: campaign.state,
        new_state: 'ACTIVE',
      });

      return new Response(JSON.stringify({
        ...updated,
        allowedActions: getCampaignAllowedActions('ACTIVE'),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[campaigns] Error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
