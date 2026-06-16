// Velocity AI IDE – Unified diff parser and applier
// Produces safe, validated file edits from standard unified diff format.

use crate::models::DiffApplyResult;
use anyhow::{anyhow, Context, Result};
use std::path::{Path, PathBuf};

/// Represents a single hunk of changes in a unified diff.
struct Hunk {
    old_start: usize,
    old_count: usize,
    new_start: usize,
    new_count: usize,
    lines: Vec<DiffLine>,
}

enum DiffLine {
    Context(String),
    Addition(String),
    Removal(String),
}

/// Parsed file-level patch.
struct FilePatch {
    old_path: String,
    new_path: String,
    hunks: Vec<Hunk>,
}

/// Parse a single unified diff string into multiple `FilePatch` entries.
fn parse_unified_diff(diff_text: &str) -> Result<Vec<FilePatch>> {
    let mut patches = Vec::new();
    let mut current_patch: Option<FilePatch> = None;
    let mut current_hunk: Option<Hunk> = None;

    for line in diff_text.lines() {
        if line.starts_with("diff --git") {
            // Finish previous patch/hunk
            if let Some(hunk) = current_hunk.take() {
                if let Some(ref mut patch) = current_patch {
                    patch.hunks.push(hunk);
                }
            }
            if let Some(patch) = current_patch.take() {
                patches.push(patch);
            }
            continue;
        }

        if line.starts_with("--- ") {
            if let Some(hunk) = current_hunk.take() {
                if let Some(ref mut patch) = current_patch {
                    patch.hunks.push(hunk);
                }
            }
            let path = line
                .strip_prefix("--- ")
                .unwrap_or("")
                .trim_start_matches("a/")
                .to_string();
            if let Some(ref mut patch) = current_patch {
                patch.old_path = path;
            }
            continue;
        }

        if line.starts_with("+++ ") {
            let path = line
                .strip_prefix("+++ ")
                .unwrap_or("")
                .trim_start_matches("b/")
                .to_string();
            if let Some(ref mut patch) = current_patch {
                patch.new_path = path;
            } else {
                current_patch = Some(FilePatch {
                    old_path: String::new(),
                    new_path: path,
                    hunks: vec![],
                });
            }
            continue;
        }

        if line.starts_with("@@") {
            if let Some(hunk) = current_hunk.take() {
                if let Some(ref mut patch) = current_patch {
                    patch.hunks.push(hunk);
                }
            }

            // Parse @@ -old_start,old_count +new_start,new_count @@
            let rest = line.trim_start_matches("@@").trim_end_matches("@@").trim();
            let parts: Vec<&str> = rest.split_whitespace().collect();
            if parts.len() >= 2 {
                let old_part = parts[0].trim_start_matches('-');
                let new_part = parts[1].trim_start_matches('+');

                let parse_range = |s: &str| -> (usize, usize) {
                    if let Some((start, count)) = s.split_once(',') {
                        (start.parse().unwrap_or(1), count.parse().unwrap_or(1))
                    } else {
                        (s.parse().unwrap_or(1), 1)
                    }
                };

                let (old_start, old_count) = parse_range(old_part);
                let (new_start, new_count) = parse_range(new_part);

                current_hunk = Some(Hunk {
                    old_start,
                    old_count,
                    new_start,
                    new_count,
                    lines: vec![],
                });
            }
            continue;
        }

        if let Some(ref mut hunk) = current_hunk {
            if line.starts_with('+') {
                hunk.lines.push(DiffLine::Addition(line[1..].to_string()));
            } else if line.starts_with('-') {
                hunk.lines.push(DiffLine::Removal(line[1..].to_string()));
            } else if line.starts_with(' ') {
                hunk.lines.push(DiffLine::Context(line[1..].to_string()));
            } else if line.starts_with("\\ ") {
                // No newline at end of file — skip
                continue;
            }
        }
    }

    // Flush remaining
    if let Some(hunk) = current_hunk.take() {
        if let Some(ref mut patch) = current_patch {
            patch.hunks.push(hunk);
        }
    }
    if let Some(patch) = current_patch.take() {
        patches.push(patch);
    }

    Ok(patches)
}

