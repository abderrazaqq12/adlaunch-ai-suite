import { BrainError } from '../../errors'

export interface MemoryRecord {
    id: string
    projectId: string
    type: string
    payload: any
    timestamp: number
}

export interface IDatabaseAdapter {
    write(record: Omit<MemoryRecord, 'id' | 'timestamp'>): Promise<MemoryRecord>
    query(projectId: string, type?: string, limit?: number): Promise<MemoryRecord[]>
}

export class DevInMemoryAdapter implements IDatabaseAdapter {
    private store: MemoryRecord[] = []

    constructor() {
        console.warn('[AdLaunch AI] using DevInMemoryAdapter. DATA WILL BE LOST ON RESTART.')
    }

    async write(record: Omit<MemoryRecord, 'id' | 'timestamp'>): Promise<MemoryRecord> {
        const newRecord: MemoryRecord = {
            ...record,
            id: crypto.randomUUID(),
            timestamp: Date.now()
        }
        this.store.push(newRecord)
        return newRecord
    }

    async query(projectId: string, type?: string, limit: number = 10): Promise<MemoryRecord[]> {
        let results = this.store.filter(r => r.projectId === projectId)
        if (type) {
            results = results.filter(r => r.type === type)
        }
        return results.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit)
    }
}

export class PostgresAdapter implements IDatabaseAdapter {
    constructor(private connectionString: string) { }

    async write(record: Omit<MemoryRecord, 'id' | 'timestamp'>): Promise<MemoryRecord> {
        // Skeleton implementation
        console.log('[PostgresAdapter] Writing to DB:', record)
        throw new BrainError('PostgresAdapter not yet implemented', {}, 501)
    }

    async query(projectId: string, type?: string, limit?: number): Promise<MemoryRecord[]> {
        // Skeleton implementation
        console.log('[PostgresAdapter] Querying DB:', { projectId, type, limit })
        throw new BrainError('PostgresAdapter not yet implemented', {}, 501)
    }
}
