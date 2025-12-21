import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { authenticateRequest, unauthorizedResponse, createUserClient, extractBearerToken } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * AD ACCOUNT STATE MACHINE
 * 
 * States:
 * - DISCONNECTED: Not connected to platform
 * - CONNECTING: OAuth in progress (transient)
 * - CONNECTED: Connected but may have limited permissions
 * - LIMITED_PERMISSION: Connected with analyze only
 * - FULL_ACCESS: Connected with all permissions
 * 
 * Permissions: ANALYZE, LAUNCH, OPTIMIZE
 */

type AdAccountState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'LIMITED_PERMISSION' | 'FULL_ACCESS';
type Permission = 'ANALYZE' | 'LAUNCH' | 'OPTIMIZE';
type Platform = 'GOOGLE' | 'TIKTOK' | 'SNAPCHAT';

type AdAccountAction = 
  | 'CONNECT'
  | 'DISCONNECT'
  | 'REFRESH_PERMISSIONS'
  | 'PUBLISH_CAMPAIGN'
  | 'ANALYZE_CAMPAIGNS'
  | 'OPTIMIZE_CAMPAIGNS';

interface AdAccountStateConfig {
  allowedActions: AdAccountAction[];
  canTransitionTo: AdAccountState[];
}

const AD_ACCOUNT_STATE_CONFIG: Record<AdAccountState, AdAccountStateConfig> = {
  DISCONNECTED: {
    allowedActions: ['CONNECT'],
    canTransitionTo: ['CONNECTING'],
  },
  CONNECTING: {
    allowedActions: [], // No actions during OAuth
    canTransitionTo: ['CONNECTED', 'LIMITED_PERMISSION', 'FULL_ACCESS', 'DISCONNECTED'],
  },
  CONNECTED: {
    allowedActions: ['DISCONNECT', 'REFRESH_PERMISSIONS'],
    canTransitionTo: ['DISCONNECTED', 'LIMITED_PERMISSION', 'FULL_ACCESS'],
  },
  LIMITED_PERMISSION: {
    allowedActions: ['DISCONNECT', 'REFRESH_PERMISSIONS', 'ANALYZE_CAMPAIGNS'],
    canTransitionTo: ['DISCONNECTED', 'FULL_ACCESS'],
  },
  FULL_ACCESS: {
    allowedActions: ['DISCONNECT', 'REFRESH_PERMISSIONS', 'ANALYZE_CAMPAIGNS', 'PUBLISH_CAMPAIGN', 'OPTIMIZE_CAMPAIGNS'],
    canTransitionTo: ['DISCONNECTED', 'LIMITED_PERMISSION'],
  },
};

function getAllowedActions(state: AdAccountState, permissions: Permission[]): AdAccountAction[] {
  const baseActions = AD_ACCOUNT_STATE_CONFIG[state]?.allowedActions || [];
  
  // Filter actions based on actual permissions
  return baseActions.filter(action => {
    if (action === 'PUBLISH_CAMPAIGN') return permissions.includes('LAUNCH');
    if (action === 'OPTIMIZE_CAMPAIGNS') return permissions.includes('OPTIMIZE');
    if (action === 'ANALYZE_CAMPAIGNS') return permissions.includes('ANALYZE');
    return true;
  });
}

function isActionAllowed(state: AdAccountState, permissions: Permission[], action: AdAccountAction): boolean {
  return getAllowedActions(state, permissions).includes(action);
}

// Helper to convert DB permissions to Permission[]
function parsePermissions(permJson: any): Permission[] {
  const perms: Permission[] = [];
  if (permJson?.canAnalyze) perms.push('ANALYZE');
  if (permJson?.canLaunch) perms.push('LAUNCH');
  if (permJson?.canMonitor) perms.push('OPTIMIZE');
  return perms;
}

