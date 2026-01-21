# Conscience: Natural Language Agent Builder

## Vision

Conscience is a platform that enables users to create AI agents through natural language descriptions. Users describe what they want an agent to do, and the system generates the necessary tools, orchestration logic, and visual workflow—all viewable and executable on an interactive canvas.

**Example User Prompt:**
> "Create an agent that takes two numbers and an operation (add, subtract, multiply, divide) and returns the result"

**System Response:**
- Generates tool code for: `add`, `subtract`, `multiply`, `divide`
- Creates agent orchestration that routes to the correct tool based on operation
- Displays the workflow on a React Flow canvas showing input → agent → tool execution → output
- User can run the workflow immediately

---

## Core Concepts

### 1. Agent
An autonomous unit that receives input, makes decisions, and uses tools to accomplish a task. Agents are defined by:
- **Purpose**: What the agent is designed to do
- **Tools**: The capabilities available to the agent
- **Logic**: How the agent decides which tools to use

### 2. Tool
A discrete function that performs a specific action. Tools are:
- **Self-contained**: Each tool has inputs, logic, and outputs
- **Composable**: Tools can be chained together
- **Generated**: Created automatically from natural language descriptions

### 3. Workflow
The visual representation of how data flows from input through agent decision-making to tool execution and final output.

---

## Project Scope

### Phase 1: Foundation (MVP)
Build a working prototype that demonstrates the core concept with simple, self-contained agents.

**In Scope:**
- Natural language agent description parsing
- Code generation for simple tools (math operations, string manipulation, data transformation)
- Visual workflow display on existing React Flow canvas
- Basic workflow execution (input → process → output)
- Agent and workflow persistence

**Out of Scope (Phase 1):**
- External integrations (Gmail, Calendar, APIs)
- Multi-agent collaboration
- Scheduled/triggered execution
- Complex state management between steps

### Phase 2: Enhanced Capabilities
- Pre-built tool library (HTTP requests, file operations, data parsing)
- Tool composition and chaining
- Conditional branching in workflows
- Agent memory and context

### Phase 3: Integrations & Scale
- OAuth integrations (Google, Slack, etc.)
- Webhook triggers
- Scheduled execution
- Multi-agent orchestration
- Marketplace for sharing agents/tools

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js)                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────────┐  ┌─────────────────────┐  │
│  │  Chat UI    │  │  Canvas         │  │  Tool Sidebar       │  │
│  │  (Prompt)   │  │  (React Flow)   │  │  (Generated Tools)  │  │
│  └─────────────┘  └─────────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND (FastAPI)                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  Agent Builder  │  │  Tool Generator │  │  Workflow       │  │
│  │  Service        │  │  Service        │  │  Executor       │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                              │                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  Base           │  │  Tool           │  │  LLM            │  │
│  │  Orchestrator   │  │  Registry       │  │  Service        │  │
│  │  (Reusable)     │  │  (Runtime)      │  │  (OpenAI)       │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         DATABASE (Supabase)                      │
├─────────────────────────────────────────────────────────────────┤
│  agents │ tools │ workflows │ executions │ environments         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Leveraging Existing Code

### What We Already Have

| Component | Status | Location | Reuse Strategy |
|-----------|--------|----------|----------------|
| React Flow Canvas | ✅ Built | `ui/app/canvas/` | Extend with dynamic tool population |
| Node Components | ✅ Built | `ui/components/canvas/nodes/` | Add ToolNode, InputNode variants |
| Sidebar | ✅ Built | `ui/components/canvas/Sidebar.tsx` | Make dynamic (populate from generated tools) |
| StatusBar | ✅ Built | `ui/components/canvas/StatusBar.tsx` | Connect to real execution engine |
| Execution States | ✅ Built | `BaseNode.tsx` | Use for real workflow execution |
| FastAPI App | ✅ Built | `core/app.py` | Add new routes and services |
| Database Setup | ✅ Built | `db/database.py` | Add new models |
| Auth | ✅ Built | `ui/lib/supabase/` | Use for user-scoped agents |
| Environment Model | ✅ Built | `models/environment.py` | Link agents to environments |

### What Needs to Be Built

| Component | Purpose | Depends On |
|-----------|---------|------------|
| Chat Interface | Natural language input for agent creation | - |
| Agent Builder Service | Parse NL → determine required tools | LLM Service |
| Tool Generator Service | Generate tool code from descriptions | LLM Service, Base Tool Framework |
| Base Tool Framework | Reusable tool structure (inputs, execute, outputs) | - |
| Tool Registry | Store and load generated tools at runtime | Database |
| Workflow Executor | Actually run the workflow with real tools | Tool Registry |
| Agent/Tool/Workflow Models | Persist generated agents and tools | Database |

---

## Base Orchestrator Pattern

The key to avoiding regenerating orchestration logic is to create a **Base Orchestrator** that handles:

