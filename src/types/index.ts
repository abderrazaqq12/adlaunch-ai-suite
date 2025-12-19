export type Platform = 'google' | 'tiktok' | 'snapchat';

export type ConnectionStatus = 'not_connected' | 'connected' | 'limited_access';

// Project Pipeline Stages
export type ProjectStage = 
  | 'SETUP'
  | 'ACCOUNTS_CONNECTED'
  | 'ASSETS_READY'
  | 'ANALYSIS_PASSED'
  | 'READY_TO_LAUNCH'
  | 'LIVE';

// Asset Status System
export type AssetStatus = 
  | 'UPLOADED'
  | 'ANALYZED'
  | 'RISKY'
  | 'APPROVED';

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
export type CampaignObjective = 'conversion' | 'video_views';

// Platform-specific objective mappings
export const PLATFORM_OBJECTIVE_NAMES: Record<Platform, Record<CampaignObjective, string>> = {
  google: {
    conversion: 'Sales / Website Conversions',
    video_views: 'Video Engagement',
  },
  tiktok: {
    conversion: 'Conversion',
    video_views: 'Video Views',
  },
  snapchat: {
    conversion: 'Conversion',
    video_views: 'Video Views',
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
  content?: string;
  tags: AssetTag[];
  platforms: Platform[];
  createdAt: string;
  status: AssetStatus;
  analysisResult?: AssetAnalysisResult;
}

export interface AssetTag {
  type: 'hook' | 'emotion' | 'offer' | 'platform';
  value: string;
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

export interface AutomationRule {
  id: string;
  projectId: string;
  name: string;
  enabled: boolean;
  condition: RuleCondition;
  action: RuleAction;
  createdAt: string;
}

export interface RuleCondition {
  metric: 'cpc' | 'cpa' | 'ctr' | 'roas' | 'impressions' | 'spend';
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  value: number;
  afterImpressions?: number;
}

export interface RuleAction {
  type: 'pause' | 'increase_budget' | 'decrease_budget' | 'modify_creative' | 'trigger_recovery';
  value?: number;
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
