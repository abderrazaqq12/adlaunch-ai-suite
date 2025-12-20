export interface OAuthTokens {
    access_token: string
    refresh_token?: string
    scope: string
    token_type: string
    expires_in: number
    advertiser_id?: string
}

export interface TikTokAdsConfig {
    appId: string
    appSecret: string
    redirectUri: string
}

export interface CreateCampaignRequest {
    advertiserId: string
    campaignName: string
    objective: 'CONVERSIONS'
    budgetMode: 'BUDGET_MODE_DAY'
    budget: number
}

export interface CreateAdGroupRequest {
    advertiserId: string
    campaignId: string
    adGroupName: string
    optimizationGoal: 'PURCHASE'
    budgetMode: 'BUDGET_MODE_DAY'
    budget: number
    bidType: 'BID_TYPE_NO_BID' | 'BID_TYPE_CUSTOM'
}

export interface TikTokAdsError {
    code: number
    message: string
    data?: any
}
