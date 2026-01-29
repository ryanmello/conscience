'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from 'lucide-react';
import type { FileSystemNode, FileNode, FolderNode } from '@/types/file-system';

interface FileTreeProps {
  files: FileSystemNode[];
  selectedPath: string | null;
  onFileSelect: (file: FileNode) => void;
}

interface FileTreeItemProps {
  node: FileSystemNode;
  depth: number;
  selectedPath: string | null;
  onFileSelect: (file: FileNode) => void;
}

function FileTreeItem({ node, depth, selectedPath, onFileSelect }: FileTreeItemProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const isSelected = selectedPath === node.path;

  if (node.type === 'folder') {
    const folder = node as FolderNode;
    return (
      <div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            'flex items-center gap-1.5 w-full px-2 py-1 text-sm hover:bg-muted/50 transition-colors',
            'text-left cursor-pointer'
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {isExpanded ? (
            <ChevronDown size={14} className="text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight size={14} className="text-muted-foreground shrink-0" />
          )}
          {isExpanded ? (
            <FolderOpen size={14} className="text-yellow-500 shrink-0" />
          ) : (
            <Folder size={14} className="text-yellow-500 shrink-0" />
          )}
          <span className="truncate">{folder.name}</span>
        </button>
        {isExpanded && (
          <div>
            {folder.children.map((child) => (
              <FileTreeItem
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                onFileSelect={onFileSelect}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const file = node as FileNode;
  return (
    <button
      onClick={() => onFileSelect(file)}
      className={cn(
        'flex items-center gap-1.5 w-full px-2 py-1 text-sm transition-colors',
        'text-left cursor-pointer',
        isSelected
          ? 'bg-blue-500/20 text-blue-400'
          : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
      )}
      style={{ paddingLeft: `${depth * 12 + 28}px` }}
    >
      <FileIcon filename={file.name} />
      <span className="truncate">{file.name}</span>
    </button>
  );
}

function FileIcon({ filename }: { filename: string }) {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  // Color based on file type
  const getIconColor = () => {
    switch (ext) {
      case 'py':
        return 'text-yellow-400';
      case 'ts':
      case 'tsx':
        return 'text-blue-400';
      case 'js':
      case 'jsx':
        return 'text-yellow-300';
      case 'json':
        return 'text-yellow-500';
      case 'md':
        return 'text-gray-400';
      default:
        return 'text-gray-400';
    }
  };

  return <File size={14} className={cn('shrink-0', getIconColor())} />;
}

export default function FileTree({ files, selectedPath, onFileSelect }: FileTreeProps) {
  return (
    <div className="h-full overflow-auto bg-card py-2">
      <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Explorer
      </div>
      <div className="mt-1">
        {files.map((node) => (
          <FileTreeItem
            key={node.path}
            node={node}
            depth={0}
            selectedPath={selectedPath}
            onFileSelect={onFileSelect}
          />
        ))}
      </div>
    </div>
  );
}
