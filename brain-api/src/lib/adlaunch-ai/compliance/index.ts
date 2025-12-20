import { MemoryEngine } from '../memory/index'
import { Creative } from '../orchestrator/types'
import { CreativeReplacementEngine } from '../engines/replacement'
import { CreativeScoreEngine, ScoredCreative } from '../engines/scoring'

export interface ComplianceResult {
    passed: boolean
    issues: string[]
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

    constructor(private memory: MemoryEngine) { }

    // Legacy/Campaign Level check (kept for existing validation flows if any)
    async validate(campaign: any, platform: string, projectId: string): Promise<ComplianceResult> {
        // Just scan campaign text fields roughly
        const textContent = [
            campaign.name,
            campaign.headline,
            campaign.adText,
            campaign.description
        ].filter(Boolean).join(' ').toLowerCase()

        const issues = this.scanText(textContent, platform)

        if (issues.length > 0) {
            await this.memory.store(projectId, 'compliance_block', {
                platform,
                issues,
                campaignId: campaign.id || 'unknown',
                timestamp: Date.now()
            })
            return { passed: false, issues }
        }
        return { passed: true, issues: [] }
    }

    async filterBase(campaign: any, platform: string, projectId: string): Promise<FilterResult> {
        const creatives: Creative[] = campaign.creatives || []
        const allowedCreatives: Creative[] = []
        const excludedCreatives: { id: string, reasons: string[] }[] = []
        let repairedCount = 0

        // 1. Scan Creatives with Auto-Replacement (Severity-Gated)
        for (const creative of creatives) {
            const scan = this.scanCreative(creative, platform)

            if (scan.status === 'BLOCKED') {
                // Check severity before attempting replacement
                const severity = this.replacer.classifyViolation(creative)

                if (severity === 'HARD') {
                    // HARD violations - no replacement allowed
                    excludedCreatives.push({ id: creative.id, reasons: [...scan.reasons, 'HARD_PROHIBITED'] })
                    console.log(`[ComplianceGuard] HARD violation - excluding creative ${creative.id} without replacement`)
                } else {
                    // SOFT violations - attempt auto-replacement
                    const replacement = this.replacer.replace(creative, scan.reasons, platform as 'google' | 'tiktok' | 'snap')
                    const reScan = this.scanCreative(replacement, platform)

                    if (reScan.status === 'COMPLIANT') {
                        // Replacement succeeded
                        allowedCreatives.push(replacement)
                        repairedCount++
                        console.log(`[ComplianceGuard] Auto-repaired creative ${creative.id} -> ${replacement.id}`)
                    } else {
                        // Replacement still blocked
                        excludedCreatives.push({ id: creative.id, reasons: scan.reasons })
                        console.log(`[ComplianceGuard] Replacement failed for ${creative.id} - still non-compliant`)
                    }
                }
            } else {
                allowedCreatives.push(creative)
            }
        }

        // 2. Also scan campaign-level text if present (title/desc) acts as a creative
        // If campaign has no creatives array, fallback to validating the campaign intent text itself
        if (creatives.length === 0) {
            const res = await this.validate(campaign, platform, projectId)
            if (!res.passed) {
                // Treat as "all blocked"
                return {
                    filteredCampaign: campaign,
                    excludedCreatives: [{ id: 'campaign_intent_fields', reasons: res.issues }],
                    allowedCount: 0,
                    totalCount: 1
                }
            }
        }

        // 3. Persist Logs
        if (excludedCreatives.length > 0) {
            await this.memory.store(projectId, 'creative_exclusion', {
                platform,
                excludedCount: excludedCreatives.length,
                details: excludedCreatives,
                timestamp: Date.now()
            })
        }

        // 4. Score and Select Creatives
        const scoredCreatives = await this.scorer.score(allowedCreatives, platform as 'google' | 'tiktok' | 'snap', projectId)

        // Return filtered campaign with scored creatives
        return {
            filteredCampaign: {
                ...campaign,
                creatives: scoredCreatives.filter(c => c.status === 'ACTIVE') // Only ACTIVE creatives in campaign
            },
            excludedCreatives,
            allowedCount: creatives.length > 0 ? allowedCreatives.length : 1,
            totalCount: creatives.length > 0 ? creatives.length : 1,
            repairedCount,
            scoredCreatives
        }
    }

    private scanCreative(creative: Creative, platform: string): { status: 'COMPLIANT' | 'BLOCKED', reasons: string[] } {
        const parts = [
            creative.content.headline,
            creative.content.adText,
            creative.content.description,
            creative.content.transcript
        ].filter(Boolean).join(' ').toLowerCase()

        const issues = this.scanText(parts, platform)

        // Also check URL if present (mock check)
        if (creative.url && creative.url.includes('malware')) {
            issues.push('Malicious URL detected')
        }

        return {
            status: issues.length > 0 ? 'BLOCKED' : 'COMPLIANT',
            reasons: issues
        }
    }

    private scanText(text: string, platform: string): string[] {
        const issues: string[] = []

        // Universal
        const prohibited = ['cure', 'guarantee', '100%', 'before/after', 'magic pill', 'instant result']
        for (const word of prohibited) if (text.includes(word)) issues.push(`Prohibited term: "${word}"`)

        // Platform Specific
        if (platform === 'google') {
            const list = ['crypto', 'gambling', 'weight loss', 'hack']
            for (const word of list) if (text.includes(word)) issues.push(`[Google] Restricted: "${word}"`)
        } else if (platform === 'tiktok' || platform === 'snap') {
            const list = ['adult', 'nsfw', 'tobacco', 'misleading', 'claim']
            for (const word of list) if (text.includes(word)) issues.push(`[${platform}] Restricted: "${word}"`)
        }

        return issues
    }
}
