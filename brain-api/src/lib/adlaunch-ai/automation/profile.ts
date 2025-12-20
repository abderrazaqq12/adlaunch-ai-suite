import { MemoryEngine } from '../memory/index'
import { AutomationProfile, RiskLevel } from './types'

export class AutomationProfileManager {
    constructor(private memory: MemoryEngine) { }

    async getProfile(projectId: string, accountId: string, campaignId?: string): Promise<AutomationProfile> {
        // Try to get campaign-specific profile first
        if (campaignId) {
            const campaignProfile = await this.retrieveProfile(projectId, `${accountId}:${campaignId}`)
            if (campaignProfile) return campaignProfile
        }

        // Fall back to account-level profile
        const accountProfile = await this.retrieveProfile(projectId, accountId)
        if (accountProfile) return accountProfile

        // Return default conservative profile
        return this.getDefaultProfile(accountId, campaignId)
    }

    async updateProfile(projectId: string, profile: AutomationProfile): Promise<void> {
        const key = profile.campaignId
            ? `${profile.accountId}:${profile.campaignId}`
            : profile.accountId

        await this.memory.store(projectId, 'automation_profile', {
            ...profile,
            lastUpdated: Date.now()
        })
    }

    private async retrieveProfile(projectId: string, key: string): Promise<AutomationProfile | null> {
        try {
            const records = await this.memory.retrieve(projectId, 'automation_profile', 100)
            const match = records.find(r => {
                const p = r.payload as AutomationProfile
                const profileKey = p.campaignId ? `${p.accountId}:${p.campaignId}` : p.accountId
                return profileKey === key
            })
            return match ? match.payload as AutomationProfile : null
        } catch (e) {
            return null
        }
    }

    private getDefaultProfile(accountId: string, campaignId?: string): AutomationProfile {
        return {
            accountId,
            campaignId,
            allowBudgetIncrease: false,
            maxBudgetIncreasePct: 10,
            allowCreativeSwap: false,
            allowPlatformShift: false,
            riskLevel: 'LOW',
            lastUpdated: Date.now()
        }
    }
}
