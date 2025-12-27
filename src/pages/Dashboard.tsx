import { useMemo } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import {
  LaunchReadinessCard,
  ComplianceSummary,
  PlatformRiskHeatmap,
  AssetsStatusGrid,
  ConnectedPlatformsCard,
  ProtectionStatusPanel,
  CriticalEventsTimeline,
  QuickActions,
} from '@/components/dashboard';
import type { ReadinessStatus } from '@/components/dashboard/LaunchReadinessCard';

export default function Dashboard() {
  const { currentProject, assets = [] } = useProjectStore();

  // Get assets for current project
  const projectAssets = useMemo(() =>
    assets.filter(a => a.projectId === currentProject?.id),
    [assets, currentProject?.id]
  );

  // Calculate compliance stats
  const complianceStats = useMemo(() => {
    const approved = projectAssets.filter(a => a.state === 'APPROVED' || a.state === 'READY_FOR_LAUNCH').length;
    const blockedHard = projectAssets.filter(a => a.state === 'BLOCKED_HARD').length;
    const blockedSoft = projectAssets.filter(a => a.state === 'BLOCKED_SOFT').length;
    const autoRewriteAvailable = projectAssets.filter(a =>
      a.state === 'BLOCKED_SOFT' && a.type === 'text'
    ).length;

    return { approved, blockedHard, blockedSoft, autoRewriteAvailable };
  }, [projectAssets]);

  // Determine launch readiness status
  const { readinessStatus, blockingReasons } = useMemo(() => {
    const reasons: Array<{ type: 'hard' | 'soft' | 'account' | 'compliance'; message: string; count?: number }> = [];

    const connections = currentProject?.connections || [];
    const hasAccountConnected = connections.length > 0;

    // Hard blocks
    if (complianceStats.blockedHard > 0) {
      reasons.push({
        type: 'hard',
        message: `${complianceStats.blockedHard} assets BLOCKED (Hard violation)`,
        count: complianceStats.blockedHard,
      });
    }

    if (!hasAccountConnected) {
      reasons.push({
        type: 'account',
        message: 'Missing Ad Account connection',
      });
    }

    // Soft blocks
    if (complianceStats.blockedSoft > 0) {
      reasons.push({
        type: 'soft',
        message: `${complianceStats.blockedSoft} assets need fix (Soft violation)`,
        count: complianceStats.blockedSoft,
      });
    }

    // Determine status
    let status: ReadinessStatus = 'READY';

    if (complianceStats.blockedHard > 0 || !hasAccountConnected) {
      status = 'NOT_READY';
    } else if (complianceStats.blockedSoft > 0) {
      status = 'PARTIALLY_READY';
    } else if (projectAssets.length === 0) {
      status = 'NOT_READY';
      reasons.push({
        type: 'compliance',
        message: 'No assets uploaded for compliance check',
      });
    }

    return { readinessStatus: status, blockingReasons: reasons };
  }, [complianceStats, currentProject?.connections, projectAssets.length]);

  // Platform risk levels
  const platformRisks = useMemo(() => {
    const calculateRisk = (platform: 'google' | 'tiktok' | 'snapchat') => {
      const platformAssets = projectAssets.filter(a =>
        a.platforms?.includes(platform) || true // All assets apply if no platform specified
      );

      if (platformAssets.length === 0) return { risk: 'none' as const, count: 0 };

      const hasHard = platformAssets.some(a => a.state === 'BLOCKED_HARD');
      const hasSoft = platformAssets.some(a => a.state === 'BLOCKED_SOFT');

      if (hasHard) return { risk: 'high' as const, count: platformAssets.length };
      if (hasSoft) return { risk: 'medium' as const, count: platformAssets.length };
      return { risk: 'low' as const, count: platformAssets.length };
    };

    return [
      { platform: 'google' as const, ...calculateRisk('google') },
      { platform: 'tiktok' as const, ...calculateRisk('tiktok') },
      { platform: 'snapchat' as const, ...calculateRisk('snapchat') },
    ].map(p => ({ platform: p.platform, risk: p.risk, assetCount: p.count }));
  }, [projectAssets]);

  // Transform assets for grid
  const gridAssets = useMemo(() =>
    projectAssets.slice(0, 10).map(a => ({
      id: a.id,
      name: a.name || 'Untitled Asset',
      type: a.type as 'video' | 'image' | 'text',
      status: (a.state === 'APPROVED' || a.state === 'READY_FOR_LAUNCH')
        ? 'APPROVED' as const
        : a.state === 'BLOCKED_HARD'
          ? 'BLOCKED_HARD' as const
          : a.state === 'BLOCKED_SOFT'
            ? 'BLOCKED_SOFT' as const
            : a.state === 'ANALYZING'
              ? 'ANALYZING' as const
              : 'PENDING' as const,
      riskScore: a.policyRiskScore || 0,
      platforms: ['google', 'tiktok', 'snapchat'] as const,
      canAutoRewrite: a.type === 'text' && a.state === 'BLOCKED_SOFT',
    })),
    [projectAssets]
  );

  // Platform connections
  const connections = useMemo(() => {
    const projectConnections = currentProject?.connections || [];

    return ['google', 'tiktok', 'snapchat'].map(platform => {
      const conn = projectConnections.find(c => c.platform === platform);
      return {
        platform: platform as 'google' | 'tiktok' | 'snapchat',
        status: conn?.isActive
          ? 'connected' as const
          : conn
            ? 'expired' as const
            : 'not_connected' as const,
        accountName: conn?.accountName,
        lastSync: conn?.lastSync ? new Date(conn.lastSync).toLocaleDateString() : undefined,
      };
    });
  }, [currentProject?.connections]);

  // Protection settings (default states)
  const protectionSettings = {
    autoBlockOnViolation: true,
    autoRewriteText: false,
    autoPauseOnViolation: true,
    manualReviewRequired: false,
  };

  // Critical events (from asset analysis history)
  const criticalEvents = useMemo(() =>
    projectAssets
      .filter(a => a.state === 'BLOCKED_HARD' || a.state === 'BLOCKED_SOFT')
      .slice(0, 5)
      .map(a => ({
        id: a.id,
        type: a.state === 'BLOCKED_HARD' ? 'blocked' as const : 'needs_fix' as const,
        message: `${a.name || 'Asset'} ${a.state === 'BLOCKED_HARD' ? 'was blocked' : 'needs fix'}`,
        timestamp: a.analyzedAt ? new Date(a.analyzedAt).toLocaleString() : 'Recently',
        assetId: a.id,
      })),
    [projectAssets]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Launch Control Center</h1>
        <p className="text-muted-foreground">
          AI Compliance, Risk Management & Campaign Launch Protection
        </p>
      </div>

      {/* 1. Launch Readiness - PRIMARY */}
      <LaunchReadinessCard
        status={readinessStatus}
        blockingReasons={blockingReasons}
      />

      {/* Quick Actions */}
      <QuickActions
        hasBlockingIssues={complianceStats.blockedHard > 0 || complianceStats.blockedSoft > 0}
        hasUnconnectedAccounts={connections.some(c => c.status !== 'connected')}
        isReadyToLaunch={readinessStatus === 'READY'}
      />

      {/* 2. Compliance & Risk Overview */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ComplianceSummary stats={complianceStats} />
        <PlatformRiskHeatmap platforms={platformRisks} />
      </div>

      {/* 3 & 4. Assets & Accounts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <AssetsStatusGrid assets={gridAssets} />
        <ConnectedPlatformsCard connections={connections} />
      </div>

      {/* 5 & 6. Protection & Events */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ProtectionStatusPanel settings={protectionSettings} />
        <CriticalEventsTimeline events={criticalEvents} />
      </div>
    </div>
  );
}
