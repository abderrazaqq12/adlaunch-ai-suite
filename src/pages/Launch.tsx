import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useProjectStore } from '@/stores/projectStore';
import { useToast } from '@/hooks/use-toast';
import { ProjectGate } from '@/components/common/ProjectGate';
import { PlatformBadge } from '@/components/common/PlatformBadge';
import { ExecutionReadinessPanel } from '@/components/common/ExecutionReadinessPanel';
import { ExecutionStatusBadge } from '@/components/common/ExecutionStatusBadge';
import { useExecutionReadiness } from '@/hooks/useExecutionReadiness';
import { brainClient, BrainClientError } from '@/lib/api';
import type { 
  Platform, 
  Campaign, 
  CampaignIntent, 
  CampaignObjective,
  PlatformAccountSelection,
  PlatformConfig,
  AudienceTarget,
  AdAccountConnection,
} from '@/types';
import { PLATFORM_OBJECTIVE_NAMES, calculateTotalCampaigns } from '@/types';
import { 
  Rocket, 
  AlertTriangle, 
  Check,
  DollarSign,
  Shield,
  Zap,
  ChevronRight,
  ChevronLeft,
  Globe,
  Users,
  Video,
  FileText,
  Target,
  Settings2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const OBJECTIVES: { value: CampaignObjective; label: string; description: string }[] = [
  { value: 'conversion', label: 'Conversion', description: 'Drive purchases, sign-ups, or leads' },
  { value: 'video_views', label: 'Video Views', description: 'Maximize video watch time and engagement' },
];

const COUNTRIES = [
  { value: 'US', label: 'United States' },
  { value: 'UK', label: 'United Kingdom' },
  { value: 'CA', label: 'Canada' },
  { value: 'AU', label: 'Australia' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
];

type WizardStep = 'intent' | 'platforms' | 'config' | 'preview';

const STEPS: { key: WizardStep; title: string; description: string }[] = [
  { key: 'intent', title: 'Campaign Intent', description: 'Define your campaign goals' },
  { key: 'platforms', title: 'Platforms & Accounts', description: 'Select where to launch' },
  { key: 'config', title: 'Platform Config', description: 'Configure each platform' },
  { key: 'preview', title: 'Review & Launch', description: 'Confirm and launch' },
];

function StepIndicator({ currentStep, steps }: { currentStep: WizardStep; steps: typeof STEPS }) {
  const currentIndex = steps.findIndex(s => s.key === currentStep);
  
  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map((step, index) => (
        <div key={step.key} className="flex items-center gap-2">
          <div className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors',
            index < currentIndex ? 'bg-success text-success-foreground' :
            index === currentIndex ? 'bg-primary text-primary-foreground' :
            'bg-muted text-muted-foreground'
          )}>
            {index < currentIndex ? <Check className="h-4 w-4" /> : index + 1}
          </div>
          <div className="hidden sm:block">
            <p className={cn(
              'text-sm font-medium',
              index <= currentIndex ? 'text-foreground' : 'text-muted-foreground'
            )}>
              {step.title}
            </p>
          </div>
          {index < steps.length - 1 && (
            <div className={cn(
              'h-px w-8 mx-2',
              index < currentIndex ? 'bg-success' : 'bg-border'
            )} />
          )}
        </div>
      ))}
    </div>
  );
}

