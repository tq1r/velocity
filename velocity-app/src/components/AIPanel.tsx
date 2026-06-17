import { useState, useRef, useEffect, useCallback } from 'react';
import { useVelocityStore } from '../state/store';
import { runLocalAIRequest, runAIRequest, searchFiles, applyUnifiedDiff, startAiStream, listenForAiStream, getQuotaInfo, getSettings } from '../lib/tauri';
import type { AIChatMessage, AIRequest } from '../types';

type AIAction = 'chat' | 'explain' | 'refactor' | 'edit';

interface AIPanelProps {
  action: AIAction;
  onActionChange: (action: AIAction) => void;
}

export function AIPanel({ action, onActionChange }: AIPanelProps) {
  const store = useVelocityStore();
  const [input, setInput] = useState('');
  const [diffContent, setDiffContent] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, []);

  const isLocalModel = store.settings?.ai?.use_local_model ?? false;
  const isDesktopApp = typeof window !== 'undefined' && (window as any).__TAURI__?.invoke != null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [store.aiMessages, streamingContent]);

  const getModelContext = useCallback(() => {
    const activeTab = store.tabs.find((t) => t.path === store.activeTabPath);
    return {
      current_file: activeTab?.path ?? null,
      selected_text: store.selection.text || null,
      referenced_paths: [activeTab?.path].filter(Boolean) as string[],
      include_project_file_list: true,
    };
  }, [store.activeTabPath, store.selection.text, store.tabs]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || store.isAiWorking) return;

    const userMsg: AIChatMessage = { role: 'user', content: input };
    store.pushAIMessage(userMsg);
    setInput('');
    store.setAiWorking(true);
    setDiffContent(null);
    setStreamingContent('');

    const context = getModelContext();
    const actionType = action === 'edit' ? 'apply_diff' : action === 'explain' ? 'explain' : action === 'refactor' ? 'refactor' : 'chat';

    const hasApiKey = !!store.settings?.ai?.api_key;
    if (!isLocalModel && !hasApiKey && !store.user) {
      store.pushAIMessage({ role: 'assistant', content: 'Sign in to use AI, or add your own API key in Settings.' });
      store.setAiWorking(false);
      return;
    }

    const request: AIRequest = {
      messages: [...store.aiMessages, userMsg],
      ...context,
      action: actionType,
      user_email: store.user?.email || null,
      is_owner: store.isOwner,
    };

    const refreshQuota = () => {
      getQuotaInfo(store.isOwner).then((q) => store.setQuota(q)).catch(() => {});
    };

    const canStream = isDesktopApp && (hasApiKey || isLocalModel);

    if (canStream && !isLocalModel) {
      try {
        await startAiStream(request);

        if (unsubRef.current) unsubRef.current();
        unsubRef.current = await listenForAiStream(
          (token) => {
            setStreamingContent((prev) => (prev || '') + token);
          },
          (response) => {
            setStreamingContent(null);
            refreshQuota();
            const assistantMsg: AIChatMessage = { role: 'assistant', content: response.message };
            store.pushAIMessage(assistantMsg);
            store.setLastAIResponse(response);
            if (response.diff) setDiffContent(response.diff);
            if (response.rewrite && store.activeTabPath) {
              store.updateTabContent(store.activeTabPath, response.rewrite);
            }
            store.setAiWorking(false);
            if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
          },
          (error) => {
            setStreamingContent(null);
            if (error) {
              store.pushAIMessage({ role: 'assistant', content: `Error: ${error}` });
            }
            store.setAiWorking(false);
            if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
          },
        );
      } catch (err) {
        setStreamingContent(null);
        store.pushAIMessage({
          role: 'assistant',
          content: `Error: ${err instanceof Error ? err.message : String(err)}`,
        });
        store.setAiWorking(false);
      }
    } else if (!isLocalModel) {
      // browser mode — direct API call
      try {
        const response = await runAIRequest(request);
        refreshQuota();
        const assistantMsg: AIChatMessage = { role: 'assistant', content: response.content || response.message || '' };
        store.pushAIMessage(assistantMsg);
        store.setLastAIResponse({ message: assistantMsg.content, diff: null, rewrite: null, referenced_files: [] });
      } catch (err) {
        store.pushAIMessage({
          role: 'assistant',
          content: `Error: ${err instanceof Error ? err.message : String(err)}`,
        });
      } finally {
        store.setAiWorking(false);
      }
    } else {
      try {
        const response = await runLocalAIRequest(request);
        const assistantMsg: AIChatMessage = { role: 'assistant', content: response.message };
        store.pushAIMessage(assistantMsg);
        store.setLastAIResponse(response);
        if (response.diff) setDiffContent(response.diff);
        if (response.rewrite && store.activeTabPath) {
          store.updateTabContent(store.activeTabPath, response.rewrite);
        }
      } catch (err) {
        store.pushAIMessage({
          role: 'assistant',
          content: `Error: ${err instanceof Error ? err.message : String(err)}`,
        });
      } finally {
        store.setAiWorking(false);
      }
    }
  }, [input, store, action, getModelContext, isLocalModel]);

  const handleApplyDiff = useCallback(async () => {
    if (!diffContent) return;
    try {
      const result = await applyUnifiedDiff(diffContent);
      store.setStatusText(result.summary);
      setDiffContent(null);
      store.pushAIMessage({
        role: 'assistant',
        content: `Applied diff to ${result.changed_files.length} file(s).`,
      });
    } catch (err) {
      store.pushAIMessage({
        role: 'assistant',
        content: `Failed to apply diff: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }, [diffContent, store]);

  const handleRefFile = useCallback(async () => {
    const query = prompt('Search for a file to reference:');
    if (!query) return;
    const results = await searchFiles(query);
    if (results.length === 0) {
      store.pushAIMessage({ role: 'assistant', content: `No files found matching "${query}".` });
      return;
    }
    store.pushAIMessage({
      role: 'user',
      content: `Reference file: ${results[0]}`,
    });
  }, [store]);

  const handleClearChat = useCallback(() => {
    store.replaceAIMessages([{ role: 'assistant', content: 'Chat cleared. How can I help?' }]);
    store.setLastAIResponse(null);
    setDiffContent(null);
    setStreamingContent(null);
  }, [store]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const modelLabel = isLocalModel ? 'Velocity Model' : (store.settings?.ai?.model || 'AI');

  const quota = store.quota;
  const quotaLabel = quota
    ? quota.is_owner
      ? 'Owner (unlimited)'
      : quota.daily_limit === 0
        ? 'Unlimited'
        : `${quota.remaining}/${quota.daily_limit} today`
    : null;

  if (!store.user) {
    return (
      <div className="ai-panel">
        <div className="ai-panel-header">
          <span>AI</span>
        </div>
        <div className="ai-messages" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', padding: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>Sign in to use AI</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>Connect GitHub or Google to start coding with AI.</div>
            <button className="ai-action-btn active" onClick={() => store.setLoginModalOpen(true)}>Sign In</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-panel">
      <div className="ai-panel-header">
        <span>{modelLabel}</span>
        <div className="ai-panel-header-actions">
          {quotaLabel && (
            <span className="quota-badge" title={quota?.is_owner ? 'Owner account - no limits' : 'AI requests remaining today'}>
              {quotaLabel}
            </span>
          )}
          <button className="ai-panel-header-btn" title="Reference file" onClick={handleRefFile}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
          </button>
          <button className="ai-panel-header-btn" title="Clear chat" onClick={handleClearChat}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
      <div className="ai-action-buttons">
        {(['chat', 'explain', 'refactor', 'edit'] as AIAction[]).map((a) => (
          <button
            key={a}
            className={`ai-action-btn${action === a ? ' active' : ''}`}
            onClick={() => onActionChange(a)}
          >
            {a === 'chat' ? 'Chat' : a === 'explain' ? 'Explain' : a === 'refactor' ? 'Refactor' : 'Edit Code'}
          </button>
        ))}
      </div>
      <div className="ai-messages">
        {store.aiMessages.map((msg, i) => (
          <div key={i} className={`ai-message ${msg.role}`}>
            <div className="msg-label">
              {msg.role === 'user' ? 'You' : modelLabel}
            </div>
            <div
              className="bubble"
              dangerouslySetInnerHTML={{
                __html: msg.content
                  .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
                  .replace(/`([^`]+)`/g, '<code>$1</code>')
                  .replace(/\n/g, '<br/>'),
              }}
            />
          </div>
        ))}
        {streamingContent !== null && (
          <div className="ai-message assistant">
            <div className="msg-label">{modelLabel}</div>
            <div
              className="bubble streaming"
              dangerouslySetInnerHTML={{
                __html: streamingContent
                  ? streamingContent
                      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
                      .replace(/`([^`]+)`/g, '<code>$1</code>')
                      .replace(/\n/g, '<br/>')
                  : '',
              }}
            />
          </div>
        )}
        {store.isAiWorking && streamingContent === null && (
          <div className="ai-thinking">
            <span>{isLocalModel ? 'Thinking locally' : 'Thinking'}</span>
            <div className="dots">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      {diffContent && (
        <div className="diff-preview" style={{ margin: '0 12px 8px' }}>
          <div className="diff-header">
            <span>Diff Preview</span>
            <div className="diff-header-actions">
              <button className="diff-btn" onClick={() => setDiffContent(null)}>Dismiss</button>
              <button className="diff-btn apply" onClick={handleApplyDiff}>Apply Diff</button>
            </div>
          </div>
          <div className="diff-content">{diffContent.split('\n').map((line, i) => {
            let cls = '';
            if (line.startsWith('+')) cls = 'diff-line-add';
            else if (line.startsWith('-')) cls = 'diff-line-remove';
            return <div key={i} className={cls}>{line}</div>;
          })}</div>
        </div>
      )}
      <div className="ai-input-area">
        <textarea
          ref={inputRef}
          className="ai-input"
          placeholder={
            action === 'chat' ? 'Ask anything about your code...' :
            action === 'explain' ? 'Select code and ask for explanation...' :
            action === 'refactor' ? 'Describe how to refactor...' :
            'Describe the edit you want to make...'
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
        />
        <button
          className="ai-send-btn"
          onClick={handleSend}
          disabled={!input.trim() || store.isAiWorking}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
