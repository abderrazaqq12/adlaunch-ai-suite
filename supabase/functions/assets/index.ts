import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * ASSET STATE MACHINE
 * 
 * States:
 * - UPLOADED: Asset uploaded, no AI analysis yet
 * - ANALYZING: AI compliance running (transient)
 * - APPROVED: Passed AI compliance
 * - BLOCKED: Failed compliance
 * - READY_FOR_LAUNCH: Approved + user confirmed ready
 * - USED_IN_CAMPAIGN: Currently used in active campaign
 * 
 * Valid Transitions:
 * UPLOADED → ANALYZING (via analyze action)
 * ANALYZING → APPROVED | BLOCKED (automatic after analysis)
 * APPROVED → READY_FOR_LAUNCH (via mark-ready action)
 * APPROVED → ANALYZING (via re-analyze action)
 * READY_FOR_LAUNCH → APPROVED (via unmark-ready action)
 * READY_FOR_LAUNCH → USED_IN_CAMPAIGN (automatic on campaign publish)
 * BLOCKED → ANALYZING (via re-analyze action)
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

// State machine configuration - single source of truth
const ASSET_STATE_CONFIG: Record<AssetState, AssetStateConfig> = {
  UPLOADED: {
    allowedActions: ['ANALYZE'],
    canTransitionTo: ['ANALYZING'],
  },
  ANALYZING: {
    allowedActions: [], // No actions allowed during analysis
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
    canTransitionTo: [], // Cannot transition out while in campaign
  },
};

function getAllowedActions(state: AssetState): AssetAction[] {
  return ASSET_STATE_CONFIG[state]?.allowedActions || [];
}

function isActionAllowed(state: AssetState, action: AssetAction): boolean {
  return getAllowedActions(state).includes(action);
}

function canTransition(currentState: AssetState, targetState: AssetState): boolean {
  return ASSET_STATE_CONFIG[currentState]?.canTransitionTo.includes(targetState) || false;
}

