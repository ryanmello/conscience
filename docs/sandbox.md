# Sandbox Code Environment

## Overview

Design and implement a resizable sandbox environment at `/build/[agentId]` with a plan/code editor on the left and an agent visualizer on the right, supporting server-side Python execution.

---

## Architecture Overview

The sandbox will be a split-panel layout using the installed `react-resizable-panels` component:

```
+------------------------------------------------------------------+
|  Header: Agent Name | Status Badge | Start Building | Settings   |
+------------------------------------------------------------------+
|                          |                                        |
|   LEFT PANEL             |   RIGHT PANEL                          |
|   (Resizable)            |   (Resizable)                          |
|                          |                                        |
|   +------------------+   |   +--------------------------------+   |
|   | Tab: Plan | Code |   |   | Agent Visualizer               |   |
|   +------------------+   |   |                                |   |
|   |                  |   |   | +-----------+                  |   |
|   | Plan Document    |   |   | |  Agent    |---> Output       |   |
|   | (Markdown)       |   |   | |   Node    |                  |   |
|   |                  |   |   | +-----------+                  |   |
|   | --- or ---       |   |   |      ^                         |   |
|   |                  |   |   |      |                         |   |
|   | Python Code      |   |   |   Input                        |   |
|   | (Monaco Editor)  |   |   |                                |   |
|   |                  |   |   +--------------------------------+   |
|   |                  |   |   | Logs / Console Output          |   |
|   +------------------+   |   +--------------------------------+   |
|                          |                                        |
+------------------------------------------------------------------+
```

---

## UI Component Structure

```
build/[agentId]/page.tsx
├── SandboxHeader (agent name, status, controls)
├── ResizablePanelGroup (horizontal)
│   ├── ResizablePanel (left - min 30%)
│   │   ├── TabBar (Plan | Code)
│   │   ├── PlanViewer (markdown/prose display)
│   │   └── CodeEditor (Monaco for Python)
│   ├── ResizableHandle
│   └── ResizablePanel (right - min 30%)
│       ├── AgentVisualizer (React Flow or custom)
│       └── ExecutionLogs (console output)
```

---

## Technology Recommendations

### 1. Code Editor: Monaco Editor

- **Package:** `@monaco-editor/react`
- **Why:** VSCode's editor, excellent Python support, syntax highlighting, intellisense
- **Alternative:** CodeMirror 6 (lighter, ~200KB vs ~2MB) if bundle size is critical

### 2. Markdown Rendering: react-markdown

- **Package:** `react-markdown` + `remark-gfm`
- **Why:** Render the plan document beautifully with GFM support (tables, checkboxes)

### 3. Agent Visualization: React Flow (reuse existing)

- React Flow is already set up in `/canvas`
- Create a simplified read-only visualization for the agent's flow
- Show: Input node -> Agent node -> Output node with animated edges during execution

### 4. Real-time Updates: WebSocket

- Extend the existing `usePlanWebSocket` pattern
- Create `useSandboxWebSocket` for:
  - Execution status updates
  - Log streaming
  - Agent state changes

### 5. Server-side Execution: Daytona Sandboxes (Recommended)

- **Platform:** [Daytona](https://www.daytona.io/) - isolated sandbox environments for AI-generated code
- **Why:** Managed security isolation, millisecond startup, pay-per-use, built-in log streaming
- **Backend endpoint:** `POST /api/agent/{agent_id}/execute`
- **WebSocket endpoint:** `/api/agent/{agent_id}/ws` for streaming logs
- **See:** [Daytona Integration Documentation](./daytona.md) for full implementation details

---

## New Files to Create

### Frontend (ui/)

| File | Description |
|------|-------------|
| `app/build/[agentId]/page.tsx` | Main sandbox page (update existing stub) |
| `components/sandbox/SandboxHeader.tsx` | Header with controls |
| `components/sandbox/PlanViewer.tsx` | Markdown plan display |
| `components/sandbox/CodeEditor.tsx` | Monaco wrapper for Python |
| `components/sandbox/AgentVisualizer.tsx` | Simplified React Flow view |
| `components/sandbox/ExecutionLogs.tsx` | Log output panel |
| `hooks/useSandboxWebSocket.ts` | WebSocket for execution updates |
| `hooks/useAgent.ts` | Fetch agent + plan data |

### Backend (api/)

| File | Description |
|------|-------------|
| `api/agent.py` | Add execute endpoint (update existing) |
| `services/daytona_service.py` | Daytona sandbox management and code execution |

---

## Key UI States

1. **Initial/Building** - Agent status is "building", show "Start Building" button
2. **Executing** - Button disabled, show spinner, stream logs to console
3. **Completed** - Show results in visualizer, execution summary
4. **Error** - Show error state with retry option

---

## Implementation Phases

### Phase 1: Basic Layout

- Set up resizable panel layout using existing component
- Create header with agent name/status
- Placeholder panels for plan viewer and visualizer

### Phase 2: Plan & Code Display

- Fetch agent and plan data from API
- Implement PlanViewer with react-markdown
- Implement CodeEditor with Monaco

### Phase 3: Agent Visualizer

- Simplified React Flow visualization
- Input/output node display
- Animated execution state

### Phase 4: Execution & Streaming

- Backend execute endpoint
- WebSocket for log streaming
- Frontend execution controls

---

## Dependencies to Install

```bash
# Code editor
npm install @monaco-editor/react

# Markdown rendering
npm install react-markdown remark-gfm

# Already installed
# react-resizable-panels (via resizable.tsx)
# @xyflow/react (for visualization)
```

---

## Existing Files to Leverage

| File | Purpose |
|------|---------|
| `ui/components/ui/resizable.tsx` | Panel layout components |
| `ui/hooks/usePlanWebSocket.ts` | WebSocket pattern to follow |
| `ui/app/canvas/page.tsx` | React Flow setup to reference |
| `api/agent.py` | Add execution endpoints |

---

## Implementation Checklist

### Frontend
- [ ] Create basic resizable panel layout in build/[agentId]/page.tsx
- [ ] Create SandboxHeader component with agent name, status, and Start Building button
- [ ] Create PlanViewer component for displaying the plan markdown
- [ ] Create CodeEditor component wrapping Monaco for Python
- [ ] Create AgentVisualizer component with simplified React Flow
- [ ] Create ExecutionLogs component for console output
- [ ] Create useAgent hook to fetch agent and plan data
- [ ] Create useSandboxWebSocket hook for execution streaming

### Backend (Daytona Integration)
- [ ] Sign up for Daytona and get API key
- [ ] Add DAYTONA_API_KEY to environment variables
- [ ] Install `daytona` Python package
- [ ] Create services/daytona_service.py
- [ ] Add /api/agent/{id}/execute endpoint
- [ ] Create WebSocket endpoint for log streaming
