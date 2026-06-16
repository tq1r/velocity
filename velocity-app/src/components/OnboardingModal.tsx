interface OnboardingModalProps {
  onClose: () => void;
  onOpenFolder: () => void;
}

export function OnboardingModal({ onClose, onOpenFolder }: OnboardingModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content animate-in" onClick={(e) => e.stopPropagation()}>
        <div className="onboarding-content">
          <h1>Velocity</h1>
          <p className="onboarding-subtitle">
            A premium AI-powered code editor. Open a project and start coding
            with intelligent assistance at your fingertips.
          </p>
          <div className="onboarding-features">
            <div className="onboarding-feature">
              <h3>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a4 4 0 0 1 4 4c0 2-2 3-2 5h-4c0-2-2-3-2-5a4 4 0 0 1 4-4Z"/><path d="M12 22v-4"/>
                </svg>
                AI-Powered
              </h3>
              <p>Chat, explain, refactor, and edit code with an AI assistant that understands your project context.</p>
            </div>
            <div className="onboarding-feature">
              <h3>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                Modern Editor
              </h3>
              <p>Full-featured code editing with Monaco, multi-tab support, syntax highlighting, and project indexing.</p>
            </div>
            <div className="onboarding-feature">
              <h3>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
                Project Indexing
              </h3>
              <p>Automatic project-wide file indexing gives AI full context of your codebase for better responses.</p>
            </div>
            <div className="onboarding-feature">
              <h3>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                </svg>
                Premium Themes
              </h3>
              <p>Multiple themes and accent colors with a polished, professional dark UI designed for long coding sessions.</p>
            </div>
          </div>
          <button className="onboarding-btn" onClick={() => { onOpenFolder(); onClose(); }}>
            Open Project
          </button>
          <button className="onboarding-skip" onClick={onClose}>
            Skip — I'll open a project later
          </button>
        </div>
      </div>
    </div>
  );
}