// Mock database (in production, use Supabase tables)
const mockAssets: Map<string, any> = new Map();

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  
  console.log(`[assets] ${req.method} ${url.pathname}`);

  try {
    // GET /assets - List all assets with state and allowed actions
    if (req.method === 'GET' && pathParts.length === 1) {
      const assets = Array.from(mockAssets.values()).map(asset => ({
        id: asset.id,
        type: asset.type,
        name: asset.name,
        state: asset.state,
        riskScore: asset.riskScore || null,
        qualityScore: asset.qualityScore || null,
        allowedActions: getAllowedActions(asset.state),
        createdAt: asset.createdAt,
        updatedAt: asset.updatedAt,
      }));

      return new Response(JSON.stringify({ assets }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /assets/{id} - Get single asset with full details
    if (req.method === 'GET' && pathParts.length === 2) {
      const assetId = pathParts[1];
      const asset = mockAssets.get(assetId);
      
      if (!asset) {
        return new Response(JSON.stringify({ error: 'Asset not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        ...asset,
        allowedActions: getAllowedActions(asset.state),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /assets - Create new asset (starts in UPLOADED state)
    if (req.method === 'POST' && pathParts.length === 1) {
      const body = await req.json();
      const assetId = `asset_${Date.now()}`;
      const now = new Date().toISOString();
      
      const newAsset = {
        id: assetId,
        type: body.type,
        name: body.name,
        url: body.url,
        content: body.content,
        state: 'UPLOADED' as AssetState,
        riskScore: null,
        qualityScore: null,
        issues: [],
        rejectionReasons: [],
        createdAt: now,
        updatedAt: now,
      };
      
      mockAssets.set(assetId, newAsset);
      console.log(`[assets] Created asset ${assetId} in UPLOADED state`);

      return new Response(JSON.stringify({
        ...newAsset,
        allowedActions: getAllowedActions(newAsset.state),
      }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /assets/{id}/analyze - Trigger AI analysis
    if (req.method === 'POST' && pathParts.length === 3 && pathParts[2] === 'analyze') {
      const assetId = pathParts[1];
      const asset = mockAssets.get(assetId);
      
      if (!asset) {
        return new Response(JSON.stringify({ error: 'Asset not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ENFORCE STATE MACHINE: Only UPLOADED or re-analyzable states can analyze
      if (!isActionAllowed(asset.state, 'ANALYZE') && !isActionAllowed(asset.state, 'RE_ANALYZE')) {
        console.log(`[assets] REJECTED: Cannot analyze asset in ${asset.state} state`);
        return new Response(JSON.stringify({
          error: 'INVALID_TRANSITION',
          message: `Cannot analyze asset in ${asset.state} state`,
          currentState: asset.state,
          allowedActions: getAllowedActions(asset.state),
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Transition to ANALYZING
      asset.state = 'ANALYZING';
      asset.updatedAt = new Date().toISOString();
      mockAssets.set(assetId, asset);
      console.log(`[assets] Asset ${assetId} transitioned to ANALYZING`);

      // In production, this would call the analyze-asset function
      // For now, simulate async analysis with random result
      setTimeout(() => {
        const approved = Math.random() > 0.3; // 70% approval rate
        asset.state = approved ? 'APPROVED' : 'BLOCKED';
        asset.riskScore = approved ? Math.floor(Math.random() * 40) : 50 + Math.floor(Math.random() * 50);
        asset.qualityScore = 50 + Math.floor(Math.random() * 50);
        asset.issues = approved ? [] : [{ severity: 'high', message: 'Policy violation detected' }];
        asset.updatedAt = new Date().toISOString();
        mockAssets.set(assetId, asset);
        console.log(`[assets] Asset ${assetId} analysis complete: ${asset.state}`);
      }, 2000);

      return new Response(JSON.stringify({
        id: assetId,
        state: 'ANALYZING',
        allowedActions: getAllowedActions('ANALYZING'),
        message: 'Analysis started',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /assets/{id}/mark-ready - Mark as ready for launch
    if (req.method === 'POST' && pathParts.length === 3 && pathParts[2] === 'mark-ready') {
      const assetId = pathParts[1];
      const asset = mockAssets.get(assetId);
      
      if (!asset) {
        return new Response(JSON.stringify({ error: 'Asset not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ENFORCE STATE MACHINE: Only APPROVED can mark ready
      if (!isActionAllowed(asset.state, 'MARK_READY_FOR_LAUNCH')) {
        console.log(`[assets] REJECTED: Cannot mark-ready asset in ${asset.state} state`);
        return new Response(JSON.stringify({
          error: 'INVALID_TRANSITION',
          message: `Cannot mark asset ready in ${asset.state} state. Must be APPROVED first.`,
          currentState: asset.state,
          allowedActions: getAllowedActions(asset.state),
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Validate transition
      if (!canTransition(asset.state, 'READY_FOR_LAUNCH')) {
        return new Response(JSON.stringify({
          error: 'INVALID_TRANSITION',
          message: `Cannot transition from ${asset.state} to READY_FOR_LAUNCH`,
          currentState: asset.state,
          allowedActions: getAllowedActions(asset.state),
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      asset.state = 'READY_FOR_LAUNCH';
      asset.updatedAt = new Date().toISOString();
      mockAssets.set(assetId, asset);
      console.log(`[assets] Asset ${assetId} marked READY_FOR_LAUNCH`);

      return new Response(JSON.stringify({
        ...asset,
        allowedActions: getAllowedActions(asset.state),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /assets/{id}/unmark-ready - Remove ready status
    if (req.method === 'POST' && pathParts.length === 3 && pathParts[2] === 'unmark-ready') {
      const assetId = pathParts[1];
      const asset = mockAssets.get(assetId);
      
      if (!asset) {
        return new Response(JSON.stringify({ error: 'Asset not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!isActionAllowed(asset.state, 'UNMARK_READY')) {
        console.log(`[assets] REJECTED: Cannot unmark-ready asset in ${asset.state} state`);
        return new Response(JSON.stringify({
          error: 'INVALID_TRANSITION',
          message: `Cannot unmark asset in ${asset.state} state`,
          currentState: asset.state,
          allowedActions: getAllowedActions(asset.state),
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      asset.state = 'APPROVED';
      asset.updatedAt = new Date().toISOString();
      mockAssets.set(assetId, asset);
      console.log(`[assets] Asset ${assetId} unmarked, back to APPROVED`);

      return new Response(JSON.stringify({
        ...asset,
        allowedActions: getAllowedActions(asset.state),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 404 for unknown routes
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[assets] Error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Internal error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
