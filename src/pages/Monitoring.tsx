import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProjectStore } from '@/stores/projectStore';
import { ProjectGate } from '@/components/common/ProjectGate';
import { PlatformBadge } from '@/components/common/PlatformBadge';
import { StatusBadge } from '@/components/common/StatusBadge';
import { StatCard } from '@/components/common/StatCard';
import { ExecutionStatusBadge } from '@/components/common/ExecutionStatusBadge';
import { RealExecutionStatusBadge } from '@/components/common/RealExecutionStatusBadge';
import { brainClient, BrainClientError, type OptimizeResponse, type RealExecutionStatus } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import type { Platform, Campaign, AIAction, CampaignIntent } from '@/types';
import { PLATFORM_OBJECTIVE_NAMES } from '@/types';
import { 
  Activity, 
  DollarSign, 
  MousePointerClick, 
  Target, 
  TrendingUp,
  Pause,
  RefreshCw,
  Bot,
  Clock,
  Layers,
  Calendar,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Extended campaign type with execution info (simulated from launch response)
interface CampaignWithExecution extends Campaign {
  executionStatus?: RealExecutionStatus;
  platformError?: string;
}

// Read-only campaign card - no manual controls
function CampaignCard({ campaign }: { campaign: CampaignWithExecution }) {
  // Derive execution status from campaign status for display
  const getExecutionStatus = (): RealExecutionStatus | null => {
    if (campaign.executionStatus) return campaign.executionStatus;
    if (campaign.status === 'active' || campaign.status === 'paused') return 'EXECUTED';
    if (campaign.status === 'disapproved') return 'EXECUTION_BLOCKED';
    return null;
  };

  const executionStatus = getExecutionStatus();

  return (
    <Card className="border-border bg-card">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <PlatformBadge platform={campaign.platform} size="sm" />
            <StatusBadge status={campaign.approvalStatus} />
            {executionStatus && (
              <RealExecutionStatusBadge status={executionStatus} />
            )}
          </div>
          <CardTitle className="text-lg">{campaign.name}</CardTitle>
        </div>
        {/* Status indicator - read only */}
        <div className={cn(
          "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium",
          campaign.status === 'active' ? 'bg-success/10 text-success' :
          campaign.status === 'paused' ? 'bg-warning/10 text-warning' :
          'bg-muted text-muted-foreground'
        )}>
          {campaign.status === 'active' && <Activity className="h-4 w-4" />}
          {campaign.status === 'paused' && <Pause className="h-4 w-4" />}
          <span className="capitalize">{campaign.status}</span>
        </div>
      </CardHeader>
      <CardContent>
        {/* Performance Metrics */}
        <div className="grid grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Spend</p>
            <p className="text-lg font-semibold text-foreground">
              ${campaign.metrics.spend.toLocaleString()}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Clicks</p>
            <p className="text-lg font-semibold text-foreground">
              {campaign.metrics.clicks.toLocaleString()}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Conversions</p>
            <p className="text-lg font-semibold text-foreground">
              {campaign.metrics.conversions.toLocaleString()}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">ROAS</p>
            <p className="text-lg font-semibold text-foreground">
              {campaign.metrics.roas.toFixed(2)}x
            </p>
          </div>
        </div>

        {/* Execution Failed Error */}
        {(executionStatus === 'EXECUTION_FAILED' || campaign.platformError) && (
          <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-destructive">Execution Failed</p>
                <p className="text-sm text-destructive/80">
                  {campaign.platformError || 'Failed to create campaign in ad platform.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {campaign.approvalStatus === 'disapproved' && campaign.disapprovalReason && (
          <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
            <p className="text-sm text-destructive">
              <strong>Disapproval Reason:</strong> {campaign.disapprovalReason}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AIActionLog({ actions, isLoading }: { actions: AIAction[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading AI actions...</span>
      </div>
    );
  }

  if (actions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Bot className="h-10 w-10 mx-auto mb-3 opacity-50" />
        <p>No AI actions yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {actions.map(action => (
        <div
          key={action.id}
          className="flex gap-4 rounded-lg border border-border bg-secondary/30 p-4"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <p className="font-medium text-foreground">{action.action}</p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {new Date(action.timestamp).toLocaleTimeString()}
              </div>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{action.reason}</p>
            {action.result && (
              <p className="mt-2 text-sm text-success">→ {action.result}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function CampaignIntentCard({ intent, campaignsCount }: { intent: CampaignIntent; campaignsCount: number }) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <ExecutionStatusBadge status={intent.executionStatus || 'DRAFT'} />
            <span className="text-xs text-muted-foreground capitalize">
              {intent.objective === 'conversion' ? 'Conversion' : 'Video Views'}
            </span>
          </div>
          <h4 className="font-medium text-foreground truncate">{intent.name}</h4>
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(intent.createdAt)}
            </span>
            <span className="flex items-center gap-1">
              <Layers className="h-3.5 w-3.5" />
              {campaignsCount} campaign{campaignsCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1 shrink-0">
          {intent.selectedPlatforms.map(platform => (
            <PlatformBadge key={platform} platform={platform} size="sm" />
          ))}
        </div>
      </div>
      
      {/* Platform breakdown */}
      <div className="mt-3 pt-3 border-t border-border">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {intent.accountSelections.map(selection => {
            const platformLabel = selection.platform === 'google' ? 'Google' : 
                                 selection.platform === 'tiktok' ? 'TikTok' : 'Snapchat';
            return (
              <span key={selection.platform}>
                {platformLabel}: {selection.accountIds.length} account{selection.accountIds.length !== 1 ? 's' : ''}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CampaignIntentHistory({ intents, campaigns }: { intents: CampaignIntent[]; campaigns: Campaign[] }) {
  if (intents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Layers className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="font-medium text-foreground">No Campaign Intents</p>
        <p className="text-sm text-muted-foreground mt-1">
          Launch your first campaign to see history here.
        </p>
      </div>
    );
  }

  // Sort by createdAt descending (newest first)
  const sortedIntents = [...intents].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="space-y-3">
      {sortedIntents.map(intent => {
        const intentCampaigns = campaigns.filter(c => c.intentId === intent.id);
        return (
          <CampaignIntentCard 
            key={intent.id} 
            intent={intent} 
            campaignsCount={intentCampaigns.length}
          />
        );
      })}
    </div>
  );
}

function MonitoringContent() {
  const [activeTab, setActiveTab] = useState<'all' | Platform>('all');
  const [aiActions, setAiActions] = useState<AIAction[]>([]);
  const [isLoadingActions, setIsLoadingActions] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { campaigns, campaignIntents, currentProject, rules } = useProjectStore();
  const { toast } = useToast();

  const projectCampaigns = campaigns.filter(c => c.projectId === currentProject?.id);
  const projectIntents = campaignIntents.filter(i => i.projectId === currentProject?.id);
  const projectRules = rules.filter(r => r.projectId === currentProject?.id && r.enabled);

  const filteredCampaigns = activeTab === 'all'
    ? projectCampaigns
    : projectCampaigns.filter(c => c.platform === activeTab);

  // Calculate totals
  const totalSpend = projectCampaigns.reduce((sum, c) => sum + c.metrics.spend, 0);
  const totalClicks = projectCampaigns.reduce((sum, c) => sum + c.metrics.clicks, 0);
  const totalConversions = projectCampaigns.reduce((sum, c) => sum + c.metrics.conversions, 0);
  const avgRoas = projectCampaigns.length > 0
    ? projectCampaigns.reduce((sum, c) => sum + c.metrics.roas, 0) / projectCampaigns.length
    : 0;

  // Fetch AI optimization actions
  const fetchOptimizations = useCallback(async () => {
    if (!currentProject || projectCampaigns.length === 0) return;

    setIsLoadingActions(true);

    try {
      const allActions: AIAction[] = [];
      const platforms = [...new Set(projectCampaigns.map(c => c.platform))];

      for (const platform of platforms) {
        const platformCampaigns = projectCampaigns.filter(c => c.platform === platform);
        const aggregatedMetrics = {
          spend: platformCampaigns.reduce((sum, c) => sum + c.metrics.spend, 0),
          impressions: platformCampaigns.reduce((sum, c) => sum + c.metrics.impressions, 0),
          clicks: platformCampaigns.reduce((sum, c) => sum + c.metrics.clicks, 0),
          conversions: platformCampaigns.reduce((sum, c) => sum + c.metrics.conversions, 0),
          cpc: platformCampaigns.reduce((sum, c) => sum + c.metrics.cpc, 0) / platformCampaigns.length,
          cpa: platformCampaigns.reduce((sum, c) => sum + c.metrics.cpa, 0) / platformCampaigns.length,
          ctr: platformCampaigns.reduce((sum, c) => sum + c.metrics.ctr, 0) / platformCampaigns.length,
          roas: platformCampaigns.reduce((sum, c) => sum + c.metrics.roas, 0) / platformCampaigns.length,
        };

        const response = await brainClient.optimize(currentProject.id, {
          platform,
          metrics: aggregatedMetrics,
          rules: projectRules,
        });

        allActions.push(...response.actions.map(a => ({
          ...a,
          campaignId: platformCampaigns[0]?.id || '',
        })));
      }

      setAiActions(allActions);
    } catch (err) {
      console.error('[Monitoring] Failed to fetch optimizations:', err);
      // Don't show error toast for optimization failures - it's not critical
    } finally {
      setIsLoadingActions(false);
    }
  }, [currentProject, projectCampaigns, projectRules]);

  // Initial load
  useEffect(() => {
    fetchOptimizations();
  }, [fetchOptimizations]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchOptimizations();
    setIsRefreshing(false);
    toast({
      title: 'Data Refreshed',
      description: 'Campaign data and AI actions have been updated.',
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Live Monitoring</h1>
          <p className="mt-1 text-muted-foreground">
            Real-time campaign performance and AI decisions.
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw className={cn("mr-2 h-4 w-4", isRefreshing && "animate-spin")} />
          Refresh Data
        </Button>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Spend"
          value={`$${totalSpend.toLocaleString()}`}
          icon={DollarSign}
        />
        <StatCard
          title="Total Clicks"
          value={totalClicks.toLocaleString()}
          icon={MousePointerClick}
        />
        <StatCard
          title="Conversions"
          value={totalConversions.toLocaleString()}
          icon={Target}
        />
        <StatCard
          title="Avg. ROAS"
          value={`${avgRoas.toFixed(2)}x`}
          icon={TrendingUp}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Platform Filter & Campaigns */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList>
              <TabsTrigger value="all">All Platforms</TabsTrigger>
              <TabsTrigger value="google">Google</TabsTrigger>
              <TabsTrigger value="tiktok">TikTok</TabsTrigger>
              <TabsTrigger value="snapchat">Snapchat</TabsTrigger>
            </TabsList>
          </Tabs>

          {filteredCampaigns.length > 0 ? (
            <div className="space-y-4">
              {filteredCampaigns.map(campaign => (
                <CampaignCard 
                  key={campaign.id} 
                  campaign={campaign} 
                />
              ))}
            </div>
          ) : (
            <Card className="border-border bg-card">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Activity className="h-12 w-12 text-muted-foreground" />
                <p className="mt-4 font-medium text-foreground">No Active Campaigns</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Launch a campaign to see live monitoring data.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: AI Actions & Intent History */}
        <div className="space-y-6">
          {/* Campaign Intent History */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-primary" />
                Campaign Intents
              </CardTitle>
              <CardDescription>
                History of campaign launches with execution status.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CampaignIntentHistory intents={projectIntents} campaigns={projectCampaigns} />
            </CardContent>
          </Card>

          {/* AI Actions Log */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                AI Actions Log
              </CardTitle>
              <CardDescription>
                Recent automated decisions and optimizations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AIActionLog actions={aiActions} isLoading={isLoadingActions} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function Monitoring() {
  return (
    <ProjectGate requiredStage="LIVE">
      <MonitoringContent />
    </ProjectGate>
  );
}
