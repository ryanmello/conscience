'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import {
  FileText,
  Code,
} from 'lucide-react';
import PlanViewer from '@/components/build/PlanViewer';
import CodeViewer from '@/components/build/CodeViewer';
import ChatPanel, { ChatMessage, mockChatMessages } from '@/components/build/ChatPanel';
import ExecutionLogs, { mockLogs } from '@/components/build/ExecutionLogs';
import SandboxHeader, { Agent, mockAgent } from '@/components/build/SandboxHeader';
import TabBar from '@/components/build/TabBar';
import AgentVisualizer from '@/components/build/AgentVisualizer';

const mockPlan = {
  title: 'Research Assistant Agent',
  content: `# Research Assistant Agent

## Overview
This agent will help users research topics by searching multiple sources and compiling comprehensive summaries.

## Input Schema
- **topic** (string, required): The topic to research
- **depth** (string, optional): "quick" | "moderate" | "deep" - defaults to "moderate"
- **sources** (array, optional): Preferred sources to search

## Processing Steps
1. Parse and validate input parameters
2. Generate search queries based on topic
3. Search configured sources (web, academic, news)
4. Filter and rank results by relevance
5. Extract key information from top results
6. Synthesize findings into cohesive summary
7. Format output with citations

## Output Schema
- **summary** (string): Compiled research summary
- **keyFindings** (array): List of key points discovered
- **sources** (array): Citations for all referenced material
- **confidence** (number): Confidence score 0-1

## Configuration
- Max sources to search: 10
- Timeout per source: 30 seconds
- Summary max length: 2000 words
`,
  version: 1,
};

const mockCode = `"""
Research Assistant Agent
Generated from approved plan
"""

import asyncio
from typing import Optional
from pydantic import BaseModel, Field

class ResearchInput(BaseModel):
    topic: str = Field(..., description="The topic to research")
    depth: str = Field(default="moderate", description="Research depth")
    sources: list[str] = Field(default_factory=list)

class ResearchOutput(BaseModel):
    summary: str
    key_findings: list[str]
    sources: list[dict]
    confidence: float

async def search_source(query: str, source: str) -> dict:
    """Search a single source for information."""
    # TODO: Implement actual search logic
    await asyncio.sleep(0.5)  # Simulate API call
    return {
        "source": source,
        "results": [f"Result from {source} for: {query}"]
    }

async def run(input: ResearchInput) -> ResearchOutput:
    """Main agent execution function."""
    print(f"Researching topic: {input.topic}")
    print(f"Depth: {input.depth}")
    
    # Generate search queries
    queries = [input.topic, f"{input.topic} overview", f"{input.topic} latest"]
    
    # Search sources
    sources = input.sources or ["web", "academic", "news"]
    results = []
    
    for query in queries:
        for source in sources:
            result = await search_source(query, source)
            results.append(result)
            print(f"  Searched {source}: found {len(result['results'])} results")
    
    # Synthesize findings
    summary = f"Research summary for '{input.topic}' based on {len(results)} searches."
    
    return ResearchOutput(
        summary=summary,
        key_findings=[
            f"Key finding 1 about {input.topic}",
            f"Key finding 2 about {input.topic}",
            f"Key finding 3 about {input.topic}",
        ],
        sources=[{"url": f"https://example.com/{i}", "title": f"Source {i}"} for i in range(3)],
        confidence=0.85
    )

if __name__ == "__main__":
    # Test run
    test_input = ResearchInput(topic="artificial intelligence trends 2025")
    result = asyncio.run(run(test_input))
    print(f"\\nResult: {result.model_dump_json(indent=2)}")
`;

// ============================================================================
// Main Component
// ============================================================================

export default function AgentSandbox() {
  const params = useParams();
  const agentId = params.agentId as string;

  // State
  const [activeLeftTab, setActiveLeftTab] = useState<'plan' | 'code'>('plan');
  const [isRunning, setIsRunning] = useState(false);
  const [agent, setAgent] = useState<Agent>({ ...mockAgent, id: agentId });
  const [logs, setLogs] = useState(mockLogs);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(mockChatMessages);

  // Handlers
  const handleStart = () => {
    setIsRunning(true);
    setAgent((prev) => ({ ...prev, status: 'running' }));
    setLogs((prev) => [
      ...prev,
      { timestamp: new Date().toLocaleTimeString(), level: 'info', message: 'Starting agent execution...' },
    ]);
  };

  const handleStop = () => {
    setIsRunning(false);
    setAgent((prev) => ({ ...prev, status: 'ready' }));
    setLogs((prev) => [
      ...prev,
      { timestamp: new Date().toLocaleTimeString(), level: 'warning', message: 'Execution stopped by user' },
    ]);
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

    // Simulate AI response (in real implementation, this would call the backend)
    setTimeout(() => {
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I understand you want to "${content}". I'm processing this request and will update the agent code accordingly. This is a mock response - in the real implementation, this would trigger a backend call to modify the agent.`,
        timestamp: new Date().toLocaleTimeString(),
      };
      setChatMessages((prev) => [...prev, assistantMessage]);
    }, 1000);
  };

  const leftTabs = [
    { id: 'plan', label: 'Plan', icon: <FileText size={14} /> },
    { id: 'code', label: 'Code', icon: <Code size={14} /> },
  ];

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
          <ResizablePanel defaultSize={30} minSize={10}>
            <div className="flex flex-col h-full">
              <TabBar
                tabs={leftTabs}
                activeTab={activeLeftTab}
                onTabChange={(id) => setActiveLeftTab(id as 'plan' | 'code')}
              />
              <div className="flex-1 min-h-0">
                {activeLeftTab === 'plan' ? (
                  <PlanViewer content={mockPlan.content} />
                ) : (
                  <CodeViewer code={mockCode} />
                )}
              </div>
            </div>
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
          <ResizablePanel defaultSize={30} minSize={10}>
            <ChatPanel messages={chatMessages} onSendMessage={handleSendMessage} />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
