import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Project, AdAccountConnection, Asset, Campaign, AutomationRule, User } from '@/types';

interface ProjectState {
  user: User | null;
  projects: Project[];
  currentProject: Project | null;
  assets: Asset[];
  campaigns: Campaign[];
  rules: AutomationRule[];
  
  // Auth actions
  setUser: (user: User | null) => void;
  
  // Project actions
  setCurrentProject: (project: Project | null) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  
  // Connection actions
  addConnection: (projectId: string, connection: AdAccountConnection) => void;
  updateConnection: (projectId: string, connectionId: string, updates: Partial<AdAccountConnection>) => void;
  
  // Asset actions
  addAsset: (asset: Asset) => void;
  removeAsset: (id: string) => void;
  updateAsset: (id: string, updates: Partial<Asset>) => void;
  
  // Campaign actions
  addCampaign: (campaign: Campaign) => void;
  updateCampaign: (id: string, updates: Partial<Campaign>) => void;
  
  // Rule actions
  addRule: (rule: AutomationRule) => void;
  updateRule: (id: string, updates: Partial<AutomationRule>) => void;
  removeRule: (id: string) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      user: null,
      projects: [],
      currentProject: null,
      assets: [],
      campaigns: [],
      rules: [],
      
      setUser: (user) => set({ user }),
      
      setCurrentProject: (project) => set({ currentProject: project }),
      
      addProject: (project) => set((state) => ({
        projects: [...state.projects, project],
        currentProject: project,
      })),
      
      updateProject: (id, updates) => set((state) => ({
        projects: state.projects.map((p) => p.id === id ? { ...p, ...updates } : p),
        currentProject: state.currentProject?.id === id 
          ? { ...state.currentProject, ...updates } 
          : state.currentProject,
      })),
      
      addConnection: (projectId, connection) => set((state) => ({
        projects: state.projects.map((p) => 
          p.id === projectId 
            ? { ...p, connections: [...p.connections, connection] }
            : p
        ),
        currentProject: state.currentProject?.id === projectId
          ? { ...state.currentProject, connections: [...state.currentProject.connections, connection] }
          : state.currentProject,
      })),
      
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
      
      addAsset: (asset) => set((state) => ({ assets: [...state.assets, asset] })),
      
      removeAsset: (id) => set((state) => ({
        assets: state.assets.filter((a) => a.id !== id),
      })),
      
      updateAsset: (id, updates) => set((state) => ({
        assets: state.assets.map((a) => a.id === id ? { ...a, ...updates } : a),
      })),
      
      addCampaign: (campaign) => set((state) => ({
        campaigns: [...state.campaigns, campaign],
      })),
      
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
    }),
    {
      name: 'adlaunch-storage',
    }
  )
);
