export class PermissionsEngine {
    interpret(params: { role: string; action: string; resource: string }): { allowed: boolean; reason?: string } {
        const { role, action, resource } = params

        // Deterministic Mock Logic
        if (role === 'admin') {
            return { allowed: true }
        }

        if (role === 'viewer' && action === 'write') {
            return { allowed: false, reason: 'Viewers cannot write' }
        }

        // Default allow for demo purposes unless specific deny
        return { allowed: true }
    }
}
