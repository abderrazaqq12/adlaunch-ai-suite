import { BrainError } from '../errors'
import { CreateCampaignRequest, CreateAdSquadRequest } from './types'

export class SnapchatAdsClient {
    private baseUrl = 'https://adsapi.snapchat.com/v1'

    constructor(
        private accessToken: string,
        private adAccountId: string
    ) {
        if (!accessToken) {
            console.warn('[SnapchatAdsClient] No access token provided.')
        }
    }

    private getHeaders() {
        return {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
        }
    }

    async validatePermissions(): Promise<boolean> {
        // Check if we can read ad account info
        try {
            const url = `${this.baseUrl}/adaccounts/${this.adAccountId}`

            const res = await fetch(url, {
                method: 'GET',
                headers: this.getHeaders()
            })

            const result = await res.json()
            return result.request_status === 'SUCCESS'
        } catch (e) {
            console.error('[SnapchatAdsClient] Permission check failed', e)
            return false
        }
    }

    async createCampaign(config: CreateCampaignRequest): Promise<string> {
        const url = `${this.baseUrl}/adaccounts/${config.adAccountId}/campaigns`

        const payload = {
            campaigns: [{
                name: config.name,
                ad_account_id: config.adAccountId,
                objective: 'PURCHASE', // Conversion-only
                daily_budget_micro: config.dailyBudgetMicro,
                status: 'PAUSED', // Start paused for safety
                start_time: new Date().toISOString()
            }]
        }

        const res = await fetch(url, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(payload)
        })

        const result = await res.json()

        if (result.request_status !== 'SUCCESS') {
            throw new BrainError('Snapchat Campaign Creation Failed', {
                details: result,
                status: 'EXECUTION_FAILED'
            })
        }

        return result.campaigns[0].campaign.id
    }

    async createAdSquad(config: CreateAdSquadRequest): Promise<string> {
        const url = `${this.baseUrl}/adaccounts/${config.adAccountId}/adsquads`

        const payload = {
            adsquads: [{
                name: config.name,
                campaign_id: config.campaignId,
                optimization_goal: 'PURCHASES', // PURCHASE optimization
                daily_budget_micro: config.dailyBudgetMicro,
                bid_micro: config.bidMicro || undefined, // Auto-bid if not specified
                status: 'PAUSED',
                type: 'SNAP_ADS',
                placement_v2: {
                    config: 'AUTOMATIC'
                }
            }]
        }

        const res = await fetch(url, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(payload)
        })

        const result = await res.json()

        if (result.request_status !== 'SUCCESS') {
            throw new BrainError('Snapchat Ad Squad Creation Failed', {
                details: result,
                status: 'EXECUTION_FAILED'
            })
        }

        return result.adsquads[0].adsquad.id
    }

    async uploadCreative(mediaUrl: string, adAccountId: string): Promise<string> {
        // In production, upload media to Snapchat
        // For now, assume media URLs are pre-uploaded or use Snapchat's library
        const url = `${this.baseUrl}/adaccounts/${adAccountId}/media`

        const payload = {
            media: [{
                name: `Creative - ${Date.now()}`,
                type: 'VIDEO',
                media_url: mediaUrl
            }]
        }

        const res = await fetch(url, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(payload)
        })

        const result = await res.json()

        if (result.request_status !== 'SUCCESS') {
            throw new BrainError('Snapchat Creative Upload Failed', {
                details: result,
                status: 'EXECUTION_FAILED'
            })
        }

        return result.media[0].media.id
    }

    async createAd(adSquadId: string, creativeId: string, adAccountId: string): Promise<string> {
        const url = `${this.baseUrl}/adaccounts/${adAccountId}/ads`

        const payload = {
            ads: [{
                name: `Ad - ${Date.now()}`,
                ad_squad_id: adSquadId,
                creative_id: creativeId,
                status: 'PAUSED',
                type: 'SNAP_AD'
            }]
        }

        const res = await fetch(url, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(payload)
        })

        const result = await res.json()

        if (result.request_status !== 'SUCCESS') {
            throw new BrainError('Snapchat Ad Creation Failed', {
                details: result,
                status: 'EXECUTION_FAILED'
            })
        }

        return result.ads[0].ad.id
    }
}
