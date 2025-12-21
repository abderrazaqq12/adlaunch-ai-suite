import { Activity, Pause, StopCircle, CircleOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MonitoringState } from '@/lib/state-machines/types';

interface MonitoringStateIndicatorProps {
  state: MonitoringState;
  label: string;
  description: string;
  activeCampaigns: number;
  pausedCampaigns: number;
  stoppedCampaigns: number;
}

const STATE_CONFIG = {
  NO_ACTIVE_CAMPAIGNS: {
    icon: CircleOff,
    bgColor: 'bg-muted/50',
    iconBg: 'bg-muted',
    iconColor: 'text-muted-foreground',
    borderColor: 'border-border',
    textColor: 'text-muted-foreground',
  },
  ACTIVE: {
    icon: Activity,
    bgColor: 'bg-success/5',
    iconBg: 'bg-success/10',
    iconColor: 'text-success',
    borderColor: 'border-success/30',
    textColor: 'text-success',
  },
  PAUSED: {
    icon: Pause,
    bgColor: 'bg-warning/5',
    iconBg: 'bg-warning/10',
    iconColor: 'text-warning',
    borderColor: 'border-warning/30',
    textColor: 'text-warning',
  },
  STOPPED: {
    icon: StopCircle,
    bgColor: 'bg-destructive/5',
    iconBg: 'bg-destructive/10',
    iconColor: 'text-destructive',
    borderColor: 'border-destructive/30',
    textColor: 'text-destructive',
  },
};

export function MonitoringStateIndicator({
  state,
  label,
  description,
  activeCampaigns,
  pausedCampaigns,
  stoppedCampaigns,
}: MonitoringStateIndicatorProps) {
  const config = STATE_CONFIG[state];
  const Icon = config.icon;
  const totalCampaigns = activeCampaigns + pausedCampaigns + stoppedCampaigns;

  return (
    <div className={cn(
      'rounded-lg border p-4 transition-colors',
      config.bgColor,
      config.borderColor
    )}>
      <div className="flex items-center gap-4">
        {/* State Icon */}
        <div className={cn(
          'flex h-12 w-12 shrink-0 items-center justify-center rounded-full',
          config.iconBg
        )}>
          <Icon className={cn('h-6 w-6', config.iconColor)} />
        </div>

        {/* State Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('text-lg font-semibold', config.textColor)}>
              {label}
            </span>
            <span className={cn(
              'rounded-full px-2 py-0.5 text-xs font-medium',
              config.iconBg, config.iconColor
            )}>
              {state.replace('_', ' ')}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {description}
          </p>
        </div>

        {/* Campaign Breakdown */}
        {totalCampaigns > 0 && (
          <div className="flex items-center gap-3 text-sm">
            {activeCampaigns > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-success" />
                <span className="text-muted-foreground">{activeCampaigns} active</span>
              </div>
            )}
            {pausedCampaigns > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-warning" />
                <span className="text-muted-foreground">{pausedCampaigns} paused</span>
              </div>
            )}
            {stoppedCampaigns > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-destructive" />
                <span className="text-muted-foreground">{stoppedCampaigns} stopped</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
