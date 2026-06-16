import { useVelocityStore } from '../state/store';

interface StatusBarProps {
  onSave: () => void;
}

export function StatusBar({ onSave }: StatusBarProps) {
  const store = useVelocityStore();
  const activeTab = store.tabs.find((t) => t.path === store.activeTabPath);
  const fileCount = store.workspace?.index_summary?.indexed_files ?? 0;

  return (
    <div className="status-bar">
      <span className="status-bar-item" title="Current status">
        {store.statusText}
      </span>
      {activeTab && (
        <>
          <span className="status-bar-item" title="Language">
            {activeTab.language}
          </span>
          {activeTab.isDirty && (
            <span className="status-bar-item" onClick={onSave} title="Save (⌘S)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
              </svg>
              {activeTab.isDirty ? 'Unsaved' : 'Saved'}
            </span>
          )}
        </>
      )}
      <div className="status-bar-right">
        {store.workspace && (
          <span className="status-bar-item" title="Indexed files">
            {fileCount} files
          </span>
        )}
        <span className="status-bar-item" title={`AI: ${store.settings?.ai?.model || 'Not configured'}`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 2 }}>
            <path d="M12 2a4 4 0 0 1 4 4c0 2-2 3-2 5h-4c0-2-2-3-2-5a4 4 0 0 1 4-4Z"/><path d="M12 22v-4"/>
          </svg>
          {store.settings?.ai?.model || 'No AI'}
        </span>
      </div>
    </div>
  );
}
