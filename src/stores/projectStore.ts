import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { 
  Project, 
  AdAccountConnection, 
  Asset, 
  Campaign, 
  AutomationRule, 
  User,
  ProjectStage,
  AssetStatus,
  AssetAnalysisResult,
  CampaignIntent,
  Platform,
  RuleExecutionLog,
} from '@/types';

interface ProjectState {
  user: User | null;
  projects: Project[];
  currentProject: Project | null;
  assets: Asset[];
  campaigns: Campaign[];
  rules: AutomationRule[];
  ruleExecutionLogs: RuleExecutionLog[];
  campaignIntents: CampaignIntent[];
  
  // Auth actions
  setUser: (user: User | null) => void;
  
  // Project actions (internal)
  setCurrentProject: (project: Project | null) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  updateProjectStage: (projectId: string, stage: ProjectStage) => void;
  
  // Auto-project: ensures a project exists, creates one silently if needed
  ensureProject: () => Project;
  
  // Connection actions
  addConnection: (projectId: string, connection: AdAccountConnection) => void;
  updateConnection: (projectId: string, connectionId: string, updates: Partial<AdAccountConnection>) => void;
  removeConnection: (projectId: string, connectionId: string) => void;
  getAccountsForPlatform: (projectId: string, platform: Platform) => AdAccountConnection[];
  
  // Asset actions
  addAsset: (asset: Asset) => void;
  removeAsset: (id: string) => void;
  updateAsset: (id: string, updates: Partial<Asset>) => void;
  updateAssetStatus: (id: string, status: AssetStatus, analysisResult?: AssetAnalysisResult) => void;
  
  // Campaign Intent actions
  addCampaignIntent: (intent: CampaignIntent) => void;
  updateCampaignIntent: (id: string, updates: Partial<CampaignIntent>) => void;
  removeCampaignIntent: (id: string) => void;
  
  // Campaign actions
  addCampaign: (campaign: Campaign) => void;
  updateCampaign: (id: string, updates: Partial<Campaign>) => void;
  
  // Rule actions
  addRule: (rule: AutomationRule) => void;
  updateRule: (id: string, updates: Partial<AutomationRule>) => void;
  removeRule: (id: string) => void;
  addRuleExecutionLog: (log: RuleExecutionLog) => void;
  getRuleExecutionLogs: (projectId: string) => RuleExecutionLog[];

  // Pipeline validation helpers
  getProjectStage: (projectId: string) => ProjectStage;
  canAccessStage: (projectId: string, requiredStage: ProjectStage) => boolean;
  getStageBlockReason: (projectId: string, requiredStage: ProjectStage) => string | null;
  hasApprovedAssets: (projectId: string) => boolean;
  hasConnectedAccounts: (projectId: string) => boolean;
  canLaunchOnAnyPlatform: (projectId: string) => boolean;
  recalculateProjectStage: (projectId: string) => void;
}

const STAGE_ORDER: ProjectStage[] = [
  'SETUP',
  'ACCOUNTS_CONNECTED',
  'ASSETS_READY',
  'ANALYSIS_PASSED',
  'READY_TO_LAUNCH',
  'LIVE',
];

const getStageIndex = (stage: ProjectStage): number => {
  return STAGE_ORDER.indexOf(stage);
};

