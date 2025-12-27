import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    ShieldCheck,
    ShieldAlert,
    ShieldX,
    AlertCircle,
    XCircle,
    ArrowRight,
    FileWarning
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

export type ReadinessStatus = 'READY' | 'PARTIALLY_READY' | 'NOT_READY';

interface BlockingReason {
    type: 'hard' | 'soft' | 'account' | 'compliance';
    message: string;
    count?: number;
}

interface LaunchReadinessCardProps {
    status: ReadinessStatus;
    blockingReasons: BlockingReason[];
    onFixIssues?: () => void;
    onViewReport?: () => void;
}

const statusConfig = {
    READY: {
        icon: ShieldCheck,
        title: 'Ready to Launch',
        subtitle: 'All compliance checks passed. Accounts connected.',
        bgClass: 'bg-emerald-500/10 border-emerald-500/30',
        iconClass: 'text-emerald-500',
        badgeClass: 'bg-emerald-500 text-white',
    },
    PARTIALLY_READY: {
        icon: ShieldAlert,
        title: 'Partially Ready',
        subtitle: 'Some assets need attention before launch.',
        bgClass: 'bg-amber-500/10 border-amber-500/30',
        iconClass: 'text-amber-500',
        badgeClass: 'bg-amber-500 text-white',
    },
    NOT_READY: {
        icon: ShieldX,
        title: 'Not Ready',
        subtitle: 'Critical issues must be resolved before launch.',
        bgClass: 'bg-red-500/10 border-red-500/30',
        iconClass: 'text-red-500',
        badgeClass: 'bg-red-500 text-white',
    },
};

export function LaunchReadinessCard({
    status,
    blockingReasons,
    onFixIssues,
    onViewReport
}: LaunchReadinessCardProps) {
    const navigate = useNavigate();
    const config = statusConfig[status];
    const Icon = config.icon;

    const handleFixIssues = () => {
        if (onFixIssues) {
            onFixIssues();
        } else {
            navigate('/assets');
        }
    };

    return (
        <Card className={cn(
            "relative overflow-hidden border-2 transition-all duration-300",
            config.bgClass
        )}>
            <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                    {/* Status Badge */}
                    <div className="flex items-center gap-4 flex-shrink-0">
                        <div className={cn(
                            "flex h-16 w-16 items-center justify-center rounded-2xl",
                            config.bgClass
                        )}>
                            <Icon className={cn("h-8 w-8", config.iconClass)} />
                        </div>
                        <div>
                            <div className={cn(
                                "inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold mb-1",
                                config.badgeClass
                            )}>
                                {config.title}
                            </div>
                            <p className="text-sm text-muted-foreground max-w-xs">
                                {config.subtitle}
                            </p>
                        </div>
                    </div>

                    {/* Blocking Reasons */}
                    {blockingReasons.length > 0 && (
                        <div className="flex-1 space-y-2">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                                Blocking Issues
                            </p>
                            <div className="space-y-1.5">
                                {blockingReasons.slice(0, 4).map((reason, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center gap-2 text-sm"
                                    >
                                        {reason.type === 'hard' ? (
                                            <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                                        ) : reason.type === 'soft' ? (
                                            <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                                        ) : reason.type === 'account' ? (
                                            <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                                        ) : (
                                            <FileWarning className="h-4 w-4 text-amber-500 flex-shrink-0" />
                                        )}
                                        <span className="text-foreground">{reason.message}</span>
                                    </div>
                                ))}
                                {blockingReasons.length > 4 && (
                                    <p className="text-xs text-muted-foreground pl-6">
                                        +{blockingReasons.length - 4} more issues
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* CTAs */}
                    <div className="flex flex-col sm:flex-row gap-2 lg:flex-shrink-0">
                        {status !== 'READY' && (
                            <Button
                                onClick={handleFixIssues}
                                className="gap-2"
                                variant={status === 'NOT_READY' ? 'destructive' : 'default'}
                            >
                                Fix Issues
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            onClick={onViewReport}
                            className="gap-2"
                        >
                            View Report
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
