import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useProjectStore } from '@/stores/projectStore';
import { useToast } from '@/hooks/use-toast';
import { brainClient, BrainClientError } from '@/lib/api';
import type { Platform, AdAccountConnection, PlatformPermissions } from '@/types';
import { Check, X, AlertTriangle, Link2, ExternalLink, RefreshCw, Plus, Trash2 } from 'lucide-react';
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

function AccountItem({ 
  connection, 
  onDisconnect,
  onRefresh,
}: { 
  connection: AdAccountConnection; 
  onDisconnect: () => void;
  onRefresh: () => void;
}) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setIsRefreshing(false);
  };

  return (
    <div className="rounded-lg border border-border bg-background p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-foreground">{connection.accountName}</p>
          <p className="text-sm text-muted-foreground">ID: {connection.accountId}</p>
        </div>
        <StatusBadge status={connection.status} />
      </div>

      {/* Permission Summary */}
      <div className="grid grid-cols-3 gap-2">
        <PermissionIndicator label="Analyze" allowed={connection.permissions.canAnalyze} />
        <PermissionIndicator label="Launch" allowed={connection.permissions.canLaunch} />
        <PermissionIndicator label="Optimize" allowed={connection.permissions.canOptimize} />
      </div>

      {/* Limited Access Warning */}
      {connection.status === 'limited_access' && (
        <div className="flex items-start gap-2 rounded-md border border-warning/20 bg-warning/5 p-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Limited access. Invite an admin to unlock launch and optimization.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          className="flex-1"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={cn("mr-2 h-3 w-3", isRefreshing && "animate-spin")} />
          Refresh
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="text-destructive hover:text-destructive"
          onClick={onDisconnect}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function PlatformSection({ platform }: { platform: Platform }) {
  const [isConnecting, setIsConnecting] = useState(false);
  const { currentProject, addConnection, removeConnection, updateConnection } = useProjectStore();
  const { toast } = useToast();
  
  const details = platformDetails[platform];
  const connections = currentProject?.connections.filter(c => c.platform === platform) || [];
  const accountCount = connections.length;

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
    
    try {
      // Simulate OAuth flow - in production this would redirect to platform OAuth
      // For now, we simulate the token metadata response
      const mockTokenMetadata = {
        access_token: `mock-token-${Date.now()}`,
        refresh_token: `mock-refresh-${Date.now()}`,
        expires_in: 3600,
        scope: 'ads_management',
      };

      const accountNumber = accountCount + 1;
      const accountId = `${platform.toUpperCase()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
      const accountName = `${details.name} Account ${accountNumber}`;

      // Call Brain API to interpret permissions from token
      const permissionResult = await brainClient.interpretPermissions(currentProject.id, {
        platform,
        account: {
          id: accountId,
          name: accountName,
          tokenMetadata: mockTokenMetadata,
        },
      });

      const newConnection: AdAccountConnection = {
        id: `${platform}-${Date.now()}`,
        platform,
        accountId,
        accountName,
        status: permissionResult.status,
        permissions: permissionResult.permissions,
        connectedAt: new Date().toISOString(),
      };
      
      addConnection(currentProject.id, newConnection);

      // Write memory event
      await brainClient.memoryWrite(currentProject.id, {
        platform,
        accountId,
        event: 'launch',
        details: {
          action: 'account_connected',
          accountName,
          permissions: permissionResult.permissions,
        },
      }).catch(err => {
        console.warn('[Connections] Failed to write memory event:', err);
      });
      
      toast({
        title: 'Account Connected',
        description: `Successfully connected ${accountName}.${permissionResult.warnings?.length ? ` Warning: ${permissionResult.warnings[0]}` : ''}`,
      });
    } catch (error) {
      const message = error instanceof BrainClientError 
        ? error.message 
        : `Failed to connect ${details.name}. Please try again.`;
      
      toast({
        title: 'Connection Failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleRefresh = async (connection: AdAccountConnection) => {
    if (!currentProject) return;

    try {
      const permissionResult = await brainClient.interpretPermissions(currentProject.id, {
        platform,
        account: {
          id: connection.accountId,
          name: connection.accountName,
          tokenMetadata: { refreshed: true },
        },
      });

      updateConnection(currentProject.id, connection.id, {
        status: permissionResult.status,
        permissions: permissionResult.permissions,
      });

      toast({
        title: 'Permissions Refreshed',
        description: `Updated permissions for ${connection.accountName}.`,
      });
    } catch (error) {
      const message = error instanceof BrainClientError 
        ? error.message 
        : 'Failed to refresh permissions.';
      
      toast({
        title: 'Refresh Failed',
        description: message,
        variant: 'destructive',
      });
    }
  };

  const handleDisconnect = (connectionId: string, accountName: string) => {
    if (!currentProject) return;
    removeConnection(currentProject.id, connectionId);
    toast({
      title: 'Account Disconnected',
      description: `${accountName} has been disconnected.`,
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
              <CardTitle className="flex items-center gap-2">
                {details.name}
                {accountCount > 0 && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {accountCount} account{accountCount !== 1 ? 's' : ''}
                  </span>
                )}
              </CardTitle>
              <CardDescription className="mt-1">
                {accountCount === 0 
                  ? details.description 
                  : `${accountCount} account${accountCount !== 1 ? 's' : ''} connected`}
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connected Accounts List */}
        {connections.length > 0 && (
          <div className="space-y-3">
            {connections.map(connection => (
              <AccountItem 
                key={connection.id} 
                connection={connection}
                onDisconnect={() => handleDisconnect(connection.id, connection.accountName)}
                onRefresh={() => handleRefresh(connection)}
              />
            ))}
          </div>
        )}

        {/* Add Account Button */}
        <Button 
          onClick={handleConnect} 
          disabled={isConnecting || !currentProject}
          className="w-full"
          variant={connections.length > 0 ? 'outline' : (
            platform === 'google' ? 'google' : 
            platform === 'tiktok' ? 'tiktok' : 'snapchat'
          )}
        >
          {isConnecting ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              {connections.length > 0 ? (
                <Plus className="mr-2 h-4 w-4" />
              ) : (
                <Link2 className="mr-2 h-4 w-4" />
              )}
              {connections.length > 0 ? 'Add Another Account' : `Connect ${details.name}`}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function Connections() {
  const { currentProject } = useProjectStore();

  const totalConnections = currentProject?.connections.length || 0;
  const launchableConnections = currentProject?.connections.filter(c => c.permissions.canLaunch).length || 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Ad Account Connections</h1>
        <p className="mt-1 text-muted-foreground">
          Connect unlimited ad accounts per platform. Each account can have different permission levels.
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

      {/* Summary Stats */}
      {currentProject && totalConnections > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total Accounts</p>
              <p className="text-2xl font-bold text-foreground">{totalConnections}</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Launch Enabled</p>
              <p className="text-2xl font-bold text-success">{launchableConnections}</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Limited Access</p>
              <p className="text-2xl font-bold text-warning">
                {totalConnections - launchableConnections}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Platforms</p>
              <p className="text-2xl font-bold text-foreground">
                {new Set(currentProject?.connections.map(c => c.platform)).size}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Connection Cards */}
      <div className="grid gap-6 lg:grid-cols-3">
        <PlatformSection platform="google" />
        <PlatformSection platform="tiktok" />
        <PlatformSection platform="snapchat" />
      </div>

      {/* Help Section */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>Understanding Permissions</CardTitle>
          <CardDescription>
            Each ad account has its own permission level based on your access role
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <h4 className="font-medium text-foreground">Can Analyze</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Review ads for policy compliance and creative quality before launch.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-foreground">Can Launch</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Create campaigns and deploy ads directly. Requires elevated access.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-foreground">Can Optimize</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                AI-driven budget adjustments and bid optimization. Requires full access.
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
