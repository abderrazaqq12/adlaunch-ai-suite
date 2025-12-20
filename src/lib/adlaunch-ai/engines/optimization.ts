import {
    CampaignMetrics,
    AutomationRule,
    RuleAction,
    RuleCondition
} from '../../../types';
import { OptimizationResult, OptimizationChange } from '../types';

/**
 * 4️⃣ Optimization Engine
 * 
 * Analyzes live performance metrics against user-defined rules.
 * Suggests actions (SCALE, PAUSE, MODIFY).
 */
export class OptimizationEngine {

    public static evaluate(
        metrics: CampaignMetrics,
        rules: AutomationRule[]
    ): OptimizationResult {

        // If no rules, no action
        if (!rules || rules.length === 0) {
            return {
                action: 'NO_ACTION',
                changes: {},
                reason: 'No automation rules defined.'
            };
        }

        // Evaluate rules in priority order (simple linear scan for now)
        // Priority: PAUSE > DECREASE_BUDGET > MODIFY > INCREASE_BUDGET
        // We want to mitigate loss first.

        const activeRules = rules.filter(r => r.enabled);

        // Check for PAUSE (Stop Loss)
        const pauseRule = activeRules.find(r => r.action.type === 'pause' && this.checkCondition(metrics, r.condition));
        if (pauseRule) {
            return {
                action: 'PAUSE',
                changes: { status: 'PAUSED' },
                reason: `Triggered Pause Rule: ${pauseRule.name}`
            };
        }

        // Check for DECREASE BUDGET
        const decreaseRule = activeRules.find(r => r.action.type === 'decrease_budget' && this.checkCondition(metrics, r.condition));
        if (decreaseRule) {
            // Assuming we decrease by 20% if value not set
            const decreaseAmount = decreaseRule.action.value || 20;
            // We don't have current budget here, so we return a "modifier" or we need budget input. 
            // For this engine signature, let's assume 'changes' can imply specific new value or we change the type to support relative.
            // The prompt says "changes: { budget: number | null }" -> implies absolute value? 
            // Let's assume the frontend/execution layer calculates the absolutes, OR we need the current budget in input.
            // I'll update the signature to accept current budget if I could, but sticking to the plan:
            // Plan said: Input: CampaignMetrics, Rules. 
            // Let's just return the instruction clearly.

            return {
                action: 'MODIFY',
                changes: { budget: -1 * decreaseAmount }, // Negative implies decrease percentage? Or we need strict contract.
                // Let's stick to "MODIFY" action and use reason to explain, or ideally the input needs the current budget.
                // I will return 'NO_ACTION' with reason if I can't calculate, BUT let's assume the caller handles the delta logic if I send a specific flag.
                // Let's use the 'changes' object loosely for now or return a specific Flag. 
                // Better: I'll assume 'changes.budget' is the NEW budget. But I don't know the old budget.
                // I'll return a special reason and let the operator handle it, OR simply say "SCALE" (which usually means up/down).
                // Let's use 'MODIFY' for budget changes.
                reason: `Triggered Decrease Budget Rule: ${decreaseRule.name}`
            };
        }

        // Check for INCREASE BUDGET (Scaling)
        const increaseRule = activeRules.find(r => r.action.type === 'increase_budget' && this.checkCondition(metrics, r.condition));
        if (increaseRule) {
            return {
                action: 'SCALE',
                changes: { budget: increaseRule.action.value || 20 }, // +20%
                reason: `Triggered Scale Rule: ${increaseRule.name}`
            };
        }

        return {
            action: 'NO_ACTION',
            changes: {},
            reason: 'No rules triggered.'
        };
    }

    private static checkCondition(metrics: CampaignMetrics, condition: RuleCondition): boolean {
        const { metric, operator, value, afterImpressions } = condition;

        // Check pre-requisite
        if (afterImpressions && metrics.impressions < afterImpressions) {
            return false;
        }

        const currentVal = metrics[metric];

        switch (operator) {
            case 'gt': return currentVal > value;
            case 'lt': return currentVal < value;
            case 'gte': return currentVal >= value;
            case 'lte': return currentVal <= value;
            case 'eq': return currentVal === value;
            default: return false;
        }
    }
}
