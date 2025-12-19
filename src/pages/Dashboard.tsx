import { StatCard } from '@/components/common/StatCard';
import { PlatformBadge } from '@/components/common/PlatformBadge';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useProjectStore } from '@/stores/projectStore';
import { Link } from 'react-router-dom';
import {
  DollarSign,
  MousePointerClick,
  Target,
  TrendingUp,
  AlertTriangle,
  Rocket,
  ArrowRight,
  Activity,
} from 'lucide-react';

export default function Dashboard() {
  const { currentProject, campaigns } = useProjectStore();

  // Calculate metrics from campaigns
  const activeCampaigns = campaigns.filter(c => c.status === 'active');
  const totalSpend = campaigns.reduce((sum, c) => sum + c.metrics.spend, 0);
  const avgCpc = campaigns.length > 0 
    ? campaigns.reduce((sum, c) => sum + c.metrics.cpc, 0) / campaigns.length 
    : 0;
  const avgRoas = campaigns.length > 0
    ? campaigns.reduce((sum, c) => sum + c.metrics.roas, 0) / campaigns.length
    : 0;
  const disapprovedCount = campaigns.filter(c => c.approvalStatus === 'disapproved').length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">
            {currentProject 
              ? `Overview for ${currentProject.name}`
              : 'Welcome to AdLaunch AI'}
          </p>
        </div>
        <Button asChild variant="glow">
          <Link to="/launch">
            <Rocket className="mr-2 h-4 w-4" />
            Launch Campaign
          </Link>
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Spend"
          value={`$${totalSpend.toLocaleString()}`}
          icon={DollarSign}
          trend={{ value: 12.5, isPositive: true }}
        />
        <StatCard
          title="Average CPC"
          value={`$${avgCpc.toFixed(2)}`}
          icon={MousePointerClick}
          trend={{ value: 3.2, isPositive: false }}
        />
        <StatCard
          title="Average ROAS"
          value={`${avgRoas.toFixed(2)}x`}
          icon={TrendingUp}
          trend={{ value: 8.1, isPositive: true }}
        />
        <StatCard
          title="Active Campaigns"
          value={activeCampaigns.length}
          icon={Target}
        />
      </div>

      {/* Alerts & Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Alerts */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Alerts & Notifications
            </CardTitle>
            <CardDescription>Issues requiring your attention</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {disapprovedCount > 0 ? (
              <div className="flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {disapprovedCount} Ad{disapprovedCount > 1 ? 's' : ''} Disapproved
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Review and fix policy violations
                    </p>
                  </div>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link to="/recovery">
                    Fix Now
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-lg border border-success/20 bg-success/5 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10">
                  <Activity className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="font-medium text-foreground">All Systems Operational</p>
                  <p className="text-sm text-muted-foreground">No issues detected</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and shortcuts</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button asChild variant="outline" className="justify-start">
              <Link to="/assets">
                <ArrowRight className="mr-2 h-4 w-4" />
                Upload New Assets
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link to="/analyze">
                <ArrowRight className="mr-2 h-4 w-4" />
                Run Pre-Launch Analysis
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link to="/rules">
                <ArrowRight className="mr-2 h-4 w-4" />
                Configure Automation Rules
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Campaigns */}
      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Campaigns</CardTitle>
            <CardDescription>Your latest campaign activity</CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/monitoring">
              View All
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {campaigns.length > 0 ? (
            <div className="space-y-4">
              {campaigns.slice(0, 5).map((campaign) => (
                <div
                  key={campaign.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-4"
                >
                  <div className="flex items-center gap-4">
                    <PlatformBadge platform={campaign.platform} size="sm" />
                    <div>
                      <p className="font-medium text-foreground">{campaign.name}</p>
                      <p className="text-sm text-muted-foreground">
                        ${campaign.metrics.spend.toLocaleString()} spent • {campaign.metrics.clicks.toLocaleString()} clicks
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={campaign.approvalStatus} />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4">
                <Rocket className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="mt-4 font-medium text-foreground">No campaigns yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Launch your first campaign to get started
              </p>
              <Button asChild className="mt-4" variant="glow">
                <Link to="/launch">Launch Campaign</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
