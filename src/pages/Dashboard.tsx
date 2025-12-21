import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useProjectStore } from '@/stores/projectStore';
import { PlatformBadge } from '@/components/common/PlatformBadge';
import type { Platform } from '@/types';
import { 
  Upload, 
  Link2, 
  Rocket, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  Activity,
  Bot,
  Clock,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// AI Action type for display
interface AIActionDisplay {
  id: string;
  action: string;
  timestamp: string;
  platform?: Platform;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { currentProject, assets, campaigns, rules } = useProjectStore();
  
  // Calculate stats using new state machine statuses
  const projectAssets = assets.filter(a => a.projectId === currentProject?.id);
  const approvedAssets = projectAssets.filter(a => a.status === 'APPROVED').length;
  const readyAssets = projectAssets.filter(a => a.status === 'READY_FOR_LAUNCH').length;
  const blockedAssets = projectAssets.filter(a => a.status === 'BLOCKED').length;
  const pendingAssets = projectAssets.filter(a => a.status === 'UPLOADED').length;
  
  const connectedAccounts = currentProject?.connections.length || 0;
  const activeCampaigns = campaigns.filter(c => 
    c.projectId === currentProject?.id && 
    (c.status === 'active' || c.status === 'pending')
  ).length;
  const activeRules = rules.filter(r => r.projectId === currentProject?.id && r.enabled).length;

  // Mock recent AI actions (in production, fetch from API)
  const recentAIActions: AIActionDisplay[] = [
    {
      id: '1',
      action: 'Paused low-performing ad set due to high CPA',
      timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      platform: 'google',
    },
    {
      id: '2', 
      action: 'Increased budget by 20% for top performer',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      platform: 'tiktok',
    },
    {
      id: '3',
      action: 'Asset compliance check completed - 3 approved',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          AI-powered ad execution overview
        </p>
      </div>

      {/* Key Stats - No chart noise */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Connected Accounts */}
        <Card className="border-border bg-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Link2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{connectedAccounts}</p>
                <p className="text-sm text-muted-foreground">Connected Accounts</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Assets */}
        <Card className="border-border bg-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-success/10">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {approvedAssets}
                  <span className="text-sm font-normal text-muted-foreground">
                    /{projectAssets.length}
                  </span>
                </p>
                <p className="text-sm text-muted-foreground">Assets Approved</p>
              </div>
            </div>
            {(blockedAssets > 0 || pendingAssets > 0) && (
              <div className="mt-3 flex gap-3 text-xs">
                {blockedAssets > 0 && (
                  <span className="flex items-center gap-1 text-destructive">
                    <XCircle className="h-3 w-3" />
                    {blockedAssets} blocked
                  </span>
                )}
                {pendingAssets > 0 && (
                  <span className="flex items-center gap-1 text-warning">
                    <AlertTriangle className="h-3 w-3" />
                    {pendingAssets} pending
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Campaigns */}
        <Card className="border-border bg-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10">
                <Activity className="h-6 w-6 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{activeCampaigns}</p>
                <p className="text-sm text-muted-foreground">Active Campaigns</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Rules */}
        <Card className="border-border bg-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-warning/10">
                <Zap className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{activeRules}</p>
                <p className="text-sm text-muted-foreground">Active Rules</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Primary CTAs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Button 
          size="lg" 
          className="h-auto py-6 flex-col gap-2"
          onClick={() => navigate('/assets')}
        >
          <Upload className="h-6 w-6" />
          <span className="font-semibold">Upload Assets</span>
          <span className="text-xs opacity-80">Add videos, copy, or landing pages</span>
        </Button>

        <Button 
          size="lg" 
          variant="outline"
          className="h-auto py-6 flex-col gap-2"
          onClick={() => navigate('/connections')}
        >
          <Link2 className="h-6 w-6" />
          <span className="font-semibold">Connect Ad Account</span>
          <span className="text-xs opacity-80">Google, TikTok, Snapchat</span>
        </Button>

        <Button 
          size="lg" 
          variant="glow"
          className="h-auto py-6 flex-col gap-2"
          onClick={() => navigate('/launch')}
          disabled={approvedAssets === 0 || connectedAccounts === 0}
        >
          <Rocket className="h-6 w-6" />
          <span className="font-semibold">Publish Campaign</span>
          <span className="text-xs opacity-80">
            {approvedAssets === 0 ? 'Need approved assets' : 
             connectedAccounts === 0 ? 'Connect accounts first' : 
             'Deploy to platforms'}
          </span>
        </Button>
      </div>

      {/* Recent AI Actions */}
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <CardTitle>Recent AI Actions</CardTitle>
          </div>
          <CardDescription>
            Latest AI decisions across your campaigns
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentAIActions.length > 0 ? (
            <div className="space-y-4">
              {recentAIActions.map(action => (
                <div
                  key={action.id}
                  className="flex items-start gap-4 rounded-lg border border-border bg-secondary/30 p-4"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-foreground">{action.action}</p>
                      {action.platform && (
                        <PlatformBadge platform={action.platform} size="sm" />
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(action.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Bot className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No AI actions yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Launch campaigns to see AI optimization in action
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
