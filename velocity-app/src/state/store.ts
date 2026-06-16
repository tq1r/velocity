import { create } from 'zustand';
import type {
  AIChatMessage,
  AIResponse,
  EditorTab,
  SelectionSnapshot,
  UserSettings,
  WorkspaceSnapshot,
  UserProfile,
  PremiumStatus,
  QuotaInfo,
} from '../types';

interface VelocityState {
  workspace: WorkspaceSnapshot | null;
  tabs: EditorTab[];
  activeTabPath: string | null;
  selection: SelectionSnapshot;
  aiMessages: AIChatMessage[];
  lastAIResponse: AIResponse | null;
  isAiWorking: boolean;
  commandPaletteOpen: boolean;
  settingsOpen: boolean;
  loginModalOpen: boolean;
  onboardingOpen: boolean;
  setupWizardOpen: boolean;
  statusText: string;
  settings: UserSettings | null;
  user: UserProfile | null;
  premium: PremiumStatus | null;
  quota: QuotaInfo | null;
  isOwner: boolean;
  setWorkspace: (workspace: WorkspaceSnapshot | null) => void;
  openTab: (tab: EditorTab) => void;
  updateTabContent: (path: string, content: string) => void;
  markSaved: (path: string, content: string) => void;
  closeTab: (path: string) => void;
  setActiveTab: (path: string | null) => void;
  setSelection: (selection: SelectionSnapshot) => void;
  pushAIMessage: (message: AIChatMessage) => void;
  replaceAIMessages: (messages: AIChatMessage[]) => void;
  setLastAIResponse: (response: AIResponse | null) => void;
  setAiWorking: (value: boolean) => void;
  setCommandPaletteOpen: (value: boolean) => void;
  setSettingsOpen: (value: boolean) => void;
  setLoginModalOpen: (value: boolean) => void;
  setOnboardingOpen: (value: boolean) => void;
  setSetupWizardOpen: (value: boolean) => void;
  setStatusText: (value: string) => void;
  setSettings: (settings: UserSettings) => void;
  setUser: (user: UserProfile | null) => void;
  setPremium: (premium: PremiumStatus | null) => void;
  setQuota: (quota: QuotaInfo | null) => void;
  setIsOwner: (isOwner: boolean) => void;
}

export const useVelocityStore = create<VelocityState>((set) => ({
  workspace: null,
  tabs: [],
  activeTabPath: null,
  selection: { text: '' },
  aiMessages: [
    {
      role: 'assistant',
      content:
        'Welcome to Velocity. Open a workspace, reference files, and ask me to explain, refactor, or generate diffs.',
    },
  ],
  lastAIResponse: null,
  isAiWorking: false,
  commandPaletteOpen: false,
  settingsOpen: false,
  loginModalOpen: false,
  onboardingOpen: true,
  setupWizardOpen: false,
  statusText: 'Ready',
  settings: null,
  user: null,
  premium: null,
  quota: null,
  isOwner: false,
  setWorkspace: (workspace) => set({ workspace }),
  openTab: (tab) =>
    set((state) => {
      const existing = state.tabs.find((item) => item.path === tab.path);
      if (existing) {
        return {
          activeTabPath: tab.path,
          tabs: state.tabs.map((item) => (item.path === tab.path ? { ...existing, ...tab } : item)),
        };
      }

      return {
        tabs: [...state.tabs, tab],
        activeTabPath: tab.path,
      };
    }),
  updateTabContent: (path, content) =>
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.path === path ? { ...tab, content, isDirty: content !== tab.lastSavedContent } : tab,
      ),
    })),
  markSaved: (path, content) =>
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.path === path ? { ...tab, content, lastSavedContent: content, isDirty: false } : tab,
      ),
      statusText: `Saved ${path}`,
    })),
  closeTab: (path) =>
    set((state) => {
      const tabs = state.tabs.filter((tab) => tab.path !== path);
      const activeTabPath =
        state.activeTabPath === path ? tabs[tabs.length - 1]?.path ?? null : state.activeTabPath;

      return { tabs, activeTabPath };
    }),
  setActiveTab: (activeTabPath) => set({ activeTabPath }),
  setSelection: (selection) => set({ selection }),
  pushAIMessage: (message) => set((state) => ({ aiMessages: [...state.aiMessages, message] })),
  replaceAIMessages: (aiMessages) => set({ aiMessages }),
  setLastAIResponse: (lastAIResponse) => set({ lastAIResponse }),
  setAiWorking: (isAiWorking) => set({ isAiWorking }),
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setLoginModalOpen: (loginModalOpen) => set({ loginModalOpen }),
  setOnboardingOpen: (onboardingOpen) => set({ onboardingOpen }),
  setSetupWizardOpen: (setupWizardOpen) => set({ setupWizardOpen }),
  setStatusText: (statusText) => set({ statusText }),
  setSettings: (settings) => set({ settings }),
  setUser: (user) => set({ user }),
  setPremium: (premium) => set({ premium }),
  setQuota: (quota) => set({ quota }),
  setIsOwner: (isOwner) => set({ isOwner }),
}));
