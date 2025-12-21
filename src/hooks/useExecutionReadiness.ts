import { useMemo } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import type {
  Platform,
  CampaignObjective,
  PlatformConfig,
  PlatformAccountSelection,
  ExecutionStatus,
  ExecutionBlocker,
  PlatformExecutionStatus,
  CampaignExecutionReadiness,
} from '@/types';

interface ExecutionReadinessInput {
  selectedAssetIds: string[];
  selectedPlatforms: Platform[];
  accountSelections: PlatformAccountSelection[];
  platformConfigs: PlatformConfig;
  objective: CampaignObjective;
  landingPageUrl: string;
  campaignName: string;
}

export function useExecutionReadiness(input: ExecutionReadinessInput): CampaignExecutionReadiness {
  const { currentProject, assets } = useProjectStore();
  
  return useMemo(() => {
    const {
      selectedAssetIds,
      selectedPlatforms,
      accountSelections,
      platformConfigs,
      objective,
      landingPageUrl,
      campaignName,
    } = input;

    const globalBlockers: ExecutionBlocker[] = [];
    const platformStatuses: PlatformExecutionStatus[] = [];
    
    // 1. Check draft state (nothing configured)
    if (!campaignName.trim() || selectedAssetIds.length === 0 || !landingPageUrl.trim()) {
      const blockers: ExecutionBlocker[] = [];
      
      if (!campaignName.trim()) {
        blockers.push({
          type: 'assets',
          message: 'Campaign name is required',
          severity: 'error',
        });
      }
      
      if (selectedAssetIds.length === 0) {
        blockers.push({
          type: 'assets',
          message: 'At least one asset must be selected',
          severity: 'error',
        });
      }
      
      if (!landingPageUrl.trim()) {
        blockers.push({
          type: 'assets',
          message: 'Landing page URL is required',
          severity: 'error',
        });
      }
      
      return {
        status: 'DRAFT',
        canLaunch: false,
        totalCampaignsPlanned: 0,
        totalCampaignsReady: 0,
        totalCampaignsBlocked: 0,
        platformStatuses: [],
        globalBlockers: blockers,
        summary: 'Complete campaign intent to continue',
      };
    }

    // 2. Validate approved assets
    const selectedAssets = assets.filter(a => selectedAssetIds.includes(a.id));
    const approvedAssets = selectedAssets.filter(a => a.status === 'APPROVED');
    
    if (approvedAssets.length === 0) {
      globalBlockers.push({
        type: 'analysis',
        message: 'No approved assets. Run pre-launch analysis to approve assets.',
        severity: 'error',
      });
    }

    // Check for blocked assets included
    const blockedAssets = selectedAssets.filter(a => a.status === 'BLOCKED');
    if (blockedAssets.length > 0) {
      globalBlockers.push({
        type: 'analysis',
        message: `${blockedAssets.length} asset(s) are BLOCKED and cannot be launched`,
        severity: 'error',
      });
    }

    // Check for unanalyzed assets
    const unanalyzedAssets = selectedAssets.filter(a => a.status === 'UPLOADED');
    if (unanalyzedAssets.length > 0) {
      globalBlockers.push({
        type: 'analysis',
        message: `${unanalyzedAssets.length} asset(s) have not been analyzed yet`,
        severity: 'warning',
      });
    }

    // 3. Check platforms selected
    if (selectedPlatforms.length === 0) {
      globalBlockers.push({
        type: 'platform_config',
        message: 'At least one platform must be selected',
        severity: 'error',
      });
    }

    // 4. Process each platform
    let totalCampaignsPlanned = 0;
    let totalCampaignsReady = 0;
    let totalCampaignsBlocked = 0;

    for (const platform of selectedPlatforms) {
      const selection = accountSelections.find(s => s.platform === platform);
      const platformBlockers: ExecutionBlocker[] = [];
      const readyAccounts: string[] = [];
      const blockedAccounts: { id: string; name: string; reason: string }[] = [];

      if (!selection || selection.accountIds.length === 0) {
        platformBlockers.push({
          type: 'platform_config',
          platform,
          message: `No ad accounts selected for ${platform}`,
          severity: 'error',
        });
        
        platformStatuses.push({
          platform,
          status: 'blocked',
          readyAccounts: [],
          blockedAccounts: [],
          blockers: platformBlockers,
        });
        continue;
      }

      // Check platform-specific config
      const config = platformConfigs[platform];
      
      if (platform === 'google' && (!config || !('campaignType' in config))) {
        platformBlockers.push({
          type: 'platform_config',
          platform,
          message: 'Google Ads campaign type not configured',
          severity: 'error',
        });
      }

      // Check each account's permissions
      for (const accountId of selection.accountIds) {
        const account = currentProject?.connections.find(c => c.id === accountId);
        totalCampaignsPlanned++;

        if (!account) {
          blockedAccounts.push({
            id: accountId,
            name: 'Unknown Account',
            reason: 'Account not found',
          });
          totalCampaignsBlocked++;
          continue;
        }

        if (!account.permissions.canLaunch) {
          blockedAccounts.push({
            id: accountId,
            name: account.accountName,
            reason: 'No launch permission. Request admin access.',
          });
          totalCampaignsBlocked++;
          continue;
        }

        if (account.status === 'not_connected') {
          blockedAccounts.push({
            id: accountId,
            name: account.accountName,
            reason: 'Account disconnected',
          });
          totalCampaignsBlocked++;
          continue;
        }

        // Account is ready
        readyAccounts.push(accountId);
        totalCampaignsReady++;
      }

      // Add permission blockers as warnings
      for (const blocked of blockedAccounts) {
        platformBlockers.push({
          type: 'permissions',
          platform,
          accountId: blocked.id,
          accountName: blocked.name,
          message: blocked.reason,
          severity: 'warning',
        });
      }

      // Determine platform status
      let platformStatus: 'ready' | 'blocked' | 'partial' = 'ready';
      if (readyAccounts.length === 0) {
        platformStatus = 'blocked';
      } else if (blockedAccounts.length > 0 || platformBlockers.some(b => b.severity === 'error')) {
        platformStatus = 'partial';
      }

      platformStatuses.push({
        platform,
        status: platformStatus,
        readyAccounts,
        blockedAccounts,
        blockers: platformBlockers,
      });
    }

    // 5. Determine overall execution status
    let status: ExecutionStatus;
    let canLaunch = false;

    const hasGlobalErrors = globalBlockers.some(b => b.severity === 'error');
    const allPlatformsBlocked = platformStatuses.every(p => p.status === 'blocked');
    const somePlatformsPartial = platformStatuses.some(p => p.status === 'partial');
    const allPlatformsReady = platformStatuses.every(p => p.status === 'ready');

    if (hasGlobalErrors || allPlatformsBlocked) {
      status = 'BLOCKED';
      canLaunch = false;
    } else if (totalCampaignsReady === 0) {
      status = 'BLOCKED';
      canLaunch = false;
    } else if (somePlatformsPartial || totalCampaignsBlocked > 0) {
      status = 'PARTIAL_READY';
      canLaunch = true;
    } else if (allPlatformsReady && totalCampaignsReady > 0) {
      status = 'READY';
      canLaunch = true;
    } else {
      status = 'DRAFT';
      canLaunch = false;
    }

    // 6. Generate summary
    let summary: string;
    switch (status) {
      case 'READY':
        summary = `All ${totalCampaignsReady} campaign(s) ready to launch`;
        break;
      case 'PARTIAL_READY':
        summary = `${totalCampaignsReady} of ${totalCampaignsPlanned} campaign(s) ready. ${totalCampaignsBlocked} will be skipped.`;
        break;
      case 'BLOCKED':
        if (hasGlobalErrors) {
          summary = globalBlockers.find(b => b.severity === 'error')?.message || 'Launch blocked';
        } else {
          summary = 'All campaigns blocked. Fix issues to proceed.';
        }
        break;
      default:
        summary = 'Complete configuration to launch';
    }

    return {
      status,
      canLaunch,
      totalCampaignsPlanned,
      totalCampaignsReady,
      totalCampaignsBlocked,
      platformStatuses,
      globalBlockers,
      summary,
    };
  }, [input, currentProject, assets]);
}

// Helper component props type
export interface ExecutionStatusDisplayProps {
  readiness: CampaignExecutionReadiness;
  showDetails?: boolean;
}
