use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

const VELOCITY_MODEL_REPO: &str = "https://huggingface.co/bartowski/Qwen2.5-1.5B-Instruct-GGUF/resolve/main";
const VELOCITY_MODEL_FILE: &str = "Qwen2.5-1.5B-Instruct-Q4_K_M.gguf";
const LLAMA_SERVER_VERSION: &str = "b4758";

pub struct DownloadProgress {
    pub bytes_downloaded: u64,
    pub total_bytes: u64,
    pub phase: String,
}

pub struct ModelDownloader {
    cache_dir: PathBuf,
}

impl ModelDownloader {
    pub fn new() -> Self {
        let mut cache_dir = dirs_next::cache_dir().unwrap_or_else(|| PathBuf::from("."));
        cache_dir.push("velocity");
        cache_dir.push("models");
        std::fs::create_dir_all(&cache_dir).ok();
        ModelDownloader { cache_dir }
    }

    pub fn model_path(&self) -> PathBuf {
        self.cache_dir.join(VELOCITY_MODEL_FILE)
    }

    pub fn is_model_downloaded(&self) -> bool {
        self.model_path().exists()
    }

    pub fn model_size_bytes(&self) -> u64 {
        std::fs::metadata(self.model_path()).map(|m| m.len()).unwrap_or(0)
    }

    pub async fn download_model<F: Fn(DownloadProgress) + Send + 'static>(
        &self,
        on_progress: F,
    ) -> Result<PathBuf, String> {
        let model_path = self.model_path();
        if model_path.exists() {
            return Ok(model_path);
        }

        let url = format!("{}/{}", VELOCITY_MODEL_REPO, VELOCITY_MODEL_FILE);
        let temp_path = self.cache_dir.join(format!("{}.tmp", VELOCITY_MODEL_FILE));

        let client = reqwest::Client::builder()
            .user_agent("Velocity-IDE/1.0")
            .build()
            .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

        let response = client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Failed to start download: {}", e))?;

        let total_size = response
            .content_length()
            .unwrap_or(0);

        let downloaded = Arc::new(AtomicU64::new(0));



        let bytes = response
            .bytes()
            .await
            .map_err(|e| format!("Download failed: {}", e))?;

        downloaded.store(bytes.len() as u64, Ordering::SeqCst);
        on_progress(DownloadProgress {
            bytes_downloaded: bytes.len() as u64,
            total_bytes: total_size,
            phase: "Saving model...".to_string(),
        });

        std::fs::write(&temp_path, &bytes)
            .map_err(|e| format!("Failed to save model: {}", e))?;

        std::fs::rename(&temp_path, &model_path)
            .map_err(|e| format!("Failed to finalize model: {}", e))?;

        on_progress(DownloadProgress {
            bytes_downloaded: bytes.len() as u64,
            total_bytes: total_size,
            phase: "Model ready!".to_string(),
        });

        Ok(model_path)
    }

    pub fn delete_model(&self) -> Result<(), String> {
        let path = self.model_path();
        if path.exists() {
            std::fs::remove_file(&path).map_err(|e| format!("Failed to delete model: {}", e))?;
        }
        Ok(())
    }

    pub fn get_downloaded_models(&self) -> Vec<PathBuf> {
        let mut models = Vec::new();
        if let Ok(entries) = std::fs::read_dir(&self.cache_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|e| e.to_str()) == Some("gguf") {
                    models.push(path);
                }
            }
        }
        models
    }
}
