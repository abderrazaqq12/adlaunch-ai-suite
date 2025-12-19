import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProjectStore } from '@/stores/projectStore';
import { useToast } from '@/hooks/use-toast';
import { PlatformBadge } from '@/components/common/PlatformBadge';
import type { Platform, Campaign } from '@/types';
import { 
  Rocket, 
  AlertTriangle, 
  Check,
  DollarSign,
  Target,
  Shield,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const objectives = [
  { value: 'CPC', label: 'Cost Per Click', description: 'Optimize for website traffic' },
  { value: 'CPA', label: 'Cost Per Acquisition', description: 'Optimize for conversions' },
  { value: 'ROAS', label: 'Return on Ad Spend', description: 'Optimize for revenue' },
];

export default function Launch() {
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([]);
  const [campaignName, setCampaignName] = useState('');
  const [budget, setBudget] = useState('');
  const [objective, setObjective] = useState<'CPC' | 'CPA' | 'ROAS'>('CPC');
  const [softLaunch, setSoftLaunch] = useState(true);
  const [isLaunching, setIsLaunching] = useState(false);
  
  const navigate = useNavigate();
  const { currentProject, addCampaign } = useProjectStore();
  const { toast } = useToast();

  const platforms: Platform[] = ['google', 'tiktok', 'snapchat'];

  // Check permissions for each platform
  const getConnectionForPlatform = (platform: Platform) => {
    return currentProject?.connections.find(c => c.platform === platform);
  };

  const canLaunchOnPlatform = (platform: Platform) => {
    const connection = getConnectionForPlatform(platform);
    return connection?.permissions.canLaunch ?? false;
  };

  const togglePlatform = (platform: Platform) => {
    if (!canLaunchOnPlatform(platform)) {
      toast({
        title: 'Launch Not Available',
        description: `You don't have permission to launch campaigns on ${platform}. Please upgrade your access level.`,
        variant: 'destructive',
      });
      return;
    }
    
    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  const handleLaunch = async () => {
    if (selectedPlatforms.length === 0) {
      toast({
        title: 'No Platforms Selected',
        description: 'Please select at least one platform to launch on.',
        variant: 'destructive',
      });
      return;
    }

    if (!campaignName || !budget) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    setIsLaunching(true);

    try {
      // TODO: Replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Create campaigns for each selected platform
      selectedPlatforms.forEach(platform => {
        const newCampaign: Campaign = {
          id: `campaign-${Date.now()}-${platform}`,
          projectId: currentProject?.id || '',
          name: `${campaignName} - ${platform}`,
          platform,
          status: 'pending',
          budget: parseFloat(budget),
          objective,
          softLaunch,
          metrics: {
            spend: 0,
            impressions: 0,
            clicks: 0,
            conversions: 0,
            cpc: 0,
            cpa: 0,
            ctr: 0,
            roas: 0,
          },
          approvalStatus: 'pending',
          createdAt: new Date().toISOString(),
        };
        addCampaign(newCampaign);
      });

      toast({
        title: 'Campaign Launched!',
        description: `Your campaign has been submitted for review on ${selectedPlatforms.length} platform(s).`,
      });

      navigate('/monitoring');
    } catch (error) {
      toast({
        title: 'Launch Failed',
        description: 'Failed to launch campaign. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Launch Configuration</h1>
        <p className="mt-1 text-muted-foreground">
          Configure and launch your ad campaigns across platforms.
        </p>
      </div>

      {/* Platform Selection */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>Select Platforms</CardTitle>
          <CardDescription>
            Choose which platforms to launch your campaign on.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {platforms.map(platform => {
            const connection = getConnectionForPlatform(platform);
            const canLaunch = canLaunchOnPlatform(platform);
            const isSelected = selectedPlatforms.includes(platform);
            
            return (
              <div
                key={platform}
                onClick={() => togglePlatform(platform)}
                className={cn(
                  'flex cursor-pointer items-center justify-between rounded-lg border p-4 transition-all',
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : canLaunch
                      ? 'border-border hover:border-primary/50'
                      : 'cursor-not-allowed border-border bg-muted/30 opacity-60'
                )}
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-lg',
                    isSelected ? 'bg-primary' : 'bg-muted'
                  )}>
                    {isSelected ? (
                      <Check className="h-5 w-5 text-primary-foreground" />
                    ) : (
                      <span className="text-xl">
                        {platform === 'google' ? '🔍' : platform === 'tiktok' ? '🎵' : '👻'}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-foreground capitalize">{platform} Ads</p>
                    {!connection ? (
                      <p className="text-sm text-muted-foreground">Not connected</p>
                    ) : !canLaunch ? (
                      <p className="text-sm text-warning">Limited access - Launch disabled</p>
                    ) : (
                      <p className="text-sm text-success">Ready to launch</p>
                    )}
                  </div>
                </div>
                {!canLaunch && connection && (
                  <AlertTriangle className="h-5 w-5 text-warning" />
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Campaign Details */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>Campaign Details</CardTitle>
          <CardDescription>
            Set your campaign name, budget, and optimization goal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Campaign Name</Label>
            <Input
              id="name"
              placeholder="Summer Sale 2024"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="budget">Daily Budget</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="budget"
                type="number"
                placeholder="100"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Optimization Objective</Label>
            <Select value={objective} onValueChange={(v) => setObjective(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {objectives.map(obj => (
                  <SelectItem key={obj.value} value={obj.value}>
                    <div>
                      <p className="font-medium">{obj.label}</p>
                      <p className="text-xs text-muted-foreground">{obj.description}</p>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Soft Launch Toggle */}
      <Card className="border-border bg-card">
        <CardContent className="flex items-center justify-between p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-success/10 p-3">
              <Shield className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="font-medium text-foreground">Soft Launch Mode</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Start with low budget, narrow audience, and compliance-safe settings. 
                Recommended for new campaigns.
              </p>
            </div>
          </div>
          <Switch
            checked={softLaunch}
            onCheckedChange={setSoftLaunch}
          />
        </CardContent>
      </Card>

      {/* Launch Button */}
      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={() => navigate('/analyze')}>
          Run Pre-Launch Analysis
        </Button>
        <Button 
          variant="glow" 
          size="lg"
          onClick={handleLaunch}
          disabled={isLaunching || selectedPlatforms.length === 0}
        >
          {isLaunching ? (
            <>
              <Zap className="mr-2 h-5 w-5 animate-pulse" />
              Launching...
            </>
          ) : (
            <>
              <Rocket className="mr-2 h-5 w-5" />
              Launch Campaign
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
