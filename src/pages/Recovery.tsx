import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useProjectStore } from '@/stores/projectStore';
import { useToast } from '@/hooks/use-toast';
import { PlatformBadge } from '@/components/common/PlatformBadge';
import { recover, memoryWrite, formatBrainError, type SafeVariant } from '@/lib/api/brainClient';
import type { Campaign } from '@/types';
import { 
  AlertTriangle, 
  RefreshCw, 
  Sparkles, 
  Check,
  X,
  Lightbulb,
  Rocket,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function DisapprovedCampaignCard({ campaign }: { campaign: Campaign }) {
  const [isRelaunching, setIsRelaunching] = useState(false);
  const [isLoadingVariants, setIsLoadingVariants] = useState(false);
  const [selectedAlternative, setSelectedAlternative] = useState<string | null>(null);
  const [alternatives, setAlternatives] = useState<SafeVariant[]>([]);
  const { toast } = useToast();

  // Load recovery variants on mount
  useEffect(() => {
    const loadVariants = async () => {
      setIsLoadingVariants(true);
      try {
        const result = await recover(
          campaign.platform,
          campaign.disapprovalReason || 'Policy violation',
          { hook: campaign.name, body: '', cta: 'Learn More' }
        );
        setAlternatives(result.safeVariants);
      } catch (error) {
        toast({
          title: 'Failed to load variants',
          description: formatBrainError(error),
          variant: 'destructive',
        });
      } finally {
        setIsLoadingVariants(false);
      }
    };
    loadVariants();
  }, [campaign.platform, campaign.disapprovalReason, campaign.name, toast]);

  const handleRelaunch = async () => {
    if (!selectedAlternative) {
      toast({
        title: 'Select an Alternative',
        description: 'Please select a safe variant before relaunching.',
        variant: 'destructive',
      });
      return;
    }

    setIsRelaunching(true);
    try {
      // Record recovery attempt to memory
      await memoryWrite(campaign.platform, campaign.accountId, {
        type: 'AD_DISAPPROVAL',
        platform: campaign.platform,
        accountId: campaign.accountId,
        timestamp: new Date().toISOString(),
        details: {
          campaignId: campaign.id,
          selectedVariant: selectedAlternative,
          originalReason: campaign.disapprovalReason,
        },
        outcome: 'neutral',
      });

      toast({
        title: 'Campaign Relaunched',
        description: 'Your campaign has been resubmitted with the safe variant.',
      });
    } catch (error) {
      toast({
        title: 'Relaunch Failed',
        description: formatBrainError(error),
        variant: 'destructive',
      });
    } finally {
      setIsRelaunching(false);
    }
  };

  return (
    <Card className="border-destructive/20 bg-card overflow-hidden">
      <div className="h-1 bg-destructive" />
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <PlatformBadge platform={campaign.platform} size="sm" />
              <Badge variant="destructive">Disapproved</Badge>
            </div>
            <CardTitle className="text-lg">{campaign.name}</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Disapproval Reason */}
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Disapproval Reason</p>
              <p className="mt-1 text-sm text-foreground">
                {campaign.disapprovalReason || 'Policy violation detected in ad copy'}
              </p>
            </div>
          </div>
        </div>

        {/* AI-Generated Alternatives */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <p className="font-medium text-foreground">AI-Generated Safe Variants</p>
          </div>
          
          {isLoadingVariants ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : alternatives.length > 0 ? (
            <div className="space-y-3">
              {alternatives.map((alt, index) => (
                <div
                  key={index}
                  onClick={() => setSelectedAlternative(String(index))}
                  className={cn(
                    'cursor-pointer rounded-lg border p-4 transition-all',
                    selectedAlternative === String(index)
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
                      selectedAlternative === String(index)
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border'
                    )}>
                      {selectedAlternative === String(index) && <Check className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-success" />
                        <p className="text-sm text-foreground font-medium">
                          {alt.hook}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">{alt.body}</p>
                      <div className="flex items-start gap-2 mt-2">
                        <Lightbulb className="h-4 w-4 text-warning shrink-0" />
                        <p className="text-xs text-muted-foreground">
                          CTA: {alt.cta}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No alternatives generated yet.</p>
          )}
        </div>
        {/* Relaunch Button */}
        <Button
          onClick={handleRelaunch}
          disabled={isRelaunching || !selectedAlternative}
          className="w-full"
          variant="success"
        >
          {isRelaunching ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Relaunching...
            </>
          ) : (
            <>
              <Rocket className="mr-2 h-4 w-4" />
              Relaunch Safe Variant
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function Recovery() {
  const { campaigns } = useProjectStore();
  const disapprovedCampaigns = campaigns.filter(c => c.approvalStatus === 'disapproved');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Disapproval Recovery</h1>
        <p className="mt-1 text-muted-foreground">
          Fix policy violations and relaunch your ads with AI-generated safe variants.
        </p>
      </div>

      {/* Warning Banner */}
      <Card className="border-warning/20 bg-warning/5">
        <CardContent className="flex items-start gap-4 p-6">
          <AlertTriangle className="h-6 w-6 shrink-0 text-warning" />
          <div>
            <p className="font-medium text-foreground">Important Notice</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Repeated policy violations may result in account suspension. 
              AdLaunch AI generates compliant alternatives, but you should review them before relaunching.
              No spam or retry loops - one relaunch per disapproval.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Disapproved Campaigns */}
      {disapprovedCampaigns.length > 0 ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {disapprovedCampaigns.map(campaign => (
            <DisapprovedCampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      ) : (
        <Card className="border-border bg-card">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-success/10 p-4">
              <Check className="h-8 w-8 text-success" />
            </div>
            <p className="mt-4 text-lg font-medium text-foreground">All Clear!</p>
            <p className="mt-1 text-sm text-muted-foreground">
              No disapproved ads requiring attention.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
