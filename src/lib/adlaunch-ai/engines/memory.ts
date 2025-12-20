import { Platform } from '../../../types';
import { MemoryEvent, MemoryEventType } from '../types';

/**
 * 6️⃣ Memory Engine (SERVER-SIDE ONLY)
 * 
 * Persistent storage of success/failure patterns.
 * Designed to run in a stateless server environment (Lambda/Edge).
 * Requires a concrete IDatabaseAdapter implementation at runtime.
 */

export interface IDatabaseAdapter {
    saveEvent(event: MemoryEvent): Promise<void>;
    getStats(platform: Platform): Promise<{ success: number; fail: number }>;
    getRiskProfile(): Promise<'LOW' | 'MEDIUM' | 'HIGH'>;
}

// In-Memory Mock for Verification/Testing (Default fall-back)
class MockDatabaseAdapter implements IDatabaseAdapter {
    private events: MemoryEvent[] = [];

    async saveEvent(event: MemoryEvent): Promise<void> {
        this.events.push(event);
    }

    async getStats(platform: Platform): Promise<{ success: number; fail: number }> {
        const pEvents = this.events.filter(e => e.platform === platform);
        return {
            success: pEvents.filter(e => e.outcome === 'positive').length,
            fail: pEvents.filter(e => e.outcome === 'negative').length
        };
    }

    async getRiskProfile(): Promise<'LOW' | 'MEDIUM' | 'HIGH'> {
        const fails = this.events.filter(e => e.outcome === 'negative').length;
        if (fails > 10) return 'HIGH';
        if (fails > 3) return 'MEDIUM';
        return 'LOW';
    }
}

export class MemoryEngine {

    private static db: IDatabaseAdapter;

    public static initialize(db: IDatabaseAdapter) {
        this.db = db;
    }

    // Ensure DB is ready
    private static getDB(): IDatabaseAdapter {
        if (!this.db) {
            // In a real server app, we might throw or auto-init a connection.
            // For this 'Brain' library, we default to Mock if not injected, 
            // but log a warning that persistence is transient.
            console.warn('MemoryEngine: No DatabaseAdapter initialized. Using volatile in-memory storage.');
            this.db = new MockDatabaseAdapter();
        }
        return this.db;
    }

    public static async recordEvent(event: MemoryEvent): Promise<void> {
        await this.getDB().saveEvent(event);
    }

    public static async getConfidenceModifier(platform: Platform): Promise<number> {
        const stats = await this.getDB().getStats(platform);

        const total = stats.success + stats.fail;
        if (total < 5) return 1.0; // Not enough data

        const successRate = stats.success / total;

        if (successRate < 0.5) return 0.7; // Caution
        if (successRate > 0.8) return 1.1; // Boldness

        return 1.0;
    }

    public static async getRiskProfile(): Promise<'LOW' | 'MEDIUM' | 'HIGH'> {
        return await this.getDB().getRiskProfile();
    }
}
