export type Platform = 'google' | 'tiktok' | 'snapchat';

export type ConnectionStatus = 'not_connected' | 'connected' | 'limited_access';

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