```python
# core/orchestrator/base.py

class BaseOrchestrator:
    """
    Reusable orchestration logic. The LLM only needs to generate:
    1. Tool definitions
    2. Tool selection logic (which tool for which input)
    """
    
    def __init__(self, tools: list[BaseTool], router: ToolRouter):
        self.tools = {t.name: t for t in tools}
        self.router = router  # LLM-generated: decides which tool to call
    
    async def execute(self, input_data: dict) -> dict:
        # 1. Route to correct tool (LLM-generated logic)
        tool_name = await self.router.select_tool(input_data)
        
        # 2. Execute tool (standard pattern)
        tool = self.tools[tool_name]
        result = await tool.execute(input_data)
        
        # 3. Return result (standard pattern)
        return result


class BaseTool(ABC):
    """Base class all generated tools inherit from."""
    
    name: str
    description: str
    input_schema: dict  # JSON Schema for inputs
    
    @abstractmethod
    async def execute(self, inputs: dict) -> dict:
        """Execute the tool logic. This is what gets generated."""
        pass
```

**What the LLM generates:**

```python
# Generated: tools/math/add.py
class AddTool(BaseTool):
    name = "add"
    description = "Adds two numbers together"
    input_schema = {
        "a": {"type": "number", "description": "First number"},
        "b": {"type": "number", "description": "Second number"}
    }
    
    async def execute(self, inputs: dict) -> dict:
        return {"result": inputs["a"] + inputs["b"]}
```

**What we provide (not regenerated):**
- `BaseOrchestrator` - execution flow
- `BaseTool` - tool structure
- Error handling, logging, state management
- Workflow execution engine
- Canvas visualization

---

## Technology Stack

### Already In Place
- **Frontend**: Next.js 16, React 19, React Flow, Tailwind CSS, Supabase Auth
- **Backend**: FastAPI, SQLAlchemy, Alembic, Python 3.12+
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth

### Required Additions

| Technology | Purpose | Why |
|------------|---------|-----|
| **OpenAI API** | LLM for parsing prompts and generating code | Already configured in settings |
| **Pydantic** | Tool input/output validation | Type safety for generated tools |
| **AsyncIO** | Async tool execution | Non-blocking workflow execution |
| **Server-Sent Events** | Stream execution status to frontend | Real-time updates during workflow run |
| **Redis (optional)** | Job queue for long-running generations | Can defer to Phase 2 |

### Considered Alternatives

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| **LangChain** | Popular, many integrations | Heavy, opinionated, complex | Skip - build lighter custom solution |
| **CrewAI** | Good for multi-agent | Overkill for single agents | Consider for Phase 3 |
| **AutoGen** | Flexible agent framework | Complex setup | Skip - too heavy for MVP |
| **Custom** | Full control, lighter weight | More initial work | **Use this** |

---

## Data Models

### Agent
```python
class Agent(Base):
    id: int
    name: str
    description: str
    prompt: str  # Original user prompt
    owner_id: int
    environment_id: int
    created_at: datetime
    updated_at: datetime
    
    # Relationships
    tools: list[Tool]
    workflows: list[Workflow]
```

### Tool
```python
class Tool(Base):
    id: int
    name: str
    description: str
    input_schema: dict  # JSON Schema
    output_schema: dict  # JSON Schema
    code: str  # Generated Python code
    agent_id: int
    is_builtin: bool  # True for pre-built tools
    created_at: datetime
```

### Workflow
```python
class Workflow(Base):
    id: int
    name: str
    agent_id: int
    graph: dict  # React Flow graph JSON (nodes + edges)
    created_at: datetime
    updated_at: datetime
```

### Execution
```python
class Execution(Base):
    id: int
    workflow_id: int
    status: str  # pending, running, completed, failed
    input_data: dict
    output_data: dict
    started_at: datetime
    completed_at: datetime
    error: str | None
```

---

## API Endpoints

### Agent Creation
```
POST /api/agents/generate
Body: { "prompt": "Create an agent that..." }
Response: { "agent_id": 123, "status": "generating" }

GET /api/agents/{id}
Response: { "agent": {...}, "tools": [...], "workflow": {...} }

SSE /api/agents/{id}/status
Stream: { "step": "parsing" } → { "step": "generating_tools" } → { "step": "complete" }
```

### Workflow Execution
```
POST /api/workflows/{id}/execute
Body: { "inputs": { "a": 5, "b": 3, "operation": "add" } }
Response: { "execution_id": 456 }

SSE /api/executions/{id}/stream
Stream: { "node": "input", "status": "completed" } → { "node": "agent", "status": "executing" } → ...
```

### Tools
```
GET /api/agents/{id}/tools
Response: { "tools": [{ "name": "add", "description": "...", "input_schema": {...} }] }
```

---

## User Flow

```
1. User enters prompt: "Create a math agent"
   │
   ▼
2. Backend parses prompt, identifies required tools
   │
   ▼
3. Tool Generator creates tool code (add, subtract, multiply, divide)
   │
   ▼
4. Workflow is generated (input → agent router → tools → output)
   │
   ▼
5. Frontend receives:
   - Tool definitions (populate sidebar)
   - Workflow graph (render on canvas)
   │
   ▼
6. User sees canvas with:
   - Input node (enter numbers + operation)
   - Agent node (routes to correct tool)
   - Tool nodes (add, subtract, etc.)
   - Output node (displays result)
   │
   ▼
7. User clicks "Run", enters inputs
   │
   ▼
8. Execution flows through nodes (real-time status updates)
   │
   ▼
9. Result displayed in output node
```

