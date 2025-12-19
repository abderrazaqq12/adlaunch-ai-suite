import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useProjectStore } from '@/stores/projectStore';
import { useToast } from '@/hooks/use-toast';
import { ProjectGate } from '@/components/common/ProjectGate';
import { AssetStatusBadge } from '@/components/common/AssetStatusBadge';
import { PlatformBadge } from '@/components/common/PlatformBadge';
import type { Platform, AnalysisResult, FlaggedIssue, Asset, AssetStatus } from '@/types';
import { 
  Search, 
  Shield, 
  Sparkles, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Lightbulb,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

function ScoreGauge({ label, score, color }: { label: string; score: number; color: 'success' | 'warning' | 'destructive' }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className={cn(
          'text-2xl font-bold',
          color === 'success' ? 'text-success' :
          color === 'warning' ? 'text-warning' :
          'text-destructive'
        )}>
          {score}%
        </p>
      </div>
      <Progress 
        value={score} 
        className={cn(
          'h-2',
          color === 'success' ? '[&>div]:bg-success' :
          color === 'warning' ? '[&>div]:bg-warning' :
          '[&>div]:bg-destructive'
        )}
      />
    </div>
  );
}

function IssueCard({ issue }: { issue: FlaggedIssue }) {
  const severityConfig = {
    low: { color: 'text-muted-foreground', bg: 'bg-muted', label: 'Low' },
    medium: { color: 'text-warning', bg: 'bg-warning/10', label: 'Medium' },
    high: { color: 'text-destructive', bg: 'bg-destructive/10', label: 'High' },
    critical: { color: 'text-destructive', bg: 'bg-destructive/20', label: 'Critical' },
  };

  const config = severityConfig[issue.severity];

  return (
    <div className={cn('rounded-lg border border-border p-4', config.bg)}>
      <div className="flex items-start gap-3">
        <AlertTriangle className={cn('h-5 w-5 shrink-0', config.color)} />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={config.color}>
              {config.label}
            </Badge>
            <PlatformBadge platform={issue.platform} size="sm" />
          </div>
          <p className="mt-2 text-sm text-foreground">{issue.message}</p>
        </div>
      </div>
    </div>
  );
}

