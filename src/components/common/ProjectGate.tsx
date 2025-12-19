import { useProjectStore } from '@/stores/projectStore';
import type { ProjectStage } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { 
  FolderX, 
  Link2, 
  Upload, 
  Search, 
  Rocket,
  AlertTriangle,
} from 'lucide-react';

interface ProjectGateProps {
  children: React.ReactNode;
  requiredStage?: ProjectStage;
  customBlockMessage?: string;
}

const STAGE_ACTIONS: Record<ProjectStage, { 
  icon: React.ElementType; 
  action: string; 
  link: string; 
  buttonText: string;
}> = {
  SETUP: {
    icon: FolderX,
    action: 'Create a project to get started',
    link: '/new-project',
    buttonText: 'Create Project',
  },
  ACCOUNTS_CONNECTED: {
    icon: Link2,
    action: 'Connect at least one ad account',
    link: '/connections',
    buttonText: 'Connect Account',
  },
  ASSETS_READY: {
    icon: Upload,
    action: 'Upload at least one asset',
    link: '/assets',
    buttonText: 'Upload Assets',
  },
  ANALYSIS_PASSED: {
    icon: Search,
    action: 'Run pre-launch analysis',
    link: '/analyze',
    buttonText: 'Run Analysis',
  },
  READY_TO_LAUNCH: {
    icon: Rocket,
    action: 'Configure launch settings',
    link: '/launch',
    buttonText: 'Configure Launch',
  },
  LIVE: {
    icon: Rocket,
    action: 'Launch a campaign',
    link: '/launch',
    buttonText: 'Launch Campaign',
  },
};

export function ProjectGate({ children, requiredStage, customBlockMessage }: ProjectGateProps) {
  const { currentProject, getStageBlockReason, canAccessStage } = useProjectStore();

  // No project selected - blocking state
  if (!currentProject) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <Card className="w-full max-w-md border-warning/30 bg-warning/5">
          <CardContent className="flex flex-col items-center p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-warning/10">
              <FolderX className="h-8 w-8 text-warning" />
            </div>
            <h2 className="mt-6 text-xl font-semibold text-foreground">
              No Project Selected
            </h2>
            <p className="mt-2 text-muted-foreground">
              You must select or create a project before accessing this page.
            </p>
            <Button asChild className="mt-6" variant="glow">
              <Link to="/new-project">Create New Project</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if required stage is met
  if (requiredStage) {
    const blockReason = getStageBlockReason(currentProject.id, requiredStage);
    
    if (blockReason) {
      const stageAction = STAGE_ACTIONS[requiredStage];
      const IconComponent = stageAction.icon;

      return (
        <div className="flex min-h-[60vh] items-center justify-center p-8">
          <Card className="w-full max-w-md border-destructive/30 bg-destructive/5">
            <CardContent className="flex flex-col items-center p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              <h2 className="mt-6 text-xl font-semibold text-foreground">
                Action Required
              </h2>
              <p className="mt-2 text-muted-foreground">
                {customBlockMessage || blockReason}
              </p>
              <div className="mt-6 flex flex-col gap-3 w-full">
                <Button asChild variant="glow">
                  <Link to={stageAction.link}>
                    <IconComponent className="mr-2 h-4 w-4" />
                    {stageAction.buttonText}
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/dashboard">Back to Dashboard</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }
  }

  return <>{children}</>;
}

// Hook for checking launch readiness with detailed reasons
export function useLaunchReadiness() {
  const { 
    currentProject, 
    assets, 
    hasApprovedAssets, 
    canLaunchOnAnyPlatform 
  } = useProjectStore();

  if (!currentProject) {
    return {
      canLaunch: false,
      reasons: ['No project selected'],
    };
  }

  const reasons: string[] = [];
  const projectAssets = assets.filter(a => a.projectId === currentProject.id);

  // Check for approved assets
  if (!hasApprovedAssets(currentProject.id)) {
    const analyzedCount = projectAssets.filter(a => a.status === 'ANALYZED' || a.status === 'APPROVED').length;
    const riskyCount = projectAssets.filter(a => a.status === 'RISKY').length;
    
    if (projectAssets.length === 0) {
      reasons.push('No assets uploaded');
    } else if (analyzedCount === 0) {
      reasons.push('No assets have been analyzed');
    } else if (riskyCount > 0 && !hasApprovedAssets(currentProject.id)) {
      reasons.push('All analyzed assets are marked as risky');
    } else {
      reasons.push('No assets have passed analysis');
    }
  }

  // Check for launch permissions
  if (!canLaunchOnAnyPlatform(currentProject.id)) {
    const hasAnyConnection = currentProject.connections.length > 0;
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

// Component to show why something is disabled
interface DisabledReasonProps {
  reasons: string[];
  className?: string;
}

export function DisabledReason({ reasons, className }: DisabledReasonProps) {
  if (reasons.length === 0) return null;

  return (
    <div className={`rounded-lg border border-warning/20 bg-warning/5 p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0 text-warning mt-0.5" />
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
