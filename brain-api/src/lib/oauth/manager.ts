/**
 * OAuth Manager
 * Coordinates OAuth flow across all platforms
 */

import { GoogleOAuthService } from '../google/oauth'
import { TikTokOAuthService } from '../tiktok/oauth'
import { SnapchatOAuthService } from '../snapchat/oauth'
import { getOAuthDatabaseService, OAuthDatabaseService } from './database'
import {
    Platform,
    OAuthTokens,
    OAuthState,
    OAuthCallbackResult,
    AdAccountPermissions,
    DiscoveredAdAccount
} from './types'
import { BrainError } from '../errors'

// Platform OAuth configuration
const PLATFORM_CONFIGS: Record<Platform, {
    authUrl: string
    scopes: string[]
    buildAuthUrl: (clientId: string, redirectUri: string, state: string, scopes: string[]) => string
}> = {
    google: {
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        scopes: ['https://www.googleapis.com/auth/adwords'],
        buildAuthUrl: (clientId, redirectUri, state, scopes) => {
            const params = new URLSearchParams({
                client_id: clientId,
                redirect_uri: redirectUri,
                response_type: 'code',
                scope: scopes.join(' '),
                access_type: 'offline',
                prompt: 'consent',
                state
            })
            return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
        }
    },
    tiktok: {
        authUrl: 'https://business-api.tiktok.com/open_api/v1.3/oauth2/authorize/',
        scopes: ['ads_management', 'advertiser_management', 'reporting'],
        buildAuthUrl: (appId, redirectUri, state, scopes) => {
            const params = new URLSearchParams({
                app_id: appId,
                redirect_uri: redirectUri,
                state,
                scope: scopes.join(',')
            })
            return `https://business-api.tiktok.com/open_api/v1.3/oauth2/authorize/?${params.toString()}`
        }
    },
    snapchat: {
        authUrl: 'https://accounts.snapchat.com/login/oauth2/authorize',
        scopes: ['snapchat-marketing-api'],
        buildAuthUrl: (clientId, redirectUri, state, scopes) => {
            const params = new URLSearchParams({
                client_id: clientId,
                redirect_uri: redirectUri,
                response_type: 'code',
                scope: scopes.join(' '),
                state
            })
            return `https://accounts.snapchat.com/login/oauth2/authorize?${params.toString()}`
        }
    }
}

export class OAuthManager {
    private db: OAuthDatabaseService
    private googleOAuth: GoogleOAuthService
    private tiktokOAuth: TikTokOAuthService
    private snapchatOAuth: SnapchatOAuthService

    constructor() {
        this.db = getOAuthDatabaseService()
        this.googleOAuth = new GoogleOAuthService()
        this.tiktokOAuth = new TikTokOAuthService()
        this.snapchatOAuth = new SnapchatOAuthService()
    }

    /**
     * Step 1: Initiate OAuth flow
     * Creates state, pending connection, and returns authorization URL
     */
    async initiateOAuth(
        userId: string,
        platform: Platform,
        projectId: string,
        redirectAfter?: string,
        ipAddress?: string,
        userAgent?: string
    ): Promise<{ authUrl: string; connectionId: string; state: string }> {
        // Create OAuth state for CSRF protection
        const oauthState = await this.db.createOAuthState(
            userId,
            platform,
            projectId,
            redirectAfter
        )

        // Create pending connection
        const connectionId = await this.db.createPendingConnection(userId, platform, projectId)

        // Get platform config
        const config = PLATFORM_CONFIGS[platform]
        const clientId = this.getClientId(platform)
        const redirectUri = this.getRedirectUri(platform)

        // Build auth URL
        const authUrl = config.buildAuthUrl(clientId, redirectUri, oauthState.state_token, config.scopes)

        // Audit log
        await this.db.logAuditEvent({
            user_id: userId,
            connection_id: connectionId,
            platform,
            action: 'connect_start',
            status: 'pending',
            ip_address: ipAddress,
            user_agent: userAgent
        })

        console.log(`[OAuthManager] Initiated ${platform} OAuth for user ${userId}`)

        return {
            authUrl,
            connectionId,
            state: oauthState.state_token
        }
    }

