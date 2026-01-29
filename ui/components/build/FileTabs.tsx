'use client';

import { cn } from '@/lib/utils';
import { X, File } from 'lucide-react';
import type { OpenFile } from '@/types/file-system';

interface FileTabsProps {
  openFiles: OpenFile[];
  activeFilePath: string | null;
  onTabSelect: (path: string) => void;
  onTabClose: (path: string) => void;
}

function FileIcon({ filename }: { filename: string }) {
  const ext = filename.split('.').pop()?.toLowerCase();
  
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

  return <File size={12} className={cn('shrink-0', getIconColor())} />;
}

export default function FileTabs({ 
  openFiles, 
  activeFilePath, 
  onTabSelect, 
  onTabClose 
}: FileTabsProps) {
  if (openFiles.length === 0) {
    return (
      <div className="h-9 bg-muted border-b border-border" />
    );
  }

  return (
    <div className="flex items-center h-9 bg-muted border-b border-border overflow-x-auto scrollbar-thin">
      {openFiles.map((file) => {
        const isActive = file.path === activeFilePath;
        return (
          <div
            key={file.path}
            className={cn(
              'group flex items-center gap-1.5 h-full px-3 text-sm cursor-pointer border-r border-border min-w-0',
              isActive
                ? 'bg-background text-foreground'
                : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
            )}
            onClick={() => onTabSelect(file.path)}
          >
            <FileIcon filename={file.name} />
            <span className="truncate max-w-32">{file.name}</span>
            {file.isDirty && (
              <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(file.path);
              }}
              className={cn(
                'p-0.5 rounded hover:bg-muted shrink-0 transition-opacity cursor-pointer',
                isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              )}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
