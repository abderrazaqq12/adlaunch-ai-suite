import { BrainError } from '../errors'
import { CreateCampaignRequest } from './types'

export class GoogleAdsClient {
    private baseUrl = 'https://googleads.googleapis.com/v17/customers'

    constructor(
        private developerToken: string,
        private customerId: string,
        private accessToken: string,
        private loginCustomerId?: string
    ) {
        if (!process.env.GOOGLE_DEVELOPER_TOKEN) {
            console.warn('[GoogleAdsClient] No Developer Token found.')
        }
    }

    private getHeaders() {
        return {
            'Authorization': `Bearer ${this.accessToken}`,
            'developer-token': this.developerToken || process.env.GOOGLE_DEVELOPER_TOKEN || '',
            'login-customer-id': this.loginCustomerId || '',
            'Content-Type': 'application/json'
        }
    }

    async validatePermissions(): Promise<boolean> {
        // Simple check: list campaigns (limit 1) to verify read access.
        // For write access, we assume standard role usually grants it if read works, 
        // strictly speaking we'd need to check AccessRole but that's complex via basic REST.
        // This acts as a connectivity check.
        try {
            const query = `SELECT customer.id FROM customer LIMIT 1`
            await this.search(query)
            return true
        } catch (e) {
            console.error('[GoogleAdsClient] Permission check failed', e)
            return false
        }
    }

    async search(gaql: string): Promise<any> {
        const url = `${this.baseUrl}/${this.customerId}/googleAds:search`
        const res = await fetch(url, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ query: gaql })
        })

        if (!res.ok) {
            const err = await res.json()
            throw new BrainError('Google Ads API Error', { details: err })
        }
        return res.json()
    }

    async createDemandGenCampaign(config: CreateCampaignRequest): Promise<string> {
        // 1. Create Budget
        const budgetRes = await this.mutate('campaignBudgets', {
            operations: [{
                create: {
                    name: `Budget - ${config.name} - ${Date.now()}`,
                    amountMicros: config.budgetMicros,
                    deliveryMethod: 'STANDARD',
                    explicitlyShared: false
                }
            }]
        })
        const budgetResourceName = budgetRes.results[0].resourceName

        // 2. Create Campaign (Demand Gen)
        const campaignOp = {
            create: {
                name: config.name,
                status: config.status,
                campaignBudget: budgetResourceName,
                advertisingChannelType: 'DEMAND_GEN', // Or MULTI_CHANNEL if required by specific API version nuance
                // targetCpa: ... logic if provided
                networkSettings: {
                    targetGoogleSearch: false,
                    targetSearchNetwork: false,
                    targetContentNetwork: true
                }
            }
        }

        const campRes = await this.mutate('campaigns', { operations: [campaignOp] })
        return campRes.results[0].resourceName // "customers/123/campaigns/456"
    }

    private async mutate(resource: string, body: any): Promise<any> {
        const url = `${this.baseUrl}/${this.customerId}/${resource}:mutate`
        const res = await fetch(url, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(body)
        })

        if (!res.ok) {
            const err = await res.json()
            throw new BrainError(`Google Ads Mutate Error (${resource})`, { details: err, status: 'EXECUTION_FAILED' })
        }
        return res.json()
    }
}
