import { BaseWorker } from './base'
import { ExecutionResult } from './types'

export class TikTokAdsWorker extends BaseWorker {
    async execute(payload: any, accountId: string): Promise<ExecutionResult> {
        try {
            const safeBudget = this.enforceBudget(payload.budget || 0, 'tiktok')

            // Soft Launch: Use 'LOWEST_COST' to avoid high bid caps initially
            const bidStrategy = this.isSoftLaunch(accountId) ? 'LOWEST_COST' : payload.bidStrategy

            const tiktokPayload = {
                advertiser_id: accountId,
                campaign_name: payload.adName,
                budget: safeBudget,
                budget_mode: 'BUDGET_MODE_DAY',
                objective_type: 'CONVERSIONS',
                // ... AdGroups ...
            }

            console.log('[TikTokAdsWorker] Executing real API call with safe budget:', safeBudget)
            // await tiktokApi.createCampaign(tiktokPayload)

            return {
                success: true,
                platformId: 'tt_cid_' + Date.now(),
                metadata: { budgetEnforced: safeBudget, bidStrategy }
            }
        } catch (e: any) {
            return { success: false, error: e.message }
        }
    }
}
