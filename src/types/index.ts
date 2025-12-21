export type Platform = 'google' | 'tiktok' | 'snapchat';

// Re-export state machine types
export * from '@/lib/state-machines/types';

// ============================================
// ASSET STATE MACHINE (Strict)
// ============================================

/**
 * Asset States (Strict Order):
 * UPLOADED → ANALYZING → APPROVED → READY_FOR_LAUNCH
 *                    ↘ BLOCKED
 * 
 * UI Rules:
 * - UPLOADED: Show "Run AI Analysis", hide Publish/Select
 * - ANALYZING: Spinner, disable all actions
 * - APPROVED: Show "View AI Decision", "Mark Ready for Launch"
 * - READY_FOR_LAUNCH: Selectable in Publish, show badge
 * - BLOCKED: Show issues, "Generate Safe Variant", "Re-analyze", NEVER selectable
 */
export type AssetStatus = 
  | 'UPLOADED'          // Asset uploaded, no AI analysis yet
  | 'ANALYZING'         // AI compliance running
  | 'APPROVED'          // Passed AI compliance
  | 'READY_FOR_LAUNCH'  // Approved + user confirmed ready
  | 'BLOCKED';          // Failed compliance

// ============================================
// AD ACCOUNT STATE MACHINE
// ============================================

/**
 * Ad Account States:
 * DISCONNECTED → CONNECTING → CONNECTED
 */
export type AdAccountConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED';

// Legacy compatibility - map to new states
export type ConnectionStatus = 'not_connected' | 'connected' | 'limited_access';

// Project Pipeline Stages (kept for backward compatibility)
export type ProjectStage = 
  | 'SETUP'
  | 'ACCOUNTS_CONNECTED'
  | 'ASSETS_READY'
  | 'ANALYSIS_PASSED'
  | 'READY_TO_LAUNCH'
  | 'LIVE';

// ============================================
// CAMPAIGN EXECUTION READINESS
// ============================================

export type ExecutionStatus = 'DRAFT' | 'READY' | 'BLOCKED' | 'PARTIAL_READY';

export interface ExecutionBlocker {
  type: 'assets' | 'platform_config' | 'permissions' | 'analysis';
  platform?: Platform;
  accountId?: string;
  accountName?: string;
  message: string;
  severity: 'error' | 'warning'; // error = blocked, warning = skip
}

export interface PlatformExecutionStatus {
  platform: Platform;
  status: 'ready' | 'blocked' | 'partial';
  readyAccounts: string[]; // account IDs that can launch
  blockedAccounts: { id: string; name: string; reason: string }[];
  blockers: ExecutionBlocker[];
}

export interface CampaignExecutionReadiness {
  status: ExecutionStatus;
  canLaunch: boolean;
  totalCampaignsPlanned: number;
  totalCampaignsReady: number;
  totalCampaignsBlocked: number;
  platformStatuses: PlatformExecutionStatus[];
  globalBlockers: ExecutionBlocker[]; // Blockers that affect all platforms
  summary: string;
}

// ============================================
// CAMPAIGN INTENT SYSTEM
// ============================================

// High-level objectives (platform-agnostic)
// FIXED: Only Conversion (Sales) objective supported
export type CampaignObjective = 'conversion';

// Platform-specific objective mappings
export const PLATFORM_OBJECTIVE_NAMES: Record<Platform, Record<CampaignObjective, string>> = {
  google: {
    conversion: 'Sales / Website Conversions',
  },
  tiktok: {
    conversion: 'Conversion',
  },
  snapchat: {
    conversion: 'Conversion',
  },
};

// Google Ads specific - only Demand Gen
export type GoogleCampaignType = 'demand_gen';

// Platform-specific configurations
export interface GoogleAdsConfig {
  campaignType: GoogleCampaignType;
  conversionAction?: string;
}

export interface TikTokAdsConfig {
  optimizationEvent?: string;
}

export interface SnapchatAdsConfig {
  pixelId?: string;
  conversionEvent?: string;
}

export type PlatformConfig = {
  google?: GoogleAdsConfig;
  tiktok?: TikTokAdsConfig;
  snapchat?: SnapchatAdsConfig;
};

// Audience targeting
export interface AudienceTarget {
  countries: string[];
  ageMin: number;
  ageMax: number;
  gender: 'all' | 'male' | 'female';
  languages: string[];
}

// Selected accounts per platform
export interface PlatformAccountSelection {
  platform: Platform;
  accountIds: string[];
}

// Campaign Intent - the logical container
export interface CampaignIntent {
  id: string;
  projectId: string;
  name: string;
  objective: CampaignObjective;
  
  // Selected assets
  assetIds: string[];
  landingPageUrl: string;
  
  // Audience
  audience: AudienceTarget;
  
  // Platform & account selection
  selectedPlatforms: Platform[];
  accountSelections: PlatformAccountSelection[];
  
  // Platform-specific configs
  platformConfigs: PlatformConfig;
  
  // Budget
  dailyBudget: number;
  
  // Settings
  softLaunch: boolean;
  
  // Execution readiness (computed at launch time)
  executionStatus?: ExecutionStatus;
  
  // Metadata
  status: 'draft' | 'launching' | 'launched' | 'failed';
  createdAt: string;
  launchedAt?: string;
}

// ============================================
// EXISTING TYPES (UPDATED)
// ============================================

