'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import ChatPanel, { ChatMessage } from '@/components/build/ChatPanel';
import ExecutionLogs from '@/components/build/ExecutionLogs';
import SandboxHeader from '@/components/build/SandboxHeader';
import type { Agent, AgentStatus } from '@/components/build/SandboxHeader';
import TabBar from '@/components/build/TabBar';
import AgentVisualizer from '@/components/build/AgentVisualizer';
import AgentNotFound from '@/components/build/AgentNotFound';
import { getAgent, AgentWithPlan, AgentErrorCode } from '@/actions/get-agent';
import { getAgentFiles, saveAgentFile } from '@/actions/agent-files';
import { useCodeGenWebSocket } from '@/hooks/useCodeGenWebSocket';
import type { GeneratedFile } from '@/hooks/useCodeGenWebSocket';
import type { FileSystemNode, FileNode, FolderNode } from '@/types/file-system';
import { getLanguageFromExtension } from '@/types/file-system';

/**
 * Convert a flat list of generated files into a nested FileSystemNode tree.
 * e.g. [{path:"src/utils/helpers.py", ...}] -> folder "src" > folder "utils" > file "helpers.py"
 */
function buildFileTree(flatFiles: GeneratedFile[]): FileSystemNode[] {
  const root: FolderNode = { name: '', path: '', type: 'folder', children: [] };

  for (const f of flatFiles) {
    const parts = f.path.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join('/');

      if (isLast) {
        const fileNode: FileNode = {
          name: part,
          path: currentPath,
          type: 'file',
          content: f.content,
          language: f.language || getLanguageFromExtension(part),
        };
        current.children.push(fileNode);
      } else {
        let folder = current.children.find(
          (c): c is FolderNode => c.type === 'folder' && c.name === part
        );
        if (!folder) {
          folder = { name: part, path: currentPath, type: 'folder', children: [] };
          current.children.push(folder);
        }
        current = folder;
      }
    }
  }

  return root.children;
}

export default function AgentSandbox() {
  const params = useParams();
  const agentId = params.agentId as string;

  // Data fetching state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<{ message: string; code: AgentErrorCode } | null>(null);
  const [agentData, setAgentData] = useState<AgentWithPlan | null>(null);

  // UI state
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false);
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [localFiles, setLocalFiles] = useState<GeneratedFile[]>([]);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('initialized');

  // Code generation WebSocket
  const {
    codeGenStatus,
    files: codeGenFiles,
    progress: codeGenProgress,
    error: codeGenError,
    startCodeGen,
  } = useCodeGenWebSocket();

  // Debounce timer for file saves
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch agent data on mount
  useEffect(() => {
    async function fetchAgent() {
      setIsLoading(true);
      setError(null);

      const result = await getAgent(agentId);

      if (result.success && result.data) {
        setAgentData(result.data);
        setAgentStatus(result.data.status as AgentStatus);

        // If the agent already has generated files, load them
        if (result.data.status !== 'initialized') {
          const filesResult = await getAgentFiles(agentId);
          if (filesResult.success && filesResult.files) {
            setLocalFiles(
              filesResult.files.map((f) => ({
                path: f.path,
                content: f.content,
                language: f.language,
              }))
            );
          }
        }
      } else {
        setError({
          message: result.error || 'Failed to load agent',
          code: result.errorCode || 'UNKNOWN',
        });
      }

      setIsLoading(false);
    }

    fetchAgent();
  }, [agentId]);

  // Sync code gen files into local files state as they stream in
  useEffect(() => {
    if (codeGenFiles.length > 0) {
      setLocalFiles(codeGenFiles);
    }
  }, [codeGenFiles]);

  // Update agent status based on code gen progress
  useEffect(() => {
    if (codeGenStatus === 'complete') {
      setAgentStatus('generated');
    } else if (codeGenStatus === 'error') {
      setAgentStatus('error');
    } else if (codeGenStatus !== 'idle') {
      setAgentStatus('generating');
    }
  }, [codeGenStatus]);

  // Build file tree from flat file list
  const fileTree: FileSystemNode[] = buildFileTree(localFiles);

  // Derive agent for header
  const agent: Agent | null = agentData
    ? {
        id: agentData.id,
        name: agentData.name || agentData.plan.title,
        status: agentStatus,
        createdAt: agentData.created_at,
      }
    : null;

  // Handlers
  const handleGenerateCode = useCallback(() => {
    startCodeGen(agentId);
  }, [agentId, startCodeGen]);

  const handleStart = () => {
    setIsRunning(true);
  };

  const handleStop = () => {
    setIsRunning(false);
  };

  const handleFileChange = useCallback(
    (path: string, content: string) => {
      // Update local state immediately
      setLocalFiles((prev) =>
        prev.map((f) => (f.path === path ? { ...f, content } : f))
      );

      // Debounce the save to the backend
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveAgentFile(agentId, path, content).catch((e) =>
          console.error('Failed to save file:', e)
        );
      }, 1000);
    },
    [agentId]
  );

  const handleSendMessage = (content: string) => {
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date().toLocaleTimeString(),
    };
    setChatMessages((prev) => [...prev, userMessage]);

    // TODO: Wire to code modification backend in Phase 3
    setTimeout(() => {
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I understand you want to "${content}". This will be implemented in Phase 3.`,
        timestamp: new Date().toLocaleTimeString(),
      };
      setChatMessages((prev) => [...prev, assistantMessage]);
    }, 1000);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background gap-4">
        <Loader2 size={32} className="animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">Loading agent...</p>
      </div>
    );
  }

  // Error state
  if (error || !agentData || !agent) {
    const errorType = error?.code === 'UNAUTHORIZED' ? 'unauthorized' : 'not_found';
    return <AgentNotFound errorType={errorType} agentId={agentId} />;
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <SandboxHeader
        agent={agent}
        isRunning={isRunning}
        codeGenStatus={codeGenStatus}
        codeGenProgress={codeGenProgress}
        onGenerateCode={handleGenerateCode}
        onStart={handleStart}
        onStop={handleStop}
      />

      {codeGenError && (
        <div className="px-5 py-2 text-sm text-red-400 bg-red-500/10 border-b border-red-500/20">
          Code generation error: {codeGenError}
        </div>
      )}

      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal">
          {/* Left Panel - Plan & Code */}
          <ResizablePanel
            defaultSize={30}
            minSize={isLeftPanelCollapsed ? 2 : 20}
            maxSize={isLeftPanelCollapsed ? 2 : 100}
          >
            <TabBar
              planContent={agentData.plan.content}
              files={fileTree}
              onFileChange={handleFileChange}
              onCollapseChange={setIsLeftPanelCollapsed}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Middle Panel - Canvas & Terminal */}
          <ResizablePanel defaultSize={40} minSize={25}>
            <ResizablePanelGroup direction="vertical">
              <ResizablePanel defaultSize={80} minSize={40}>
                <AgentVisualizer />
              </ResizablePanel>

              <ResizableHandle />

              <ResizablePanel defaultSize={20} minSize={10}>
                <ExecutionLogs />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right Panel - Agent Chat */}
          <ResizablePanel
            defaultSize={30}
            minSize={isRightPanelCollapsed ? 2 : 20}
            maxSize={isRightPanelCollapsed ? 2 : 100}
          >
            <ChatPanel
              messages={chatMessages}
              onSendMessage={handleSendMessage}
              onCollapseChange={setIsRightPanelCollapsed}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
