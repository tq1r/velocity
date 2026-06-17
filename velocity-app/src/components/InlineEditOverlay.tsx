import { useState, useRef, useEffect, useCallback } from 'react';
import { useVelocityStore } from '../state/store';
import { runAIRequest, runLocalAIRequest, getQuotaInfo } from '../lib/tauri';
import type { AIRequest } from '../types';

interface InlineEditOverlayProps {
  onClose: () => void;
}

export function InlineEditOverlay({ onClose }: InlineEditOverlayProps) {
  const store = useVelocityStore();
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!prompt.trim() || isLoading) return;
    setIsLoading(true);
    store.setAiWorking(true);

    const activeTab = store.tabs.find((t) => t.path === store.activeTabPath);
    const fileContent = activeTab?.content || '';
    const selection = store.selection.text || '';

    const systemMsg = `You are an AI code editor. The user wants you to edit their code.
Current file path: ${activeTab?.path || 'unknown'}
File content:
\`\`\`
${fileContent}
\`\`\`
${selection ? `Selected text:\n\`\`\`\n${selection}\n\`\`\`` : ''}

The user request: ${prompt}

IMPORTANT: Respond with the COMPLETE new file content. Replace the entire file content with your edit. Do not include any explanation, just output the full file content after applying the edit. Wrap the result in a code block with the file's language.`;

    const request: AIRequest = {
      messages: [
        { role: 'system', content: systemMsg },
        { role: 'user', content: prompt },
      ],
      current_file: activeTab?.path || null,
      selected_text: selection || null,
      referenced_paths: [activeTab?.path].filter(Boolean) as string[],
      include_project_file_list: false,
      action: 'replace_selection',
      user_email: store.user?.email || null,
      is_owner: store.isOwner,
    };

    try {
      const isLocalModel = store.settings?.ai?.use_local_model ?? false;
      let response;
      if (isLocalModel) {
        response = await runLocalAIRequest(request);
      } else {
        response = await runAIRequest(request);
      }

      const content = response.content || response.message || '';
      const codeBlockMatch = content.match(/```(?:\w+)?\n([\s\S]*?)```/);
      const newContent = codeBlockMatch ? codeBlockMatch[1].trim() : content.trim();

      if (newContent && store.activeTabPath) {
        store.updateTabContent(store.activeTabPath, newContent);
        store.setStatusText('AI edit applied');
      } else {
        store.setStatusText('AI returned empty result');
      }

      getQuotaInfo(store.isOwner).then((q) => store.setQuota(q)).catch(() => {});
    } catch (err) {
      store.setStatusText(`AI edit failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
      store.setAiWorking(false);
      onClose();
    }
  }, [prompt, isLoading, store, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  }, [handleSubmit, onClose]);

  return (
    <div className="inline-edit-overlay" onClick={onClose}>
      <div className="inline-edit-bar" onClick={(e) => e.stopPropagation()}>
        <div className="inline-edit-header">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
          <span>Edit with AI</span>
          {store.selection.text && (
            <span className="inline-edit-selection-badge">
              {store.selection.text.length} chars selected
            </span>
          )}
        </div>
        <div className="inline-edit-input-row">
          <textarea
            ref={inputRef}
            className="inline-edit-input"
            placeholder={store.selection.text ? 'Describe how to change the selected code...' : 'Describe what to edit...'}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isLoading}
          />
          <button
            className="inline-edit-send"
            onClick={handleSubmit}
            disabled={!prompt.trim() || isLoading}
          >
            {isLoading ? (
              <div className="inline-edit-loading">
                <span className="dot" /><span className="dot" /><span className="dot" />
              </div>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 12h14"/><path d="m12 5 7 7-7 7"/>
              </svg>
            )}
          </button>
        </div>
        <div className="inline-edit-footer">
          <span>Enter to apply</span>
          <span>Shift+Enter for new line</span>
          <span>Esc to cancel</span>
        </div>
      </div>
    </div>
  );
}