/// Apply a single `FilePatch` to the given content string.
fn apply_patch(content: &str, patch: &FilePatch, basedir: &Path) -> Result<(String, PathBuf)> {
    let target_path = basedir.join(&patch.new_path);
    let old_path = basedir.join(&patch.old_path);

    let source = if !patch.old_path.is_empty() || !patch.new_path.is_empty() {
        // Use the existing file content if it exists, otherwise start empty (new file)
        match std::fs::read_to_string(&target_path) {
            Ok(c) => c,
            Err(_) => match std::fs::read_to_string(&old_path) {
                Ok(c) => c,
                Err(_) => String::new(),
            },
        }
    } else {
        content.to_string()
    };

    let lines: Vec<&str> = source.lines().collect();
    let mut result: Vec<String> = Vec::new();
    let mut line_idx = 0usize;

    for hunk in &patch.hunks {
        // Copy lines up to the hunk start (1-based -> 0-based)
        while line_idx < hunk.old_start.saturating_sub(1) && line_idx < lines.len() {
            result.push(lines[line_idx].to_string());
            line_idx += 1;
        }

        let mut old_line_idx = line_idx;
        let mut removal_buffer: Vec<String> = Vec::new();

        for diff_line in &hunk.lines {
            match diff_line {
                DiffLine::Context(text) => {
                    // Verify context matches
                    if old_line_idx < lines.len() && lines[old_line_idx] == text.as_str() {
                        old_line_idx += 1;
                    }
                    result.push(text.clone());
                }
                DiffLine::Removal(text) => {
                    if old_line_idx < lines.len() && lines[old_line_idx] == text.as_str() {
                        old_line_idx += 1;
                    }
                    removal_buffer.push(text.clone());
                }
                DiffLine::Addition(text) => {
                    result.push(text.clone());
                }
            }
        }

        // Validate removals matched
        if !removal_buffer.is_empty() && old_line_idx > line_idx + 1 {
            return Err(anyhow!(
                "Hunk mismatch: expected removals did not match content at {}:{}-{}",
                patch.new_path,
                hunk.old_start,
                hunk.old_start + hunk.old_count
            ));
        }

        line_idx = old_line_idx;
    }

    // Append remaining lines
    while line_idx < lines.len() {
        result.push(lines[line_idx].to_string());
        line_idx += 1;
    }

    let output = result.join("\n");
    // Ensure trailing newline if original had one
    let output = if source.ends_with('\n') && !output.ends_with('\n') {
        format!("{}\n", output)
    } else {
        output
    };

    Ok((output, target_path))
}

/// Apply a full unified diff string to files within the workspace root.
pub fn apply_diff(diff_text: &str, workspace_root: &str) -> Result<DiffApplyResult> {
    let patches = parse_unified_diff(diff_text)?;
    if patches.is_empty() {
        return Err(anyhow!("No parseable diff hunks found in the diff text."));
    }

    let basedir = PathBuf::from(workspace_root);
    let mut changed_files = Vec::new();
    let mut summary_parts: Vec<String> = Vec::new();

    for patch in &patches {
        let target_path = if !patch.new_path.is_empty() {
            basedir.join(&patch.new_path)
        } else {
            return Err(anyhow!("Patch missing target file path."));
        };

        let current_content = match std::fs::read_to_string(&target_path) {
            Ok(c) => c,
            Err(_) => String::new(),
        };

        let (new_content, _) = apply_patch(&current_content, patch, &basedir)?;

        // Create parent directories if needed
        if let Some(parent) = target_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        std::fs::write(&target_path, &new_content)
            .with_context(|| format!("Failed to write {}", target_path.display()))?;

        let rel = patch.new_path.clone();
        changed_files.push(rel);
        summary_parts.push(format!("  • {}", patch.new_path));
    }

    let summary = format!(
        "Applied diff to {} file(s):\n{}",
        changed_files.len(),
        summary_parts.join("\n")
    );

    Ok(DiffApplyResult {
        changed_files,
        summary,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_simple_diff() {
        let diff = "--- a/hello.txt\n+++ b/hello.txt\n@@ -1,3 +1,4 @@\n hello\n-world\n+universe\n+and beyond\n goodbye\n";
        let patches = parse_unified_diff(diff).unwrap();
        assert_eq!(patches.len(), 1);
        assert_eq!(patches[0].hunks.len(), 1);
        assert_eq!(patches[0].new_path, "hello.txt");
    }

    #[test]
    fn test_apply_simple_diff() {
        use std::io::Write;
        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("hello.txt");
        let mut f = std::fs::File::create(&file_path).unwrap();
        writeln!(f, "hello").unwrap();
        writeln!(f, "world").unwrap();
        writeln!(f, "goodbye").unwrap();

        let diff = format!(
            "--- a/hello.txt\n+++ b/hello.txt\n@@ -1,4 +1,4 @@\n hello\n-world\n+universe\n goodbye\n"
        );

        let result = apply_diff(&diff, dir.path().to_str().unwrap()).unwrap();
        assert_eq!(result.changed_files.len(), 1);

        let new_content = std::fs::read_to_string(&file_path).unwrap();
        assert!(new_content.contains("hello"));
        assert!(new_content.contains("universe"));
        assert!(!new_content.contains("world"));
    }
}
