use crate::diff;
use crate::indexer::ProjectIndex;
use crate::models::*;
use crate::settings;
use crate::AppState;
use futures_util::StreamExt;
use notify::{Config, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::fs;
use std::path::PathBuf;
use std::time::Duration;
use tauri::{Emitter, Manager, State};

#[tauri::command]
pub fn open_workspace(
    path: String,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<WorkspaceSnapshot, String> {
    let root = PathBuf::from(&path);
    if !root.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    let index = ProjectIndex::new(root.clone()).map_err(|e| e.to_string())?;
    let snapshot = index.snapshot();

    *state.workspace_root.lock().unwrap() = Some(path.clone());
    *state.index.lock().unwrap() = Some(index);

    let handle = app.clone();
    std::thread::spawn(move || {
        let (tx, rx) = std::sync::mpsc::channel();
        if let Ok(mut watcher) = RecommendedWatcher::new(tx, Config::default()) {
            if watcher.watch(&root, RecursiveMode::Recursive).is_ok() {
                let debounce = Duration::from_millis(500);
                let mut last = std::time::Instant::now();
                while let Ok(Ok(event)) = rx.recv() {
                    match event.kind {
                        EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_) => {
                            if last.elapsed() >= debounce {
                                let _ = handle.emit("workspace://fs-changed", ());
                                last = std::time::Instant::now();
                            }
                        }
                        _ => {}
                    }
                }
            }
        }
    });

    Ok(snapshot)
}

#[tauri::command]
pub fn get_workspace_snapshot(state: State<'_, AppState>) -> Result<Option<WorkspaceSnapshot>, String> {
    let index = state.index.lock().unwrap();
    Ok(index.as_ref().map(|i| i.snapshot()))
}

#[tauri::command]
pub fn read_workspace_file(
    relative_path: String,
    state: State<'_, AppState>,
) -> Result<FileDocument, String> {
    let root = state
        .workspace_root
        .lock()
        .unwrap()
        .clone()
        .ok_or_else(|| "No workspace open".to_string())?;

    let abs = PathBuf::from(&root).join(&relative_path);
    let content = fs::read_to_string(&abs)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let index = state.index.lock().unwrap();
    let language = index
        .as_ref()
        .and_then(|i| i.get_file_language(&relative_path))
        .unwrap_or("text")
        .to_string();

    Ok(FileDocument {
        path: relative_path,
        absolute_path: abs.to_string_lossy().to_string(),
        content,
        language,
    })
}

#[tauri::command]
pub fn save_workspace_file(
    relative_path: String,
    content: String,
    state: State<'_, AppState>,
) -> Result<FileDocument, String> {
    let root = state
        .workspace_root
        .lock()
        .unwrap()
        .clone()
        .ok_or_else(|| "No workspace open".to_string())?;

    let abs = PathBuf::from(&root).join(&relative_path);
    if let Some(parent) = abs.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create dirs: {}", e))?;
    }
    fs::write(&abs, &content).map_err(|e| format!("Failed to write file: {}", e))?;

    if let Some(ref mut index) = *state.index.lock().unwrap() {
        let lang = crate::indexer::language_from_path(&abs);
        let hash = crate::indexer::compute_hash(content.as_bytes());
        index.files.insert(
            relative_path.clone(),
            crate::indexer::IndexedEntry {
                content: content.clone(),
                language: lang.clone(),
                size: content.len() as u64,
                hash,
            },
        );
    }

    Ok(FileDocument {
        path: relative_path,
        absolute_path: abs.to_string_lossy().to_string(),
        content,
        language: "text".into(),
    })
}

#[tauri::command]
pub fn create_entry(
    parent_path: String,
    name: String,
    is_directory: bool,
    state: State<'_, AppState>,
) -> Result<WorkspaceSnapshot, String> {
    let root = state
        .workspace_root
        .lock()
        .unwrap()
        .clone()
        .ok_or_else(|| "No workspace open".to_string())?;

    let target = PathBuf::from(&root).join(&parent_path).join(&name);
    if is_directory {
        fs::create_dir_all(&target).map_err(|e| format!("Failed to create directory: {}", e))?;
    } else {
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create parent: {}", e))?;
        }
        fs::write(&target, "").map_err(|e| format!("Failed to create file: {}", e))?;
    }

    let index = ProjectIndex::new(PathBuf::from(&root)).map_err(|e| e.to_string())?;
    let snapshot = index.snapshot();
    *state.index.lock().unwrap() = Some(index);
    Ok(snapshot)
}

