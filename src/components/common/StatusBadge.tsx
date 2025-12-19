import { cn } from '@/lib/utils';
import type { ConnectionStatus } from '@/types';

interface StatusBadgeProps {
  status: ConnectionStatus | 'approved' | 'pending' | 'disapproved' | 'active' | 'paused' | 'limited';
  className?: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  not_connected: {
    label: 'Not Connected',
    className: 'bg-muted text-muted-foreground',
  },
  connected: {
    label: 'Connected',
    className: 'bg-success/10 text-success border border-success/20',
  },
  limited_access: {
    label: 'Limited Access',
    className: 'bg-warning/10 text-warning border border-warning/20',
  },
  limited: {
    label: 'Limited',
    className: 'bg-warning/10 text-warning border border-warning/20',
  },
  approved: {
    label: 'Approved',
    className: 'bg-success/10 text-success border border-success/20',
  },
  pending: {
    label: 'Pending',
    className: 'bg-warning/10 text-warning border border-warning/20',
  },
  disapproved: {
    label: 'Disapproved',
    className: 'bg-destructive/10 text-destructive border border-destructive/20',
  },
  active: {
    label: 'Active',
    className: 'bg-success/10 text-success border border-success/20',
  },
  paused: {
    label: 'Paused',
    className: 'bg-muted text-muted-foreground border border-border',
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.not_connected;
  
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
