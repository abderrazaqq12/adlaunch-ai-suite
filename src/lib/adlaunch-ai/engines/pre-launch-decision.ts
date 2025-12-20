import {
    Platform,
    ExecutionStatus,
    AssetAnalysisResult
} from '../../types';
import { LaunchDecision, LaunchDecisionResult } from '../types';

/**
 * 3️⃣ Pre-Launch Decision Engine
 * 
 * Final safety gate before campaign creation.
 * Checks execution readiness and policy risk scores.
 * Never overrides hard BLOCKED status decision from Frontend.
 */
export class PreLaunchDecisionEngine {

    // Risk thresholds (conservative)
    private static MAX_RISK_SCORE = 70; // 0-100, >70 is too risky
    private static MIN_QUALITY_SCORE = 40; // <40 is too low quality

    public static evaluate(
        status: ExecutionStatus,
        analysis: AssetAnalysisResult,
        platform: Platform,
        hasLaunchPermission: boolean
    ): LaunchDecisionResult {

        // 1. Hard Blockers (Frontend Status)
        if (status === 'BLOCKED') {
            return {
                decision: 'BLOCK',
                reason: 'Execution status is BLOCKED by frontend logic (missing assets, config, or connection).'
            };
        }

        // 2. Permission Check
        if (!hasLaunchPermission) {
            return {
                decision: 'BLOCK',
                reason: 'Insufficient permissions to launch on this platform.'
            };
        }

        // 3. Asset Analysis / Policy Risk logic
        if (analysis && !analysis.passed) {
            return {
                decision: 'BLOCK',
                reason: 'Assets failed pre-launch analysis checks.'
            };
        }

        if (analysis && analysis.policyRiskScore > this.MAX_RISK_SCORE) {
            return {
                decision: 'BLOCK',
                reason: `Policy risk score (${analysis.policyRiskScore}) exceeds safety threshold (${this.MAX_RISK_SCORE}).`
            };
        }

        // 4. Soft Launch Logic
        // If we are PARTIAL_READY or have medium risk, we force Soft Launch
        if (status === 'PARTIAL_READY') {
            return {
                decision: 'SOFT_LAUNCH',
                reason: 'Campaign is only partially ready. Launching in non-scaling mode.',
                notes: 'Review blocked accounts if any.'
            };
        }

        if (analysis && analysis.policyRiskScore > 50) {
            return {
                decision: 'SOFT_LAUNCH',
                reason: `Moderate policy risk (${analysis.policyRiskScore}). Recommended supervision.`,
                notes: 'Monitor disapproval rates closely.'
            };
        }

        // 5. Full Launch
        return {
            decision: 'FULL_LAUNCH',
            reason: 'All checks passed. Ready for standard delivery.'
        };
    }
}
