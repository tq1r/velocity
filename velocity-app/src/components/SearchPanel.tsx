import { useState, useEffect, useCallback } from 'react';
import { searchFiles } from '../lib/tauri';
import type { FileNode } from '../types';

interface SearchPanelProps {
  onFileSelect: (node: FileNode) => void;
}

export function SearchPanel({ onFileSelect }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await searchFiles(query);
        setResults(res);
      } catch {
        setResults([]);
      }
      setLoading(false);
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (path: string) => {
    onFileSelect({ name: path.split('/').pop() || path, path, is_dir: false, children: [] });
  };

  return (
    <div className="search-panel">
      <div className="search-input-wrapper">
        <input
          className="search-input"
          placeholder="Search files by name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>
      <div className="search-results">
        {loading && (
          <div className="empty-state" style={{ padding: 20 }}>
            <p>Searching...</p>
          </div>
        )}
        {!loading && query && results.length === 0 && (
          <div className="empty-state" style={{ padding: 20 }}>
            <p>No files found</p>
          </div>
        )}
        {!loading && results.map((file) => (
          <div key={file} className="search-result-item" onClick={() => handleSelect(file)}>
            <div className="result-path">{file}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
