/**
 * Unified OAuth Types for AdLaunch AI
 * Platform-agnostic interfaces for OAuth token management
 */

export type Platform = 'google' | 'tiktok' | 'snapchat'

export interface OAuthAppConfig {
    clientId: string
    clientSecret: string
    redirectUri: string
    scopes: string[]
}

export interface OAuthTokens {
    access_token: string
    refresh_token?: string
    token_type: string
    expires_in?: number
    expires_at?: Date
    scope?: string
    /** TikTok specific */
    advertiser_ids?: string[]
}

export interface ConnectedAdAccount {
    id: string
    platform: Platform
    external_account_id: string
    account_name: string
    user_id: string
    project_id: string
    status: AdAccountStatus
    permissions: AdAccountPermissions
    token_expires_at: Date | null
    last_refresh_at: Date | null
    created_at: Date
    updated_at: Date
}

export type AdAccountStatus =
    | 'connecting'
    | 'connected'
    | 'full_access'
    | 'limited_permission'
    | 'expired'
    | 'revoked'
    | 'disconnected'

export interface AdAccountPermissions {
    canAnalyze: boolean
    canLaunch: boolean
    canMonitor: boolean
}

export interface OAuthState {
    id: string
    user_id: string
    platform: Platform
    state_token: string
    project_id: string | null
    redirect_after: string | null
    expires_at: Date
}

export interface OAuthCallbackResult {
    success: boolean
    connectionId?: string
    accountName?: string
    externalAccountId?: string
    error?: string
    errorCode?: string
}

export interface OAuthAuditEntry {
    user_id: string
    connection_id?: string
    platform: Platform
    action: OAuthAuditAction
    status: 'success' | 'failure' | 'pending'
    error_code?: string
    error_message?: string
    ip_address?: string
    user_agent?: string
    metadata?: Record<string, unknown>
}

export type OAuthAuditAction =
    | 'connect_start'
    | 'connect_success'
    | 'connect_failure'
    | 'disconnect'
    | 'refresh_success'
    | 'refresh_failure'
    | 'revoke'
    | 'expire'

/** Platform-specific account info returned after OAuth */
export interface DiscoveredAdAccount {
    external_id: string
    name: string
    platform: Platform
    currency?: string
    timezone?: string
    status?: string
}

/** Google Ads specific */
export interface GoogleCustomerInfo {
    customerId: string
    descriptiveName: string
    currencyCode: string
    timeZone: string
    manager: boolean
}

/** TikTok specific */
export interface TikTokAdvertiserInfo {
    advertiser_id: string
    name: string
    status: string
}

/** Snapchat specific */
export interface SnapchatAdAccountInfo {
    id: string
    name: string
    status: string
    currency: string
    timezone: string
}
