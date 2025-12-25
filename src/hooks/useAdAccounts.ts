/**
 * useAdAccounts Hook
 * Manages ad account connections via OAuth
 *
 * Features:
 * - List connected accounts
 * - Initiate OAuth connection
 * - Refresh/revoke connections
 * - Status indicators
 */

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Types
export type Platform = 'google' | 'tiktok' | 'snapchat';

export type AdAccountStatus =
    | 'connecting'
    | 'connected'
    | 'full_access'
    | 'limited_permission'
    | 'expired'
    | 'revoked'
    | 'disconnected';

export interface ConnectedAdAccount {
    id: string;
    platform: Platform;
    accountId: string;
    accountName: string;
    status: AdAccountStatus;
    permissions: {
        canAnalyze: boolean;
        canLaunch: boolean;
        canMonitor: boolean;
    };
    tokenExpiresAt: string | null;
    lastRefreshAt: string | null;
    createdAt: string;
    needsReconnect: boolean;
}

// API Configuration
const BRAIN_API_URL = import.meta.env.VITE_BRAIN_API_URL || '';

async function getAuthHeaders() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
        throw new Error('Not authenticated');
    }
    return {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
    };
}

// API Functions
async function fetchAdAccounts(projectId?: string): Promise<ConnectedAdAccount[]> {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams();
    if (projectId) params.set('projectId', projectId);

    const response = await fetch(
        `${BRAIN_API_URL}/api/brain/v1/oauth/ad-accounts?${params.toString()}`,
        { headers }
    );

    if (!response.ok) {
        throw new Error('Failed to fetch ad accounts');
    }

    const data = await response.json();
    return data.accounts || [];
}

async function initiateOAuth(platform: Platform, projectId: string): Promise<{ authUrl: string }> {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams({ projectId });

    const response = await fetch(
        `${BRAIN_API_URL}/api/brain/v1/oauth/${platform}/connect?${params.toString()}`,
        { headers }
    );

    if (!response.ok) {
        throw new Error(`Failed to initiate ${platform} OAuth`);
    }

    return response.json();
}

async function refreshAccount(connectionId: string): Promise<void> {
    const headers = await getAuthHeaders();

    const response = await fetch(
        `${BRAIN_API_URL}/api/brain/v1/oauth/ad-accounts/${connectionId}/refresh`,
        { method: 'POST', headers }
    );

    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to refresh account');
    }
}

async function revokeAccount(connectionId: string): Promise<void> {
    const headers = await getAuthHeaders();

    const response = await fetch(
        `${BRAIN_API_URL}/api/brain/v1/oauth/ad-accounts/${connectionId}/revoke`,
        { method: 'POST', headers }
    );

    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to disconnect account');
    }
}

// Hook
export function useAdAccounts(projectId?: string) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [connectingPlatform, setConnectingPlatform] = useState<Platform | null>(null);

    // Query for accounts
    const {
        data: accounts = [],
        isLoading,
        error,
        refetch
    } = useQuery({
        queryKey: ['ad-accounts', projectId],
        queryFn: () => fetchAdAccounts(projectId),
        staleTime: 30000, // 30 seconds
        refetchInterval: 60000, // Refetch every minute to catch status changes
    });

    // Connect mutation
    const connectMutation = useMutation({
        mutationFn: ({ platform, projectId }: { platform: Platform; projectId: string }) =>
            initiateOAuth(platform, projectId),
        onSuccess: (data, variables) => {
            setConnectingPlatform(variables.platform);
            // Store return URL for after OAuth
            sessionStorage.setItem('oauth_return_url', window.location.href);
            // Redirect to OAuth provider
            window.location.href = data.authUrl;
        },
        onError: (error: Error) => {
            toast({
                title: 'Connection Failed',
                description: error.message,
                variant: 'destructive',
            });
        },
    });

    // Refresh mutation
    const refreshMutation = useMutation({
        mutationFn: refreshAccount,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ad-accounts'] });
            toast({
                title: 'Token Refreshed',
                description: 'Account token has been refreshed successfully.',
            });
        },
        onError: (error: Error) => {
            toast({
                title: 'Refresh Failed',
                description: error.message,
                variant: 'destructive',
            });
        },
    });

    // Revoke mutation
    const revokeMutation = useMutation({
        mutationFn: revokeAccount,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ad-accounts'] });
            toast({
                title: 'Account Disconnected',
                description: 'Ad account has been disconnected successfully.',
            });
        },
        onError: (error: Error) => {
            toast({
                title: 'Disconnect Failed',
                description: error.message,
                variant: 'destructive',
            });
        },
    });

    // Connect function
    const connect = useCallback((platform: Platform, projectId: string) => {
        connectMutation.mutate({ platform, projectId });
    }, [connectMutation]);

    // Refresh function
    const refresh = useCallback((connectionId: string) => {
        refreshMutation.mutate(connectionId);
    }, [refreshMutation]);

    // Revoke function
    const revoke = useCallback((connectionId: string) => {
        revokeMutation.mutate(connectionId);
    }, [revokeMutation]);

    // Helper to get accounts by platform
    const getAccountsByPlatform = useCallback((platform: Platform) => {
        return accounts.filter(a => a.platform === platform);
    }, [accounts]);

    // Helper to check if platform is connected
    const isPlatformConnected = useCallback((platform: Platform) => {
        return accounts.some(
            a => a.platform === platform &&
                !['disconnected', 'expired', 'revoked'].includes(a.status)
        );
    }, [accounts]);

    return {
        // Data
        accounts,
        isLoading,
        error,

        // Actions
        connect,
        refresh,
        revoke,
        refetch,

        // State
        isConnecting: connectMutation.isPending,
        isRefreshing: refreshMutation.isPending,
        isRevoking: revokeMutation.isPending,
        connectingPlatform,

        // Helpers
        getAccountsByPlatform,
        isPlatformConnected,
    };
}

// Platform display helpers
export const PLATFORM_LABELS: Record<Platform, string> = {
    google: 'Google Ads',
    tiktok: 'TikTok Ads',
    snapchat: 'Snapchat Ads',
};

export const PLATFORM_COLORS: Record<Platform, string> = {
    google: 'text-blue-500',
    tiktok: 'text-pink-500',
    snapchat: 'text-yellow-500',
};

export const STATUS_LABELS: Record<AdAccountStatus, string> = {
    connecting: 'Connecting...',
    connected: 'Connected',
    full_access: 'Active',
    limited_permission: 'Limited',
    expired: 'Expired',
    revoked: 'Revoked',
    disconnected: 'Disconnected',
};

export const STATUS_COLORS: Record<AdAccountStatus, string> = {
    connecting: 'bg-yellow-500',
    connected: 'bg-green-500',
    full_access: 'bg-green-500',
    limited_permission: 'bg-yellow-500',
    expired: 'bg-red-500',
    revoked: 'bg-red-500',
    disconnected: 'bg-gray-500',
};
