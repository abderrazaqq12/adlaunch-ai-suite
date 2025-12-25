/**
 * OAuth Database Service
 * Handles all Supabase interactions for OAuth state, tokens, and audit logging
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { encrypt, decrypt, generateStateToken } from './encryption'
import {
    Platform,
    OAuthState,
    OAuthTokens,
    ConnectedAdAccount,
    OAuthAuditEntry,
    AdAccountStatus,
    AdAccountPermissions
} from './types'

const STATE_TTL_MINUTES = 10

export class OAuthDatabaseService {
    private supabase: SupabaseClient

    constructor() {
        const supabaseUrl = process.env.SUPABASE_URL
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error('Missing Supabase credentials')
        }

        this.supabase = createClient(supabaseUrl, supabaseServiceKey)
    }

    // ========================================================================
    // OAuth State Management (CSRF Protection)
    // ========================================================================

    async createOAuthState(
        userId: string,
        platform: Platform,
        projectId?: string,
        redirectAfter?: string
    ): Promise<OAuthState> {
        const stateToken = generateStateToken()
        const expiresAt = new Date(Date.now() + STATE_TTL_MINUTES * 60 * 1000)

        const { data, error } = await this.supabase
            .from('oauth_states')
            .insert({
                user_id: userId,
                platform,
                state_token: stateToken,
                project_id: projectId || null,
                redirect_after: redirectAfter || null,
                expires_at: expiresAt.toISOString()
            })
            .select()
            .single()

        if (error) {
            throw new Error(`Failed to create OAuth state: ${error.message}`)
        }

        return {
            id: data.id,
            user_id: data.user_id,
            platform: data.platform,
            state_token: data.state_token,
            project_id: data.project_id,
            redirect_after: data.redirect_after,
            expires_at: new Date(data.expires_at)
        }
    }

    async validateAndConsumeState(stateToken: string): Promise<OAuthState | null> {
        const { data, error } = await this.supabase
            .from('oauth_states')
            .select('*')
            .eq('state_token', stateToken)
            .single()

        if (error || !data) {
            return null
        }

        // Check expiry
        if (new Date(data.expires_at) < new Date()) {
            // Clean up expired state
            await this.supabase.from('oauth_states').delete().eq('id', data.id)
            return null
        }

        // Consume the state (delete it to prevent reuse)
        await this.supabase.from('oauth_states').delete().eq('id', data.id)

        return {
            id: data.id,
            user_id: data.user_id,
            platform: data.platform,
            state_token: data.state_token,
            project_id: data.project_id,
            redirect_after: data.redirect_after,
            expires_at: new Date(data.expires_at)
        }
    }

    // ========================================================================
    // Ad Account Connection Management
    // ========================================================================

    async createPendingConnection(
        userId: string,
        platform: Platform,
        projectId: string
    ): Promise<string> {
        const { data, error } = await this.supabase
            .from('ad_account_connections')
            .insert({
                user_id: userId,
                project_id: projectId,
                platform,
                account_id: `pending_${Date.now()}`,
                account_name: `${platform.toUpperCase()} Account (Connecting...)`,
                status: 'connecting',
                permissions: { canAnalyze: false, canLaunch: false, canMonitor: false }
            })
            .select('id')
            .single()

        if (error) {
            throw new Error(`Failed to create connection: ${error.message}`)
        }

        return data.id
    }

    async completeConnection(
        connectionId: string,
        externalAccountId: string,
        accountName: string,
        tokens: OAuthTokens,
        permissions: AdAccountPermissions,
        scopes: string[]
    ): Promise<void> {
        const expiresAt = tokens.expires_in
            ? new Date(Date.now() + tokens.expires_in * 1000)
            : new Date(Date.now() + 3600 * 1000) // Default 1 hour

        // Update connection
        const { error: connError } = await this.supabase
            .from('ad_account_connections')
            .update({
                account_id: externalAccountId,
                external_account_id: externalAccountId,
                account_name: accountName,
                status: 'full_access',
                permissions,
                token_expires_at: expiresAt.toISOString(),
                last_refresh_at: new Date().toISOString()
            })
            .eq('id', connectionId)

        if (connError) {
            throw new Error(`Failed to update connection: ${connError.message}`)
        }

        // Store encrypted tokens
        const { error: tokenError } = await this.supabase
            .from('oauth_tokens')
            .upsert({
                connection_id: connectionId,
                access_token_encrypted: encrypt(tokens.access_token),
                refresh_token_encrypted: tokens.refresh_token
                    ? encrypt(tokens.refresh_token)
                    : null,
                token_type: tokens.token_type || 'Bearer',
                expires_at: expiresAt.toISOString(),
                scopes
            }, {
                onConflict: 'connection_id'
            })

        if (tokenError) {
            throw new Error(`Failed to store tokens: ${tokenError.message}`)
        }
    }

    async failConnection(connectionId: string, errorMessage: string): Promise<void> {
        await this.supabase
            .from('ad_account_connections')
            .update({
                status: 'disconnected',
                account_name: 'Connection Failed'
            })
            .eq('id', connectionId)
    }

    async getConnection(connectionId: string): Promise<ConnectedAdAccount | null> {
        const { data, error } = await this.supabase
            .from('ad_account_connections')
            .select('*')
            .eq('id', connectionId)
            .single()

        if (error || !data) {
            return null
        }

        return this.mapConnection(data)
    }

    async getConnectionsByUser(userId: string, projectId?: string): Promise<ConnectedAdAccount[]> {
        let query = this.supabase
            .from('ad_account_connections')
            .select('*')
            .eq('user_id', userId)
            .neq('status', 'disconnected')
            .order('created_at', { ascending: false })

        if (projectId) {
            query = query.eq('project_id', projectId)
        }

        const { data, error } = await query

        if (error) {
            throw new Error(`Failed to fetch connections: ${error.message}`)
        }

        return (data || []).map(this.mapConnection)
    }

    async disconnectAccount(connectionId: string): Promise<void> {
        // Delete tokens first
        await this.supabase.from('oauth_tokens').delete().eq('connection_id', connectionId)

        // Update connection status
        await this.supabase
            .from('ad_account_connections')
            .update({
                status: 'disconnected',
                permissions: { canAnalyze: false, canLaunch: false, canMonitor: false },
                token_expires_at: null
            })
            .eq('id', connectionId)
    }

    // ========================================================================
    // Token Management
    // ========================================================================

    async getDecryptedTokens(connectionId: string): Promise<OAuthTokens | null> {
        const { data, error } = await this.supabase
            .from('oauth_tokens')
            .select('*')
            .eq('connection_id', connectionId)
            .single()

        if (error || !data) {
            return null
        }

        return {
            access_token: decrypt(data.access_token_encrypted),
            refresh_token: data.refresh_token_encrypted
                ? decrypt(data.refresh_token_encrypted)
                : undefined,
            token_type: data.token_type,
            expires_at: new Date(data.expires_at)
        }
    }

    async updateTokens(connectionId: string, tokens: OAuthTokens): Promise<void> {
        const expiresAt = tokens.expires_in
            ? new Date(Date.now() + tokens.expires_in * 1000)
            : new Date(Date.now() + 3600 * 1000)

        // Update tokens
        await this.supabase
            .from('oauth_tokens')
            .update({
                access_token_encrypted: encrypt(tokens.access_token),
                refresh_token_encrypted: tokens.refresh_token
                    ? encrypt(tokens.refresh_token)
                    : null,
                expires_at: expiresAt.toISOString()
            })
            .eq('connection_id', connectionId)

        // Update connection metadata
        await this.supabase
            .from('ad_account_connections')
            .update({
                token_expires_at: expiresAt.toISOString(),
                last_refresh_at: new Date().toISOString(),
                status: 'full_access'
            })
            .eq('id', connectionId)
    }

    async markTokenExpired(connectionId: string): Promise<void> {
        await this.supabase
            .from('ad_account_connections')
            .update({ status: 'expired' })
            .eq('id', connectionId)
    }

    async getExpiringConnections(minutesBeforeExpiry: number = 5): Promise<ConnectedAdAccount[]> {
        const threshold = new Date(Date.now() + minutesBeforeExpiry * 60 * 1000)

        const { data, error } = await this.supabase
            .from('ad_account_connections')
            .select('*')
            .lt('token_expires_at', threshold.toISOString())
            .in('status', ['full_access', 'connected', 'limited_permission'])

        if (error) {
            console.error('[OAuthDB] Failed to fetch expiring connections:', error)
            return []
        }

        return (data || []).map(this.mapConnection)
    }

    // ========================================================================
    // Audit Logging
    // ========================================================================

    async logAuditEvent(entry: OAuthAuditEntry): Promise<void> {
        const { error } = await this.supabase
            .from('oauth_audit_log')
            .insert({
                user_id: entry.user_id,
                connection_id: entry.connection_id || null,
                platform: entry.platform,
                action: entry.action,
                status: entry.status,
                error_code: entry.error_code || null,
                error_message: entry.error_message || null,
                ip_address: entry.ip_address || null,
                user_agent: entry.user_agent || null,
                metadata: entry.metadata || {}
            })

        if (error) {
            console.error('[OAuthDB] Failed to log audit event:', error)
        }
    }

    // ========================================================================
    // Helpers
    // ========================================================================

    private mapConnection(data: any): ConnectedAdAccount {
        return {
            id: data.id,
            platform: data.platform,
            external_account_id: data.external_account_id || data.account_id,
            account_name: data.account_name,
            user_id: data.user_id,
            project_id: data.project_id,
            status: data.status as AdAccountStatus,
            permissions: data.permissions as AdAccountPermissions,
            token_expires_at: data.token_expires_at ? new Date(data.token_expires_at) : null,
            last_refresh_at: data.last_refresh_at ? new Date(data.last_refresh_at) : null,
            created_at: new Date(data.created_at),
            updated_at: new Date(data.updated_at)
        }
    }
}

// Singleton instance
let dbService: OAuthDatabaseService | null = null

export function getOAuthDatabaseService(): OAuthDatabaseService {
    if (!dbService) {
        dbService = new OAuthDatabaseService()
    }
    return dbService
}
