import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * NORMALIZED EVENT SCHEMA
 * 
 * Single source of truth for ALL system events.
 * Every action, decision, skip, and failure is traceable, replayable, and auditable.
 * 
 * NO component may emit custom logs outside this schema.
 * Every automation decision MUST emit an event.
 * Every blocked action MUST emit an event.
 * Skipped actions MUST include reason.
 */

// ============================================================================
// EVENT SCHEMA TYPES
// ============================================================================

type EventType = 
  // Asset Events
  | 'ASSET_UPLOADED'
  | 'ASSET_ANALYZING'
  | 'ASSET_ANALYZED'
  | 'ASSET_APPROVED'
  | 'ASSET_BLOCKED'
  | 'ASSET_MARKED_READY'
  | 'ASSET_UNMARKED_READY'
  // Campaign Events
  | 'CAMPAIGN_INTENT_CREATED'
  | 'CAMPAIGN_INTENT_VALIDATED'
  | 'CAMPAIGN_PUBLISHED'
  | 'CAMPAIGN_PAUSED'
  | 'CAMPAIGN_RESUMED'
  | 'CAMPAIGN_STOPPED'
  | 'CAMPAIGN_BLOCKED'
  | 'CAMPAIGN_DISAPPROVED'
  // Automation Events
  | 'AUTOMATION_RULE_CREATED'
  | 'AUTOMATION_RULE_ENABLED'
  | 'AUTOMATION_RULE_DISABLED'
  | 'AUTOMATION_TRIGGERED'
  | 'AUTOMATION_SKIPPED'
  | 'AUTOMATION_ACTION_EXECUTED'
  | 'AUTOMATION_COOLDOWN_STARTED'
  | 'AUTOMATION_COOLDOWN_RESET'
  // Guard Events
  | 'STATE_GUARD_BLOCKED'
  | 'STATE_TRANSITION_BLOCKED'
  // Recovery Events
  | 'RECOVERY_INITIATED'
  | 'RECOVERY_COMPLETED'
  // AI Events
  | 'AI_DECISION_MADE'
  | 'AI_ACTION_EXECUTED';

type EventSource = 'UI' | 'AI' | 'AUTOMATION' | 'SYSTEM';
type EntityType = 'ASSET' | 'CAMPAIGN' | 'AD_ACCOUNT' | 'RULE' | 'INTENT' | 'SYSTEM';

interface NormalizedEvent {
  eventId: string;
  eventType: EventType;
  source: EventSource;
  entityType: EntityType;
  entityId: string;
  previousState?: string;
  newState?: string;
  action?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  timestamp: string; // ISO8601
}

// ============================================================================
// EVENT SCHEMA VALIDATION
// ============================================================================

const VALID_EVENT_TYPES: EventType[] = [
  'ASSET_UPLOADED', 'ASSET_ANALYZING', 'ASSET_ANALYZED', 'ASSET_APPROVED', 
  'ASSET_BLOCKED', 'ASSET_MARKED_READY', 'ASSET_UNMARKED_READY',
  'CAMPAIGN_INTENT_CREATED', 'CAMPAIGN_INTENT_VALIDATED', 'CAMPAIGN_PUBLISHED', 
  'CAMPAIGN_PAUSED', 'CAMPAIGN_RESUMED', 'CAMPAIGN_STOPPED', 'CAMPAIGN_BLOCKED',
  'CAMPAIGN_DISAPPROVED',
  'AUTOMATION_RULE_CREATED', 'AUTOMATION_RULE_ENABLED', 'AUTOMATION_RULE_DISABLED',
  'AUTOMATION_TRIGGERED', 'AUTOMATION_SKIPPED', 'AUTOMATION_ACTION_EXECUTED',
  'AUTOMATION_COOLDOWN_STARTED', 'AUTOMATION_COOLDOWN_RESET',
  'STATE_GUARD_BLOCKED', 'STATE_TRANSITION_BLOCKED',
  'RECOVERY_INITIATED', 'RECOVERY_COMPLETED',
  'AI_DECISION_MADE', 'AI_ACTION_EXECUTED',
];

