export interface OAuthTokens {
    access_token: string
    refresh_token?: string
    scope: string
    token_type: string
    expiry_date?: number
}

export interface GoogleAdsConfig {
    developerToken: string
    clientId: string
    clientSecret: string
    redirectUri: string
}

export interface CampaignConversionGoal {
    category: 'DOWNLOAD' | 'PURCHASE' | 'SIGNUP'
    origin: 'WEBSITE' | 'APP'
}

export interface CreateCampaignRequest {
    customerId: string
    name: string
    budgetMicros: number
    targetCpaMicros?: number
    status: 'ENABLED' | 'PAUSED'
}

export interface GoogleAdsError {
    error: {
        code: number
        message: string
        status: string
        details: any[]
    }
}
