import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest, createUserClient, extractBearerToken, unauthorizedResponse } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * NORMALIZED EVENT SCHEMA + JWT Authentication
 * 
 * All operations require a valid JWT token and are scoped to auth.uid()
 */

type EventType = 
  | 'ASSET_UPLOADED' | 'ASSET_ANALYZING' | 'ASSET_ANALYZED' | 'ASSET_APPROVED' 
  | 'ASSET_BLOCKED' | 'ASSET_MARKED_READY' | 'ASSET_UNMARKED_READY'
  | 'CAMPAIGN_INTENT_CREATED' | 'CAMPAIGN_INTENT_VALIDATED' | 'CAMPAIGN_PUBLISHED' 
  | 'CAMPAIGN_PAUSED' | 'CAMPAIGN_RESUMED' | 'CAMPAIGN_STOPPED' | 'CAMPAIGN_BLOCKED'
  | 'CAMPAIGN_DISAPPROVED'
  | 'AUTOMATION_RULE_CREATED' | 'AUTOMATION_RULE_ENABLED' | 'AUTOMATION_RULE_DISABLED'
  | 'AUTOMATION_TRIGGERED' | 'AUTOMATION_SKIPPED' | 'AUTOMATION_ACTION_EXECUTED'
  | 'AUTOMATION_COOLDOWN_STARTED' | 'AUTOMATION_COOLDOWN_RESET'
  | 'STATE_GUARD_BLOCKED' | 'STATE_TRANSITION_BLOCKED'
  | 'RECOVERY_INITIATED' | 'RECOVERY_COMPLETED'
  | 'AI_DECISION_MADE' | 'AI_ACTION_EXECUTED';

