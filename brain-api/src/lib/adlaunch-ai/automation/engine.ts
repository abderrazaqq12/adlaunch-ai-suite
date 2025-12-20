import { MemoryEngine } from '../memory/index'
import { AutomationRule, CampaignSnapshot, RuleCondition, AutomationLog, CooldownEntry, RuleActionType } from './types'
import { GLOBAL_RULES } from './rules'

export class AutomationRulesEngine {
    private cooldowns: Map<string, CooldownEntry> = new Map()

    constructor(private memory: MemoryEngine) { }

    async run(projectId: string): Promise<AutomationLog[]> {
        const logs: AutomationLog[] = []

        // 1. Retrieve campaign snapshots from memory
        const snapshots = await this.getCampaignSnapshots(projectId)

        // 2. Evaluate rules for each campaign
        for (const snapshot of snapshots) {
            // Skip manually paused campaigns
            if (snapshot.campaignStatus === 'PAUSED' && !snapshot.lastActionTimestamp) {
                continue
            }

            for (const rule of GLOBAL_RULES) {
                if (!rule.enabled) continue

                // Check cooldown
                if (this.isInCooldown(rule.ruleId, snapshot)) {
                    continue
                }

                // Evaluate conditions
                const matched = this.evaluateConditions(rule, snapshot, snapshots)
                if (!matched) continue

                // Execute action
                const log = await this.executeAction(rule, snapshot, projectId)
                logs.push(log)

                // Only one action per campaign per cycle
                break
            }
        }

        // 3. Persist logs
        for (const log of logs) {
            await this.memory.store(projectId, 'automation_log', log)
        }

        return logs
    }

    private evaluateConditions(
        rule: AutomationRule,
        snapshot: CampaignSnapshot,
        allSnapshots: CampaignSnapshot[]
    ): boolean {
        // Special handling for platform inefficiency rule
        if (rule.ruleId === 'platform_inefficiency') {
            return this.evaluatePlatformInefficiency(snapshot, allSnapshots)
        }

        // Standard condition evaluation
        for (const condition of rule.conditions) {
            const fieldValue = (snapshot as any)[condition.field]
            if (fieldValue === undefined) return false

            if (!this.checkCondition(fieldValue, condition.operator, condition.value)) {
                return false
            }
        }

        return true
    }

    private checkCondition(actual: any, operator: string, expected: any): boolean {
        switch (operator) {
            case '>': return actual > expected
            case '<': return actual < expected
            case '==': return actual === expected
            case '>=': return actual >= expected
            case '<=': return actual <= expected
            default: return false
        }
    }

    private evaluatePlatformInefficiency(
        snapshot: CampaignSnapshot,
        allSnapshots: CampaignSnapshot[]
    ): boolean {
        // Find best CPA across all platforms
        const cpas = allSnapshots
            .filter(s => s.purchases > 0 && s.cpa > 0)
            .map(s => s.cpa)

        if (cpas.length === 0) return false

        const bestCPA = Math.min(...cpas)
        const threshold = bestCPA * 1.5

        return snapshot.cpa > threshold && snapshot.purchases > 0
    }

    private async executeAction(
        rule: AutomationRule,
        snapshot: CampaignSnapshot,
        projectId: string
    ): Promise<AutomationLog> {
        const log: AutomationLog = {
            timestamp: Date.now(),
            ruleId: rule.ruleId,
            platform: snapshot.platform,
            accountId: snapshot.accountId,
            campaignId: snapshot.campaignId,
            action: rule.action.type,
            reason: rule.name,
            success: false
        }

        try {
            // Execute action via workers (placeholder - would call actual workers)
            console.log(`[AutomationEngine] Executing ${rule.action.type} for ${snapshot.campaignId}`)

            // In real implementation, call appropriate worker method:
            // await this.workers[snapshot.platform].pauseCampaign(snapshot.campaignId)

            // For now, just log
            log.success = true

            // Update cooldown
            this.setCooldown(rule.ruleId, snapshot, rule.cooldownMinutes)

        } catch (e: any) {
            log.error = e.message
            console.error(`[AutomationEngine] Action failed:`, e)
        }

        return log
    }

    private isInCooldown(ruleId: string, snapshot: CampaignSnapshot): boolean {
        const key = this.getCooldownKey(ruleId, snapshot)
        const entry = this.cooldowns.get(key)

        if (!entry) return false

        const now = Date.now()
        const elapsed = (now - entry.lastExecuted) / 1000 / 60 // minutes

        return elapsed < GLOBAL_RULES.find(r => r.ruleId === ruleId)?.cooldownMinutes || 0
    }

    private setCooldown(ruleId: string, snapshot: CampaignSnapshot, minutes: number): void {
        const key = this.getCooldownKey(ruleId, snapshot)
        this.cooldowns.set(key, {
            ruleId,
            targetKey: key,
            lastExecuted: Date.now()
        })
    }

    private getCooldownKey(ruleId: string, snapshot: CampaignSnapshot): string {
        return `${ruleId}:${snapshot.platform}:${snapshot.accountId}:${snapshot.campaignId}`
    }

    private async getCampaignSnapshots(projectId: string): Promise<CampaignSnapshot[]> {
        // Retrieve campaign performance data from memory
        // In real implementation, this would query recent performance metrics
        try {
            const records = await this.memory.retrieve(projectId, 'campaign_snapshot', 100)
            return records.map(r => r.payload as CampaignSnapshot)
        } catch (e) {
            console.warn('[AutomationEngine] No campaign snapshots found')
            return []
        }
    }

    async getLogs(projectId: string, limit: number = 50): Promise<AutomationLog[]> {
        try {
            const records = await this.memory.retrieve(projectId, 'automation_log', limit)
            return records.map(r => r.payload as AutomationLog)
        } catch (e) {
            return []
        }
    }
}
