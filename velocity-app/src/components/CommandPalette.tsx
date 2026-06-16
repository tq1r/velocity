import { useState, useEffect, useRef, useCallback } from 'react';
import { searchFiles, pickFolder, openWorkspace } from '../lib/tauri';
import { useVelocityStore } from '../state/store';
import type { FileNode } from '../types';

interface CommandPaletteProps {
  onFileSelect: (node: FileNode) => void;
  onClose: () => void;
}

interface Command {
  id: string;
  label: string;
  shortcut?: string;
  action: () => void;
}

export function CommandPalette({ onFileSelect, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [fileResults, setFileResults] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const store = useVelocityStore();

  const commands: Command[] = [
    {
      id: 'open-folder',
      label: 'Open Folder',
      shortcut: 'Ctrl+O',
      action: () => {
        pickFolder().then((path) => {
          if (path) openWorkspace(path).then((ws) => { store.setWorkspace(ws); onClose(); });
        });
      },
    },
    {
      id: 'save',
      label: 'Save File',
      shortcut: 'Ctrl+S',
      action: () => {
        document.dispatchEvent(new KeyboardEvent('keydown', { metaKey: true, ctrlKey: true, key: 's' }));
        onClose();
      },
    },
    {
      id: 'settings',
      label: 'Settings',
      shortcut: 'Ctrl+,',
      action: () => { store.setSettingsOpen(true); onClose(); },
    },
  ];

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!query) {
      setFileResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const results = await searchFiles(query);
        setFileResults(results);
      } catch {
        setFileResults([]);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [query]);

  const matchQuery = useCallback((label: string) => {
    return !query || label.toLowerCase().includes(query.toLowerCase());
  }, [query]);

  const visibleCommands = commands.filter((c) => matchQuery(c.label));
  const visibleFiles = fileResults.filter((f) => matchQuery(f));

  const allItems = [
    ...visibleCommands.map((c) => ({ type: 'command' as const, data: c })),
    ...visibleFiles.map((f) => ({ type: 'file' as const, data: f })),
  ];

  const handleSelect = (idx: number) => {
    const item = allItems[idx];
    if (!item) return;
    if (item.type === 'command') {
      item.data.action();
    } else {
      onFileSelect({ name: item.data.split('/').pop() || item.data, path: item.data, is_dir: false, children: [] });
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, allItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSelect(selectedIndex);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content command-palette animate-in" onClick={(e) => e.stopPropagation()}>
        <div className="modal-body">
          <input
            ref={inputRef}
            className="command-palette-input"
            placeholder="Search files or run commands..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
          />
          {allItems.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No results found
            </div>
          )}
          <div className="command-list">
            {visibleCommands.map((cmd, i) => {
              const idx = allItems.findIndex((item) => item.type === 'command' && item.data.id === cmd.id);
              return (
                <div
                  key={cmd.id}
                  className={`command-item${selectedIndex === idx ? ' active' : ''}`}
                  onClick={() => handleSelect(idx)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <span className="cmd-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="4 7 12 15 20 7"/>
                    </svg>
                  </span>
                  <span className="cmd-label">{cmd.label}</span>
                  {cmd.shortcut && <span className="cmd-shortcut">{cmd.shortcut}</span>}
                </div>
              );
            })}
            {visibleFiles.map((file) => {
              const idx = allItems.findIndex((item) => item.type === 'file' && item.data === file);
              return (
                <div
                  key={file}
                  className={`command-item${selectedIndex === idx ? ' active' : ''}`}
                  onClick={() => handleSelect(idx)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <span className="cmd-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                  </span>
                  <span className="cmd-label">{file}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
