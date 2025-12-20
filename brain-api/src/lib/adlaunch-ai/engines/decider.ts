export class DeciderEngine {
    decide(campaignData: any): { go: boolean; issues: string[] } {
        const issues: string[] = []

        if (!campaignData.budget || campaignData.budget < 50) {
            issues.push('Budget too low for effective learning phase')
        }

        if (!campaignData.creatives || campaignData.creatives.length === 0) {
            issues.push('No creatives attached')
        }

        return {
            go: issues.length === 0,
            issues
        }
    }
}
