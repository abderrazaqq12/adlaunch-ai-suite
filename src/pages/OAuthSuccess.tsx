/**
 * OAuth Success Page
 * Displayed after successful OAuth callback
 */

import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';
import { PLATFORM_LABELS, Platform } from '@/hooks/useAdAccounts';

export function OAuthSuccess() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const platform = searchParams.get('platform') as Platform | null;
    const accountName = searchParams.get('accountName');
    const connectionId = searchParams.get('connectionId');

    // Get return URL or default to home
    const returnUrl = sessionStorage.getItem('oauth_return_url') || '/';

    useEffect(() => {
        // Clear the stored return URL
        sessionStorage.removeItem('oauth_return_url');

        // Auto-redirect after 3 seconds
        const timeout = setTimeout(() => {
            navigate(returnUrl);
        }, 3000);

        return () => clearTimeout(timeout);
    }, [navigate, returnUrl]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                        <CheckCircle2 className="h-10 w-10 text-green-600" />
                    </div>
                    <CardTitle className="text-2xl">Connected Successfully!</CardTitle>
                    <CardDescription>
                        Your {platform ? PLATFORM_LABELS[platform] : 'ad'} account has been connected.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-center">
                    {accountName && (
                        <p className="text-sm text-muted-foreground">
                            Account: <strong>{accountName}</strong>
                        </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                        Redirecting you back automatically...
                    </p>
                    <Button onClick={() => navigate(returnUrl)} className="w-full">
                        Continue
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}

export default OAuthSuccess;
