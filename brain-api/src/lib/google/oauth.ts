import { GoogleAdsConfig, OAuthTokens } from './types'
import { BrainError } from '../errors'

export class GoogleOAuthService {
    private config: GoogleAdsConfig

    constructor() {
        this.config = {
            developerToken: process.env.GOOGLE_DEVELOPER_TOKEN || '',
            clientId: process.env.GOOGLE_CLIENT_ID || '',
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
            redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback'
        }

        if (!this.config.clientId || !this.config.clientSecret) {
            console.warn('[GoogleOAuthService] Missing OAuth Credentials. Real API calls will fail.')
        }
    }

    async exchangeCode(code: string): Promise<OAuthTokens> {
        const params = new URLSearchParams()
        params.append('code', code)
        params.append('client_id', this.config.clientId)
        params.append('client_secret', this.config.clientSecret)
        params.append('redirect_uri', this.config.redirectUri)
        params.append('grant_type', 'authorization_code')

        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        })

        if (!response.ok) {
            const err = await response.json()
            throw new BrainError('Failed to exchange Google OAuth code', { error: err })
        }

        return (await response.json()) as OAuthTokens
    }

    async refreshToken(refreshToken: string): Promise<OAuthTokens> {
        const params = new URLSearchParams()
        params.append('refresh_token', refreshToken)
        params.append('client_id', this.config.clientId)
        params.append('client_secret', this.config.clientSecret)
        params.append('grant_type', 'refresh_token')

        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        })

        if (!response.ok) {
            const err = await response.json()
            throw new BrainError('Failed to refresh Google OAuth token', { error: err })
        }

        return (await response.json()) as OAuthTokens
    }

    async revokeToken(token: string): Promise<void> {
        const params = new URLSearchParams()
        params.append('token', token)
        await fetch('https://oauth2.googleapis.com/revoke', {
            method: 'POST',
            body: params,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        })
    }
}
