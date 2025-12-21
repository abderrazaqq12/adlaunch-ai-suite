/**
 * STATE GUARDS - Pure Functions for Validating State Transitions
 * 
 * Guards are evaluated BEFORE any side effects (API calls, automation, publishing).
 * If a guard fails:
 *   - Block the transition
 *   - Return a structured error
 *   - Log a BLOCKED_EVENT with reason
 * 
 * All guards must be pure functions (no side effects).
 * All guards return { allowed: boolean, reason?: string }
 */

export interface GuardResult {
  allowed: boolean;
  reason?: string;
}

// ============================================================================
// ASSET GUARDS
// ============================================================================

export interface AssetGuardInput {
  state: string;
  aiStatus?: string;
  riskScore?: number | null;
  platformCompatibility?: string[];
  targetPlatform?: string;
}

export interface AssetReadyGuardConfig {
  riskThreshold: number; // Default: 50
}

/**
 * ASSET → READY_FOR_LAUNCH Guard
 * 
 * Requirements:
 * - asset.aiStatus === "APPROVED"
 * - asset.riskScore <= allowedThreshold
 * - asset.platformCompatibility.includes(targetPlatform)
 */
export function guardAssetReadyForLaunch(
  asset: AssetGuardInput,
  config: AssetReadyGuardConfig = { riskThreshold: 50 },
  targetPlatform?: string
): GuardResult {
  // Guard 1: aiStatus must be APPROVED
  if (asset.state !== 'APPROVED') {
    return {
      allowed: false,
      reason: `Asset must be APPROVED to mark ready. Current state: ${asset.state}`,
    };
  }

  // Guard 2: riskScore must be within threshold
  if (asset.riskScore !== null && asset.riskScore !== undefined) {
    if (asset.riskScore > config.riskThreshold) {
      return {
        allowed: false,
        reason: `Asset risk score (${asset.riskScore}) exceeds threshold (${config.riskThreshold})`,
      };
    }
  }

  // Guard 3: Platform compatibility (if target platform specified)
  if (targetPlatform && asset.platformCompatibility) {
    if (!asset.platformCompatibility.includes(targetPlatform)) {
      return {
        allowed: false,
        reason: `Asset not compatible with target platform: ${targetPlatform}. Compatible platforms: ${asset.platformCompatibility.join(', ')}`,
      };
    }
  }

  return { allowed: true };
}

// ============================================================================
// CAMPAIGN PUBLISH GUARDS
// ============================================================================

export interface CampaignPublishGuardInput {
  assets: Array<{
    id: string;
    state: string;
    riskScore?: number | null;
    platformCompatibility?: string[];
  }>;
  accounts: Array<{
    id: string;
    state: string;
    permissions: string[];
    platform: string;
  }>;
  audience: {
    country?: string;
    language?: string;
    gender?: string;
    ageMin?: number;
    ageMax?: number;
    isValid?: boolean;
  };
  objective: string;
  targetPlatforms: string[];
}

// Platforms that support conversion campaigns
const CONVERSION_SUPPORTED_PLATFORMS = ['GOOGLE', 'TIKTOK', 'SNAPCHAT'];

/**
 * CAMPAIGN → PUBLISH Guard
 * 
 * Requirements:
 * - at least 1 approved asset selected
 * - adAccount.permissions includes "LAUNCH"
 * - audience.isValid === true
 * - objective === "CONVERSION"
 * - platform supports conversion campaigns
 */
export function guardCampaignPublish(input: CampaignPublishGuardInput): GuardResult {
  // Guard 1: At least 1 READY_FOR_LAUNCH asset
  const readyAssets = input.assets.filter(a => a.state === 'READY_FOR_LAUNCH');
  if (readyAssets.length === 0) {
    return {
      allowed: false,
      reason: 'At least one asset must be in READY_FOR_LAUNCH state',
    };
  }

  // Guard 2: All accounts must have LAUNCH permission
  const accountsWithoutLaunch = input.accounts.filter(
    a => !a.permissions.includes('LAUNCH')
  );
  if (accountsWithoutLaunch.length > 0) {
    const accountIds = accountsWithoutLaunch.map(a => a.id).join(', ');
    return {
      allowed: false,
      reason: `Ad accounts missing LAUNCH permission: ${accountIds}`,
    };
  }

  // Guard 3: Audience validation
  if (!input.audience.isValid) {
    const missingFields: string[] = [];
    if (!input.audience.country) missingFields.push('country');
    if (!input.audience.language) missingFields.push('language');
    
    return {
      allowed: false,
      reason: `Invalid audience configuration. Missing: ${missingFields.join(', ')}`,
    };
  }

  // Guard 4: Objective must be CONVERSION
  if (input.objective !== 'CONVERSION') {
    return {
      allowed: false,
      reason: `Only CONVERSION objective is supported. Received: ${input.objective}`,
    };
  }

  // Guard 5: All target platforms must support conversion campaigns
  const unsupportedPlatforms = input.targetPlatforms.filter(
    p => !CONVERSION_SUPPORTED_PLATFORMS.includes(p.toUpperCase())
  );
  if (unsupportedPlatforms.length > 0) {
    return {
      allowed: false,
      reason: `Platform(s) do not support conversion campaigns: ${unsupportedPlatforms.join(', ')}`,
    };
  }

  // Guard 6: Assets must be compatible with target platforms
  for (const platform of input.targetPlatforms) {
    const compatibleAssets = readyAssets.filter(
      a => !a.platformCompatibility || a.platformCompatibility.includes(platform.toUpperCase())
    );
    if (compatibleAssets.length === 0) {
      return {
        allowed: false,
        reason: `No compatible assets for platform: ${platform}`,
      };
    }
  }

  return { allowed: true };
}

