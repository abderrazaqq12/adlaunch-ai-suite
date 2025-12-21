import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useProjectStore } from '@/stores/projectStore';
import { useToast } from '@/hooks/use-toast';
import { ProjectGate } from '@/components/common/ProjectGate';
import { ExecutionReadinessPanel } from '@/components/common/ExecutionReadinessPanel';
import { ExecutionStatusBadge } from '@/components/common/ExecutionStatusBadge';
import { LaunchConfirmationDialog } from '@/components/launch/LaunchConfirmationDialog';
import { useExecutionReadiness } from '@/hooks/useExecutionReadiness';
import { usePublishFlowState, canTransitionStep } from '@/hooks/usePublishFlowState';
import { brainClient, BrainClientError } from '@/lib/api';
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox';
import { COUNTRIES } from '@/lib/data/countries';
import { LANGUAGES } from '@/lib/data/languages';
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
  Languages,
  CheckCircle2,
  Lock,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Fixed objective - Conversion only
const FIXED_OBJECTIVE: CampaignObjective = 'conversion';

type WizardStep = 'assets' | 'accounts' | 'audience' | 'preview';

const STEPS: { key: WizardStep; title: string; description: string }[] = [
  { key: 'assets', title: 'Select Assets', description: 'Choose AI-approved assets' },
  { key: 'accounts', title: 'Ad Accounts', description: 'Select platforms & accounts' },
  { key: 'audience', title: 'Audience', description: 'Define targeting' },
  { key: 'preview', title: 'Publish', description: 'Review & launch' },
];

interface StepIndicatorProps {
  currentStep: WizardStep;
  steps: typeof STEPS;
  validation: ReturnType<typeof usePublishFlowState>;
}

