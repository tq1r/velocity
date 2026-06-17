#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod diff;
mod indexer;
mod local_model;
mod models;
mod settings;

use std::sync::Mutex;
use tokio::sync::Mutex as AsyncMutex;

pub struct AppState {
    pub workspace_root: Mutex<Option<String>>,
    pub index: Mutex<Option<indexer::ProjectIndex>>,
    pub settings: Mutex<models::VelocitySettings>,
    pub local_model: AsyncMutex<local_model::LocalModelManager>,
}

fn main() {
    let settings_settings = settings::load_or_default();
    let local_mgr = local_model::LocalModelManager::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            workspace_root: Mutex::new(None),
            index: Mutex::new(None),
            settings: Mutex::new(settings_settings),
            local_model: AsyncMutex::new(local_mgr),
        })
        .invoke_handler(tauri::generate_handler![
            commands::open_workspace,
            commands::get_workspace_snapshot,
            commands::read_workspace_file,
            commands::save_workspace_file,
            commands::create_entry,
            commands::rename_entry,
            commands::delete_entry,
            commands::apply_unified_diff,
            commands::run_ai_request,
            commands::search_files,
            commands::get_settings,
            commands::save_settings_command,
            commands::get_local_model_status,
            commands::start_local_model_download,
            commands::run_local_ai_request,
            commands::stream_ai_request,
            commands::get_inline_completion,
            commands::get_quota_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Velocity");
}
