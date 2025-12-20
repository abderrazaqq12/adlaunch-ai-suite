import { BaseWorker } from './base'
import { ExecutionResult } from './types'
import { TikTokOAuthService } from '../lib/tiktok/oauth'
import { TikTokAdsClient } from '../lib/tiktok/client'

export class TikTokAdsWorker extends BaseWorker {
    private oauth = new TikTokOAuthService()

    async execute(payload: any, accountId: string): Promise<ExecutionResult> {
        try {
            // 1. Budget Safety
            const safeBudget = this.enforceBudget(payload.budget || 0, 'tiktok')

            // 2. Soft Launch Mode
            const bidType = this.isSoftLaunch(accountId) ? 'BID_TYPE_NO_BID' : 'BID_TYPE_CUSTOM'

            // 3. Auth & Client Setup
            // In real flow, retrieve refresh token from DB based on accountId
            const refreshToken = payload.credentials?.refreshToken
            if (!refreshToken) {
                return {
                    success: false,
                    error: 'Missing TikTok Ads Refresh Token. Cannot Execute.'
                }
            }

            const tokens = await this.oauth.refreshToken(refreshToken)
            const client = new TikTokAdsClient(tokens.access_token, accountId)

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

            // 6. Create Campaign (CONVERSIONS only)
            console.log('[TikTokAdsWorker] Creating Real CONVERSIONS Campaign...')
            const campaignId = await client.createCampaign({
                advertiserId: accountId,
                campaignName: payload.adName || 'AdLaunch AI Campaign',
                objective: 'CONVERSIONS',
                budgetMode: 'BUDGET_MODE_DAY',
                budget: safeBudget
            })

            // 7. Create Ad Group (PURCHASE optimization)
            const adGroupId = await client.createAdGroup({
                advertiserId: accountId,
                campaignId,
                adGroupName: `AdGroup - ${payload.adName || 'Default'}`,
                optimizationGoal: 'PURCHASE',
                budgetMode: 'BUDGET_MODE_DAY',
                budget: safeBudget,
                bidType
            })

            // 8. Upload Creatives & Create Ads
            const createdAds: string[] = []
            for (const creative of activeCreatives.slice(0, 3)) { // Top 3 only
                try {
                    // Assume creative has video_url or use placeholder
                    const videoUrl = creative.url || creative.content.videoUrl || 'placeholder'
                    const creativeId = await client.uploadCreative(videoUrl, accountId)
                    const adId = await client.createAd(adGroupId, creativeId, accountId)
                    createdAds.push(adId)
                } catch (e: any) {
                    console.error(`[TikTokAdsWorker] Failed to create ad for creative ${creative.id}:`, e.message)
                }
            }

            return {
                success: true,
                platformId: campaignId,
                metadata: {
                    budgetEnforced: safeBudget,
                    bidType,
                    campaignId,
                    adGroupId,
                    createdAds,
                    activeCreativeCount: activeCreatives.length
                }
            }
        } catch (e: any) {
            console.error('[TikTokAdsWorker] Execution Failed', e)
            return {
                success: false,
                error: e.message || 'Unknown TikTok Ads Error',
                metadata: { details: e.context }
            }
        }
    }
}
