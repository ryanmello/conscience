'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import ChatPanel, { ChatMessage, mockChatMessages } from '@/components/build/ChatPanel';
import ExecutionLogs, { mockLogs } from '@/components/build/ExecutionLogs';
import SandboxHeader, { Agent, mockAgent } from '@/components/build/SandboxHeader';
import TabBar from '@/components/build/TabBar';
import AgentVisualizer from '@/components/build/AgentVisualizer';
import type { FileSystemNode } from '@/types/file-system';

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

const mockFiles: FileSystemNode[] = [
  {
    name: 'agent.py',
    path: 'agent.py',
    type: 'file',
    language: 'python',
    content: `"""
Research Assistant Agent
Generated from approved plan
"""

import asyncio
from typing import Optional
from pydantic import BaseModel, Field
from models.input import ResearchInput
from models.output import ResearchOutput
from utils.helpers import search_source

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
`,
  },
  {
    name: 'models',
    path: 'models',
    type: 'folder',
    children: [
      {
        name: 'input.py',
        path: 'models/input.py',
        type: 'file',
        language: 'python',
        content: `"""Input models for the Research Assistant Agent."""

from pydantic import BaseModel, Field

class ResearchInput(BaseModel):
    """Input schema for research requests."""
    topic: str = Field(..., description="The topic to research")
    depth: str = Field(default="moderate", description="Research depth: quick, moderate, or deep")
    sources: list[str] = Field(default_factory=list, description="Preferred sources to search")
`,
      },
      {
        name: 'output.py',
        path: 'models/output.py',
        type: 'file',
        language: 'python',
        content: `"""Output models for the Research Assistant Agent."""

from pydantic import BaseModel

class ResearchOutput(BaseModel):
    """Output schema for research results."""
    summary: str
    key_findings: list[str]
    sources: list[dict]
    confidence: float
`,
      },
    ],
  },
  {
    name: 'utils',
    path: 'utils',
    type: 'folder',
    children: [
      {
        name: 'helpers.py',
        path: 'utils/helpers.py',
        type: 'file',
        language: 'python',
        content: `"""Utility functions for the Research Assistant Agent."""

import asyncio

async def search_source(query: str, source: str) -> dict:
    """Search a single source for information."""
    # TODO: Implement actual search logic
    await asyncio.sleep(0.5)  # Simulate API call
    return {
        "source": source,
        "results": [f"Result from {source} for: {query}"]
    }

def format_citation(url: str, title: str) -> str:
    """Format a citation for output."""
    return f"[{title}]({url})"
`,
      },
    ],
  },
  {
    name: 'requirements.txt',
    path: 'requirements.txt',
    type: 'file',
    language: 'plaintext',
    content: `pydantic>=2.0.0
asyncio
aiohttp>=3.8.0
`,
  },
  {
    name: 'README.md',
    path: 'README.md',
    type: 'file',
    language: 'markdown',
    content: `# Research Assistant Agent

A powerful research agent that searches multiple sources and compiles comprehensive summaries.

## Usage

\`\`\`python
from agent import run
from models.input import ResearchInput

input = ResearchInput(topic="artificial intelligence", depth="deep")
result = await run(input)
print(result.summary)
\`\`\`

## Configuration

- **Max sources**: 10
- **Timeout**: 30 seconds per source
- **Summary length**: Up to 2000 words
`,
  },
];

// ============================================================================
// Main Component
// ============================================================================

export default function AgentSandbox() {
  const params = useParams();
  const agentId = params.agentId as string;

  // State
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false);
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(false);
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
              planContent={mockPlan.content}
              files={mockFiles}
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
