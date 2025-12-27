import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
    ShieldCheck,
    Sparkles,
    PauseCircle,
    UserCheck,
    Lock
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProtectionSettings {
    autoBlockOnViolation: boolean;
    autoRewriteText: boolean;
    autoPauseOnViolation: boolean;
    manualReviewRequired: boolean;
}

interface ProtectionStatusPanelProps {
    settings: ProtectionSettings;
}

export function ProtectionStatusPanel({ settings }: ProtectionStatusPanelProps) {
    const protections = [
        {
            key: 'autoBlockOnViolation',
            label: 'Auto-Block on Violation',
            description: 'Automatically block assets that fail compliance',
            icon: ShieldCheck,
            enabled: settings.autoBlockOnViolation,
        },
        {
            key: 'autoRewriteText',
            label: 'Auto-Rewrite (Text Only)',
            description: 'AI rewrites non-compliant text content',
            icon: Sparkles,
            enabled: settings.autoRewriteText,
        },
        {
            key: 'autoPauseOnViolation',
            label: 'Auto-Pause Campaigns',
            description: 'Pause campaigns if assets fail during runtime',
            icon: PauseCircle,
            enabled: settings.autoPauseOnViolation,
        },
        {
            key: 'manualReviewRequired',
            label: 'Manual Review Required',
            description: 'All launches require human approval',
            icon: UserCheck,
            enabled: settings.manualReviewRequired,
        },
    ];

    return (
        <Card className="border-border bg-card">
            <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Protection & Guardrails
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {protections.map((p) => {
                        const Icon = p.icon;
                        return (
                            <div
                                key={p.key}
                                className="flex items-center justify-between gap-4"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "flex h-8 w-8 items-center justify-center rounded-lg",
                                        p.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                                    )}>
                                        <Icon className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-foreground">{p.label}</p>
                                        <p className="text-xs text-muted-foreground">{p.description}</p>
                                    </div>
                                </div>
                                <Switch
                                    checked={p.enabled}
                                    disabled
                                    className="data-[state=checked]:bg-primary"
                                />
                            </div>
                        );
                    })}
                </div>
                <p className="text-xs text-muted-foreground mt-4 text-center">
                    Configure in Settings
                </p>
            </CardContent>
        </Card>
    );
}
