import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * CAMPAIGN STATE MACHINE with STATE GUARDS
 * 
 * Campaign Intent States (before publish):
 * - DRAFT: Initial creation
 * - VALIDATING: Backend validation in progress
 * - READY_TO_PUBLISH: All validations passed
 * - PUBLISHING: Publish in progress
 * - FAILED: Publish failed
 * 
 * Campaign States (after publish):
 * - ACTIVE: Running campaign
 * - PAUSED: User or AI paused
 * - STOPPED: Permanently stopped
 * - DISAPPROVED: Platform rejected
 * - RECOVERY: In recovery process
 * - USER_PAUSED: Explicitly paused by user (blocks automation)
 * 
 * GUARDS for PUBLISH:
 * - at least 1 READY_FOR_LAUNCH asset
 * - adAccount.permissions includes "LAUNCH"
 * - audience.isValid === true
 * - objective === "CONVERSION"
 * - platform supports conversion campaigns
 */

type CampaignIntentState = 'DRAFT' | 'VALIDATING' | 'READY_TO_PUBLISH' | 'PUBLISHING' | 'FAILED';
type CampaignState = 'ACTIVE' | 'PAUSED' | 'STOPPED' | 'DISAPPROVED' | 'RECOVERY' | 'USER_PAUSED';

type CampaignIntentAction = 'VALIDATE' | 'PUBLISH' | 'EDIT' | 'DISCARD';
type CampaignAction = 'PAUSE' | 'RESUME' | 'STOP' | 'VIEW_METRICS';

// Platforms that support conversion campaigns
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
    riskScore?: number | null;
    platformCompatibility?: string[];
  }>;
  accounts: Array<{
    id: string;
    state: string;
    permissions: string[];
    platform: string;
  }>;
  audience: {
    country?: string;
    language?: string;
    gender?: string;
    ageMin?: number;
    ageMax?: number;
    isValid?: boolean;
  };
  objective: string;
  targetPlatforms: string[];
}

/**
 * CAMPAIGN → PUBLISH Guard (Pure Function)
 */
