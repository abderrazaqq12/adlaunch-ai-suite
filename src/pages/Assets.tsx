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
import type { Asset } from '@/types';
import type { ComplianceIssue } from '@/lib/api';
import { 
  Upload, 
  Video, 
  FileText, 
  Plus, 
  Trash2, 
  Sparkles,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Eye,
  AlertTriangle,
  Shield,
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

function AssetsContent() {
  const [activeTab, setActiveTab] = useState('videos');
  const [textContent, setTextContent] = useState('');
  const [analyzingAssets, setAnalyzingAssets] = useState<Set<string>>(new Set());
  const [showRejectionDialog, setShowRejectionDialog] = useState(false);
  const [selectedAssetForRejection, setSelectedAssetForRejection] = useState<Asset | null>(null);
  const [complianceIssues, setComplianceIssues] = useState<ComplianceIssue[]>([]);
  const [isAnalyzingAll, setIsAnalyzingAll] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  
  const { assets, addAsset, removeAsset, updateAsset, currentProject } = useProjectStore();
  const { toast } = useToast();

  const projectAssets = assets.filter(a => a.projectId === currentProject?.id);
  const videoAssets = projectAssets.filter(a => a.type === 'video');
  const textAssets = projectAssets.filter(a => a.type === 'text');

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
        status: 'UPLOADED',
      };
      addAsset(newAsset);
    });

    toast({
      title: 'Assets Uploaded',
      description: `Successfully uploaded ${files.length} file(s). Run AI analysis to approve.`,
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
      status: 'UPLOADED',
    };
    addAsset(newAsset);

    toast({
      title: 'Text Variation Added',
      description: 'Run AI analysis to approve for launch.',
    });

    setTextContent('');
  };

  const handleRunAnalysis = async (assetId: string) => {
    if (!currentProject) return;
    
    const asset = assets.find(a => a.id === assetId);
    if (!asset) return;

    setAnalyzingAssets(prev => new Set([...prev, assetId]));

    try {
      // Call the Brain API compliance engine
      const result = await brainClient.analyzeAsset(currentProject.id, {
        asset: {
          id: asset.id,
          type: asset.type,
          name: asset.name,
          url: asset.url,
          content: asset.content,
        },
      });

      if (result.approved) {
        updateAsset(assetId, { 
          status: 'APPROVED',
          analysisResult: {
            policyRiskScore: result.policyRiskScore,
            creativeQualityScore: result.creativeQualityScore,
            passed: true,
            analyzedAt: result.analyzedAt,
            issues: result.issues.map(i => ({ 
              severity: i.severity, 
              message: i.message, 
              platform: 'google' as const 
            })),
          },
          rejectionReasons: [],
        });
        toast({
          title: 'Asset Approved',
          description: `${asset.name} passed AI compliance check.`,
        });
      } else {
        updateAsset(assetId, { 
          status: 'RISKY',
          rejectionReasons: result.rejectionReasons,
          analysisResult: {
            policyRiskScore: result.policyRiskScore,
            creativeQualityScore: result.creativeQualityScore,
            passed: false,
            analyzedAt: result.analyzedAt,
            issues: result.issues.map(i => ({ 
              severity: i.severity, 
              message: i.message, 
              platform: 'google' as const 
            })),
          },
        });
        toast({
          title: 'Asset Blocked',
          description: `${asset.name} failed compliance check. ${result.rejectionReasons.length} issue(s) found.`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      const message = error instanceof BrainClientError 
        ? error.message 
        : 'Failed to analyze asset. Please try again.';
      
      toast({
        title: 'Analysis Failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setAnalyzingAssets(prev => {
        const next = new Set(prev);
        next.delete(assetId);
        return next;
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

    try {
      // Call the batch analysis endpoint
      const result = await brainClient.analyzeAssetBatch(currentProject.id, {
        assets: unanalyzedAssets.map(a => ({
          id: a.id,
          type: a.type,
          name: a.name,
          url: a.url,
          content: a.content,
        })),
      });

      // Update each asset with results
      for (let i = 0; i < result.results.length; i++) {
        const analysisResult = result.results[i];
        const asset = unanalyzedAssets.find(a => a.id === analysisResult.assetId);
        
        if (asset) {
          updateAsset(analysisResult.assetId, { 
            status: analysisResult.approved ? 'APPROVED' : 'RISKY',
            rejectionReasons: analysisResult.rejectionReasons,
            analysisResult: {
              policyRiskScore: analysisResult.policyRiskScore,
              creativeQualityScore: analysisResult.creativeQualityScore,
              passed: analysisResult.approved,
              analyzedAt: analysisResult.analyzedAt,
              issues: analysisResult.issues.map(issue => ({ 
                severity: issue.severity, 
                message: issue.message, 
                platform: 'google' as const 
              })),
            },
          });
        }
        
        setAnalysisProgress(((i + 1) / result.results.length) * 100);
      }

      toast({
        title: 'Analysis Complete',
        description: `${result.summary.approved} approved, ${result.summary.rejected} blocked out of ${result.summary.total} assets.`,
        variant: result.summary.rejected > 0 ? 'default' : 'default',
      });
    } catch (error) {
      const message = error instanceof BrainClientError 
        ? error.message 
        : 'Failed to analyze assets. Please try again.';
      
      toast({
        title: 'Batch Analysis Failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzingAll(false);
      setAnalysisProgress(0);
    }
  };

  const handleViewRejection = async (asset: Asset) => {
    if (!currentProject) return;
    
    setSelectedAssetForRejection(asset);
    
    // If we have analysis result with issues, use those
    if (asset.analysisResult?.issues && asset.analysisResult.issues.length > 0) {
      setComplianceIssues(asset.analysisResult.issues.map(i => ({
        severity: i.severity,
        category: 'policy' as const,
        message: i.message,
      })));
    } else {
      // Otherwise use rejection reasons as issues
      setComplianceIssues((asset.rejectionReasons || []).map(reason => ({
        severity: 'high' as const,
        category: 'policy' as const,
        message: reason,
      })));
    }
    
    setShowRejectionDialog(true);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-destructive bg-destructive/10 border-destructive/20';
      case 'high': return 'text-destructive bg-destructive/10 border-destructive/20';
      case 'medium': return 'text-warning bg-warning/10 border-warning/20';
      case 'low': return 'text-muted-foreground bg-muted border-border';
      default: return 'text-muted-foreground bg-muted border-border';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return <XCircle className="h-4 w-4" />;
      case 'medium':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const renderAssetCard = (asset: Asset) => {
    const isAnalyzing = analyzingAssets.has(asset.id);
    const isBlocked = asset.status === 'RISKY';
    const isApproved = asset.status === 'APPROVED';
    const needsAnalysis = asset.status === 'UPLOADED';

    return (
      <Card key={asset.id} className={cn(
        "border-border bg-card overflow-hidden transition-all",
        isBlocked && "border-destructive/50",
        isApproved && "border-success/50"
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
              
              {/* Analysis Scores */}
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
              
              {/* AI Analysis Controls */}
              <div className="flex flex-wrap gap-2 mt-3">
                {needsAnalysis && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRunAnalysis(asset.id)}
                    disabled={isAnalyzing}
                    className="gap-1.5"
                  >
                    {isAnalyzing ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5" />
                        Run AI Compliance
                      </>
                    )}
                  </Button>
                )}
                
                {isBlocked && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewRejection(asset)}
                      className="gap-1.5 text-destructive hover:text-destructive"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View Issues ({asset.rejectionReasons?.length || 0})
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRunAnalysis(asset.id)}
                      disabled={isAnalyzing}
                      className="gap-1.5"
                    >
                      <RefreshCw className={cn("h-3.5 w-3.5", isAnalyzing && "animate-spin")} />
                      Re-analyze
                    </Button>
                  </>
                )}

                {isApproved && (
                  <Badge variant="default" className="bg-success/10 text-success border-success/20 gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Ready for Launch
                  </Badge>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 text-destructive hover:text-destructive"
              onClick={() => removeAsset(asset.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const approvedCount = projectAssets.filter(a => a.status === 'APPROVED').length;
  const blockedCount = projectAssets.filter(a => a.status === 'RISKY').length;
  const pendingCount = projectAssets.filter(a => a.status === 'UPLOADED').length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Asset Manager</h1>
          <p className="mt-1 text-muted-foreground">
            Upload assets and let AI analyze them for platform compliance.
          </p>
        </div>
        {pendingCount > 0 && (
          <Button 
            onClick={handleAnalyzeAll} 
            className="gap-2"
            disabled={isAnalyzingAll}
          >
            {isAnalyzingAll ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
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
              <RefreshCw className="h-5 w-5 animate-spin text-primary" />
              <p className="font-medium text-foreground">AI Compliance Analysis in Progress</p>
            </div>
            <Progress value={analysisProgress} className="h-2" />
            <p className="text-sm text-muted-foreground mt-2">
              {Math.round(analysisProgress)}% complete
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      {projectAssets.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
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
                <AlertCircle className="h-5 w-5 text-warning" />
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
          {/* Upload Section */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle>Upload Video Ads</CardTitle>
              <CardDescription>
                Upload videos. AI will analyze for platform compliance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Upload Area */}
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

          {/* Asset Grid */}
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

          {/* Text Assets List */}
          {textAssets.length > 0 && (
            <div className="space-y-4">
              {textAssets.map(asset => (
                <Card key={asset.id} className={cn(
                  "border-border bg-card",
                  asset.status === 'RISKY' && "border-destructive/50",
                  asset.status === 'APPROVED' && "border-success/50"
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
                      
                      {/* AI Analysis Controls */}
                      <div className="flex flex-wrap gap-2 mt-3">
                        {asset.status === 'UPLOADED' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRunAnalysis(asset.id)}
                            disabled={analyzingAssets.has(asset.id)}
                            className="gap-1.5"
                          >
                            {analyzingAssets.has(asset.id) ? (
                              <>
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                Analyzing...
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-3.5 w-3.5" />
                                Run AI Compliance
                              </>
                            )}
                          </Button>
                        )}
                        
                        {asset.status === 'RISKY' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewRejection(asset)}
                              className="gap-1.5 text-destructive hover:text-destructive"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View Issues
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRunAnalysis(asset.id)}
                              disabled={analyzingAssets.has(asset.id)}
                              className="gap-1.5"
                            >
                              <RefreshCw className={cn("h-3.5 w-3.5", analyzingAssets.has(asset.id) && "animate-spin")} />
                              Re-analyze
                            </Button>
                          </>
                        )}

                        {asset.status === 'APPROVED' && (
                          <Badge variant="default" className="bg-success/10 text-success border-success/20 gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Ready for Launch
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-destructive hover:text-destructive"
                      onClick={() => removeAsset(asset.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Rejection Dialog with Detailed Issues */}
      <Dialog open={showRejectionDialog} onOpenChange={setShowRejectionDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              AI Compliance Issues
            </DialogTitle>
            <DialogDescription>
              The following issues were detected by the AI compliance engine:
            </DialogDescription>
          </DialogHeader>
          
          {/* Asset Info */}
          {selectedAssetForRejection && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 mb-4">
              <p className="font-medium text-sm text-foreground">{selectedAssetForRejection.name}</p>
              {selectedAssetForRejection.analysisResult && (
                <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                  <span>Policy Risk: {selectedAssetForRejection.analysisResult.policyRiskScore}%</span>
                  <span>Creative Quality: {selectedAssetForRejection.analysisResult.creativeQualityScore}%</span>
                </div>
              )}
            </div>
          )}
          
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {complianceIssues.map((issue, index) => (
              <div 
                key={index} 
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3",
                  getSeverityColor(issue.severity)
                )}
              >
                <div className="shrink-0 mt-0.5">
                  {getSeverityIcon(issue.severity)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs capitalize">
                      {issue.severity}
                    </Badge>
                    {issue.category && (
                      <Badge variant="secondary" className="text-xs capitalize">
                        {issue.category}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm font-medium">{issue.message}</p>
                  {issue.recommendation && (
                    <p className="text-xs text-muted-foreground mt-1">
                      💡 {issue.recommendation}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowRejectionDialog(false)}>
              Close
            </Button>
            <Button 
              onClick={() => {
                if (selectedAssetForRejection) {
                  handleRunAnalysis(selectedAssetForRejection.id);
                  setShowRejectionDialog(false);
                }
              }}
              className="gap-1.5"
            >
              <RefreshCw className="h-4 w-4" />
              Re-analyze Asset
            </Button>
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
