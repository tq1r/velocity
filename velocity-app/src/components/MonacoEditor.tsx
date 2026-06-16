import { useRef, useCallback, useMemo } from 'react';
import Editor, { type OnMount, type BeforeMount } from '@monaco-editor/react';
import type { SelectionSnapshot } from '../types';
import { useVelocityStore } from '../state/store';
import { getInlineCompletion } from '../lib/tauri';

interface MonacoEditorProps {
  content: string;
  language: string;
  path: string;
  onChange: (content: string) => void;
  onSelectionChange: (selection: SelectionSnapshot) => void;
}

const THEMES: Record<string, { base: 'vs-dark' | 'vs'; rules: any[]; colors: Record<string, string> }> = {
  'velocity-night': {
    base: 'vs-dark',
    rules: [
      { token: 'comment', foreground: '6b6b82' },
      { token: 'keyword', foreground: 'c4a0ff' },
      { token: 'string', foreground: '6ee7b7' },
      { token: 'number', foreground: 'fbbf24' },
      { token: 'type', foreground: '67e8f9' },
      { token: 'function', foreground: '7b9eff' },
      { token: 'variable', foreground: 'e2e2ee' },
      { token: 'constant', foreground: 'fca5a5' },
    ],
    colors: {
      'editor.background': '#16161e',
      'editor.foreground': '#e2e2ee',
      'editor.lineHighlightBackground': '#1c1c26',
      'editor.selectionBackground': '#32324a',
      'editorCursor.foreground': '#c4a0ff',
      'editorLineNumber.foreground': '#6b6b82',
      'editorLineNumber.activeForeground': '#9d9db5',
      'editorWidget.background': '#1c1c26',
      'editorWidget.border': '#2a2a38',
      'editorGutter.background': '#16161e',
      'minimap.background': '#0f0f14',
    },
  },
  'midnight-blue': {
    base: 'vs-dark',
    rules: [
      { token: 'comment', foreground: '5c6da6' },
      { token: 'keyword', foreground: '7b9eff' },
      { token: 'string', foreground: '6ee7b7' },
      { token: 'number', foreground: 'fbbf24' },
      { token: 'type', foreground: '67e8f9' },
      { token: 'function', foreground: '7b9eff' },
    ],
    colors: {
      'editor.background': '#111627',
      'editor.foreground': '#d6defa',
      'editor.lineHighlightBackground': '#171e33',
      'editor.selectionBackground': '#26304f',
      'editorCursor.foreground': '#7b9eff',
      'editorLineNumber.foreground': '#5c6da6',
      'editorLineNumber.activeForeground': '#8e9ed4',
      'editorWidget.background': '#171e33',
      'editorWidget.border': '#26304f',
      'editorGutter.background': '#111627',
      'minimap.background': '#0a0e1a',
    },
  },
  'graphite': {
    base: 'vs-dark',
    rules: [
      { token: 'comment', foreground: '666666' },
      { token: 'keyword', foreground: 'b0b0b0' },
      { token: 'string', foreground: '6ee7b7' },
      { token: 'number', foreground: 'fbbf24' },
      { token: 'type', foreground: '67e8f9' },
      { token: 'function', foreground: 'b0b0b0' },
    ],
    colors: {
      'editor.background': '#1a1a1a',
      'editor.foreground': '#e0e0e0',
      'editor.lineHighlightBackground': '#222222',
      'editor.selectionBackground': '#2a2a2a',
      'editorCursor.foreground': '#b0b0b0',
      'editorLineNumber.foreground': '#666666',
      'editorLineNumber.activeForeground': '#999999',
      'editorWidget.background': '#222222',
      'editorWidget.border': '#333333',
      'editorGutter.background': '#1a1a1a',
      'minimap.background': '#121212',
    },
  },
};