function StepIndicator({ currentStep, steps, validation }: StepIndicatorProps) {
  const currentIndex = steps.findIndex(s => s.key === currentStep);
  
  // Determine which steps are complete based on state machine
  const getStepStatus = (index: number): 'complete' | 'current' | 'blocked' | 'upcoming' => {
    if (index < currentIndex) return 'complete';
    if (index === currentIndex) {
      // Check if current step has blockers
      if (validation.blockerMessage && !validation.canProceed) return 'blocked';
      return 'current';
    }
    return 'upcoming';
  };
  
  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map((step, index) => {
        const status = getStepStatus(index);
        
        return (
          <div key={step.key} className="flex items-center gap-2">
            <div className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors',
              status === 'complete' && 'bg-success text-success-foreground',
              status === 'current' && 'bg-primary text-primary-foreground',
              status === 'blocked' && 'bg-destructive/10 text-destructive border-2 border-destructive',
              status === 'upcoming' && 'bg-muted text-muted-foreground'
            )}>
              {status === 'complete' ? (
                <Check className="h-4 w-4" />
              ) : status === 'blocked' ? (
                <Lock className="h-4 w-4" />
              ) : (
                index + 1
              )}
            </div>
            <div className="hidden sm:block">
              <p className={cn(
                'text-sm font-medium',
                status === 'complete' && 'text-success',
                status === 'current' && 'text-foreground',
                status === 'blocked' && 'text-destructive',
                status === 'upcoming' && 'text-muted-foreground'
              )}>
                {step.title}
              </p>
            </div>
            {index < steps.length - 1 && (
              <div className={cn(
                'h-px w-8 mx-2',
                status === 'complete' ? 'bg-success' : 'bg-border'
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function LaunchContent() {
  const navigate = useNavigate();
  const { currentProject, assets, campaignIntents, addCampaignIntent, addCampaign, updateCampaignIntent } = useProjectStore();
  const { toast } = useToast();

  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>('assets');
  const [isLaunching, setIsLaunching] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
  // Track launched runs to prevent duplicates
  const [launchedRunIds, setLaunchedRunIds] = useState<Set<string>>(new Set());

  // Campaign state - Objective is FIXED
  const [campaignName, setCampaignName] = useState('');
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [landingPageUrl, setLandingPageUrl] = useState('');
  const [audience, setAudience] = useState<AudienceTarget>({
    countries: ['US'],
    ageMin: 18,
    ageMax: 65,
    gender: 'all',
    languages: ['en'],
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
    objective: FIXED_OBJECTIVE,
    landingPageUrl,
    campaignName,
  });

  // ONLY show READY_FOR_LAUNCH assets (state machine requirement)
  const readyAssets = useMemo(() => 
    assets.filter(a => a.projectId === currentProject?.id && a.status === 'READY_FOR_LAUNCH'),
    [assets, currentProject?.id]
  );

  // State Machine: Compute current publish flow state
  const publishFlowValidation = usePublishFlowState({
    selectedAssetIds,
    readyAssetCount: readyAssets.length,
    selectedPlatforms,
    accountSelections,
    campaignName,
    landingPageUrl,
    countries: audience.countries,
    languages: audience.languages,
    isExecuting: isLaunching,
    isPublished: false,
  });

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
        description: `No ${platform} accounts with launch permission. Connect accounts first.`,
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

  const toggleCountry = (countryCode: string) => {
    setAudience(prev => ({
      ...prev,
      countries: prev.countries.includes(countryCode)
        ? prev.countries.filter(c => c !== countryCode)
        : [...prev.countries, countryCode]
    }));
  };

  const toggleLanguage = (langCode: string) => {
    setAudience(prev => ({
      ...prev,
      languages: prev.languages.includes(langCode)
        ? prev.languages.filter(l => l !== langCode)
        : [...prev.languages, langCode]
    }));
  };

  const totalCampaigns = calculateTotalCampaigns(accountSelections);

  // State Machine: Use computed validation for step transitions
  const canProceedFromCurrentStep = (): { allowed: boolean; message: string | null } => {
    return canTransitionStep(currentStep, getNextStep(currentStep), publishFlowValidation);
  };

  const getNextStep = (step: WizardStep): WizardStep => {
    const steps: WizardStep[] = ['assets', 'accounts', 'audience', 'preview'];
    const currentIndex = steps.indexOf(step);
    return steps[Math.min(currentIndex + 1, steps.length - 1)];
  };

  const goNext = () => {
    const transition = canProceedFromCurrentStep();
    if (!transition.allowed) {
      toast({
        title: 'Cannot Proceed',
        description: transition.message || 'Complete current step requirements first.',
        variant: 'destructive',
      });
      return;
    }
    
    const steps: WizardStep[] = ['assets', 'accounts', 'audience', 'preview'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  const goBack = () => {
    const steps: WizardStep[] = ['assets', 'accounts', 'audience', 'preview'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  // Check if this intent would be a duplicate launch
  const isDuplicateLaunch = () => {
    return campaignIntents.some(intent => 
      intent.projectId === currentProject?.id &&
      intent.status === 'launched' &&
      intent.name === campaignName &&
      JSON.stringify(intent.selectedPlatforms.sort()) === JSON.stringify(selectedPlatforms.sort()) &&
      JSON.stringify(intent.accountSelections) === JSON.stringify(accountSelections)
    );
  };

  const handleLaunchClick = () => {
    if (isDuplicateLaunch()) {
      toast({
        title: 'Duplicate Launch Prevented',
        description: 'This campaign configuration has already been launched. Create a new campaign with different settings.',
        variant: 'destructive',
      });
      return;
    }
    setShowConfirmDialog(true);
  };

  const handleLaunch = async () => {
    setShowConfirmDialog(false);
    
    if (!executionReadiness.canLaunch || !currentProject) return;

    setIsLaunching(true);

    try {
      const intentId = `intent-${Date.now()}`;
      
      // Create Campaign Intent
      const intent: CampaignIntent = {
        id: intentId,
        projectId: currentProject.id,
        name: campaignName,
        objective: FIXED_OBJECTIVE,
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

      // SINGLE API CALL: Let the Brain service handle all orchestration
      const launchResponse = await brainClient.launchRun(currentProject.id, {
        intent,
        executionReadiness: {
          status: executionReadiness.status,
          canLaunch: executionReadiness.canLaunch,
          platformStatuses: executionReadiness.platformStatuses.map(ps => ({
            platform: ps.platform,
            readyAccounts: ps.readyAccounts,
            blockedAccounts: ps.blockedAccounts,
          })),
        },
        platformConfigs,
      });

      // Track this launch run to prevent duplicates
      setLaunchedRunIds(prev => new Set([...prev, launchResponse.runId]));

      // Process launch results
      for (const platformResult of launchResponse.platformResults) {
        for (const accountResult of platformResult.accounts) {
          const isLaunched = accountResult.status === 'DECIDED_FULL' || accountResult.status === 'DECIDED_SOFT';
          const isFailed = accountResult.executionStatus === 'EXECUTION_FAILED';
          
          if (isLaunched || isFailed) {
            const campaign: Campaign = {
              id: accountResult.campaignId || `campaign-${Date.now()}-${platformResult.platform}-${accountResult.accountId}`,
              projectId: currentProject.id,
              intentId,
              name: `${campaignName} - ${accountResult.accountName}`,
              platform: platformResult.platform,
              accountId: accountResult.accountId,
              status: isFailed ? 'disapproved' : (accountResult.status === 'DECIDED_SOFT' ? 'pending' : 'active'),
              budget: parseFloat(dailyBudget),
              objective: FIXED_OBJECTIVE,
              softLaunch: accountResult.status === 'DECIDED_SOFT',
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
              approvalStatus: isFailed ? 'disapproved' : 'pending',
              disapprovalReason: accountResult.platformError,
              createdAt: new Date().toISOString(),
            };

            addCampaign(campaign);
          }
        }
      }

      // Update intent status
      updateCampaignIntent(intentId, { 
        status: launchResponse.status === 'failed' ? 'failed' : 'launched',
        launchedAt: new Date().toISOString(),
      });

      // Show results
      if (launchResponse.status === 'partial') {
        toast({
          title: 'Partial Launch',
          description: `${launchResponse.totalCampaignsLaunched} launched, ${launchResponse.totalCampaignsSkipped} skipped.`,
        });
      } else if (launchResponse.status === 'failed') {
        toast({
          title: 'Launch Failed',
          description: 'No campaigns could be launched. Check account permissions.',
          variant: 'destructive',
        });
        setIsLaunching(false);
        return;
      }

      toast({
        title: 'Campaigns Launched!',
        description: `${launchResponse.totalCampaignsLaunched} campaign(s) submitted.`,
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

  // Step: Select AI-Approved Assets
  const renderAssetsStep = () => (
    <div className="space-y-6">
      {/* Fixed Objective Display */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium text-foreground">Objective: Conversion (Sales)</p>
              <p className="text-sm text-muted-foreground">Fixed objective for all campaigns</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Asset Selection - ONLY READY_FOR_LAUNCH per state machine */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Select Ready Assets
          </CardTitle>
          <CardDescription>
            Only assets marked "Ready for Launch" can be selected. {selectedAssetIds.length} selected of {readyAssets.length} available.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {readyAssets.length === 0 ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6">
              <div className="flex items-center gap-3">
                <Lock className="h-6 w-6 text-destructive" />
                <div>
                  <p className="font-medium text-foreground">No Assets Ready for Launch</p>
                  <p className="text-sm text-muted-foreground">
                    Go to Assets page, run AI analysis, and mark approved assets as "Ready for Launch".
                  </p>
                </div>
              </div>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => navigate('/assets')}
              >
                Go to Assets
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {readyAssets.map(asset => (
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
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="default" className="bg-success/10 text-success border-success/20 text-xs gap-1">
                        <Rocket className="h-3 w-3" />
                        Ready for Launch
                      </Badge>
                    </div>
                  </div>
                  <Check className={cn('h-5 w-5', selectedAssetIds.includes(asset.id) ? 'text-primary' : 'text-transparent')} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // Step: Select Ad Accounts
  const renderAccountsStep = () => (
    <div className="space-y-6">
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Select Platforms & Accounts
          </CardTitle>
          <CardDescription>
            Choose platforms and ad accounts. Multiple accounts per platform supported.
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
                          {accounts.length} account{accounts.length !== 1 ? 's' : ''} available
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

  // Step: Audience Targeting
  const renderAudienceStep = () => (
    <div className="space-y-6">
      {/* Campaign Details */}
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

      {/* Countries - Searchable Multi-select */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Target Countries *
          </CardTitle>
          <CardDescription>Search and select one or more countries</CardDescription>
        </CardHeader>
        <CardContent>
          <MultiSelectCombobox
            options={COUNTRIES}
            selected={audience.countries}
            onChange={(countries) => setAudience(prev => ({ ...prev, countries }))}
            placeholder="Select countries..."
            searchPlaceholder="Search countries..."
            emptyMessage="No countries found."
            maxDisplayed={5}
          />
          {audience.countries.length === 0 && (
            <p className="text-sm text-destructive mt-2">Select at least one country</p>
          )}
        </CardContent>
      </Card>

      {/* Languages - Searchable Multi-select */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Languages className="h-5 w-5" />
            Target Languages *
          </CardTitle>
          <CardDescription>Search and select one or more languages</CardDescription>
        </CardHeader>
        <CardContent>
          <MultiSelectCombobox
            options={LANGUAGES}
            selected={audience.languages}
            onChange={(languages) => setAudience(prev => ({ ...prev, languages }))}
            placeholder="Select languages..."
            searchPlaceholder="Search languages..."
            emptyMessage="No languages found."
            maxDisplayed={5}
          />
          {audience.languages.length === 0 && (
            <p className="text-sm text-destructive mt-2">Select at least one language</p>
          )}
        </CardContent>
      </Card>

      {/* Demographics */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Demographics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
                onValueChange={(v) => setAudience(prev => ({ ...prev, gender: v as 'all' | 'male' | 'female' }))}
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

      {/* Soft Launch */}
      <Card className="border-border bg-card">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium text-foreground">Soft Launch Mode</p>
              <p className="text-sm text-muted-foreground">
                Start with reduced budget for testing
              </p>
            </div>
          </div>
          <Switch checked={softLaunch} onCheckedChange={setSoftLaunch} />
        </CardContent>
      </Card>
    </div>
  );

  // Step: Preview & Publish
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
              <p className="font-medium text-foreground">Conversion (Sales)</p>
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
              <p className="font-medium text-foreground">{selectedAssetIds.length} AI-approved</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audience Summary */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>Audience Targeting</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Countries</p>
            <div className="flex flex-wrap gap-1">
              {audience.countries.map(c => (
                <Badge key={c} variant="secondary">{COUNTRIES.find(x => x.value === c)?.label || c}</Badge>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Languages</p>
            <div className="flex flex-wrap gap-1">
              {audience.languages.map(l => (
                <Badge key={l} variant="secondary">{LANGUAGES.find(x => x.value === l)?.label || l}</Badge>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Demographics</p>
            <p className="font-medium text-foreground">
              {audience.gender === 'all' ? 'All genders' : audience.gender}, ages {audience.ageMin}-{audience.ageMax}
            </p>
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
                    <p>Objective: {PLATFORM_OBJECTIVE_NAMES[selection.platform][FIXED_OBJECTIVE]}</p>
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
        <h1 className="text-3xl font-bold text-foreground">Publish Campaign</h1>
        <p className="mt-1 text-muted-foreground">
          Launch AI-approved assets across your ad accounts.
        </p>
      </div>

      {/* Step Indicator with Execution Status */}
      <div className="flex items-center justify-between">
        <StepIndicator currentStep={currentStep} steps={STEPS} validation={publishFlowValidation} />
        {currentStep !== 'assets' && (
          <ExecutionStatusBadge status={executionReadiness.status} />
        )}
      </div>

      {/* State Machine Blocker Alert */}
      {publishFlowValidation.blockerMessage && currentStep !== 'preview' && (
        <Alert variant="destructive" className="border-destructive/50 bg-destructive/5">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{publishFlowValidation.blockerMessage}</span>
            {currentStep === 'assets' && readyAssets.length === 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate('/assets')}
                className="ml-4"
              >
                Go to Assets
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Step Content */}
      {currentStep === 'assets' && renderAssetsStep()}
      {currentStep === 'accounts' && renderAccountsStep()}
      {currentStep === 'audience' && renderAudienceStep()}
      {currentStep === 'preview' && renderPreviewStep()}

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button 
          variant="outline" 
          onClick={goBack}
          disabled={currentStep === 'assets' || isLaunching}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        {currentStep === 'preview' ? (
          <Button 
            variant="glow" 
            size="lg"
            onClick={handleLaunchClick}
            disabled={isLaunching || !executionReadiness.canLaunch || executionReadiness.totalCampaignsReady === 0 || isDuplicateLaunch()}
          >
            {isDuplicateLaunch() ? (
              <>
                <AlertTriangle className="mr-2 h-5 w-5" />
                Already Launched
              </>
            ) : isLaunching ? (
              <>
                <Zap className="mr-2 h-5 w-5 animate-pulse" />
                Launching...
              </>
            ) : (
              <>
                <Rocket className="mr-2 h-5 w-5" />
                Publish {executionReadiness.totalCampaignsReady} Campaign{executionReadiness.totalCampaignsReady !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        ) : (
          <Button 
            onClick={goNext}
            disabled={!canProceedFromCurrentStep().allowed || isLaunching}
          >
            {!canProceedFromCurrentStep().allowed ? (
              <>
                <Lock className="mr-2 h-4 w-4" />
                Blocked
              </>
            ) : (
              <>
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        )}
      </div>

      {/* Launch Confirmation Dialog */}
      <LaunchConfirmationDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        onConfirm={handleLaunch}
        campaignCount={executionReadiness.totalCampaignsReady}
        platforms={selectedPlatforms}
        isLaunching={isLaunching}
      />
    </div>
  );
}

export default function Launch() {
  return (
    <ProjectGate>
      <LaunchContent />
    </ProjectGate>
  );
}