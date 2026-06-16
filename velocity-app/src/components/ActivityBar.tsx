type SidebarView = 'files' | 'search';

interface ActivityBarProps {
  sidebarView: SidebarView;
  onViewChange: (view: SidebarView) => void;
  onOpenFolder: () => void;
  onOpenSettings: () => void;
  onLogin: () => void;
  user: { name: string | null; avatar_url: string | null; premium_tier: string | null } | null;
}

export function ActivityBar({ sidebarView, onViewChange, onOpenFolder, onOpenSettings, onLogin, user }: ActivityBarProps) {
  return (
    <div className="activity-bar">
      <button
        className={`activity-bar-btn ${sidebarView === 'files' ? 'active' : ''}`}
        title="Explorer (Ctrl+Shift+E)"
        onClick={() => onViewChange('files')}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
      </button>
      <button
        className={`activity-bar-btn ${sidebarView === 'search' ? 'active' : ''}`}
        title="Search (Ctrl+Shift+F)"
        onClick={() => onViewChange('search')}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
        </svg>
      </button>
      <div className="activity-bar-bottom">
        <button className="activity-bar-btn" title="Open Folder" onClick={onOpenFolder}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
        <button className="activity-bar-btn" title="Settings (⌘,)" onClick={onOpenSettings}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
          </svg>
        </button>
        <button className="activity-bar-btn" title={user ? `Signed in as ${user.name || 'User'}` : 'Sign in'} onClick={onLogin}>
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="" className="user-avatar-mini" />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          )}
          {user?.premium_tier && <span className="premium-dot-bar" />}
        </button>
      </div>
    </div>
  );
}
