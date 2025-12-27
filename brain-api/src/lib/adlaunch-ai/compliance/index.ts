import { MemoryEngine } from '../memory/index'
import { Creative } from '../orchestrator/types'
import { CreativeReplacementEngine } from '../engines/replacement'
import { CreativeScoreEngine, ScoredCreative } from '../engines/scoring'
import { LLMService, AIAnalysisResult } from '../../llm/index'

export interface ComplianceResult {
    passed: boolean
    issues: string[]
    details?: AIAnalysisResult
    decision_trace?: string[]
}

export interface FilterResult {
    filteredCampaign: any
    excludedCreatives: { id: string, reasons: string[] }[]
    allowedCount: number
    totalCount: number
    repairedCount: number
    scoredCreatives: ScoredCreative[]
}

export class ComplianceGuard {
    private replacer = new CreativeReplacementEngine()
    private scorer = new CreativeScoreEngine() // Added missing property init
    private llm = new LLMService()

    constructor(private memory: MemoryEngine) { }

    // Legacy validation upgraded to use Hybrid Logic
    async validate(campaign: any, platform: string, projectId: string): Promise<ComplianceResult> {
        // Construct detailed input for AI
        const inputData = {
            platform,
            asset_type: 'video', // Assuming video context
            language: 'en', // Default, should be passed in
            vertical: 'ecommerce', // Default, should be passed in
            target_country: 'US', // Default
            content: {
                headline: campaign.headline || campaign.name,
                adText: campaign.adText,
                description: campaign.description
            }
        }

        // 1. Run AI Analysis
        const aiResponse = await this.llm.analyzeVideoContent(inputData, projectId)
        let aiResult = aiResponse.data! // Fallback guarantees data exists
        const trace: string[] = [`AI_Model: ${aiResponse.metadata?.modelVersion}`, `Prompt_Hash: ${aiResponse.metadata?.promptVersion}`]

        if (!aiResponse.success) {
            trace.push(`AI_FAILURE: ${aiResponse.error}`)
        }

        // 2. Deterministic Regex Check (Hybrid Enforcement)
        const regexIssues = this.scanText(JSON.stringify(inputData.content), platform)
        const hasHardBlock = regexIssues.some(i => i.includes('HARD BLOCK'))

        // 3. Conflict Resolution & Risk Scoring
        let finalStatus = aiResult.status
        let finalIssues = [...aiResult.detected_issues]

        // Deterministic Overrides
        if (hasHardBlock) {
            if (finalStatus === 'APPROVED' || finalStatus === 'APPROVED_WITH_CHANGES') {
                finalStatus = 'BLOCKED_HARD'
                trace.push('OVERRIDE: Hard Block Regex triggered despite AI approval.')
            }

            // Add regex issues to the list
            regexIssues.forEach(issue => {
                finalIssues.push({
                    type: 'TEXT',
                    severity: issue.includes('HARD BLOCK') ? 'CRITICAL' : 'HIGH',
                    description: `[Automatic Safeguard] ${issue}`
                })
            })
        }

        // 4. Deterministic Risk Scoring
        // We do NOT trust the AI's risk_score. We calculate it ourselves.
        const calculatedRisk = this.calculateDeterministicRisk(finalIssues)
        aiResult.risk_score = calculatedRisk
        aiResult.status = finalStatus
        aiResult.detected_issues = finalIssues

        const passed = finalStatus === 'APPROVED' || finalStatus === 'APPROVED_WITH_CHANGES'

        // Store result in memory
        if (!passed) {
            await this.memory.store(projectId, 'compliance_block', {
                platform,
                issues: finalIssues.map(i => i.description),
                campaignId: campaign.id || 'unknown',
                timestamp: Date.now(),
                risk_score: calculatedRisk,
                trace
            })
        }

        return {
            passed,
            issues: finalIssues.map(i => i.description),
            details: aiResult,
            decision_trace: trace
        }
    }

    async filterBase(campaign: any, platform: string, projectId: string): Promise<FilterResult> {
        const creatives: Creative[] = campaign.creatives || []
        const allowedCreatives: Creative[] = []
        const excludedCreatives: { id: string, reasons: string[] }[] = []
        let repairedCount = 0

        for (const creative of creatives) {
            // Adapted to use the new validate logic per creative
            // This maps the creative to the "campaign" structure expected by validate
            const creativeAsCampaign = {
                headline: creative.content.headline,
                adText: creative.content.adText,
                description: creative.content.description,
                id: creative.id
            }

            const validation = await this.validate(creativeAsCampaign, platform, projectId)

            if (!validation.passed) {
                // Check if we can auto-repair (only if NOT BLOCKED_HARD)
                const isHardBlock = validation.details?.status === 'BLOCKED_HARD'

                if (isHardBlock) {
                    excludedCreatives.push({ id: creative.id, reasons: validation.issues })
                } else {
                    // Attempt replacement
                    // Note: Real replacement logic would ideally re-run validation. 
                    // For now, we assume if replacer runs, we re-check.
                    const replacement = this.replacer.replace(creative, validation.issues, platform as any)
                    // Simple re-check (could be optimized)
                    const reValidation = await this.validate({
                        headline: replacement.content.headline,
                        adText: replacement.content.adText,
                        description: replacement.content.description,
                        id: replacement.id
                    }, platform, projectId)

                    if (reValidation.passed) {
                        allowedCreatives.push(replacement)
                        repairedCount++
                    } else {
                        excludedCreatives.push({ id: creative.id, reasons: reValidation.issues })
                    }
                }
            } else {
                allowedCreatives.push(creative)
            }
        }

        // Fallback if no creatives
        if (creatives.length === 0) {
            const res = await this.validate(campaign, platform, projectId)
            if (!res.passed) {
                return {
                    filteredCampaign: campaign,
                    excludedCreatives: [{ id: 'campaign_intent', reasons: res.issues }],
                    allowedCount: 0,
                    totalCount: 1,
                    repairedCount: 0,
                    scoredCreatives: []
                }
            }
        }

        const scoredCreatives = await this.scorer.score(allowedCreatives, platform as any, projectId)

        return {
            filteredCampaign: {
                ...campaign,
                creatives: scoredCreatives.filter(c => c.status === 'ACTIVE')
            },
            excludedCreatives,
            allowedCount: allowedCreatives.length,
            totalCount: creatives.length || 1,
            repairedCount,
            scoredCreatives
        }
    }

    private calculateDeterministicRisk(issues: { severity: string }[]): number {
        let score = 0
        for (const issue of issues) {
            switch (issue.severity) {
                case 'CRITICAL': score += 100; break;
                case 'HIGH': score += 20; break;
                case 'MEDIUM': score += 10; break;
                case 'LOW': score += 5; break;
            }
        }
        return Math.min(score, 100)
    }

    // Deterministic Regex Scanner
    private scanText(text: string, platform: string): string[] {
        const issues: string[] = []
        const lowerText = text.toLowerCase()

        // HARD BLOCKS (Universal)
        const hardBlocks = ['guarantee', '100%', 'cure', 'instant results', 'before/after']
        for (const word of hardBlocks) {
            if (lowerText.includes(word)) issues.push(`HARD BLOCK: Prohibited term "${word}" detected.`)
        }

        // Platform Specific
        if (platform === 'google') {
            const list = ['crypto', 'gambling', 'hack']
            for (const word of list) if (lowerText.includes(word)) issues.push(`[Google] Restricted: "${word}"`)
        }

        return issues
    }
}
