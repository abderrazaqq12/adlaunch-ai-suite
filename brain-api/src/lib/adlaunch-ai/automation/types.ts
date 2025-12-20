export type Platform = 'google' | 'tiktok' | 'snap'

export type RuleActionType =
    | 'PAUSE_CAMPAIGN'
    | 'PAUSE_CREATIVE'
    | 'ROTATE_BACKUP_CREATIVE'
    | 'STOP_PLATFORM'
    | 'REDUCE_BUDGET'

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
}

export interface CooldownEntry {
    ruleId: string
    targetKey: string // platform:accountId:campaignId
    lastExecuted: number
}
