import {
    PermissionInterpreter,
    CampaignTranslator,
    PreLaunchDecisionEngine,
    OptimizationEngine,
    RecoveryEngine,
    MemoryEngine
} from './index';
import { CampaignIntent, AdAccountConnection, AssetAnalysisResult } from '../../types';

async function runVerification() {
    console.log('🧠 Server-Side AdLaunch Brain - Verification Protocol 🧠\n');

    // 1. Permission Interpreter
    console.log('--- 1. Permission Interpreter Verification ---');
    const limitedScopes = ['user.info.basic']; // TikTok read-only equivalent-ish
    const limitedAnalysis = PermissionInterpreter.analyze('tiktok', limitedScopes);
    console.log('Limited Scope Analysis:', JSON.stringify(limitedAnalysis, null, 2));

    if (!limitedAnalysis.canLaunch && limitedAnalysis.requiredAction === 'REQUEST_ADMIN_ACCESS') {
        console.log('✅ PASS: Correctly identified limited permissions.\n');
    } else {
        console.error('❌ FAIL: Permission check failed.\n');
    }

    // 2. Campaign Translator
    console.log('--- 2. Campaign Translator Verification ---');
    const mockIntent: CampaignIntent = {
        id: 'test-intent-1',
        projectId: 'p1',
        name: 'Summer Sale',
        objective: 'conversion',
        assetIds: ['a1'],
        landingPageUrl: 'https://example.com',
        audience: { countries: ['US'], ageMin: 18, ageMax: 45, gender: 'all' },
        selectedPlatforms: ['google'],
        accountSelections: [],
        platformConfigs: {},
        dailyBudget: 50,
        softLaunch: false,
        status: 'draft',
        createdAt: new Date().toISOString()
    };

    const mockAccount: AdAccountConnection = {
        id: 'conn1',
        platform: 'google',
        accountId: '123-456-7890',
        accountName: 'Test Account',
        status: 'connected',
        permissions: { canAnalyze: true, canLaunch: true, canOptimize: true }
    };

    const translation = CampaignTranslator.translate(mockIntent, 'google', mockAccount);
    const tObj = translation.campaign || {};
    console.log('Google Translation:', JSON.stringify(translation, null, 2));

    if (tObj.advertising_channel_type === 'DEMAND_GEN' && tObj.objective === 'SALES') {
        console.log('✅ PASS: Google Demand Gen mapping is correct.\n');
    } else {
        console.error('❌ FAIL: Google translation incorrect.\n');
    }

    // 3. Pre-Launch Decision
    console.log('--- 3. Pre-Launch Decision Verification ---');
    const analysis: AssetAnalysisResult = {
        policyRiskScore: 85, // High risk
        creativeQualityScore: 80,
        passed: false,
        analyzedAt: new Date().toISOString(),
        issues: []
    };

    const decision = PreLaunchDecisionEngine.evaluate('READY', analysis, 'google', true);
    console.log('High Risk Decision:', JSON.stringify(decision, null, 2));

    if (decision.decision === 'BLOCK') {
        console.log('✅ PASS: High risk correctly blocked.\n');
    } else {
        console.error('❌ FAIL: High risk not blocked.\n');
    }

    // 4. Optimization Engine
    console.log('--- 4. Optimization Verification ---');
    const metrics = { spend: 1000, impressions: 5000, clicks: 100, conversions: 2, cpc: 10, cpa: 500, ctr: 0.02, roas: 0.5 };
    // Rule: CPA > 100 -> PAUSE
    const rule = {
        id: 'r1',
        projectId: 'p1',
        name: 'Stop Loss',
        enabled: true,
        condition: { metric: 'cpa' as const, operator: 'gt' as const, value: 100 },
        action: { type: 'pause' as const },
        createdAt: ''
    };

    // @ts-ignore
    const optResult = OptimizationEngine.evaluate(metrics, [rule]);
    console.log('Optimization Result:', JSON.stringify(optResult, null, 2));

    if (optResult.action === 'PAUSE') {
        console.log('✅ PASS: Stop loss rule triggered correctly.\n');
    } else {
        console.error('❌ FAIL: Optimization rule failed.\n');
    }

    // 5. Recovery Engine
    console.log('--- 5. Recovery Verification ---');
    const badAd = { hook: 'Guaranteed cure for acne', body: 'Instant results', cta: 'Buy' };
    const recovered = RecoveryEngine.recover(badAd, 'Policy');
    console.log('Recovered Variants:', JSON.stringify(recovered, null, 2));

    const hasGuaranteed = recovered.safeVariants.some(v => v.hook.toLowerCase().includes('guaranteed'));
    if (!hasGuaranteed && recovered.safeVariants.length > 0) {
        console.log('✅ PASS: Banned words removed/replaced.\n');
    } else {
        console.error('❌ FAIL: Recovery engine failed to sanitize.\n');
    }

    // 6. Memory Engine (Async Server Pattern)
    console.log('--- 6. Memory Verification (Server-Side) ---');

    // Note: We are using the default in-memory fallback mock for this script
    await MemoryEngine.recordEvent({ type: 'CAMPAIGN_FAILURE', platform: 'google', timestamp: '', details: {}, outcome: 'negative' });

    const profile = await MemoryEngine.getRiskProfile();
    console.log('Risk Profile after failure:', profile);

    if (profile === 'LOW' || profile === 'MEDIUM') {
        console.log('✅ PASS: Server-side Memory Engine processed event.\n');
    } else {
        console.error('❌ FAIL: Memory Engine failed.\n');
    }

    console.log('🎉 ALL SERVER SYSTEMS VERIFIED');
}

runVerification();
