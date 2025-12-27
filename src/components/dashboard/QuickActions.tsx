import { Button } from '@/components/ui/button';
import {
    Upload,
    Sparkles,
    Wrench,
    Link2,
    Rocket
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface QuickActionsProps {
    hasBlockingIssues?: boolean;
    hasUnconnectedAccounts?: boolean;
    isReadyToLaunch?: boolean;
}

export function QuickActions({
    hasBlockingIssues = false,
    hasUnconnectedAccounts = false,
    isReadyToLaunch = false
}: QuickActionsProps) {
    const navigate = useNavigate();

    const actions = [
        {
            label: 'Upload Assets',
            icon: Upload,
            onClick: () => navigate('/assets'),
            variant: 'outline' as const,
            priority: 1,
        },
        {
            label: 'Run AI Analysis',
            icon: Sparkles,
            onClick: () => navigate('/assets'),
            variant: 'outline' as const,
            priority: 2,
        },
        {
            label: 'Fix Issues',
            icon: Wrench,
            onClick: () => navigate('/assets'),
            variant: hasBlockingIssues ? 'destructive' as const : 'outline' as const,
            priority: 3,
            highlight: hasBlockingIssues,
        },
        {
            label: 'Connect Accounts',
            icon: Link2,
            onClick: () => navigate('/connections'),
            variant: hasUnconnectedAccounts ? 'default' as const : 'outline' as const,
            priority: 4,
            highlight: hasUnconnectedAccounts,
        },
        {
            label: 'Launch Campaign',
            icon: Rocket,
            onClick: () => navigate('/launch'),
            variant: isReadyToLaunch ? 'default' as const : 'secondary' as const,
            priority: 5,
            disabled: !isReadyToLaunch,
        },
    ];

    return (
        <div className="flex flex-wrap gap-2">
            {actions.map((action) => {
                const Icon = action.icon;
                return (
                    <Button
                        key={action.label}
                        variant={action.variant}
                        onClick={action.onClick}
                        disabled={action.disabled}
                        className={cn(
                            "gap-2",
                            action.highlight && action.variant === 'destructive' && "animate-pulse"
                        )}
                    >
                        <Icon className="h-4 w-4" />
                        {action.label}
                    </Button>
                );
            })}
        </div>
    );
}
