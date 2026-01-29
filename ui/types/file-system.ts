// File system types for the code environment

export interface FileNode {
  name: string;
  path: string;
  type: 'file';
  content: string;
  language: string;
}

export interface FolderNode {
  name: string;
  path: string;
  type: 'folder';
  children: (FileNode | FolderNode)[];
}

export type FileSystemNode = FileNode | FolderNode;

export interface OpenFile {
  path: string;
  name: string;
  content: string;
  language: string;
  isDirty: boolean;
  originalContent: string;
}

// Helper to get language from file extension
export function getLanguageFromExtension(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    py: 'python',
    js: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    jsx: 'javascript',
    json: 'json',
    md: 'markdown',
    txt: 'plaintext',
    yaml: 'yaml',
    yml: 'yaml',
    html: 'html',
    css: 'css',
    sql: 'sql',
    sh: 'shell',
    bash: 'shell',
  };
  return languageMap[ext || ''] || 'plaintext';
}

// Helper to get file icon based on extension
export function getFileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const iconMap: Record<string, string> = {
    py: '🐍',
    js: '📜',
    ts: '📘',
    tsx: '⚛️',
    jsx: '⚛️',
    json: '📋',
    md: '📝',
    txt: '📄',
    yaml: '⚙️',
    yml: '⚙️',
    html: '🌐',
    css: '🎨',
  };
  return iconMap[ext || ''] || '📄';
}