// ============================================================================
// AUTOMATION ACTION GUARDS
// ============================================================================

export interface AutomationActionGuardInput {
  rule: {
    id: string;
    state: string;
    cooldownMinutes: number;
    lastTriggeredAt?: string | null;
    actionsToday?: number;
    maxActionsPerDay?: number;
  };
  campaign: {
    id: string;
    state: string;
  };
}

export interface AutomationGuardConfig {
  maxActionsPerDay: number; // Default: 10
}

// Campaign states that block automation
const BLOCKED_CAMPAIGN_STATES = ['RECOVERY', 'USER_PAUSED', 'STOPPED', 'DISAPPROVED'];

/**
 * AUTOMATION → ACTION_EXECUTION Guard
 * 
 * Requirements:
 * - campaign.state NOT IN ["RECOVERY", "USER_PAUSED", "STOPPED", "DISAPPROVED"]
 * - cooldownExpired === true
 * - maxActionsPerDay NOT exceeded
 */
export function guardAutomationAction(
  input: AutomationActionGuardInput,
  config: AutomationGuardConfig = { maxActionsPerDay: 10 }
): GuardResult {
  // Guard 1: Campaign state must allow automation
  if (BLOCKED_CAMPAIGN_STATES.includes(input.campaign.state)) {
    return {
      allowed: false,
      reason: `Campaign in ${input.campaign.state} state blocks automation actions`,
    };
  }

  // Guard 2: Rule must be ACTIVE
  if (input.rule.state !== 'ACTIVE') {
    return {
      allowed: false,
      reason: `Rule must be ACTIVE to execute. Current state: ${input.rule.state}`,
    };
  }

  // Guard 3: Cooldown must be expired
  if (input.rule.lastTriggeredAt) {
    const lastTriggered = new Date(input.rule.lastTriggeredAt);
    const cooldownMs = input.rule.cooldownMinutes * 60 * 1000;
    const cooldownEnds = new Date(lastTriggered.getTime() + cooldownMs);
    const now = new Date();
    
    if (now < cooldownEnds) {
      const remainingMs = cooldownEnds.getTime() - now.getTime();
      const remainingMins = Math.ceil(remainingMs / 60000);
      return {
        allowed: false,
        reason: `Rule in cooldown. ${remainingMins} minute(s) remaining`,
      };
    }
  }

  // Guard 4: Max actions per day not exceeded
  const actionsToday = input.rule.actionsToday || 0;
  const maxActions = input.rule.maxActionsPerDay || config.maxActionsPerDay;
  
  if (actionsToday >= maxActions) {
    return {
      allowed: false,
      reason: `Daily action limit reached (${actionsToday}/${maxActions})`,
    };
  }

  return { allowed: true };
}

// ============================================================================
// COMPOSITE GUARDS
// ============================================================================

export interface FullPublishGuardInput {
  intent: {
    state: string;
    assets: string[];
    accounts: string[];
    objective: string;
    audience: {
      country?: string;
      language?: string;
      gender?: string;
      ageMin?: number;
      ageMax?: number;
    };
  };
  assetDetails: Array<{
    id: string;
    state: string;
    riskScore?: number | null;
    platformCompatibility?: string[];
  }>;
  accountDetails: Array<{
    id: string;
    state: string;
    permissions: string[];
    platform: string;
  }>;
}

/**
 * Full publish guard - combines intent state check with campaign publish guard
 */
export function guardFullPublish(input: FullPublishGuardInput): GuardResult {
  // Guard 0: Intent must be in READY_TO_PUBLISH state
  if (input.intent.state !== 'READY_TO_PUBLISH') {
    return {
      allowed: false,
      reason: `Intent must be READY_TO_PUBLISH. Current state: ${input.intent.state}`,
    };
  }

  // Run full campaign publish guard
  const selectedAssets = input.assetDetails.filter(a => 
    input.intent.assets.includes(a.id)
  );
  const selectedAccounts = input.accountDetails.filter(a => 
    input.intent.accounts.includes(a.id)
  );

  const targetPlatforms = [...new Set(selectedAccounts.map(a => a.platform))];

  return guardCampaignPublish({
    assets: selectedAssets,
    accounts: selectedAccounts,
    audience: {
      ...input.intent.audience,
      isValid: !!(input.intent.audience.country && input.intent.audience.language),
    },
    objective: input.intent.objective,
    targetPlatforms,
  });
}

// ============================================================================
// BLOCKED EVENT HELPER
// ============================================================================

export interface BlockedEventPayload {
  guardName: string;
  entityType: 'ASSET' | 'CAMPAIGN' | 'RULE' | 'AD_ACCOUNT';
  entityId: string;
  attemptedAction: string;
  reason: string;
  context?: Record<string, unknown>;
}

/**
 * Creates a BLOCKED_EVENT payload for logging
 */
export function createBlockedEvent(payload: BlockedEventPayload): {
  type: 'GUARD_BLOCKED';
  entity: string;
  entityId: string;
  action: string;
  reason: string;
  metadata: Record<string, unknown>;
} {
  return {
    type: 'GUARD_BLOCKED',
    entity: payload.entityType,
    entityId: payload.entityId,
    action: payload.attemptedAction,
    reason: payload.reason,
    metadata: {
      guardName: payload.guardName,
      ...payload.context,
    },
  };
}
