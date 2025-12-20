import { TikTokAdsConfig, OAuthTokens } from './types'
import { BrainError } from '../errors'

export class TikTokOAuthService {
    private config: TikTokAdsConfig

    constructor() {
        this.config = {
            appId: process.env.TIKTOK_APP_ID || '',
            appSecret: process.env.TIKTOK_APP_SECRET || '',
            redirectUri: process.env.TIKTOK_REDIRECT_URI || 'http://localhost:3000/oauth/tiktok/callback'
        }

        if (!this.config.appId || !this.config.appSecret) {
            console.warn('[TikTokOAuthService] Missing OAuth Credentials. Real API calls will fail.')
        }
    }

    async exchangeCode(authCode: string): Promise<OAuthTokens> {
        const params = new URLSearchParams()
        params.append('app_id', this.config.appId)
        params.append('secret', this.config.appSecret)
        params.append('auth_code', authCode)
        params.append('grant_type', 'authorization_code')

        const response = await fetch('https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        })

        const result = await response.json()

        if (result.code !== 0) {
            throw new BrainError('Failed to exchange TikTok OAuth code', { error: result })
        }

        return result.data as OAuthTokens
    }

    async refreshToken(refreshToken: string): Promise<OAuthTokens> {
        const params = new URLSearchParams()
        params.append('app_id', this.config.appId)
        params.append('secret', this.config.appSecret)
        params.append('refresh_token', refreshToken)
        params.append('grant_type', 'refresh_token')

        const response = await fetch('https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        })

        const result = await response.json()

        if (result.code !== 0) {
            throw new BrainError('Failed to refresh TikTok OAuth token', { error: result })
        }

        return result.data as OAuthTokens
    }

    async revokeToken(accessToken: string): Promise<void> {
        const params = new URLSearchParams()
        params.append('app_id', this.config.appId)
        params.append('secret', this.config.appSecret)
        params.append('access_token', accessToken)

        await fetch('https://business-api.tiktok.com/open_api/v1.3/oauth2/revoke/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        })
    }
}
