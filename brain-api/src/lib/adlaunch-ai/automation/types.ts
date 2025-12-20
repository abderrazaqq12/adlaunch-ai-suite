export type Platform = 'google' | 'tiktok' | 'snap'

export type RuleActionType =
    | 'PAUSE_CAMPAIGN'
    | 'PAUSE_CREATIVE'
    | 'ROTATE_BACKUP_CREATIVE'
    | 'STOP_PLATFORM'
    | 'REDUCE_BUDGET'
    // Phase 2 Actions
    | 'INCREASE_BUDGET'
    | 'SWAP_CREATIVE'
    | 'SUGGEST_PLATFORM_SHIFT'

export type SkipReason =
    | 'INSUFFICIENT_DATA'
    | 'USER_PAUSED'
    | 'COOLDOWN_ACTIVE'

export interface CampaignSnapshot {
    platform: Platform
    accountId: string
    campaignId: string
    spend: number
    purchases: number
    cpa: number
    creativeId?: string
    creativeScore?: number
    campaignStatus: 'ACTIVE' | 'PAUSED'
    lastActionTimestamp?: number
}

export interface RuleCondition {
    field: string
    operator: '>' | '<' | '==' | '>=' | '<='
    value: number | string
}

export interface RuleAction {
    type: RuleActionType
    params?: Record<string, any>
}

export interface AutomationRule {
    ruleId: string
    name: string
    conditions: RuleCondition[]
    action: RuleAction
    cooldownMinutes: number
    enabled: boolean
}

export interface AutomationLog {
    timestamp: number
    ruleId: string
    platform: Platform
    accountId: string
    campaignId: string
    action: RuleActionType
    reason: string
    success: boolean
    error?: string
    skippedReason?: SkipReason
}

export interface CooldownEntry {
    ruleId: string
    targetKey: string // platform:accountId:campaignId
    lastExecuted: number
}

// Phase 2: User Automation Profile
export type RiskLevel = 'LOW' | 'MEDIUM'

export interface AutomationProfile {
    accountId: string
    campaignId?: string // Optional: campaign-specific overrides
    allowBudgetIncrease: boolean
    maxBudgetIncreasePct: number
    allowCreativeSwap: boolean
    allowPlatformShift: boolean
    riskLevel: RiskLevel
    lastUpdated: number
}

export interface OptimizationLog extends AutomationLog {
    allowedByUser: boolean
    executed: boolean
}
