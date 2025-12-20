import { Creative } from '../orchestrator/types'

export class CreativeReplacementEngine {
    private replacements: Map<string, string> = new Map([
        // Universal replacements
        ['guarantee', 'plan'],
        ['guaranteed', 'planned'],
        ['cure', 'help'],
        ['cures', 'helps'],
        ['100%', 'effective'],
        ['before/after', 'transformation'],
        ['magic pill', 'solution'],
        ['instant result', 'quick benefit'],

        // Platform-specific (Google)
        ['crypto', 'fintech'],
        ['gambling', 'gaming'],
        ['weight loss', 'wellness'],
        ['hack', 'tip'],

        // Platform-specific (TikTok/Snap)
        ['adult', 'mature'],
        ['nsfw', 'mature content'],
        ['tobacco', 'lifestyle'],
        ['misleading', 'informative'],
        ['claim', 'statement']
    ])

    replace(creative: Creative, violations: string[]): Creative {
        const replaced: Creative = {
            ...creative,
            id: `${creative.id}_replaced`,
            content: { ...creative.content }
        }

        // Apply replacements to all text fields
        if (replaced.content.headline) {
            replaced.content.headline = this.sanitizeText(replaced.content.headline)
        }
        if (replaced.content.adText) {
            replaced.content.adText = this.sanitizeText(replaced.content.adText)
        }
        if (replaced.content.description) {
            replaced.content.description = this.sanitizeText(replaced.content.description)
        }
        if (replaced.content.transcript) {
            replaced.content.transcript = this.sanitizeText(replaced.content.transcript)
        }

        return replaced
    }

    private sanitizeText(text: string): string {
        let sanitized = text

        // Apply all replacements (case-insensitive)
        this.replacements.forEach((replacement, prohibited) => {
            const regex = new RegExp(prohibited, 'gi')
            sanitized = sanitized.replace(regex, replacement)
        })

        return sanitized
    }
}
