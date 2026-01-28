# Daytona Sandboxes Integration

## Overview

[Daytona](https://www.daytona.io/) is an open-source infrastructure platform for running AI-generated code in isolated sandbox environments. It's highly applicable to our use case of executing Python agent code securely.

**Key Value Proposition:** Instead of building our own sandboxing infrastructure (containers, security isolation, resource limits), Daytona provides this as a managed service with SDKs.

---

## Why Daytona for Our Sandbox?

| Our Requirement | Daytona Solution |
|-----------------|------------------|
| Execute Python code safely | Isolated sandbox environments per execution |
| Stream logs in real-time | Log streaming API built-in |
| Manage file system (agent code) | File system operations (upload/download) |
| Resource limits per agent | Configurable CPU, RAM, disk per sandbox |
| Pay-per-use pricing | Usage-based billing (per-second) |
| Fast startup times | Warm sandbox pools - millisecond launches |

---

## Key Features

### Sandbox Capabilities

- **Multiple runtimes:** Python, TypeScript, JavaScript
- **Default resources:** 1 vCPU, 1GB RAM, 3GB disk
- **Max resources:** 4 vCPUs, 8GB RAM, 10GB disk
- **Stateful code interpreter:** Persist variables between calls (Python only)
- **Stateless execution:** Clean interpreter per call
- **File system operations:** Upload/download files to sandbox
- **Git operations:** Clone repos, manage code
- **Background processes:** Long-running tasks with session management

### Lifecycle Management

- **Auto-stop:** Configurable inactivity timeout (default 15 min)
- **Auto-archive:** Move stopped sandboxes to cold storage
- **Auto-delete:** Clean up after configurable period
- **Ephemeral sandboxes:** Auto-delete on stop (for one-off executions)

---

## Pricing

**Pay-as-you-go, charged per second:**

| Resource | Cost |
|----------|------|
| vCPU | $0.0504/hour ($0.000014/sec) |
| Memory (GiB) | $0.0162/hour ($0.0000045/sec) |
| Storage (GiB) | $0.000108/hour ($0.00000003/sec) |

**Free tier:** $200 in compute credits + 5GB free storage

**Example cost:** Running a 1 vCPU, 1GB RAM sandbox for 1 hour = ~$0.07

---

## Integration Approach

### Option A: Backend Integration (Recommended)

Our FastAPI backend calls Daytona's Python SDK to manage sandboxes.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│   Backend   │────▶│   Daytona   │
│  (Next.js)  │     │  (FastAPI)  │     │  Sandboxes  │
└─────────────┘     └─────────────┘     └─────────────┘
     │                    │                    │
     │ WebSocket          │ Python SDK         │ Isolated
     │ (logs/status)      │ (create/execute)   │ Execution
```

**Flow:**
1. User clicks "Start Building" in sandbox UI
2. Frontend sends request to backend via WebSocket
3. Backend creates Daytona sandbox, uploads agent code
4. Backend executes code, streams logs back to frontend
5. Backend cleans up sandbox when done

### Option B: Direct Frontend Integration

Use Daytona's TypeScript SDK directly from the frontend (Next.js server actions).

**Pros:** Simpler architecture, fewer hops
**Cons:** API key management, less control over execution

---

## Backend Implementation

### Install SDK

```bash
pip install daytona
```

### Service: `services/daytona_service.py`

```python
from daytona import Daytona, DaytonaConfig, CreateSandboxFromSnapshotParams
from typing import Callable, Optional
import os

class DaytonaService:
    """Service for managing Daytona sandboxes for agent execution."""
    
    def __init__(self):
        self.config = DaytonaConfig(
            api_key=os.getenv("DAYTONA_API_KEY")
        )
        self.client = Daytona(self.config)
    
    def create_sandbox(
        self, 
        agent_id: str,
        auto_stop_minutes: int = 15
    ) -> str:
        """Create a new sandbox for an agent."""
        params = CreateSandboxFromSnapshotParams(
            language="python",
            name=f"agent-{agent_id}",
            auto_stop_interval=auto_stop_minutes,
            labels={"agent_id": agent_id}
        )
        sandbox = self.client.create(params)
        return sandbox.id
    
    def execute_code(
        self,
        sandbox_id: str,
        code: str,
        on_stdout: Optional[Callable] = None,
        on_stderr: Optional[Callable] = None,
        timeout: int = 300  # 5 minutes default
    ):
        """Execute Python code in a sandbox."""
        sandbox = self.client.find_one(sandbox_id)
        
        # For stateful execution (variables persist)
        response = sandbox.code_interpreter.run_code(
            code,
            on_stdout=on_stdout,
            on_stderr=on_stderr,
            timeout=timeout
        )
        
        return {
            "exit_code": response.exit_code,
            "result": response.result
        }
    
    def upload_agent_code(
        self,
        sandbox_id: str,
        code: str,
        filename: str = "agent.py"
    ):
        """Upload agent code to sandbox filesystem."""
        sandbox = self.client.find_one(sandbox_id)
        sandbox.fs.upload_file(
            path=f"/home/daytona/{filename}",
            content=code.encode()
        )
    
    def run_agent(
        self,
        sandbox_id: str,
        on_stdout: Optional[Callable] = None
    ):
        """Run the uploaded agent code."""
        sandbox = self.client.find_one(sandbox_id)
        response = sandbox.process.exec(
            "python /home/daytona/agent.py",
            on_stdout=on_stdout
        )
        return response
    
    def cleanup_sandbox(self, sandbox_id: str):
        """Delete a sandbox after execution."""
        sandbox = self.client.find_one(sandbox_id)
        sandbox.delete()
```

### API Endpoint: `api/agent.py`

```python
@router.post("/{agent_id}/execute")
async def execute_agent(
    agent_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Execute an agent's code in a Daytona sandbox."""
    # Get agent and its code
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(404, "Agent not found")
    
    # Create sandbox
    daytona_service = DaytonaService()
    sandbox_id = daytona_service.create_sandbox(agent_id)
    
    try:
        # Upload and execute code
        daytona_service.upload_agent_code(sandbox_id, agent.code)
        result = daytona_service.run_agent(sandbox_id)
        
        return {
            "success": True,
            "exit_code": result.exit_code,
            "output": result.result
        }
    finally:
        # Cleanup
        daytona_service.cleanup_sandbox(sandbox_id)
```

---

## WebSocket Log Streaming

For real-time log streaming to the frontend:

```python
# In WebSocket handler
async def stream_execution(websocket, agent_id: str, code: str):
    daytona_service = DaytonaService()
    sandbox_id = daytona_service.create_sandbox(agent_id)
    
    def on_stdout(message):
        asyncio.create_task(websocket.send_json({
            "type": "log",
            "stream": "stdout",
            "content": message.output
        }))
    
    def on_stderr(message):
        asyncio.create_task(websocket.send_json({
            "type": "log", 
            "stream": "stderr",
            "content": message.output
        }))
    
    try:
        result = daytona_service.execute_code(
            sandbox_id,
            code,
            on_stdout=on_stdout,
            on_stderr=on_stderr
        )
        
        await websocket.send_json({
            "type": "execution_complete",
            "exit_code": result["exit_code"],
            "result": result["result"]
        })
    finally:
        daytona_service.cleanup_sandbox(sandbox_id)
```

---

## Environment Setup

### Required Environment Variables

```bash
# .env
DAYTONA_API_KEY=your_api_key_here
```

### Getting API Key

1. Create account at [Daytona Dashboard](https://app.daytona.io/)
2. Navigate to Dashboard → API Keys
3. Generate new key and save securely

---

## Comparison: Daytona vs Self-Hosted

| Aspect | Daytona | Self-Hosted (Docker) |
|--------|---------|---------------------|
| Setup time | Minutes | Days/weeks |
| Security isolation | Managed | Your responsibility |
| Scaling | Automatic | Manual infrastructure |
| Cost | Pay-per-use | Fixed server costs |
| Maintenance | None | Ongoing |
| Cold start | Milliseconds (warm pools) | Seconds (container pull) |

**Recommendation:** Start with Daytona for faster development. Consider self-hosted later if costs become significant at scale.

---

## Integration with Sandbox UI

The sandbox UI can integrate Daytona as follows:

1. **Start Building Button** → Creates Daytona sandbox
2. **Code Editor (left panel)** → Code synced to sandbox filesystem
3. **Execution Logs (right panel)** → Streamed from Daytona
4. **Agent Visualizer** → Shows execution state from Daytona callbacks

---

## Next Steps

1. [ ] Sign up for Daytona account and get API key
2. [ ] Add `DAYTONA_API_KEY` to environment variables
3. [ ] Install `daytona` Python package
4. [ ] Create `services/daytona_service.py`
5. [ ] Update `api/agent.py` with execute endpoint
6. [ ] Create WebSocket endpoint for log streaming
7. [ ] Connect frontend sandbox UI to execution endpoints

---

## Resources

- [Daytona Documentation](https://www.daytona.io/docs/)
- [Python SDK Reference](https://www.daytona.io/docs/en/python-sdk/)
- [TypeScript SDK Reference](https://www.daytona.io/docs/en/typescript-sdk/)
- [Pricing Details](https://www.daytona.io/pricing)
- [Process & Code Execution](https://www.daytona.io/docs/en/process-code-execution)
