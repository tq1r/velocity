// Velocity AI IDE – Lightweight project indexer
// Walks a directory tree, categorizes files by language, hashes content,
// and builds an in-memory map for AI context.

use crate::models::{FileNode, IndexSummary, IndexedFileSummary};
use anyhow::{Context, Result};
use ignore::WalkBuilder;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};


static BINARY_EXTENSIONS: &[&str] = &[
    "png", "jpg", "jpeg", "gif", "bmp", "ico", "svg", "webp",
    "woff", "woff2", "ttf", "otf", "eot", "pdf", "doc", "docx",
    "xls", "xlsx", "ppt", "pptx", "zip", "tar", "gz", "bz2",
    "7z", "rar", "exe", "dll", "so", "dylib", "wasm", "mp3",
    "mp4", "avi", "mov", "mkv", "o", "a", "lib", "obj", "lock", "sum",
];

static SKIP_DIRS: &[&str] = &[
    "node_modules", ".git", "target", "dist", "build", ".next",
    ".svelte-kit", ".cache", ".parcel-cache", ".yarn",
    "__pycache__", ".pytest_cache", "vendor", ".bundle",
    "cmake-build-debug", "cmake-build-release", ".idea", ".vscode",
];

pub fn language_from_path(path: &Path) -> String {
    match path.extension().and_then(|e| e.to_str()).unwrap_or("") {
        "rs" => "rust".into(),
        "ts" | "tsx" => "typescript".into(),
        "js" | "jsx" | "mjs" => "javascript".into(),
        "py" => "python".into(),
        "go" => "go".into(),
        "java" => "java".into(),
        "rb" => "ruby".into(),
        "c" | "h" => "c".into(),
        "cpp" | "cc" | "cxx" | "hpp" => "cpp".into(),
        "cs" => "csharp".into(),
        "swift" => "swift".into(),
        "kt" | "kts" => "kotlin".into(),
        "php" => "php".into(),
        "html" | "htm" => "html".into(),
        "css" | "scss" | "less" => "css".into(),
        "json" => "json".into(),
        "xml" => "xml".into(),
        "yaml" | "yml" => "yaml".into(),
        "md" | "mdx" => "markdown".into(),
        "toml" => "toml".into(),
        "sql" => "sql".into(),
        "sh" | "bash" | "zsh" => "shell".into(),
        "ps1" => "powershell".into(),
        "lua" => "lua".into(),
        "r" => "r".into(),
        "dart" => "dart".into(),
        "scala" => "scala".into(),
        "elm" => "elm".into(),
        "clj" | "cljs" => "clojure".into(),
        "hs" => "haskell".into(),
        "ml" => "ocaml".into(),
        "zig" => "zig".into(),
        "tex" => "latex".into(),
        "cfg" | "conf" | "ini" => "ini".into(),
        "env" => "dotenv".into(),
        "vue" => "vue".into(),
        "svelte" => "svelte".into(),
        "astro" => "astro".into(),
        "prisma" => "prisma".into(),
        "gradle" => "gradle".into(),
        _ => "text".into(),
    }
}

pub fn compute_hash(content: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content);
    format!("{:x}", hasher.finalize())[..16].to_string()
}

fn is_binary(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|ext| BINARY_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false)
}

/// Recursively build a `FileNode` tree from a directory path.
fn build_tree(root: &Path, relative_root: &Path) -> Result<FileNode> {
    let mut children = Vec::new();
    if root.is_dir() {
        let mut entries: Vec<_> = fs::read_dir(root)
            .with_context(|| format!("Failed to read directory: {}", root.display()))?
            .filter_map(|e| e.ok())
            .filter(|e| {
                let name = e.file_name();
                let name_str = name.to_string_lossy();
                !name_str.starts_with('.') || name_str == ".gitignore" || name_str == ".env.example"
            })
            .collect();
        entries.sort_by_key(|e| e.file_name());

        for entry in entries {
            let path = entry.path();
            let file_name = entry.file_name().to_string_lossy().to_string();
            let rel_path = relative_root.join(&file_name);

            if path.is_dir() {
                let dir_name = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
                if SKIP_DIRS.contains(&dir_name.as_str()) {
                    children.push(FileNode {
                        name: dir_name,
                        path: rel_path.to_string_lossy().to_string().replace('\\', "/"),
                        is_dir: true,
                        children: vec![],
                    });
                    continue;
                }
                match build_tree(&path, &rel_path) {
                    Ok(node) => children.push(node),
                    Err(_) => continue,
                }
            } else if !is_binary(&path) {
                children.push(FileNode {
                    name: entry.file_name().to_string_lossy().to_string(),
                    path: rel_path.to_string_lossy().to_string().replace('\\', "/"),
                    is_dir: false,
                    children: vec![],
                });
            }
        }
    }

    let name = root
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| root.to_string_lossy().to_string());

    Ok(FileNode {
        name,
        path: relative_root.to_string_lossy().to_string().replace('\\', "/"),
        is_dir: true,
        children,
    })
}

