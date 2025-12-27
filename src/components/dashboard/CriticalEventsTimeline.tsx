import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    XCircle,
    AlertTriangle,
    CheckCircle2,
    Ban,
    ArrowUpRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

type EventType = 'blocked' | 'needs_fix' | 'rewritten' | 'launch_prevented';

interface CriticalEvent {
    id: string;
    type: EventType;
    message: string;
    platform?: string;
    timestamp: string;
    assetId?: string;
}

interface CriticalEventsTimelineProps {
    events: CriticalEvent[];
}

const eventConfig = {
    blocked: {
        icon: XCircle,
        color: 'text-red-500',
        bgColor: 'bg-red-500/10',
        label: 'Asset Blocked'
    },
    needs_fix: {
        icon: AlertTriangle,
        color: 'text-amber-500',
        bgColor: 'bg-amber-500/10',
        label: 'Needs Fix'
    },
    rewritten: {
        icon: CheckCircle2,
        color: 'text-emerald-500',
        bgColor: 'bg-emerald-500/10',
        label: 'Auto-Rewritten'
    },
    launch_prevented: {
        icon: Ban,
        color: 'text-red-500',
        bgColor: 'bg-red-500/10',
        label: 'Launch Prevented'
    },
};

export function CriticalEventsTimeline({ events }: CriticalEventsTimelineProps) {
    const navigate = useNavigate();

    if (events.length === 0) {
        return (
            <Card className="border-border bg-card">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold">Critical Events</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-6">
                        <p className="text-muted-foreground mb-2">No critical events yet</p>
                        <p className="text-sm text-muted-foreground">
                            Upload assets and run AI analysis to get started
                        </p>
                        <Button
                            variant="outline"
                            className="mt-4"
                            onClick={() => navigate('/assets')}
                        >
                            Upload Assets
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-border bg-card">
            <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Critical Events</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {events.slice(0, 6).map((event) => {
                        const config = eventConfig[event.type];
                        const Icon = config.icon;

                        return (
                            <div
                                key={event.id}
                                className="flex items-start gap-3 p-3 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors cursor-pointer"
                                onClick={() => event.assetId && navigate(`/assets`)}
                            >
                                <div className={cn(
                                    "flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0",
                                    config.bgColor
                                )}>
                                    <Icon className={cn("h-4 w-4", config.color)} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground">{event.message}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        {event.platform && (
                                            <span className="text-xs text-muted-foreground">{event.platform}</span>
                                        )}
                                        <span className="text-xs text-muted-foreground">{event.timestamp}</span>
                                    </div>
                                </div>
                                {event.assetId && (
                                    <ArrowUpRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                )}
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
