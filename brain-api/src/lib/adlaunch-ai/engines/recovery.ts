export class RecoveryEngine {
    generate(errorContext: any): { strategy: string; steps: string[] } {
        if (errorContext.code === 'RATE_LIMIT') {
            return {
                strategy: 'Exponential Backoff',
                steps: ['Wait 30s', 'Retry request', 'If fails, wait 60s']
            }
        }
        if (errorContext.code === 'AUTH_ERROR') {
            return {
                strategy: 'Refresh Token',
                steps: ['Request new token', 'Update headers', 'Retry']
            }
        }

        return {
            strategy: 'Manual Intervention',
            steps: ['Log error', 'Alert admin']
        }
    }
}