#[tauri::command]
pub fn rename_entry(
    path: String,
    new_name: String,
    state: State<'_, AppState>,
) -> Result<WorkspaceSnapshot, String> {
    let root = state
        .workspace_root
        .lock()
        .unwrap()
        .clone()
        .ok_or_else(|| "No workspace open".to_string())?;

    let abs = PathBuf::from(&root).join(&path);
    let parent = abs.parent().ok_or("Cannot rename root")?;
    let new_abs = parent.join(&new_name);
    fs::rename(&abs, &new_abs).map_err(|e| format!("Failed to rename: {}", e))?;

    let index = ProjectIndex::new(PathBuf::from(&root)).map_err(|e| e.to_string())?;
    let snapshot = index.snapshot();
    *state.index.lock().unwrap() = Some(index);
    Ok(snapshot)
}

#[tauri::command]
pub fn delete_entry(
    path: String,
    state: State<'_, AppState>,
) -> Result<WorkspaceSnapshot, String> {
    let root = state
        .workspace_root
        .lock()
        .unwrap()
        .clone()
        .ok_or_else(|| "No workspace open".to_string())?;

    let abs = PathBuf::from(&root).join(&path);
    if abs.is_dir() {
        fs::remove_dir_all(&abs).map_err(|e| format!("Failed to delete directory: {}", e))?;
    } else {
        fs::remove_file(&abs).map_err(|e| format!("Failed to delete file: {}", e))?;
    }

    let index = ProjectIndex::new(PathBuf::from(&root)).map_err(|e| e.to_string())?;
    let snapshot = index.snapshot();
    *state.index.lock().unwrap() = Some(index);
    Ok(snapshot)
}

#[tauri::command]
pub fn apply_unified_diff(
    diff: String,
    state: State<'_, AppState>,
) -> Result<DiffApplyResult, String> {
    let root = state
        .workspace_root
        .lock()
        .unwrap()
        .clone()
        .ok_or_else(|| "No workspace open".to_string())?;

    diff::apply_diff(&diff, &root).map_err(|e| e.to_string())
}

fn check_ai_quota(state: &AppState, is_owner: bool) -> Result<(), String> {
    let mut settings = state.settings.lock().unwrap();
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    if is_owner {
        return Ok(());
    }

    if settings.daily_ai_limit == 0 {
        return Ok(());
    }

    if settings.usage_date != today {
        settings.usage_date = today.clone();
        settings.usage_today = 0;
    }

    if settings.usage_today >= settings.daily_ai_limit {
        return Err(format!(
            "Daily AI limit reached ({}/{}). Resets tomorrow.",
            settings.usage_today, settings.daily_ai_limit
        ));
    }

    settings.usage_today += 1;
    let _ = settings::save(&settings);
    Ok(())
}

#[tauri::command]
pub fn get_quota_info(is_owner: bool, state: State<'_, AppState>) -> Result<QuotaInfo, String> {
    let mut settings = state.settings.lock().unwrap();
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    if settings.usage_date != today {
        settings.usage_date = today;
        settings.usage_today = 0;
    }

    let remaining = if is_owner || settings.daily_ai_limit == 0 {
        -1
    } else {
        (settings.daily_ai_limit as i32 - settings.usage_today as i32).max(0)
    };

    Ok(QuotaInfo {
        used_today: settings.usage_today,
        daily_limit: settings.daily_ai_limit,
        is_owner,
        remaining,
    })
}

