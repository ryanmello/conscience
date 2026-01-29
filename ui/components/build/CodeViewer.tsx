'use client';

import { useState, useCallback } from 'react';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import FileTree from '@/components/build/FileTree';
import FileTabs from '@/components/build/FileTabs';
import CodeEditor from '@/components/build/CodeEditor';
import type { FileSystemNode, FileNode, OpenFile } from '@/types/file-system';

interface CodeViewerProps {
  files: FileSystemNode[];
  onFileChange?: (path: string, content: string) => void;
}

export default function CodeViewer({ files, onFileChange }: CodeViewerProps) {
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);

  const handleFileSelect = useCallback((file: FileNode) => {
    // Check if file is already open
    const existingFile = openFiles.find((f) => f.path === file.path);
    
    if (existingFile) {
      // Just switch to the tab
      setActiveFilePath(file.path);
    } else {
      // Open the file in a new tab
      const newOpenFile: OpenFile = {
        path: file.path,
        name: file.name,
        content: file.content,
        language: file.language,
        isDirty: false,
        originalContent: file.content,
      };
      setOpenFiles((prev) => [...prev, newOpenFile]);
      setActiveFilePath(file.path);
    }
  }, [openFiles]);

  const handleTabSelect = useCallback((path: string) => {
    setActiveFilePath(path);
  }, []);

  const handleTabClose = useCallback((path: string) => {
    setOpenFiles((prev) => {
      const newFiles = prev.filter((f) => f.path !== path);
      
      // If we closed the active tab, switch to another tab
      if (activeFilePath === path) {
        const closedIndex = prev.findIndex((f) => f.path === path);
        if (newFiles.length > 0) {
          // Prefer the tab to the left, or the first tab
          const newActiveIndex = Math.max(0, closedIndex - 1);
          setActiveFilePath(newFiles[newActiveIndex]?.path || null);
        } else {
          setActiveFilePath(null);
        }
      }
      
      return newFiles;
    });
  }, [activeFilePath]);

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (!activeFilePath || value === undefined) return;
    
    setOpenFiles((prev) =>
      prev.map((file) => {
        if (file.path === activeFilePath) {
          const isDirty = value !== file.originalContent;
          return { ...file, content: value, isDirty };
        }
        return file;
      })
    );
    
    onFileChange?.(activeFilePath, value);
  }, [activeFilePath, onFileChange]);

  const activeFile = openFiles.find((f) => f.path === activeFilePath);

  return (
    <div className="h-full bg-card">
      <ResizablePanelGroup direction="horizontal">
        {/* File Tree Panel */}
        <ResizablePanel defaultSize={25} minSize={15} maxSize={40}>
          <FileTree
            files={files}
            selectedPath={activeFilePath}
            onFileSelect={handleFileSelect}
          />
        </ResizablePanel>

        <ResizableHandle />

        {/* Editor Panel */}
        <ResizablePanel defaultSize={75}>
          <div className="flex flex-col h-full">
            <FileTabs
              openFiles={openFiles}
              activeFilePath={activeFilePath}
              onTabSelect={handleTabSelect}
              onTabClose={handleTabClose}
            />
            <div className="flex-1 min-h-0">
              {activeFile ? (
                <CodeEditor
                  value={activeFile.content}
                  language={activeFile.language}
                  onChange={handleEditorChange}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  <div className="text-center">
                    <p>No file open</p>
                    <p className="text-xs mt-1">Select a file from the explorer to edit</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
