import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    CheckCircle2,
    XCircle,
    AlertTriangle,
    RefreshCw,
    Link2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

type ConnectionStatus = 'connected' | 'expired' | 'not_connected';

interface PlatformConnection {
    platform: 'google' | 'tiktok' | 'snapchat';
    status: ConnectionStatus;
    accountName?: string;
    lastSync?: string;
    tokenHealth?: 'healthy' | 'warning' | 'expired';
}

interface ConnectedPlatformsCardProps {
    connections: PlatformConnection[];
}

const platformConfig = {
    google: { name: 'Google Ads', icon: 'G', color: 'bg-blue-500' },
    tiktok: { name: 'TikTok Ads', icon: 'T', color: 'bg-black dark:bg-white dark:text-black' },
    snapchat: { name: 'Snapchat Ads', icon: 'S', color: 'bg-yellow-400 text-black' },
};

const statusConfig = {
    connected: {
        label: 'Connected',
        icon: CheckCircle2,
        color: 'text-emerald-500',
        badgeColor: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
    },
    expired: {
        label: 'Expired',
        icon: AlertTriangle,
        color: 'text-amber-500',
        badgeColor: 'bg-amber-500/10 text-amber-500 border-amber-500/30'
    },
    not_connected: {
        label: 'Not Connected',
        icon: XCircle,
        color: 'text-red-500',
        badgeColor: 'bg-red-500/10 text-red-500 border-red-500/30'
    },
};

export function ConnectedPlatformsCard({ connections }: ConnectedPlatformsCardProps) {
    const navigate = useNavigate();

    return (
        <Card className="border-border bg-card">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-semibold">Ad Accounts</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate('/connections')}>
                    Manage
                </Button>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {connections.map((conn) => {
                        const platform = platformConfig[conn.platform];
                        const status = statusConfig[conn.status];
                        const StatusIcon = status.icon;

                        return (
                            <div
                                key={conn.platform}
                                className="flex items-center gap-4 p-3 rounded-lg border border-border bg-background"
                            >
                                {/* Platform Icon */}
                                <div className={cn(
                                    "flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white",
                                    platform.color
                                )}>
                                    {platform.icon}
                                </div>

                                {/* Platform Info */}
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-foreground">{platform.name}</p>
                                    {conn.accountName ? (
                                        <p className="text-sm text-muted-foreground truncate">{conn.accountName}</p>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">No account linked</p>
                                    )}
                                </div>

                                {/* Status Badge */}
                                <Badge variant="outline" className={cn("gap-1.5", status.badgeColor)}>
                                    <StatusIcon className="h-3 w-3" />
                                    {status.label}
                                </Badge>

                                {/* Last Sync / CTA */}
                                {conn.status === 'connected' && conn.lastSync ? (
                                    <div className="text-right text-xs text-muted-foreground w-20">
                                        <p>Last sync</p>
                                        <p>{conn.lastSync}</p>
                                    </div>
                                ) : conn.status === 'expired' ? (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => navigate('/connections')}
                                        className="gap-1"
                                    >
                                        <RefreshCw className="h-3 w-3" />
                                        Reconnect
                                    </Button>
                                ) : (
                                    <Button
                                        variant="default"
                                        size="sm"
                                        onClick={() => navigate('/connections')}
                                        className="gap-1"
                                    >
                                        <Link2 className="h-3 w-3" />
                                        Connect
                                    </Button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
