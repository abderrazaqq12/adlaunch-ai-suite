/**
 * Hook to manage Publish Flow State Machine
 * 
 * State Flow:
 * PUBLISH_INIT → ASSETS_SELECTED → ACCOUNTS_SELECTED → 
 * AUDIENCE_DEFINED → READY_TO_PUBLISH → EXECUTING → PUBLISHED
 */

import { useMemo } from 'react';
import type { PublishFlowState } from '@/lib/state-machines/types';
import type { PlatformAccountSelection } from '@/types';

export interface PublishFlowRequirements {
  selectedAssetIds: string[];
  readyAssetCount: number; // Assets in READY_FOR_LAUNCH state
  selectedPlatforms: string[];
  accountSelections: PlatformAccountSelection[];
  campaignName: string;
  landingPageUrl: string;
  countries: string[];
  languages: string[];
  isExecuting: boolean;
  isPublished: boolean;
}

export interface PublishFlowValidation {
  currentState: PublishFlowState;
  stepIndex: number;
  canProceed: boolean;
  blockerMessage: string | null;
  stateLabel: string;
}

export function usePublishFlowState(requirements: PublishFlowRequirements): PublishFlowValidation {
  return useMemo(() => {
    const {
      selectedAssetIds,
      readyAssetCount,
      selectedPlatforms,
      accountSelections,
      campaignName,
      landingPageUrl,
      countries,
      languages,
      isExecuting,
      isPublished,
    } = requirements;

    // Check if published
    if (isPublished) {
      return {
        currentState: 'PUBLISHED',
        stepIndex: 6,
        canProceed: false,
        blockerMessage: null,
        stateLabel: 'Published',
      };
    }

    // Check if executing
    if (isExecuting) {
      return {
        currentState: 'EXECUTING',
        stepIndex: 5,
        canProceed: false,
        blockerMessage: 'Publishing in progress. Please wait.',
        stateLabel: 'Executing',
      };
    }

    // PUBLISH_INIT: Need at least 1 asset selected
    if (selectedAssetIds.length === 0) {
      const blockerMessage = readyAssetCount === 0
        ? 'No assets ready for launch. Go to Assets and mark approved assets as "Ready for Launch".'
        : 'Select at least one asset to continue.';
      
      return {
        currentState: 'PUBLISH_INIT',
        stepIndex: 0,
        canProceed: false,
        blockerMessage,
        stateLabel: 'Select Assets',
      };
    }

    // ASSETS_SELECTED: Assets selected, need accounts
    const hasAccountsSelected = selectedPlatforms.length > 0 && 
      accountSelections.length > 0 && 
      accountSelections.every(s => s.accountIds.length > 0);

    if (!hasAccountsSelected) {
      return {
        currentState: 'ASSETS_SELECTED',
        stepIndex: 1,
        canProceed: true,
        blockerMessage: selectedPlatforms.length === 0 
          ? 'Select at least one platform and account to continue.'
          : 'Select at least one account for each platform.',
        stateLabel: 'Assets Selected',
      };
    }

    // ACCOUNTS_SELECTED: Accounts selected, need audience
    const hasValidAudience = 
      campaignName.trim() !== '' &&
      landingPageUrl.trim() !== '' &&
      countries.length > 0 &&
      languages.length > 0;

    if (!hasValidAudience) {
      const missingFields: string[] = [];
      if (!campaignName.trim()) missingFields.push('Campaign Name');
      if (!landingPageUrl.trim()) missingFields.push('Landing Page URL');
      if (countries.length === 0) missingFields.push('Countries');
      if (languages.length === 0) missingFields.push('Languages');

      return {
        currentState: 'ACCOUNTS_SELECTED',
        stepIndex: 2,
        canProceed: true,
        blockerMessage: `Complete required fields: ${missingFields.join(', ')}`,
        stateLabel: 'Accounts Selected',
      };
    }

    // AUDIENCE_DEFINED: All requirements met, ready to review
    return {
      currentState: 'AUDIENCE_DEFINED',
      stepIndex: 3,
      canProceed: true,
      blockerMessage: null,
      stateLabel: 'Ready to Publish',
    };
  }, [requirements]);
}

/**
 * Map PublishFlowState to wizard step
 */
export function getWizardStepFromState(state: PublishFlowState): 'assets' | 'accounts' | 'audience' | 'preview' {
  switch (state) {
    case 'PUBLISH_INIT':
      return 'assets';
    case 'ASSETS_SELECTED':
      return 'accounts';
    case 'ACCOUNTS_SELECTED':
    case 'AUDIENCE_DEFINED':
      return 'audience';
    case 'READY_TO_PUBLISH':
    case 'EXECUTING':
    case 'PUBLISHED':
      return 'preview';
    default:
      return 'assets';
  }
}

/**
 * Validate if transition from current wizard step is allowed
 */
export function canTransitionStep(
  currentStep: 'assets' | 'accounts' | 'audience' | 'preview',
  targetStep: 'assets' | 'accounts' | 'audience' | 'preview',
  validation: PublishFlowValidation
): { allowed: boolean; message: string | null } {
  const stepOrder = ['assets', 'accounts', 'audience', 'preview'];
  const currentIndex = stepOrder.indexOf(currentStep);
  const targetIndex = stepOrder.indexOf(targetStep);

  // Always allow going back
  if (targetIndex < currentIndex) {
    return { allowed: true, message: null };
  }

  // Going forward - check requirements
  if (currentStep === 'assets' && validation.currentState === 'PUBLISH_INIT') {
    return { 
      allowed: false, 
      message: validation.blockerMessage || 'Complete current step requirements first.' 
    };
  }

  if (currentStep === 'accounts' && validation.currentState === 'ASSETS_SELECTED') {
    return { 
      allowed: false, 
      message: validation.blockerMessage || 'Select at least one account.' 
    };
  }

  if (currentStep === 'audience' && validation.currentState === 'ACCOUNTS_SELECTED') {
    return { 
      allowed: false, 
      message: validation.blockerMessage || 'Complete all required fields.' 
    };
  }

  return { allowed: true, message: null };
}