function AnalysisContent() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(['google', 'tiktok', 'snapchat']);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  
  const { assets, currentProject, updateAssetStatus } = useProjectStore();
  const { toast } = useToast();

  const projectAssets = assets.filter(a => a.projectId === currentProject?.id);
  const unanalyzedAssets = projectAssets.filter(a => a.status === 'UPLOADED');

  const toggleAssetSelection = (assetId: string) => {
    setSelectedAssetIds(prev =>
      prev.includes(assetId)
        ? prev.filter(id => id !== assetId)
        : [...prev, assetId]
    );
  };

  const selectAllAssets = () => {
    if (selectedAssetIds.length === unanalyzedAssets.length) {
      setSelectedAssetIds([]);
    } else {
      setSelectedAssetIds(unanalyzedAssets.map(a => a.id));
    }
  };

  const handleAnalyze = async () => {
    if (selectedAssetIds.length === 0) {
      toast({
        title: 'No Assets Selected',
        description: 'Please select at least one asset to analyze.',
        variant: 'destructive',
      });
      return;
    }

    setIsAnalyzing(true);
    setResult(null);

    try {
      // TODO: Replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Simulate analysis results for each selected asset
      selectedAssetIds.forEach(assetId => {
        const passed = Math.random() > 0.3; // 70% pass rate for demo
        const policyRiskScore = Math.floor(Math.random() * 100);
        const newStatus: AssetStatus = passed ? 'APPROVED' : 'RISKY';
        
        updateAssetStatus(assetId, newStatus, {
          policyRiskScore,
          creativeQualityScore: Math.floor(Math.random() * 40) + 60,
          passed,
          analyzedAt: new Date().toISOString(),
          issues: passed ? [] : [
            {
              severity: 'medium',
              message: 'Potential policy violation detected',
              platform: 'google',
            },
          ],
        });
      });

      // Mock overall result
      const mockResult: AnalysisResult = {
        policyRiskScore: 25,
        creativeQualityScore: 78,
        flaggedIssues: [
          {
            severity: 'medium',
            message: 'Ad copy contains potential clickbait language',
            platform: 'google',
          },
          {
            severity: 'low',
            message: 'Video aspect ratio may not be optimal for TikTok',
            platform: 'tiktok',
          },
        ],
        suggestions: [
          'Consider A/B testing different hook styles',
          'Add clearer call-to-action in the first 3 seconds',
          'Include social proof elements for better engagement',
        ],
        canLaunch: true,
      };
      
      setResult(mockResult);
      setSelectedAssetIds([]);
      
      toast({
        title: 'Analysis Complete',
        description: `Analyzed ${selectedAssetIds.length} asset(s). Check results below.`,
      });
    } catch (error) {
      toast({
        title: 'Analysis Failed',
        description: 'Failed to analyze assets. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const togglePlatform = (platform: Platform) => {
    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  const getPolicyScoreColor = (score: number) => {
    if (score <= 30) return 'success';
    if (score <= 60) return 'warning';
    return 'destructive';
  };

  const getQualityScoreColor = (score: number) => {
    if (score >= 70) return 'success';
    if (score >= 40) return 'warning';
    return 'destructive';
  };

  const approvedCount = projectAssets.filter(a => a.status === 'APPROVED').length;
  const riskyCount = projectAssets.filter(a => a.status === 'RISKY').length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Pre-Launch Analysis</h1>
        <p className="mt-1 text-muted-foreground">
          AI-powered review of your ads for policy compliance and creative quality.
        </p>
      </div>

      {/* Asset Status Summary */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="border-border bg-card">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{projectAssets.length}</p>
            <p className="text-sm text-muted-foreground">Total Assets</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-muted-foreground">{unanalyzedAssets.length}</p>
            <p className="text-sm text-muted-foreground">Pending Analysis</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-success">{approvedCount}</p>
            <p className="text-sm text-muted-foreground">Approved</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-destructive">{riskyCount}</p>
            <p className="text-sm text-muted-foreground">Risky</p>
          </CardContent>
        </Card>
      </div>

      {/* Asset Selection */}
      {unanalyzedAssets.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Select Assets to Analyze</CardTitle>
                <CardDescription>
                  Choose which assets to run through AI analysis.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={selectAllAssets}>
                {selectedAssetIds.length === unanalyzedAssets.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {unanalyzedAssets.map(asset => (
              <div
                key={asset.id}
                className={cn(
                  'flex items-center gap-4 rounded-lg border p-4 transition-colors cursor-pointer',
                  selectedAssetIds.includes(asset.id)
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                )}
                onClick={() => toggleAssetSelection(asset.id)}
              >
                <Checkbox
                  checked={selectedAssetIds.includes(asset.id)}
                  onCheckedChange={() => toggleAssetSelection(asset.id)}
                />
                <div className="flex-1">
                  <p className="font-medium text-foreground">{asset.name}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs capitalize">
                      {asset.type}
                    </Badge>
                    <AssetStatusBadge status={asset.status} size="sm" />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Analysis Configuration */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>Run Analysis</CardTitle>
          <CardDescription>
            Select platforms and analyze your assets before launch.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Platform Selection */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Target Platforms</p>
            <div className="flex gap-3">
              {(['google', 'tiktok', 'snapchat'] as Platform[]).map(platform => (
                <Badge
                  key={platform}
                  variant={selectedPlatforms.includes(platform) ? 'default' : 'outline'}
                  className={cn(
                    'cursor-pointer capitalize',
                    selectedPlatforms.includes(platform) && (
                      platform === 'google' ? 'bg-google' :
                      platform === 'tiktok' ? 'bg-gradient-to-r from-tiktok to-tiktok-pink' :
                      'bg-snapchat text-black'
                    )
                  )}
                  onClick={() => togglePlatform(platform)}
                >
                  {platform}
                </Badge>
              ))}
            </div>
          </div>

          {/* Selection Summary */}
          <div className="rounded-lg bg-secondary/30 p-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{selectedAssetIds.length}</span> asset(s) selected for analysis
            </p>
            {selectedAssetIds.length === 0 && unanalyzedAssets.length > 0 && (
              <p className="mt-1 text-sm text-warning">Select at least one asset to analyze</p>
            )}
            {unanalyzedAssets.length === 0 && projectAssets.length > 0 && (
              <p className="mt-1 text-sm text-success">All assets have been analyzed</p>
            )}
          </div>

          <Button 
            onClick={handleAnalyze} 
            disabled={isAnalyzing || selectedAssetIds.length === 0}
            size="lg"
            variant="glow"
          >
            {isAnalyzing ? (
              <>
                <Search className="mr-2 h-5 w-5 animate-pulse" />
                Analyzing...
              </>
            ) : (
              <>
                <Search className="mr-2 h-5 w-5" />
                Analyze Selected Assets
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {result && (
        <div className="space-y-6 animate-slide-up">
          {/* Score Cards */}
          <div className="grid gap-6 sm:grid-cols-2">
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Shield className="h-5 w-5 text-primary" />
                  Policy Risk Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScoreGauge 
                  label="Risk Level" 
                  score={result.policyRiskScore} 
                  color={getPolicyScoreColor(result.policyRiskScore)}
                />
                <p className="mt-3 text-xs text-muted-foreground">
                  Lower is better. Score above 50% may prevent launch.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Creative Quality Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScoreGauge 
                  label="Quality" 
                  score={result.creativeQualityScore}
                  color={getQualityScoreColor(result.creativeQualityScore)}
                />
                <p className="mt-3 text-xs text-muted-foreground">
                  Higher is better. Based on engagement prediction.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Launch Status */}
          <Card className={cn(
            'border-2',
            approvedCount > 0
              ? 'border-success/30 bg-success/5' 
              : 'border-destructive/30 bg-destructive/5'
          )}>
            <CardContent className="flex items-center justify-between p-6">
              <div className="flex items-center gap-4">
                {approvedCount > 0 ? (
                  <CheckCircle className="h-10 w-10 text-success" />
                ) : (
                  <XCircle className="h-10 w-10 text-destructive" />
                )}
                <div>
                  <p className="text-lg font-semibold text-foreground">
                    {approvedCount > 0 ? 'Ready to Launch' : 'Launch Blocked'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {approvedCount > 0 
                      ? `${approvedCount} approved asset(s) ready for launch.`
                      : 'No approved assets. Please fix risky assets or upload new ones.'}
                  </p>
                </div>
              </div>
              {approvedCount > 0 && (
                <Button asChild variant="success">
                  <Link to="/launch">
                    Proceed to Launch
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Flagged Issues */}
          {result.flaggedIssues.length > 0 && (
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  Flagged Issues
                </CardTitle>
                <CardDescription>
                  Issues that may affect ad approval or performance.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {result.flaggedIssues.map((issue, i) => (
                  <IssueCard key={i} issue={issue} />
                ))}
              </CardContent>
            </Card>
          )}

          {/* AI Suggestions */}
          {result.suggestions.length > 0 && (
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-warning" />
                  AI Suggestions
                </CardTitle>
                <CardDescription>
                  Recommendations to improve ad performance.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {result.suggestions.map((suggestion, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                        {i + 1}
                      </div>
                      <p className="text-sm text-foreground">{suggestion}</p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

export default function Analysis() {
  return (
    <ProjectGate requiredStage="ASSETS_READY">
      <AnalysisContent />
    </ProjectGate>
  );
}