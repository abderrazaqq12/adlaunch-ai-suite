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

export interface Campaign {
  id: string;
  projectId: string;
  name: string;
  platform: Platform;
  status: 'draft' | 'pending' | 'active' | 'paused' | 'completed' | 'disapproved';
  budget: number;
  objective: 'CPC' | 'CPA' | 'ROAS';
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
