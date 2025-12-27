import { ComplianceGuard } from '../lib/adlaunch-ai/compliance/index'
import { MemoryEngine } from '../lib/adlaunch-ai/memory/index'
import { DevInMemoryAdapter } from '../lib/adlaunch-ai/memory/adapters'

async function runTest() {
    console.log('--- STARTING COMPLIANCE GUARD VERIFICATION ---')

    // Setup
    const memory = new MemoryEngine(new DevInMemoryAdapter())
    const guard = new ComplianceGuard(memory)
    const projectId = 'test-proj-123'

    // Test Case 1: Hard Block (Hybrid Enforcement Override)
    // We expect the AI (Mock Mode) to potentially fail or return default, 
    // but the regex MUST catch the "guaranteed" claim.
    console.log('\n[TEST 1] Hybrid Enforcement (Regex Override)')
    const hardBlockInput = {
        name: 'Test Campaign',
        headline: 'Get 100% Guaranteed Results', // HARD BLOCK
        adText: 'This is a test.',
        description: 'Testing upgrade.'
    }

    const result1 = await guard.validate(hardBlockInput, 'google', projectId)

    console.log('Result Passed:', result1.passed)
    console.log('Status:', result1.details?.status)
    console.log('Issues:', result1.issues)
    console.log('Risk Score:', result1.details?.risk_score)
    console.log('Decision Trace:', result1.decision_trace)

    if (result1.details?.status === 'BLOCKED_HARD' && result1.details.risk_score >= 100) {
        console.log('✅ TEST 1 PASSED: Hard block regex correctly overrode AI/Mock.')
    } else {
        console.error('❌ TEST 1 FAILED: Expected BLOCKED_HARD and High Risk Score.')
    }

    // Test Case 2: Fallback / Mock Mode Validity
    // Since we don't have an API key in this test env, it should use the fallback response.
    console.log('\n[TEST 2] Safe Fallback (Mock Mode)')
    const normalInput = {
        name: 'Normal Campaign',
        headline: 'Great Product',
        adText: 'Buy now.',
        description: 'Safe description.'
    }

    const result2 = await guard.validate(normalInput, 'google', projectId)
    console.log('Result Passed:', result2.passed)
    console.log('Status:', result2.details?.status)
    console.log('Used Fallback:', result2.details?.detected_issues[0].description.includes('Manual Review Required'))

    if (result2.details?.status === 'BLOCKED_SOFT' && result2.details.risk_score === 99) {
        console.log('✅ TEST 2 PASSED: System safely fell back to BLOCKED_SOFT.')
    } else {
        console.error('❌ TEST 2 FAILED: Expected safe fallback.')
    }

    console.log('\n--- VERIFICATION COMPLETE ---')
}

runTest().catch(console.error)
