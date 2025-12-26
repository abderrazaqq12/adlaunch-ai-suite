import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useProjectStore } from '@/stores/projectStore';
import {
  Upload,
  Link2,
  Rocket,
  CheckCircle2,
  Zap,
  ArrowRight,
  Target,
  Activity,
} from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { currentProject, assets, campaigns, rules } = useProjectStore();

  // Calculate stats
  const projectAssets = assets.filter(a => a.projectId === currentProject?.id);
  const approvedAssets = projectAssets.filter(a => a.status === 'APPROVED' || a.status === 'READY_FOR_LAUNCH').length;
  const connectedAccounts = currentProject?.connections.length || 0;
  const activeCampaigns = campaigns.filter(c =>
    c.projectId === currentProject?.id &&
    (c.status === 'active' || c.status === 'pending')
  ).length;
  const activeRules = rules.filter(r => r.projectId === currentProject?.id && r.enabled).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Campaigns</h1>
        <p className="text-muted-foreground">
          {connectedAccounts} accounts connected • AI-powered optimization active
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Connected Accounts */}
        <Card className="border-border bg-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10">
                <Link2 className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">{connectedAccounts}</p>
                <p className="text-sm text-muted-foreground">Accounts</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Assets */}
        <Card className="border-border bg-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10">
                <CheckCircle2 className="h-6 w-6 text-green-400" />
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">
                  {approvedAssets}
                  <span className="text-lg font-normal text-muted-foreground ml-1">/ {projectAssets.length}</span>
                </p>
                <p className="text-sm text-muted-foreground">Assets Ready</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Campaigns */}
        <Card className="border-border bg-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10">
                <Rocket className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">{activeCampaigns}</p>
                <p className="text-sm text-muted-foreground">Campaigns</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Rules */}
        <Card className="border-border bg-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10">
                <Zap className="h-6 w-6 text-amber-400" />
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">{activeRules}</p>
                <p className="text-sm text-muted-foreground">Active Rules</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Quick Actions
          </CardTitle>
          <CardDescription>
            Start building your ad campaigns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <button
              onClick={() => navigate('/assets')}
              className="p-4 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 hover:border-primary/30 transition-all text-left"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 mb-3">
                <Upload className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-medium text-foreground">Upload Assets</h3>
              <p className="text-sm text-muted-foreground mt-1">Add videos and ad copy</p>
            </button>

            <button
              onClick={() => navigate('/connections')}
              className="p-4 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 hover:border-primary/30 transition-all text-left"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 mb-3">
                <Link2 className="h-5 w-5 text-blue-400" />
              </div>
              <h3 className="font-medium text-foreground">Connect Account</h3>
              <p className="text-sm text-muted-foreground mt-1">Link ad platforms</p>
            </button>

            <button
              onClick={() => navigate('/launch')}
              className="p-4 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 hover:border-primary/30 transition-all text-left"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 mb-3">
                <Rocket className="h-5 w-5 text-purple-400" />
              </div>
              <h3 className="font-medium text-foreground">Launch Campaign</h3>
              <p className="text-sm text-muted-foreground mt-1">Publish to platforms</p>
            </button>

            <button
              onClick={() => navigate('/rules')}
              className="p-4 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 hover:border-primary/30 transition-all text-left"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 mb-3">
                <Zap className="h-5 w-5 text-amber-400" />
              </div>
              <h3 className="font-medium text-foreground">Add Automation</h3>
              <p className="text-sm text-muted-foreground mt-1">Create AI rules</p>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Getting Started */}
      {projectAssets.length === 0 && connectedAccounts === 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Rocket className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium text-foreground">Get Started</p>
                <p className="text-sm text-muted-foreground">Upload assets and connect ad accounts</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => navigate('/assets')} className="gap-2">
                <Upload className="h-4 w-4" />
                Upload Assets
              </Button>
              <Button variant="outline" onClick={() => navigate('/connections')} className="gap-2">
                <Link2 className="h-4 w-4" />
                Connect Account
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activity Section */}
      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>
              Real-time updates from your campaigns
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => navigate('/monitoring')}>
            View all
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 p-4 rounded-lg border border-border bg-muted/30 text-muted-foreground">
            <Activity className="h-5 w-5" />
            <p>No recent activity. Start by uploading assets or connecting an ad account.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
