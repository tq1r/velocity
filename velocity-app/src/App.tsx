import { useEffect, useState, useCallback } from 'react';
import { useVelocityStore } from './state/store';
import { pickFolder, openWorkspace, getWorkspaceSnapshot, readWorkspaceFile, saveWorkspaceFile, createEntry, renameEntry, deleteEntry, getSettings, getQuotaInfo, listenForFsChanges } from './lib/tauri';
import type { FileNode, EditorTab } from './types';
import { ActivityBar } from './components/ActivityBar';
import { FileExplorer } from './components/FileExplorer';
import { TabBar } from './components/TabBar';
import { MonacoEditor } from './components/MonacoEditor';
import { AIPanel } from './components/AIPanel';
import { StatusBar } from './components/StatusBar';
import { CommandPalette } from './components/CommandPalette';
import { SettingsModal } from './components/SettingsModal';
import { OnboardingModal } from './components/OnboardingModal';
import { SearchPanel } from './components/SearchPanel';
import { SetupWizard } from './components/SetupWizard';
import { LoginModal } from './components/LoginModal';
import { setAuthToken, checkSession, getPremiumStatus } from './lib/api';

type SidebarView = 'files' | 'search';
type AIAction = 'chat' | 'explain' | 'refactor' | 'edit';

export default function App() {
  const store = useVelocityStore();
  const [sidebarView, setSidebarView] = useState<SidebarView>('files');
  const [aiAction, setAIAction] = useState<AIAction>('chat');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: FileNode } | null>(null);
  const [setupDone, setSetupDone] = useState(false);

  useEffect(() => {
    getSettings().then((s) => {
      store.setSettings(s);
      document.documentElement.setAttribute('data-theme', s.theme);
      document.documentElement.setAttribute('data-accent', s.accent);
      document.documentElement.style.fontSize = `${s.font_size}px`;
      document.documentElement.style.setProperty('--ui-scale', String(s.ui_scale));
      if (!s.animations) {
        document.documentElement.classList.add('no-animations');
      } else {
        document.documentElement.classList.remove('no-animations');
      }
      if (s.ai.use_local_model) {
        store.setStatusText('Velocity Model ready');
      }
    }).catch(() => {});

    const token = localStorage.getItem('velocity-auth-token');
    if (token) {
      setAuthToken(token);
      checkSession().then((user) => {
        store.setUser(user);
        getPremiumStatus().then((p) => store.setPremium(p)).catch(() => {});
        getQuotaInfo(user.email || '').then((q) => store.setQuota(q)).catch(() => {});
      }).catch(() => {
        localStorage.removeItem('velocity-auth-token');
      });
    }

    const checkSetup = async () => {
      try {
        const settings = await getSettings();
        store.setSettings(settings);
        document.documentElement.setAttribute('data-theme', settings.theme);
        document.documentElement.setAttribute('data-accent', settings.accent);
        if (settings.profile_name && settings.profile_name !== '') {
          setSetupDone(true);
        }
      } catch {
        setSetupDone(false);
      }
    };
    checkSetup();

    getWorkspaceSnapshot().then((ws) => {
      if (ws) store.setWorkspace(ws);
    }).catch(() => {});

    listenForFsChanges(() => {
      getWorkspaceSnapshot().then((ws) => {
        if (ws) store.setWorkspace(ws);
      }).catch(() => {});
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        store.setCommandPaletteOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        store.setSettingsOpen(true);
      }
      if (e.key === 'Escape') {
        store.setCommandPaletteOpen(false);
        store.setSettingsOpen(false);
        store.setOnboardingOpen(false);
        setContextMenu(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const handleSetupComplete = useCallback(() => {
    setSetupDone(true);
    store.setSetupWizardOpen(false);
  }, []);

  const handleOpenFolder = useCallback(async () => {
    const path = await pickFolder();
    if (path) {
      const ws = await openWorkspace(path);
      store.setWorkspace(ws);
    }
  }, []);

  const handleFileSelect = useCallback(async (node: FileNode) => {
    if (node.is_dir) return;
    const existing = store.tabs.find((t) => t.path === node.path);
    if (existing) {
      store.setActiveTab(node.path);
      return;
    }
    const doc = await readWorkspaceFile(node.path);
    const tab: EditorTab = {
      path: doc.path,
      absolute_path: doc.absolute_path,
      content: doc.content,
      language: doc.language,
      title: doc.path.split('/').pop() || doc.path,
      isDirty: false,
      lastSavedContent: doc.content,
    };
    store.openTab(tab);
  }, []);

  const handleTabClose = useCallback(async (path: string) => {
    store.closeTab(path);
  }, []);

  const handleEditorChange = useCallback((content: string) => {
    if (store.activeTabPath) {
      store.updateTabContent(store.activeTabPath, content);
    }
  }, [store.activeTabPath]);

  const handleSave = useCallback(async () => {
    if (!store.activeTabPath) return;
    const tab = store.tabs.find((t) => t.path === store.activeTabPath);
    if (!tab || !tab.isDirty) return;
    await saveWorkspaceFile(tab.path, tab.content);
    store.markSaved(tab.path, tab.content);
  }, [store.activeTabPath, store.tabs]);

  useEffect(() => {
    const handleSaveKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleSaveKey);
    return () => window.removeEventListener('keydown', handleSaveKey);
  }, [handleSave]);

  const handleContextMenu = useCallback((e: React.MouseEvent, node: FileNode) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  }, []);

  const handleRename = useCallback(async (path: string, newName: string) => {
    const ws = await renameEntry(path, newName);
    store.setWorkspace(ws);
  }, []);

  const handleDelete = useCallback(async (path: string) => {
    const ws = await deleteEntry(path);
    store.setWorkspace(ws);
    if (store.tabs.some((t) => t.path === path)) {
      store.closeTab(path);
    }
  }, []);

  const handleNewFile = useCallback(async (parentPath: string) => {
    const name = prompt('Enter file name:');
    if (!name) return;
    const ws = await createEntry(parentPath, name, false);
    store.setWorkspace(ws);
    const newPath = parentPath ? `${parentPath}/${name}` : name;
    const doc = await readWorkspaceFile(newPath);
    const tab: EditorTab = {
      path: doc.path,
      absolute_path: doc.absolute_path,
      content: doc.content,
      language: doc.language,
      title: name,
      isDirty: false,
      lastSavedContent: doc.content,
    };
    store.openTab(tab);
  }, []);

  const handleNewFolder = useCallback(async (parentPath: string) => {
    const name = prompt('Enter folder name:');
    if (!name) return;
    const ws = await createEntry(parentPath, name, true);
    store.setWorkspace(ws);
  }, []);

  const activeTab = store.tabs.find((t) => t.path === store.activeTabPath);
  const showSetupWizard = !setupDone;

  return (
    <div className="app-layout">
      <div className="app-body">
        <ActivityBar
          sidebarView={sidebarView}
          onViewChange={setSidebarView}
          onOpenFolder={handleOpenFolder}
          onOpenSettings={() => store.setSettingsOpen(true)}
          onLogin={() => store.setLoginModalOpen(true)}
          user={store.user}
        />
        {store.workspace && sidebarView === 'files' && (
          <div className="sidebar">
            <div className="sidebar-header">
              <span>Explorer</span>
              <div className="sidebar-header-actions">
                <button className="sidebar-header-btn" title="New File" onClick={() => handleNewFile('')}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                </button>
                <button className="sidebar-header-btn" title="New Folder" onClick={() => handleNewFolder('')}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                </button>
              </div>
            </div>
            <div className="sidebar-content">
              <FileExplorer
                nodes={store.workspace?.tree?.children || []}
                depth={0}
                activePath={store.activeTabPath}
                onSelect={handleFileSelect}
                onContextMenu={handleContextMenu}
              />
            </div>
          </div>
        )}
        {store.workspace && sidebarView === 'search' && (
          <div className="sidebar">
            <div className="sidebar-header">
              <span>Search</span>
            </div>
            <SearchPanel onFileSelect={handleFileSelect} />
          </div>
        )}
        <div className="editor-area">
          <TabBar
            tabs={store.tabs}
            activePath={store.activeTabPath}
            onSelect={store.setActiveTab}
            onClose={handleTabClose}
          />
          <div className="editor-container">
            {activeTab ? (
              <MonacoEditor
                key={activeTab.path}
                content={activeTab.content}
                language={activeTab.language}
                path={activeTab.path}
                onChange={handleEditorChange}
                onSelectionChange={store.setSelection}
              />
            ) : store.workspace ? (
              <div className="editor-welcome">
                <svg width="56" height="56" viewBox="0 0 512 512" fill="none" style={{ opacity: 0.15 }}>
                  <defs>
                    <linearGradient id="v-logo-welcome" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#a78bfa"/>
                      <stop offset="100%" stopColor="#818cf8"/>
                    </linearGradient>
                  </defs>
                  <path d="M96 96 L256 416 L416 96" stroke="url(#v-logo-welcome)" strokeWidth="48" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                </svg>
                <h1>Velocity</h1>
                <p>Open a file from the explorer, or press <strong>⌘P</strong> to search files.</p>
              </div>
            ) : (
              <div className="file-dropzone animate-in" onClick={handleOpenFolder}>
                <svg width="80" height="80" viewBox="0 0 512 512" fill="none" style={{ opacity: 0.12 }}>
                  <defs>
                    <linearGradient id="v-logo-drop" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#a78bfa"/>
                      <stop offset="100%" stopColor="#818cf8"/>
                    </linearGradient>
                  </defs>
                  <path d="M96 96 L256 416 L416 96" stroke="url(#v-logo-drop)" strokeWidth="48" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                </svg>
                <h2>Open a Project</h2>
                <p>Open a folder to start coding with Velocity's AI-powered editor.</p>
                <button className="open-btn">Open Folder</button>
              </div>
            )}
          </div>
        </div>
        <AIPanel
          action={aiAction}
          onActionChange={setAIAction}
        />
      </div>
      <StatusBar onSave={handleSave} />
      {contextMenu && (
        <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <div className="context-menu-item" onClick={() => { handleRename(contextMenu.node.path, prompt('New name:', contextMenu.node.name) || contextMenu.node.name); setContextMenu(null); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
            Rename
          </div>
          <div className="context-menu-item danger" onClick={() => { if (confirm(`Delete ${contextMenu.node.name}?`)) handleDelete(contextMenu.node.path); setContextMenu(null); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            Delete
          </div>
          <div className="context-menu-separator" />
          <div className="context-menu-item" onClick={() => { handleNewFile(contextMenu.node.is_dir ? contextMenu.node.path : ''); setContextMenu(null); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
            New File
          </div>
          <div className="context-menu-item" onClick={() => { handleNewFolder(contextMenu.node.is_dir ? contextMenu.node.path : ''); setContextMenu(null); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            New Folder
          </div>
        </div>
      )}
      {store.commandPaletteOpen && <CommandPalette onFileSelect={handleFileSelect} onClose={() => store.setCommandPaletteOpen(false)} />}
      {store.settingsOpen && <SettingsModal onClose={() => store.setSettingsOpen(false)} />}
      {store.onboardingOpen && <OnboardingModal onClose={() => store.setOnboardingOpen(false)} onOpenFolder={handleOpenFolder} />}
      {showSetupWizard && <SetupWizard onComplete={handleSetupComplete} />}
      {store.loginModalOpen && <LoginModal onClose={() => store.setLoginModalOpen(false)} />}
    </div>
  );
}
