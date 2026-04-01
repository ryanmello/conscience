# Sandbox Code Environment

## Overview

Design and implement a resizable sandbox environment at `/build/[agentId]` that takes an approved plan, generates multi-file agent code via LLM, and allows users to view, edit, iterate, and execute the code in an isolated sandbox.

---

## Architecture Overview

The sandbox is a three-panel layout using `react-resizable-panels`:

```
+--------------------------------------------------------------------------+
|  Header: Agent Name | Status Badge | Generate Code | Run/Stop | Settings |
+--------------------------------------------------------------------------+
|                     |                              |                      |
|   LEFT PANEL        |   MIDDLE PANEL               |   RIGHT PANEL        |
|   (Resizable)       |   (Resizable)                |   (Resizable)        |
|                     |                              |                      |
|   +-------------+   |   +------------------------+ |   +----------------+ |
|   | Tab: Plan   |   |   | Agent Visualizer       | |   | Agent Chat     | |
|   |      Code   |   |   | (React Flow canvas)    | |   |                | |
|   +-------------+   |   |                        | |   | User prompts   | |
|   |             |   |   |  +---------+           | |   | code changes   | |
|   | Plan Doc    |   |   |  | Agent   |-->Output  | |   | via natural    | |
|   | (Markdown)  |   |   |  |  Node   |           | |   | language       | |
|   |             |   |   |  +---------+           | |   |                | |
|   | --- or ---  |   |   |      ^                 | |   | LLM modifies   | |
|   |             |   |   |      |                 | |   | files and      | |
|   | File Tree   |   |   |   Input               | |   | streams back   | |
|   | + Code      |   |   +------------------------+ |   +----------------+ |
|   |   Editor    |   |   | Execution Logs         | |                      |
|   | (Monaco)    |   |   | (stdout/stderr stream)  | |                      |
|   +-------------+   |   +------------------------+ |                      |
|                     |                              |                      |
+--------------------------------------------------------------------------+
```

---

## UI Component Structure

```
build/[agentId]/page.tsx
├── SandboxHeader (agent name, status, Generate Code, Run/Stop)
├── ResizablePanelGroup (horizontal)
│   ├── ResizablePanel (left - collapsible)
│   │   └── TabBar (Plan | Code)
│   │       ├── PlanViewer (markdown plan display)
│   │       └── CodeViewer
│   │           ├── FileTree (file explorer sidebar)
│   │           ├── FileTabs (open file tabs)
│   │           └── CodeEditor (Monaco editor)
│   ├── ResizableHandle
│   ├── ResizablePanel (middle)
│   │   ├── AgentVisualizer (React Flow canvas)
│   │   └── ExecutionLogs (terminal output)
│   ├── ResizableHandle
│   └── ResizablePanel (right - collapsible)
│       └── ChatPanel (prompt code changes, ask questions)
```

---

## End-to-End Flow

```
1. User creates plan ──▶ Plan approved ──▶ Agent created (status: "initialized")
                                               │
2. User lands on /build/[agentId] ◀────────────┘
                                               │
3. User clicks "Generate Code" ────────────────┘
        │
        ▼
4. Backend CodeGenService (LangGraph):
        │
        ├── parse_plan ──────── Extract structured info from plan
        ├── generate_manifest ── Determine file list + descriptions
        ├── generate_skeletons ── All files as stubs (signatures only)
        ├── generate_file[0..N] ── Fill in each implementation
        │   └── Each file: save to agent_file table, stream to frontend
        └── validate ──────── Check inter-file consistency
        │
        ▼
5. Files appear in Code tab in real-time (FileTree + CodeEditor)
        │
        ▼
6. User iterates:
        ├── Manual edits in Monaco ── saves to agent_file table
        ├── Chat modifications ──── "add error handling" ──▶ LLM updates files
        └── Re-generate specific files if needed
        │
        ▼
7. User clicks "Run":
        ├── Backend syncs files from agent_file table ──▶ Daytona sandbox
        ├── pip install -r requirements.txt
        ├── python {entry_point}
        └── Stream stdout/stderr ──▶ ExecutionLogs panel
```

---

## Technology Stack

### Code Editor: Monaco Editor
- **Package:** `@monaco-editor/react` (installed)
- Night Owl theme with light/dark mode support (implemented in `CodeEditor.tsx`)

### Markdown Rendering: react-markdown
- **Package:** `react-markdown` + `remark-gfm` (installed)
- Renders plan document with GFM support

