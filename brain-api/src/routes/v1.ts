import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { PermissionsEngine } from '../lib/adlaunch-ai/engines/permissions'
import { TranslatorEngine } from '../lib/adlaunch-ai/engines/translator'
import { DeciderEngine } from '../lib/adlaunch-ai/engines/decider'
import { OptimizerEngine } from '../lib/adlaunch-ai/engines/optimizer'
import { RecoveryEngine } from '../lib/adlaunch-ai/engines/recovery'
import { MemoryEngine } from '../lib/adlaunch-ai/memory/index'
import { DevInMemoryAdapter, PostgresAdapter } from '../lib/adlaunch-ai/memory/adapters'
import oauthRoutes from './oauth'

const app = new Hono()

// Initialize Engines
// In a real app we might inject these or use a singleton pattern
const permissions = new PermissionsEngine()
const translator = new TranslatorEngine()
const decider = new DeciderEngine()
const optimizer = new OptimizerEngine()
const recovery = new RecoveryEngine()

// Memory Setup
const dbAdapter = process.env.DATABASE_URL
    ? new PostgresAdapter(process.env.DATABASE_URL)
    : new DevInMemoryAdapter()
const memory = new MemoryEngine(dbAdapter)

// 1. Permissions Interpret
const permissionsSchema = z.object({
    role: z.string(),
    action: z.string(),
    resource: z.string()
})

app.post('/permissions/interpret', zValidator('json', permissionsSchema), async (c) => {
    const body = c.req.valid('json')
    const result = permissions.interpret(body)
    return c.json(result)
})

// 2. Campaigns Translate
const translatorSchema = z.object({
    campaign: z.record(z.any()),
    targetPlatform: z.enum(['google', 'tiktok', 'snap'])
})

app.post('/campaigns/translate', zValidator('json', translatorSchema), async (c) => {
    const { campaign, targetPlatform } = c.req.valid('json')
    const result = translator.translate(campaign, targetPlatform)
    return c.json(result)
})

// 3. Launch Decide
const deciderSchema = z.object({
    budget: z.number().optional(),
    creatives: z.array(z.any()).optional(),
    name: z.string().optional()
}).passthrough()

app.post('/launch/decide', zValidator('json', deciderSchema), async (c) => {
    const body = c.req.valid('json')
    // Determine user intent from body
    const result = decider.decide(body)
    return c.json(result)
})

// 4. Optimize Act
const optimizerSchema = z.object({
    ctr: z.number(),
    cpa: z.number(),
    spend: z.number()
})

app.post('/optimize/act', zValidator('json', optimizerSchema), async (c) => {
    const body = c.req.valid('json')
    const result = optimizer.act(body)
    return c.json(result)
})

// 5. Recover Generate
const recoverySchema = z.object({
    code: z.string(),
    details: z.any().optional()
})

app.post('/recover/generate', zValidator('json', recoverySchema), async (c) => {
    const body = c.req.valid('json')
    const result = recovery.generate(body)
    return c.json(result)
})

// 6. Memory Write
const memoryWriteSchema = z.object({
    type: z.string(),
    payload: z.any()
})

app.post('/memory/write', zValidator('json', memoryWriteSchema), async (c) => {
    const { type, payload } = c.req.valid('json')
    const projectId = c.req.header('X-Project-Id')! // Middleware guarantees this exists

    const record = await memory.store(projectId, type, payload)
    return c.json(record)
})

// --- Orchestrator ---
import { LaunchOrchestrator } from '../lib/adlaunch-ai/orchestrator/index'
import { ComplianceGuard } from '../lib/adlaunch-ai/compliance/index'

const compliance = new ComplianceGuard(memory)
const orchestrator = new LaunchOrchestrator(permissions, translator, decider, memory, compliance)

const launchRunSchema = z.object({
    idempotency_key: z.string(),
    campaign_intent: z.record(z.any()),
    execution_status: z.enum(['BLOCKED', 'PARTIAL_READY', 'READY']),
    policy_risk_score: z.number(),
    targets: z.array(z.object({
        platform: z.enum(['google', 'tiktok', 'snap']),
        accounts: z.array(z.string()),
        config: z.record(z.any()).optional()
    }))
})

app.post('/launch/run', zValidator('json', launchRunSchema), async (c) => {
    const body = c.req.valid('json')
    const projectId = c.req.header('X-Project-Id')!

    const result = await orchestrator.runLaunch(projectId, body)
    return c.json(result)
})

// --- Automation ---
import { AutomationRulesEngine } from '../lib/adlaunch-ai/automation/engine'

const automationEngine = new AutomationRulesEngine(memory)

// POST /automation/run - Trigger automation evaluation
app.post('/automation/run', async (c) => {
    const projectId = c.req.header('X-Project-Id')!

    const logs = await automationEngine.run(projectId)
    return c.json({
        success: true,
        actionsExecuted: logs.length,
        logs
    })
})

// GET /automation/logs - Retrieve automation audit logs
app.get('/automation/logs', async (c) => {
    const projectId = c.req.header('X-Project-Id')!
    const limit = parseInt(c.req.query('limit') || '50')

    const logs = await automationEngine.getLogs(projectId, limit)
    return c.json({
        logs,
        count: logs.length
    })
})

// --- Automation Profiles (Phase 2) ---
import { AutomationProfileManager } from '../lib/adlaunch-ai/automation/profile'

const profileManager = new AutomationProfileManager(memory)

// GET /automation/profile - Get automation profile
app.get('/automation/profile', async (c) => {
    const projectId = c.req.header('X-Project-Id')!
    const accountId = c.req.query('accountId')
    const campaignId = c.req.query('campaignId')

    if (!accountId) {
        return c.json({ error: 'accountId required' }, 400)
    }

    const profile = await profileManager.getProfile(projectId, accountId, campaignId)
    return c.json({ profile })
})

// POST /automation/profile/update - Update automation profile
const profileUpdateSchema = z.object({
    accountId: z.string(),
    campaignId: z.string().optional(),
    allowBudgetIncrease: z.boolean(),
    maxBudgetIncreasePct: z.number().min(0).max(50),
    allowCreativeSwap: z.boolean(),
    allowPlatformShift: z.boolean(),
    riskLevel: z.enum(['LOW', 'MEDIUM'])
})

app.post('/automation/profile/update', zValidator('json', profileUpdateSchema), async (c) => {
    const projectId = c.req.header('X-Project-Id')!
    const body = c.req.valid('json')

    await profileManager.updateProfile(projectId, {
        ...body,
        lastUpdated: Date.now()
    })

    return c.json({ success: true })
})

// --- OAuth Routes ---
app.route('/oauth', oauthRoutes)

export default app
