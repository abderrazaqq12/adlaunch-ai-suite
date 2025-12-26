import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { timeout } from 'hono/timeout'
import { authMiddleware } from './middleware/auth'
import { errorHandler } from './lib/errors'
import v1 from './routes/v1'

const app = new Hono()

// Global Middleware
app.use('*', logger())

// Request timeout (30 seconds)
app.use('*', timeout(30000))

// Simple rate limiting (100 requests per minute per IP)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 100
const RATE_WINDOW = 60000 // 1 minute

app.use('/api/*', async (c, next) => {
    const ip = c.req.header('x-forwarded-for') || c.req.header('cf-connecting-ip') || 'unknown'
    const now = Date.now()
    const record = rateLimitMap.get(ip)

    if (!record || now > record.resetAt) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW })
    } else if (record.count >= RATE_LIMIT) {
        c.header('Retry-After', String(Math.ceil((record.resetAt - now) / 1000)))
        return c.json({ error: 'Too many requests' }, 429)
    } else {
        record.count++
    }

    await next()
})

// Health check endpoints (NO auth required)
app.get('/health', (c) => {
    return c.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
    })
})

app.get('/ready', async (c) => {
    // TODO: Add database ping if using PostgresAdapter
    return c.json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        service: 'brain-api',
    })
})

// Auth middleware (AFTER health checks)
app.use('/api/*', authMiddleware)

// Error Handling
app.onError(errorHandler)

// Routes
app.route('/api/brain/v1', v1)

// Export for verification/testing
export { app }

const port = parseInt(process.env.PORT || '3000', 10)

// Only run serve if this file is the entry point
// @ts-ignore: esrun/tsx check
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('index.ts')) {
    console.log(`[brain-api] Starting server on port ${port}...`)

    const server = serve({
        fetch: app.fetch,
        port
    })

    console.log(`[brain-api] Server is running on port ${port}`)

    // Graceful shutdown on SIGTERM (Fly.io sends this on restart)
    process.on('SIGTERM', () => {
        console.log('[brain-api] SIGTERM received, starting graceful shutdown...')

        server.close(() => {
            console.log('[brain-api] HTTP server closed')
            process.exit(0)
        })

        // Force exit after 30 seconds if graceful shutdown hangs
        setTimeout(() => {
            console.error('[brain-api] Forced shutdown after 30s timeout')
            process.exit(1)
        }, 30000)
    })

    // Graceful shutdown on SIGINT (Ctrl+C)
    process.on('SIGINT', () => {
        console.log('[brain-api] SIGINT received, starting graceful shutdown...')

        server.close(() => {
            console.log('[brain-api] HTTP server closed')
            process.exit(0)
        })

        // Force exit after 30 seconds
        setTimeout(() => {
            console.error('[brain-api] Forced shutdown after 30s timeout')
            process.exit(1)
        }, 30000)
    })

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
        console.error('[brain-api] Uncaught exception:', error)
        process.exit(1)
    })

    process.on('unhandledRejection', (reason, promise) => {
        console.error('[brain-api] Unhandled rejection at:', promise, 'reason:', reason)
        process.exit(1)
    })
}
