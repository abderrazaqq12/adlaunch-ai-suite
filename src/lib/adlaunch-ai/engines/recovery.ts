import { RecoveryResult, SafeVariant } from '../types';

/**
 * 5️⃣ Recovery Engine (Disapproved Ads)
 * 
 * Generates compliant alternatives for disapproved ads.
 * Enforces strict policy safety: No guarantees, No medical claims, No exaggeration.
 */
export class RecoveryEngine {

    private static BANNED_PHRASES = [
        'guaranteed', 'guarantee', '100%', 'cure', 'instant results',
        'magic', 'secret', 'lose weight fast', 'profit', 'make money'
    ];

    public static recover(
        originalAd: { hook: string; body: string; cta: string },
        platformCheck: string // e.g. "Google Policy: Misleading Claims"
    ): RecoveryResult {

        const safeVariants: SafeVariant[] = [];

        // Strategy 1: Sanitize (Remove banned words)
        const sanitized = this.sanitizeAd(originalAd);
        if (this.isDifferent(originalAd, sanitized)) {
            safeVariants.push(sanitized);
        }

        // Strategy 2: Soften claims (Pattern replacement)
        const softened = this.softenClaims(originalAd);
        if (this.isDifferent(originalAd, softened)) {
            safeVariants.push(softened);
        }

        // Strategy 3: Question format (Hooks often safer as questions)
        const questioned = this.convertToQuestion(originalAd);
        if (this.isDifferent(originalAd, questioned)) {
            safeVariants.push(questioned);
        }

        // Ensure we never return empty, fallback to a deeply safe generic
        if (safeVariants.length === 0) {
            safeVariants.push({
                hook: 'Discover our solution',
                body: 'Learn more about what we offer.',
                cta: 'Learn More' // Safest CTA
            });
        }

        return {
            safeVariants
        };
    }

    private static sanitizeAd(ad: { hook: string; body: string; cta: string }): SafeVariant {
        return {
            hook: this.removeBanned(ad.hook),
            body: this.removeBanned(ad.body),
            cta: this.removeBanned(ad.cta)
        };
    }

    private static removeBanned(text: string): string {
        let safe = text;
        this.BANNED_PHRASES.forEach(phrase => {
            const regex = new RegExp(phrase, 'gi');
            safe = safe.replace(regex, ''); // Removal strategy
        });
        return safe.replace(/\s+/g, ' ').trim(); // Cleanup spaces
    }

    private static softenClaims(ad: { hook: string; body: string; cta: string }): SafeVariant {
        // Replace "Guaranteed" with "Potential", "Instant" with "Fast"
        const replacements: Record<string, string> = {
            'guaranteed': 'potential',
            'instant': 'efficient',
            'cure': 'help',
            'make money': 'earn'
        };

        const replace = (text: string) => {
            let res = text;
            Object.entries(replacements).forEach(([key, val]) => {
                res = res.replace(new RegExp(key, 'gi'), val);
            });
            return res;
        };

        return {
            hook: replace(ad.hook),
            body: replace(ad.body),
            cta: replace(ad.cta)
        };
    }

    private static convertToQuestion(ad: { hook: string; body: string; cta: string }): SafeVariant {
        // If hook doesn't end in ?, try to frame it. 
        // "Get rich" -> "Want to grow your wealth?"
        // Heuristic: Prepend "Want to..." if plausible (complex w/o LLM but simple fallback)

        let newHook = ad.hook;
        if (!newHook.includes('?')) {
            newHook = `Ready to ${ad.hook.toLowerCase()}?`;
        }

        return {
            ...ad,
            hook: newHook
        };
    }

    private static isDifferent(a: { hook: string }, b: { hook: string }): boolean {
        return a.hook !== b.hook; // Simple check
    }
}