#[tauri::command]
pub async fn run_ai_request(
    request: AIRequest,
    state: State<'_, AppState>,
) -> Result<AIResponse, String> {
    check_ai_quota(&state, request.is_owner)?;

    let (api_base, api_key, model, system_prompt, temperature) = {
        let settings = state.settings.lock().unwrap();
        let prompt = if request.is_owner {
            settings.ai.system_prompt.clone()
        } else {
            "You are Velocity, an AI coding assistant. You help users write, refactor, explain, and debug code. Keep responses helpful, safe, and professional. Avoid generating malicious code.".to_string()
        };
        (
            request
                .api_base
                .clone()
                .unwrap_or_else(|| settings.ai.api_base.clone()),
            request
                .api_key
                .clone()
                .or_else(|| settings.ai.api_key.clone()),
            request
                .model
                .clone()
                .unwrap_or_else(|| settings.ai.model.clone()),
            prompt,
            settings.ai.temperature,
        )
    };

    let key = api_key.ok_or_else(|| "No API key configured. Set one in Settings.".to_string())?;

    let context_parts = {
        let index = state.index.lock().unwrap();
        let mut parts: Vec<String> = Vec::new();

        if request.include_project_file_list {
            if let Some(ref idx) = *index {
                let file_list: Vec<String> = idx
                    .files
                    .keys()
                    .take(80)
                    .map(|p| format!("  - {}", p))
                    .collect();
                parts.push(format!("Project files ({} total):\n{}", idx.files.len(), file_list.join("\n")));
            }
        }

        for ref_path in &request.referenced_paths {
            if let Some(ref idx) = *index {
                if let Some(content) = idx.get_file_content(ref_path) {
                    let lang = idx.get_file_language(ref_path).unwrap_or("text");
                    parts.push(format!(
                        "File: {}\nLanguage: {}\n```{}\n{}\n```",
                        ref_path, lang, lang, content
                    ));
                }
            }
        }

        if let Some(ref file) = request.current_file {
            if let Some(ref idx) = *index {
                if let Some(content) = idx.get_file_content(file) {
                    let lang = idx.get_file_language(file).unwrap_or("text");
                    parts.push(format!("Current file ({}):\n```{}\n{}\n```", file, lang, content));
                }
            }
        }

        if let Some(ref sel) = request.selected_text {
            parts.push(format!("Selected text:\n```\n{}\n```", sel));
        }

        parts
    };

    let action_instruction = match request.action.as_str() {
        "insert" => "Generate code to insert at the cursor position. Return the code in a `rewrite` field, and a short explanation in `message`.".to_string(),
        "replace_selection" => "Replace the selected text with improved code. Return the replacement code in `rewrite` and an explanation in `message`.".to_string(),
        "apply_diff" => "Generate a unified diff that modifies the current file to implement the requested change. Return the diff in the `diff` field.".to_string(),
        "explain" => "Explain the selected code or current file in detail. Return explanation in `message`.".to_string(),
        "refactor" => "Refactor the selected code or current file. Return a unified diff in `diff` and a summary in `message`.".to_string(),
        _ => "Answer the user's coding question conversationally.".to_string(),
    };

    let mut messages: Vec<serde_json::Value> = Vec::new();

    messages.push(serde_json::json!({
        "role": "system",
        "content": format!("{}\n\n{}", system_prompt, action_instruction)
    }));

    if !context_parts.is_empty() {
        messages.push(serde_json::json!({
            "role": "system",
            "content": format!("Project context:\n{}", context_parts.join("\n\n"))
        }));
    }

    for msg in &request.messages {
        messages.push(serde_json::json!({
            "role": msg.role,
            "content": msg.content
        }));
    }

    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}/chat/completions", api_base.trim_end_matches('/')))
        .header("Authorization", format!("Bearer {}", key))
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": 4096,
        }))
        .send()
        .await
        .map_err(|e| format!("AI request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("AI API error ({}): {}", status, body));
    }

    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse AI response: {}", e))?;

    let message = body["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .to_string();

    let diff = extract_code_block(&message, "diff");
    let rewrite = extract_code_block(&message, "").or_else(|| {
        extract_code_block(&message, "typescript")
            .or_else(|| extract_code_block(&message, "javascript"))
            .or_else(|| extract_code_block(&message, "rust"))
            .or_else(|| extract_code_block(&message, "python"))
            .or_else(|| extract_code_block(&message, "go"))
    });

    Ok(AIResponse {
        message,
        diff,
        rewrite,
        referenced_files: request.referenced_paths,
    })
}

fn extract_code_block(text: &str, language: &str) -> Option<String> {
    let start_marker = if language.is_empty() {
        "```"
    } else {
        &format!("```{}", language)
    };

    let start = text.find(start_marker)?;
    let content_start = start + start_marker.len();
    let remaining = &text[content_start..];
    let end = remaining.find("```")?;
    Some(remaining[..end].trim().to_string())
}

#[tauri::command]
pub fn search_files(
    query: String,
    state: State<'_, AppState>,
) -> Result<Vec<String>, String> {
    let index = state.index.lock().unwrap();
    let q = query.to_lowercase();
    let results: Vec<String> = index
        .as_ref()
        .map(|i| {
            i.files
                .keys()
                .filter(|k| k.to_lowercase().contains(&q))
                .take(50)
                .cloned()
                .collect()
        })
        .unwrap_or_default();
    Ok(results)
}

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Result<VelocitySettings, String> {
    let settings = state.settings.lock().unwrap();
    Ok(settings.clone())
}

#[tauri::command]
pub fn save_settings_command(
    settings: VelocitySettings,
    state: State<'_, AppState>,
) -> Result<VelocitySettings, String> {
    settings::save(&settings).map_err(|e| e.to_string())?;
    *state.settings.lock().unwrap() = settings.clone();
    Ok(settings)
}

#[tauri::command]
pub async fn get_local_model_status(
    state: State<'_, AppState>,
) -> Result<LocalModelStatus, String> {
    let local = state.local_model.lock().await;
    Ok(local.get_status().await)
}

#[tauri::command]
pub async fn start_local_model_download(
    state: State<'_, AppState>,
) -> Result<String, String> {
    let local = state.local_model.lock().await;
    let result = local.download_model().await;
    match result {
        Ok(path) => Ok(path.to_string_lossy().to_string()),
        Err(e) => Err(e),
    }
}

#[tauri::command]
pub async fn run_local_ai_request(
    request: AIRequest,
    state: State<'_, AppState>,
) -> Result<AIResponse, String> {
    let temperature = {
        let settings = state.settings.lock().unwrap();
        settings.ai.temperature
    };

    let mut messages = Vec::new();
    for msg in &request.messages {
        messages.push(AIChatMessage {
            role: msg.role.clone(),
            content: msg.content.clone(),
        });
    }

    let local = state.local_model.lock().await;
    let response_text = local.generate(messages, 2048, temperature).await?;

    let diff = extract_code_block(&response_text, "diff");
    let rewrite = extract_code_block(&response_text, "").or_else(|| {
        extract_code_block(&response_text, "typescript")
            .or_else(|| extract_code_block(&response_text, "javascript"))
            .or_else(|| extract_code_block(&response_text, "rust"))
            .or_else(|| extract_code_block(&response_text, "python"))
            .or_else(|| extract_code_block(&response_text, "go"))
    });

    Ok(AIResponse {
        message: response_text,
        diff,
        rewrite,
        referenced_files: request.referenced_paths,
    })
}

fn build_ai_context(request: &AIRequest, state: &AppState) -> (Vec<serde_json::Value>, String, String, String, f64) {
    let settings = state.settings.lock().unwrap();
    let api_base = request.api_base.clone().unwrap_or_else(|| settings.ai.api_base.clone());
    let api_key = request.api_key.clone().or_else(|| settings.ai.api_key.clone());
    let model = request.model.clone().unwrap_or_else(|| settings.ai.model.clone());
    let system_prompt = if request.is_owner {
        settings.ai.system_prompt.clone()
    } else {
        "You are Velocity, an AI coding assistant. You help users write, refactor, explain, and debug code. Keep responses helpful, safe, and professional. Avoid generating malicious code.".to_string()
    };
    let temperature = settings.ai.temperature;

    let mut context_parts: Vec<String> = Vec::new();
    let index = state.index.lock().unwrap();

    if request.include_project_file_list {
        if let Some(ref idx) = *index {
            let file_list: Vec<String> = idx.files.keys().take(80).map(|p| format!("  - {}", p)).collect();
            context_parts.push(format!("Project files ({} total):\n{}", idx.files.len(), file_list.join("\n")));
        }
    }

    for ref_path in &request.referenced_paths {
        if let Some(ref idx) = *index {
            if let Some(content) = idx.get_file_content(ref_path) {
                let lang = idx.get_file_language(ref_path).unwrap_or("text");
                context_parts.push(format!("File: {}\nLanguage: {}\n```{}\n{}\n```", ref_path, lang, lang, content));
            }
        }
    }

    if let Some(ref file) = request.current_file {
        if let Some(ref idx) = *index {
            if let Some(content) = idx.get_file_content(file) {
                let lang = idx.get_file_language(file).unwrap_or("text");
                context_parts.push(format!("Current file ({}):\n```{}\n{}\n```", file, lang, content));
            }
        }
    }

    if let Some(ref sel) = request.selected_text {
        context_parts.push(format!("Selected text:\n```\n{}\n```", sel));
    }

    let action_instruction = match request.action.as_str() {
        "insert" => "Generate code to insert at the cursor position. Return the code in a `rewrite` field, and a short explanation in `message`.".to_string(),
        "replace_selection" => "Replace the selected text with improved code. Return the replacement code in `rewrite` and an explanation in `message`.".to_string(),
        "apply_diff" => "Generate a unified diff that modifies the current file to implement the requested change. Return the diff in the `diff` field.".to_string(),
        "explain" => "Explain the selected code or current file in detail. Return explanation in `message`.".to_string(),
        "refactor" => "Refactor the selected code or current file. Return a unified diff in `diff` and a summary in `message`.".to_string(),
        _ => "Answer the user's coding question conversationally.".to_string(),
    };

    let mut messages: Vec<serde_json::Value> = Vec::new();
    messages.push(serde_json::json!({"role": "system", "content": format!("{}\n\n{}", system_prompt, action_instruction)}));

    if !context_parts.is_empty() {
        messages.push(serde_json::json!({"role": "system", "content": format!("Project context:\n{}", context_parts.join("\n\n"))}));
    }

    for msg in &request.messages {
        messages.push(serde_json::json!({"role": msg.role, "content": msg.content}));
    }

    (messages, api_base, api_key.unwrap_or_default(), model, temperature)
}

#[tauri::command]
pub async fn stream_ai_request(
    request: AIRequest,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    if let Err(e) = check_ai_quota(&state, request.is_owner) {
        let _ = app.emit("ai://stream-error", &e);
        return Err(e);
    }

    let (messages, api_base, api_key, model, temperature) = build_ai_context(&request, &state);

    if api_key.is_empty() {
        let _ = app.emit("ai://stream-error", "No API key configured. Set one in Settings.");
        return Err("No API key configured".to_string());
    }

    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}/chat/completions", api_base.trim_end_matches('/')))
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": 8192,
            "stream": true,
        }))
        .send()
        .await
        .map_err(|e| format!("AI request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        let _ = app.emit("ai://stream-error", format!("AI API error ({}): {}", status, body));
        return Err(format!("AI API error ({}): {}", status, body));
    }

    let mut full_text = String::new();
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Stream error: {}", e))?;
        let text = String::from_utf8_lossy(&chunk);
        for line in text.lines() {
            let line = line.trim();
            if line.is_empty() || !line.starts_with("data: ") {
                continue;
            }
            let data = &line[6..];
            if data == "[DONE]" {
                break;
            }
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                if let Some(content) = json["choices"][0]["delta"]["content"].as_str() {
                    full_text.push_str(content);
                    let _ = app.emit("ai://stream-token", content);
                }
            }
        }
    }

    let diff = extract_code_block(&full_text, "diff");
    let rewrite = extract_code_block(&full_text, "").or_else(|| {
        extract_code_block(&full_text, "typescript")
            .or_else(|| extract_code_block(&full_text, "javascript"))
            .or_else(|| extract_code_block(&full_text, "rust"))
            .or_else(|| extract_code_block(&full_text, "python"))
            .or_else(|| extract_code_block(&full_text, "go"))
    });

    let _ = app.emit("ai://stream-done", serde_json::json!({
        "message": full_text,
        "diff": diff,
        "rewrite": rewrite,
        "referenced_files": request.referenced_paths,
    }));

    Ok(())
}

