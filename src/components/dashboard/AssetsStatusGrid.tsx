import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Loader2,
    Eye,
    RefreshCw,
    Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

type AssetStatus = 'APPROVED' | 'BLOCKED_HARD' | 'BLOCKED_SOFT' | 'ANALYZING' | 'PENDING';

interface Asset {
    id: string;
    name: string;
    type: 'video' | 'image' | 'text';
    status: AssetStatus;
    riskScore: number;
    platforms: ('google' | 'tiktok' | 'snapchat')[];
    canAutoRewrite?: boolean;
}

interface AssetsStatusGridProps {
    assets: Asset[];
    onViewViolations?: (assetId: string) => void;
    onAutoRewrite?: (assetId: string) => void;
    onRerunAnalysis?: (assetId: string) => void;
}

const statusConfig = {
    APPROVED: {
        label: 'Approved',
        icon: CheckCircle2,
        color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
    },
    BLOCKED_HARD: {
        label: 'Blocked',
        icon: XCircle,
        color: 'bg-red-500/10 text-red-500 border-red-500/30'
    },
    BLOCKED_SOFT: {
        label: 'Needs Fix',
        icon: AlertTriangle,
        color: 'bg-amber-500/10 text-amber-500 border-amber-500/30'
    },
    ANALYZING: {
        label: 'Analyzing',
        icon: Loader2,
        color: 'bg-primary/10 text-primary border-primary/30'
    },
    PENDING: {
        label: 'Pending',
        icon: Loader2,
        color: 'bg-muted text-muted-foreground border-border'
    },
};

const platformIcons = {
    google: { letter: 'G', color: 'bg-blue-500' },
    tiktok: { letter: 'T', color: 'bg-black dark:bg-white dark:text-black' },
    snapchat: { letter: 'S', color: 'bg-yellow-400 text-black' },
};

export function AssetsStatusGrid({
    assets,
    onViewViolations,
    onAutoRewrite,
    onRerunAnalysis
}: AssetsStatusGridProps) {
    const navigate = useNavigate();

    if (assets.length === 0) {
        return (
            <Card className="border-border bg-card">
                <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground mb-4">No assets uploaded yet</p>
                    <Button onClick={() => navigate('/assets')}>Upload Assets</Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-border bg-card">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-semibold">Assets Intelligence</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate('/assets')}>
                    View All
                </Button>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {assets.slice(0, 5).map((asset) => {
                        const status = statusConfig[asset.status];
                        const StatusIcon = status.icon;

                        return (
                            <div
                                key={asset.id}
                                className="flex items-center gap-4 p-3 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors"
                            >
                                {/* Status Badge */}
                                <Badge variant="outline" className={cn("gap-1.5", status.color)}>
                                    <StatusIcon className={cn(
                                        "h-3 w-3",
                                        asset.status === 'ANALYZING' && "animate-spin"
                                    )} />
                                    {status.label}
                                </Badge>

                                {/* Asset Name */}
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-foreground truncate">{asset.name}</p>
                                    <p className="text-xs text-muted-foreground capitalize">{asset.type}</p>
                                </div>

                                {/* Platform Icons */}
                                <div className="flex gap-1">
                                    {asset.platforms.map((p) => (
                                        <div
                                            key={p}
                                            className={cn(
                                                "flex h-6 w-6 items-center justify-center rounded text-xs font-bold text-white",
                                                platformIcons[p].color
                                            )}
                                        >
                                            {platformIcons[p].letter}
                                        </div>
                                    ))}
                                </div>

                                {/* Risk Score */}
                                <div className="text-right w-16">
                                    <span className={cn(
                                        "text-sm font-bold",
                                        asset.riskScore >= 70 ? "text-red-500" :
                                            asset.riskScore >= 40 ? "text-amber-500" :
                                                "text-emerald-500"
                                    )}>
                                        {asset.riskScore}
                                    </span>
                                    <p className="text-xs text-muted-foreground">Risk</p>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => onViewViolations?.(asset.id)}
                                        title="View Violations"
                                    >
                                        <Eye className="h-4 w-4" />
                                    </Button>
                                    {asset.canAutoRewrite && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => onAutoRewrite?.(asset.id)}
                                            title="Auto-Rewrite"
                                        >
                                            <Sparkles className="h-4 w-4" />
                                        </Button>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => onRerunAnalysis?.(asset.id)}
                                        title="Re-run Analysis"
                                    >
                                        <RefreshCw className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
                {assets.length > 5 && (
                    <p className="text-center text-sm text-muted-foreground mt-3">
                        +{assets.length - 5} more assets
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
