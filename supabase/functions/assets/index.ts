import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * ASSET STATE MACHINE with STATE GUARDS
 * 
 * States:
 * - UPLOADED: Asset uploaded, no AI analysis yet
 * - ANALYZING: AI compliance running (transient)
 * - APPROVED: Passed AI compliance
 * - BLOCKED: Failed compliance
 * - READY_FOR_LAUNCH: Approved + user confirmed ready
 * - USED_IN_CAMPAIGN: Currently used in active campaign
 * 
 * GUARDS for READY_FOR_LAUNCH:
 * - asset.state === "APPROVED"
 * - asset.riskScore <= allowedThreshold (50)
 * - asset.platformCompatibility.includes(targetPlatform)
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

// State machine configuration
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

/**
 * ASSET → READY_FOR_LAUNCH Guard (Pure Function)
 */
function guardAssetReadyForLaunch(
  asset: {
    state: string;
    riskScore?: number | null;
    platformCompatibility?: string[];
  },
  config: AssetReadyGuardConfig = { riskThreshold: 50 },
  targetPlatform?: string
): GuardResult {
  // Guard 1: state must be APPROVED
  if (asset.state !== 'APPROVED') {
    return {
      allowed: false,
      reason: `Asset must be APPROVED to mark ready. Current state: ${asset.state}`,
    };
  }

  // Guard 2: riskScore must be within threshold
  if (asset.riskScore !== null && asset.riskScore !== undefined) {
    if (asset.riskScore > config.riskThreshold) {
      return {
        allowed: false,
        reason: `Asset risk score (${asset.riskScore}) exceeds threshold (${config.riskThreshold})`,
      };
    }
  }

  // Guard 3: Platform compatibility
  if (targetPlatform && asset.platformCompatibility) {
    if (!asset.platformCompatibility.includes(targetPlatform)) {
      return {
        allowed: false,
        reason: `Asset not compatible with platform: ${targetPlatform}. Compatible: ${asset.platformCompatibility.join(', ')}`,
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

// Event log for BLOCKED_EVENTS (in production, call events function)
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
    entity: 'ASSET',
    entityId,
    action,
    reason,
    metadata: { guardName, ...context },
    timestamp: new Date().toISOString(),
  };
  blockedEvents.push(event);
  console.log(`[assets] GUARD_BLOCKED: ${guardName} - ${reason}`);
  return event;
}

// Mock database
const mockAssets: Map<string, any> = new Map();

// Risk threshold configuration
const RISK_THRESHOLD = 50;

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
        platformCompatibility: asset.platformCompatibility || [],
        allowedActions: getAllowedActions(asset.state),
        createdAt: asset.createdAt,
        updatedAt: asset.updatedAt,
      }));

      return new Response(JSON.stringify({ assets }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /assets/{id} - Get single asset
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

    // POST /assets - Create new asset
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
        platformCompatibility: body.platformCompatibility || ['GOOGLE', 'TIKTOK', 'SNAPCHAT'],
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

      // STATE MACHINE CHECK
      if (!isActionAllowed(asset.state, 'ANALYZE') && !isActionAllowed(asset.state, 'RE_ANALYZE')) {
        logBlockedEvent(assetId, 'ANALYZE', `Cannot analyze in ${asset.state} state`, 'STATE_MACHINE');
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

      asset.state = 'ANALYZING';
      asset.updatedAt = new Date().toISOString();
      mockAssets.set(assetId, asset);
      console.log(`[assets] Asset ${assetId} transitioned to ANALYZING`);

      // Simulate async analysis
      setTimeout(() => {
        const approved = Math.random() > 0.3;
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

    // POST /assets/{id}/mark-ready - Mark as ready for launch (WITH GUARDS)
    if (req.method === 'POST' && pathParts.length === 3 && pathParts[2] === 'mark-ready') {
      const assetId = pathParts[1];
      const body = await req.json().catch(() => ({}));
      const targetPlatform = body.targetPlatform;
      
      const asset = mockAssets.get(assetId);
      
      if (!asset) {
        return new Response(JSON.stringify({ error: 'Asset not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // STATE MACHINE CHECK
      if (!isActionAllowed(asset.state, 'MARK_READY_FOR_LAUNCH')) {
        logBlockedEvent(assetId, 'MARK_READY_FOR_LAUNCH', `Action not allowed in ${asset.state} state`, 'STATE_MACHINE');
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

      // RUN STATE GUARDS (Pure function - evaluated BEFORE side effects)
      const guardResult = guardAssetReadyForLaunch(
        {
          state: asset.state,
          riskScore: asset.riskScore,
          platformCompatibility: asset.platformCompatibility,
        },
        { riskThreshold: RISK_THRESHOLD },
        targetPlatform
      );

      if (!guardResult.allowed) {
        // Log BLOCKED_EVENT
        logBlockedEvent(
          assetId,
          'MARK_READY_FOR_LAUNCH',
          guardResult.reason!,
          'guardAssetReadyForLaunch',
          { riskScore: asset.riskScore, targetPlatform }
        );

        return new Response(JSON.stringify({
          error: 'GUARD_BLOCKED',
          guardName: 'guardAssetReadyForLaunch',
          message: guardResult.reason,
          currentState: asset.state,
          allowedActions: getAllowedActions(asset.state),
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // TRANSITION CHECK
      if (!canTransition(asset.state, 'READY_FOR_LAUNCH')) {
        logBlockedEvent(assetId, 'MARK_READY_FOR_LAUNCH', `Invalid transition from ${asset.state}`, 'TRANSITION');
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

      // All guards passed - execute transition
      asset.state = 'READY_FOR_LAUNCH';
      asset.updatedAt = new Date().toISOString();
      mockAssets.set(assetId, asset);
      console.log(`[assets] Asset ${assetId} marked READY_FOR_LAUNCH (guards passed)`);

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
        logBlockedEvent(assetId, 'UNMARK_READY', `Action not allowed in ${asset.state} state`, 'STATE_MACHINE');
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

    // GET /assets/blocked-events - Get blocked event log
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
    console.error('[assets] Error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Internal error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
