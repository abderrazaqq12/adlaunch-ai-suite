import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProjectStore } from '@/stores/projectStore';
import { useToast } from '@/hooks/use-toast';
import { ProjectGate } from '@/components/common/ProjectGate';
import { AssetStatusBadge } from '@/components/common/AssetStatusBadge';
import { brainClient, BrainClientError } from '@/lib/api';
import type { Asset, AssetStatus } from '@/types';
import { getAssetStateConfig } from '@/lib/state-machines/types';
import type { ComplianceIssue } from '@/lib/api';
import { 
  Upload, 
  Video, 
  FileText, 
  Plus, 
  Trash2, 
  Sparkles,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Eye,
  Rocket,
  Shield,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';

/**
 * Asset Manager - State Machine Driven
 * 
 * States: UPLOADED → ANALYZING → APPROVED → READY_FOR_LAUNCH | BLOCKED
 * 
 * UI Rules per State:
 * - UPLOADED: Show "Run AI Analysis"
 * - ANALYZING: Spinner, disable all actions
 * - APPROVED: Show "View AI Decision", "Mark Ready for Launch"
 * - READY_FOR_LAUNCH: Show badge, can unmark
 * - BLOCKED: Show issues, "Generate Safe Variant", "Re-analyze"
 */

function AssetsContent() {
  const [activeTab, setActiveTab] = useState('videos');
  const [textContent, setTextContent] = useState('');
  const [showDecisionDialog, setShowDecisionDialog] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [complianceIssues, setComplianceIssues] = useState<ComplianceIssue[]>([]);
  const [isAnalyzingAll, setIsAnalyzingAll] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  
  const { assets, addAsset, removeAsset, updateAsset, currentProject } = useProjectStore();
  const { toast } = useToast();

  const projectAssets = assets.filter(a => a.projectId === currentProject?.id);
  const videoAssets = projectAssets.filter(a => a.type === 'video');
  const textAssets = projectAssets.filter(a => a.type === 'text');

  // State machine: Transition asset to ANALYZING
  const transitionToAnalyzing = (assetId: string) => {
    updateAsset(assetId, { status: 'ANALYZING' });
  };

  // State machine: Transition based on analysis result
  const transitionFromAnalysis = (assetId: string, passed: boolean, result: any) => {
    if (passed) {
      updateAsset(assetId, { 
        status: 'APPROVED',
        analysisResult: result,
        rejectionReasons: [],
      });
    } else {
      updateAsset(assetId, { 
        status: 'BLOCKED',
        analysisResult: result,
        rejectionReasons: result.issues?.map((i: any) => i.message) || [],
      });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'video' | 'image') => {
    const files = e.target.files;
    if (!files || !currentProject) return;

    Array.from(files).forEach(file => {
      const newAsset: Asset = {
        id: `asset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        projectId: currentProject.id,
        type,
        name: file.name,
        url: URL.createObjectURL(file),
        createdAt: new Date().toISOString(),
        status: 'UPLOADED', // Initial state
      };
      addAsset(newAsset);
    });

    toast({
      title: 'Assets Uploaded',
      description: `${files.length} file(s) uploaded. Run AI analysis to proceed.`,
    });
  };

  const handleAddText = () => {
    if (!textContent || !currentProject) return;

    const newAsset: Asset = {
      id: `asset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      projectId: currentProject.id,
      type: 'text',
      name: textContent.substring(0, 50) + (textContent.length > 50 ? '...' : ''),
      content: textContent,
      createdAt: new Date().toISOString(),
      status: 'UPLOADED', // Initial state
    };
    addAsset(newAsset);

    toast({
      title: 'Ad Copy Added',
      description: 'Run AI analysis to check compliance.',
    });

    setTextContent('');
  };

  const handleRunAnalysis = async (assetId: string) => {
    if (!currentProject) return;
    
    const asset = assets.find(a => a.id === assetId);
    if (!asset) return;

    // State transition: UPLOADED/BLOCKED → ANALYZING
    transitionToAnalyzing(assetId);

    try {
      const result = await brainClient.analyzeAsset(currentProject.id, {
        asset: {
          id: asset.id,
          type: asset.type,
          name: asset.name,
          url: asset.url,
          content: asset.content,
        },
      });

      // State transition: ANALYZING → APPROVED or BLOCKED
      transitionFromAnalysis(assetId, result.approved, {
        policyRiskScore: result.policyRiskScore,
        creativeQualityScore: result.creativeQualityScore,
        passed: result.approved,
        analyzedAt: result.analyzedAt,
        issues: result.issues.map(i => ({ 
          severity: i.severity, 
          message: i.message, 
          platform: 'google' as const 
        })),
      });

      toast({
        title: result.approved ? 'Asset Approved' : 'Asset Blocked',
        description: result.approved 
          ? `${asset.name} passed AI compliance.`
          : `${asset.name} failed. ${result.rejectionReasons.length} issue(s) found.`,
        variant: result.approved ? 'default' : 'destructive',
      });
    } catch (error) {
      // Revert to previous state on error
      updateAsset(assetId, { status: 'UPLOADED' });
      
      toast({
        title: 'Analysis Failed',
        description: error instanceof BrainClientError ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleAnalyzeAll = async () => {
    if (!currentProject) return;
    
    const unanalyzedAssets = projectAssets.filter(a => a.status === 'UPLOADED');
    if (unanalyzedAssets.length === 0) {
      toast({
        title: 'No Assets to Analyze',
        description: 'All assets have already been analyzed.',
      });
      return;
    }

    setIsAnalyzingAll(true);
    setAnalysisProgress(0);

    // Transition all to ANALYZING
    unanalyzedAssets.forEach(a => transitionToAnalyzing(a.id));

    try {
      const result = await brainClient.analyzeAssetBatch(currentProject.id, {
        assets: unanalyzedAssets.map(a => ({
          id: a.id,
          type: a.type,
          name: a.name,
          url: a.url,
          content: a.content,
        })),
      });

      for (let i = 0; i < result.results.length; i++) {
        const analysisResult = result.results[i];
        transitionFromAnalysis(analysisResult.assetId, analysisResult.approved, {
          policyRiskScore: analysisResult.policyRiskScore,
          creativeQualityScore: analysisResult.creativeQualityScore,
          passed: analysisResult.approved,
          analyzedAt: analysisResult.analyzedAt,
          issues: analysisResult.issues.map(issue => ({ 
            severity: issue.severity, 
            message: issue.message, 
            platform: 'google' as const 
          })),
        });
        setAnalysisProgress(((i + 1) / result.results.length) * 100);
      }

      toast({
        title: 'Analysis Complete',
        description: `${result.summary.approved} approved, ${result.summary.rejected} blocked.`,
      });
    } catch (error) {
      // Revert all to UPLOADED on error
      unanalyzedAssets.forEach(a => updateAsset(a.id, { status: 'UPLOADED' }));
      
      toast({
        title: 'Batch Analysis Failed',
        description: error instanceof BrainClientError ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzingAll(false);
      setAnalysisProgress(0);
    }
  };

  // State transition: APPROVED → READY_FOR_LAUNCH
  const handleMarkReadyForLaunch = (assetId: string) => {
    updateAsset(assetId, { status: 'READY_FOR_LAUNCH' });
    toast({
      title: 'Asset Ready',
      description: 'Asset is now selectable for publishing.',
    });
  };

  // State transition: READY_FOR_LAUNCH → APPROVED
  const handleUnmarkReady = (assetId: string) => {
    updateAsset(assetId, { status: 'APPROVED' });
    toast({
      title: 'Asset Unmarked',
      description: 'Asset removed from launch queue.',
    });
  };

  const handleViewDecision = (asset: Asset) => {
    setSelectedAsset(asset);
    if (asset.analysisResult?.issues) {
      setComplianceIssues(asset.analysisResult.issues.map(i => ({
        severity: i.severity,
        category: 'policy' as const,
        message: i.message,
      })));
    } else if (asset.rejectionReasons) {
      setComplianceIssues(asset.rejectionReasons.map(reason => ({
        severity: 'high' as const,
        category: 'policy' as const,
        message: reason,
      })));
    } else {
      setComplianceIssues([]);
    }
    setShowDecisionDialog(true);
  };

  const renderAssetCard = (asset: Asset) => {
    const stateConfig = getAssetStateConfig(asset.status);

    return (
      <Card key={asset.id} className={cn(
        "border-border bg-card overflow-hidden transition-all",
        asset.status === 'BLOCKED' && "border-destructive/50",
        asset.status === 'APPROVED' && "border-success/50",
        asset.status === 'READY_FOR_LAUNCH' && "border-primary/50"
      )}>
        {asset.type === 'video' && (
          <div className="aspect-video bg-muted">
            {asset.url && (
              <video 
                src={asset.url} 
                className="h-full w-full object-cover"
                controls
              />
            )}
          </div>
        )}
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <p className="truncate font-medium text-foreground">{asset.name}</p>
                <AssetStatusBadge status={asset.status} size="sm" />
              </div>
              
              {/* Analysis Scores - only show if analyzed */}
              {asset.analysisResult && (
                <div className="flex gap-3 mb-3 text-xs">
                  <div className="flex items-center gap-1">
                    <Shield className="h-3 w-3 text-muted-foreground" />
                    <span className={cn(
                      "font-medium",
                      asset.analysisResult.policyRiskScore < 30 ? "text-success" :
                      asset.analysisResult.policyRiskScore < 60 ? "text-warning" : "text-destructive"
                    )}>
                      Risk: {asset.analysisResult.policyRiskScore}%
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-muted-foreground" />
                    <span className={cn(
                      "font-medium",
                      asset.analysisResult.creativeQualityScore > 70 ? "text-success" :
                      asset.analysisResult.creativeQualityScore > 50 ? "text-warning" : "text-destructive"
                    )}>
                      Quality: {asset.analysisResult.creativeQualityScore}%
                    </span>
                  </div>
                </div>
              )}
              
              {/* State-Driven Actions */}
              <div className="flex flex-wrap gap-2 mt-3">
                {/* UPLOADED: Show Run Analysis */}
                {stateConfig.canRunAnalysis && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRunAnalysis(asset.id)}
                    className="gap-1.5"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Run AI Analysis
                  </Button>
                )}

                {/* ANALYZING: Show spinner */}
                {stateConfig.showSpinner && (
                  <Badge variant="outline" className="gap-1.5 bg-blue-500/10 text-blue-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Analyzing...
                  </Badge>
                )}

                {/* APPROVED: Show View Decision + Mark Ready */}
                {stateConfig.canViewDecision && asset.status === 'APPROVED' && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewDecision(asset)}
                      className="gap-1.5"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View AI Decision
                    </Button>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleMarkReadyForLaunch(asset.id)}
                      className="gap-1.5"
                    >
                      <Rocket className="h-3.5 w-3.5" />
                      Mark Ready for Launch
                    </Button>
                  </>
                )}

                {/* READY_FOR_LAUNCH: Show badge + unmark option */}
                {asset.status === 'READY_FOR_LAUNCH' && (
                  <>
                    <Badge variant="default" className="bg-primary/10 text-primary border-primary/20 gap-1">
                      <Rocket className="h-3 w-3" />
                      Ready for Launch
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleUnmarkReady(asset.id)}
                      className="gap-1.5 text-muted-foreground"
                    >
                      Unmark
                    </Button>
                  </>
                )}
                
                {/* BLOCKED: Show issues + Re-analyze */}
                {asset.status === 'BLOCKED' && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewDecision(asset)}
                      className="gap-1.5 text-destructive hover:text-destructive"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View Issues ({asset.rejectionReasons?.length || 0})
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRunAnalysis(asset.id)}
                      className="gap-1.5"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Re-analyze
                    </Button>
                  </>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 text-destructive hover:text-destructive"
              onClick={() => removeAsset(asset.id)}
              disabled={asset.status === 'ANALYZING'}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Stats by state
  const approvedCount = projectAssets.filter(a => a.status === 'APPROVED').length;
  const readyCount = projectAssets.filter(a => a.status === 'READY_FOR_LAUNCH').length;
  const blockedCount = projectAssets.filter(a => a.status === 'BLOCKED').length;
  const pendingCount = projectAssets.filter(a => a.status === 'UPLOADED').length;
  const analyzingCount = projectAssets.filter(a => a.status === 'ANALYZING').length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Asset Manager</h1>
          <p className="mt-1 text-muted-foreground">
            Upload assets → AI analyzes → Mark ready for launch
          </p>
        </div>
        {pendingCount > 0 && (
          <Button 
            onClick={handleAnalyzeAll} 
            className="gap-2"
            disabled={isAnalyzingAll || analyzingCount > 0}
          >
            {isAnalyzingAll ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Analyze All ({pendingCount})
              </>
            )}
          </Button>
        )}
      </div>

      {/* Analysis Progress */}
      {isAnalyzingAll && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <p className="font-medium text-foreground">AI Compliance Analysis in Progress</p>
            </div>
            <Progress value={analysisProgress} className="h-2" />
            <p className="text-sm text-muted-foreground mt-2">
              {Math.round(analysisProgress)}% complete
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stats by State */}
      {projectAssets.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-4">
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Rocket className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">{readyCount}</p>
                <p className="text-sm text-muted-foreground">Ready for Launch</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-success/20 bg-success/5">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-success">{approvedCount}</p>
                <p className="text-sm text-muted-foreground">AI Approved</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-destructive/20 bg-destructive/5">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                <XCircle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold text-destructive">{blockedCount}</p>
                <p className="text-sm text-muted-foreground">Blocked</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-warning/20 bg-warning/5">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                <Upload className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-warning">{pendingCount}</p>
                <p className="text-sm text-muted-foreground">Pending Analysis</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="videos" className="gap-2">
            <Video className="h-4 w-4" />
            Videos ({videoAssets.length})
          </TabsTrigger>
          <TabsTrigger value="text" className="gap-2">
            <FileText className="h-4 w-4" />
            Ad Copy ({textAssets.length})
          </TabsTrigger>
        </TabsList>

        {/* Video Assets Tab */}
        <TabsContent value="videos" className="mt-6 space-y-6">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle>Upload Video Ads</CardTitle>
              <CardDescription>
                Upload videos. AI will analyze for platform compliance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <input
                  type="file"
                  accept="video/*"
                  multiple
                  onChange={(e) => handleFileUpload(e, 'video')}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 p-12 transition-colors hover:border-primary/50 hover:bg-muted/50">
                  <Upload className="h-10 w-10 text-muted-foreground" />
                  <p className="mt-4 font-medium text-foreground">
                    Drop video files here or click to upload
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    MP4, MOV, or WebM up to 500MB each
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {videoAssets.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {videoAssets.map(asset => renderAssetCard(asset))}
            </div>
          )}
        </TabsContent>

        {/* Text Assets Tab */}
        <TabsContent value="text" className="mt-6 space-y-6">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle>Add Ad Copy Variations</CardTitle>
              <CardDescription>
                Create text variations. AI will check for policy compliance.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="adCopy">Ad Copy</Label>
                <Textarea
                  id="adCopy"
                  placeholder="Enter your ad headline and description..."
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  rows={4}
                />
              </div>

              <Button onClick={handleAddText} disabled={!textContent}>
                <Plus className="mr-2 h-4 w-4" />
                Add Variation
              </Button>
            </CardContent>
          </Card>

          {textAssets.length > 0 && (
            <div className="space-y-4">
              {textAssets.map(asset => {
                const stateConfig = getAssetStateConfig(asset.status);
                
                return (
                  <Card key={asset.id} className={cn(
                    "border-border bg-card",
                    asset.status === 'BLOCKED' && "border-destructive/50",
                    asset.status === 'APPROVED' && "border-success/50",
                    asset.status === 'READY_FOR_LAUNCH' && "border-primary/50"
                  )}>
                    <CardContent className="flex items-start justify-between p-4 gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <AssetStatusBadge status={asset.status} size="sm" />
                          {asset.analysisResult && (
                            <span className="text-xs text-muted-foreground">
                              Risk: {asset.analysisResult.policyRiskScore}% • Quality: {asset.analysisResult.creativeQualityScore}%
                            </span>
                          )}
                        </div>
                        <p className="text-foreground">{asset.content}</p>
                        
                        {/* State-Driven Actions */}
                        <div className="flex flex-wrap gap-2 mt-3">
                          {stateConfig.canRunAnalysis && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRunAnalysis(asset.id)}
                              className="gap-1.5"
                            >
                              <Sparkles className="h-3.5 w-3.5" />
                              Run AI Analysis
                            </Button>
                          )}

                          {stateConfig.showSpinner && (
                            <Badge variant="outline" className="gap-1.5 bg-blue-500/10 text-blue-500">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Analyzing...
                            </Badge>
                          )}

                          {asset.status === 'APPROVED' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleViewDecision(asset)}
                                className="gap-1.5"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                View AI Decision
                              </Button>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleMarkReadyForLaunch(asset.id)}
                                className="gap-1.5"
                              >
                                <Rocket className="h-3.5 w-3.5" />
                                Mark Ready
                              </Button>
                            </>
                          )}

                          {asset.status === 'READY_FOR_LAUNCH' && (
                            <>
                              <Badge variant="default" className="bg-primary/10 text-primary border-primary/20 gap-1">
                                <Rocket className="h-3 w-3" />
                                Ready for Launch
                              </Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleUnmarkReady(asset.id)}
                                className="text-muted-foreground"
                              >
                                Unmark
                              </Button>
                            </>
                          )}
                          
                          {asset.status === 'BLOCKED' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleViewDecision(asset)}
                                className="gap-1.5 text-destructive hover:text-destructive"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                View Issues
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRunAnalysis(asset.id)}
                                className="gap-1.5"
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                                Re-analyze
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-destructive hover:text-destructive"
                        onClick={() => removeAsset(asset.id)}
                        disabled={asset.status === 'ANALYZING'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* AI Decision Dialog */}
      <Dialog open={showDecisionDialog} onOpenChange={setShowDecisionDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedAsset?.status === 'BLOCKED' ? (
                <XCircle className="h-5 w-5 text-destructive" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-success" />
              )}
              AI Decision
            </DialogTitle>
            <DialogDescription>
              {selectedAsset?.status === 'BLOCKED' 
                ? 'Issues detected by AI compliance engine:'
                : 'Asset passed AI compliance check'}
            </DialogDescription>
          </DialogHeader>
          
          {selectedAsset && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 mb-4">
              <p className="font-medium text-sm text-foreground">{selectedAsset.name}</p>
              {selectedAsset.analysisResult && (
                <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                  <span>Policy Risk: {selectedAsset.analysisResult.policyRiskScore}%</span>
                  <span>Creative Quality: {selectedAsset.analysisResult.creativeQualityScore}%</span>
                </div>
              )}
            </div>
          )}
          
          {complianceIssues.length > 0 ? (
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {complianceIssues.map((issue, index) => (
                <div 
                  key={index} 
                  className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3"
                >
                  <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <Badge variant="outline" className="text-xs capitalize mb-1">
                      {issue.severity}
                    </Badge>
                    <p className="text-sm font-medium">{issue.message}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border border-success/20 bg-success/5 p-4">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <p className="text-sm text-success">No compliance issues detected</p>
            </div>
          )}
          
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowDecisionDialog(false)}>
              Close
            </Button>
            {selectedAsset?.status === 'BLOCKED' && (
              <Button 
                onClick={() => {
                  if (selectedAsset) {
                    handleRunAnalysis(selectedAsset.id);
                    setShowDecisionDialog(false);
                  }
                }}
                className="gap-1.5"
              >
                <RefreshCw className="h-4 w-4" />
                Re-analyze
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Assets() {
  return (
    <ProjectGate>
      <AssetsContent />
    </ProjectGate>
  );
}
