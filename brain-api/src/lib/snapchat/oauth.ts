import { SnapchatAdsConfig, OAuthTokens } from './types'
import { BrainError } from '../errors'

export class SnapchatOAuthService {
    private config: SnapchatAdsConfig

    constructor() {
        this.config = {
            clientId: process.env.SNAPCHAT_CLIENT_ID || '',
            clientSecret: process.env.SNAPCHAT_CLIENT_SECRET || '',
            redirectUri: process.env.SNAPCHAT_REDIRECT_URI || 'http://localhost:3000/oauth/snapchat/callback'
        }

        if (!this.config.clientId || !this.config.clientSecret) {
            console.warn('[SnapchatOAuthService] Missing OAuth Credentials. Real API calls will fail.')
        }
    }

    async exchangeCode(code: string): Promise<OAuthTokens> {
        const params = new URLSearchParams()
        params.append('code', code)
        params.append('client_id', this.config.clientId)
        params.append('client_secret', this.config.clientSecret)
        params.append('redirect_uri', this.config.redirectUri)
        params.append('grant_type', 'authorization_code')

        const response = await fetch('https://accounts.snapchat.com/login/oauth2/access_token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        })

        if (!response.ok) {
            const err = await response.json()
            throw new BrainError('Failed to exchange Snapchat OAuth code', { error: err })
        }

        return (await response.json()) as OAuthTokens
    }

    async refreshToken(refreshToken: string): Promise<OAuthTokens> {
        const params = new URLSearchParams()
        params.append('refresh_token', refreshToken)
        params.append('client_id', this.config.clientId)
        params.append('client_secret', this.config.clientSecret)
        params.append('grant_type', 'refresh_token')

        const response = await fetch('https://accounts.snapchat.com/login/oauth2/access_token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        })

        if (!response.ok) {
            const err = await response.json()
            throw new BrainError('Failed to refresh Snapchat OAuth token', { error: err })
        }

        return (await response.json()) as OAuthTokens
    }

    async revokeToken(accessToken: string): Promise<void> {
        const params = new URLSearchParams()
        params.append('token', accessToken)
        params.append('client_id', this.config.clientId)
        params.append('client_secret', this.config.clientSecret)

        await fetch('https://accounts.snapchat.com/login/oauth2/revoke', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        })
    }
}
