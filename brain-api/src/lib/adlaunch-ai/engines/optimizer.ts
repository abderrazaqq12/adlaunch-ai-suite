export class OptimizerEngine {
    act(metrics: { ctr: number; cpa: number; spend: number }): { action: 'increase_bid' | 'decrease_bid' | 'pause' | 'hold'; details: string } {
        if (metrics.cpa > 50) {
            return { action: 'decrease_bid', details: 'CPA is too high, lowering bid to conserve budget.' }
        }
        if (metrics.ctr > 0.05) { // 5%
            return { action: 'increase_bid', details: 'High CTR detected, scaling up.' }
        }
        return { action: 'hold', details: 'Performance within expected range.' }
    }
}
