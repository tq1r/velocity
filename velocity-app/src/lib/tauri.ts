import type {
  AIRequest,
  AIResponse,
  DiffApplyResult,
  FileDocument,
  LocalModelStatus,
  UserSettings,
  WorkspaceSnapshot,
  FileNode,
} from '../types';

let tauriInvoke: any = null;
let tauriListen: any = null;
let tauriDialogOpen: any = null;

async function initTauri() {
  try {
    const core = await import('@tauri-apps/api/core');
    tauriInvoke = core.invoke;
    const evt = await import('@tauri-apps/api/event');
    tauriListen = evt.listen;
    const dialog = await import('@tauri-apps/plugin-dialog');
    tauriDialogOpen = dialog.open;
  } catch {}
}

const STORAGE_KEY = 'velocity_settings';
const WORKSPACE_KEY = 'velocity_workspace';

function ls(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem('velocity_fs') || '{}'); }
  catch { return {}; }
}

function lsWrite(fs: Record<string, string>) {
  localStorage.setItem('velocity_fs', JSON.stringify(fs));
}

initTauri();

export const pickFolder = async (): Promise<string | null> => {
  if (tauriDialogOpen) {
    try {
      const selected = await tauriDialogOpen({ directory: true, multiple: false, title: 'Open project folder' });
      return typeof selected === 'string' ? selected : null;
    } catch { return null; }
  }
  if ('showDirectoryPicker' in window) {
    try {
      const handle = await (window as any).showDirectoryPicker();
      return handle.name;
    } catch { return null; }
  }
  const name = prompt('Enter project name:');
  return name || null;
};

