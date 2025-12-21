import { Badge } from '@/components/ui/badge';
import type { AssetStatus } from '@/types';
import { Upload, Loader2, CheckCircle, Rocket, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AssetStatusBadgeProps {
  status: AssetStatus;
  size?: 'sm' | 'default';
}

/**
 * Asset Status Badge - reflects exact state machine states
 * UPLOADED → ANALYZING → APPROVED → READY_FOR_LAUNCH | BLOCKED
 */
const statusConfig: Record<AssetStatus, {
  label: string;
  icon: React.ElementType;
  className: string;
}> = {
  UPLOADED: {
    label: 'Uploaded',
    icon: Upload,
    className: 'bg-muted text-muted-foreground',
  },
  ANALYZING: {
    label: 'Analyzing...',
    icon: Loader2,
    className: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  },
  APPROVED: {
    label: 'AI Approved',
    icon: CheckCircle,
    className: 'bg-success/10 text-success border-success/20',
  },
  READY_FOR_LAUNCH: {
    label: 'Ready for Launch',
    icon: Rocket,
    className: 'bg-primary/10 text-primary border-primary/20',
  },
  BLOCKED: {
    label: 'Blocked',
    icon: XCircle,
    className: 'bg-destructive/10 text-destructive border-destructive/20',
  },
};

export function AssetStatusBadge({ status, size = 'default' }: AssetStatusBadgeProps) {
  const config = statusConfig[status];
  const IconComponent = config.icon;

  return (
    <Badge 
      variant="outline" 
      className={cn(
        'gap-1.5',
        config.className,
        size === 'sm' && 'text-xs px-2 py-0.5'
      )}
    >
      <IconComponent className={cn(
        'h-3 w-3', 
        size === 'sm' && 'h-2.5 w-2.5',
        status === 'ANALYZING' && 'animate-spin'
      )} />
      {config.label}
    </Badge>
  );
}
