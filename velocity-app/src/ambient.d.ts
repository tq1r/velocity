declare module '@monaco-editor/react' {
  import type { ComponentProps } from 'react';
  import type monaco from 'monaco-editor';

  type OnChange = (value: string | undefined, ev: unknown) => void;
  type OnMount = (editor: monaco.editor.IStandaloneCodeEditor, monaco: typeof monaco) => void;
  type BeforeMount = (monaco: typeof monaco) => void;

  interface EditorProps {
    defaultLanguage?: string;
    language?: string;
    value?: string;
    theme?: string;
    path?: string;
    onChange?: OnChange;
    onMount?: OnMount;
    beforeMount?: BeforeMount;
    options?: monaco.editor.IStandaloneEditorConstructionOptions;
    loading?: React.ReactNode;
    height?: string | number;
    width?: string | number;
  }

  const Editor: React.FC<EditorProps>;
  export default Editor;
  export type { OnChange, OnMount, BeforeMount };
}

declare module '@tauri-apps/plugin-dialog' {
  interface OpenDialogOptions {
    directory?: boolean;
    multiple?: boolean;
    title?: string;
    filters?: { name: string; extensions: string[] }[];
  }

  export function open(options?: OpenDialogOptions): Promise<string | string[] | null>;
  export function save(options?: OpenDialogOptions): Promise<string | null>;
}
