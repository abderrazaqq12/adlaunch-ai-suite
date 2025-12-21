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

  // Check for approved assets
  if (!hasApprovedAssets(project.id)) {
    const analyzedCount = projectAssets.filter(a => a.status === 'ANALYZED' || a.status === 'APPROVED').length;
    const riskyCount = projectAssets.filter(a => a.status === 'RISKY').length;
    
    if (projectAssets.length === 0) {
      reasons.push('No assets uploaded');
    } else if (analyzedCount === 0) {
      reasons.push('No assets have been analyzed');
    } else if (riskyCount > 0 && !hasApprovedAssets(project.id)) {
      reasons.push('All analyzed assets are marked as risky');
    } else {
      reasons.push('No assets have passed analysis');
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
