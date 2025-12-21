import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * EVENTS - AI ACTION LOG
 * 
 * Single source of truth for all AI actions and system events.
 * 
 * Event Types:
 * - AI_ACTION_EXECUTED: AI automation action taken
 * - STATE_TRANSITION: Entity state change
 * - CAMPAIGN_PUBLISHED: Campaign went live
 * - CAMPAIGN_PAUSED: Campaign paused by AI or user
 * - ASSET_ANALYZED: Asset compliance check completed
 * - RULE_TRIGGERED: Automation rule executed
 * - DISAPPROVAL_DETECTED: Platform rejected ad
 * - RECOVERY_INITIATED: Recovery process started
 */

type EventType = 
  | 'AI_ACTION_EXECUTED'
  | 'STATE_TRANSITION'
  | 'CAMPAIGN_PUBLISHED'
  | 'CAMPAIGN_PAUSED'
  | 'CAMPAIGN_RESUMED'
  | 'CAMPAIGN_STOPPED'
  | 'ASSET_ANALYZED'
  | 'ASSET_APPROVED'
  | 'ASSET_BLOCKED'
  | 'RULE_TRIGGERED'
  | 'RULE_COOLDOWN_STARTED'
  | 'DISAPPROVAL_DETECTED'
  | 'RECOVERY_INITIATED'
  | 'RECOVERY_COMPLETED';

type EntityType = 'ASSET' | 'CAMPAIGN' | 'AD_ACCOUNT' | 'RULE' | 'SYSTEM';

interface Event {
  id: string;
  type: EventType;
  entity: EntityType;
  entityId: string;
  action?: string;
  reason?: string;
  previousState?: string;
  newState?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

// Mock event log (in production, use Supabase table)
const eventLog: Event[] = [
  {
    id: 'evt_1',
    type: 'AI_ACTION_EXECUTED',
    entity: 'CAMPAIGN',
    entityId: 'camp_1',
    action: 'PAUSE',
    reason: 'CPA exceeded threshold ($52.30 > $50.00)',
    metadata: { ruleId: 'rule_1', metric: 'cpa', value: 52.3, threshold: 50 },
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    id: 'evt_2',
    type: 'RULE_TRIGGERED',
    entity: 'RULE',
    entityId: 'rule_1',
    action: 'PAUSE_CAMPAIGN',
    reason: 'Condition met: cpa > 50',
    previousState: 'ACTIVE',
    newState: 'COOLDOWN',
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    id: 'evt_3',
    type: 'ASSET_ANALYZED',
    entity: 'ASSET',
    entityId: 'asset_123',
    previousState: 'UPLOADED',
    newState: 'APPROVED',
    metadata: { riskScore: 15, qualityScore: 82 },
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'evt_4',
    type: 'CAMPAIGN_PUBLISHED',
    entity: 'CAMPAIGN',
    entityId: 'camp_2',
    newState: 'ACTIVE',
    metadata: { platform: 'GOOGLE', accountId: 'acc_google_1' },
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'evt_5',
    type: 'DISAPPROVAL_DETECTED',
    entity: 'CAMPAIGN',
    entityId: 'camp_3',
    previousState: 'ACTIVE',
    newState: 'DISAPPROVED',
    reason: 'Policy violation: Misleading claims in ad copy',
    metadata: { platform: 'TIKTOK', policyCode: 'AD_POLICY_001' },
    timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
  },
];

function addEvent(event: Omit<Event, 'id' | 'timestamp'>): Event {
  const newEvent: Event = {
    ...event,
    id: `evt_${Date.now()}`,
    timestamp: new Date().toISOString(),
  };
  eventLog.unshift(newEvent); // Add to beginning (newest first)
  console.log(`[events] Added event: ${newEvent.type} for ${newEvent.entity}/${newEvent.entityId}`);
  return newEvent;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  
  console.log(`[events] ${req.method} ${url.pathname}`);

  try {
    // GET /events - List events with optional filters
    if (req.method === 'GET' && pathParts.length === 1) {
      const entityType = url.searchParams.get('entity');
      const entityId = url.searchParams.get('entityId');
      const eventType = url.searchParams.get('type');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const since = url.searchParams.get('since'); // ISO timestamp
      
      let filtered = [...eventLog];
      
      if (entityType) {
        filtered = filtered.filter(e => e.entity === entityType);
      }
      
      if (entityId) {
        filtered = filtered.filter(e => e.entityId === entityId);
      }
      
      if (eventType) {
        filtered = filtered.filter(e => e.type === eventType);
      }
      
      if (since) {
        const sinceDate = new Date(since);
        filtered = filtered.filter(e => new Date(e.timestamp) > sinceDate);
      }
      
      // Apply limit
      filtered = filtered.slice(0, Math.min(limit, 100));

      return new Response(JSON.stringify({ 
        events: filtered,
        total: filtered.length,
        hasMore: eventLog.length > limit,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /events/{id} - Get single event
    if (req.method === 'GET' && pathParts.length === 2) {
      const eventId = pathParts[1];
      const event = eventLog.find(e => e.id === eventId);
      
      if (!event) {
        return new Response(JSON.stringify({ error: 'Event not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify(event), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /events - Record new event (internal use)
    if (req.method === 'POST' && pathParts.length === 1) {
      const body = await req.json();
      const { type, entity, entityId, action, reason, previousState, newState, metadata } = body;

      if (!type || !entity || !entityId) {
        return new Response(JSON.stringify({ 
          error: 'Missing required fields: type, entity, entityId' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const newEvent = addEvent({
        type,
        entity,
        entityId,
        action,
        reason,
        previousState,
        newState,
        metadata,
      });

      return new Response(JSON.stringify(newEvent), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /events/summary - Get aggregated event summary
    if (req.method === 'GET' && pathParts.length === 2 && pathParts[1] === 'summary') {
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentEvents = eventLog.filter(e => new Date(e.timestamp) > last24h);
      
      const summary = {
        total24h: recentEvents.length,
        byType: {} as Record<string, number>,
        byEntity: {} as Record<string, number>,
        aiActions: recentEvents.filter(e => e.type === 'AI_ACTION_EXECUTED').length,
        stateTransitions: recentEvents.filter(e => e.type === 'STATE_TRANSITION').length,
        disapprovals: recentEvents.filter(e => e.type === 'DISAPPROVAL_DETECTED').length,
        latestEvents: recentEvents.slice(0, 5),
      };

      recentEvents.forEach(e => {
        summary.byType[e.type] = (summary.byType[e.type] || 0) + 1;
        summary.byEntity[e.entity] = (summary.byEntity[e.entity] || 0) + 1;
      });

      return new Response(JSON.stringify(summary), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[events] Error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Internal error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
