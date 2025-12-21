import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ProjectGate } from '@/components/common/ProjectGate';
import { 
  Key, 
  Save, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle,
  Sparkles,
  Server,
  Brain,
  ExternalLink,
  Loader2,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// LLM Provider options
const LLM_PROVIDERS = [
  { value: 'openai', label: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-5', 'gpt-5-mini'] },
  { value: 'anthropic', label: 'Anthropic', models: ['claude-sonnet-4-5', 'claude-3-5-haiku-20241022'] },
  { value: 'google', label: 'Google AI', models: ['gemini-2.5-pro', 'gemini-2.5-flash'] },
];

// Stored in localStorage for client-side config (demo purposes)
// In production, these would be stored securely via Supabase secrets
const STORAGE_KEY = 'adlaunch_api_config';

interface APIConfig {
  brainApiUrl: string;
  brainApiToken: string;
  llmProvider: string;
  llmApiKey: string;
  llmModel: string;
}

type ConnectionStatus = 'idle' | 'testing' | 'success' | 'error';

interface ConnectionState {
  brain: { status: ConnectionStatus; message?: string };
  llm: { status: ConnectionStatus; message?: string };
  aiCompliance: { status: ConnectionStatus; message?: string };
}

function SettingsContent() {
  const { toast } = useToast();
  const [showBrainToken, setShowBrainToken] = useState(false);
  const [showLlmKey, setShowLlmKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    brain: { status: 'idle' },
    llm: { status: 'idle' },
    aiCompliance: { status: 'idle' },
  });
  
  const [config, setConfig] = useState<APIConfig>({
    brainApiUrl: '',
    brainApiToken: '',
    llmProvider: 'openai',
    llmApiKey: '',
    llmModel: 'gpt-4o-mini',
  });

  // Load config from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setConfig(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error('Failed to parse stored config:', e);
      }
    }
  }, []);

  const testBrainConnection = async () => {
    if (!config.brainApiUrl || !config.brainApiToken) {
      toast({
        title: 'Missing Configuration',
        description: 'Please enter Brain API URL and token first.',
        variant: 'destructive',
      });
      return;
    }

    setConnectionState(prev => ({ ...prev, brain: { status: 'testing' } }));

    try {
      const response = await fetch(`${config.brainApiUrl}/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.brainApiToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setConnectionState(prev => ({ 
          ...prev, 
          brain: { status: 'success', message: 'Connection successful!' } 
        }));
        toast({
          title: 'Brain API Connected',
          description: 'Successfully connected to the Brain API.',
        });
      } else {
        const errorText = await response.text();
        setConnectionState(prev => ({ 
          ...prev, 
          brain: { status: 'error', message: `Error: ${response.status} - ${errorText}` } 
        }));
        toast({
          title: 'Connection Failed',
          description: `Could not connect: ${response.status}`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setConnectionState(prev => ({ 
        ...prev, 
        brain: { status: 'error', message } 
      }));
      toast({
        title: 'Connection Failed',
        description: message,
        variant: 'destructive',
      });
    }
  };

  const testAiComplianceConnection = async () => {
    setConnectionState(prev => ({ ...prev, aiCompliance: { status: 'testing' } }));

    try {
      const response = await fetch('https://fzngibjbhrirkdbpxmii.supabase.co/functions/v1/analyze-asset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          asset: {
            id: 'test-asset',
            type: 'text',
            name: 'Connection Test',
            content: 'This is a test advertisement for compliance check.',
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setConnectionState(prev => ({ 
          ...prev, 
          aiCompliance: { 
            status: 'success', 
            message: `Connected! Score: ${data.creativeQualityScore}/100` 
          } 
        }));
        toast({
          title: 'AI Compliance Connected',
          description: 'Successfully connected to Lovable AI Gateway.',
        });
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        setConnectionState(prev => ({ 
          ...prev, 
          aiCompliance: { status: 'error', message: errorData.error || `HTTP ${response.status}` } 
        }));
        toast({
          title: 'Connection Failed',
          description: errorData.error || 'Could not connect to AI service.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setConnectionState(prev => ({ 
        ...prev, 
        aiCompliance: { status: 'error', message } 
      }));
      toast({
        title: 'Connection Failed',
        description: message,
        variant: 'destructive',
      });
    }
  };

  const testLlmConnection = async () => {
    if (!config.llmApiKey) {
      toast({
        title: 'Missing API Key',
        description: 'Please enter your LLM API key first.',
        variant: 'destructive',
      });
      return;
    }

    setConnectionState(prev => ({ ...prev, llm: { status: 'testing' } }));

    try {
      let testUrl = '';
      let headers: Record<string, string> = {};

      switch (config.llmProvider) {
        case 'openai':
          testUrl = 'https://api.openai.com/v1/models';
          headers = { 'Authorization': `Bearer ${config.llmApiKey}` };
          break;
        case 'anthropic':
          testUrl = 'https://api.anthropic.com/v1/models';
          headers = { 
            'x-api-key': config.llmApiKey,
            'anthropic-version': '2023-06-01',
          };
          break;
        case 'google':
          testUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${config.llmApiKey}`;
          break;
        default:
          throw new Error('Unknown provider');
      }

      const response = await fetch(testUrl, {
        method: 'GET',
        headers,
      });

      if (response.ok) {
        setConnectionState(prev => ({ 
          ...prev, 
          llm: { status: 'success', message: 'API key verified!' } 
        }));
        toast({
          title: 'LLM Connected',
          description: `Successfully connected to ${LLM_PROVIDERS.find(p => p.value === config.llmProvider)?.label}.`,
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || `HTTP ${response.status}`;
        setConnectionState(prev => ({ 
          ...prev, 
          llm: { status: 'error', message: errorMessage } 
        }));
        toast({
          title: 'Connection Failed',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setConnectionState(prev => ({ 
        ...prev, 
        llm: { status: 'error', message } 
      }));
      toast({
        title: 'Connection Failed',
        description: message,
        variant: 'destructive',
      });
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      // Store in localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      
      // Note: In a production app, we'd call an edge function to store these securely
      // For now, we use localStorage for the demo
      
      toast({
        title: 'Settings Saved',
        description: 'Your API configuration has been saved.',
      });
    } catch (error) {
      toast({
        title: 'Save Failed',
        description: 'Could not save settings. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const selectedProvider = LLM_PROVIDERS.find(p => p.value === config.llmProvider);
  const isConfigured = config.brainApiUrl && config.brainApiToken;
  const isLlmConfigured = config.llmApiKey && config.llmModel;

  const getStatusIcon = (status: ConnectionStatus) => {
    switch (status) {
      case 'testing':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Zap className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Configure API connections for the AI Brain and LLM providers.
        </p>
      </div>

      {/* Status Overview */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* AI Compliance Card */}
        <Card className={cn(
          "border-2 transition-colors",
          connectionState.aiCompliance.status === 'success' ? "border-success/50 bg-success/5" :
          connectionState.aiCompliance.status === 'error' ? "border-destructive/50 bg-destructive/5" :
          "border-primary/50 bg-primary/5"
        )}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg",
              connectionState.aiCompliance.status === 'success' ? "bg-success/10" :
              connectionState.aiCompliance.status === 'error' ? "bg-destructive/10" :
              "bg-primary/10"
            )}>
              {connectionState.aiCompliance.status === 'success' ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : connectionState.aiCompliance.status === 'error' ? (
                <AlertCircle className="h-5 w-5 text-destructive" />
              ) : (
                <Sparkles className="h-5 w-5 text-primary" />
              )}
            </div>
            <div>
              <p className="font-medium text-foreground">AI Compliance</p>
              <p className="text-sm text-muted-foreground">
                {connectionState.aiCompliance.status === 'success' ? 'Connected' :
                 connectionState.aiCompliance.status === 'error' ? 'Failed' :
                 'Lovable AI Gateway'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Brain API Card */}
        <Card className={cn(
          "border-2 transition-colors",
          connectionState.brain.status === 'success' ? "border-success/50 bg-success/5" :
          connectionState.brain.status === 'error' ? "border-destructive/50 bg-destructive/5" :
          isConfigured ? "border-primary/50 bg-primary/5" : "border-warning/50 bg-warning/5"
        )}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg",
              connectionState.brain.status === 'success' ? "bg-success/10" :
              connectionState.brain.status === 'error' ? "bg-destructive/10" :
              isConfigured ? "bg-primary/10" : "bg-warning/10"
            )}>
              {connectionState.brain.status === 'success' ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : connectionState.brain.status === 'error' ? (
                <AlertCircle className="h-5 w-5 text-destructive" />
              ) : isConfigured ? (
                <CheckCircle2 className="h-5 w-5 text-primary" />
              ) : (
                <AlertCircle className="h-5 w-5 text-warning" />
              )}
            </div>
            <div>
              <p className="font-medium text-foreground">Brain API</p>
              <p className="text-sm text-muted-foreground">
                {connectionState.brain.status === 'success' ? 'Verified' :
                 connectionState.brain.status === 'error' ? 'Failed' :
                 isConfigured ? 'Configured' : 'Not configured'}
              </p>
            </div>
          </CardContent>
        </Card>
        
        {/* LLM Provider Card */}
        <Card className={cn(
          "border-2 transition-colors",
          connectionState.llm.status === 'success' ? "border-success/50 bg-success/5" :
          connectionState.llm.status === 'error' ? "border-destructive/50 bg-destructive/5" :
          isLlmConfigured ? "border-primary/50 bg-primary/5" : "border-warning/50 bg-warning/5"
        )}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg",
              connectionState.llm.status === 'success' ? "bg-success/10" :
              connectionState.llm.status === 'error' ? "bg-destructive/10" :
              isLlmConfigured ? "bg-primary/10" : "bg-warning/10"
            )}>
              {connectionState.llm.status === 'success' ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : connectionState.llm.status === 'error' ? (
                <AlertCircle className="h-5 w-5 text-destructive" />
              ) : isLlmConfigured ? (
                <CheckCircle2 className="h-5 w-5 text-primary" />
              ) : (
                <AlertCircle className="h-5 w-5 text-warning" />
              )}
            </div>
            <div>
              <p className="font-medium text-foreground">LLM Provider</p>
              <p className="text-sm text-muted-foreground">
                {connectionState.llm.status === 'success' ? `${selectedProvider?.label} verified` :
                 connectionState.llm.status === 'error' ? 'Failed' :
                 isLlmConfigured ? `${selectedProvider?.label} - ${config.llmModel}` : 'Not configured'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Compliance Configuration (Lovable AI) */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI Compliance Analysis
          </CardTitle>
          <CardDescription>
            Powered by Lovable AI Gateway - analyzes assets for advertising policy compliance across Google, TikTok, and Snapchat.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-success/20 bg-success/5 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Pre-configured & Ready</p>
                <p className="text-sm text-muted-foreground mt-1">
                  AI compliance analysis is automatically configured using Lovable AI Gateway. No API keys required.
                </p>
              </div>
            </div>
          </div>

          {/* Test Connection Button */}
          <div className="flex items-center gap-3 pt-2">
            <Button 
              variant="outline" 
              onClick={testAiComplianceConnection}
              disabled={connectionState.aiCompliance.status === 'testing'}
              className="gap-2"
            >
              {getStatusIcon(connectionState.aiCompliance.status)}
              {connectionState.aiCompliance.status === 'testing' ? 'Testing...' : 'Test AI Connection'}
            </Button>
            {connectionState.aiCompliance.message && (
              <span className={cn(
                "text-sm",
                connectionState.aiCompliance.status === 'success' ? "text-success" : "text-destructive"
              )}>
                {connectionState.aiCompliance.message}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Brain API Configuration */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Brain API Configuration
          </CardTitle>
          <CardDescription>
            Connect to the AdLaunch Brain service for AI compliance, decisions, and campaign orchestration.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="brainUrl">Brain API URL</Label>
            <div className="relative">
              <Server className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="brainUrl"
                type="url"
                placeholder="https://brain-api.adlaunch.ai"
                value={config.brainApiUrl}
                onChange={(e) => setConfig(prev => ({ ...prev, brainApiUrl: e.target.value }))}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="brainToken">API Token</Label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="brainToken"
                type={showBrainToken ? 'text' : 'password'}
                placeholder="Enter your Brain API token"
                value={config.brainApiToken}
                onChange={(e) => setConfig(prev => ({ ...prev, brainApiToken: e.target.value }))}
                className="pl-10 pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                onClick={() => setShowBrainToken(!showBrainToken)}
              >
                {showBrainToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Your API token for authenticating with the Brain service.
            </p>
          </div>

          {/* Test Connection Button */}
          <div className="flex items-center gap-3 pt-2">
            <Button 
              variant="outline" 
              onClick={testBrainConnection}
              disabled={connectionState.brain.status === 'testing' || !config.brainApiUrl || !config.brainApiToken}
              className="gap-2"
            >
              {getStatusIcon(connectionState.brain.status)}
              {connectionState.brain.status === 'testing' ? 'Testing...' : 'Test Connection'}
            </Button>
            {connectionState.brain.message && (
              <span className={cn(
                "text-sm",
                connectionState.brain.status === 'success' ? "text-success" : "text-destructive"
              )}>
                {connectionState.brain.message}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* LLM Provider Configuration */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            LLM Provider Configuration
          </CardTitle>
          <CardDescription>
            Configure the large language model provider for AI-powered features.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="llmProvider">Provider</Label>
            <Select 
              value={config.llmProvider} 
              onValueChange={(v) => {
                const provider = LLM_PROVIDERS.find(p => p.value === v);
                setConfig(prev => ({ 
                  ...prev, 
                  llmProvider: v,
                  llmModel: provider?.models[0] || ''
                }));
                // Reset connection state when provider changes
                setConnectionState(prev => ({ ...prev, llm: { status: 'idle' } }));
              }}
            >
              <SelectTrigger id="llmProvider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LLM_PROVIDERS.map(provider => (
                  <SelectItem key={provider.value} value={provider.value}>
                    {provider.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="llmModel">Model</Label>
            <Select 
              value={config.llmModel} 
              onValueChange={(v) => setConfig(prev => ({ ...prev, llmModel: v }))}
            >
              <SelectTrigger id="llmModel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {selectedProvider?.models.map(model => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="llmKey">API Key</Label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="llmKey"
                type={showLlmKey ? 'text' : 'password'}
                placeholder={`Enter your ${selectedProvider?.label || 'LLM'} API key`}
                value={config.llmApiKey}
                onChange={(e) => setConfig(prev => ({ ...prev, llmApiKey: e.target.value }))}
                className="pl-10 pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                onClick={() => setShowLlmKey(!showLlmKey)}
              >
                {showLlmKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Provider-specific help */}
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-sm text-muted-foreground">
              {config.llmProvider === 'openai' && (
                <>Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">OpenAI Dashboard <ExternalLink className="h-3 w-3" /></a></>
              )}
              {config.llmProvider === 'anthropic' && (
                <>Get your API key from <a href="https://console.anthropic.com/account/keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Anthropic Console <ExternalLink className="h-3 w-3" /></a></>
              )}
              {config.llmProvider === 'google' && (
                <>Get your API key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Google AI Studio <ExternalLink className="h-3 w-3" /></a></>
              )}
            </p>
          </div>

          {/* Test Connection Button */}
          <div className="flex items-center gap-3 pt-2">
            <Button 
              variant="outline" 
              onClick={testLlmConnection}
              disabled={connectionState.llm.status === 'testing' || !config.llmApiKey}
              className="gap-2"
            >
              {getStatusIcon(connectionState.llm.status)}
              {connectionState.llm.status === 'testing' ? 'Testing...' : 'Test Connection'}
            </Button>
            {connectionState.llm.message && (
              <span className={cn(
                "text-sm",
                connectionState.llm.status === 'success' ? "text-success" : "text-destructive"
              )}>
                {connectionState.llm.message}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving} size="lg" className="gap-2">
          {isSaving ? (
            <>Saving...</>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Configuration
            </>
          )}
        </Button>
      </div>

      {/* Security Notice */}
      <Card className="border-warning/20 bg-warning/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Security Notice</p>
              <p className="text-sm text-muted-foreground mt-1">
                API keys are stored locally in your browser. For production use, configure secure storage via Supabase Edge Function secrets.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Settings() {
  return (
    <ProjectGate>
      <SettingsContent />
    </ProjectGate>
  );
}