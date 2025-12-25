/**
 * OAuth Routes
 * Production OAuth endpoints for Google, TikTok, and Snapchat Ads
 *
 * Public endpoints (callbacks):
 * - GET /oauth/:platform/callback
 *
 * Authenticated endpoints:
 * - GET /oauth/:platform/connect
 * - GET /ad-accounts
 * - POST /ad-accounts/:id/refresh
 * - POST /ad-accounts/:id/revoke
 */

import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { getOAuthManager, Platform } from '../lib/oauth'

const app = new Hono()

// Valid platforms
const VALID_PLATFORMS = ['google', 'tiktok', 'snapchat'] as const

function isValidPlatform(platform: string): platform is Platform {
    return VALID_PLATFORMS.includes(platform as Platform)
}

// ============================================================================
// OAUTH INITIATION
// GET /oauth/:platform/connect
// ============================================================================

const connectQuerySchema = z.object({
    projectId: z.string().uuid(),
    redirect: z.string().optional()
})

app.get('/:platform/connect', zValidator('query', connectQuerySchema), async (c) => {
    const platform = c.req.param('platform')

    if (!isValidPlatform(platform)) {
        return c.json({ error: 'Invalid platform. Must be google, tiktok, or snapchat' }, 400)
    }

    const { projectId, redirect } = c.req.valid('query')
    const userId = c.get('userId')

    if (!userId) {
        return c.json({ error: 'Unauthorized' }, 401)
    }

    const manager = getOAuthManager()

    try {
        const { authUrl, connectionId, state } = await manager.initiateOAuth(
            userId,
            platform,
            projectId,
            redirect,
            c.req.header('x-forwarded-for') || c.req.header('cf-connecting-ip'),
            c.req.header('user-agent')
        )

        console.log(`[OAuth] Redirecting user ${userId} to ${platform} OAuth`)

        // Return auth URL for frontend to redirect
        return c.json({
            authUrl,
            connectionId,
            platform
        })
    } catch (error) {
        console.error(`[OAuth] Failed to initiate ${platform} OAuth:`, error)
        return c.json({
            error: error instanceof Error ? error.message : 'Failed to initiate OAuth'
        }, 500)
    }
})

// ============================================================================
// OAUTH CALLBACK
// GET /oauth/:platform/callback
// NOTE: This is called by the OAuth provider, not the frontend
// ============================================================================

app.get('/:platform/callback', async (c) => {
    const platform = c.req.param('platform')

    if (!isValidPlatform(platform)) {
        return c.redirect('/oauth-error?error=invalid_platform')
    }

    const code = c.req.query('code')
    const state = c.req.query('state')
    const error = c.req.query('error')

    // Handle OAuth errors from provider
    if (error) {
        const errorDescription = c.req.query('error_description') || error
        console.error(`[OAuth] ${platform} OAuth error:`, errorDescription)
        return c.redirect(`/oauth-error?error=${encodeURIComponent(errorDescription)}&platform=${platform}`)
    }

    if (!code || !state) {
        return c.redirect('/oauth-error?error=missing_parameters')
    }

    const manager = getOAuthManager()

    try {
        const result = await manager.handleCallback(
            platform,
            code,
            state,
            c.req.header('x-forwarded-for') || c.req.header('cf-connecting-ip'),
            c.req.header('user-agent')
        )

        if (result.success) {
            // Redirect to success page
            const successParams = new URLSearchParams({
                platform,
                connectionId: result.connectionId!,
                accountName: result.accountName || ''
            })
            return c.redirect(`/oauth-success?${successParams.toString()}`)
        } else {
            // Redirect to error page
            const errorParams = new URLSearchParams({
                platform,
                error: result.error || 'Unknown error',
                code: result.errorCode || 'UNKNOWN'
            })
            return c.redirect(`/oauth-error?${errorParams.toString()}`)
        }
    } catch (error) {
        console.error(`[OAuth] Callback error for ${platform}:`, error)
        return c.redirect(`/oauth-error?error=callback_failed&platform=${platform}`)
    }
})

// ============================================================================
// AD ACCOUNTS LIST
// GET /ad-accounts
// ============================================================================

const listQuerySchema = z.object({
    projectId: z.string().uuid().optional()
})

app.get('/ad-accounts', zValidator('query', listQuerySchema), async (c) => {
    const userId = c.get('userId')
    if (!userId) {
        return c.json({ error: 'Unauthorized' }, 401)
    }

    const { projectId } = c.req.valid('query')
    const manager = getOAuthManager()

    try {
        const connections = await manager.getConnections(userId, projectId)

        // Return sanitized response (no tokens!)
        const accounts = connections.map(conn => ({
            id: conn.id,
            platform: conn.platform,
            accountId: conn.external_account_id,
            accountName: conn.account_name,
            status: conn.status,
            permissions: conn.permissions,
            tokenExpiresAt: conn.token_expires_at?.toISOString() || null,
            lastRefreshAt: conn.last_refresh_at?.toISOString() || null,
            createdAt: conn.created_at.toISOString(),
            // Computed client-side helper
            needsReconnect: conn.status === 'expired' || conn.status === 'revoked'
        }))

        return c.json({ accounts })
    } catch (error) {
        console.error('[OAuth] Failed to list accounts:', error)
        return c.json({ error: 'Failed to list accounts' }, 500)
    }
})

// ============================================================================
// REFRESH TOKEN
// POST /ad-accounts/:id/refresh
// ============================================================================

app.post('/ad-accounts/:id/refresh', async (c) => {
    const userId = c.get('userId')
    if (!userId) {
        return c.json({ error: 'Unauthorized' }, 401)
    }

    const connectionId = c.req.param('id')
    const manager = getOAuthManager()

    try {
        // Verify ownership
        const connections = await manager.getConnections(userId)
        const connection = connections.find(conn => conn.id === connectionId)

        if (!connection) {
            return c.json({ error: 'Connection not found' }, 404)
        }

        const success = await manager.refreshConnection(connectionId)

        if (success) {
            return c.json({ success: true, message: 'Token refreshed successfully' })
        } else {
            return c.json({
                success: false,
                error: 'Failed to refresh token. Account may need to be reconnected.'
            }, 400)
        }
    } catch (error) {
        console.error(`[OAuth] Failed to refresh ${connectionId}:`, error)
        return c.json({ error: 'Failed to refresh token' }, 500)
    }
})

// ============================================================================
// REVOKE/DISCONNECT
// POST /ad-accounts/:id/revoke
// ============================================================================

app.post('/ad-accounts/:id/revoke', async (c) => {
    const userId = c.get('userId')
    if (!userId) {
        return c.json({ error: 'Unauthorized' }, 401)
    }

    const connectionId = c.req.param('id')
    const manager = getOAuthManager()

    try {
        await manager.revokeConnection(connectionId, userId)
        return c.json({ success: true, message: 'Account disconnected' })
    } catch (error) {
        console.error(`[OAuth] Failed to revoke ${connectionId}:`, error)
        return c.json({
            error: error instanceof Error ? error.message : 'Failed to disconnect account'
        }, 500)
    }
})

export default app