const createDefaultProject = (): Project => ({
  id: `proj_${Date.now()}`,
  name: 'My Ad Campaigns',
  targetMarket: 'US',
  language: 'en',
  currency: 'USD',
  defaultPlatforms: ['google', 'tiktok', 'snapchat'],
  createdAt: new Date().toISOString(),
  connections: [],
  stage: 'SETUP',
});

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      user: null,
      projects: [],
      currentProject: null,
      assets: [],
      campaigns: [],
      rules: [],
      ruleExecutionLogs: [],
      campaignIntents: [],
      
      setUser: (user) => set({ user }),
      
      setCurrentProject: (project) => set({ currentProject: project }),
      
      addProject: (project) => set((state) => ({
        projects: [...state.projects, { ...project, stage: 'SETUP' }],
        currentProject: { ...project, stage: 'SETUP' },
      })),
      
      updateProject: (id, updates) => set((state) => ({
        projects: state.projects.map((p) => p.id === id ? { ...p, ...updates } : p),
        currentProject: state.currentProject?.id === id 
          ? { ...state.currentProject, ...updates } 
          : state.currentProject,
      })),

      updateProjectStage: (projectId, stage) => set((state) => ({
        projects: state.projects.map((p) => p.id === projectId ? { ...p, stage } : p),
        currentProject: state.currentProject?.id === projectId
          ? { ...state.currentProject, stage }
          : state.currentProject,
      })),

      // Auto-project creation: silently creates a project if none exists
      ensureProject: () => {
        const state = get();
        
        // If we already have a current project, return it
        if (state.currentProject) {
          return state.currentProject;
        }
        
        // If we have any projects, set the first one as current
        if (state.projects.length > 0) {
          const project = state.projects[0];
          set({ currentProject: project });
          return project;
        }
        
        // Create a new default project silently
        const newProject = createDefaultProject();
        
        set({
          projects: [newProject],
          currentProject: newProject,
        });
        
        return newProject;
      },
      
      addConnection: (projectId, connection) => {
        set((state) => ({
          projects: state.projects.map((p) => 
            p.id === projectId 
              ? { ...p, connections: [...p.connections, connection] }
              : p
          ),
          currentProject: state.currentProject?.id === projectId
            ? { ...state.currentProject, connections: [...state.currentProject.connections, connection] }
            : state.currentProject,
        }));
        get().recalculateProjectStage(projectId);
      },
      
      updateConnection: (projectId, connectionId, updates) => set((state) => ({
        projects: state.projects.map((p) =>
          p.id === projectId
            ? {
                ...p,
                connections: p.connections.map((c) =>
                  c.id === connectionId ? { ...c, ...updates } : c
                ),
              }
            : p
        ),
        currentProject: state.currentProject?.id === projectId
          ? {
              ...state.currentProject,
              connections: state.currentProject.connections.map((c) =>
                c.id === connectionId ? { ...c, ...updates } : c
              ),
            }
          : state.currentProject,
      })),

      removeConnection: (projectId, connectionId) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? { ...p, connections: p.connections.filter(c => c.id !== connectionId) }
              : p
          ),
          currentProject: state.currentProject?.id === projectId
            ? { ...state.currentProject, connections: state.currentProject.connections.filter(c => c.id !== connectionId) }
            : state.currentProject,
        }));
        get().recalculateProjectStage(projectId);
      },

      getAccountsForPlatform: (projectId, platform) => {
        const state = get();
        const project = state.projects.find(p => p.id === projectId);
        if (!project) return [];
        return project.connections.filter(
          c => c.platform === platform && (c.status === 'connected' || c.status === 'limited_access')
        );
      },
      
      addAsset: (asset) => {
        const state = get();
        // Auto-create project if needed
        const project = state.ensureProject();
        const assetWithStatus: Asset = { 
          ...asset, 
          status: 'UPLOADED',
          projectId: asset.projectId || project.id,
        };
        set((state) => ({ assets: [...state.assets, assetWithStatus] }));
        get().recalculateProjectStage(assetWithStatus.projectId);
      },
      
      removeAsset: (id) => {
        const state = get();
        const asset = state.assets.find(a => a.id === id);
        set((state) => ({
          assets: state.assets.filter((a) => a.id !== id),
        }));
        if (asset?.projectId) {
          get().recalculateProjectStage(asset.projectId);
        }
      },
      
      updateAsset: (id, updates) => set((state) => ({
        assets: state.assets.map((a) => a.id === id ? { ...a, ...updates } : a),
      })),

      updateAssetStatus: (id, status, analysisResult) => {
        set((state) => ({
          assets: state.assets.map((a) => 
            a.id === id 
              ? { ...a, status, analysisResult: analysisResult || a.analysisResult } 
              : a
          ),
        }));
        const asset = get().assets.find(a => a.id === id);
        if (asset?.projectId) {
          get().recalculateProjectStage(asset.projectId);
        }
      },

      // Campaign Intent actions
      addCampaignIntent: (intent) => set((state) => ({
        campaignIntents: [...state.campaignIntents, intent],
      })),

      updateCampaignIntent: (id, updates) => set((state) => ({
        campaignIntents: state.campaignIntents.map(i => i.id === id ? { ...i, ...updates } : i),
      })),

      removeCampaignIntent: (id) => set((state) => ({
        campaignIntents: state.campaignIntents.filter(i => i.id !== id),
      })),
      
      addCampaign: (campaign) => {
        const state = get();
        // Auto-create project if needed
        const project = state.ensureProject();
        const campaignWithProject = {
          ...campaign,
          projectId: campaign.projectId || project.id,
        };
        set((state) => ({
          campaigns: [...state.campaigns, campaignWithProject],
        }));
        get().updateProjectStage(campaignWithProject.projectId, 'LIVE');
      },
      
      updateCampaign: (id, updates) => set((state) => ({
        campaigns: state.campaigns.map((c) => c.id === id ? { ...c, ...updates } : c),
      })),
      
      addRule: (rule) => set((state) => ({ rules: [...state.rules, rule] })),
      
      updateRule: (id, updates) => set((state) => ({
        rules: state.rules.map((r) => r.id === id ? { ...r, ...updates } : r),
      })),
      
      removeRule: (id) => set((state) => ({
        rules: state.rules.filter((r) => r.id !== id),
      })),

      addRuleExecutionLog: (log) => set((state) => ({
        ruleExecutionLogs: [log, ...state.ruleExecutionLogs].slice(0, 100), // Keep last 100 logs
      })),

      getRuleExecutionLogs: (projectId) => {
        return get().ruleExecutionLogs.filter(log => log.projectId === projectId);
      },

      // Pipeline validation helpers
      getProjectStage: (projectId) => {
        const state = get();
        const project = state.projects.find(p => p.id === projectId);
        return project?.stage || 'SETUP';
      },

      canAccessStage: (projectId, requiredStage) => {
        const currentStage = get().getProjectStage(projectId);
        return getStageIndex(currentStage) >= getStageIndex(requiredStage);
      },

      getStageBlockReason: (projectId, requiredStage) => {
        const state = get();
        const project = state.projects.find(p => p.id === projectId);
        
        if (!project) return null; // No blocking - will auto-create
        
        const currentStageIndex = getStageIndex(project.stage);
        const requiredStageIndex = getStageIndex(requiredStage);
        
        if (currentStageIndex >= requiredStageIndex) return null;

        switch (requiredStage) {
          case 'ACCOUNTS_CONNECTED':
            return 'Connect at least one ad account to continue';
          case 'ASSETS_READY':
            if (!state.hasConnectedAccounts(projectId)) {
              return 'Connect at least one ad account first';
            }
            return 'Upload at least one asset to continue';
          case 'ANALYSIS_PASSED':
            if (!state.hasApprovedAssets(projectId)) {
              return 'Run pre-launch analysis and get at least one approved asset';
            }
            return 'Complete pre-launch analysis to unlock launch';
          case 'READY_TO_LAUNCH':
            if (!state.hasApprovedAssets(projectId)) {
              return 'No approved assets. Run analysis first.';
            }
            if (!state.canLaunchOnAnyPlatform(projectId)) {
              return 'No platform has launch permission. Check your ad account connections.';
            }
            return 'Configure launch settings to continue';
          case 'LIVE':
            return 'Launch a campaign to access monitoring';
          default:
            return null;
        }
      },

      hasApprovedAssets: (projectId) => {
        const state = get();
        return state.assets.some(
          a => a.projectId === projectId && a.status === 'APPROVED'
        );
      },

      hasConnectedAccounts: (projectId) => {
        const state = get();
        const project = state.projects.find(p => p.id === projectId);
        return project?.connections.some(c => c.status === 'connected' || c.status === 'limited_access') ?? false;
      },

      canLaunchOnAnyPlatform: (projectId) => {
        const state = get();
        const project = state.projects.find(p => p.id === projectId);
        return project?.connections.some(c => c.permissions.canLaunch) ?? false;
      },

      recalculateProjectStage: (projectId) => {
        const state = get();
        const project = state.projects.find(p => p.id === projectId);
        if (!project) return;

        const projectAssets = state.assets.filter(a => a.projectId === projectId);
        const hasConnections = state.hasConnectedAccounts(projectId);
        const hasAssets = projectAssets.length > 0;
        const hasApproved = state.hasApprovedAssets(projectId);
        const hasCampaigns = state.campaigns.some(c => c.projectId === projectId);

        let newStage: ProjectStage = 'SETUP';

        if (hasCampaigns) {
          newStage = 'LIVE';
        } else if (hasApproved && state.canLaunchOnAnyPlatform(projectId)) {
          newStage = 'READY_TO_LAUNCH';
        } else if (hasApproved) {
          newStage = 'ANALYSIS_PASSED';
        } else if (hasAssets) {
          newStage = 'ASSETS_READY';
        } else if (hasConnections) {
          newStage = 'ACCOUNTS_CONNECTED';
        }

        if (project.stage !== newStage) {
          get().updateProjectStage(projectId, newStage);
        }
      },
    }),
    {
      name: 'adlaunch-storage',
    }
  )
);
