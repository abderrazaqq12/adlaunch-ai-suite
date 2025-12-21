/**
 * Hook to manage Monitoring State Machine
 * 
 * States: NO_ACTIVE_CAMPAIGNS | ACTIVE | PAUSED | STOPPED
 */

import { useMemo } from 'react';
import type { MonitoringState } from '@/lib/state-machines/types';
import { MONITORING_STATE_CONFIG } from '@/lib/state-machines/types';
import type { Campaign } from '@/types';

export interface MonitoringStateInfo {
  state: MonitoringState;
  label: string;
  description: string;
  showMetrics: boolean;
  showAIActions: boolean;
  showEmptyState: boolean;
  activeCampaigns: number;
  pausedCampaigns: number;
  stoppedCampaigns: number;
}

export function useMonitoringState(campaigns: Campaign[]): MonitoringStateInfo {
  return useMemo(() => {
    const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
    const pausedCampaigns = campaigns.filter(c => c.status === 'paused').length;
    const stoppedCampaigns = campaigns.filter(c => 
      c.status === 'disapproved' || c.status === 'completed'
    ).length;

    // Determine monitoring state
    let state: MonitoringState;
    let label: string;
    let description: string;

    if (campaigns.length === 0) {
      state = 'NO_ACTIVE_CAMPAIGNS';
      label = 'No Active Campaigns';
      description = 'Launch a campaign to start monitoring.';
    } else if (activeCampaigns > 0) {
      state = 'ACTIVE';
      label = 'Active';
      description = `${activeCampaigns} campaign${activeCampaigns !== 1 ? 's' : ''} running`;
    } else if (pausedCampaigns > 0 && pausedCampaigns === campaigns.length) {
      state = 'PAUSED';
      label = 'All Paused';
      description = `${pausedCampaigns} campaign${pausedCampaigns !== 1 ? 's' : ''} paused`;
    } else if (stoppedCampaigns > 0) {
      state = 'STOPPED';
      label = 'Stopped';
      description = `${stoppedCampaigns} campaign${stoppedCampaigns !== 1 ? 's' : ''} stopped`;
    } else {
      state = 'NO_ACTIVE_CAMPAIGNS';
      label = 'No Active Campaigns';
      description = 'All campaigns are inactive.';
    }

    const config = MONITORING_STATE_CONFIG[state];

    return {
      state,
      label,
      description,
      showMetrics: config.showMetrics,
      showAIActions: config.showAIActions,
      showEmptyState: config.showEmptyState,
      activeCampaigns,
      pausedCampaigns,
      stoppedCampaigns,
    };
  }, [campaigns]);
}