### Agent Visualization: React Flow
- **Package:** `@xyflow/react` (installed)
- Simplified read-only visualization of agent flow
- Animated edges during execution

### Real-time Updates: WebSocket
- Extend existing `usePlanWebSocket` pattern
- `useCodeGenWebSocket` for code generation streaming
- `useSandboxWebSocket` for execution log streaming

### Server-side Execution: Daytona Sandboxes
- **Platform:** [Daytona](https://www.daytona.io/)
- Managed security isolation for running LLM-generated code
- See [Daytona Integration Documentation](./daytona.md)

---

## Code Generation Pipeline

### Storage: `agent_file` Table

Generated files are stored per-row in a PostgreSQL table:

```sql
CREATE TABLE agent_file (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
    path VARCHAR(500) NOT NULL,        -- e.g. "src/agent.py"
    content TEXT NOT NULL DEFAULT '',
    language VARCHAR(50) NOT NULL,      -- "python", "json", etc.
    version INT NOT NULL DEFAULT 1,
    status VARCHAR(50) NOT NULL DEFAULT 'generating',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(agent_id, path)
);
```

Per-file rows allow:
- Streaming files to the frontend one at a time during generation
- Individual file updates on edits or prompted changes
- Version tracking and status tracking per file (`generating` → `generated` → `modified`)

### Two-Pass Generation (Solving the Context Window Problem)

Generating files one at a time creates a context window problem: file N needs to know about files 1 through N-1. Full file contents grow linearly and eventually exceed token limits.

**Solution: skeleton-first generation.**

**Pass 1 — Generate skeletons for ALL files (single LLM call):**

The LLM reads the plan and produces every file as a stub — class definitions, function signatures, imports, type hints — with `pass` or `...` for all function bodies. The complete skeleton is compact (~200-400 lines for a 10-file project).

**Pass 2 — Fill in each file independently:**

For each file, the LLM receives:
- The complete skeleton output (constant size, all files)
- The plan section relevant to this specific file

The LLM implements against the skeleton's API surface. Context stays roughly constant regardless of how many files have been generated. Each file is independent — no need to pass the full implementation of previously generated files.

### LangGraph State Machine: `CodeGenService`

```python
class CodeGenState(TypedDict):
    agent_id: str
    user_id: str
    session_id: str
    plan_content: str
    file_manifest: list[dict]      # [{"path": "src/agent.py", "description": "..."}]
    skeleton_output: str           # All files as stubs
    current_file_index: int
    generated_files: list[dict]    # [{"path": "...", "content": "...", "language": "..."}]
    messages: list[dict]
```

**Graph flow:**

```
parse_plan → generate_manifest → generate_skeletons → generate_file (loop) → validate → END
```

### WebSocket Events (Code Generation)

```
Backend → Frontend:
  { type: "codegen.status",        status: "parsing_plan" }
  { type: "codegen.manifest",      files: [{path, description}, ...] }
  { type: "codegen.skeletons",     content: "..." }
  { type: "codegen.file_start",    path: "src/agent.py", index: 0, total: 5 }
  { type: "codegen.file_complete", path: "src/agent.py", content: "...", language: "python" }
  { type: "codegen.complete",      totalFiles: 5 }
  { type: "codegen.error",         message: "..." }
```

---

## Code Iteration

### Manual Edits

Users edit files directly in the Monaco editor. On save:
- Mark the `OpenFile` as dirty (`isDirty` flag in frontend state)
- Call `PUT /api/agent/{id}/files/{path}` to update the `agent_file` row
- Increment version number

### Chat-Driven Modifications

The ChatPanel on the right allows natural language code change requests:

1. User types "add error handling to the API calls"
2. Frontend sends `{ type: "modify_code", message: "...", context: { files: [...] } }` via WebSocket
3. Backend routing step: LLM reads request + file manifest (just paths/descriptions), identifies relevant files
4. Backend sends only relevant files + the skeleton to the LLM for modification
5. LLM returns updated file contents (full file replacement for V1)
6. Backend updates `agent_file` rows, streams `file_updated` events to frontend
7. Frontend updates the editor in real-time

### File CRUD API

```
GET    /api/agent/{id}/files          → list all files for an agent
GET    /api/agent/{id}/files/{path}   → get single file content
PUT    /api/agent/{id}/files/{path}   → update file content (user edits)
POST   /api/agent/{id}/files          → create new file
DELETE /api/agent/{id}/files/{path}   → delete a file
```

---

## Agent Status Lifecycle

```
initialized → generating → generated → running → stopped
                  ↑                        ↑
                  └── re-generate          └── re-run
                                                ↓
                                              error
```

| Status | UI State | Available Actions |
|--------|----------|-------------------|
| `initialized` | Plan visible, no code | "Generate Code" button |
| `generating` | Files streaming in, progress indicator | Cancel |
| `generated` | All files visible in Code tab | Edit, Chat, "Run" button |
| `running` | Execution in progress, logs streaming | "Stop" button |
| `stopped` | Execution complete, results visible | Edit, Chat, "Run" again |
| `error` | Error displayed with logs | Edit, Chat, "Run" (retry) |

---

## Files Overview

### Frontend — Already Built (ui/)

| File | Status |
|------|--------|
| `app/build/[agentId]/page.tsx` | Built — three-panel layout, needs code gen wiring |
| `components/build/SandboxHeader.tsx` | Built — needs Generate Code button |
| `components/build/TabBar.tsx` | Built — Plan/Code tabs |
| `components/build/PlanViewer.tsx` | Built — markdown rendering |
| `components/build/CodeViewer.tsx` | Built — file tree + editor |
| `components/build/CodeEditor.tsx` | Built — Monaco with Night Owl theme |
| `components/build/FileTree.tsx` | Built — file explorer |
| `components/build/FileTabs.tsx` | Built — open file tabs |
| `components/build/ChatPanel.tsx` | Built — needs backend integration |
| `components/build/ExecutionLogs.tsx` | Built — needs WebSocket log streaming |
| `components/build/AgentVisualizer.tsx` | Built — placeholder |
| `components/build/AgentNotFound.tsx` | Built |
| `actions/get-agent.ts` | Built — fetches agent + plan data |
| `types/file-system.ts` | Built — FileNode, FolderNode, OpenFile types |

### Frontend — To Build (ui/)

| File | Description |
|------|-------------|
| `hooks/useCodeGenWebSocket.ts` | WebSocket hook for code generation streaming |
| `hooks/useSandboxWebSocket.ts` | WebSocket hook for execution log streaming |
| Server action or API calls | File CRUD (save edits, create/delete files) |

### Backend — To Build

| File | Description |
|------|-------------|
| `services/codegen_service.py` | LangGraph code generation state machine |
| `models/agent_file.py` | SQLAlchemy model for `agent_file` table |
| `alembic/versions/xxx_add_agent_file.py` | Database migration |
| `services/daytona_service.py` | Daytona sandbox management (multi-file sync) |
| Update `api/agent.py` | WebSocket for code gen, REST for file CRUD, execution endpoint |
| Update `config/prompts.py` | Code generation + modification prompts |

---

## Implementation Phases

### Phase 1: Code Generation Pipeline (Backend)
- [ ] Create `agent_file` table migration
- [ ] Create `models/agent_file.py` SQLAlchemy model
- [ ] Add code generation prompts to `config/prompts.py`
- [ ] Build `services/codegen_service.py` (LangGraph: parse → manifest → skeletons → generate → validate)
- [ ] Add WebSocket endpoint for code generation in `api/agent.py`
- [ ] Add REST endpoints for file CRUD in `api/agent.py`

### Phase 2: Code Generation Pipeline (Frontend)
- [ ] Create `hooks/useCodeGenWebSocket.ts`
- [ ] Add "Generate Code" button to SandboxHeader
- [ ] Wire code gen WebSocket to populate `files` state on page
- [ ] Show generation progress (current file, total files)

### Phase 3: Code Iteration
- [ ] Connect ChatPanel to code modification backend
- [ ] Implement file save (manual edits → PUT endpoint)
- [ ] Handle file version tracking and dirty state

### Phase 4: Execution (Daytona Integration)
- [ ] Sign up for Daytona and get API key
- [ ] Add DAYTONA_API_KEY to environment variables
- [ ] Install `daytona` Python package
- [ ] Create `services/daytona_service.py` (multi-file sync)
- [ ] Add execution WebSocket endpoint for log streaming
- [ ] Create `hooks/useSandboxWebSocket.ts`
- [ ] Wire Run/Stop buttons to execution backend
- [ ] Stream logs to ExecutionLogs component

### Phase 5: Agent Visualizer
- [ ] Simplified React Flow visualization of agent workflow
- [ ] Animated execution state (running, completed, errored)

---

## Dependencies

```bash
# Already installed
# @monaco-editor/react (code editor)
# react-markdown + remark-gfm (plan rendering)
# react-resizable-panels (panel layout)
# @xyflow/react (visualization)

# Backend — to install
pip install daytona
```
