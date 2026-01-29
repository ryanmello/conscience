'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import ChatPanel, { ChatMessage } from '@/components/build/ChatPanel';
import ExecutionLogs from '@/components/build/ExecutionLogs';
import SandboxHeader, { Agent } from '@/components/build/SandboxHeader';
import TabBar from '@/components/build/TabBar';
import AgentVisualizer from '@/components/build/AgentVisualizer';
import AgentNotFound from '@/components/build/AgentNotFound';
import { getAgent, AgentWithPlan, AgentErrorCode } from '@/actions/get-agent';
import type { FileSystemNode } from '@/types/file-system';

// ============================================================================
// Main Component
// ============================================================================

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
  const [files, setFiles] = useState<FileSystemNode[]>([]);

  // Fetch agent data on mount
  useEffect(() => {
    async function fetchAgent() {
      setIsLoading(true);
      setError(null);

      const result = await getAgent(agentId);

      if (result.success && result.data) {
        setAgentData(result.data);
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

  // Derive agent for header from fetched data
  const agent: Agent | null = agentData
    ? {
        id: agentData.id,
        name: agentData.name || agentData.plan.title,
        status: agentData.status as Agent['status'],
        createdAt: agentData.created_at,
      }
    : null;

  // Handlers
  const handleStart = () => {
    setIsRunning(true);
  };

  const handleStop = () => {
    setIsRunning(false);
  };

  const handleSendMessage = (content: string) => {
    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date().toLocaleTimeString(),
    };
    setChatMessages((prev) => [...prev, userMessage]);

    // TODO: In real implementation, this would call the backend
    setTimeout(() => {
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I understand you want to "${content}". I'm processing this request and will update the agent code accordingly.`,
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
        onStart={handleStart}
        onStop={handleStop}
      />

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
              files={files}
              onCollapseChange={setIsLeftPanelCollapsed}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Middle Panel - Canvas & Terminal */}
          <ResizablePanel defaultSize={40} minSize={25}>
            <ResizablePanelGroup direction="vertical">
              {/* Agent Visualizer / Canvas */}
              <ResizablePanel defaultSize={80} minSize={40}>
                <AgentVisualizer />
              </ResizablePanel>

              <ResizableHandle />

              {/* Execution Logs / Terminal */}
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
