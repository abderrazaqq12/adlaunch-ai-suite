import { Creative } from '../orchestrator/types'
import { MemoryEngine } from '../memory/index'

type Platform = 'google' | 'tiktok' | 'snap'

export interface ScoreBreakdown {
    safety: number
    platform_fit: number
    language_risk: number
    history: number
}

export interface ScoredCreative extends Creative {
    score: number
    breakdown: ScoreBreakdown
    status: 'ACTIVE' | 'BACKUP'
    wasReplaced?: boolean
}

export class CreativeScoreEngine {
    constructor(private memory: MemoryEngine) { }

    async score(
        creatives: Creative[],
        platform: Platform,
        projectId: string
    ): Promise<ScoredCreative[]> {
        const scored: ScoredCreative[] = []

        for (const creative of creatives) {
            const breakdown = await this.calculateBreakdown(creative, platform, projectId)
            const totalScore = Math.max(0, Math.min(100,
                breakdown.safety + breakdown.platform_fit + breakdown.language_risk + breakdown.history
            ))

            scored.push({
                ...creative,
                score: totalScore,
                breakdown,
                status: 'BACKUP', // Will be set after sorting
                wasReplaced: creative.id.includes('_replaced')
            })
        }

        // Sort by score DESC
        scored.sort((a, b) => b.score - a.score)

        // Mark top 3 as ACTIVE
        for (let i = 0; i < Math.min(3, scored.length); i++) {
            scored[i].status = 'ACTIVE'
        }

        return scored
    }

    private async calculateBreakdown(
        creative: Creative,
        platform: Platform,
        projectId: string
    ): Promise<ScoreBreakdown> {
        const text = this.extractText(creative).toLowerCase()

        // Base scores
        let safety = 40
        let platform_fit = 30
        let language_risk = 20
        let history = 10

        // Safety deductions
        if (creative.id.includes('_replaced')) {
            safety -= 10 // Penalize auto-replaced creatives
        }
        if (this.hasRiskyPatterns(text)) {
            safety -= 15
        }

        // Platform fit scoring
        const fitScore = this.calculatePlatformFit(text, platform)
        platform_fit = Math.round(platform_fit * fitScore)

        // Language risk deductions
        const certaintyCount = this.countCertaintyLanguage(text)
        language_risk -= certaintyCount * 5 // -5 per certainty word

        // History deductions (check memory for past rejections)
        const hasRejectionHistory = await this.checkHistory(creative.id, projectId)
        if (hasRejectionHistory) {
            history -= 5
        }

        return {
            safety: Math.max(0, safety),
            platform_fit: Math.max(0, platform_fit),
            language_risk: Math.max(0, language_risk),
            history: Math.max(0, history)
        }
    }

    private hasRiskyPatterns(text: string): boolean {
        const riskyPatterns = [
            'free',
            'limited time',
            'act now',
            'don\'t miss',
            'exclusive offer',
            'secret',
            'miracle'
        ]
        return riskyPatterns.some(pattern => text.includes(pattern))
    }

    private calculatePlatformFit(text: string, platform: Platform): number {
        // Platform-appropriate phrases
        const platformPhrases = {
            google: ['designed', 'support', 'intended', 'may help', 'comfort'],
            tiktok: ['great for', 'perfect', 'vibe', 'feel', 'routine'],
            snap: ['lifestyle', 'fits', 'goals', 'daily']
        }

        const phrases = platformPhrases[platform]
        let matchCount = 0
        for (const phrase of phrases) {
            if (text.includes(phrase)) matchCount++
        }

        // Return score multiplier (0.5 to 1.0)
        return 0.5 + (matchCount / phrases.length) * 0.5
    }

    private countCertaintyLanguage(text: string): number {
        const certaintyWords = ['will', 'always', 'never', 'definitely', 'absolutely', 'certainly']
        let count = 0
        for (const word of certaintyWords) {
            const regex = new RegExp(`\\b${word}\\b`, 'gi')
            const matches = text.match(regex)
            if (matches) count += matches.length
        }
        return count
    }

    private async checkHistory(creativeId: string, projectId: string): Promise<boolean> {
        try {
            const records = await this.memory.retrieve(projectId, 'creative_exclusion', 10)
            return records.some(r =>
                r.payload?.details?.some((d: any) => d.id === creativeId)
            )
        } catch (e) {
            return false
        }
    }

    private extractText(creative: Creative): string {
        return [
            creative.content.headline,
            creative.content.adText,
            creative.content.description,
            creative.content.transcript
        ].filter(Boolean).join(' ')
    }
}
