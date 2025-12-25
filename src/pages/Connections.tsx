import { useProjectStore } from '@/stores/projectStore';
import { AdAccountConnector } from '@/components/oauth/AdAccountConnector';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Connections() {
  const { currentProject } = useProjectStore();

  if (!currentProject) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Select a project to manage connections</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Ad Accounts</h1>
        <p className="mt-1 text-muted-foreground">
          Connect execution endpoints. Accounts are pipes for campaign delivery.
        </p>
      </div>

      <div className="grid gap-6">
        <AdAccountConnector projectId={currentProject.id} />
      </div>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>About Connections</CardTitle>
          <CardDescription>
            AdLaunch AI uses the "One App" model. You connect your ad accounts safely via our SaaS apps.
            Tokens are encrypted at rest and never exposed to the frontend.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
            <li>Tokens auto-refresh 5 minutes before expiry</li>
            <li>Permissions are scoped to strictly necessary management features</li>
            <li>You can revoke access at any time</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

