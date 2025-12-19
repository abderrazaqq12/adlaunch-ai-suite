import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useProjectStore } from '@/stores/projectStore';
import { useToast } from '@/hooks/use-toast';
import { PlatformBadge } from '@/components/common/PlatformBadge';
import type { Platform, AnalysisResult, FlaggedIssue } from '@/types';
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

const mockAnalysisResult: AnalysisResult = {
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

export default function Analysis() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(['google', 'tiktok', 'snapchat']);
  
  const { assets, currentProject } = useProjectStore();
  const { toast } = useToast();

  const projectAssets = assets.filter(a => a.projectId === currentProject?.id);

  const handleAnalyze = async () => {
    if (projectAssets.length === 0) {
      toast({
        title: 'No Assets Found',
        description: 'Please upload assets before running analysis.',
        variant: 'destructive',
      });
      return;
    }

    setIsAnalyzing(true);
    setResult(null);

    // TODO: Replace with actual API call
    try {
      await new Promise(resolve => setTimeout(resolve, 3000));
      setResult(mockAnalysisResult);
      
      toast({
        title: 'Analysis Complete',
        description: result?.canLaunch 
          ? 'Your assets are ready for launch!'
          : 'Some issues need attention before launch.',
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Pre-Launch Analysis</h1>
        <p className="mt-1 text-muted-foreground">
          AI-powered review of your ads for policy compliance and creative quality.
        </p>
      </div>

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

          {/* Asset Summary */}
          <div className="rounded-lg bg-secondary/30 p-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{projectAssets.length}</span> assets will be analyzed
            </p>
          </div>

          <Button 
            onClick={handleAnalyze} 
            disabled={isAnalyzing || projectAssets.length === 0}
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
                Analyze Before Launch
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
            result.canLaunch 
              ? 'border-success/30 bg-success/5' 
              : 'border-destructive/30 bg-destructive/5'
          )}>
            <CardContent className="flex items-center justify-between p-6">
              <div className="flex items-center gap-4">
                {result.canLaunch ? (
                  <CheckCircle className="h-10 w-10 text-success" />
                ) : (
                  <XCircle className="h-10 w-10 text-destructive" />
                )}
                <div>
                  <p className="text-lg font-semibold text-foreground">
                    {result.canLaunch ? 'Ready to Launch' : 'Launch Blocked'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {result.canLaunch 
                      ? 'Your assets passed all critical checks.'
                      : 'Please resolve critical issues before launching.'}
                  </p>
                </div>
              </div>
              {result.canLaunch && (
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
