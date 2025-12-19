import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useProjectStore } from '@/stores/projectStore';
import { useToast } from '@/hooks/use-toast';
import type { Platform, AdAccountConnection, PlatformPermissions } from '@/types';
import { Check, X, AlertTriangle, Link2, ExternalLink, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const platformDetails: Record<Platform, { 
  name: string; 
  icon: string;
  gradient: string;
  description: string;
}> = {
  google: {
    name: 'Google Ads',
    icon: '🔍',
    gradient: 'from-google via-google-red to-google-yellow',
    description: 'Connect your Google Ads account to launch and optimize search, display, and YouTube campaigns.',
  },
  tiktok: {
    name: 'TikTok Ads',
    icon: '🎵',
    gradient: 'from-tiktok to-tiktok-pink',
    description: 'Connect your TikTok Ads Manager to reach Gen Z and Millennial audiences with video ads.',
  },
  snapchat: {
    name: 'Snapchat Ads',
    icon: '👻',
    gradient: 'from-snapchat to-yellow-300',
    description: 'Connect your Snapchat Ads account to create immersive AR and video experiences.',
  },
};

function PermissionIndicator({ label, allowed }: { label: string; allowed: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {allowed ? (
        <Check className="h-4 w-4 text-success" />
      ) : (
        <X className="h-4 w-4 text-destructive" />
      )}
      <span className={cn(
        'text-sm',
        allowed ? 'text-foreground' : 'text-muted-foreground'
      )}>
        {label}
      </span>
    </div>
  );
}

function ConnectionCard({ platform }: { platform: Platform }) {
  const [isConnecting, setIsConnecting] = useState(false);
  const { currentProject, addConnection } = useProjectStore();
  const { toast } = useToast();
  
  const details = platformDetails[platform];
  const connection = currentProject?.connections.find(c => c.platform === platform);

  const handleConnect = async () => {
    if (!currentProject) {
      toast({
        title: 'No Project Selected',
        description: 'Please select a project first.',
        variant: 'destructive',
      });
      return;
    }

    setIsConnecting(true);
    
    // TODO: Replace with actual OAuth flow
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simulated connection response - replace with real API
      const mockConnection: AdAccountConnection = {
        id: `${platform}-${Date.now()}`,
        platform,
        accountId: `${platform.toUpperCase()}-123456`,
        accountName: `My ${details.name} Account`,
        status: Math.random() > 0.3 ? 'connected' : 'limited_access',
        permissions: {
          canAnalyze: true,
          canLaunch: Math.random() > 0.3,
          canOptimize: Math.random() > 0.5,
        },
        connectedAt: new Date().toISOString(),
      };
      
      addConnection(currentProject.id, mockConnection);
      
      toast({
        title: 'Account Connected',
        description: `Successfully connected your ${details.name} account.`,
      });
    } catch (error) {
      toast({
        title: 'Connection Failed',
        description: `Failed to connect ${details.name}. Please try again.`,
        variant: 'destructive',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    toast({
      title: 'Disconnected',
      description: `${details.name} account has been disconnected.`,
    });
  };

  return (
    <Card className="border-border bg-card overflow-hidden">
      <div className={cn('h-2 bg-gradient-to-r', details.gradient)} />
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{details.icon}</span>
            <div>
              <CardTitle>{details.name}</CardTitle>
              <CardDescription className="mt-1">
                {connection 
                  ? `Connected: ${connection.accountName}`
                  : details.description}
              </CardDescription>
            </div>
          </div>
          {connection && <StatusBadge status={connection.status} />}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {connection ? (
          <>
            {/* Permission Summary */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Permissions</p>
              <div className="grid gap-2">
                <PermissionIndicator label="Can Analyze" allowed={connection.permissions.canAnalyze} />
                <PermissionIndicator label="Can Launch" allowed={connection.permissions.canLaunch} />
                <PermissionIndicator label="Can Optimize" allowed={connection.permissions.canOptimize} />
              </div>
            </div>

            {/* Limited Access Warning */}
            {connection.status === 'limited_access' && (
              <div className="flex items-start gap-3 rounded-lg border border-warning/20 bg-warning/5 p-4">
                <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
                <div>
                  <p className="font-medium text-foreground">Limited Access</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Some features are unavailable. Invite an admin to unlock automated launch and optimization.
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <Button variant="outline" size="sm" className="flex-1">
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Permissions
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="text-destructive hover:text-destructive"
                onClick={handleDisconnect}
              >
                Disconnect
              </Button>
            </div>
          </>
        ) : (
          <Button 
            onClick={handleConnect} 
            disabled={isConnecting || !currentProject}
            className="w-full"
            variant={platform === 'google' ? 'google' : platform === 'tiktok' ? 'tiktok' : 'snapchat'}
          >
            {isConnecting ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Link2 className="mr-2 h-4 w-4" />
                Connect {details.name}
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function Connections() {
  const { currentProject } = useProjectStore();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Ad Account Connections</h1>
        <p className="mt-1 text-muted-foreground">
          Connect your advertising accounts to enable campaign launch and optimization.
        </p>
      </div>

      {/* No Project Warning */}
      {!currentProject && (
        <div className="flex items-center gap-3 rounded-lg border border-warning/20 bg-warning/5 p-4">
          <AlertTriangle className="h-5 w-5 text-warning" />
          <div>
            <p className="font-medium text-foreground">No Project Selected</p>
            <p className="text-sm text-muted-foreground">
              Please create or select a project before connecting ad accounts.
            </p>
          </div>
        </div>
      )}

      {/* Connection Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <ConnectionCard platform="google" />
        <ConnectionCard platform="tiktok" />
        <ConnectionCard platform="snapchat" />
      </div>

      {/* Help Section */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>Need Help?</CardTitle>
          <CardDescription>
            Understanding permissions and access levels
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <h4 className="font-medium text-foreground">Can Analyze</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Allows AdLaunch AI to review your ads for policy compliance and creative quality before launch.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-foreground">Can Launch</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Enables automated campaign creation and ad deployment directly from AdLaunch AI.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-foreground">Can Optimize</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Allows AI-driven budget adjustments, bid optimization, and creative modifications.
              </p>
            </div>
          </div>
          <Button variant="outline" asChild>
            <a href="https://docs.adlaunch.ai/connections" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              View Documentation
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
