import { app } from './src/index'

async function runTests() {
    console.log('--- Starting Verification ---')

    const headers = {
        'Authorization': 'Bearer test-token',
        'X-Project-Id': 'proj_123',
        'Content-Type': 'application/json'
    }

    // 1. Test Permissions
    console.log('\n1. Testing /permissions/interpret')
    const res1 = await app.request('/api/brain/v1/permissions/interpret', {
        method: 'POST',
        headers,
        body: JSON.stringify({ role: 'viewer', action: 'write', resource: 'campaigns' })
    })
    console.log('Status:', res1.status)
    console.log('Body:', await res1.json())

    // 2. Test Translator
    console.log('\n2. Testing /campaigns/translate')
    const res2 = await app.request('/api/brain/v1/campaigns/translate', {
        method: 'POST',
        headers,
        body: JSON.stringify({ campaign: { name: 'Summer Sale', budget: 500 }, targetPlatform: 'tiktok' })
    })
    console.log('Status:', res2.status)
    console.log('Body:', await res2.json())

    // 3. Test Validation Error
    console.log('\n3. Testing Validation Error (Missing header)')
    const res3 = await app.request('/api/brain/v1/launch/decide', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-token' }, // Missing X-Project-Id
        body: JSON.stringify({})
    })
    console.log('Status:', res3.status)
    console.log('Body:', await res3.json())

    // 4. Test Memory Write
    console.log('\n4. Testing /memory/write')
    const res4 = await app.request('/api/brain/v1/memory/write', {
        method: 'POST',
        headers,
        body: JSON.stringify({ type: 'user_action', payload: { action: 'login' } })
    })
    console.log('Status:', res4.status)
    console.log('Body:', await res4.json())

    // 5. Test Launch Orchestrator
    console.log('\n5. Testing /launch/run')
    const launchPayload = {
        idempotency_key: 'launch_123',
        campaign_intent: {
            name: 'Big Launch',
            budget: 1000
        },
        execution_status: 'READY',
        policy_risk_score: 10,
        targets: [
            { platform: 'google', accounts: ['acc_1'] },
            { platform: 'tiktok', accounts: ['acc_2'] }
        ]
    }

    const res5 = await app.request('/api/brain/v1/launch/run', {
        method: 'POST',
        headers,
        body: JSON.stringify(launchPayload)
    })
    console.log('Status:', res5.status)
    console.log('Body:', JSON.stringify(await res5.json(), null, 2))

    // 5b. Test Idempotency (should return same result)
    console.log('\n5b. Testing Idempotency')
    const res5b = await app.request('/api/brain/v1/launch/run', {
        method: 'POST',
        headers,
        body: JSON.stringify(launchPayload)
    })
    console.log('Status:', res5b.status)
    console.log('Body (should be same):', JSON.stringify(await res5b.json(), null, 2))

    // 6. Test Compliance Block
    console.log('\n6. Testing Compliance Block')
    const compliancePayload = {
        idempotency_key: 'launch_violation_1',
        campaign_intent: {
            name: 'Illegal Crypto Ad',
            description: 'Guaranteed 100% returns on crypto',
            budget: 1000
        },
        execution_status: 'READY',
        policy_risk_score: 10,
        targets: [
            { platform: 'google', accounts: ['acc_1'] }
        ]
    }

    const res6 = await app.request('/api/brain/v1/launch/run', {
        method: 'POST',
        headers,
        body: JSON.stringify(compliancePayload)
    })
    console.log('Status:', res6.status)
    console.log('Body (should be BLOCKED_COMPLIANCE):', JSON.stringify(await res6.json(), null, 2))

    // 7. Test Execution (Budget Capping)
    console.log('\n7. Testing Execution Workers')
    const executionPayload = {
        idempotency_key: 'exec_run_alpha',
        campaign_intent: {
            name: 'Safe Launch',
            description: 'A great product',
            budget: 500 // Should be capped
        },
        execution_status: 'READY',
        policy_risk_score: 5,
        targets: [
            { platform: 'google', accounts: ['acc_G1'] }, // Cap 20
            { platform: 'tiktok', accounts: ['acc_T1'] }  // Cap 15
        ]
    }

    const res7 = await app.request('/api/brain/v1/launch/run', {
        method: 'POST',
        headers,
        body: JSON.stringify(executionPayload)
    })
    console.log('Status:', res7.status)
    console.log('Body (should be EXECUTED w/ caps):', JSON.stringify(await res7.json(), null, 2))

    // 8. Test Creative Filtering
    console.log('\n8. Testing Creative Filtering')
    const mixedPayload = {
        idempotency_key: 'creative_filter_run_1',
        campaign_intent: {
            name: 'Mixed Quality Ad',
            budget: 100,
            creatives: [
                { id: 'c1', type: 'text', content: { headline: 'Safe Headline' } },
                { id: 'c2', type: 'text', content: { headline: 'Guaranteed Cure 100%' } } // Should be filtered
            ]
        },
        execution_status: 'READY',
        policy_risk_score: 5,
        targets: [
            { platform: 'google', accounts: ['acc_G_filter'] }
        ]
    }
    // No credential, google worker might fail on execution but orchestrator should pass compliance check and reach execution attempt
    // To avoid strict credential failure just for this check (which we want to fail execution maybe, or just check logs),
    // we are testing Orchestrator logic mostly. The worker will fail missing creds, but returning EXECUTION_FAILED is fine.
    // The important part is that "c2" is filtered. We'd see that in logs if we could, 
    // or if we inspect payload. Since we can't inspect payload in response easily (LaunchRunItem payload is returned),
    // we check response status.

    const res8 = await app.request('/api/brain/v1/launch/run', {
        method: 'POST',
        headers,
        body: JSON.stringify(mixedPayload)
    })

    console.log('Status:', res8.status)
    const body8 = await res8.json()
    console.log('Body (Partial Success):', JSON.stringify(body8, null, 2))

    // 9. Test Creative Auto-Replacement
    console.log('\n9. Testing Creative Auto-Replacement')
    const autoReplacePayload = {
        idempotency_key: 'auto_replace_run_1',
        campaign_intent: {
            name: 'Auto-Repair Test',
            budget: 100,
            creatives: [
                { id: 'c_bad', type: 'text', content: { headline: 'Guaranteed 100% cure for your problems!' } }
            ]
        },
        execution_status: 'READY',
        policy_risk_score: 5,
        targets: [
            { platform: 'google', accounts: ['acc_G_repair'] }
        ]
    }

    const res9 = await app.request('/api/brain/v1/launch/run', {
        method: 'POST',
        headers,
        body: JSON.stringify(autoReplacePayload)
    })

    console.log('Status:', res9.status)
    const body9 = await res9.json()
    console.log('Body (Should show auto-repair):', JSON.stringify(body9, null, 2))
    console.log('Expected: Creative should be auto-repaired (guaranteed->planned, 100%->effective, cure->help)')
}

runTests().catch(console.error)
