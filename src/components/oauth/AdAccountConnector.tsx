/**
 * AdAccountConnector Component
 * Displays connected ad accounts and allows connecting new ones
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Check, RefreshCw, Unlink, ExternalLink, Loader2 } from 'lucide-react';
import {
    useAdAccounts,
    Platform,
    PLATFORM_LABELS,
    STATUS_LABELS,
    STATUS_COLORS,
    ConnectedAdAccount
} from '@/hooks/useAdAccounts';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface AdAccountConnectorProps {
    projectId: string;
    onConnectionChange?: () => void;
}

const PLATFORMS: Platform[] = ['google', 'tiktok', 'snapchat'];

const PlatformIcon = ({ platform }: { platform: Platform }) => {
    switch (platform) {
        case 'google':
            return (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
            );
        case 'tiktok':
            return (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                </svg>
            );
        case 'snapchat':
            return (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#FFFC00">
                    <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.165-.088.344-.104.464-.104.182 0 .359.029.509.09.45.149.734.479.734.838.015.449-.39.839-1.213 1.168-.089.029-.209.075-.344.119-.45.135-1.139.36-1.333.81-.09.224-.061.524.12.868l.015.015c.06.136 1.526 3.475 4.791 4.014.255.044.435.27.42.509 0 .075-.015.149-.045.225-.24.569-1.273.988-3.146 1.271-.059.091-.12.375-.164.57-.029.179-.074.36-.134.553-.076.271-.27.405-.555.405h-.03c-.135 0-.313-.031-.538-.074-.36-.075-.765-.135-1.273-.135-.3 0-.599.015-.913.074-.6.104-1.123.464-1.723.884-.853.599-1.826 1.288-3.294 1.288-.06 0-.119-.015-.18-.015h-.149c-1.468 0-2.427-.675-3.279-1.288-.599-.42-1.107-.779-1.707-.884-.314-.045-.629-.074-.928-.074-.54 0-.958.089-1.272.149-.211.043-.391.074-.54.074-.374 0-.523-.224-.583-.42-.061-.192-.09-.389-.135-.567-.046-.181-.105-.494-.166-.57-1.918-.222-2.95-.642-3.189-1.226-.031-.063-.052-.15-.055-.225-.015-.243.165-.465.42-.509 3.264-.54 4.73-3.879 4.791-4.02l.016-.029c.18-.345.224-.645.119-.869-.195-.434-.884-.658-1.332-.809-.121-.029-.24-.074-.346-.119-.809-.314-1.214-.705-1.199-1.168 0-.359.285-.69.734-.838.165-.061.343-.09.524-.09.165 0 .329.03.465.104.382.165.741.284 1.033.301.22.015.359-.061.403-.091-.007-.165-.018-.331-.029-.51 0-.03 0-.044-.003-.06-.104-1.627-.229-3.653.3-4.847C7.859 1.07 11.216.793 12.206.793z" />
                </svg>
            );
    }
};

export function AdAccountConnector({ projectId, onConnectionChange }: AdAccountConnectorProps) {
    const {
        accounts,
        isLoading,
        connect,
        refresh,
        revoke,
        isConnecting,
        isRefreshing,
        isRevoking,
        isPlatformConnected
    } = useAdAccounts(projectId);

    const [accountToDisconnect, setAccountToDisconnect] = useState<ConnectedAdAccount | null>(null);

    const handleConnect = (platform: Platform) => {
        connect(platform, projectId);
    };

    const handleRefresh = (connectionId: string) => {
        refresh(connectionId);
    };

    const handleDisconnect = () => {
        if (accountToDisconnect) {
            revoke(accountToDisconnect.id);
            setAccountToDisconnect(null);
            onConnectionChange?.();
        }
    };

    if (isLoading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Ad Accounts</CardTitle>
                <CardDescription>
                    Connect your ad platform accounts to launch and manage campaigns
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Platform Connection Buttons */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {PLATFORMS.map((platform) => {
                        const isConnected = isPlatformConnected(platform);
                        const connectedAccounts = accounts.filter(a => a.platform === platform);

                        return (
                            <div
                                key={platform}
                                className="flex flex-col rounded-lg border p-4 space-y-3"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <PlatformIcon platform={platform} />
                                        <span className="font-medium">{PLATFORM_LABELS[platform]}</span>
                                    </div>
                                    {isConnected && (
                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                            <Check className="w-3 h-3 mr-1" />
                                            Connected
                                        </Badge>
                                    )}
                                </div>

                                {connectedAccounts.length > 0 ? (
                                    <div className="space-y-2">
                                        {connectedAccounts.map((account) => (
                                            <div
                                                key={account.id}
                                                className="flex items-center justify-between text-sm bg-muted/50 rounded px-2 py-1"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[account.status]}`} />
                                                    <span className="truncate max-w-[120px]">{account.accountName}</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    {account.needsReconnect && (
                                                        <AlertCircle className="w-3 h-3 text-red-500" />
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 w-6 p-0"
                                                        onClick={() => handleRefresh(account.id)}
                                                        disabled={isRefreshing}
                                                    >
                                                        <RefreshCw className="w-3 h-3" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 w-6 p-0 text-red-500 hover:text-red-600"
                                                        onClick={() => setAccountToDisconnect(account)}
                                                        disabled={isRevoking}
                                                    >
                                                        <Unlink className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <Button
                                        variant="outline"
                                        className="w-full"
                                        onClick={() => handleConnect(platform)}
                                        disabled={isConnecting}
                                    >
                                        {isConnecting ? (
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        ) : (
                                            <ExternalLink className="w-4 h-4 mr-2" />
                                        )}
                                        Connect {PLATFORM_LABELS[platform]}
                                    </Button>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Disconnect Confirmation Dialog */}
                <AlertDialog open={!!accountToDisconnect} onOpenChange={() => setAccountToDisconnect(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Disconnect Account?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to disconnect <strong>{accountToDisconnect?.accountName}</strong>?
                                You will need to reconnect to manage campaigns on this account.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleDisconnect}
                                className="bg-red-500 hover:bg-red-600"
                            >
                                Disconnect
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardContent>
        </Card>
    );
}

export default AdAccountConnector;
