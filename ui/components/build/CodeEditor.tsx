'use client';

import Editor, { type Monaco } from '@monaco-editor/react';
import { useTheme } from 'next-themes';

interface CodeEditorProps {
  value: string;
  language: string;
  onChange?: (value: string | undefined) => void;
  readOnly?: boolean;
}

// Night Owl theme by Sarah Drasner
// https://github.com/sdras/night-owl-vscode-theme
const nightOwl = {
  base: 'vs-dark' as const,
  inherit: true,
  rules: [
    { token: 'comment', foreground: '637777', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'c792ea' },
    { token: 'keyword.control', foreground: 'c792ea' },
    { token: 'keyword.operator', foreground: 'c792ea' },
    { token: 'string', foreground: 'ecc48d' },
    { token: 'string.escape', foreground: 'f78c6c' },
    { token: 'number', foreground: 'f78c6c' },
    { token: 'constant', foreground: 'f78c6c' },
    { token: 'constant.language', foreground: 'ff5874' },
    { token: 'type', foreground: 'ffcb8b' },
    { token: 'class', foreground: 'ffcb8b' },
    { token: 'function', foreground: '82aaff' },
    { token: 'function.call', foreground: '82aaff' },
    { token: 'variable', foreground: 'd6deeb' },
    { token: 'variable.predefined', foreground: '7fdbca' },
    { token: 'parameter', foreground: 'd7dbe0' },
    { token: 'property', foreground: '7fdbca' },
    { token: 'tag', foreground: 'caece6' },
    { token: 'attribute.name', foreground: 'addb67' },
    { token: 'attribute.value', foreground: 'ecc48d' },
    { token: 'regexp', foreground: '5ca7e4' },
    { token: 'operator', foreground: 'c792ea' },
    { token: 'delimiter', foreground: 'd6deeb' },
    { token: 'delimiter.bracket', foreground: 'd6deeb' },
  ],
  colors: {
    // Using colors from globals.css dark theme
    'editor.background': '#18181b',           // --sidebar/--card: oklch(0.21)
    'editor.foreground': '#d6deeb',
    'editorLineNumber.foreground': '#52525b', // zinc-600
    'editorLineNumber.activeForeground': '#a1a1aa', // zinc-400
    'editor.selectionBackground': '#3f3f46',  // zinc-700
    'editor.lineHighlightBackground': '#27272a', // --secondary: oklch(0.274)
    'editorCursor.foreground': '#a1a1aa',
    'editor.selectionHighlightBackground': '#3f3f4666',
    'editorIndentGuide.background': '#3f3f46',
    'editorIndentGuide.activeBackground': '#52525b',
    'editorWhitespace.foreground': '#3f3f46',
    'minimap.background': '#18181b',
    'scrollbar.shadow': '#18181b',
    'editorBracketMatch.background': '#3f3f4666',
    'editorBracketMatch.border': '#52525b',
  },
};

// Night Owl Light theme
const nightOwlLight = {
  base: 'vs' as const,
  inherit: true,
  rules: [
    { token: 'comment', foreground: '989fb1', fontStyle: 'italic' },
    { token: 'keyword', foreground: '994cc3' },
    { token: 'keyword.control', foreground: '994cc3' },
    { token: 'keyword.operator', foreground: '994cc3' },
    { token: 'string', foreground: 'c96765' },
    { token: 'string.escape', foreground: 'aa0982' },
    { token: 'number', foreground: 'aa0982' },
    { token: 'constant', foreground: 'aa0982' },
    { token: 'constant.language', foreground: 'bc5454' },
    { token: 'type', foreground: '994cc3' },
    { token: 'class', foreground: '111111' },
    { token: 'function', foreground: '4876d6' },
    { token: 'function.call', foreground: '4876d6' },
    { token: 'variable', foreground: '403f53' },
    { token: 'variable.predefined', foreground: '0c969b' },
    { token: 'parameter', foreground: '403f53' },
    { token: 'property', foreground: '0c969b' },
    { token: 'tag', foreground: '994cc3' },
    { token: 'attribute.name', foreground: '4876d6' },
    { token: 'attribute.value', foreground: 'c96765' },
    { token: 'regexp', foreground: '5ca7e4' },
    { token: 'operator', foreground: '994cc3' },
    { token: 'delimiter', foreground: '403f53' },
  ],
  colors: {
    'editor.background': '#fbfbfb',
    'editor.foreground': '#403f53',
    'editorLineNumber.foreground': '#90a7b2',
    'editorLineNumber.activeForeground': '#403f53',
    'editor.selectionBackground': '#e0e0e0',
    'editor.lineHighlightBackground': '#f0f0f0',
    'editorCursor.foreground': '#90a7b2',
    'editor.selectionHighlightBackground': '#d3e8f8',
    'editorIndentGuide.background': '#e0e0e0',
    'editorIndentGuide.activeBackground': '#c0c0c0',
  },
};

// Define custom themes before Monaco mounts
const defineThemes = (monaco: Monaco) => {
  monaco.editor.defineTheme('night-owl', nightOwl);
  monaco.editor.defineTheme('night-owl-light', nightOwlLight);
};

export default function CodeEditor({ 
  value, 
  language, 
  onChange, 
  readOnly = false 
}: CodeEditorProps) {
  const { resolvedTheme } = useTheme();
  const monacoTheme = resolvedTheme === 'dark' ? 'night-owl' : 'night-owl-light';

  const handleBeforeMount = (monaco: Monaco) => {
    defineThemes(monaco);
  };

  return (
    <div className="h-full w-full bg-card">
      <Editor
        height="100%"
        language={language}
        value={value}
        theme={monacoTheme}
        beforeMount={handleBeforeMount}
        onChange={onChange}
        loading={
          <div className="flex items-center justify-center h-full bg-card text-muted-foreground text-sm">
            Loading editor...
          </div>
        }
        options={{
          readOnly,
          minimap: { enabled: true },
          fontSize: 14,
          fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 4,
          insertSpaces: true,
          wordWrap: 'off',
          folding: true,
          renderLineHighlight: 'line',
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          smoothScrolling: true,
          padding: { top: 12, bottom: 12 },
        }}
      />
    </div>
  );
}
