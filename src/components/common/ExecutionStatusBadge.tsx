import { cn } from '@/lib/utils';
import type { ExecutionStatus } from '@/types';
import { Check, AlertTriangle, XCircle, FileQuestion } from 'lucide-react';

interface ExecutionStatusBadgeProps {
  status: ExecutionStatus;
  className?: string;
}

const statusConfig: Record<ExecutionStatus, { label: string; icon: typeof Check; className: string }> = {
  READY: {
    label: 'Ready',
    icon: Check,
    className: 'bg-success/10 text-success border-success/20',
  },
  PARTIAL_READY: {
    label: 'Partial',
    icon: AlertTriangle,
    className: 'bg-warning/10 text-warning border-warning/20',
  },
  BLOCKED: {
    label: 'Blocked',
    icon: XCircle,
    className: 'bg-destructive/10 text-destructive border-destructive/20',
  },
  DRAFT: {
    label: 'Draft',
    icon: FileQuestion,
    className: 'bg-muted text-muted-foreground border-border',
  },
};

export function ExecutionStatusBadge({ status, className }: ExecutionStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium',
      config.className,
      className
    )}>
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </span>
  );
}
