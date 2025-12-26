import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useProjectStore } from '@/stores/projectStore';
import {
  Upload,
  Link2,
  Rocket,
  CheckCircle2,
  Activity,
  Zap,
  ArrowRight,
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
    <div className="max-w-6xl mx-auto space-y-10">
      {/* Welcome Section */}
      <div className="pt-4">
        <h1 className="text-3xl font-bold text-foreground">Welcome back</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Here's what's happening with your campaigns
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Connected Accounts */}
        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10">
              <Link2 className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-3xl font-bold text-foreground">{connectedAccounts}</p>
              <p className="text-sm text-muted-foreground">Accounts</p>
            </div>
          </div>
        </div>

        {/* Assets */}
        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10">
              <CheckCircle2 className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-3xl font-bold text-foreground">
                {approvedAssets}
                <span className="text-lg font-normal text-muted-foreground ml-1">/ {projectAssets.length}</span>
              </p>
              <p className="text-sm text-muted-foreground">Assets Ready</p>
            </div>
          </div>
        </div>

        {/* Active Campaigns */}
        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10">
              <Rocket className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <p className="text-3xl font-bold text-foreground">{activeCampaigns}</p>
              <p className="text-sm text-muted-foreground">Campaigns</p>
            </div>
          </div>
        </div>

        {/* Active Rules */}
        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10">
              <Zap className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-3xl font-bold text-foreground">{activeRules}</p>
              <p className="text-sm text-muted-foreground">Active Rules</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-foreground">Quick Actions</h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <button
            onClick={() => navigate('/assets')}
            className="group p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.12] transition-all text-left"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 mb-4">
              <Upload className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-medium text-foreground mb-1">Upload Assets</h3>
            <p className="text-sm text-muted-foreground">Add videos and ad copy</p>
          </button>

          <button
            onClick={() => navigate('/connections')}
            className="group p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.12] transition-all text-left"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 mb-4">
              <Link2 className="h-5 w-5 text-blue-400" />
            </div>
            <h3 className="font-medium text-foreground mb-1">Connect Account</h3>
            <p className="text-sm text-muted-foreground">Link ad platforms</p>
          </button>

          <button
            onClick={() => navigate('/launch')}
            className="group p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.12] transition-all text-left"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 mb-4">
              <Rocket className="h-5 w-5 text-purple-400" />
            </div>
            <h3 className="font-medium text-foreground mb-1">Launch Campaign</h3>
            <p className="text-sm text-muted-foreground">Publish to platforms</p>
          </button>

          <button
            onClick={() => navigate('/rules')}
            className="group p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.12] transition-all text-left"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 mb-4">
              <Zap className="h-5 w-5 text-amber-400" />
            </div>
            <h3 className="font-medium text-foreground mb-1">Add Automation</h3>
            <p className="text-sm text-muted-foreground">Create AI rules</p>
          </button>
        </div>
      </div>

      {/* Getting Started */}
      {projectAssets.length === 0 && connectedAccounts === 0 && (
        <div className="p-8 rounded-2xl bg-gradient-to-br from-primary/5 to-blue-500/5 border border-primary/10">
          <div className="max-w-2xl">
            <h2 className="text-xl font-semibold text-foreground mb-2">Get Started</h2>
            <p className="text-muted-foreground mb-6">
              Start by uploading your video ads and connecting your ad accounts.
              Our AI will analyze your content for compliance and help optimize your campaigns.
            </p>
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
          </div>
        </div>
      )}

      {/* Activity Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">Recent Activity</h2>
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => navigate('/monitoring')}>
            View all
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
          <div className="flex items-center gap-4 text-muted-foreground">
            <Activity className="h-5 w-5" />
            <p>No recent activity. Start by uploading assets or connecting an ad account.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
