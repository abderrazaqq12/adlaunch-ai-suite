export interface ExecutionResult {
    success: boolean
    platformId?: string
    error?: string
    metadata?: any
}

export const SafetyConfig = {
    CAPS: {
        google: 20,
        tiktok: 15,
        snap: 10
    } as const
}