export const getSettings = async (): Promise<UserSettings> => {
  if (tauriInvoke) {
    try { return await tauriInvoke('get_settings'); } catch {}
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { profile_name: '', theme: 'velocity-night', accent: 'violet', font_size: 14, ui_scale: 1.0, startup_preset: 'ai-engineer', animations: true, ai: { provider_name: 'openai', api_base: 'https://api.openai.com/v1', model: 'gpt-4', temperature: 0.2, system_prompt: '', api_key: '', use_local_model: false } };
};

export const saveSettings = async (settings: UserSettings): Promise<UserSettings> => {
  if (tauriInvoke) {
    try { return await tauriInvoke('save_settings_command', { settings }); } catch {}
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  return settings;
};

function buildTree(paths: string[]): FileNode[] {
  const root: Record<string, any> = {};
  for (const p of paths) {
    const parts = p.replace(/\\/g, '/').split('/');
    let cur = root;
    for (let i = 0; i < parts.length; i++) {
      if (!cur[parts[i]]) cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
  }
  function toNodes(obj: Record<string, any>, parent = ''): FileNode[] {
    return Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)).map(([name, children]) => {
      const path = parent ? `${parent}/${name}` : name;
      const is_dir = Object.keys(children).length > 0 || !name.includes('.');
      return { name, path, is_dir, children: is_dir ? toNodes(children, path) : undefined };
    });
  }
  return toNodes(root);
}

export const openWorkspace = async (path: string): Promise<WorkspaceSnapshot> => {
  if (tauriInvoke) {
    try { return await tauriInvoke('open_workspace', { path }); } catch {}
  }
  const fs = ls();
  const files = Object.keys(fs).filter(k => k.startsWith(path));
  return { root: path, tree: { name: path, path, is_dir: true, children: buildTree(files) } };
};

export const getWorkspaceSnapshot = async (): Promise<WorkspaceSnapshot | null> => {
  if (tauriInvoke) {
    try { return await tauriInvoke('get_workspace_snapshot'); } catch {}
  }
  try {
    const raw = localStorage.getItem(WORKSPACE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

export const readWorkspaceFile = async (relativePath: string): Promise<FileDocument> => {
  if (tauriInvoke) {
    try { return await tauriInvoke('read_workspace_file', { relativePath }); } catch {}
  }
  const fs = ls();
  const content = fs[relativePath] || '';
  const ext = relativePath.split('.').pop() || '';
  const langMap: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    rs: 'rust', py: 'python', go: 'go', java: 'java', cpp: 'cpp', c: 'c',
    html: 'html', css: 'css', scss: 'scss', json: 'json', md: 'markdown',
    yaml: 'yaml', yml: 'yaml', toml: 'toml', sql: 'sql', sh: 'shell',
    xml: 'xml', svg: 'xml', txt: 'plaintext',
  };
  return { path: relativePath, absolute_path: relativePath, content, language: langMap[ext] || 'plaintext' };
};

export const saveWorkspaceFile = async (relativePath: string, content: string): Promise<FileDocument> => {
  if (tauriInvoke) {
    try { return await tauriInvoke('save_workspace_file', { relativePath, content }); } catch {}
  }
  const fs = ls();
  fs[relativePath] = content;
  lsWrite(fs);
  return readWorkspaceFile(relativePath);
};

export const createEntry = async (parentPath: string, name: string, isDirectory: boolean): Promise<WorkspaceSnapshot> => {
  if (tauriInvoke) {
    try { return await tauriInvoke('create_entry', { parentPath, name, isDirectory }); } catch {}
  }
  const fullPath = parentPath ? `${parentPath}/${name}` : name;
  if (!isDirectory) {
    const fs = ls();
    if (!(fullPath in fs)) { fs[fullPath] = ''; lsWrite(fs); }
  }
  const ws = await getWorkspaceSnapshot();
  return ws || { root: '', tree: { name: '', path: '', is_dir: true, children: [] } };
};

export const renameEntry = async (path: string, newName: string): Promise<WorkspaceSnapshot> => {
  if (tauriInvoke) {
    try { return await tauriInvoke('rename_entry', { path, newName }); } catch {}
  }
  const fs = ls(); const entries = Object.keys(fs); const parts = path.split('/'); parts.pop();
  const newPath = [...parts, newName].join('/');
  for (const k of entries) {
    if (k === path || k.startsWith(path + '/')) { fs[newPath + k.slice(path.length)] = fs[k]; delete fs[k]; }
  }
  lsWrite(fs);
  return (await getWorkspaceSnapshot()) || { root: '', tree: { name: '', path: '', is_dir: true, children: [] } };
};

export const deleteEntry = async (path: string): Promise<WorkspaceSnapshot> => {
  if (tauriInvoke) {
    try { return await tauriInvoke('delete_entry', { path }); } catch {}
  }
  const fs = ls(); const entries = Object.keys(fs);
  for (const k of entries) { if (k === path || k.startsWith(path + '/')) delete fs[k]; }
  lsWrite(fs);
  return (await getWorkspaceSnapshot()) || { root: '', tree: { name: '', path: '', is_dir: true, children: [] } };
};

export const applyUnifiedDiff = async (diff: string): Promise<DiffApplyResult> => {
  if (tauriInvoke) {
    try { return await tauriInvoke('apply_unified_diff', { diff }); } catch {}
  }
  return { success: true, message: 'Diff apply not available in browser mode' };
};

export const runAIRequest = async (request: AIRequest): Promise<AIResponse> => {
  if (tauriInvoke) {
    try { return await tauriInvoke('run_ai_request', { request }); } catch {}
  }
  const settings = await getSettings();
  if (settings.ai.api_key) {
    try {
      const provider = settings.ai.provider_name;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      let url = ''; let body: any = {};
      if (provider === 'openai') {
        url = 'https://api.openai.com/v1/chat/completions';
        body = { model: settings.ai.model || 'gpt-4', messages: request.messages };
        headers['Authorization'] = `Bearer ${settings.ai.api_key}`;
      } else if (provider === 'anthropic') {
        url = 'https://api.anthropic.com/v1/messages';
        body = { model: settings.ai.model || 'claude-3-opus-20240229', messages: request.messages, max_tokens: request.max_tokens, temperature: request.temperature };
        headers['x-api-key'] = settings.ai.api_key;
        headers['anthropic-version'] = '2023-06-01';
      } else if (provider === 'google') {
        url = `https://generativelanguage.googleapis.com/v1beta/models/${settings.ai.model || 'gemini-pro'}:generateContent?key=${settings.ai.api_key}`;
        body = { contents: request.messages.map((m: any) => ({ role: m.role, parts: [{ text: m.content }] })) };
      }
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.choices?.[0]?.message?.content) return { content: data.choices[0].message.content };
      if (data.content?.[0]?.text) return { content: data.content[0].text };
      if (data.candidates?.[0]?.content?.parts?.[0]?.text) return { content: data.candidates[0].content.parts[0].text };
      return { content: `[response received - check Settings]` };
    } catch (e: any) {
      return { content: `API error: ${e.message}. Set your API key in Settings.` };
    }
  }
  return { content: 'Set your API key in Settings (gear icon) to use AI, or enable the local Velocity Model.' };
};

export const searchFiles = async (query: string): Promise<string[]> => {
  if (tauriInvoke) {
    try { return await tauriInvoke('search_files', { query }); } catch {}
  }
  const fs = ls();
  return Object.keys(fs).filter(k => k.toLowerCase().includes(query.toLowerCase()));
};

let fsListeners: Array<(event: unknown) => void> = [];

export const listenForFsChanges = (callback: (event: unknown) => void) => {
  if (tauriListen) {
    try {
      const unlisten = tauriListen('workspace://fs-changed', (event: any) => callback(event.payload));
      return unlisten;
    } catch {}
  }
  fsListeners.push(callback);
  return () => { fsListeners = fsListeners.filter(l => l !== callback); };
};

export const getLocalModelStatus = async (): Promise<LocalModelStatus> => {
  if (tauriInvoke) {
    try { return await tauriInvoke('get_local_model_status'); } catch {}
  }
  return { available: false, engine: 'unavailable', model_downloaded: false, model_size_bytes: 0, download_progress: 0, download_phase: 'Browser mode - local model requires desktop app' };
};

export const startLocalModelDownload = async (): Promise<string> => {
  if (tauriInvoke) {
    try { return await tauriInvoke('start_local_model_download'); } catch {}
  }
  return 'Local model download requires the desktop app. Set an API key in Settings.';
};

export const runLocalAIRequest = async (_request: AIRequest): Promise<AIResponse> => {
  if (tauriInvoke) {
    try { return await tauriInvoke('run_local_ai_request', { request: _request }); } catch {}
  }
  return { content: 'Local AI requires the desktop app. Set an API key in Settings to use cloud AI.' };
};

export const startAiStream = async (request: AIRequest): Promise<void> => {
  if (tauriInvoke) {
    try { await tauriInvoke('stream_ai_request', { request }); } catch {}
  }
};

export const listenForAiStream = async (
  onToken: (token: string) => void,
  onDone: (response: AIResponse) => void,
  onError: (error: string) => void,
): Promise<() => void> => {
  if (!tauriListen) {
    onError('Streaming requires the desktop app.');
    return () => {};
  }
  const unsubToken = await tauriListen('ai://stream-token', (event: any) => onToken(event.payload));
  const unsubDone = await tauriListen('ai://stream-done', (event: any) => onDone(event.payload));
  const unsubError = await tauriListen('ai://stream-error', (event: any) => onError(event.payload));
  return () => {
    if (typeof unsubToken === 'function') unsubToken();
    if (typeof unsubDone === 'function') unsubDone();
    if (typeof unsubError === 'function') unsubError();
  };
};

export const getInlineCompletion = async (prefix: string, suffix: string, language: string): Promise<string> => {
  if (tauriInvoke) {
    try { return await tauriInvoke('get_inline_completion', { prefix, suffix, language }); } catch {}
  }
  return '';
};
