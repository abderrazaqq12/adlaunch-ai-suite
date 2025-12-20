import { AutomationRule } from './types'

// Action-specific cooldowns (Phase 1.1)
export const ACTION_COOLDOWNS: Record<string, number> = {
    'PAUSE_CAMPAIGN': 180,        // 3 hours
    'ROTATE_BACKUP_CREATIVE': 60, // 1 hour
    'STOP_PLATFORM': 360,         // 6 hours
    // Phase 2 cooldowns
    'INCREASE_BUDGET': 1440,      // 24 hours
    'SWAP_CREATIVE': 1440,        // 24 hours
    'SUGGEST_PLATFORM_SHIFT': 720 // 12 hours
}

// Global Rules (Phase 1)
export const GLOBAL_RULES: AutomationRule[] = [
    // Rule 1: No Sales Burn
    {
        ruleId: 'no_sales_burn',
        name: 'No Sales Burn Protection',
        conditions: [
            { field: 'spend', operator: '>', value: 10 },
            { field: 'purchases', operator: '==', value: 0 }
        ],
        action: {
            type: 'PAUSE_CAMPAIGN'
        },
        cooldownMinutes: ACTION_COOLDOWNS['PAUSE_CAMPAIGN'],
        enabled: true
    },

    // Rule 2: Bad Creative Rotation
    {
        ruleId: 'bad_creative_rotation',
        name: 'Bad Creative Auto-Rotation',
        conditions: [
            { field: 'creativeScore', operator: '<', value: 60 },
            { field: 'spend', operator: '>', value: 5 }
        ],
        action: {
            type: 'ROTATE_BACKUP_CREATIVE'
        },
        cooldownMinutes: ACTION_COOLDOWNS['ROTATE_BACKUP_CREATIVE'],
        enabled: true
    },

    // Rule 3: Platform Inefficiency
    {
        ruleId: 'platform_inefficiency',
        name: 'Platform Inefficiency Stop',
        conditions: [],
        action: {
            type: 'STOP_PLATFORM'
        },
        cooldownMinutes: ACTION_COOLDOWNS['STOP_PLATFORM'],
        enabled: true
    }
]

// Phase 2: Conservative Optimization Rules (User-Controlled)
export const PHASE2_RULES: AutomationRule[] = [
    // Rule A: Safe Budget Increase
    {
        ruleId: 'safe_budget_increase',
        name: 'Safe Budget Increase',
        conditions: [
            { field: 'creativeScore', operator: '>=', value: 80 }
            // CPA check done dynamically in engine
        ],
        action: {
            type: 'INCREASE_BUDGET'
        },
        cooldownMinutes: ACTION_COOLDOWNS['INCREASE_BUDGET'],
        enabled: false // Requires user opt-in
    },

    // Rule B: Creative Swap Optimization
    {
        ruleId: 'creative_swap_optimization',
        name: 'Creative Swap Optimization',
        conditions: [
            { field: 'spend', operator: '>=', value: 5 }
            // Backup score comparison done dynamically
        ],
        action: {
            type: 'SWAP_CREATIVE'
        },
        cooldownMinutes: ACTION_COOLDOWNS['SWAP_CREATIVE'],
        enabled: false // Requires user opt-in
    },

    // Rule C: Platform Soft Shift
    {
        ruleId: 'platform_soft_shift',
        name: 'Platform Soft Shift Suggestion',
        conditions: [
            // CPA comparison done dynamically
        ],
        action: {
            type: 'SUGGEST_PLATFORM_SHIFT'
        },
        cooldownMinutes: ACTION_COOLDOWNS['SUGGEST_PLATFORM_SHIFT'],
        enabled: false // Requires user opt-in
    }
]
