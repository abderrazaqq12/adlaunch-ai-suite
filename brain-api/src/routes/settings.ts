import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const app = new Hono()

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// Encryption helpers (reusing the same key as OAuth tokens)
const ENCRYPTION_KEY = process.env.OAUTH_ENCRYPTION_KEY
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
    console.warn('[Settings API] OAUTH_ENCRYPTION_KEY is missing or invalid. API key encryption will not work.')
}

function encrypt(text: string): string {
    if (!ENCRYPTION_KEY) throw new Error('Encryption key not configured')
    const algorithm = 'aes-256-gcm'
    const key = Buffer.from(ENCRYPTION_KEY, 'hex')
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(algorithm, key, iv)

    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    const authTag = cipher.getAuthTag()

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

function decrypt(encryptedText: string): string {
    if (!ENCRYPTION_KEY) throw new Error('Encryption key not configured')
    const algorithm = 'aes-256-gcm'
    const key = Buffer.from(ENCRYPTION_KEY, 'hex')
    const parts = encryptedText.split(':')

    if (parts.length !== 3) throw new Error('Invalid encrypted format')

    const [ivHex, authTagHex, encrypted] = parts
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    const decipher = crypto.createDecipheriv(algorithm, key, iv)

    decipher.setAuthTag(authTag)
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
}

const apiKeySchema = z.object({
    llm_provider: z.enum(['openai', 'anthropic', 'google']),
    llm_api_key: z.string().min(1),
    llm_model: z.string().min(1),
})

// GET /settings/api-keys - Retrieve API keys for the current project
app.get('/', async (c) => {
    const projectId = c.req.header('X-Project-Id')

    if (!projectId) {
        return c.json({ error: 'X-Project-Id header required' }, 400)
    }

    try {
        const { data, error } = await supabase
            .from('api_keys')
            .select('llm_provider, llm_model, created_at, updated_at')
            .eq('project_id', projectId)
            .single()

        if (error && error.code !== 'PGRST116') { // PGRST116 = not found
            console.error('[Settings API] Error fetching API keys:', error)
            return c.json({ error: 'Failed to fetch API keys' }, 500)
        }

        if (!data) {
            return c.json({ configured: false })
        }

        return c.json({
            configured: true,
            llm_provider: data.llm_provider,
            llm_model: data.llm_model,
            // Don't return the actual API key, just masked version
            llm_api_key_masked: '••••••••',
            created_at: data.created_at,
            updated_at: data.updated_at,
        })
    } catch (error) {
        console.error('[Settings API] Unexpected error:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// POST /settings/api-keys - Save/Update API keys
app.post('/', zValidator('json', apiKeySchema), async (c) => {
    const projectId = c.req.header('X-Project-Id')

    if (!projectId) {
        return c.json({ error: 'X-Project-Id header required' }, 400)
    }

    const body = c.req.valid('json')

    try {
        // Encrypt the API key before storing
        const encryptedKey = encrypt(body.llm_api_key)

        const { error } = await supabase
            .from('api_keys')
            .upsert({
                project_id: projectId,
                llm_provider: body.llm_provider,
                llm_api_key_encrypted: encryptedKey,
                llm_model: body.llm_model,
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'project_id'
            })

        if (error) {
            console.error('[Settings API] Error saving API keys:', error)
            return c.json({ error: 'Failed to save API keys' }, 500)
        }

        return c.json({
            success: true,
            message: 'API keys saved successfully'
        })
    } catch (error) {
        console.error('[Settings API] Unexpected error:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// GET /settings/api-keys/decrypt/:projectId - Internal use only (for LLMService)
app.get('/decrypt/:projectId', async (c) => {
    const projectId = c.param('projectId')

    try {
        const { data, error } = await supabase
            .from('api_keys')
            .select('llm_provider, llm_api_key_encrypted, llm_model')
            .eq('project_id', projectId)
            .single()

        if (error) {
            if (error.code === 'PGRST116') {
                return c.json({ configured: false })
            }
            console.error('[Settings API] Error fetching encrypted key:', error)
            return c.json({ error: 'Failed to fetch API key' }, 500)
        }

        if (!data || !data.llm_api_key_encrypted) {
            return c.json({ configured: false })
        }

        // Decrypt and return
        const decryptedKey = decrypt(data.llm_api_key_encrypted)

        return c.json({
            configured: true,
            llm_provider: data.llm_provider,
            llm_api_key: decryptedKey,
            llm_model: data.llm_model,
        })
    } catch (error) {
        console.error('[Settings API] Decryption error:', error)
        return c.json({ error: 'Failed to decrypt API key' }, 500)
    }
})

export default app
