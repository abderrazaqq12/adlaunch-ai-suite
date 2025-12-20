export interface OAuthTokens {
    access_token: string
    refresh_token?: string
    expires_in: number
    token_type: string
}

export interface SnapchatAdsConfig {
    clientId: string
    clientSecret: string
    redirectUri: string
}

export interface CreateCampaignRequest {
    adAccountId: string
    name: string
    objective: 'PURCHASE'
    dailyBudgetMicro: number
    status: 'ACTIVE' | 'PAUSED'
}

export interface CreateAdSquadRequest {
    adAccountId: string
    campaignId: string
    name: string
    optimizationGoal: 'PURCHASES'
    dailyBudgetMicro: number
    bidMicro?: number
    status: 'ACTIVE' | 'PAUSED'
}

export interface SnapchatAdsError {
    request_status: string
    request_id: string
    debug_message?: string
}
