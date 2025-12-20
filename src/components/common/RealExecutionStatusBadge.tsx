import { cn } from '@/lib/utils';
import type { RealExecutionStatus } from '@/lib/api/brainClient';
import { Check, XCircle, Ban } from 'lucide-react';

interface RealExecutionStatusBadgeProps {
  status: RealExecutionStatus;
  className?: string;
}

const statusConfig: Record<RealExecutionStatus, { label: string; icon: typeof Check; className: string }> = {
  EXECUTED: {
    label: 'Executed',
    icon: Check,
    className: 'bg-success/10 text-success border-success/20',
  },
  EXECUTION_FAILED: {
    label: 'Failed',
    icon: XCircle,
    className: 'bg-destructive/10 text-destructive border-destructive/20',
  },
  EXECUTION_BLOCKED: {
    label: 'Blocked',
    icon: Ban,
    className: 'bg-warning/10 text-warning border-warning/20',
  },
};

export function RealExecutionStatusBadge({ status, className }: RealExecutionStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
      config.className,
      className
    )}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}