---

## Implementation Roadmap

### Sprint 1: Core Infrastructure
- [ ] Base Tool framework (`BaseTool`, `BaseOrchestrator`)
- [ ] Tool Registry (load/execute tools at runtime)
- [ ] Database models (Agent, Tool, Workflow, Execution)
- [ ] API endpoints scaffold

### Sprint 2: Generation Pipeline
- [ ] LLM Service (OpenAI integration)
- [ ] Prompt Parser (extract tool requirements)
- [ ] Tool Generator (generate tool code from specs)
- [ ] Workflow Generator (create React Flow graph)

### Sprint 3: Frontend Integration
- [ ] Chat interface for agent creation
- [ ] Dynamic sidebar (populate from generated tools)
- [ ] Canvas auto-population from workflow JSON
- [ ] Input node forms (based on tool schemas)

### Sprint 4: Execution Engine
- [ ] Connect workflow execution to real tool code
- [ ] SSE streaming for real-time status
- [ ] Error handling and recovery
- [ ] Execution history and replay

### Sprint 5: Polish & Testing
- [ ] Built-in tool library (string ops, HTTP, JSON)
- [ ] Agent editing and versioning
- [ ] Comprehensive error messages
- [ ] Documentation and examples

---

## Example: Math Agent Generation

**User Prompt:**
> "Create an agent that takes two numbers and an operation (add, subtract, multiply, divide) and returns the result"

**Step 1: Prompt Analysis** (LLM)
```json
{
  "agent_name": "math_agent",
  "description": "Performs basic arithmetic operations",
  "required_tools": [
    {"name": "add", "inputs": ["a: number", "b: number"], "output": "number"},
    {"name": "subtract", "inputs": ["a: number", "b: number"], "output": "number"},
    {"name": "multiply", "inputs": ["a: number", "b: number"], "output": "number"},
    {"name": "divide", "inputs": ["a: number", "b: number"], "output": "number"}
  ],
  "routing_logic": "Based on 'operation' input, call the corresponding tool"
}
```

**Step 2: Generated Tools**
```python
# tools/generated/math_agent/add.py
class AddTool(BaseTool):
    name = "add"
    description = "Adds two numbers"
    input_schema = {"a": "number", "b": "number"}
    
    async def execute(self, inputs):
        return {"result": inputs["a"] + inputs["b"]}
```

**Step 3: Generated Workflow** (React Flow JSON)
```json
{
  "nodes": [
    {"id": "input", "type": "input", "data": {"schema": {"a": "number", "b": "number", "operation": "string"}}},
    {"id": "router", "type": "agent", "data": {"label": "Math Router"}},
    {"id": "add", "type": "tool", "data": {"tool": "add"}},
    {"id": "subtract", "type": "tool", "data": {"tool": "subtract"}},
    {"id": "multiply", "type": "tool", "data": {"tool": "multiply"}},
    {"id": "divide", "type": "tool", "data": {"tool": "divide"}},
    {"id": "output", "type": "output", "data": {"label": "Result"}}
  ],
  "edges": [
    {"source": "input", "target": "router"},
    {"source": "router", "target": "add"},
    {"source": "router", "target": "subtract"},
    {"source": "router", "target": "multiply"},
    {"source": "router", "target": "divide"},
    {"source": "add", "target": "output"},
    {"source": "subtract", "target": "output"},
    {"source": "multiply", "target": "output"},
    {"source": "divide", "target": "output"}
  ]
}
```

---

## Security Considerations

1. **Code Execution Sandboxing**: Generated tool code runs in isolated environment
2. **Input Validation**: All inputs validated against JSON Schema before execution
3. **Rate Limiting**: Prevent abuse of LLM-powered generation
4. **User Scoping**: Agents/tools are private to users by default
5. **Code Review**: Option to review generated code before first execution

---

## Success Metrics

- **Generation Success Rate**: % of prompts that produce working agents
- **Time to First Agent**: How quickly a new user creates their first agent
- **Execution Success Rate**: % of workflow runs that complete without error
- **User Retention**: Users who create multiple agents

---

## Open Questions

1. **How to handle tool dependencies?** (e.g., tool A needs tool B's output)
   - Option: Allow tool chaining in workflow definition
   
2. **How to enable tool reuse across agents?**
   - Option: Builtin tool library + user's generated tool library

3. **How to handle long-running tools?**
   - Option: Background jobs with status polling / webhooks

4. **Should we allow manual code editing of generated tools?**
   - Option: Yes, with "edited" flag to prevent regeneration

---

## Glossary

| Term | Definition |
|------|------------|
| **Agent** | An AI-powered unit that receives input and uses tools to accomplish tasks |
| **Tool** | A discrete function that performs a specific action |
| **Workflow** | The visual graph showing how data flows through an agent |
| **Orchestrator** | The logic that decides which tools to call and in what order |
| **Execution** | A single run of a workflow with specific inputs |