#[tauri::command]
pub async fn get_inline_completion(
    prefix: String,
    suffix: String,
    language: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let (api_base, api_key, model, temperature) = {
        let settings = state.settings.lock().unwrap();
        let key = settings.ai.api_key.clone().ok_or_else(|| "No API key".to_string())?;
        (settings.ai.api_base.clone(), key, settings.ai.model.clone(), settings.ai.temperature)
    };

    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}/chat/completions", api_base.trim_end_matches('/')))
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&serde_json::json!({
            "model": model,
            "messages": [
                {"role": "system", "content": "You are a code completion engine. Complete the code at the cursor position (marked by <CURSOR>). Output ONLY the completion text, no explanations, no markdown. The completion should be a natural continuation of the code."},
                {"role": "user", "content": format!("Language: {}\n\nCode before cursor:\n```\n{}\n```\n\nCode after cursor:\n```\n{}\n```\n\nComplete the code at <CURSOR>. Output the completion only, no formatting.", language, prefix, suffix)}
            ],
            "temperature": 0.1,
            "max_tokens": 128,
        }))
        .send()
        .await
        .map_err(|e| format!("Completion request failed: {}", e))?;

    let body: serde_json::Value = response.json().await.map_err(|e| format!("Parse error: {}", e))?;
    let text = body["choices"][0]["message"]["content"].as_str().unwrap_or("").to_string();
    Ok(text.trim().to_string())
}
