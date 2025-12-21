import { Context, Next } from 'hono'
import { BrainError } from '../lib/errors'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client for JWT verification
const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('[auth] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Auth will fail in production.')
}

const supabase = supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null

export const authMiddleware = async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization')
    const projectId = c.req.header('X-Project-Id')
    const requestId = c.req.header('X-Request-Id') || crypto.randomUUID()

    // Set Request ID for tracing
    c.set('requestId', requestId)
    c.header('X-Request-Id', requestId)

    // Validate Authorization header
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new BrainError('Missing or invalid Authorization header', { requestId }, 401)
    }

    // Validate Project ID (optional but recommended)
    if (!projectId) {
        console.warn(`[auth] Request ${requestId} missing X-Project-Id header`)
    }

    const token = authHeader.split(' ')[1]

    try {
        // Verify JWT with Supabase (production-ready)
        if (!supabase) {
            throw new BrainError('Authentication service not configured', { requestId }, 500)
        }

        const { data: { user }, error } = await supabase.auth.getUser(token)

        if (error || !user) {
            throw new BrainError('Invalid or expired token', { requestId, error: error?.message }, 401)
        }

        // Store user context for downstream handlers
        c.set('userId', user.id)
        c.set('userEmail', user.email || '')
        c.set('projectId', projectId || '')

        console.log(`[auth] Request ${requestId} authenticated for user ${user.id}`)

        await next()
    } catch (error) {
        if (error instanceof BrainError) {
            throw error
        }
        console.error(`[auth] Authentication failed for request ${requestId}:`, error)
        throw new BrainError('Authentication failed', { requestId }, 401)
    }
}
