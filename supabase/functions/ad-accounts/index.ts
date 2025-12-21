import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

// Mock database
const mockAccounts: Map<string, any> = new Map();

// Initialize with some mock accounts
mockAccounts.set('acc_google_1', {
  id: 'acc_google_1',
  platform: 'GOOGLE',
  accountId: '123-456-7890',
  accountName: 'My Google Ads Account',
  state: 'FULL_ACCESS',
  permissions: ['ANALYZE', 'LAUNCH', 'OPTIMIZE'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

mockAccounts.set('acc_tiktok_1', {
  id: 'acc_tiktok_1',
  platform: 'TIKTOK',
  accountId: 'tt_ads_001',
  accountName: 'TikTok Business',
  state: 'LIMITED_PERMISSION',
  permissions: ['ANALYZE'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  
  console.log(`[ad-accounts] ${req.method} ${url.pathname}`);

  try {
    // GET /ad-accounts - List all accounts with state and allowed actions
    if (req.method === 'GET' && pathParts.length === 1) {
      const accounts = Array.from(mockAccounts.values()).map(account => ({
        id: account.id,
        platform: account.platform,
        accountId: account.accountId,
        accountName: account.accountName,
        state: account.state,
        permissions: account.permissions,
        allowedActions: getAllowedActions(account.state, account.permissions),
      }));

      return new Response(JSON.stringify({ accounts }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /ad-accounts/{id} - Get single account
    if (req.method === 'GET' && pathParts.length === 2) {
      const accountId = pathParts[1];
      const account = mockAccounts.get(accountId);
      
      if (!account) {
        return new Response(JSON.stringify({ error: 'Account not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        ...account,
        allowedActions: getAllowedActions(account.state, account.permissions),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /ad-accounts/connect - Initiate OAuth connection
    if (req.method === 'POST' && pathParts.length === 2 && pathParts[1] === 'connect') {
      const body = await req.json();
      const { platform } = body;
      
      if (!['GOOGLE', 'TIKTOK', 'SNAPCHAT'].includes(platform)) {
        return new Response(JSON.stringify({ error: 'Invalid platform' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const accountId = `acc_${platform.toLowerCase()}_${Date.now()}`;
      const now = new Date().toISOString();
      
      const newAccount = {
        id: accountId,
        platform,
        accountId: null,
        accountName: null,
        state: 'CONNECTING' as AdAccountState,
        permissions: [],
        createdAt: now,
        updatedAt: now,
      };
      
      mockAccounts.set(accountId, newAccount);
      console.log(`[ad-accounts] Started OAuth for ${platform}`);

      // Simulate OAuth completion after delay
      setTimeout(() => {
        const account = mockAccounts.get(accountId);
        if (account && account.state === 'CONNECTING') {
          account.state = 'FULL_ACCESS';
          account.accountId = `${platform.toLowerCase()}_${Date.now()}`;
          account.accountName = `${platform} Business Account`;
          account.permissions = ['ANALYZE', 'LAUNCH', 'OPTIMIZE'];
          account.updatedAt = new Date().toISOString();
          mockAccounts.set(accountId, account);
          console.log(`[ad-accounts] OAuth completed for ${accountId}`);
        }
      }, 3000);

      return new Response(JSON.stringify({
        id: accountId,
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
      const account = mockAccounts.get(accountId);
      
      if (!account) {
        return new Response(JSON.stringify({ error: 'Account not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!isActionAllowed(account.state, account.permissions, 'DISCONNECT')) {
        return new Response(JSON.stringify({
          error: 'INVALID_TRANSITION',
          message: `Cannot disconnect account in ${account.state} state`,
          currentState: account.state,
          allowedActions: getAllowedActions(account.state, account.permissions),
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      account.state = 'DISCONNECTED';
      account.permissions = [];
      account.updatedAt = new Date().toISOString();
      mockAccounts.set(accountId, account);
      console.log(`[ad-accounts] Disconnected ${accountId}`);

      return new Response(JSON.stringify({
        ...account,
        allowedActions: getAllowedActions(account.state, account.permissions),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /ad-accounts/{id}/refresh - Refresh permissions
    if (req.method === 'POST' && pathParts.length === 3 && pathParts[2] === 'refresh') {
      const accountId = pathParts[1];
      const account = mockAccounts.get(accountId);
      
      if (!account) {
        return new Response(JSON.stringify({ error: 'Account not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!isActionAllowed(account.state, account.permissions, 'REFRESH_PERMISSIONS')) {
        return new Response(JSON.stringify({
          error: 'INVALID_TRANSITION',
          message: `Cannot refresh permissions in ${account.state} state`,
          currentState: account.state,
          allowedActions: getAllowedActions(account.state, account.permissions),
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Simulate permission refresh
      account.permissions = ['ANALYZE', 'LAUNCH', 'OPTIMIZE'];
      account.state = 'FULL_ACCESS';
      account.updatedAt = new Date().toISOString();
      mockAccounts.set(accountId, account);
      console.log(`[ad-accounts] Refreshed permissions for ${accountId}`);

      return new Response(JSON.stringify({
        ...account,
        allowedActions: getAllowedActions(account.state, account.permissions),
      }), {
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
