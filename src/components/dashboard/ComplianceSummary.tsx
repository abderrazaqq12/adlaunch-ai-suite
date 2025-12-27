import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, XCircle, AlertTriangle, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ComplianceStats {
    approved: number;
    blockedHard: number;
    blockedSoft: number;
    autoRewriteAvailable: number;
}

interface ComplianceSummaryProps {
    stats: ComplianceStats;
}

export function ComplianceSummary({ stats }: ComplianceSummaryProps) {
    const metrics = [
        {
            label: 'Approved',
            value: stats.approved,
            icon: CheckCircle2,
            color: 'text-emerald-500',
            bgColor: 'bg-emerald-500/10',
        },
        {
            label: 'Blocked (Hard)',
            value: stats.blockedHard,
            icon: XCircle,
            color: 'text-red-500',
            bgColor: 'bg-red-500/10',
        },
        {
            label: 'Needs Fix (Soft)',
            value: stats.blockedSoft,
            icon: AlertTriangle,
            color: 'text-amber-500',
            bgColor: 'bg-amber-500/10',
        },
        {
            label: 'Auto-Rewrite Ready',
            value: stats.autoRewriteAvailable,
            icon: Sparkles,
            color: 'text-primary',
            bgColor: 'bg-primary/10',
        },
    ];

    return (
        <Card className="border-border bg-card">
            <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Compliance Overview</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {metrics.map((metric) => {
                        const Icon = metric.icon;
                        return (
                            <div
                                key={metric.label}
                                className={cn(
                                    "flex flex-col items-center justify-center p-4 rounded-xl border border-border/50",
                                    metric.bgColor
                                )}
                            >
                                <Icon className={cn("h-6 w-6 mb-2", metric.color)} />
                                <span className="text-2xl font-bold text-foreground">{metric.value}</span>
                                <span className="text-xs text-muted-foreground text-center">{metric.label}</span>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
