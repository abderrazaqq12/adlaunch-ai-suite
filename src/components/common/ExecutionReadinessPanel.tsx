import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExecutionStatusBadge } from './ExecutionStatusBadge';
import { PlatformBadge } from './PlatformBadge';
import type { CampaignExecutionReadiness, Platform } from '@/types';
import { cn } from '@/lib/utils';
import { 
  AlertTriangle, 
  Check, 
  XCircle, 
  AlertCircle,
  Rocket,
  ShieldAlert,
  Users,
} from 'lucide-react';

interface ExecutionReadinessPanelProps {
  readiness: CampaignExecutionReadiness;
  showPlatformDetails?: boolean;
}

export function ExecutionReadinessPanel({ 
  readiness, 
  showPlatformDetails = true 
}: ExecutionReadinessPanelProps) {
  const { 
    status, 
    canLaunch, 
    totalCampaignsPlanned, 
    totalCampaignsReady, 
    totalCampaignsBlocked,
    platformStatuses,
    globalBlockers,
    summary,
  } = readiness;

  return (
    <div className="space-y-4">
      {/* Main Status Card */}
      <Card className={cn(
        'border',
        status === 'READY' && 'border-success/30 bg-success/5',
        status === 'PARTIAL_READY' && 'border-warning/30 bg-warning/5',
        status === 'BLOCKED' && 'border-destructive/30 bg-destructive/5',
        status === 'DRAFT' && 'border-border bg-muted/30'
      )}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Rocket className={cn(
                'h-5 w-5',
                status === 'READY' && 'text-success',
                status === 'PARTIAL_READY' && 'text-warning',
                status === 'BLOCKED' && 'text-destructive',
                status === 'DRAFT' && 'text-muted-foreground'
              )} />
              Execution Status
            </CardTitle>
            <ExecutionStatusBadge status={status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary */}
          <p className={cn(
            'text-sm font-medium',
            status === 'READY' && 'text-success',
            status === 'PARTIAL_READY' && 'text-warning',
            status === 'BLOCKED' && 'text-destructive',
            status === 'DRAFT' && 'text-muted-foreground'
          )}>
            {summary}
          </p>

          {/* Campaign Counts */}
          {totalCampaignsPlanned > 0 && (
            <div className="grid grid-cols-3 gap-4 rounded-lg border border-border bg-background p-3">
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{totalCampaignsPlanned}</p>
                <p className="text-xs text-muted-foreground">Planned</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-success">{totalCampaignsReady}</p>
                <p className="text-xs text-muted-foreground">Ready</p>
              </div>
              <div className="text-center">
                <p className={cn(
                  'text-2xl font-bold',
                  totalCampaignsBlocked > 0 ? 'text-destructive' : 'text-muted-foreground'
                )}>
                  {totalCampaignsBlocked}
                </p>
                <p className="text-xs text-muted-foreground">Skipped</p>
              </div>
            </div>
          )}

          {/* Global Blockers */}
          {globalBlockers.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" />
                Issues
              </p>
              {globalBlockers.map((blocker, index) => (
                <div 
                  key={index}
                  className={cn(
                    'flex items-start gap-2 rounded-lg p-3 text-sm',
                    blocker.severity === 'error' 
                      ? 'bg-destructive/10 text-destructive' 
                      : 'bg-warning/10 text-warning'
                  )}
                >
                  {blocker.severity === 'error' ? (
                    <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  )}
                  <span>{blocker.message}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Platform Details */}
      {showPlatformDetails && platformStatuses.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5" />
              Platform Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {platformStatuses.map(platformStatus => (
              <PlatformStatusRow 
                key={platformStatus.platform} 
                platformStatus={platformStatus} 
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Launch Capability */}
      {canLaunch && status === 'PARTIAL_READY' && (
        <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 p-4">
          <AlertCircle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-warning">Partial Launch Available</p>
            <p className="text-warning/80 mt-1">
              {totalCampaignsReady} campaign(s) will launch. {totalCampaignsBlocked} account(s) 
              will be skipped due to permission or configuration issues.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function PlatformStatusRow({ platformStatus }: { platformStatus: CampaignExecutionReadiness['platformStatuses'][0] }) {
  const { platform, status, readyAccounts, blockedAccounts, blockers } = platformStatus;

  return (
    <div className={cn(
      'rounded-lg border p-4',
      status === 'ready' && 'border-success/20 bg-success/5',
      status === 'partial' && 'border-warning/20 bg-warning/5',
      status === 'blocked' && 'border-destructive/20 bg-destructive/5'
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <PlatformBadge platform={platform as Platform} />
          <span className="font-medium capitalize">{platform} Ads</span>
        </div>
        <span className={cn(
          'rounded-full px-2 py-0.5 text-xs font-medium',
          status === 'ready' && 'bg-success/20 text-success',
          status === 'partial' && 'bg-warning/20 text-warning',
          status === 'blocked' && 'bg-destructive/20 text-destructive'
        )}>
          {status === 'ready' ? 'Ready' : status === 'partial' ? 'Partial' : 'Blocked'}
        </span>
      </div>

      {/* Ready accounts */}
      {readyAccounts.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-success mb-2">
          <Check className="h-4 w-4" />
          <span>{readyAccounts.length} account(s) ready to launch</span>
        </div>
      )}

      {/* Blocked accounts */}
      {blockedAccounts.length > 0 && (
        <div className="space-y-1">
          {blockedAccounts.map(acc => (
            <div key={acc.id} className="flex items-start gap-2 text-sm text-destructive">
              <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>
                <strong>{acc.name}</strong>: {acc.reason}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Config blockers */}
      {blockers.filter(b => b.type === 'platform_config' && b.severity === 'error').map((blocker, idx) => (
        <div key={idx} className="flex items-start gap-2 text-sm text-destructive mt-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{blocker.message}</span>
        </div>
      ))}
    </div>
  );
}
