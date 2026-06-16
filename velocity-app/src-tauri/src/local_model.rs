use crate::models;
use std::path::PathBuf;
use std::sync::Mutex;

pub struct LocalModelManager {
    pub engine: models::engine::LocalModelEngine,
    pub downloader: models::downloader::ModelDownloader,
    pub download_progress: Mutex<f64>,
    pub download_phase: Mutex<String>,
}

impl LocalModelManager {
    pub fn new() -> Self {
        LocalModelManager {
            engine: models::engine::LocalModelEngine::new(),
            downloader: models::downloader::ModelDownloader::new(),
            download_progress: Mutex::new(0.0),
            download_phase: Mutex::new("idle".to_string()),
        }
    }

    pub async fn get_status(&self) -> models::LocalModelStatus {
        let engine_status = self.engine.check_status().await;

        models::LocalModelStatus {
            available: engine_status != models::engine::LocalEngineStatus::Unavailable,
            engine: match engine_status {
                models::engine::LocalEngineStatus::OllamaReady => "ollama".to_string(),
                models::engine::LocalEngineStatus::LlamaServerReady => "llama-server".to_string(),
                models::engine::LocalEngineStatus::Downloading => "downloading".to_string(),
                models::engine::LocalEngineStatus::Error(ref e) => format!("error: {}", e),
                models::engine::LocalEngineStatus::Unavailable => "unavailable".to_string(),
            },
            model_downloaded: self.downloader.is_model_downloaded(),
            model_size_bytes: self.downloader.model_size_bytes(),
            download_progress: *self.download_progress.lock().unwrap(),
            download_phase: self.download_phase.lock().unwrap().clone(),
        }
    }

    pub async fn download_model(&self) -> Result<PathBuf, String> {
        *self.download_phase.lock().unwrap() = "downloading".to_string();
        *self.download_progress.lock().unwrap() = 0.0;

        let result = self
            .downloader
            .download_model(|_progress| {})
            .await;

        match &result {
            Ok(_) => {
                *self.download_phase.lock().unwrap() = "ready".to_string();
                *self.download_progress.lock().unwrap() = 100.0;
                if let Ok(path) = result.as_ref() {
                    let engine_status = self.engine.check_status().await;
                    if engine_status == models::engine::LocalEngineStatus::Unavailable {
                        let _ = self.engine.start_llama_server(path).await;
                    }
                }
            }
            Err(e) => {
                *self.download_phase.lock().unwrap() = format!("error: {}", e);
            }
        }

        result
    }

    pub async fn generate(
        &self,
        messages: Vec<models::AIChatMessage>,
        max_tokens: u32,
        temperature: f64,
    ) -> Result<String, String> {
        self.engine.generate(messages, max_tokens, temperature).await
    }
}