export interface PlatformPermissions {
  canAnalyze: boolean;
  canLaunch: boolean;
  canOptimize: boolean;
}

export interface AdAccountConnection {
  id: string;
  platform: Platform;
  accountId: string;
  accountName: string;
  status: ConnectionStatus;
  permissions: PlatformPermissions;
  connectedAt?: string;
}

export interface Project {
  id: string;
  name: string;
  targetMarket: string;
  language: string;
  currency: string;
  defaultPlatforms: Platform[];
  createdAt: string;
  connections: AdAccountConnection[];
  stage: ProjectStage;
}

export interface AssetAnalysisResult {
  policyRiskScore: number;
  creativeQualityScore: number;
  passed: boolean;
  analyzedAt: string;
  issues: FlaggedIssue[];
}

export interface Asset {
  id: string;
  projectId: string;
  type: 'video' | 'image' | 'text';
  name: string;
  url?: string;
  storagePath?: string; // Supabase Storage path for cleanup
  content?: string;
  createdAt: string;
  status: AssetStatus;
  analysisResult?: AssetAnalysisResult;
  rejectionReasons?: string[];
}

export interface AnalysisResult {
  policyRiskScore: number;
  creativeQualityScore: number;
  flaggedIssues: FlaggedIssue[];
  suggestions: string[];
  canLaunch: boolean;
}

export interface FlaggedIssue {
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  platform: Platform;
}

// Real platform campaign (created from CampaignIntent)
export interface Campaign {
  id: string;
  projectId: string;
  intentId: string; // Reference to CampaignIntent
  name: string;
  platform: Platform;
  accountId: string; // Which ad account this runs on
  status: 'draft' | 'pending' | 'active' | 'paused' | 'completed' | 'disapproved';
  budget: number;
  objective: CampaignObjective;
  softLaunch: boolean;
  metrics: CampaignMetrics;
  approvalStatus: 'pending' | 'approved' | 'disapproved' | 'limited';
  disapprovalReason?: string;
  createdAt: string;
}

export interface CampaignMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  cpc: number;
  cpa: number;
  ctr: number;
  roas: number;
}

export type RuleLevel = 'ad' | 'adset' | 'campaign';

export type TimeRange = 'last_1_day' | 'last_3_days' | 'last_5_days' | 'last_7_days' | 'last_14_days' | 'last_30_days';

export interface AutomationRule {
  id: string;
  projectId: string;
  name: string;
  enabled: boolean;
  level: RuleLevel;
  condition: RuleCondition;
  action: RuleAction;
  createdAt: string;
}

export interface RuleCondition {
  metric: 'cpc' | 'cpa' | 'ctr' | 'roas' | 'impressions' | 'spend';
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  value: number;
  timeRange: TimeRange;
  afterImpressions?: number;
}

export interface RuleAction {
  type: 'pause' | 'increase_budget' | 'decrease_budget' | 'increase_bid' | 'decrease_bid' | 'modify_creative' | 'trigger_recovery';
  value?: number;
}

export interface RuleExecutionLog {
  id: string;
  ruleId: string;
  ruleName: string;
  projectId: string;
  level: RuleLevel;
  targetId: string;
  targetName: string;
  action: RuleAction['type'];
  actionValue?: number;
  metricValue: number;
  metricName: string;
  triggeredAt: string;
  success: boolean;
  error?: string;
}

export interface AIAction {
  id: string;
  campaignId: string;
  timestamp: string;
  action: string;
  reason: string;
  result?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

// Stage Requirements for Pipeline Enforcement
export const STAGE_ORDER: ProjectStage[] = [
  'SETUP',
  'ACCOUNTS_CONNECTED',
  'ASSETS_READY',
  'ANALYSIS_PASSED',
  'READY_TO_LAUNCH',
  'LIVE',
];

export const STAGE_REQUIREMENTS: Record<ProjectStage, string> = {
  SETUP: 'Create a project to get started',
  ACCOUNTS_CONNECTED: 'Connect at least one ad account',
  ASSETS_READY: 'Upload at least one asset',
  ANALYSIS_PASSED: 'Run pre-launch analysis and pass all checks',
  READY_TO_LAUNCH: 'Configure your launch settings',
  LIVE: 'Campaign is live',
};

export const PAGE_REQUIRED_STAGES: Record<string, ProjectStage[]> = {
  '/dashboard': ['SETUP'],
  '/connections': ['SETUP'],
  '/assets': ['SETUP'],
  '/analyze': ['ASSETS_READY'],
  '/launch': ['ANALYSIS_PASSED'],
  '/monitoring': ['LIVE'],
  '/recovery': ['LIVE'],
  '/rules': ['ACCOUNTS_CONNECTED'],
  '/history': ['SETUP'],
};

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getAccountsForPlatform(connections: AdAccountConnection[], platform: Platform): AdAccountConnection[] {
  return connections.filter(c => c.platform === platform && (c.status === 'connected' || c.status === 'limited_access'));
}

export function getLaunchableAccountsForPlatform(connections: AdAccountConnection[], platform: Platform): AdAccountConnection[] {
  return connections.filter(c => c.platform === platform && c.permissions.canLaunch);
}

export function calculateTotalCampaigns(accountSelections: PlatformAccountSelection[]): number {
  return accountSelections.reduce((total, sel) => total + sel.accountIds.length, 0);
}
