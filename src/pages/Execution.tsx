import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useProjectStore } from '@/stores/projectStore';
import { ProjectGate } from '@/components/common/ProjectGate';
import { PlatformBadge } from '@/components/common/PlatformBadge';
import { RealExecutionStatusBadge } from '@/components/common/RealExecutionStatusBadge';
import type { Campaign, CampaignIntent, Platform } from '@/types';
import { 
  Rocket, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Layers,
  Calendar,
  Eye,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function ExecutedCampaignCard({ campaign }: { campaign: Campaign }) {
  const getStatusColor = () => {
    switch (campaign.status) {
      case 'active': return 'border-success/50 bg-success/5';
      case 'paused': return 'border-warning/50 bg-warning/5';
      case 'disapproved': return 'border-destructive/50 bg-destructive/5';
      default: return 'border-border';
    }
  };

  const getStatusIcon = () => {
    switch (campaign.status) {
      case 'active': return <CheckCircle2 className="h-4 w-4 text-success" />;
      case 'paused': return <Clock className="h-4 w-4 text-warning" />;
      case 'disapproved': return <XCircle className="h-4 w-4 text-destructive" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <Card className={cn('border-border bg-card', getStatusColor())}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <PlatformBadge platform={campaign.platform} size="sm" />
              <Badge variant={
                campaign.status === 'active' ? 'default' :
                campaign.status === 'paused' ? 'secondary' :
                campaign.status === 'disapproved' ? 'destructive' : 'outline'
              } className="capitalize">
                {getStatusIcon()}
                <span className="ml-1">{campaign.status}</span>
              </Badge>
            </div>
            <h4 className="font-medium text-foreground truncate">{campaign.name}</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Account: {campaign.accountId}
            </p>
          </div>
        </div>

        {campaign.status === 'disapproved' && campaign.disapprovalReason && (
          <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-sm text-destructive">{campaign.disapprovalReason}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function IntentSummaryCard({ intent, campaigns }: { intent: CampaignIntent; campaigns: Campaign[] }) {
  const [expanded, setExpanded] = useState(false);
  const intentCampaigns = campaigns.filter(c => c.intentId === intent.id);
  
  const activeCampaigns = intentCampaigns.filter(c => c.status === 'active').length;
  const pausedCampaigns = intentCampaigns.filter(c => c.status === 'paused').length;
  const disapprovedCampaigns = intentCampaigns.filter(c => c.status === 'disapproved').length;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              {intent.selectedPlatforms.map(platform => (
                <PlatformBadge key={platform} platform={platform} size="sm" />
              ))}
            </div>
            <CardTitle className="text-lg truncate">{intent.name}</CardTitle>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(intent.launchedAt || intent.createdAt)}
              </span>
              <span className="flex items-center gap-1">
                <Layers className="h-3.5 w-3.5" />
                {intentCampaigns.length} campaign{intentCampaigns.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <Eye className="h-4 w-4" />
            {expanded ? 'Hide' : 'View'}
          </button>
        </div>
      </CardHeader>

      {/* Campaign Status Summary */}
      <CardContent className="pt-0">
        <div className="flex gap-4 text-sm">
          {activeCampaigns > 0 && (
            <span className="flex items-center gap-1 text-success">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {activeCampaigns} active
            </span>
          )}
          {pausedCampaigns > 0 && (
            <span className="flex items-center gap-1 text-warning">
              <Clock className="h-3.5 w-3.5" />
              {pausedCampaigns} paused
            </span>
          )}
          {disapprovedCampaigns > 0 && (
            <span className="flex items-center gap-1 text-destructive">
              <XCircle className="h-3.5 w-3.5" />
              {disapprovedCampaigns} blocked
            </span>
          )}
        </div>

        {/* Expanded: Show individual campaigns */}
        {expanded && intentCampaigns.length > 0 && (
          <div className="mt-4 space-y-3 border-t border-border pt-4">
            {intentCampaigns.map(campaign => (
              <ExecutedCampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ExecutionContent() {
  const { campaigns, campaignIntents, currentProject } = useProjectStore();
  
  const projectCampaigns = campaigns.filter(c => c.projectId === currentProject?.id);
  const projectIntents = campaignIntents.filter(i => 
    i.projectId === currentProject?.id && 
    i.status === 'launched'
  );

  // Sort by launch date (newest first)
  const sortedIntents = [...projectIntents].sort(
    (a, b) => new Date(b.launchedAt || b.createdAt).getTime() - new Date(a.launchedAt || a.createdAt).getTime()
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">AI Execution</h1>
        <p className="mt-1 text-muted-foreground">
          Read-only view of what was published, where, and current status.
        </p>
      </div>

      {/* Execution List */}
      {sortedIntents.length > 0 ? (
        <div className="space-y-6">
          {sortedIntents.map(intent => (
            <IntentSummaryCard 
              key={intent.id} 
              intent={intent} 
              campaigns={projectCampaigns}
            />
          ))}
        </div>
      ) : (
        <Card className="border-border bg-card">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-muted p-4">
              <Rocket className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="mt-4 text-lg font-medium text-foreground">No Campaigns Published</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Publish your first campaign to see execution status here.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function Execution() {
  return (
    <ProjectGate>
      <ExecutionContent />
    </ProjectGate>
  );
}
