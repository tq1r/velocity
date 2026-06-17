import { useState, useEffect, useCallback, useRef } from 'react';
import { searchFiles, searchFileContents } from '../lib/tauri';
import type { FileNode } from '../types';

interface SearchPanelProps {
  onFileSelect: (node: FileNode) => void;
}

type SearchMode = 'files' | 'content';

export function SearchPanel({ onFileSelect }: SearchPanelProps) {
  const [mode, setMode] = useState<SearchMode>('files');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const [contentResults, setContentResults] = useState<{ path: string; line: number; content: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [regex, setRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, [mode]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setContentResults([]);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        if (mode === 'files') {
          const res = await searchFiles(query);
          setResults(res);
        } else {
          const res = await searchFileContents(query);
          setContentResults(res);
        }
      } catch {
        setResults([]);
        setContentResults([]);
      }
      setLoading(false);
    }, 200);
    return () => clearTimeout(timer);
  }, [query, mode]);

  const handleSelect = (path: string) => {
    onFileSelect({ name: path.split('/').pop() || path, path, is_dir: false, children: [] });
  };

  const handleContentSelect = (path: string, line: number) => {
    onFileSelect({ name: path.split('/').pop() || path, path, is_dir: false, children: [] });
  };

  const highlightMatch = (text: string, q: string) => {
    if (!q.trim()) return text;
    try {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = caseSensitive ? escaped : escaped;
      const flags = caseSensitive ? 'g' : 'gi';
      const re = new RegExp(`(${pattern})`, flags);
      const parts = text.split(re);
      return parts.map((part, i) =>
        re.test(part) ? `<mark>${part}</mark>` : part
      );
    } catch {
      return text;
    }
  };

  return (
    <div className="search-panel">
      <div className="search-input-wrapper">
        <div className="search-mode-tabs">
          <button
            className={`search-mode-tab${mode === 'files' ? ' active' : ''}`}
            onClick={() => setMode('files')}
          >
            Files
          </button>
          <button
            className={`search-mode-tab${mode === 'content' ? ' active' : ''}`}
            onClick={() => setMode('content')}
          >
            Content
          </button>
        </div>
        <input
          ref={inputRef}
          className="search-input"
          placeholder={mode === 'files' ? 'Search files by name...' : 'Search file contents...'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {mode === 'content' && (
          <div className="search-options">
            <label className="search-option">
              <input
                type="checkbox"
                checked={caseSensitive}
                onChange={(e) => setCaseSensitive(e.target.checked)}
              />
              <span>Aa</span>
            </label>
            <label className="search-option">
              <input
                type="checkbox"
                checked={regex}
                onChange={(e) => setRegex(e.target.checked)}
              />
              <span>.*</span>
            </label>
          </div>
        )}
      </div>
      <div className="search-results">
        {loading && (
          <div className="empty-state" style={{ padding: 20 }}>
            <p>Searching...</p>
          </div>
        )}
        {!loading && mode === 'files' && query && results.length === 0 && (
          <div className="empty-state" style={{ padding: 20 }}>
            <p>No files found</p>
          </div>
        )}
        {!loading && mode === 'content' && query && contentResults.length === 0 && (
          <div className="empty-state" style={{ padding: 20 }}>
            <p>No matches found</p>
          </div>
        )}
        {!loading && mode === 'files' && results.map((file) => (
          <div key={file} className="search-result-item" onClick={() => handleSelect(file)}>
            <div className="result-path">{file}</div>
          </div>
        ))}
        {!loading && mode === 'content' && contentResults.map((r, i) => (
          <div key={`${r.path}-${r.line}-${i}`} className="search-result-item" onClick={() => handleContentSelect(r.path, r.line)}>
            <div className="result-path">{r.path}:{r.line}</div>
            <div
              className="result-line"
              dangerouslySetInnerHTML={{ __html: highlightMatch(r.content, query) }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
