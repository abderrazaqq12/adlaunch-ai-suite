import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { authMiddleware } from './middleware/auth'
import { errorHandler } from './lib/errors'
import v1 from './routes/v1'

const app = new Hono()

// Global Middleware
app.use('*', logger())
app.use('*', authMiddleware)

// Error Handling
app.onError(errorHandler)

// Routes
app.route('/api/brain/v1', v1)

// Export for verification/testing
export { app }

// Health Check (Public? No, covered by auth middleware for now, but usually health is public)
// Let's exempt health check from auth if we wanted, but sticking to strict requirements: 
// "Base path: /api/brain/v1" for required endpoints.
// I'll add a root health check just in case, but after auth for security defaults unless specified.

const port = 3000

// Only run serve if this file is the entry point
// @ts-ignore: esrun/tsx check
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log(`Server is running on port ${port}`)
    serve({
        fetch: app.fetch,
        port
    })
}
