import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * CAMPAIGN STATE MACHINE
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
 */

type CampaignIntentState = 'DRAFT' | 'VALIDATING' | 'READY_TO_PUBLISH' | 'PUBLISHING' | 'FAILED';
type CampaignState = 'ACTIVE' | 'PAUSED' | 'STOPPED' | 'DISAPPROVED';

type CampaignIntentAction = 'VALIDATE' | 'PUBLISH' | 'EDIT' | 'DISCARD';
type CampaignAction = 'PAUSE' | 'RESUME' | 'STOP' | 'VIEW_METRICS';

interface Audience {
  country: string;
  gender: 'ALL' | 'MALE' | 'FEMALE';
  ageMin: number;
  ageMax: number;
  language: string;
}

const CAMPAIGN_INTENT_STATE_CONFIG: Record<CampaignIntentState, { allowedActions: CampaignIntentAction[] }> = {
  DRAFT: {
    allowedActions: ['VALIDATE', 'EDIT', 'DISCARD'],
  },
  VALIDATING: {
    allowedActions: [], // No actions during validation
  },
  READY_TO_PUBLISH: {
    allowedActions: ['PUBLISH', 'EDIT', 'DISCARD'],
  },
  PUBLISHING: {
    allowedActions: [], // No actions during publish
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
  STOPPED: {
    allowedActions: ['VIEW_METRICS'], // Cannot resume stopped campaigns
  },
  DISAPPROVED: {
    allowedActions: ['VIEW_METRICS'], // Needs recovery flow
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

// Mock databases
const mockIntents: Map<string, any> = new Map();
const mockCampaigns: Map<string, any> = new Map();

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

      // Validation rules
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
      console.log(`[campaigns] Created intent ${intentId}, validating...`);

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

    // POST /campaigns/intents/{id}/publish - Publish campaign
    if (req.method === 'POST' && pathParts.length === 4 && pathParts[1] === 'intents' && pathParts[3] === 'publish') {
      const intentId = pathParts[2];
      const intent = mockIntents.get(intentId);
      
      if (!intent) {
        return new Response(JSON.stringify({ error: 'Intent not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ENFORCE STATE MACHINE
      if (!isIntentActionAllowed(intent.state, 'PUBLISH')) {
        console.log(`[campaigns] REJECTED: Cannot publish intent in ${intent.state} state`);
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

      // Transition to PUBLISHING
      intent.state = 'PUBLISHING';
      intent.updatedAt = new Date().toISOString();
      mockIntents.set(intentId, intent);
      console.log(`[campaigns] Publishing intent ${intentId}...`);

      // Create campaigns for each account
      const createdCampaigns: any[] = [];
      
      for (const accountId of intent.accounts) {
        const campaignId = `camp_${Date.now()}_${accountId}`;
        const campaign = {
          id: campaignId,
          intentId,
          accountId,
          platform: accountId.includes('google') ? 'GOOGLE' : 
                   accountId.includes('tiktok') ? 'TIKTOK' : 'SNAPCHAT',
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

    // POST /campaigns/{id}/pause - Pause campaign
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

      campaign.state = 'PAUSED';
      campaign.updatedAt = new Date().toISOString();
      mockCampaigns.set(campaignId, campaign);
      console.log(`[campaigns] Paused campaign ${campaignId}`);

      return new Response(JSON.stringify({
        ...campaign,
        allowedActions: getCampaignAllowedActions(campaign.state),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /campaigns/{id}/resume - Resume campaign
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

      campaign.state = 'ACTIVE';
      campaign.updatedAt = new Date().toISOString();
      mockCampaigns.set(campaignId, campaign);
      console.log(`[campaigns] Resumed campaign ${campaignId}`);

      return new Response(JSON.stringify({
        ...campaign,
        allowedActions: getCampaignAllowedActions(campaign.state),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /campaigns/{id}/stop - Stop campaign permanently
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

      campaign.state = 'STOPPED';
      campaign.updatedAt = new Date().toISOString();
      mockCampaigns.set(campaignId, campaign);
      console.log(`[campaigns] Stopped campaign ${campaignId}`);

      return new Response(JSON.stringify({
        ...campaign,
        allowedActions: getCampaignAllowedActions(campaign.state),
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
      error: error instanceof Error ? error.message : 'Internal error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