const VALID_SOURCES: EventSource[] = ['UI', 'AI', 'AUTOMATION', 'SYSTEM'];
const VALID_ENTITY_TYPES: EntityType[] = ['ASSET', 'CAMPAIGN', 'AD_ACCOUNT', 'RULE', 'INTENT', 'SYSTEM'];

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function validateEventSchema(event: Partial<NormalizedEvent>): ValidationResult {
  const errors: string[] = [];

  // Required fields
  if (!event.eventId) errors.push('eventId is required');
  if (!event.eventType) errors.push('eventType is required');
  if (!event.source) errors.push('source is required');
  if (!event.entityType) errors.push('entityType is required');
  if (!event.entityId) errors.push('entityId is required');
  if (!event.timestamp) errors.push('timestamp is required');

  // Enum validation
  if (event.eventType && !VALID_EVENT_TYPES.includes(event.eventType)) {
    errors.push(`Invalid eventType: ${event.eventType}`);
  }
  if (event.source && !VALID_SOURCES.includes(event.source)) {
    errors.push(`Invalid source: ${event.source}`);
  }
  if (event.entityType && !VALID_ENTITY_TYPES.includes(event.entityType)) {
    errors.push(`Invalid entityType: ${event.entityType}`);
  }

  // Timestamp format validation (ISO8601)
  if (event.timestamp) {
    const date = new Date(event.timestamp);
    if (isNaN(date.getTime())) {
      errors.push('timestamp must be valid ISO8601 format');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// EVENT STORE
// ============================================================================

// In-memory event store (in production, use Supabase table)
const eventStore: NormalizedEvent[] = [];

function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function createEvent(
  eventType: EventType,
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

  // Validate before storing
  const validation = validateEventSchema(event);
  if (!validation.valid) {
    console.error('[events] Schema validation failed:', validation.errors);
    throw new Error(`Event schema validation failed: ${validation.errors.join(', ')}`);
  }

  eventStore.unshift(event);
  console.log(`[events] Stored: ${eventType} | ${entityType}/${entityId} | source=${source}`);
  
  return event;
}

// ============================================================================
// SEED DATA - Sample events following normalized schema
// ============================================================================

// AI Action Executed
createEvent('AI_ACTION_EXECUTED', 'AI', 'CAMPAIGN', 'camp_1', {
  action: 'PAUSE',
  reason: 'CPA exceeded threshold ($52.30 > $50.00)',
  previousState: 'ACTIVE',
  newState: 'PAUSED',
  metadata: { ruleId: 'rule_1', metric: 'cpa', value: 52.3, threshold: 50 },
});

// Automation Triggered + Cooldown
createEvent('AUTOMATION_TRIGGERED', 'AUTOMATION', 'RULE', 'rule_1', {
  action: 'PAUSE_CAMPAIGN',
  reason: 'Condition met: cpa > 50',
  previousState: 'ACTIVE',
  newState: 'COOLDOWN',
  metadata: { targetCampaignId: 'camp_1' },
});

// Asset Analyzed
createEvent('ASSET_ANALYZED', 'SYSTEM', 'ASSET', 'asset_123', {
  previousState: 'ANALYZING',
  newState: 'APPROVED',
  metadata: { riskScore: 15, qualityScore: 82 },
});

// Campaign Published
createEvent('CAMPAIGN_PUBLISHED', 'UI', 'CAMPAIGN', 'camp_2', {
  newState: 'ACTIVE',
  metadata: { platform: 'GOOGLE', accountId: 'acc_google_1', assetCount: 3 },
});

// State Guard Blocked
createEvent('STATE_GUARD_BLOCKED', 'SYSTEM', 'ASSET', 'asset_456', {
  action: 'MARK_READY_FOR_LAUNCH',
  reason: 'Asset risk score (65) exceeds threshold (50)',
  metadata: { guardName: 'guardAssetReadyForLaunch', riskScore: 65, threshold: 50 },
});

// Automation Skipped
createEvent('AUTOMATION_SKIPPED', 'AUTOMATION', 'RULE', 'rule_2', {
  action: 'SCALE_BUDGET',
  reason: 'Daily action limit reached (10/10)',
  metadata: { campaignId: 'camp_3', actionsToday: 10, maxActionsPerDay: 10 },
});

// Campaign Blocked
createEvent('CAMPAIGN_BLOCKED', 'SYSTEM', 'CAMPAIGN', 'camp_4', {
  action: 'PUBLISH',
  reason: 'Ad accounts missing LAUNCH permission: acc_snapchat_1',
  metadata: { guardName: 'guardCampaignPublish', blockedAccounts: ['acc_snapchat_1'] },
});

// Campaign Disapproved
createEvent('CAMPAIGN_DISAPPROVED', 'SYSTEM', 'CAMPAIGN', 'camp_3', {
  previousState: 'ACTIVE',
  newState: 'DISAPPROVED',
  reason: 'Policy violation: Misleading claims in ad copy',
  metadata: { platform: 'TIKTOK', policyCode: 'AD_POLICY_001' },
});

// ============================================================================
// HTTP HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  
  console.log(`[events] ${req.method} ${url.pathname}`);

  try {
    // GET /events - List events with filters
    if (req.method === 'GET' && pathParts.length === 1) {
      const entityType = url.searchParams.get('entityType') as EntityType | null;
      const entityId = url.searchParams.get('entityId');
      const eventType = url.searchParams.get('eventType') as EventType | null;
      const source = url.searchParams.get('source') as EventSource | null;
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const since = url.searchParams.get('since'); // ISO timestamp
      
      let filtered = [...eventStore];
      
      if (entityType) {
        filtered = filtered.filter(e => e.entityType === entityType);
      }
      
      if (entityId) {
        filtered = filtered.filter(e => e.entityId === entityId);
      }
      
      if (eventType) {
        filtered = filtered.filter(e => e.eventType === eventType);
      }

      if (source) {
        filtered = filtered.filter(e => e.source === source);
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
        hasMore: eventStore.length > limit,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /events/schema - Return the event schema definition
    if (req.method === 'GET' && pathParts.length === 2 && pathParts[1] === 'schema') {
      return new Response(JSON.stringify({
        eventTypes: VALID_EVENT_TYPES,
        sources: VALID_SOURCES,
        entityTypes: VALID_ENTITY_TYPES,
        requiredFields: ['eventId', 'eventType', 'source', 'entityType', 'entityId', 'timestamp'],
        optionalFields: ['previousState', 'newState', 'action', 'reason', 'metadata'],
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /events/{id} - Get single event
    if (req.method === 'GET' && pathParts.length === 2 && pathParts[1] !== 'summary' && pathParts[1] !== 'schema') {
      const eventId = pathParts[1];
      const event = eventStore.find(e => e.eventId === eventId);
      
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

    // POST /events - Record new event (schema validated)
    if (req.method === 'POST' && pathParts.length === 1) {
      const body = await req.json();
      const { 
        eventType, 
        source, 
        entityType, 
        entityId, 
        previousState, 
        newState, 
        action, 
        reason, 
        metadata 
      } = body;

      // Validate required fields
      if (!eventType || !source || !entityType || !entityId) {
        return new Response(JSON.stringify({ 
          error: 'SCHEMA_VIOLATION',
          message: 'Missing required fields',
          required: ['eventType', 'source', 'entityType', 'entityId'],
          received: { eventType, source, entityType, entityId },
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Validate enums
      if (!VALID_EVENT_TYPES.includes(eventType)) {
        return new Response(JSON.stringify({ 
          error: 'SCHEMA_VIOLATION',
          message: `Invalid eventType: ${eventType}`,
          validEventTypes: VALID_EVENT_TYPES,
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!VALID_SOURCES.includes(source)) {
        return new Response(JSON.stringify({ 
          error: 'SCHEMA_VIOLATION',
          message: `Invalid source: ${source}`,
          validSources: VALID_SOURCES,
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!VALID_ENTITY_TYPES.includes(entityType)) {
        return new Response(JSON.stringify({ 
          error: 'SCHEMA_VIOLATION',
          message: `Invalid entityType: ${entityType}`,
          validEntityTypes: VALID_ENTITY_TYPES,
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      try {
        const newEvent = createEvent(eventType, source, entityType, entityId, {
          previousState,
          newState,
          action,
          reason,
          metadata,
        });

        return new Response(JSON.stringify(newEvent), {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        return new Response(JSON.stringify({ 
          error: 'SCHEMA_VIOLATION',
          message: error instanceof Error ? error.message : 'Schema validation failed',
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // GET /events/summary - Aggregated event summary
    if (req.method === 'GET' && pathParts.length === 2 && pathParts[1] === 'summary') {
      const hours = parseInt(url.searchParams.get('hours') || '24');
      const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
      const recentEvents = eventStore.filter(e => new Date(e.timestamp) > cutoff);
      
      const summary = {
        timeRange: {
          hours,
          since: cutoff.toISOString(),
          until: new Date().toISOString(),
        },
        totalEvents: recentEvents.length,
        byEventType: {} as Record<string, number>,
        bySource: {} as Record<string, number>,
        byEntityType: {} as Record<string, number>,
        blockedActions: recentEvents.filter(e => 
          e.eventType === 'STATE_GUARD_BLOCKED' || 
          e.eventType === 'STATE_TRANSITION_BLOCKED' ||
          e.eventType === 'CAMPAIGN_BLOCKED'
        ).length,
        automationEvents: recentEvents.filter(e => e.source === 'AUTOMATION').length,
        aiEvents: recentEvents.filter(e => e.source === 'AI').length,
        latestEvents: recentEvents.slice(0, 10),
      };

      recentEvents.forEach(e => {
        summary.byEventType[e.eventType] = (summary.byEventType[e.eventType] || 0) + 1;
        summary.bySource[e.source] = (summary.bySource[e.source] || 0) + 1;
        summary.byEntityType[e.entityType] = (summary.byEntityType[e.entityType] || 0) + 1;
      });

      return new Response(JSON.stringify(summary), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /events/stream/{entityType}/{entityId} - Get event stream for specific entity
    if (req.method === 'GET' && pathParts.length === 4 && pathParts[1] === 'stream') {
      const entityType = pathParts[2] as EntityType;
      const entityId = pathParts[3];
      const limit = parseInt(url.searchParams.get('limit') || '20');

      const entityEvents = eventStore
        .filter(e => e.entityType === entityType && e.entityId === entityId)
        .slice(0, limit);

      return new Response(JSON.stringify({
        entityType,
        entityId,
        events: entityEvents,
        total: entityEvents.length,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /events/ai-actions - AI actions derived from event stream
    if (req.method === 'GET' && pathParts.length === 2 && pathParts[1] === 'ai-actions') {
      const limit = parseInt(url.searchParams.get('limit') || '20');
      
      const aiActions = eventStore
        .filter(e => e.source === 'AI' || e.eventType.startsWith('AI_'))
        .slice(0, limit);

      return new Response(JSON.stringify({
        actions: aiActions,
        total: aiActions.length,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /events/blocked - All blocked actions
    if (req.method === 'GET' && pathParts.length === 2 && pathParts[1] === 'blocked') {
      const limit = parseInt(url.searchParams.get('limit') || '20');
      
      const blockedEvents = eventStore
        .filter(e => 
          e.eventType === 'STATE_GUARD_BLOCKED' || 
          e.eventType === 'STATE_TRANSITION_BLOCKED' ||
          e.eventType === 'CAMPAIGN_BLOCKED' ||
          e.eventType === 'AUTOMATION_SKIPPED'
        )
        .slice(0, limit);

      return new Response(JSON.stringify({
        events: blockedEvents,
        total: blockedEvents.length,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /events/automation - Automation history
    if (req.method === 'GET' && pathParts.length === 2 && pathParts[1] === 'automation') {
      const limit = parseInt(url.searchParams.get('limit') || '20');
      
      const automationEvents = eventStore
        .filter(e => e.source === 'AUTOMATION' || e.eventType.startsWith('AUTOMATION_'))
        .slice(0, limit);

      return new Response(JSON.stringify({
        events: automationEvents,
        total: automationEvents.length,
      }), {
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