function guardCampaignPublish(input: CampaignPublishGuardInput): GuardResult {
  // Guard 1: At least 1 READY_FOR_LAUNCH asset
  const readyAssets = input.assets.filter(a => a.state === 'READY_FOR_LAUNCH');
  if (readyAssets.length === 0) {
    return {
      allowed: false,
      reason: 'At least one asset must be in READY_FOR_LAUNCH state',
    };
  }

  // Guard 2: All accounts must have LAUNCH permission
  const accountsWithoutLaunch = input.accounts.filter(
    a => !a.permissions.includes('LAUNCH')
  );
  if (accountsWithoutLaunch.length > 0) {
    const accountIds = accountsWithoutLaunch.map(a => a.id).join(', ');
    return {
      allowed: false,
      reason: `Ad accounts missing LAUNCH permission: ${accountIds}`,
    };
  }

  // Guard 3: Audience validation
  if (!input.audience.country || !input.audience.language) {
    const missingFields: string[] = [];
    if (!input.audience.country) missingFields.push('country');
    if (!input.audience.language) missingFields.push('language');
    
    return {
      allowed: false,
      reason: `Invalid audience configuration. Missing: ${missingFields.join(', ')}`,
    };
  }

  // Guard 4: Objective must be CONVERSION
  if (input.objective !== 'CONVERSION') {
    return {
      allowed: false,
      reason: `Only CONVERSION objective is supported. Received: ${input.objective}`,
    };
  }

  // Guard 5: All target platforms must support conversion campaigns
  const unsupportedPlatforms = input.targetPlatforms.filter(
    p => !CONVERSION_SUPPORTED_PLATFORMS.includes(p.toUpperCase())
  );
  if (unsupportedPlatforms.length > 0) {
    return {
      allowed: false,
      reason: `Platform(s) do not support conversion campaigns: ${unsupportedPlatforms.join(', ')}`,
    };
  }

  // Guard 6: Assets must be compatible with target platforms
  for (const platform of input.targetPlatforms) {
    const compatibleAssets = readyAssets.filter(
      a => !a.platformCompatibility || a.platformCompatibility.includes(platform.toUpperCase())
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
// HELPER FUNCTIONS
// ============================================================================

const CAMPAIGN_INTENT_STATE_CONFIG: Record<CampaignIntentState, { allowedActions: CampaignIntentAction[] }> = {
  DRAFT: {
    allowedActions: ['VALIDATE', 'EDIT', 'DISCARD'],
  },
  VALIDATING: {
    allowedActions: [],
  },
  READY_TO_PUBLISH: {
    allowedActions: ['PUBLISH', 'EDIT', 'DISCARD'],
  },
  PUBLISHING: {
    allowedActions: [],
  },
  FAILED: {
    allowedActions: ['EDIT', 'DISCARD'],
  },
};

const CAMPAIGN_STATE_CONFIG: Record<CampaignState, { allowedActions: CampaignAction[] }> = {
  ACTIVE: {
    allowedActions: ['PAUSE', 'STOP', 'VIEW_METRICS'],
  },
  PAUSED: {
    allowedActions: ['RESUME', 'STOP', 'VIEW_METRICS'],
  },
  USER_PAUSED: {
    allowedActions: ['RESUME', 'STOP', 'VIEW_METRICS'],
  },
  STOPPED: {
    allowedActions: ['VIEW_METRICS'],
  },
  DISAPPROVED: {
    allowedActions: ['VIEW_METRICS'],
  },
  RECOVERY: {
    allowedActions: ['VIEW_METRICS'],
  },
};

function getIntentAllowedActions(state: CampaignIntentState): CampaignIntentAction[] {
  return CAMPAIGN_INTENT_STATE_CONFIG[state]?.allowedActions || [];
}

function getCampaignAllowedActions(state: CampaignState): CampaignAction[] {
  return CAMPAIGN_STATE_CONFIG[state]?.allowedActions || [];
}

function isIntentActionAllowed(state: CampaignIntentState, action: CampaignIntentAction): boolean {
  return getIntentAllowedActions(state).includes(action);
}

function isCampaignActionAllowed(state: CampaignState, action: CampaignAction): boolean {
  return getCampaignAllowedActions(state).includes(action);
}

// ============================================================================
// NORMALIZED EVENT EMISSION
// ============================================================================

type CampaignEventType = 
  | 'CAMPAIGN_INTENT_CREATED' | 'CAMPAIGN_INTENT_VALIDATED' 
  | 'CAMPAIGN_PUBLISHED' | 'CAMPAIGN_PAUSED' | 'CAMPAIGN_RESUMED' | 'CAMPAIGN_STOPPED'
  | 'CAMPAIGN_BLOCKED' | 'STATE_GUARD_BLOCKED' | 'STATE_TRANSITION_BLOCKED';

type EventSource = 'UI' | 'AI' | 'AUTOMATION' | 'SYSTEM';
type EntityType = 'CAMPAIGN' | 'INTENT';

interface NormalizedEvent {
  eventId: string;
  eventType: CampaignEventType;
  source: EventSource;
  entityType: EntityType;
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
  eventType: CampaignEventType,
  source: EventSource,
  entityType: EntityType,
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
  console.log(`[campaigns] EVENT: ${eventType} | ${entityType}/${entityId} | source=${source}`);
  return event;
}

// Mock databases
const mockIntents: Map<string, any> = new Map();
const mockCampaigns: Map<string, any> = new Map();

// Mock asset/account data for guard validation
const mockAssetStore: Map<string, any> = new Map();
const mockAccountStore: Map<string, any> = new Map();

// Initialize some mock accounts
mockAccountStore.set('acc_google_1', {
  id: 'acc_google_1',
  platform: 'GOOGLE',
  state: 'CONNECTED',
  permissions: ['ANALYZE', 'LAUNCH'],
});
mockAccountStore.set('acc_tiktok_1', {
  id: 'acc_tiktok_1',
  platform: 'TIKTOK',
  state: 'CONNECTED',
  permissions: ['ANALYZE', 'LAUNCH'],
});
mockAccountStore.set('acc_snapchat_1', {
  id: 'acc_snapchat_1',
  platform: 'SNAPCHAT',
  state: 'CONNECTED',
  permissions: ['ANALYZE'], // No LAUNCH permission - will fail guard
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  
  console.log(`[campaigns] ${req.method} ${url.pathname}`);

  try {
    // POST /campaigns/validate - Validate campaign intent
    if (req.method === 'POST' && pathParts.length === 2 && pathParts[1] === 'validate') {
      const body = await req.json();
      const { assets, accounts, audience, objective } = body;

      // Basic validation
      const errors: string[] = [];
      
      if (!assets || assets.length === 0) {
        errors.push('At least one asset is required');
      }
      
      if (!accounts || accounts.length === 0) {
        errors.push('At least one ad account is required');
      }
      
      if (!audience?.country) {
        errors.push('Target country is required');
      }
      
      if (!audience?.language) {
        errors.push('Target language is required');
      }
      
      if (objective !== 'CONVERSION') {
        errors.push('Only CONVERSION objective is supported');
      }

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

      // Create intent
      const intentId = `intent_${Date.now()}`;
      const now = new Date().toISOString();
      
      const intent = {
        id: intentId,
        assets,
        accounts,
        audience,
        objective,
        state: 'VALIDATING' as CampaignIntentState,
        errors: [],
        createdAt: now,
        updatedAt: now,
      };
      
      mockIntents.set(intentId, intent);

      // Simulate async validation
      setTimeout(() => {
        const i = mockIntents.get(intentId);
        if (i && i.state === 'VALIDATING') {
          i.state = 'READY_TO_PUBLISH';
          i.updatedAt = new Date().toISOString();
          mockIntents.set(intentId, i);
          console.log(`[campaigns] Intent ${intentId} validated, ready to publish`);
        }
      }, 1500);

      return new Response(JSON.stringify({
        id: intentId,
        state: 'VALIDATING',
        allowedActions: getIntentAllowedActions('VALIDATING'),
        message: 'Validation in progress',
      }), {
        status: 202,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /campaigns/intents/{id} - Get intent status
    if (req.method === 'GET' && pathParts.length === 3 && pathParts[1] === 'intents') {
      const intentId = pathParts[2];
      const intent = mockIntents.get(intentId);
      
      if (!intent) {
        return new Response(JSON.stringify({ error: 'Intent not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        ...intent,
        allowedActions: getIntentAllowedActions(intent.state),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /campaigns/intents/{id}/publish - Publish campaign (WITH GUARDS)
    if (req.method === 'POST' && pathParts.length === 4 && pathParts[1] === 'intents' && pathParts[3] === 'publish') {
      const intentId = pathParts[2];
      const body = await req.json().catch(() => ({}));
      const intent = mockIntents.get(intentId);
      
      if (!intent) {
        return new Response(JSON.stringify({ error: 'Intent not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // STATE MACHINE CHECK
      if (!isIntentActionAllowed(intent.state, 'PUBLISH')) {
        emitEvent('STATE_TRANSITION_BLOCKED', 'SYSTEM', 'INTENT', intentId, {
          action: 'PUBLISH',
          reason: `Cannot publish in ${intent.state} state`,
          metadata: { currentState: intent.state },
        });
        return new Response(JSON.stringify({
          error: 'INVALID_TRANSITION',
          message: `Cannot publish in ${intent.state} state. Must be READY_TO_PUBLISH.`,
          currentState: intent.state,
          allowedActions: getIntentAllowedActions(intent.state),
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // RESOLVE ASSET AND ACCOUNT DETAILS FOR GUARD
      // In production, fetch from database
      const assetDetails = (body.assetDetails || []).length > 0 
        ? body.assetDetails 
        : intent.assets.map((id: string) => ({
            id,
            state: mockAssetStore.get(id)?.state || 'READY_FOR_LAUNCH', // Default for testing
            riskScore: mockAssetStore.get(id)?.riskScore || 20,
            platformCompatibility: mockAssetStore.get(id)?.platformCompatibility || ['GOOGLE', 'TIKTOK', 'SNAPCHAT'],
          }));

      const accountDetails = intent.accounts.map((id: string) => {
        const acc = mockAccountStore.get(id);
        return acc || {
          id,
          state: 'CONNECTED',
          permissions: ['ANALYZE', 'LAUNCH'],
          platform: id.includes('google') ? 'GOOGLE' : id.includes('tiktok') ? 'TIKTOK' : 'SNAPCHAT',
        };
      });

      const targetPlatforms: string[] = Array.from(
        new Set(accountDetails.map((a: { platform: string }) => a.platform))
      );

      // RUN CAMPAIGN PUBLISH GUARD (Pure function)
      const guardResult = guardCampaignPublish({
        assets: assetDetails,
        accounts: accountDetails,
        audience: {
          ...intent.audience,
        },
        objective: intent.objective,
        targetPlatforms,
      });

      if (!guardResult.allowed) {
        // Emit STATE_GUARD_BLOCKED event
        emitEvent('STATE_GUARD_BLOCKED', 'SYSTEM', 'INTENT', intentId, {
          action: 'PUBLISH',
          reason: guardResult.reason,
          metadata: { guardName: 'guardCampaignPublish', targetPlatforms, accountCount: accountDetails.length, assetCount: assetDetails.length },
        });

        return new Response(JSON.stringify({
          error: 'GUARD_BLOCKED',
          guardName: 'guardCampaignPublish',
          message: guardResult.reason,
          currentState: intent.state,
          allowedActions: getIntentAllowedActions(intent.state),
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // All guards passed - proceed with publish
      intent.state = 'PUBLISHING';
      intent.updatedAt = new Date().toISOString();
      mockIntents.set(intentId, intent);
      console.log(`[campaigns] Publishing intent ${intentId} (guards passed)...`);

      // Create campaigns for each account
      const createdCampaigns: any[] = [];
      
      for (const account of accountDetails) {
        const campaignId = `camp_${Date.now()}_${account.id}`;
        const campaign = {
          id: campaignId,
          intentId,
          accountId: account.id,
          platform: account.platform,
          state: 'ACTIVE' as CampaignState,
          metrics: {
            spend: 0,
            impressions: 0,
            clicks: 0,
            conversions: 0,
            cpc: 0,
            cpa: 0,
            roas: 0,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        mockCampaigns.set(campaignId, campaign);
        createdCampaigns.push({
          id: campaignId,
          state: campaign.state,
          platform: campaign.platform,
          allowedActions: getCampaignAllowedActions(campaign.state),
        });
        console.log(`[campaigns] Created campaign ${campaignId}`);
      }

      return new Response(JSON.stringify({
        intentId,
        state: 'PUBLISHED',
        campaigns: createdCampaigns,
        message: `${createdCampaigns.length} campaign(s) published`,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /campaigns - List all campaigns
    if (req.method === 'GET' && pathParts.length === 1) {
      const campaigns = Array.from(mockCampaigns.values()).map(campaign => ({
        id: campaign.id,
        intentId: campaign.intentId,
        accountId: campaign.accountId,
        platform: campaign.platform,
        state: campaign.state,
        metrics: campaign.metrics,
        allowedActions: getCampaignAllowedActions(campaign.state),
      }));

      return new Response(JSON.stringify({ campaigns }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /campaigns/{id} - Get single campaign
    if (req.method === 'GET' && pathParts.length === 2) {
      const campaignId = pathParts[1];
      const campaign = mockCampaigns.get(campaignId);
      
      if (!campaign) {
        return new Response(JSON.stringify({ error: 'Campaign not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        ...campaign,
        allowedActions: getCampaignAllowedActions(campaign.state),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /campaigns/{id}/pause
    if (req.method === 'POST' && pathParts.length === 3 && pathParts[2] === 'pause') {
      const campaignId = pathParts[1];
      const campaign = mockCampaigns.get(campaignId);
      
      if (!campaign) {
        return new Response(JSON.stringify({ error: 'Campaign not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!isCampaignActionAllowed(campaign.state, 'PAUSE')) {
        emitEvent('STATE_TRANSITION_BLOCKED', 'SYSTEM', 'CAMPAIGN', campaignId, {
          action: 'PAUSE',
          reason: `Cannot pause in ${campaign.state} state`,
          metadata: { currentState: campaign.state },
        });
        return new Response(JSON.stringify({
          error: 'INVALID_TRANSITION',
          message: `Cannot pause campaign in ${campaign.state} state`,
          currentState: campaign.state,
          allowedActions: getCampaignAllowedActions(campaign.state),
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const pausePrev = campaign.state;
      campaign.state = 'PAUSED';
      campaign.updatedAt = new Date().toISOString();
      mockCampaigns.set(campaignId, campaign);
      
      emitEvent('CAMPAIGN_PAUSED', 'UI', 'CAMPAIGN', campaignId, {
        previousState: pausePrev,
        newState: 'PAUSED',
      });

      return new Response(JSON.stringify({
        ...campaign,
        allowedActions: getCampaignAllowedActions(campaign.state),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /campaigns/{id}/resume
    if (req.method === 'POST' && pathParts.length === 3 && pathParts[2] === 'resume') {
      const campaignId = pathParts[1];
      const campaign = mockCampaigns.get(campaignId);
      
      if (!campaign) {
        return new Response(JSON.stringify({ error: 'Campaign not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!isCampaignActionAllowed(campaign.state, 'RESUME')) {
        emitEvent('STATE_TRANSITION_BLOCKED', 'SYSTEM', 'CAMPAIGN', campaignId, {
          action: 'RESUME',
          reason: `Cannot resume in ${campaign.state} state`,
          metadata: { currentState: campaign.state },
        });
        return new Response(JSON.stringify({
          error: 'INVALID_TRANSITION',
          message: `Cannot resume campaign in ${campaign.state} state`,
          currentState: campaign.state,
          allowedActions: getCampaignAllowedActions(campaign.state),
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const resumePrev = campaign.state;
      campaign.state = 'ACTIVE';
      campaign.updatedAt = new Date().toISOString();
      mockCampaigns.set(campaignId, campaign);
      
      emitEvent('CAMPAIGN_RESUMED', 'UI', 'CAMPAIGN', campaignId, {
        previousState: resumePrev,
        newState: 'ACTIVE',
      });

      return new Response(JSON.stringify({
        ...campaign,
        allowedActions: getCampaignAllowedActions(campaign.state),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /campaigns/{id}/stop
    if (req.method === 'POST' && pathParts.length === 3 && pathParts[2] === 'stop') {
      const campaignId = pathParts[1];
      const campaign = mockCampaigns.get(campaignId);
      
      if (!campaign) {
        return new Response(JSON.stringify({ error: 'Campaign not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!isCampaignActionAllowed(campaign.state, 'STOP')) {
        emitEvent('STATE_TRANSITION_BLOCKED', 'SYSTEM', 'CAMPAIGN', campaignId, {
          action: 'STOP',
          reason: `Cannot stop in ${campaign.state} state`,
          metadata: { currentState: campaign.state },
        });
        return new Response(JSON.stringify({
          error: 'INVALID_TRANSITION',
          message: `Cannot stop campaign in ${campaign.state} state`,
          currentState: campaign.state,
          allowedActions: getCampaignAllowedActions(campaign.state),
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const stopPrev = campaign.state;
      campaign.state = 'STOPPED';
      campaign.updatedAt = new Date().toISOString();
      mockCampaigns.set(campaignId, campaign);
      
      emitEvent('CAMPAIGN_STOPPED', 'UI', 'CAMPAIGN', campaignId, {
        previousState: stopPrev,
        newState: 'STOPPED',
      });

      return new Response(JSON.stringify({
        ...campaign,
        allowedActions: getCampaignAllowedActions(campaign.state),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /campaigns/events - Get all campaign events (normalized schema)
    if (req.method === 'GET' && pathParts.length === 2 && pathParts[1] === 'events') {
      const blockedOnly = url.searchParams.get('blocked') === 'true';
      const filtered = blockedOnly 
        ? eventStore.filter(e => e.eventType.includes('BLOCKED'))
        : eventStore;
      return new Response(JSON.stringify({ events: filtered }), {
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
      error: error instanceof Error ? error.message : 'Internal error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
