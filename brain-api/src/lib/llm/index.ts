import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { z } from 'zod'

const ANALYSIS_TIMEOUT_MS = 15000 // 15 seconds strict timeout
const SYSTEM_PROMPT_PATH = path.join(process.cwd(), 'video_analysis_system_prompt.md')

// Strict schema for AI output
export const AIAnalysisSchema = z.object({
    analysis_id: z.string().optional(), // AI might hallucinate this, we'll override
    timestamp: z.string().optional(),
    platform: z.enum(['google', 'tiktok', 'snapchat']),
    status: z.enum(['APPROVED', 'APPROVED_WITH_CHANGES', 'AUTO_REWRITE_AVAILABLE', 'BLOCKED_SOFT', 'BLOCKED_HARD']),
    risk_score: z.number().min(0).max(100),
    detected_issues: z.array(z.object({
        type: z.enum(['VISUAL', 'AUDIO', 'TEXT', 'CLAIM']),
        severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
        description: z.string(),
        timeframe: z.string().optional()
    })),
    policy_reference: z.array(z.string()),
    rewrite_suggestion: z.object({
        original_text: z.string(),
        compliant_text: z.string(),
        reasoning: z.string()
    }).nullable(),
    recommended_action: z.string()
})

export type AIAnalysisResult = z.infer<typeof AIAnalysisSchema>

export interface LLMResponse {
    success: boolean
    data?: AIAnalysisResult
    error?: string
    metadata?: {
        modelVersion: string
        promptVersion: string
        latencyMs: number
        usedFallback: boolean
    }
}

export class LLMService {
    private openai: OpenAI | null = null
    private systemPrompt: string = ''
    private promptHash: string = ''
    private modelVersion: string = process.env.AI_MODEL_VERSION || 'gpt-4o'
    private apiKey: string | null = null

    constructor() {
        // First, try environment variable (fallback)
        if (process.env.OPENAI_API_KEY) {
            this.apiKey = process.env.OPENAI_API_KEY
            this.initializeOpenAI(this.apiKey)
        } else {
            console.warn('[LLMService] OPENAI_API_KEY not in environment. Will attempt to load from database per-request.')
        }
        this.loadSystemPrompt()
    }

    private initializeOpenAI(apiKey: string) {
        this.openai = new OpenAI({
            apiKey,
            timeout: ANALYSIS_TIMEOUT_MS
        })
    }

    private loadSystemPrompt() {
        try {
            if (fs.existsSync(SYSTEM_PROMPT_PATH)) {
                this.systemPrompt = fs.readFileSync(SYSTEM_PROMPT_PATH, 'utf-8')
                this.promptHash = crypto.createHash('sha256').update(this.systemPrompt).digest('hex').substring(0, 8)
                console.log(`[LLMService] Loaded System Prompt (Hash: ${this.promptHash})`)
            } else {
                console.error(`[LLMService] System prompt not found at ${SYSTEM_PROMPT_PATH}`)
                this.systemPrompt = "SYSTEM PROMPT MISSING"
                this.promptHash = "MISSING"
            }
        } catch (error) {
            console.error('[LLMService] Failed to load system prompt:', error)
            this.systemPrompt = "ERROR LOADING PROMPT"
            this.promptHash = "ERROR"
        }
    }

    private async fetchApiKeyFromDatabase(projectId: string): Promise<string | null> {
        try {
            const response = await fetch(`http://localhost:${process.env.PORT || 3000}/v1/settings/api-keys/decrypt/${projectId}`)
            if (!response.ok) return null

            const data: any = await response.json()
            if (!data.configured || !data.llm_api_key) return null

            return data.llm_api_key
        } catch (error) {
            console.error('[LLMService] Failed to fetch API key from database:', error)
            return null
        }
    }

    async analyzeVideoContent(inputData: any, projectId?: string): Promise<LLMResponse> {
        const startTime = Date.now()

        // 1. Try to fetch API key from database if projectId provided
        if (projectId && !this.apiKey) {
            const dbKey = await this.fetchApiKeyFromDatabase(projectId)
            if (dbKey) {
                this.apiKey = dbKey
                this.initializeOpenAI(dbKey)
                console.log('[LLMService] Loaded API key from database for project:', projectId)
            }
        }

        // 2. Check for API Availability
        if (!this.openai || !this.apiKey) {
            return this.createFallbackResponse(startTime, 'Missing API Key')
        }

        try {
            const completion = await this.openai.chat.completions.create({
                model: this.modelVersion,
                messages: [
                    { role: 'system', content: this.systemPrompt },
                    { role: 'user', content: JSON.stringify(inputData) }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.1, // Near deterministic
                max_tokens: 1000,
            })

            const content = completion.choices[0].message.content
            if (!content) throw new Error('Empty response from AI')

            // 2. Validate JSON
            const parsed = JSON.parse(content)
            const validated = AIAnalysisSchema.parse(parsed)

            return {
                success: true,
                data: validated,
                metadata: {
                    modelVersion: this.modelVersion,
                    promptVersion: this.promptHash,
                    latencyMs: Date.now() - startTime,
                    usedFallback: false
                }
            }

        } catch (error: any) {
            console.error('[LLMService] Analysis Failed:', error.message)
            return this.createFallbackResponse(startTime, error.message || 'Unknown Error')
        }
    }

    private createFallbackResponse(startTime: number, errorMessage: string): LLMResponse {
        return {
            success: false,
            error: errorMessage,
            metadata: {
                modelVersion: 'fallback-guard',
                promptVersion: this.promptHash,
                latencyMs: Date.now() - startTime,
                usedFallback: true
            },
            // Return a safe BLOCKED_SOFT state as requested
            data: {
                platform: 'google', // Default, will be overwritten by caller if needed
                status: 'BLOCKED_SOFT',
                risk_score: 99, // High risk due to uncertainty
                detected_issues: [{
                    type: 'CLAIM',
                    severity: 'HIGH',
                    description: `AI Analysis Unavailable: ${errorMessage}. Manual Review Required.`,
                    timeframe: '0:00 - End'
                }],
                policy_reference: ['System Stability Protocol'],
                rewrite_suggestion: null,
                recommended_action: 'Perform manual compliance review or retry later.'
            } as AIAnalysisResult
        }
    }
}