function LaunchContent() {
  const navigate = useNavigate();
  const { currentProject, assets, addCampaignIntent, addCampaign } = useProjectStore();
  const { toast } = useToast();

  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>('intent');
  const [isLaunching, setIsLaunching] = useState(false);

  // Campaign Intent state
  const [campaignName, setCampaignName] = useState('');
  const [objective, setObjective] = useState<CampaignObjective>('conversion');
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [landingPageUrl, setLandingPageUrl] = useState('');
  const [audience, setAudience] = useState<AudienceTarget>({
    countries: ['US'],
    ageMin: 18,
    ageMax: 65,
    gender: 'all',
  });
  const [dailyBudget, setDailyBudget] = useState('100');
  const [softLaunch, setSoftLaunch] = useState(true);

  // Platform & Account selection
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([]);
  const [accountSelections, setAccountSelections] = useState<PlatformAccountSelection[]>([]);

  // Platform-specific configs
  const [platformConfigs, setPlatformConfigs] = useState<PlatformConfig>({
    google: { campaignType: 'demand_gen' },
    tiktok: {},
    snapchat: {},
  });

  const platforms: Platform[] = ['google', 'tiktok', 'snapchat'];

  // Compute execution readiness
  const executionReadiness = useExecutionReadiness({
    selectedAssetIds,
    selectedPlatforms,
    accountSelections,
    platformConfigs,
    objective,
    landingPageUrl,
    campaignName,
  });

  const approvedAssets = useMemo(() => 
    assets.filter(a => a.projectId === currentProject?.id && a.status === 'APPROVED'),
    [assets, currentProject?.id]
  );

  const getAccountsForPlatform = (platform: Platform): AdAccountConnection[] => {
    return currentProject?.connections.filter(
      c => c.platform === platform && c.permissions.canLaunch
    ) || [];
  };

  const getSelectedAccountsForPlatform = (platform: Platform): string[] => {
    return accountSelections.find(s => s.platform === platform)?.accountIds || [];
  };

  const togglePlatform = (platform: Platform) => {
    const accounts = getAccountsForPlatform(platform);
    if (accounts.length === 0) {
      toast({
        title: 'No Launchable Accounts',
        description: `No ${platform} accounts with launch permission. Connect accounts in the Connections page.`,
        variant: 'destructive',
      });
      return;
    }

    if (selectedPlatforms.includes(platform)) {
      setSelectedPlatforms(prev => prev.filter(p => p !== platform));
      setAccountSelections(prev => prev.filter(s => s.platform !== platform));
    } else {
      setSelectedPlatforms(prev => [...prev, platform]);
      // Auto-select all launchable accounts
      setAccountSelections(prev => [
        ...prev.filter(s => s.platform !== platform),
        { platform, accountIds: accounts.map(a => a.id) }
      ]);
    }
  };

  const toggleAccount = (platform: Platform, accountId: string) => {
    setAccountSelections(prev => {
      const existing = prev.find(s => s.platform === platform);
      if (!existing) {
        return [...prev, { platform, accountIds: [accountId] }];
      }
      
      const newAccountIds = existing.accountIds.includes(accountId)
        ? existing.accountIds.filter(id => id !== accountId)
        : [...existing.accountIds, accountId];
      
      // If no accounts selected, remove platform
      if (newAccountIds.length === 0) {
        setSelectedPlatforms(p => p.filter(plat => plat !== platform));
        return prev.filter(s => s.platform !== platform);
      }
      
      return prev.map(s => s.platform === platform ? { ...s, accountIds: newAccountIds } : s);
    });
  };

  const toggleAsset = (assetId: string) => {
    setSelectedAssetIds(prev => 
      prev.includes(assetId) 
        ? prev.filter(id => id !== assetId)
        : [...prev, assetId]
    );
  };

  const totalCampaigns = calculateTotalCampaigns(accountSelections);

  // Step validation
  const canProceedFromIntent = 
    campaignName.trim() !== '' && 
    selectedAssetIds.length > 0 && 
    landingPageUrl.trim() !== '';

  const canProceedFromPlatforms = 
    selectedPlatforms.length > 0 && 
    accountSelections.every(s => s.accountIds.length > 0);

  const canProceedFromConfig = selectedPlatforms.length > 0;

  const goNext = () => {
    const steps: WizardStep[] = ['intent', 'platforms', 'config', 'preview'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  const goBack = () => {
    const steps: WizardStep[] = ['intent', 'platforms', 'config', 'preview'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  const handleLaunch = async () => {
    if (!executionReadiness.canLaunch || !currentProject) return;

    setIsLaunching(true);

    try {
      const intentId = `intent-${Date.now()}`;
      
      // Create Campaign Intent with execution status
      const intent: CampaignIntent = {
        id: intentId,
        projectId: currentProject.id,
        name: campaignName,
        objective,
        assetIds: selectedAssetIds,
        landingPageUrl,
        audience,
        selectedPlatforms,
        accountSelections,
        platformConfigs,
        dailyBudget: parseFloat(dailyBudget),
        softLaunch,
        executionStatus: executionReadiness.status,
        status: 'launching',
        createdAt: new Date().toISOString(),
      };

      addCampaignIntent(intent);

      // Create real campaigns only for READY accounts based on executionReadiness
      let launchedCount = 0;
      const skippedDetails: string[] = [];

      for (const platformStatus of executionReadiness.platformStatuses) {
        const { platform, readyAccounts, blockedAccounts } = platformStatus;
        
        // Track blocked accounts for user feedback
        for (const blocked of blockedAccounts) {
          skippedDetails.push(`${blocked.name} (${blocked.reason})`);
        }

        // Only create campaigns for ready accounts
        for (const accountId of readyAccounts) {
          const account = currentProject.connections.find(c => c.id === accountId);
          if (!account) continue;

          // Call Brain API to decide launch
          const decideResponse = await brainClient.decideLaunch(currentProject.id, {
            executionStatus: executionReadiness.status,
            policyRiskScore: 20, // Would come from analysis in production
            platform,
            permissions: account.permissions,
          });

          if (decideResponse.decision === 'block') {
            skippedDetails.push(`${account.accountName} (${decideResponse.reason})`);
            continue;
          }

          // Call Brain API to translate campaign
          const translateResponse = await brainClient.translateCampaign(currentProject.id, {
            intent,
            platform,
            accountId,
            platformConfig: platformConfigs[platform],
          });

          const campaign: Campaign = {
            id: translateResponse.translatedCampaign.id,
            projectId: currentProject.id,
            intentId,
            name: `${campaignName} - ${account.accountName}`,
            platform,
            accountId,
            status: 'pending',
            budget: parseFloat(dailyBudget),
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

          addCampaign(campaign);

          // Write memory event
          await brainClient.memoryWrite(currentProject.id, {
            platform,
            accountId,
            event: 'launch',
            details: {
              campaignId: campaign.id,
              intentId,
              objective,
            },
          }).catch(err => console.warn('[Launch] Memory write failed:', err));

          launchedCount++;
        }
      }

      // Show skipped accounts warning
      if (skippedDetails.length > 0) {
        toast({
          title: 'Some Accounts Skipped',
          description: `${skippedDetails.length} account(s) skipped: ${skippedDetails.slice(0, 3).join(', ')}${skippedDetails.length > 3 ? '...' : ''}`,
          variant: 'default',
        });
      }

      toast({
        title: 'Campaigns Launched!',
        description: `${launchedCount} campaign(s) submitted for review.`,
      });

      navigate('/monitoring');
    } catch (error) {
      const message = error instanceof BrainClientError 
        ? error.message 
        : 'Failed to launch campaigns. Please try again.';
      toast({
        title: 'Launch Failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLaunching(false);
    }
  };

  // Render steps
  const renderIntentStep = () => (
    <div className="space-y-6">
      {/* Campaign Name */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Campaign Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Campaign Name *</Label>
            <Input
              id="name"
              placeholder="Summer Sale 2024"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Objective *</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Select one objective. Platform-specific names will be applied automatically.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {OBJECTIVES.map(obj => (
                <div
                  key={obj.value}
                  onClick={() => setObjective(obj.value)}
                  className={cn(
                    'cursor-pointer rounded-lg border p-4 transition-all',
                    objective === obj.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-lg',
                      objective === obj.value ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    )}>
                      {obj.value === 'conversion' ? <Target className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                    </div>
                    <div>
                      <p className="font-medium">{obj.label}</p>
                      <p className="text-xs text-muted-foreground">{obj.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="url">Landing Page URL *</Label>
            <Input
              id="url"
              type="url"
              placeholder="https://example.com/landing"
              value={landingPageUrl}
              onChange={(e) => setLandingPageUrl(e.target.value)}
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
                value={dailyBudget}
                onChange={(e) => setDailyBudget(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Asset Selection */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Select Assets *
          </CardTitle>
          <CardDescription>
            Choose approved assets for this campaign. {selectedAssetIds.length} selected.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {approvedAssets.length === 0 ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="font-medium text-foreground">No Approved Assets</p>
                  <p className="text-sm text-muted-foreground">
                    Run pre-launch analysis to approve assets before launching.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {approvedAssets.map(asset => (
                <div
                  key={asset.id}
                  onClick={() => toggleAsset(asset.id)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all',
                    selectedAssetIds.includes(asset.id)
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <Checkbox checked={selectedAssetIds.includes(asset.id)} />
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-success/10">
                    {asset.type === 'video' ? <Video className="h-4 w-4 text-success" /> : <FileText className="h-4 w-4 text-success" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{asset.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{asset.type}</p>
                  </div>
                  <Check className={cn('h-5 w-5', selectedAssetIds.includes(asset.id) ? 'text-primary' : 'text-transparent')} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audience Targeting */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Audience Targeting
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Country</Label>
            <Select 
              value={audience.countries[0]} 
              onValueChange={(v) => setAudience(prev => ({ ...prev, countries: [v] }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Age Range</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={13}
                  max={65}
                  value={audience.ageMin}
                  onChange={(e) => setAudience(prev => ({ ...prev, ageMin: parseInt(e.target.value) || 18 }))}
                  className="w-20"
                />
                <span className="text-muted-foreground">to</span>
                <Input
                  type="number"
                  min={13}
                  max={65}
                  value={audience.ageMax}
                  onChange={(e) => setAudience(prev => ({ ...prev, ageMax: parseInt(e.target.value) || 65 }))}
                  className="w-20"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Gender</Label>
              <Select 
                value={audience.gender} 
                onValueChange={(v) => setAudience(prev => ({ ...prev, gender: v as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderPlatformsStep = () => (
    <div className="space-y-6">
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Select Platforms & Accounts
          </CardTitle>
          <CardDescription>
            Choose platforms and specific ad accounts for your campaign.
            Your "{objective === 'conversion' ? 'Conversion' : 'Video Views'}" objective will be mapped to each platform's equivalent.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {platforms.map(platform => {
            const accounts = getAccountsForPlatform(platform);
            const selectedAccountIds = getSelectedAccountsForPlatform(platform);
            const isSelected = selectedPlatforms.includes(platform);
            const hasNoAccounts = accounts.length === 0;

            return (
              <div key={platform} className="space-y-3">
                {/* Platform Header */}
                <div
                  onClick={() => !hasNoAccounts && togglePlatform(platform)}
                  className={cn(
                    'flex items-center justify-between rounded-lg border p-4 transition-all',
                    hasNoAccounts 
                      ? 'cursor-not-allowed border-border bg-muted/30 opacity-60'
                      : isSelected
                        ? 'cursor-pointer border-primary bg-primary/5'
                        : 'cursor-pointer border-border hover:border-primary/50'
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      'flex h-12 w-12 items-center justify-center rounded-lg',
                      isSelected ? 'bg-primary' : 'bg-muted'
                    )}>
                      {isSelected ? (
                        <Check className="h-6 w-6 text-primary-foreground" />
                      ) : (
                        <span className="text-2xl">
                          {platform === 'google' ? '🔍' : platform === 'tiktok' ? '🎵' : '👻'}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-foreground capitalize">{platform} Ads</p>
                      {hasNoAccounts ? (
                        <p className="text-sm text-destructive">No accounts with launch permission</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {accounts.length} account{accounts.length !== 1 ? 's' : ''} available • 
                          Objective: {PLATFORM_OBJECTIVE_NAMES[platform][objective]}
                        </p>
                      )}
                    </div>
                  </div>
                  {isSelected && (
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                      {selectedAccountIds.length} selected
                    </span>
                  )}
                </div>

                {/* Account Selection */}
                {isSelected && accounts.length > 0 && (
                  <div className="ml-16 space-y-2">
                    {accounts.map(account => {
                      const isAccountSelected = selectedAccountIds.includes(account.id);
                      return (
                        <div
                          key={account.id}
                          onClick={() => toggleAccount(platform, account.id)}
                          className={cn(
                            'flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all',
                            isAccountSelected
                              ? 'border-primary/50 bg-primary/5'
                              : 'border-border hover:border-primary/30'
                          )}
                        >
                          <Checkbox checked={isAccountSelected} />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">{account.accountName}</p>
                            <p className="text-xs text-muted-foreground">ID: {account.accountId}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Selection Summary */}
      {totalCampaigns > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Rocket className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium text-foreground">
                  {totalCampaigns} campaign{totalCampaigns !== 1 ? 's' : ''} will be created
                </p>
                <p className="text-sm text-muted-foreground">
                  {accountSelections.map(s => 
                    `${s.platform}: ${s.accountIds.length}`
                  ).join(' • ')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderConfigStep = () => (
    <div className="space-y-6">
      {selectedPlatforms.map(platform => (
        <Card key={platform} className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              <span className="capitalize">{platform} Ads Configuration</span>
            </CardTitle>
            <CardDescription>
              Platform-specific settings for {PLATFORM_OBJECTIVE_NAMES[platform][objective]}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {platform === 'google' && (
              <>
                <div className="space-y-2">
                  <Label>Campaign Type</Label>
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="font-medium text-foreground">Demand Gen</p>
                    <p className="text-sm text-muted-foreground">
                      Only Demand Gen campaigns are supported for automated launch.
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Mapped Objective</Label>
                  <p className="text-sm text-muted-foreground">
                    Your "{objective === 'conversion' ? 'Conversion' : 'Video Views'}" objective will be launched as: <strong>{PLATFORM_OBJECTIVE_NAMES.google[objective]}</strong>
                  </p>
                </div>
                {objective === 'conversion' && (
                  <div className="space-y-2">
                    <Label htmlFor="google-conversion">Conversion Action (Optional)</Label>
                    <Input
                      id="google-conversion"
                      placeholder="e.g., Purchase, Sign Up"
                      value={platformConfigs.google?.conversionAction || ''}
                      onChange={(e) => setPlatformConfigs(prev => ({
                        ...prev,
                        google: { ...prev.google!, conversionAction: e.target.value }
                      }))}
                    />
                  </div>
                )}
              </>
            )}

            {platform === 'tiktok' && (
              <>
                <div className="space-y-2">
                  <Label>Mapped Objective</Label>
                  <p className="text-sm text-muted-foreground">
                    Your "{objective === 'conversion' ? 'Conversion' : 'Video Views'}" objective will be launched as: <strong>{PLATFORM_OBJECTIVE_NAMES.tiktok[objective]}</strong>
                  </p>
                </div>
                {objective === 'conversion' && (
                  <div className="space-y-2">
                    <Label htmlFor="tiktok-event">Optimization Event (Optional)</Label>
                    <Select 
                      value={platformConfigs.tiktok?.optimizationEvent || ''} 
                      onValueChange={(v) => setPlatformConfigs(prev => ({
                        ...prev,
                        tiktok: { ...prev.tiktok, optimizationEvent: v }
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select event" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="complete_payment">Complete Payment</SelectItem>
                        <SelectItem value="add_to_cart">Add to Cart</SelectItem>
                        <SelectItem value="submit_form">Submit Form</SelectItem>
                        <SelectItem value="click">Click</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}

            {platform === 'snapchat' && (
              <>
                <div className="space-y-2">
                  <Label>Mapped Objective</Label>
                  <p className="text-sm text-muted-foreground">
                    Your "{objective === 'conversion' ? 'Conversion' : 'Video Views'}" objective will be launched as: <strong>{PLATFORM_OBJECTIVE_NAMES.snapchat[objective]}</strong>
                  </p>
                </div>
                {objective === 'conversion' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="snap-pixel">Pixel ID (Optional)</Label>
                      <Input
                        id="snap-pixel"
                        placeholder="e.g., abc123-xyz"
                        value={platformConfigs.snapchat?.pixelId || ''}
                        onChange={(e) => setPlatformConfigs(prev => ({
                          ...prev,
                          snapchat: { ...prev.snapchat, pixelId: e.target.value }
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="snap-event">Conversion Event (Optional)</Label>
                      <Select 
                        value={platformConfigs.snapchat?.conversionEvent || ''} 
                        onValueChange={(v) => setPlatformConfigs(prev => ({
                          ...prev,
                          snapchat: { ...prev.snapchat, conversionEvent: v }
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select event" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="purchase">Purchase</SelectItem>
                          <SelectItem value="add_cart">Add to Cart</SelectItem>
                          <SelectItem value="sign_up">Sign Up</SelectItem>
                          <SelectItem value="page_view">Page View</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      ))}

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
              </p>
            </div>
          </div>
          <Switch checked={softLaunch} onCheckedChange={setSoftLaunch} />
        </CardContent>
      </Card>
    </div>
  );

  const renderPreviewStep = () => (
    <div className="space-y-6">
      {/* Campaign Summary */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>Campaign Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Campaign Name</p>
              <p className="font-medium text-foreground">{campaignName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Objective</p>
              <p className="font-medium text-foreground capitalize">{objective.replace('_', ' ')}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Daily Budget</p>
              <p className="font-medium text-foreground">${dailyBudget}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Soft Launch</p>
              <p className="font-medium text-foreground">{softLaunch ? 'Enabled' : 'Disabled'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Landing Page</p>
              <p className="font-medium text-foreground truncate">{landingPageUrl}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Assets</p>
              <p className="font-medium text-foreground">{selectedAssetIds.length} selected</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Campaign Count */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            Campaigns to Create
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {accountSelections.map(selection => {
              const platformAccounts = currentProject?.connections.filter(
                c => selection.accountIds.includes(c.id)
              ) || [];
              
              return (
                <div key={selection.platform} className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">
                        {selection.platform === 'google' ? '🔍' : selection.platform === 'tiktok' ? '🎵' : '👻'}
                      </span>
                      <span className="font-medium capitalize">{selection.platform}</span>
                    </div>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                      {selection.accountIds.length} campaign{selection.accountIds.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>Objective: {PLATFORM_OBJECTIVE_NAMES[selection.platform][objective]}</p>
                    <p>Accounts:</p>
                    <ul className="ml-4 list-disc">
                      {platformAccounts.map(acc => (
                        <li key={acc.id}>{acc.accountName}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between text-lg font-semibold">
              <span>Total Campaigns</span>
              <span className="text-primary">{totalCampaigns}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Execution Readiness */}
      <ExecutionReadinessPanel readiness={executionReadiness} />
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Launch Configuration</h1>
        <p className="mt-1 text-muted-foreground">
          Create a Campaign Intent and launch across multiple platforms and accounts.
        </p>
      </div>

      {/* Step Indicator with Execution Status */}
      <div className="flex items-center justify-between">
        <StepIndicator currentStep={currentStep} steps={STEPS} />
        {currentStep !== 'intent' && (
          <ExecutionStatusBadge status={executionReadiness.status} />
        )}
      </div>

      {/* Step Content */}
      {currentStep === 'intent' && renderIntentStep()}
      {currentStep === 'platforms' && renderPlatformsStep()}
      {currentStep === 'config' && renderConfigStep()}
      {currentStep === 'preview' && renderPreviewStep()}

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button 
          variant="outline" 
          onClick={goBack}
          disabled={currentStep === 'intent'}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        {currentStep === 'preview' ? (
          <Button 
            variant="glow" 
            size="lg"
            onClick={handleLaunch}
            disabled={isLaunching || !executionReadiness.canLaunch || executionReadiness.totalCampaignsReady === 0}
          >
            {isLaunching ? (
              <>
                <Zap className="mr-2 h-5 w-5 animate-pulse" />
                Launching {executionReadiness.totalCampaignsReady} Campaign{executionReadiness.totalCampaignsReady !== 1 ? 's' : ''}...
              </>
            ) : (
              <>
                <Rocket className="mr-2 h-5 w-5" />
                Launch {executionReadiness.totalCampaignsReady} Campaign{executionReadiness.totalCampaignsReady !== 1 ? 's' : ''}
                {executionReadiness.status === 'PARTIAL_READY' && ` (${executionReadiness.totalCampaignsBlocked} skipped)`}
              </>
            )}
          </Button>
        ) : (
          <Button 
            onClick={goNext}
            disabled={
              (currentStep === 'intent' && !canProceedFromIntent) ||
              (currentStep === 'platforms' && !canProceedFromPlatforms) ||
              (currentStep === 'config' && !canProceedFromConfig)
            }
          >
            Next
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default function Launch() {
  return (
    <ProjectGate requiredStage="ANALYSIS_PASSED">
      <LaunchContent />
    </ProjectGate>
  );
}