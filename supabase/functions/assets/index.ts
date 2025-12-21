import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest, createUserClient, extractBearerToken, unauthorizedResponse } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * ASSET STATE MACHINE with STATE GUARDS + JWT Authentication
 * 
 * All operations require a valid JWT token and are scoped to auth.uid()
 */

type AssetState = 'UPLOADED' | 'ANALYZING' | 'APPROVED' | 'BLOCKED' | 'READY_FOR_LAUNCH' | 'USED_IN_CAMPAIGN';
type AssetAction = 
  | 'ANALYZE'
  | 'VIEW_AI_DECISION'
  | 'MARK_READY_FOR_LAUNCH'
  | 'UNMARK_READY'
  | 'RE_ANALYZE'
  | 'GENERATE_SAFE_VARIANT'
  | 'SELECT_FOR_PUBLISH';

interface AssetStateConfig {
  allowedActions: AssetAction[];
  canTransitionTo: AssetState[];
}

const ASSET_STATE_CONFIG: Record<AssetState, AssetStateConfig> = {
  UPLOADED: {
    allowedActions: ['ANALYZE'],
    canTransitionTo: ['ANALYZING'],
  },
  ANALYZING: {
    allowedActions: [],
    canTransitionTo: ['APPROVED', 'BLOCKED'],
  },
  APPROVED: {
    allowedActions: ['VIEW_AI_DECISION', 'MARK_READY_FOR_LAUNCH', 'RE_ANALYZE'],
    canTransitionTo: ['READY_FOR_LAUNCH', 'ANALYZING'],
  },
  BLOCKED: {
    allowedActions: ['VIEW_AI_DECISION', 'RE_ANALYZE', 'GENERATE_SAFE_VARIANT'],
    canTransitionTo: ['ANALYZING'],
  },
  READY_FOR_LAUNCH: {
    allowedActions: ['VIEW_AI_DECISION', 'UNMARK_READY', 'SELECT_FOR_PUBLISH'],
    canTransitionTo: ['APPROVED', 'USED_IN_CAMPAIGN'],
  },
  USED_IN_CAMPAIGN: {
    allowedActions: ['VIEW_AI_DECISION'],
    canTransitionTo: [],
  },
};

// ============================================================================
// PURE GUARD FUNCTIONS
// ============================================================================

interface GuardResult {
  allowed: boolean;
  reason?: string;
}

interface AssetReadyGuardConfig {
  riskThreshold: number;
}

