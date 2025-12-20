import { BrainError } from '../errors'
import { CreateCampaignRequest, CreateAdGroupRequest } from './types'

export class TikTokAdsClient {
    private baseUrl = 'https://business-api.tiktok.com/open_api/v1.3'

    constructor(
        private accessToken: string,
        private advertiserId: string
    ) {
        if (!accessToken) {
            console.warn('[TikTokAdsClient] No access token provided.')
        }
    }

    private getHeaders() {
        return {
            'Access-Token': this.accessToken,
            'Content-Type': 'application/json'
        }
    }

    async validatePermissions(): Promise<boolean> {
        // Check if we can read advertiser info
        try {
            const url = `${this.baseUrl}/advertiser/info/`
            const params = new URLSearchParams({ advertiser_id: this.advertiserId })

            const res = await fetch(`${url}?${params}`, {
                method: 'GET',
                headers: this.getHeaders()
            })

            const result = await res.json()
            return result.code === 0
        } catch (e) {
            console.error('[TikTokAdsClient] Permission check failed', e)
            return false
        }
    }

    async createCampaign(config: CreateCampaignRequest): Promise<string> {
        const url = `${this.baseUrl}/campaign/create/`

        const payload = {
            advertiser_id: config.advertiserId,
            campaign_name: config.campaignName,
            objective_type: 'CONVERSIONS', // Conversion-only
            budget_mode: 'BUDGET_MODE_DAY',
            budget: config.budget,
            operation_status: 'DISABLE' // Start paused for safety
        }

        const res = await fetch(url, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(payload)
        })

        const result = await res.json()

        if (result.code !== 0) {
            throw new BrainError('TikTok Campaign Creation Failed', {
                details: result,
                status: 'EXECUTION_FAILED'
            })
        }

        return result.data.campaign_id
    }

    async createAdGroup(config: CreateAdGroupRequest): Promise<string> {
        const url = `${this.baseUrl}/adgroup/create/`

        const payload = {
            advertiser_id: config.advertiserId,
            campaign_id: config.campaignId,
            adgroup_name: config.adGroupName,
            optimization_goal: 'PURCHASE', // PURCHASE optimization only
            budget_mode: 'BUDGET_MODE_DAY',
            budget: config.budget,
            bid_type: config.bidType || 'BID_TYPE_NO_BID', // Lowest risk
            operation_status: 'DISABLE'
        }

        const res = await fetch(url, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(payload)
        })

        const result = await res.json()

        if (result.code !== 0) {
            throw new BrainError('TikTok Ad Group Creation Failed', {
                details: result,
                status: 'EXECUTION_FAILED'
            })
        }

        return result.data.adgroup_id
    }

    async uploadCreative(videoUrl: string, advertiserId: string): Promise<string> {
        // In production, this would upload video/image to TikTok
        // For now, we'll assume creative URLs are pre-uploaded or use TikTok's library
        const url = `${this.baseUrl}/file/video/ad/upload/`

        const payload = {
            advertiser_id: advertiserId,
            video_url: videoUrl,
            upload_type: 'UPLOAD_BY_URL'
        }

        const res = await fetch(url, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(payload)
        })

        const result = await res.json()

        if (result.code !== 0) {
            throw new BrainError('TikTok Creative Upload Failed', {
                details: result,
                status: 'EXECUTION_FAILED'
            })
        }

        return result.data.video_id
    }

    async createAd(adGroupId: string, creativeId: string, advertiserId: string): Promise<string> {
        const url = `${this.baseUrl}/ad/create/`

        const payload = {
            advertiser_id: advertiserId,
            adgroup_id: adGroupId,
            creatives: [{
                ad_name: `Ad - ${Date.now()}`,
                ad_format: 'SINGLE_VIDEO',
                video_id: creativeId,
                call_to_action: 'SHOP_NOW'
            }]
        }

        const res = await fetch(url, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(payload)
        })

        const result = await res.json()

        if (result.code !== 0) {
            throw new BrainError('TikTok Ad Creation Failed', {
                details: result,
                status: 'EXECUTION_FAILED'
            })
        }

        return result.data.ad_ids[0]
    }
}
