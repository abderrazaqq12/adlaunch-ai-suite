import { IDatabaseAdapter } from './adapters'

export class MemoryEngine {
    constructor(private adapter: IDatabaseAdapter) { }

    async store(projectId: string, type: string, payload: any) {
        return this.adapter.write({ projectId, type, payload })
    }

    async retrieve(projectId: string, type?: string, limit?: number) {
        return this.adapter.query(projectId, type, limit)
    }
}
