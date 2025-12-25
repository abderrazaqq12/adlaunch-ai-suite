/**
 * OAuth Error Page
 * Displayed after OAuth failure
 */

import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { PLATFORM_LABELS, Platform } from '@/hooks/useAdAccounts';

const ERROR_MESSAGES: Record<string, string> = {
    INVALID_STATE: 'The authorization session expired. Please try connecting again.',
    NO_PENDING_CONNECTION: 'No pending connection found. Please try connecting again.',
    NO_AD_ACCOUNTS: 'No ad accounts found. Please ensure you have access to at least one ad account.',
    TOKEN_EXCHANGE_FAILED: 'Failed to complete authorization. Please try again.',
    invalid_platform: 'Invalid platform specified.',
    missing_parameters: 'Missing required parameters from the authorization server.',
    callback_failed: 'Something went wrong during the callback. Please try again.',
};

export function OAuthError() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const platform = searchParams.get('platform') as Platform | null;
    const errorCode = searchParams.get('code') || searchParams.get('error');
    const errorMessage = searchParams.get('error') || ERROR_MESSAGES[errorCode || ''] || 'An unexpected error occurred.';

    // Get return URL or default to home
    const returnUrl = sessionStorage.getItem('oauth_return_url') || '/';

    const handleRetry = () => {
        // Navigate back to try again
        sessionStorage.removeItem('oauth_return_url');
        navigate(returnUrl);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                        <AlertCircle className="h-10 w-10 text-red-600" />
                    </div>
                    <CardTitle className="text-2xl">Connection Failed</CardTitle>
                    <CardDescription>
                        {platform
                            ? `Failed to connect your ${PLATFORM_LABELS[platform]} account.`
                            : 'Failed to connect your ad account.'}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
                        {errorMessage}
                    </div>

                    {errorCode && (
                        <p className="text-xs text-center text-muted-foreground">
                            Error code: {errorCode}
                        </p>
                    )}

                    <div className="flex flex-col gap-2">
                        <Button onClick={handleRetry} className="w-full">
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Try Again
                        </Button>
                        <Button variant="outline" onClick={() => navigate('/')} className="w-full">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Home
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default OAuthError;
