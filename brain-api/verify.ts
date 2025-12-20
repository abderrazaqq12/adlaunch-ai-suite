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
}

runTests().catch(console.error)
