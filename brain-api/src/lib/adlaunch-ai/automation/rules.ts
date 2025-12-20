import { AutomationRule } from './types'

// Action-specific cooldowns (Phase 1.1)
export const ACTION_COOLDOWNS: Record<string, number> = {
    'PAUSE_CAMPAIGN': 180,        // 3 hours
    'ROTATE_BACKUP_CREATIVE': 60, // 1 hour
    'STOP_PLATFORM': 360          // 6 hours
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
    // Note: This requires cross-platform comparison, handled in engine
    {
        ruleId: 'platform_inefficiency',
        name: 'Platform Inefficiency Stop',
        conditions: [
            // Evaluated dynamically in engine (CPA > best_CPA * 1.5)
        ],
        action: {
            type: 'STOP_PLATFORM'
        },
        cooldownMinutes: ACTION_COOLDOWNS['STOP_PLATFORM'],
        enabled: true
    }
]
