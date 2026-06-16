use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;

const OLLAMA_PORT: u16 = 11434;
const LLAMA_SERVER_PORT: u16 = 11435;

#[derive(Debug, Clone, PartialEq)]
pub enum LocalEngineStatus {
    Unavailable,
    OllamaReady,
    LlamaServerReady,
    Downloading,
    Error(String),
}

pub struct LocalModelEngine {
    llama_process: Mutex<Option<Child>>,
    cache_dir: PathBuf,
}

impl LocalModelEngine {
    pub fn new() -> Self {
        let mut cache_dir = dirs_next::cache_dir().unwrap_or_else(|| PathBuf::from("."));
        cache_dir.push("velocity");
        cache_dir.push("models");
        std::fs::create_dir_all(&cache_dir).ok();

        LocalModelEngine {
            llama_process: Mutex::new(None),
            cache_dir,
        }
    }

    pub async fn check_status(&self) -> LocalEngineStatus {
        if self.check_ollama().await {
            return LocalEngineStatus::OllamaReady;
        }
        if self.check_llama_server().await {
            return LocalEngineStatus::LlamaServerReady;
        }
        LocalEngineStatus::Unavailable
    }

    async fn check_ollama(&self) -> bool {
        let url = format!("http://127.0.0.1:{}/api/tags", OLLAMA_PORT);
        reqwest::Client::new()
            .get(&url)
            .timeout(std::time::Duration::from_secs(2))
            .send()
            .await
            .is_ok()
    }

    async fn check_llama_server(&self) -> bool {
        let url = format!("http://127.0.0.1:{}/health", LLAMA_SERVER_PORT);
        reqwest::Client::new()
            .get(&url)
            .timeout(std::time::Duration::from_secs(1))
            .send()
            .await
            .is_ok()
    }

    pub async fn start_llama_server(&self, model_path: &PathBuf) -> Result<(), String> {
        if self.check_llama_server().await {
            return Ok(());
        }

        let server_binary = self.find_or_download_server().await?;

        let mut child = Command::new(&server_binary)
            .arg("-m")
            .arg(model_path)
            .arg("--host")
            .arg("127.0.0.1")
            .arg("--port")
            .arg(LLAMA_SERVER_PORT.to_string())
            .arg("-c")
            .arg("4096")
            .arg("-ngl")
            .arg("99")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("Failed to start llama-server: {}", e))?;

