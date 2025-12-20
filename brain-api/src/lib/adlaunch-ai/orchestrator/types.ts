export type LaunchStatus =
    | 'PENDING'
    | 'TRANSLATED'
    | 'DECIDED_BLOCK'
    | 'DECIDED_SOFT'
    | 'DECIDED_FULL'
    | 'SKIPPED_NO_PERMISSION'
    | 'FAILED_VALIDATION'
    | 'BLOCKED_COMPLIANCE'
    | 'EXECUTED'
    | 'EXECUTION_FAILED'
    | 'EXECUTION_BLOCKED'

export type ExecutionStatus = 'BLOCKED' | 'PARTIAL_READY' | 'READY'

export interface LaunchRunItem {
    platform: 'google' | 'tiktok' | 'snap'
    accountId: string
    status: LaunchStatus
    payload?: any
    decisions?: {
        go: boolean
        issues: string[]
    }
    error?: string
}

export interface LaunchRun {
    id: string
    projectId: string
    idempotencyKey: string
    timestamp: number
    summary: {
        total: number
        success: number
        blocked: number
        skipped: number
        failed: number
    }
    items: LaunchRunItem[]
}

export interface LaunchRequest {
    idempotency_key: string
    campaign_intent: any
    execution_status: ExecutionStatus
    policy_risk_score: number
    targets: {
        platform: 'google' | 'tiktok' | 'snap'
        accounts: string[]
        config?: any
    }[]
}
