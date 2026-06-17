export interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  children?: FileNode[];
}

export interface IndexedFileSummary {
  path: string;
  language: string;
  size: number;
  hash: string;
}

export interface IndexSummary {
  indexed_files: number;
  skipped_files: number;
  total_files: number;
  total_characters: number;
  last_indexed_at: string;
}

export interface WorkspaceSnapshot {
  root_path: string;
  root?: string;
  tree: FileNode;
  index_summary: IndexSummary;
  indexed_files: IndexedFileSummary[];
}

export interface FileDocument {
  path: string;
  absolute_path: string;
  content: string;
  language: string;
}

export interface AIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIRequest {
  messages: AIChatMessage[];
  current_file?: string | null;
  selected_text?: string | null;
  referenced_paths: string[];
  include_project_file_list: boolean;
  action: 'chat' | 'insert' | 'replace_selection' | 'apply_diff' | 'explain' | 'refactor';
  api_base?: string | null;
  api_key?: string | null;
  model?: string | null;
  user_email?: string | null;
  is_owner?: boolean;
  temperature?: number;
  max_tokens?: number;
}

export interface AIResponse {
  message?: string;
  content?: string;
  diff?: string | null;
  rewrite?: string | null;
  referenced_files?: string[];
}

// Browser fallback responses use 'content' instead of 'message'
export interface BrowserAIResponse {
  content?: string;
  message?: string;
  diff?: string | null;
  rewrite?: string | null;
}

export interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  premium_tier: string | null;
  premium_expires_at: string | null;
}

export interface PremiumStatus {
  premium: boolean;
  tier: string | null;
  expires_at: string | null;
}

export interface DiffApplyResult {
  changed_files: string[];
  summary: string;
  success?: boolean;
  message?: string;
}

export interface QuotaInfo {
  used_today: number;
  daily_limit: number;
  is_owner: boolean;
  remaining: number;
}

export interface UserSettings {
  profile_name: string;
  theme: 'velocity-night' | 'midnight-blue' | 'graphite';
  accent: 'violet' | 'cyan' | 'emerald' | 'amber';
  font_size: number;
  ui_scale: number;
  startup_preset: 'ai-engineer' | 'minimal' | 'review-mode';
  animations: boolean;
  daily_ai_limit: number;
  usage_today: number;
  usage_date: string;
  ai: {
    provider_name: string;
    api_base: string;
    model: string;
    temperature: number;
    system_prompt: string;
    api_key?: string | null;
    use_local_model: boolean;
  };
}

export interface EditorTab extends FileDocument {
  title: string;
  isDirty: boolean;
  lastSavedContent: string;
}

export interface SelectionSnapshot {
  text: string;
  startLineNumber?: number;
  startColumn?: number;
  endLineNumber?: number;
  endColumn?: number;
}

export interface LocalModelStatus {
  available: boolean;
  engine: string;
  model_downloaded: boolean;
  model_size_bytes: number;
  download_progress: number;
  download_phase: string;
}