        let mut attempts = 0;
        loop {
            if self.check_llama_server().await {
                *self.llama_process.lock().unwrap() = Some(child);
                return Ok(());
            }
            attempts += 1;
            if attempts > 30 {
                child.kill().ok();
                return Err("llama-server failed to start within 30 seconds".to_string());
            }
            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
        }
    }

    async fn find_or_download_server(&self) -> Result<PathBuf, String> {
        let server_name = if cfg!(target_os = "windows") {
            "llama-server.exe"
        } else {
            "llama-server"
        };
        let server_path = self.cache_dir.join(server_name);

        if server_path.exists() {
            return Ok(server_path);
        }

        let url = format!(
            "https://github.com/ggml-org/llama.cpp/releases/download/b4758/{}-{}-x64.zip",
            server_name,
            if cfg!(target_os = "windows") { "win" } else if cfg!(target_os = "macos") { "mac" } else { "linux" }
        );

        let response = reqwest::get(&url)
            .await
            .map_err(|e| format!("Failed to download llama-server: {}", e))?;

        let bytes = response
            .bytes()
            .await
            .map_err(|e| format!("Failed to read download: {}", e))?;

        let temp_zip = self.cache_dir.join("llama-server-temp.zip");
        std::fs::write(&temp_zip, &bytes)
            .map_err(|e| format!("Failed to save temp file: {}", e))?;

        let file = std::fs::File::open(&temp_zip)
            .map_err(|e| format!("Failed to open zip: {}", e))?;
        let mut archive = zip::ZipArchive::new(file)
            .map_err(|e| format!("Failed to read zip: {}", e))?;

        for i in 0..archive.len() {
            let mut entry = archive.by_index(i)
                .map_err(|e| format!("Failed to read zip entry: {}", e))?;
            let name = entry.name().to_string();
            if name.contains(server_name) {
                let mut out = std::fs::File::create(&server_path)
                    .map_err(|e| format!("Failed to create server file: {}", e))?;
                std::io::copy(&mut entry, &mut out)
                    .map_err(|e| format!("Failed to extract server: {}", e))?;
                break;
            }
        }

        std::fs::remove_file(&temp_zip).ok();

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&server_path, std::fs::Permissions::from_mode(0o755)).ok();
        }

        if server_path.exists() {
            Ok(server_path)
        } else {
            Err("Failed to extract llama-server binary".to_string())
        }
    }

    pub async fn generate(
        &self,
        messages: Vec<crate::models::AIChatMessage>,
        max_tokens: u32,
        temperature: f64,
    ) -> Result<String, String> {
        let status = self.check_status().await;

        match status {
            LocalEngineStatus::OllamaReady => {
                self.generate_ollama(messages, max_tokens, temperature).await
            }
            LocalEngineStatus::LlamaServerReady => {
                self.generate_llama_server(messages, max_tokens, temperature).await
            }
            _ => Err("No local inference engine available. Please start Ollama or download the Velocity Model.".to_string())
        }
    }

    async fn generate_ollama(
        &self,
        messages: Vec<crate::models::AIChatMessage>,
        max_tokens: u32,
        temperature: f64,
    ) -> Result<String, String> {
        let ollama_messages: Vec<serde_json::Value> = messages
            .iter()
            .map(|m| serde_json::json!({
                "role": m.role,
                "content": m.content
            }))
            .collect();

        let model = if self.has_velocity_model_ollama().await {
            "velocity-model"
        } else {
            "llama3.2:3b"
        };

        let body = serde_json::json!({
            "model": model,
            "messages": ollama_messages,
            "stream": false,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens
            }
        });

        let client = reqwest::Client::new();
        let response = client
            .post(format!("http://127.0.0.1:{}/api/chat", OLLAMA_PORT))
            .json(&body)
            .timeout(std::time::Duration::from_secs(120))
            .send()
            .await
            .map_err(|e| format!("Ollama request failed: {}", e))?;

        let result: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;

        result["message"]["content"]
            .as_str()
            .map(|s| s.to_string())
            .ok_or_else(|| "No content in Ollama response".to_string())
    }

    async fn has_velocity_model_ollama(&self) -> bool {
        let url = format!("http://127.0.0.1:{}/api/tags", OLLAMA_PORT);
        if let Ok(response) = reqwest::Client::new()
            .get(&url)
            .timeout(std::time::Duration::from_secs(2))
            .send()
            .await
        {
            if let Ok(tags) = response.json::<serde_json::Value>().await {
                if let Some(models) = tags["models"].as_array() {
                    return models.iter().any(|m| {
                        m["name"].as_str().map_or(false, |n| n.contains("velocity"))
                    });
                }
            }
        }
        false
    }

    async fn generate_llama_server(
        &self,
        messages: Vec<crate::models::AIChatMessage>,
        max_tokens: u32,
        temperature: f64,
    ) -> Result<String, String> {
        let prompt = self.format_chat_prompt(&messages);

        let body = serde_json::json!({
            "prompt": prompt,
            "n_predict": max_tokens,
            "temperature": temperature,
            "stop": ["</s>", "<|im_end|>", "<|end|>", "<end_of_turn>"]
        });

        let client = reqwest::Client::new();
        let response = client
            .post(format!("http://127.0.0.1:{}/completion", LLAMA_SERVER_PORT))
            .json(&body)
            .timeout(std::time::Duration::from_secs(120))
            .send()
            .await
            .map_err(|e| format!("llama-server request failed: {}", e))?;

        let result: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse llama-server response: {}", e))?;

        result["content"]
            .as_str()
            .map(|s| s.to_string())
            .ok_or_else(|| "No content in llama-server response".to_string())
    }

    fn format_chat_prompt(&self, messages: &[crate::models::AIChatMessage]) -> String {
        let mut prompt = String::from("<|im_start|>system\nYou are Velocity, an expert AI coding assistant integrated into a modern IDE. You help users write, refactor, explain, and debug code. When asked to make changes, respond with a unified diff that can be directly applied. Be concise and precise.<|im_end|>\n");
        for msg in messages {
            let role = match msg.role.as_str() {
                "user" => "user",
                "assistant" => "assistant",
                "system" => "system",
                _ => "user",
            };
            prompt.push_str(&format!("<|im_start|>{}\n{}<|im_end|>\n", role, msg.content));
        }
        prompt.push_str("<|im_start|>assistant\n");
        prompt
    }

    pub fn shutdown(&self) {
        if let Ok(mut child) = self.llama_process.lock() {
            if let Some(ref mut c) = *child {
                c.kill().ok();
                c.wait().ok();
            }
        }
    }
}

impl Drop for LocalModelEngine {
    fn drop(&mut self) {
        self.shutdown();
    }
}
