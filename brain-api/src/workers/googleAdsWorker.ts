import { BaseWorker } from './base'
import { ExecutionResult } from './types'
import { GoogleOAuthService } from '../lib/google/oauth'
import { GoogleAdsClient } from '../lib/google/client'

export class GoogleAdsWorker extends BaseWorker {
    private oauth = new GoogleOAuthService()

    async execute(payload: any, accountId: string): Promise<ExecutionResult> {
        try {
            // 1. Budget Safety
            const safeBudget = this.enforceBudget(payload.budget || 0, 'google')

            // 2. Soft Launch Mode
            if (this.isSoftLaunch(accountId)) {
                // Force optimization settings for soft launch if needed
                payload.forceSoftLaunch = true
            }

            // 3. Auth & Client Setup
            // In a real flow, we need to get the user's refresh token from DB based on accountId or projectId.
            // For this implementation, we assume it's passed in payload.credentials for now OR strict failure.
            const refreshToken = payload.credentials?.refreshToken
            if (!refreshToken) {
                // Strict failure
                return {
                    success: false,
                    error: 'Missing Google Ads Refresh Token. Cannot Execute.'
                }
            }

            const tokens = await this.oauth.refreshToken(refreshToken)
            const client = new GoogleAdsClient(
                process.env.GOOGLE_DEVELOPER_TOKEN || '',
                accountId,
                tokens.access_token
            )

            // 4. Validate Permissions
            const hasPerms = await client.validatePermissions()
            if (!hasPerms) {
                return {
                    success: false,
                    error: 'SKIPPED_NO_PERMISSION: Cannot create campaigns.'
                }
            }

            // 5. Execute Real Creation
            console.log('[GoogleAdsWorker] Creating Real Demand Gen Campaign...')
            const resourceName = await client.createDemandGenCampaign({
                customerId: accountId,
                name: payload.adName || 'AdLaunch AI Campaign',
                budgetMicros: safeBudget * 1000000,
                status: 'PAUSED' // Safety
            })

            return {
                success: true,
                platformId: resourceName,
                metadata: { budgetEnforced: safeBudget, mode: 'SOFT_LAUNCH', resourceName }
            }
        } catch (e: any) {
            console.error('[GoogleAdsWorker] Execution Failed', e)
            return {
                success: false,
                error: e.message || 'Unknown Google Ads Error',
                metadata: { details: e.context }
            }
        }
    }
}
