pub mod downloader;
pub mod engine;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalModelStatus {
    pub available: bool,
    pub engine: String,
    pub model_downloaded: bool,
    pub model_size_bytes: u64,
    pub download_progress: f64,
    pub download_phase: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Vec<FileNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexedFileSummary {
    pub path: String,
    pub language: String,
    pub size: u64,
    pub hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexSummary {
    pub indexed_files: u64,
    pub skipped_files: u64,
    pub total_files: u64,
    pub total_characters: u64,
    pub last_indexed_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceSnapshot {
    pub root_path: String,
    pub tree: FileNode,
    pub index_summary: IndexSummary,
    pub indexed_files: Vec<IndexedFileSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileDocument {
    pub path: String,
    pub absolute_path: String,
    pub content: String,
    pub language: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIRequest {
    pub messages: Vec<AIChatMessage>,
    pub current_file: Option<String>,
    pub selected_text: Option<String>,
    pub referenced_paths: Vec<String>,
    pub include_project_file_list: bool,
    pub action: String,
    pub api_base: Option<String>,
    pub api_key: Option<String>,
    pub model: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIResponse {
    pub message: String,
    pub diff: Option<String>,
    pub rewrite: Option<String>,
    pub referenced_files: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffApplyResult {
    pub changed_files: Vec<String>,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VelocitySettings {
    pub profile_name: String,
    pub theme: String,
    pub accent: String,
    pub font_size: u32,
    pub ui_scale: f64,
    pub startup_preset: String,
    pub animations: bool,
    pub ai: AISettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AISettings {
    pub provider_name: String,
    pub api_base: String,
    pub model: String,
    pub temperature: f64,
    pub system_prompt: String,
    pub api_key: Option<String>,
    pub use_local_model: bool,
}
