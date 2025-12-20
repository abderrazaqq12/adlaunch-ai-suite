import { ExecutionResult, SafetyConfig } from './types'

export abstract class BaseWorker {
    abstract execute(payload: any, accountId: string): Promise<ExecutionResult>

    protected enforceBudget(requestedBudget: number, platform: 'google' | 'tiktok' | 'snap'): number {
        const cap = SafetyConfig.CAPS[platform]
        return Math.min(requestedBudget, cap)
    }

    protected isSoftLaunch(accountId: string): boolean {
        // In a real system, we'd query history to see if this account has launched before.
        // For now, adhere to rule: "First execution per account = SOFT_LAUNCH ONLY".
        // We act conservatively and assume ALWAYS soft launch unless overridden validly (which we don't have yet)
        return true
    }
}
