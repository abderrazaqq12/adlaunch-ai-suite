import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type RiskLevel = 'high' | 'medium' | 'low' | 'none';

interface PlatformRisk {
    platform: 'google' | 'tiktok' | 'snapchat';
    risk: RiskLevel;
    assetCount: number;
}

interface PlatformRiskHeatmapProps {
    platforms: PlatformRisk[];
}

const platformConfig = {
    google: { name: 'Google Ads', icon: 'G', color: 'bg-blue-500' },
    tiktok: { name: 'TikTok Ads', icon: 'T', color: 'bg-black dark:bg-white dark:text-black' },
    snapchat: { name: 'Snapchat Ads', icon: 'S', color: 'bg-yellow-400 text-black' },
};

const riskConfig = {
    high: { label: 'High Risk', color: 'bg-red-500', textColor: 'text-red-500', ring: 'ring-red-500/30' },
    medium: { label: 'Medium Risk', color: 'bg-amber-500', textColor: 'text-amber-500', ring: 'ring-amber-500/30' },
    low: { label: 'Low Risk', color: 'bg-emerald-500', textColor: 'text-emerald-500', ring: 'ring-emerald-500/30' },
    none: { label: 'No Assets', color: 'bg-muted', textColor: 'text-muted-foreground', ring: 'ring-border' },
};

export function PlatformRiskHeatmap({ platforms }: PlatformRiskHeatmapProps) {
    return (
        <Card className="border-border bg-card">
            <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Platform Risk Levels</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {platforms.map((p) => {
                        const platform = platformConfig[p.platform];
                        const risk = riskConfig[p.risk];

                        return (
                            <div
                                key={p.platform}
                                className={cn(
                                    "relative flex items-center gap-3 p-4 rounded-xl border-2 transition-all",
                                    "bg-card hover:bg-muted/50",
                                    risk.ring
                                )}
                            >
                                {/* Platform Icon */}
                                <div className={cn(
                                    "flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white",
                                    platform.color
                                )}>
                                    {platform.icon}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-foreground truncate">{platform.name}</p>
                                    <div className="flex items-center gap-2">
                                        <span className={cn("h-2 w-2 rounded-full", risk.color)} />
                                        <span className={cn("text-xs font-medium", risk.textColor)}>
                                            {risk.label}
                                        </span>
                                    </div>
                                </div>

                                {/* Asset Count */}
                                <div className="text-right">
                                    <span className="text-lg font-bold text-foreground">{p.assetCount}</span>
                                    <p className="text-xs text-muted-foreground">assets</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