// Helper to convert Permission[] to DB format
function toDbPermissions(perms: Permission[]): Record<string, boolean> {
  return {
    canAnalyze: perms.includes('ANALYZE'),
    canLaunch: perms.includes('LAUNCH'),
    canMonitor: perms.includes('OPTIMIZE'),
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Authenticate request
  const authResult = await authenticateRequest(req);
  if (!authResult.authenticated) {
    return unauthorizedResponse(authResult.error || 'Unauthorized', corsHeaders);
  }
  const userId = authResult.userId!;

  const token = extractBearerToken(req);
  if (!token) {
    return unauthorizedResponse('Missing token', corsHeaders);
  }

  const supabase = createUserClient(token);
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const projectId = url.searchParams.get('projectId');
  
  console.log(`[ad-accounts] ${req.method} ${url.pathname} user=${userId}`);

  try {
    // GET /ad-accounts - List all accounts with state and allowed actions
    if (req.method === 'GET' && pathParts.length === 1) {
      let query = supabase
        .from('ad_account_connections')
        .select('*')
        .order('created_at', { ascending: false });

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data: accounts, error } = await query;

      if (error) {
        console.error('[ad-accounts] List error:', error);
        throw error;
      }

      const formattedAccounts = (accounts || []).map(account => {
        const permissions = parsePermissions(account.permissions);
        const state = account.status.toUpperCase() as AdAccountState;
        return {
          id: account.id,
          platform: account.platform.toUpperCase(),
          accountId: account.account_id,
          accountName: account.account_name,
          state,
          permissions,
          allowedActions: getAllowedActions(state, permissions),
          projectId: account.project_id,
        };
      });

      return new Response(JSON.stringify({ accounts: formattedAccounts }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /ad-accounts/{id} - Get single account
    if (req.method === 'GET' && pathParts.length === 2) {
      const accountId = pathParts[1];
      
      const { data: account, error } = await supabase
        .from('ad_account_connections')
        .select('*')
        .eq('id', accountId)
        .single();
      
      if (error || !account) {
        return new Response(JSON.stringify({ error: 'Account not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const permissions = parsePermissions(account.permissions);
      const state = account.status.toUpperCase() as AdAccountState;

      return new Response(JSON.stringify({
        id: account.id,
        platform: account.platform.toUpperCase(),
        accountId: account.account_id,
        accountName: account.account_name,
        state,
        permissions,
        allowedActions: getAllowedActions(state, permissions),
        projectId: account.project_id,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /ad-accounts/connect - Initiate OAuth connection
    if (req.method === 'POST' && pathParts.length === 2 && pathParts[1] === 'connect') {
      const body = await req.json();
      const { platform, projectId: bodyProjectId } = body;
      const targetProjectId = bodyProjectId || projectId;
      
      if (!['GOOGLE', 'TIKTOK', 'SNAPCHAT'].includes(platform)) {
        return new Response(JSON.stringify({ error: 'Invalid platform' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!targetProjectId) {
        return new Response(JSON.stringify({ error: 'projectId is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Create new connection in CONNECTING state
      const { data: newAccount, error } = await supabase
        .from('ad_account_connections')
        .insert({
          user_id: userId,
          project_id: targetProjectId,
          platform: platform.toLowerCase(),
          account_id: `pending_${Date.now()}`,
          account_name: `${platform} Account (Connecting...)`,
          status: 'connecting',
          permissions: { canAnalyze: false, canLaunch: false, canMonitor: false },
        })
        .select()
        .single();

      if (error) {
        console.error('[ad-accounts] Connect error:', error);
        throw error;
      }

      console.log(`[ad-accounts] Started OAuth for ${platform} user=${userId}`);

      // In a real implementation, we'd redirect to OAuth
      // For now, simulate OAuth completion with a service client update
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

      // Simulate OAuth completion (in production, this would be a callback endpoint)
      setTimeout(async () => {
        await serviceClient
          .from('ad_account_connections')
          .update({
            status: 'full_access',
            account_id: `${platform.toLowerCase()}_${Date.now()}`,
            account_name: `${platform} Business Account`,
            permissions: { canAnalyze: true, canLaunch: true, canMonitor: true },
          })
          .eq('id', newAccount.id);
        console.log(`[ad-accounts] OAuth completed for ${newAccount.id}`);
      }, 3000);

      return new Response(JSON.stringify({
        id: newAccount.id,
        state: 'CONNECTING',
        allowedActions: [],
        message: 'OAuth flow initiated',
        oauthUrl: `https://example.com/oauth/${platform.toLowerCase()}?redirect=...`,
      }), {
        status: 202,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /ad-accounts/{id}/disconnect - Disconnect account
    if (req.method === 'POST' && pathParts.length === 3 && pathParts[2] === 'disconnect') {
      const accountId = pathParts[1];
      
      const { data: account, error: fetchError } = await supabase
        .from('ad_account_connections')
        .select('*')
        .eq('id', accountId)
        .single();
      
      if (fetchError || !account) {
        return new Response(JSON.stringify({ error: 'Account not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const permissions = parsePermissions(account.permissions);
      const state = account.status.toUpperCase() as AdAccountState;

      if (!isActionAllowed(state, permissions, 'DISCONNECT')) {
        return new Response(JSON.stringify({
          error: 'INVALID_TRANSITION',
          message: `Cannot disconnect account in ${state} state`,
          currentState: state,
          allowedActions: getAllowedActions(state, permissions),
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error: updateError } = await supabase
        .from('ad_account_connections')
        .update({
          status: 'disconnected',
          permissions: { canAnalyze: false, canLaunch: false, canMonitor: false },
        })
        .eq('id', accountId);

      if (updateError) {
        console.error('[ad-accounts] Disconnect error:', updateError);
        throw updateError;
      }

      console.log(`[ad-accounts] Disconnected ${accountId}`);

      return new Response(JSON.stringify({
        id: account.id,
        platform: account.platform.toUpperCase(),
        accountId: account.account_id,
        accountName: account.account_name,
        state: 'DISCONNECTED',
        permissions: [],
        allowedActions: ['CONNECT'],
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /ad-accounts/{id}/refresh - Refresh permissions
    if (req.method === 'POST' && pathParts.length === 3 && pathParts[2] === 'refresh') {
      const accountId = pathParts[1];
      
      const { data: account, error: fetchError } = await supabase
        .from('ad_account_connections')
        .select('*')
        .eq('id', accountId)
        .single();
      
      if (fetchError || !account) {
        return new Response(JSON.stringify({ error: 'Account not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const permissions = parsePermissions(account.permissions);
      const state = account.status.toUpperCase() as AdAccountState;

      if (!isActionAllowed(state, permissions, 'REFRESH_PERMISSIONS')) {
        return new Response(JSON.stringify({
          error: 'INVALID_TRANSITION',
          message: `Cannot refresh permissions in ${state} state`,
          currentState: state,
          allowedActions: getAllowedActions(state, permissions),
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Simulate permission refresh - grant full access
      const { error: updateError } = await supabase
        .from('ad_account_connections')
        .update({
          status: 'full_access',
          permissions: { canAnalyze: true, canLaunch: true, canMonitor: true },
        })
        .eq('id', accountId);

      if (updateError) {
        console.error('[ad-accounts] Refresh error:', updateError);
        throw updateError;
      }

      console.log(`[ad-accounts] Refreshed permissions for ${accountId}`);

      return new Response(JSON.stringify({
        id: account.id,
        platform: account.platform.toUpperCase(),
        accountId: account.account_id,
        accountName: account.account_name,
        state: 'FULL_ACCESS',
        permissions: ['ANALYZE', 'LAUNCH', 'OPTIMIZE'],
        allowedActions: getAllowedActions('FULL_ACCESS', ['ANALYZE', 'LAUNCH', 'OPTIMIZE']),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // DELETE /ad-accounts/{id} - Delete account connection
    if (req.method === 'DELETE' && pathParts.length === 2) {
      const accountId = pathParts[1];
      
      const { error } = await supabase
        .from('ad_account_connections')
        .delete()
        .eq('id', accountId);

      if (error) {
        console.error('[ad-accounts] Delete error:', error);
        throw error;
      }

      console.log(`[ad-accounts] Deleted ${accountId}`);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[ad-accounts] Error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Internal error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
