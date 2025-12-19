import { Badge } from '@/components/ui/badge';
import type { AssetStatus } from '@/types';
import { Upload, Search, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AssetStatusBadgeProps {
  status: AssetStatus;
  size?: 'sm' | 'default';
}

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
  ANALYZED: {
    label: 'Analyzed',
    icon: Search,
    className: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  },
  RISKY: {
    label: 'Risky',
    icon: AlertTriangle,
    className: 'bg-destructive/10 text-destructive border-destructive/20',
  },
  APPROVED: {
    label: 'Approved',
    icon: CheckCircle,
    className: 'bg-success/10 text-success border-success/20',
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
      <IconComponent className={cn('h-3 w-3', size === 'sm' && 'h-2.5 w-2.5')} />
      {config.label}
    </Badge>
  );
}
