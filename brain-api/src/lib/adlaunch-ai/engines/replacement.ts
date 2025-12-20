import { Creative } from '../orchestrator/types'

type ViolationSeverity = 'HARD' | 'SOFT'
type Platform = 'google' | 'tiktok' | 'snap'

export class CreativeReplacementEngine {
    // HARD violations - no replacement allowed
    private hardProhibited = [
        'before/after',
        'before and after',
        'weight loss guarantee',
        'guaranteed weight loss',
        'cure',
        'cures',
        'cured',
        'magic pill',
        'instant result'
    ]

    // SOFT violations - replacement allowed
    private softProhibited = [
        'guarantee',
        'guaranteed',
        '100%',
        'crypto',
        'gambling',
        'hack',
        'adult',
        'nsfw',
        'tobacco',
        'misleading',
        'claim'
    ]

    // Platform-specific replacement phrases
    private platformPhrases = {
        google: {
            support: 'designed to support',
            help: 'may help with',
            effective: 'intended for daily use',
            result: 'designed for comfort',
            benefit: 'supports your wellness goals'
        },
        tiktok: {
            support: 'great for',
            help: 'helps you feel',
            effective: 'works well for',
            result: 'perfect for your routine',
            benefit: 'supports your vibe'
        },
        snap: {
            support: 'fits your lifestyle',
            help: 'helps with',
            effective: 'perfect for daily use',
            result: 'designed for you',
            benefit: 'supports your goals'
        }
    }

    classifyViolation(creative: Creative): ViolationSeverity {
        const text = this.extractText(creative).toLowerCase()

        // Check for HARD violations
        for (const term of this.hardProhibited) {
            if (text.includes(term)) {
                return 'HARD'
            }
        }

        return 'SOFT'
    }

    replace(creative: Creative, violations: string[], platform: Platform): Creative {
        const replaced: Creative = {
            ...creative,
            id: `${creative.id}_replaced`,
            content: { ...creative.content }
        }

        // Apply semantic downgrading to all text fields
        if (replaced.content.headline) {
            replaced.content.headline = this.semanticDowngrade(replaced.content.headline, platform)
        }
        if (replaced.content.adText) {
            replaced.content.adText = this.semanticDowngrade(replaced.content.adText, platform)
        }
        if (replaced.content.description) {
            replaced.content.description = this.semanticDowngrade(replaced.content.description, platform)
        }
        if (replaced.content.transcript) {
            replaced.content.transcript = this.semanticDowngrade(replaced.content.transcript, platform)
        }

        return replaced
    }

    private semanticDowngrade(text: string, platform: Platform): string {
        let downgraded = text
        const phrases = this.platformPhrases[platform]

        // Semantic replacements (context-aware, not just word swaps)
        const replacements: [RegExp, string][] = [
            // Guarantee patterns
            [/guaranteed?\s+(?:to\s+)?(\w+)/gi, `${phrases.support} $1`],
            [/100%\s+guaranteed?/gi, phrases.effective],
            [/guaranteed?\s+results?/gi, phrases.result],

            // Certainty reduction
            [/will\s+(\w+)/gi, 'may $1'],
            [/always\s+(\w+)/gi, 'often $1'],
            [/never\s+(\w+)/gi, 'rarely $1'],

            // Outcome claims
            [/instant\s+results?/gi, phrases.benefit],
            [/immediate\s+results?/gi, phrases.benefit],

            // Platform-specific prohibited terms
            [/crypto(?:currency)?/gi, 'fintech'],
            [/gambling/gi, 'gaming'],
            [/weight\s+loss/gi, 'wellness'],
            [/hack/gi, 'tip'],
            [/adult/gi, 'mature'],
            [/nsfw/gi, 'mature content'],
            [/tobacco/gi, 'lifestyle product'],
            [/misleading/gi, 'informative'],

            // Simple word replacements (fallback)
            [/\b100%\b/gi, 'effective'],
            [/\bguarantee\b/gi, 'plan']
        ]

        for (const [pattern, replacement] of replacements) {
            downgraded = downgraded.replace(pattern, replacement)
        }

        return downgraded
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
