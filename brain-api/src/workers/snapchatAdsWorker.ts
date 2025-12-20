import { BaseWorker } from './base'
import { ExecutionResult } from './types'
import { SnapchatOAuthService } from '../lib/snapchat/oauth'
import { SnapchatAdsClient } from '../lib/snapchat/client'

export class SnapchatAdsWorker extends BaseWorker {
    private oauth = new SnapchatOAuthService()

    async execute(payload: any, accountId: string): Promise<ExecutionResult> {
        try {
            // 1. Budget Safety (Snapchat uses micro units: $1 = 1,000,000 micro)
            const safeBudget = this.enforceBudget(payload.budget || 0, 'snap')
            const budgetMicro = safeBudget * 1000000

            // 2. Soft Launch Mode (auto-bid for lowest risk)
            const useBidding = !this.isSoftLaunch(accountId)

            // 3. Auth & Client Setup
            const refreshToken = payload.credentials?.refreshToken
            if (!refreshToken) {
                return {
                    success: false,
                    error: 'Missing Snapchat Ads Refresh Token. Cannot Execute.'
                }
            }

            const tokens = await this.oauth.refreshToken(refreshToken)
            const client = new SnapchatAdsClient(tokens.access_token, accountId)

            // 4. Validate Permissions
            const hasPerms = await client.validatePermissions()
            if (!hasPerms) {
                return {
                    success: false,
                    error: 'SKIPPED_NO_PERMISSION: Cannot create campaigns.'
                }
            }

            // 5. Creative Pipeline
            // NOTE: Creatives have already been filtered, replaced, and scored by orchestrator
            // payload.creatives contains only ACTIVE creatives (top 3)
            const activeCreatives = payload.creatives || []
            if (activeCreatives.length === 0) {
                return {
                    success: false,
                    error: 'No ACTIVE creatives available for execution.'
                }
            }

            // 6. Create Campaign (PURCHASE only)
            console.log('[SnapchatAdsWorker] Creating Real PURCHASE Campaign...')
            const campaignId = await client.createCampaign({
                adAccountId: accountId,
                name: payload.adName || 'AdLaunch AI Campaign',
                objective: 'PURCHASE',
                dailyBudgetMicro: budgetMicro,
                status: 'PAUSED'
            })

            // 7. Create Ad Squad (PURCHASES optimization)
            const adSquadId = await client.createAdSquad({
                adAccountId: accountId,
                campaignId,
                name: `AdSquad - ${payload.adName || 'Default'}`,
                optimizationGoal: 'PURCHASES',
                dailyBudgetMicro: budgetMicro,
                bidMicro: useBidding ? undefined : undefined, // Auto-bid
                status: 'PAUSED'
            })

            // 8. Upload Creatives & Create Ads
            const createdAds: string[] = []
            for (const creative of activeCreatives.slice(0, 3)) { // Top 3 only
                try {
                    const mediaUrl = creative.url || creative.content.videoUrl || 'placeholder'
                    const creativeId = await client.uploadCreative(mediaUrl, accountId)
                    const adId = await client.createAd(adSquadId, creativeId, accountId)
                    createdAds.push(adId)
                } catch (e: any) {
                    console.error(`[SnapchatAdsWorker] Failed to create ad for creative ${creative.id}:`, e.message)
                }
            }

            return {
                success: true,
                platformId: campaignId,
                metadata: {
                    budgetEnforced: safeBudget,
                    budgetMicro,
                    campaignId,
                    adSquadId,
                    createdAds,
                    activeCreativeCount: activeCreatives.length
                }
            }
        } catch (e: any) {
            console.error('[SnapchatAdsWorker] Execution Failed', e)
            return {
                success: false,
                error: e.message || 'Unknown Snapchat Ads Error',
                metadata: { details: e.context }
            }
        }
    }
}
