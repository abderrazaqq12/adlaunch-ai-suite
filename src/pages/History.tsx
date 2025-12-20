import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useProjectStore } from '@/stores/projectStore';
import { PlatformBadge } from '@/components/common/PlatformBadge';
import type { Platform, Campaign } from '@/types';
import { 
  History as HistoryIcon, 
  TrendingUp, 
  TrendingDown,
  CheckCircle,
  XCircle,
  Lightbulb,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Mock learning insights
const mockLearnings = [
  {
    id: '1',
    type: 'success',
    title: 'Curiosity hooks outperform urgency',
    description: 'Ads with curiosity-based hooks had 23% higher CTR than urgency-based alternatives across all platforms.',
    platforms: ['google', 'tiktok'] as Platform[],
  },
  {
    id: '2',
    type: 'failure',
    title: 'Discount claims trigger disapprovals',
    description: 'Ads mentioning specific discount percentages had 3x higher disapproval rate on Google.',
    platforms: ['google'] as Platform[],
  },
  {
    id: '3',
    type: 'insight',
    title: 'Optimal video length varies by platform',
    description: 'TikTok performs best with 15-30 second videos, while Google prefers 30-60 seconds.',
    platforms: ['google', 'tiktok', 'snapchat'] as Platform[],
  },
];

function LearningCard({ learning }: { learning: typeof mockLearnings[0] }) {
  const config = {
    success: { icon: TrendingUp, color: 'text-success', bg: 'bg-success/10' },
    failure: { icon: TrendingDown, color: 'text-destructive', bg: 'bg-destructive/10' },
    insight: { icon: Lightbulb, color: 'text-warning', bg: 'bg-warning/10' },
  };

  const { icon: Icon, color, bg } = config[learning.type as keyof typeof config];

  return (
    <Card className="border-border bg-card">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className={cn('rounded-lg p-3', bg)}>
            <Icon className={cn('h-5 w-5', color)} />
          </div>
          <div className="flex-1">
            <p className="font-medium text-foreground">{learning.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{learning.description}</p>
            <div className="mt-3 flex gap-2">
              {learning.platforms.map(platform => (
                <PlatformBadge key={platform} platform={platform} size="sm" />
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CampaignHistoryCard({ campaign }: { campaign: Campaign }) {
  const isSuccess = campaign.metrics.roas > 1;

  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-4">
      <div className="flex items-center gap-4">
        {isSuccess ? (
          <CheckCircle className="h-5 w-5 text-success" />
        ) : (
          <XCircle className="h-5 w-5 text-destructive" />
        )}
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-foreground">{campaign.name}</p>
            <PlatformBadge platform={campaign.platform} size="sm" />
          </div>
          <p className="text-sm text-muted-foreground">
            ${campaign.metrics.spend.toLocaleString()} spent • {campaign.metrics.roas.toFixed(2)}x ROAS
          </p>
        </div>
      </div>
      <Badge variant={isSuccess ? 'default' : 'secondary'} className={cn(
        isSuccess ? 'bg-success text-success-foreground' : ''
      )}>
        {isSuccess ? 'Profitable' : 'Unprofitable'}
      </Badge>
    </div>
  );
}

export default function History() {
  const { campaigns, currentProject } = useProjectStore();
  const projectCampaigns = campaigns.filter(c => c.projectId === currentProject?.id);
  
  // Calculate summary stats
  const totalCampaigns = projectCampaigns.length;
  const profitableCampaigns = projectCampaigns.filter(c => c.metrics.roas > 1).length;
  const successRate = totalCampaigns > 0 
    ? Math.round((profitableCampaigns / totalCampaigns) * 100) 
    : 0;
  const totalSpend = projectCampaigns.reduce((sum, c) => sum + c.metrics.spend, 0);
  const avgRoas = totalCampaigns > 0
    ? projectCampaigns.reduce((sum, c) => sum + c.metrics.roas, 0) / totalCampaigns
    : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">History & Learning</h1>
        <p className="mt-1 text-muted-foreground">
          Track campaign performance and learn from AI-generated insights.
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border bg-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-3">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totalCampaigns}</p>
                <p className="text-sm text-muted-foreground">Total Campaigns</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-success/10 p-3">
                <CheckCircle className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{successRate}%</p>
                <p className="text-sm text-muted-foreground">Success Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-warning/10 p-3">
                <TrendingUp className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{avgRoas.toFixed(2)}x</p>
                <p className="text-sm text-muted-foreground">Average ROAS</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-3">
                <HistoryIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">${totalSpend.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total Spend</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Learning Insights */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            AI Learning Summary
          </CardTitle>
          <CardDescription>
            Patterns and insights learned from your campaign history.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mockLearnings.map(learning => (
            <LearningCard key={learning.id} learning={learning} />
          ))}
        </CardContent>
      </Card>

      {/* Campaign History */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>Campaign History</CardTitle>
          <CardDescription>
            All campaigns launched through AdLaunch AI.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {projectCampaigns.length > 0 ? (
            <div className="space-y-3">
              {projectCampaigns.map(campaign => (
                <CampaignHistoryCard key={campaign.id} campaign={campaign} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <HistoryIcon className="h-12 w-12 text-muted-foreground" />
              <p className="mt-4 font-medium text-foreground">No Campaign History</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Launch your first campaign to start building history.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