type EventSource = 'UI' | 'AI' | 'AUTOMATION' | 'SYSTEM';
type EntityType = 'ASSET' | 'CAMPAIGN' | 'AD_ACCOUNT' | 'RULE' | 'INTENT' | 'SYSTEM';

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ===================== JWT AUTHENTICATION =====================
  const authResult = await authenticateRequest(req);
  if (!authResult.authenticated) {
    console.error('[events] Auth failed:', authResult.error);
    return unauthorizedResponse(authResult.error || 'Unauthorized', corsHeaders);
  }
  
  const userId = authResult.userId!;
  const token = extractBearerToken(req)!;
  const supabase = createUserClient(token);
  
  console.log(`[events] Authenticated user: ${userId}`);
  // ==============================================================

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
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
      const since = url.searchParams.get('since');
      
      let query = supabase
        .from('events')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit);
      
      if (entityType) {
        query = query.eq('entity_type', entityType);
      }
      if (entityId) {
        query = query.eq('entity_id', entityId);
      }
      if (eventType) {
        query = query.eq('event_type', eventType);
      }
      if (source) {
        query = query.eq('source', source);
      }
      if (since) {
        query = query.gte('timestamp', since);
      }
      
      const { data: events, error, count } = await query;
      
      if (error) throw error;

      return new Response(JSON.stringify({ 
        events: events || [],
        total: events?.length || 0,
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
        requiredFields: ['event_id', 'event_type', 'source', 'entity_type', 'entity_id', 'timestamp'],
        optionalFields: ['previous_state', 'new_state', 'action', 'reason', 'metadata'],
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /events/{id} - Get single event
    if (req.method === 'GET' && pathParts.length === 2 && 
        !['summary', 'schema', 'ai-actions', 'blocked'].includes(pathParts[1])) {
      const eventId = pathParts[1];
      
      const { data: event, error } = await supabase
        .from('events')
        .select('*')
        .eq('event_id', eventId)
        .maybeSingle();
      
      if (error) throw error;
      
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
        event_type, 
        source, 
        entity_type, 
        entity_id, 
        previous_state, 
        new_state, 
        action, 
        reason, 
        metadata 
      } = body;

      // Validate required fields
      if (!event_type || !source || !entity_type || !entity_id) {
        return new Response(JSON.stringify({ 
          error: 'SCHEMA_VIOLATION',
          message: 'Missing required fields',
          required: ['event_type', 'source', 'entity_type', 'entity_id'],
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Validate enums
      if (!VALID_EVENT_TYPES.includes(event_type)) {
        return new Response(JSON.stringify({ 
          error: 'SCHEMA_VIOLATION',
          message: `Invalid event_type: ${event_type}`,
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

      if (!VALID_ENTITY_TYPES.includes(entity_type)) {
        return new Response(JSON.stringify({ 
          error: 'SCHEMA_VIOLATION',
          message: `Invalid entity_type: ${entity_type}`,
          validEntityTypes: VALID_ENTITY_TYPES,
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const eventId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const { data: newEvent, error } = await supabase
        .from('events')
        .insert({
          event_id: eventId,
          event_type,
          source,
          entity_type,
          entity_id,
          user_id: userId,
          previous_state,
          new_state,
          action,
          reason,
          metadata: metadata || {},
        })
        .select()
        .single();

      if (error) throw error;

      console.log(`[events] Created: ${event_type} | ${entity_type}/${entity_id}`);

      return new Response(JSON.stringify(newEvent), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /events/summary - Aggregated event summary
    if (req.method === 'GET' && pathParts.length === 2 && pathParts[1] === 'summary') {
      const hours = parseInt(url.searchParams.get('hours') || '24');
      const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      
      const { data: events, error } = await supabase
        .from('events')
        .select('*')
        .gte('timestamp', cutoff)
        .order('timestamp', { ascending: false });
      
      if (error) throw error;

      const recentEvents = events || [];
      
      const summary = {
        timeRange: {
          hours,
          since: cutoff,
          until: new Date().toISOString(),
        },
        totalEvents: recentEvents.length,
        byEventType: {} as Record<string, number>,
        bySource: {} as Record<string, number>,
        byEntityType: {} as Record<string, number>,
        blockedActions: recentEvents.filter(e => 
          e.event_type === 'STATE_GUARD_BLOCKED' || 
          e.event_type === 'STATE_TRANSITION_BLOCKED' ||
          e.event_type === 'CAMPAIGN_BLOCKED'
        ).length,
        automationEvents: recentEvents.filter(e => e.source === 'AUTOMATION').length,
        aiEvents: recentEvents.filter(e => e.source === 'AI').length,
        latestEvents: recentEvents.slice(0, 10),
      };

      recentEvents.forEach(e => {
        summary.byEventType[e.event_type] = (summary.byEventType[e.event_type] || 0) + 1;
        summary.bySource[e.source] = (summary.bySource[e.source] || 0) + 1;
        summary.byEntityType[e.entity_type] = (summary.byEntityType[e.entity_type] || 0) + 1;
      });

      return new Response(JSON.stringify(summary), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /events/ai-actions - AI actions derived from event stream
    if (req.method === 'GET' && pathParts.length === 2 && pathParts[1] === 'ai-actions') {
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
      
      const { data: events, error } = await supabase
        .from('events')
        .select('*')
        .or('source.eq.AI,event_type.ilike.AI_%')
        .order('timestamp', { ascending: false })
        .limit(limit);
      
      if (error) throw error;

      return new Response(JSON.stringify({
        actions: events || [],
        total: events?.length || 0,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /events/blocked - All blocked actions
    if (req.method === 'GET' && pathParts.length === 2 && pathParts[1] === 'blocked') {
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
      
      const { data: events, error } = await supabase
        .from('events')
        .select('*')
        .or('event_type.eq.STATE_GUARD_BLOCKED,event_type.eq.STATE_TRANSITION_BLOCKED,event_type.eq.CAMPAIGN_BLOCKED,event_type.eq.AUTOMATION_SKIPPED')
        .order('timestamp', { ascending: false })
        .limit(limit);
      
      if (error) throw error;

      return new Response(JSON.stringify({
        blocked: events || [],
        total: events?.length || 0,
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
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
