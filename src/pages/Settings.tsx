import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
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

function SettingsContent() {
  const { toast } = useToast();
  const [showBrainToken, setShowBrainToken] = useState(false);
  const [showLlmKey, setShowLlmKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className={cn(
          "border-2 transition-colors",
          isConfigured ? "border-success/50 bg-success/5" : "border-warning/50 bg-warning/5"
        )}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg",
              isConfigured ? "bg-success/10" : "bg-warning/10"
            )}>
              {isConfigured ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : (
                <AlertCircle className="h-5 w-5 text-warning" />
              )}
            </div>
            <div>
              <p className="font-medium text-foreground">Brain API</p>
              <p className="text-sm text-muted-foreground">
                {isConfigured ? 'Connected' : 'Not configured'}
              </p>
            </div>
          </CardContent>
        </Card>
        
        <Card className={cn(
          "border-2 transition-colors",
          isLlmConfigured ? "border-success/50 bg-success/5" : "border-warning/50 bg-warning/5"
        )}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg",
              isLlmConfigured ? "bg-success/10" : "bg-warning/10"
            )}>
              {isLlmConfigured ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : (
                <AlertCircle className="h-5 w-5 text-warning" />
              )}
            </div>
            <div>
              <p className="font-medium text-foreground">LLM Provider</p>
              <p className="text-sm text-muted-foreground">
                {isLlmConfigured ? `${selectedProvider?.label} - ${config.llmModel}` : 'Not configured'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

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