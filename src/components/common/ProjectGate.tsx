import { useEffect } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import type { ProjectStage } from '@/types';

interface ProjectGateProps {
  children: React.ReactNode;
  requiredStage?: ProjectStage;
}

/**
 * ProjectGate is now an internal-only guard.
 * It silently ensures a project exists and never blocks the UI.
 * The user flow is: Assets → Ad Accounts → Audience → Publish
 */
export function ProjectGate({ children }: ProjectGateProps) {
  const { ensureProject } = useProjectStore();

  // Silently ensure a project exists on mount
  useEffect(() => {
    ensureProject();
  }, [ensureProject]);

  // Always render children - no blocking UI
  return <>{children}</>;
}

// Hook for checking launch readiness with detailed reasons (internal use)
export function useLaunchReadiness() {
  const { 
    currentProject, 
    assets, 
    hasApprovedAssets, 
    canLaunchOnAnyPlatform,
    ensureProject,
  } = useProjectStore();

  // Ensure project exists
  const project = currentProject || ensureProject();

  const reasons: string[] = [];
  const projectAssets = assets.filter(a => a.projectId === project.id);

  // Check for ready-for-launch assets (new state machine)
  const readyAssets = projectAssets.filter(a => a.status === 'READY_FOR_LAUNCH');
  const approvedAssets = projectAssets.filter(a => a.status === 'APPROVED');
  const blockedAssets = projectAssets.filter(a => a.status === 'BLOCKED');
  
  if (readyAssets.length === 0) {
    if (projectAssets.length === 0) {
      reasons.push('No assets uploaded');
    } else if (approvedAssets.length > 0) {
      reasons.push('Mark approved assets as "Ready for Launch"');
    } else if (blockedAssets.length > 0 && approvedAssets.length === 0) {
      reasons.push('All analyzed assets are blocked');
    } else {
      reasons.push('No assets have passed AI analysis');
    }
  }

  // Check for launch permissions
  if (!canLaunchOnAnyPlatform(project.id)) {
    const hasAnyConnection = project.connections.length > 0;
    if (!hasAnyConnection) {
      reasons.push('No ad accounts connected');
    } else {
      reasons.push('No connected account has launch permission');
    }
  }

  return {
    canLaunch: reasons.length === 0,
    reasons,
  };
}

// Component to show why something is disabled (for internal validation display)
interface DisabledReasonProps {
  reasons: string[];
  className?: string;
}

export function DisabledReason({ reasons, className }: DisabledReasonProps) {
  if (reasons.length === 0) return null;

  return (
    <div className={`rounded-lg border border-warning/20 bg-warning/5 p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <div>
          <p className="font-medium text-foreground">Action Unavailable</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {reasons.map((reason, i) => (
              <li key={i}>• {reason}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
