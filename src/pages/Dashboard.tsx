import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
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
  TrendingUp,
  ArrowUpRight,
  Sparkles,
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
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">My Campaigns</h1>
        <p className="mt-1 text-muted-foreground">
          {connectedAccounts} accounts connected • AI-powered optimization active
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Overview Card */}
        <div className="col-span-2 p-6 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Overview</h3>
              <p className="text-sm text-muted-foreground">Performance this month</p>
            </div>
            <select className="h-8 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-foreground">
              <option>Month</option>
              <option>Week</option>
              <option>Year</option>
            </select>
          </div>

          <div className="flex items-end gap-6">
            <div>
              <div className="flex items-center gap-2 text-success">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm font-medium">+19.73%</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">vs last month</p>
            </div>
            <div className="flex-1 h-24 relative">
              {/* Simplified chart visualization */}
              <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent rounded-lg opacity-50" />
              <svg className="w-full h-full" viewBox="0 0 200 80" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="hsl(217 91% 60%)" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="hsl(217 91% 60%)" stopOpacity="0.05" />
                  </linearGradient>
                </defs>
                <path
                  d="M0,60 Q30,55 50,40 T100,35 T150,25 T200,20 V80 H0 Z"
                  fill="url(#chartGradient)"
                />
                <path
                  d="M0,60 Q30,55 50,40 T100,35 T150,25 T200,20"
                  fill="none"
                  stroke="hsl(217 91% 60%)"
                  strokeWidth="2"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Connected Accounts */}
        <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Link2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{connectedAccounts}</p>
              <p className="text-sm text-muted-foreground">Connected</p>
            </div>
          </div>
        </div>

        {/* Assets Approved */}
        <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
              <CheckCircle2 className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {approvedAssets}
                <span className="text-sm font-normal text-muted-foreground">/{projectAssets.length}</span>
              </p>
              <p className="text-sm text-muted-foreground">Approved</p>
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
        </div>
      </div>

      {/* Actions & AI Section */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Quick Actions */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Quick Actions</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Button
              size="lg"
              className="h-auto py-5 flex-col gap-2 bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] hover:border-primary/30"
              variant="ghost"
              onClick={() => navigate('/assets')}
            >
              <Upload className="h-5 w-5 text-primary" />
              <span className="font-medium text-foreground">Upload Assets</span>
            </Button>

            <Button
              size="lg"
              variant="ghost"
              className="h-auto py-5 flex-col gap-2 bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] hover:border-primary/30"
              onClick={() => navigate('/connections')}
            >
              <Link2 className="h-5 w-5 text-primary" />
              <span className="font-medium text-foreground">Connect Account</span>
            </Button>

            <Button
              size="lg"
              className="h-auto py-5 flex-col gap-2 bg-gradient-to-r from-primary to-blue-600 hover:opacity-90"
              onClick={() => navigate('/launch')}
              disabled={approvedAssets === 0 || connectedAccounts === 0}
            >
              <Rocket className="h-5 w-5" />
              <span className="font-medium">Publish Campaign</span>
            </Button>
          </div>
        </div>

        {/* AI Assistant Card */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl" />
          <div className="relative">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20 mb-4">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">AI Assistant</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Get intelligent recommendations and automate your campaigns.
            </p>
            <Button size="sm" className="w-full bg-primary hover:bg-primary/90">
              Get Started
              <ArrowUpRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>

      {/* Recent AI Actions */}
      <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-4">
          <Bot className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Recent AI Actions</h2>
        </div>

        {recentAIActions.length > 0 ? (
          <div className="space-y-3">
            {recentAIActions.map(action => (
              <div
                key={action.id}
                className="flex items-start gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]"
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
      </div>
    </div>
  );
}
