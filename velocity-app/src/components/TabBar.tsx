import { useState, useRef, useCallback } from 'react';
import type { EditorTab } from '../types';

interface TabBarProps {
  tabs: EditorTab[];
  activePath: string | null;
  onSelect: (path: string | null) => void;
  onClose: (path: string) => void;
  onReorder?: (tabs: EditorTab[]) => void;
}

function getFileExtIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts': case 'tsx': return '\ud83d\udfe3';
    case 'js': case 'jsx': return '\ud83d\udfe8';
    case 'rs': return '\ud83e\ude84';
    case 'py': return '\ud83d\udfe9';
    case 'css': case 'scss': return '\ud83d\udfe6';
    case 'json': return '\u2699\ufe0f';
    case 'html': return '\ud83c\udf10';
    case 'md': return '\ud83d\udcdd';
    default: return '\ud83d\udcc4';
  }
}

export function TabBar({ tabs, activePath, onSelect, onClose, onReorder }: TabBarProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragNodeRef = useRef<HTMLElement | null>(null);

  if (tabs.length === 0) return null;

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    dragNodeRef.current = e.currentTarget as HTMLElement;
    setTimeout(() => {
      if (dragNodeRef.current) dragNodeRef.current.style.opacity = '0.4';
    }, 0);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragIndex !== null && dragIndex !== index) {
      setDragOverIndex(index);
    }
  }, [dragIndex]);

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      if (dragNodeRef.current) dragNodeRef.current.style.opacity = '';
      dragNodeRef.current = null;
      return;
    }
    const newTabs = [...tabs];
    const [moved] = newTabs.splice(dragIndex, 1);
    newTabs.splice(dropIndex, 0, moved);
    onReorder?.(newTabs);
    setDragIndex(null);
    setDragOverIndex(null);
    if (dragNodeRef.current) dragNodeRef.current.style.opacity = '';
    dragNodeRef.current = null;
  }, [dragIndex, tabs, onReorder]);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDragOverIndex(null);
    if (dragNodeRef.current) dragNodeRef.current.style.opacity = '';
    dragNodeRef.current = null;
  }, []);

  return (
    <div className="tab-bar">
      {tabs.map((tab, index) => (
        <div
          key={tab.path}
          className={`tab-item${tab.path === activePath ? ' active' : ''}${dragOverIndex === index ? ' drag-over' : ''}`}
          onClick={() => onSelect(tab.path)}
          title={tab.path}
          draggable
          onDragStart={(e) => handleDragStart(e, index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, index)}
          onDragEnd={handleDragEnd}
        >
          <span>{getFileExtIcon(tab.title)}</span>
          <span>{tab.title}</span>
          {tab.isDirty ? (
            <span className="dirty-dot" />
          ) : (
            <span className="tab-close" onClick={(e) => { e.stopPropagation(); onClose(tab.path); }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
              </svg>
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