#[derive(Debug, Clone)]
pub struct ProjectIndex {
    pub root: PathBuf,
    pub files: HashMap<String, IndexedEntry>,
    pub tree: FileNode,
    pub summary: IndexSummary,
}

#[derive(Debug, Clone)]
pub struct IndexedEntry {
    pub content: String,
    pub language: String,
    pub size: u64,
    pub hash: String,
}

impl ProjectIndex {
    pub fn new(root: PathBuf) -> Result<Self> {
        let root_canonical = if root.is_absolute() {
            root.clone()
        } else {
            std::env::current_dir()?.join(&root)
        };

        let tree = build_tree(&root_canonical, Path::new(""))?;
        let mut files: HashMap<String, IndexedEntry> = HashMap::new();
        let mut total_chars = 0u64;
        let mut indexed = 0u64;
        let mut skipped = 0u64;

        let walker = WalkBuilder::new(&root_canonical)
            .standard_filters(true)
            .git_global(false)
            .git_ignore(true)
            .git_exclude(true)
            .max_depth(Some(30))
            .build();

        for result in walker {
            let entry = match result {
                Ok(e) => e,
                Err(_) => {
                    skipped += 1;
                    continue;
                }
            };

            let path = entry.path();
            if !path.is_file() {
                continue;
            }

            let rel = path
                .strip_prefix(&root_canonical)
                .unwrap_or(path)
                .to_string_lossy()
                .to_string()
                .replace('\\', "/");

            if rel.is_empty() || rel.starts_with('.') {
                continue;
            }

            let dir_name = path.parent().and_then(|p| p.file_name()).map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
            if SKIP_DIRS.contains(&dir_name.as_str()) {
                skipped += 1;
                continue;
            }

            if is_binary(path) {
                skipped += 1;
                continue;
            }

            match fs::read_to_string(path) {
                Ok(content) => {
                    let size = content.len() as u64;
                    let hash = compute_hash(content.as_bytes());
                    let language = language_from_path(path);
                    total_chars += size;
                    indexed += 1;
                    files.insert(
                        rel.clone(),
                        IndexedEntry {
                            content,
                            language,
                            size,
                            hash,
                        },
                    );
                }
                Err(_) => {
                    skipped += 1;
                }
            }
        }

        let now = chrono::Utc::now().to_rfc3339();

        Ok(ProjectIndex {
            root: root_canonical,
            files,
            tree,
            summary: IndexSummary {
                indexed_files: indexed,
                skipped_files: skipped,
                total_files: indexed + skipped,
                total_characters: total_chars,
                last_indexed_at: now,
            },
        })
    }

    pub fn snapshot(&self) -> crate::models::WorkspaceSnapshot {
        let indexed_files: Vec<IndexedFileSummary> = self
            .files
            .iter()
            .map(|(path, entry)| IndexedFileSummary {
                path: path.clone(),
                language: entry.language.clone(),
                size: entry.size,
                hash: entry.hash.clone(),
            })
            .collect();

        crate::models::WorkspaceSnapshot {
            root_path: self.root.to_string_lossy().to_string(),
            tree: self.tree.clone(),
            index_summary: self.summary.clone(),
            indexed_files,
        }
    }

    pub fn get_file_content(&self, relative_path: &str) -> Option<&str> {
        self.files.get(relative_path).map(|e| e.content.as_str())
    }

    pub fn get_file_language(&self, relative_path: &str) -> Option<&str> {
        self.files.get(relative_path).map(|e| e.language.as_str())
    }
}
