import type { EditorTab } from '../types';

interface TabBarProps {
  tabs: EditorTab[];
  activePath: string | null;
  onSelect: (path: string | null) => void;
  onClose: (path: string) => void;
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

export function TabBar({ tabs, activePath, onSelect, onClose }: TabBarProps) {
  if (tabs.length === 0) return null;

  return (
    <div className="tab-bar">
      {tabs.map((tab) => (
        <div
          key={tab.path}
          className={`tab-item${tab.path === activePath ? ' active' : ''}`}
          onClick={() => onSelect(tab.path)}
          title={tab.path}
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
