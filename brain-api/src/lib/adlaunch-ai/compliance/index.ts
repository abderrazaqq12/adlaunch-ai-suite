import { MemoryEngine } from '../memory/index'

export interface ComplianceResult {
    passed: boolean
    issues: string[]
}

export class ComplianceGuard {
    constructor(private memory: MemoryEngine) { }

    async validate(campaign: any, platform: string, projectId: string): Promise<ComplianceResult> {
        const issues: string[] = []

        // Extract text to analyze (naively from campaign object)
        const textContent = [
            campaign.name,
            campaign.headline,
            campaign.adText,
            campaign.description
        ].filter(Boolean).join(' ').toLowerCase()

        // 1. Universal Prohibited Keywords
        const prohibited = ['cure', 'guarantee', '100%', 'before/after', 'magic pill', 'instant result']
        for (const word of prohibited) {
            if (textContent.includes(word)) {
                issues.push(`Prohibited term found: "${word}"`)
            }
        }

        // 2. Platform Specific Rules
        if (platform === 'google') {
            // Strictest
            const googleProhibited = ['crypto', 'gambling', 'weight loss', 'hack']
            for (const word of googleProhibited) {
                if (textContent.includes(word)) {
                    issues.push(`[Google] Prohibited strict category: "${word}"`)
                }
            }
        } else if (platform === 'tiktok' || platform === 'snap') {
            // Medium
            const socialProhibited = ['adult', 'nsfw', 'tobacco']
            for (const word of socialProhibited) {
                if (textContent.includes(word)) {
                    issues.push(`[${platform}] Prohibited category: "${word}"`)
                }
            }
        }

        const passed = issues.length === 0

        // 3. Persistence
        // We log the decision to memory for audit trails
        if (!passed) {
            await this.memory.store(projectId, 'compliance_block', {
                platform,
                issues,
                campaignId: campaign.id || 'unknown',
                timestamp: Date.now()
            })
        }

        return { passed, issues }
    }
}