function guardAssetReadyForLaunch(
  asset: {
    state: string;
    risk_score?: number | null;
    platform_compatibility?: string[];
  },
  config: AssetReadyGuardConfig = { riskThreshold: 50 },
  targetPlatform?: string
): GuardResult {
  if (asset.state !== 'APPROVED') {
    return {
      allowed: false,
      reason: `Asset must be APPROVED to mark ready. Current state: ${asset.state}`,
    };
  }

  if (asset.risk_score !== null && asset.risk_score !== undefined) {
    if (asset.risk_score > config.riskThreshold) {
      return {
        allowed: false,
        reason: `Asset risk score (${asset.risk_score}) exceeds threshold (${config.riskThreshold})`,
      };
    }
  }

  if (targetPlatform && asset.platform_compatibility) {
    if (!asset.platform_compatibility.includes(targetPlatform)) {
      return {
        allowed: false,
        reason: `Asset not compatible with platform: ${targetPlatform}. Compatible: ${asset.platform_compatibility.join(', ')}`,
      };
    }
  }

  return { allowed: true };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getAllowedActions(state: AssetState): AssetAction[] {
  return ASSET_STATE_CONFIG[state]?.allowedActions || [];
}

function isActionAllowed(state: AssetState, action: AssetAction): boolean {
  return getAllowedActions(state).includes(action);
}

function canTransition(currentState: AssetState, targetState: AssetState): boolean {
  return ASSET_STATE_CONFIG[currentState]?.canTransitionTo.includes(targetState) || false;
}

const RISK_THRESHOLD = 50;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ===================== JWT AUTHENTICATION =====================
  const authResult = await authenticateRequest(req);
  if (!authResult.authenticated) {
    console.error('[assets] Auth failed:', authResult.error);
    return unauthorizedResponse(authResult.error || 'Unauthorized', corsHeaders);
  }
  
  const userId = authResult.userId!;
  const token = extractBearerToken(req)!;
  const supabase = createUserClient(token);
  
  console.log(`[assets] Authenticated user: ${userId}`);
  // ==============================================================

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  
  console.log(`[assets] ${req.method} ${url.pathname}`);

  try {
    // GET /assets - List user's assets
    if (req.method === 'GET' && pathParts.length === 1) {
      const { data: assets, error } = await supabase
        .from('assets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[assets] DB error:', error);
        throw error;
      }

      const enrichedAssets = (assets || []).map(asset => ({
        ...asset,
        allowedActions: getAllowedActions(asset.state as AssetState),
      }));

      return new Response(JSON.stringify({ assets: enrichedAssets }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /assets/{id} - Get single asset
    if (req.method === 'GET' && pathParts.length === 2 && pathParts[1] !== 'events') {
      const assetId = pathParts[1];
      
      const { data: asset, error } = await supabase
        .from('assets')
        .select('*')
        .eq('id', assetId)
        .maybeSingle();
      
      if (error) {
        console.error('[assets] DB error:', error);
        throw error;
      }
      
      if (!asset) {
        return new Response(JSON.stringify({ error: 'Asset not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        ...asset,
        allowedActions: getAllowedActions(asset.state as AssetState),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /assets - Create new asset
    if (req.method === 'POST' && pathParts.length === 1) {
      const body = await req.json();
      
      // Get or create default project
      let projectId = body.project_id;
      if (!projectId) {
        const { data: projects } = await supabase
          .from('projects')
          .select('id')
          .limit(1);
        
        if (projects && projects.length > 0) {
          projectId = projects[0].id;
        } else {
          // Create default project
          const { data: newProject, error: projectError } = await supabase
            .from('projects')
            .insert({ user_id: userId })
            .select()
            .single();
          
          if (projectError) throw projectError;
          projectId = newProject.id;
        }
      }
      
      const { data: newAsset, error } = await supabase
        .from('assets')
        .insert({
          project_id: projectId,
          user_id: userId,
          name: body.name,
          type: body.type,
          url: body.url,
          content: body.content,
          state: 'UPLOADED',
          platform_compatibility: body.platform_compatibility || ['GOOGLE', 'TIKTOK', 'SNAPCHAT'],
        })
        .select()
        .single();
      
      if (error) {
        console.error('[assets] Insert error:', error);
        throw error;
      }
      
      console.log(`[assets] Created asset ${newAsset.id} for user ${userId}`);

      // Emit event
      await supabase.from('events').insert({
        event_id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        event_type: 'ASSET_UPLOADED',
        source: 'UI',
        entity_type: 'ASSET',
        entity_id: newAsset.id,
        user_id: userId,
        new_state: 'UPLOADED',
      });

      return new Response(JSON.stringify({
        ...newAsset,
        allowedActions: getAllowedActions('UPLOADED'),
      }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /assets/{id}/analyze - Trigger AI analysis
    if (req.method === 'POST' && pathParts.length === 3 && pathParts[2] === 'analyze') {
      const assetId = pathParts[1];
      
      const { data: asset, error: fetchError } = await supabase
        .from('assets')
        .select('*')
        .eq('id', assetId)
        .maybeSingle();
      
      if (fetchError) throw fetchError;
      if (!asset) {
        return new Response(JSON.stringify({ error: 'Asset not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const currentState = asset.state as AssetState;
      if (!isActionAllowed(currentState, 'ANALYZE') && !isActionAllowed(currentState, 'RE_ANALYZE')) {
        await supabase.from('events').insert({
          event_id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          event_type: 'STATE_TRANSITION_BLOCKED',
          source: 'SYSTEM',
          entity_type: 'ASSET',
          entity_id: assetId,
          user_id: userId,
          action: 'ANALYZE',
          reason: `Cannot analyze in ${currentState} state`,
        });
        
        return new Response(JSON.stringify({
          error: 'INVALID_TRANSITION',
          message: `Cannot analyze asset in ${currentState} state`,
          currentState,
          allowedActions: getAllowedActions(currentState),
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Update to ANALYZING state
      const { error: updateError } = await supabase
        .from('assets')
        .update({ state: 'ANALYZING' })
        .eq('id', assetId);
      
      if (updateError) throw updateError;

      await supabase.from('events').insert({
        event_id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        event_type: 'ASSET_ANALYZING',
        source: 'SYSTEM',
        entity_type: 'ASSET',
        entity_id: assetId,
        user_id: userId,
        previous_state: currentState,
        new_state: 'ANALYZING',
      });

      // Simulate async analysis (in production, this would be a background job)
      const approved = Math.random() > 0.3;
      const riskScore = approved ? Math.floor(Math.random() * 40) : 50 + Math.floor(Math.random() * 50);
      const qualityScore = 50 + Math.floor(Math.random() * 50);
      const newState = approved ? 'APPROVED' : 'BLOCKED';
      
      // Update with analysis results (simulated delay would be handled differently in production)
      await supabase
        .from('assets')
        .update({
          state: newState,
          risk_score: riskScore,
          quality_score: qualityScore,
          issues: approved ? [] : [{ severity: 'high', message: 'Policy violation detected' }],
        })
        .eq('id', assetId);

      await supabase.from('events').insert({
        event_id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        event_type: approved ? 'ASSET_APPROVED' : 'ASSET_BLOCKED',
        source: 'AI',
        entity_type: 'ASSET',
        entity_id: assetId,
        user_id: userId,
        previous_state: 'ANALYZING',
        new_state: newState,
        metadata: { riskScore, qualityScore },
      });

      return new Response(JSON.stringify({
        id: assetId,
        state: newState,
        risk_score: riskScore,
        quality_score: qualityScore,
        allowedActions: getAllowedActions(newState as AssetState),
        message: 'Analysis complete',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /assets/{id}/mark-ready - Mark as ready for launch (WITH GUARDS)
    if (req.method === 'POST' && pathParts.length === 3 && pathParts[2] === 'mark-ready') {
      const assetId = pathParts[1];
      const body = await req.json().catch(() => ({}));
      const targetPlatform = body.targetPlatform;
      
      const { data: asset, error: fetchError } = await supabase
        .from('assets')
        .select('*')
        .eq('id', assetId)
        .maybeSingle();
      
      if (fetchError) throw fetchError;
      if (!asset) {
        return new Response(JSON.stringify({ error: 'Asset not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const currentState = asset.state as AssetState;
      if (!isActionAllowed(currentState, 'MARK_READY_FOR_LAUNCH')) {
        await supabase.from('events').insert({
          event_id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          event_type: 'STATE_TRANSITION_BLOCKED',
          source: 'SYSTEM',
          entity_type: 'ASSET',
          entity_id: assetId,
          user_id: userId,
          action: 'MARK_READY_FOR_LAUNCH',
          reason: `Action not allowed in ${currentState} state`,
        });
        
        return new Response(JSON.stringify({
          error: 'INVALID_TRANSITION',
          message: `Cannot mark asset ready in ${currentState} state. Must be APPROVED first.`,
          currentState,
          allowedActions: getAllowedActions(currentState),
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // RUN STATE GUARDS
      const guardResult = guardAssetReadyForLaunch(
        {
          state: asset.state,
          risk_score: asset.risk_score,
          platform_compatibility: asset.platform_compatibility,
        },
        { riskThreshold: RISK_THRESHOLD },
        targetPlatform
      );

      if (!guardResult.allowed) {
        await supabase.from('events').insert({
          event_id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          event_type: 'STATE_GUARD_BLOCKED',
          source: 'SYSTEM',
          entity_type: 'ASSET',
          entity_id: assetId,
          user_id: userId,
          action: 'MARK_READY_FOR_LAUNCH',
          reason: guardResult.reason,
          metadata: { guardName: 'guardAssetReadyForLaunch', riskScore: asset.risk_score, targetPlatform },
        });

        return new Response(JSON.stringify({
          error: 'GUARD_BLOCKED',
          guardName: 'guardAssetReadyForLaunch',
          message: guardResult.reason,
          currentState,
          allowedActions: getAllowedActions(currentState),
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // All guards passed - execute transition
      const { data: updatedAsset, error: updateError } = await supabase
        .from('assets')
        .update({ state: 'READY_FOR_LAUNCH' })
        .eq('id', assetId)
        .select()
        .single();
      
      if (updateError) throw updateError;

      await supabase.from('events').insert({
        event_id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        event_type: 'ASSET_MARKED_READY',
        source: 'UI',
        entity_type: 'ASSET',
        entity_id: assetId,
        user_id: userId,
        previous_state: currentState,
        new_state: 'READY_FOR_LAUNCH',
      });

      return new Response(JSON.stringify({
        ...updatedAsset,
        allowedActions: getAllowedActions('READY_FOR_LAUNCH'),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /assets/{id}/unmark-ready - Remove ready status
    if (req.method === 'POST' && pathParts.length === 3 && pathParts[2] === 'unmark-ready') {
      const assetId = pathParts[1];
      
      const { data: asset, error: fetchError } = await supabase
        .from('assets')
        .select('*')
        .eq('id', assetId)
        .maybeSingle();
      
      if (fetchError) throw fetchError;
      if (!asset) {
        return new Response(JSON.stringify({ error: 'Asset not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const currentState = asset.state as AssetState;
      if (!isActionAllowed(currentState, 'UNMARK_READY')) {
        return new Response(JSON.stringify({
          error: 'INVALID_TRANSITION',
          message: `Cannot unmark asset in ${currentState} state`,
          currentState,
          allowedActions: getAllowedActions(currentState),
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: updatedAsset, error: updateError } = await supabase
        .from('assets')
        .update({ state: 'APPROVED' })
        .eq('id', assetId)
        .select()
        .single();
      
      if (updateError) throw updateError;

      await supabase.from('events').insert({
        event_id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        event_type: 'ASSET_UNMARKED_READY',
        source: 'UI',
        entity_type: 'ASSET',
        entity_id: assetId,
        user_id: userId,
        previous_state: currentState,
        new_state: 'APPROVED',
      });

      return new Response(JSON.stringify({
        ...updatedAsset,
        allowedActions: getAllowedActions('APPROVED'),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // DELETE /assets/{id} - Delete asset
    if (req.method === 'DELETE' && pathParts.length === 2) {
      const assetId = pathParts[1];
      
      const { error } = await supabase
        .from('assets')
        .delete()
        .eq('id', assetId);
      
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
    console.error('[assets] Error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