    /**
     * Step 2: Handle OAuth callback
     * Validates state, exchanges code, stores tokens
     */
    async handleCallback(
        platform: Platform,
        code: string,
        state: string,
        ipAddress?: string,
        userAgent?: string
    ): Promise<OAuthCallbackResult> {
        // Validate and consume state
        const oauthState = await this.db.validateAndConsumeState(state)

        if (!oauthState) {
            return {
                success: false,
                error: 'Invalid or expired state parameter',
                errorCode: 'INVALID_STATE'
            }
        }

        // Find the pending connection for this user/platform
        const connections = await this.db.getConnectionsByUser(oauthState.user_id, oauthState.project_id || undefined)
        const pendingConnection = connections.find(
            c => c.platform === platform && c.status === 'connecting'
        )

        if (!pendingConnection) {
            return {
                success: false,
                error: 'No pending connection found',
                errorCode: 'NO_PENDING_CONNECTION'
            }
        }

        try {
            // Exchange code for tokens
            const tokens = await this.exchangeCode(platform, code)

            // Discover ad accounts
            const accounts = await this.discoverAdAccounts(platform, tokens)

            if (accounts.length === 0) {
                await this.db.failConnection(pendingConnection.id, 'No ad accounts found')
                await this.db.logAuditEvent({
                    user_id: oauthState.user_id,
                    connection_id: pendingConnection.id,
                    platform,
                    action: 'connect_failure',
                    status: 'failure',
                    error_code: 'NO_AD_ACCOUNTS',
                    error_message: 'No ad accounts accessible with this authorization',
                    ip_address: ipAddress,
                    user_agent: userAgent
                })

                return {
                    success: false,
                    error: 'No ad accounts found. Please ensure you have access to at least one ad account.',
                    errorCode: 'NO_AD_ACCOUNTS'
                }
            }

            // Use the first account (or in future, let user choose)
            const primaryAccount = accounts[0]
            const permissions: AdAccountPermissions = {
                canAnalyze: true,
                canLaunch: true,
                canMonitor: true
            }

            // Complete the connection
            await this.db.completeConnection(
                pendingConnection.id,
                primaryAccount.external_id,
                primaryAccount.name,
                tokens,
                permissions,
                PLATFORM_CONFIGS[platform].scopes
            )

            // Audit log success
            await this.db.logAuditEvent({
                user_id: oauthState.user_id,
                connection_id: pendingConnection.id,
                platform,
                action: 'connect_success',
                status: 'success',
                ip_address: ipAddress,
                user_agent: userAgent,
                metadata: {
                    account_id: primaryAccount.external_id,
                    account_name: primaryAccount.name,
                    accounts_discovered: accounts.length
                }
            })

            console.log(`[OAuthManager] ${platform} OAuth completed for user ${oauthState.user_id}`)

            return {
                success: true,
                connectionId: pendingConnection.id,
                accountName: primaryAccount.name,
                externalAccountId: primaryAccount.external_id
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'

            await this.db.failConnection(pendingConnection.id, errorMessage)
            await this.db.logAuditEvent({
                user_id: oauthState.user_id,
                connection_id: pendingConnection.id,
                platform,
                action: 'connect_failure',
                status: 'failure',
                error_message: errorMessage,
                ip_address: ipAddress,
                user_agent: userAgent
            })

            console.error(`[OAuthManager] ${platform} OAuth failed:`, error)

            return {
                success: false,
                error: errorMessage,
                errorCode: 'TOKEN_EXCHANGE_FAILED'
            }
        }
    }

    /**
     * Refresh tokens for a connection
     */
    async refreshConnection(connectionId: string): Promise<boolean> {
        const connection = await this.db.getConnection(connectionId)
        if (!connection) {
            console.error(`[OAuthManager] Connection ${connectionId} not found`)
            return false
        }

        const tokens = await this.db.getDecryptedTokens(connectionId)
        if (!tokens?.refresh_token) {
            console.error(`[OAuthManager] No refresh token for connection ${connectionId}`)
            await this.db.markTokenExpired(connectionId)
            return false
        }

        try {
            const newTokens = await this.refreshToken(connection.platform, tokens.refresh_token)

            await this.db.updateTokens(connectionId, {
                ...newTokens,
                // Keep the old refresh token if new one not provided
                refresh_token: newTokens.refresh_token || tokens.refresh_token
            })

            await this.db.logAuditEvent({
                user_id: connection.user_id,
                connection_id: connectionId,
                platform: connection.platform,
                action: 'refresh_success',
                status: 'success'
            })

            console.log(`[OAuthManager] Refreshed tokens for ${connection.platform} connection ${connectionId}`)
            return true
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'

            await this.db.markTokenExpired(connectionId)
            await this.db.logAuditEvent({
                user_id: connection.user_id,
                connection_id: connectionId,
                platform: connection.platform,
                action: 'refresh_failure',
                status: 'failure',
                error_message: errorMessage
            })

            console.error(`[OAuthManager] Token refresh failed for ${connectionId}:`, error)
            return false
        }
    }

    /**
     * Disconnect (revoke) an account
     */
    async revokeConnection(connectionId: string, userId: string): Promise<void> {
        const connection = await this.db.getConnection(connectionId)
        if (!connection || connection.user_id !== userId) {
            throw new BrainError('Connection not found or access denied')
        }

        const tokens = await this.db.getDecryptedTokens(connectionId)

        // Try to revoke tokens on the platform (best effort)
        if (tokens?.access_token) {
            try {
                await this.revokeToken(connection.platform, tokens.access_token)
            } catch (error) {
                console.warn(`[OAuthManager] Failed to revoke token on platform:`, error)
            }
        }

        // Disconnect locally
        await this.db.disconnectAccount(connectionId)

        await this.db.logAuditEvent({
            user_id: userId,
            connection_id: connectionId,
            platform: connection.platform,
            action: 'disconnect',
            status: 'success'
        })

        console.log(`[OAuthManager] Disconnected ${connection.platform} connection ${connectionId}`)
    }

    /**
     * Get all connections for a user
     */
    async getConnections(userId: string, projectId?: string) {
        return this.db.getConnectionsByUser(userId, projectId)
    }

    /**
     * Get access token for API calls (auto-refreshes if needed)
     */
    async getAccessToken(connectionId: string): Promise<string | null> {
        const connection = await this.db.getConnection(connectionId)
        if (!connection || connection.status === 'disconnected') {
            return null
        }

        // Check if token is expired or expiring soon (5 min)
        if (connection.token_expires_at) {
            const expiresIn = connection.token_expires_at.getTime() - Date.now()
            if (expiresIn < 5 * 60 * 1000) {
                // Token expired or expiring soon, refresh it
                const refreshed = await this.refreshConnection(connectionId)
                if (!refreshed) {
                    return null
                }
            }
        }

        const tokens = await this.db.getDecryptedTokens(connectionId)
        return tokens?.access_token || null
    }

    // ========================================================================
    // Private Helpers
    // ========================================================================

    private getClientId(platform: Platform): string {
        switch (platform) {
            case 'google':
                return process.env.GOOGLE_CLIENT_ID || ''
            case 'tiktok':
                return process.env.TIKTOK_APP_ID || ''
            case 'snapchat':
                return process.env.SNAPCHAT_CLIENT_ID || ''
        }
    }

    private getRedirectUri(platform: Platform): string {
        switch (platform) {
            case 'google':
                return process.env.GOOGLE_REDIRECT_URI || ''
            case 'tiktok':
                return process.env.TIKTOK_REDIRECT_URI || ''
            case 'snapchat':
                return process.env.SNAPCHAT_REDIRECT_URI || ''
        }
    }

    private async exchangeCode(platform: Platform, code: string): Promise<OAuthTokens> {
        switch (platform) {
            case 'google':
                return this.googleOAuth.exchangeCode(code)
            case 'tiktok':
                return this.tiktokOAuth.exchangeCode(code)
            case 'snapchat':
                return this.snapchatOAuth.exchangeCode(code)
        }
    }

    private async refreshToken(platform: Platform, refreshToken: string): Promise<OAuthTokens> {
        switch (platform) {
            case 'google':
                return this.googleOAuth.refreshToken(refreshToken)
            case 'tiktok':
                return this.tiktokOAuth.refreshToken(refreshToken)
            case 'snapchat':
                return this.snapchatOAuth.refreshToken(refreshToken)
        }
    }

    private async revokeToken(platform: Platform, accessToken: string): Promise<void> {
        switch (platform) {
            case 'google':
                return this.googleOAuth.revokeToken(accessToken)
            case 'tiktok':
                return this.tiktokOAuth.revokeToken(accessToken)
            case 'snapchat':
                return this.snapchatOAuth.revokeToken(accessToken)
        }
    }

    private async discoverAdAccounts(platform: Platform, tokens: OAuthTokens): Promise<DiscoveredAdAccount[]> {
        // For TikTok, advertiser_ids come with the token response
        if (platform === 'tiktok' && tokens.advertiser_ids && tokens.advertiser_ids.length > 0) {
            return tokens.advertiser_ids.map(id => ({
                external_id: id,
                name: `TikTok Advertiser ${id}`,
                platform
            }))
        }

        // For other platforms, we would call their APIs to discover accounts
        // For now, return a placeholder (real implementation would call Google/Snapchat APIs)
        switch (platform) {
            case 'google':
                // TODO: Call Google Ads API to list accessible customers
                return [{
                    external_id: 'google_' + Date.now(),
                    name: 'Google Ads Account',
                    platform
                }]
            case 'snapchat':
                // TODO: Call Snapchat API to list ad accounts
                return [{
                    external_id: 'snap_' + Date.now(),
                    name: 'Snapchat Ads Account',
                    platform
                }]
            default:
                return []
        }
    }
}

// Singleton instance
let oauthManager: OAuthManager | null = null

export function getOAuthManager(): OAuthManager {
    if (!oauthManager) {
        oauthManager = new OAuthManager()
    }
    return oauthManager
}