export function MonacoEditor({ content, language, path, onChange, onSelectionChange }: MonacoEditorProps) {
  const editorRef = useRef<unknown>(null);
  const theme = useVelocityStore((s) => s.settings?.theme) || 'velocity-night';
  const settings = useVelocityStore((s) => s.settings);

  const handleBeforeMount: BeforeMount = useCallback((monacoInstance) => {
    for (const [name, t] of Object.entries(THEMES)) {
      monacoInstance.editor.defineTheme(name, {
        base: t.base,
        inherit: true,
        rules: t.rules,
        colors: t.colors,
        encodedTokensColors: undefined,
      });
    }

    monacoInstance.languages.registerInlineCompletionsProvider('*', {
      provideInlineCompletions: async (model, position) => {
        const offset = model.getOffsetAt(position);
        const fullText = model.getValue();
        const prefix = fullText.substring(0, offset);
        const suffix = fullText.substring(offset);

        const lineContent = model.getLineContent(position.lineNumber);
        if (lineContent.trim().length < 3) return { items: [] };

        try {
          const text = await getInlineCompletion(prefix, suffix, language);
          if (!text) return { items: [] };

          const range = new monacoInstance.Range(
            position.lineNumber, position.column,
            position.lineNumber, position.column,
          );

          return {
            items: [{ insertText: text, range, complete: true }],
          };
        } catch {
          return { items: [] };
        }
      },
      freeInlineCompletions: () => {},
    });
  }, [language]);

  const handleMount: OnMount = useCallback((editor) => {
    editorRef.current = editor;
    editor.onDidChangeCursorSelection((e: any) => {
      const model = editor.getModel();
      if (!model) return;
      const sel = e.selection;
      const text = model.getValueInRange(sel);
      onSelectionChange({
        text,
        startLineNumber: sel.startLineNumber,
        startColumn: sel.startColumn,
        endLineNumber: sel.endLineNumber,
        endColumn: sel.endColumn,
      });
    });
    editor.focus();
  }, [onSelectionChange]);

  const handleChange = useCallback((value: string | undefined) => {
    if (value !== undefined) onChange(value);
  }, [onChange]);

  const monacoLang = ({
    typescript: 'typescript', javascript: 'javascript', rust: 'rust',
    python: 'python', go: 'go', c: 'c', cpp: 'cpp', csharp: 'csharp',
    html: 'html', css: 'css', json: 'json', yaml: 'yaml',
    markdown: 'markdown', shell: 'shell', sql: 'sql',
    php: 'php', ruby: 'ruby', swift: 'swift', kotlin: 'kotlin',
    dart: 'dart', lua: 'lua', toml: 'plaintext',
  } as Record<string, string>)[language] || 'plaintext';

  return (
    <Editor
      key={`${path}-${theme}`}
      beforeMount={handleBeforeMount}
      defaultLanguage={monacoLang}
      language={monacoLang}
      value={content}
      theme={theme}
      onChange={handleChange}
      onMount={handleMount}
      path={path}
      options={{
        fontSize: 14,
        fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace",
        fontLigatures: true,
        scrollBeyondLastLine: false,
        lineNumbers: 'on',
        renderLineHighlight: 'all',
        cursorBlinking: 'smooth',
        cursorSmoothCaretAnimation: 'on',
        smoothScrolling: true,
        padding: { top: 8, bottom: 8 },
        bracketPairColorization: { enabled: true },
        autoClosingBrackets: 'always',
        autoClosingQuotes: 'always',
        formatOnPaste: true,
        formatOnType: true,
        suggestOnTriggerCharacters: true,
        quickSuggestions: true,
        folding: true,
        foldingHighlight: true,
        foldingStrategy: 'indentation',
        tabSize: 2,
        insertSpaces: true,
        wordWrap: 'off',
        renderWhitespace: 'selection',
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: false,
        overviewRulerBorder: false,
        glyphMargin: false,
        lineDecorationsWidth: 8,
        lineNumbersMinChars: 3,
        inlineSuggest: { enabled: true },
        suggest: { showInline: true },
      }}
      loading={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
          Loading editor...
        </div>
      }
    />
  );
}
