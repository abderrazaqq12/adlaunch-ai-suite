import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProjectStore } from '@/stores/projectStore';
import { ProjectGate } from '@/components/common/ProjectGate';
import { PlatformBadge } from '@/components/common/PlatformBadge';
import { StatusBadge } from '@/components/common/StatusBadge';
import { StatCard } from '@/components/common/StatCard';
import type { Platform, Campaign, AIAction } from '@/types';
import { 
  Activity, 
  DollarSign, 
  MousePointerClick, 
  Target, 
  TrendingUp,
  Pause,
  Play,
  RefreshCw,
  Bot,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Mock AI actions for demonstration
const mockAIActions: AIAction[] = [
  {
    id: '1',
    campaignId: 'campaign-1',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    action: 'Increased bid by 15%',
    reason: 'CPC below target threshold with high conversion rate',
    result: 'CPC increased from $0.45 to $0.52',
  },
  {
    id: '2',
    campaignId: 'campaign-1',
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    action: 'Paused underperforming ad variation',
    reason: 'CTR 0.3% below campaign average after 5,000 impressions',
    result: 'Budget reallocated to top performers',
  },
  {
    id: '3',
    campaignId: 'campaign-2',
    timestamp: new Date(Date.now() - 10800000).toISOString(),
    action: 'Expanded audience targeting',
    reason: 'Campaign approaching daily budget limit with strong ROAS',
    result: 'Added lookalike audience segment',
  },
];

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const [isPausing, setIsPausing] = useState(false);

  const handlePauseResume = async () => {
    setIsPausing(true);
    // TODO: Replace with actual API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsPausing(false);
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <PlatformBadge platform={campaign.platform} size="sm" />
            <StatusBadge status={campaign.approvalStatus} />
          </div>
          <CardTitle className="text-lg">{campaign.name}</CardTitle>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handlePauseResume}
          disabled={isPausing}
        >
          {campaign.status === 'paused' ? (
            <>
              <Play className="mr-2 h-4 w-4" />
              Resume
            </>
          ) : (
            <>
              <Pause className="mr-2 h-4 w-4" />
              Pause
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Spend</p>
            <p className="text-lg font-semibold text-foreground">
              ${campaign.metrics.spend.toLocaleString()}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">CPC</p>
            <p className="text-lg font-semibold text-foreground">
              ${campaign.metrics.cpc.toFixed(2)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">CTR</p>
            <p className="text-lg font-semibold text-foreground">
              {campaign.metrics.ctr.toFixed(2)}%
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">ROAS</p>
            <p className="text-lg font-semibold text-foreground">
              {campaign.metrics.roas.toFixed(2)}x
            </p>
          </div>
        </div>

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

function AIActionLog({ actions }: { actions: AIAction[] }) {
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

function MonitoringContent() {
  const [activeTab, setActiveTab] = useState<'all' | Platform>('all');
  const { campaigns } = useProjectStore();

  const filteredCampaigns = activeTab === 'all'
    ? campaigns
    : campaigns.filter(c => c.platform === activeTab);

  // Calculate totals
  const totalSpend = campaigns.reduce((sum, c) => sum + c.metrics.spend, 0);
  const totalClicks = campaigns.reduce((sum, c) => sum + c.metrics.clicks, 0);
  const totalConversions = campaigns.reduce((sum, c) => sum + c.metrics.conversions, 0);
  const avgRoas = campaigns.length > 0
    ? campaigns.reduce((sum, c) => sum + c.metrics.roas, 0) / campaigns.length
    : 0;

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
        <Button variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
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

      {/* Platform Filter & Campaigns */}
      <div className="grid gap-8 lg:grid-cols-3">
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
                <CampaignCard key={campaign.id} campaign={campaign} />
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

        {/* AI Actions Log */}
        <Card className="border-border bg-card h-fit">
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
            <AIActionLog actions={mockAIActions} />
          </CardContent>
        </Card>
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
