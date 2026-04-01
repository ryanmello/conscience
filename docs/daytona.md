# Daytona Sandboxes Integration

## Overview

[Daytona](https://www.daytona.io/) is an open-source infrastructure platform for running AI-generated code in isolated sandbox environments. We use it to execute multi-file agent projects that are generated and stored in our `agent_file` database table.

**Key Value Proposition:** Instead of building our own sandboxing infrastructure (containers, security isolation, resource limits), Daytona provides this as a managed service with SDKs.

---

## Why Daytona for Our Sandbox?

| Our Requirement | Daytona Solution |
|-----------------|------------------|
| Execute Python code safely | Isolated sandbox environments per execution |
| Stream logs in real-time | Log streaming API built-in |
| Manage file system (multi-file projects) | File system operations (upload/download) |
| Install pip dependencies | Process execution (run arbitrary commands) |
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

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Frontend  │────▶│   Backend   │────▶│   Database   │     │   Daytona   │
│  (Next.js)  │     │  (FastAPI)  │     │  (Supabase)  │     │  Sandboxes  │
└─────────────┘     └─────────────┘     └──────────────┘     └─────────────┘
     │                    │                    │                    │
     │ WebSocket          │ 1. Read files      │ agent_file table  │
     │ (logs/status)      │    from DB ────────┘                   │
     │                    │                                        │
     │                    │ 2. Create sandbox ─────────────────────┘
     │                    │ 3. Sync files to sandbox FS            │
     │                    │ 4. pip install dependencies             │
     │                    │ 5. Execute entry point                  │
     │◀───────────────────│ 6. Stream logs back ◀──────────────────│
```

**The database is the source of truth.** Daytona sandboxes are ephemeral runtime environments. Files are synced from `agent_file` rows into the sandbox before each execution.

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
from sqlalchemy.orm import Session

from models.agent_file import AgentFile
from config.settings import settings
from utils.logger import get_logger

logger = get_logger(__name__)

class DaytonaService:
    """Service for managing Daytona sandboxes for multi-file agent execution."""

    def __init__(self):
        self.config = DaytonaConfig(
            api_key=settings.DAYTONA_API_KEY
        )
        self.client = Daytona(self.config)

    def create_sandbox(
        self,
        agent_id: str,
        env_vars: Optional[dict[str, str]] = None,
        auto_stop_minutes: int = 15
    ) -> str:
        """Create a new sandbox for an agent with optional environment variables."""
        params = CreateSandboxFromSnapshotParams(
            language="python",
            name=f"agent-{agent_id}",
            auto_stop_interval=auto_stop_minutes,
            env_vars=env_vars or {},
            labels={"agent_id": agent_id}
        )
        sandbox = self.client.create(params)
        return sandbox.id

    def sync_files_to_sandbox(
        self,
        sandbox_id: str,
        db: Session,
        agent_id: str
    ):
        """
        Sync all files from agent_file table to the sandbox filesystem.
        Preserves directory structure (e.g. src/utils/helpers.py).
        """
        sandbox = self.client.find_one(sandbox_id)
        files = db.query(AgentFile).filter(AgentFile.agent_id == agent_id).all()

        for f in files:
            sandbox.fs.upload_file(
                path=f"/home/daytona/{f.path}",
                content=f.content.encode()
            )

        logger.info(f"Synced {len(files)} files to sandbox {sandbox_id}")

    def install_dependencies(self, sandbox_id: str):
        """Install Python dependencies if requirements.txt exists."""
        sandbox = self.client.find_one(sandbox_id)
        try:
            sandbox.process.exec("pip install -r /home/daytona/requirements.txt")
            logger.info(f"Dependencies installed in sandbox {sandbox_id}")
        except Exception as e:
            logger.warning(f"Dependency install failed (may not have requirements.txt): {e}")

    def execute_agent(
        self,
        sandbox_id: str,
        entry_point: str = "main.py",
        on_stdout: Optional[Callable] = None,
        on_stderr: Optional[Callable] = None
    ):
        """Run the agent's entry point script."""
        sandbox = self.client.find_one(sandbox_id)
        response = sandbox.process.exec(
            f"python /home/daytona/{entry_point}",
            on_stdout=on_stdout,
            on_stderr=on_stderr
        )
        return response

    def cleanup_sandbox(self, sandbox_id: str):
        """Delete a sandbox after execution."""
        try:
            sandbox = self.client.find_one(sandbox_id)
            sandbox.delete()
            logger.info(f"Sandbox {sandbox_id} cleaned up")
        except Exception as e:
            logger.error(f"Failed to cleanup sandbox {sandbox_id}: {e}")
```

---

## API Endpoint: `api/agent.py`

### Execution Endpoint

```python
@router.post("/{agent_id}/execute")
async def execute_agent(
    agent_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Execute an agent's code in a Daytona sandbox."""
    agent = db.query(Agent).filter(
        Agent.id == agent_id,
        Agent.user_id == UUID(user.id)
    ).first()
    if not agent:
        raise HTTPException(404, "Agent not found")

    # Check that files exist
    file_count = db.query(AgentFile).filter(AgentFile.agent_id == agent_id).count()
    if file_count == 0:
        raise HTTPException(400, "No generated files to execute")

    # TODO: Load user secrets from a secrets table
    env_vars = {}

    daytona_service = DaytonaService()
    sandbox_id = daytona_service.create_sandbox(agent_id, env_vars=env_vars)

    try:
        # Sync all files from DB to sandbox
        daytona_service.sync_files_to_sandbox(sandbox_id, db, agent_id)

        # Install dependencies
        daytona_service.install_dependencies(sandbox_id)

        # Execute entry point (from agent metadata, default to main.py)
        entry_point = agent.entry_point or "main.py"
        result = daytona_service.execute_agent(sandbox_id, entry_point=entry_point)

        return {
            "success": True,
            "exit_code": result.exit_code,
            "output": result.result
        }
    finally:
        daytona_service.cleanup_sandbox(sandbox_id)
```

---

## WebSocket Log Streaming

For real-time log streaming to the frontend during execution:

```python
import asyncio

async def stream_execution(websocket, agent_id: str, db: Session, user_id: str):
    """Stream agent execution logs to the frontend via WebSocket."""
    agent = db.query(Agent).filter(
        Agent.id == agent_id,
        Agent.user_id == UUID(user_id)
    ).first()

    if not agent:
        await websocket.send_json({"type": "error", "message": "Agent not found"})
        return

    # TODO: Load user secrets
    env_vars = {}

    daytona_service = DaytonaService()
    sandbox_id = daytona_service.create_sandbox(agent_id, env_vars=env_vars)

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
        await websocket.send_json({"type": "status", "status": "syncing_files"})

        # Sync files from DB
        daytona_service.sync_files_to_sandbox(sandbox_id, db, agent_id)

        await websocket.send_json({"type": "status", "status": "installing_dependencies"})

        # Install deps
        daytona_service.install_dependencies(sandbox_id)

        await websocket.send_json({"type": "status", "status": "executing"})

        # Execute with log streaming
        entry_point = agent.entry_point or "main.py"
        result = daytona_service.execute_agent(
            sandbox_id,
            entry_point=entry_point,
            on_stdout=on_stdout,
            on_stderr=on_stderr
        )

        await websocket.send_json({
            "type": "execution_complete",
            "exit_code": result.exit_code,
            "result": result.result
        })
    except Exception as e:
        await websocket.send_json({
            "type": "error",
            "message": str(e)
        })
    finally:
        daytona_service.cleanup_sandbox(sandbox_id)
```

---

## Sandbox Lifecycle Strategies

### Ephemeral (Recommended for V1)

Create a fresh sandbox for each execution. Destroy it when finished.

- **Pros:** Simple, no state to manage, no lingering costs
- **Cons:** Cold start on every run (mitigated by Daytona's warm pools), re-install deps each time
- **Implementation:** Create in execution endpoint, destroy in `finally` block

### Persistent (Better UX, V2)

Keep the sandbox alive while the user is on the `/build/[agentId]` page. Re-use it across multiple runs.

- **Pros:** No cold start on re-runs, no re-installing deps, faster iteration
- **Cons:** Need to track sandbox ID, handle cleanup on disconnect, ongoing costs
- **Implementation:**
  - Store `sandbox_id` on the agent record or in a `sandbox_session` table
  - On re-run, only sync files that changed (compare `updated_at` timestamps)
  - Use Daytona's `auto_stop_interval` (e.g., 15 min inactivity) as a safety net
  - Clean up on WebSocket disconnect

### Agent Table Changes for Persistent Sandboxes

```sql
ALTER TABLE agent ADD COLUMN entry_point VARCHAR(500) DEFAULT 'main.py';
ALTER TABLE agent ADD COLUMN sandbox_id VARCHAR(200);
ALTER TABLE agent ADD COLUMN sandbox_active BOOLEAN DEFAULT false;
```

---

## Secrets / Environment Variables

Agents that call external APIs (OpenAI, Twilio, databases, etc.) need API keys injected into the sandbox.

### Storage

Store encrypted secrets per agent in the database:

```sql
CREATE TABLE agent_secret (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
    key VARCHAR(200) NOT NULL,       -- e.g. "OPENAI_API_KEY"
    encrypted_value TEXT NOT NULL,    -- encrypted at rest
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(agent_id, key)
);
```

### Injection

Load secrets at sandbox creation time:

```python
secrets = db.query(AgentSecret).filter(AgentSecret.agent_id == agent_id).all()
env_vars = {s.key: decrypt(s.encrypted_value) for s in secrets}
sandbox_id = daytona_service.create_sandbox(agent_id, env_vars=env_vars)
```

### Frontend

A settings UI on the `/build/[agentId]` page where users add key-value pairs for environment variables. Values are encrypted before storage and never sent back to the frontend.

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

## Implementation Checklist

- [ ] Sign up for Daytona account and get API key
- [ ] Add `DAYTONA_API_KEY` to `.env` and `config/settings.py`
- [ ] Install `daytona` Python package
- [ ] Add `entry_point` column to agent table (migration)
- [ ] Create `services/daytona_service.py` (multi-file sync version)
- [ ] Add `/api/agent/{id}/execute` endpoint
- [ ] Add WebSocket endpoint for log streaming
- [ ] Wire frontend Run/Stop buttons to execution endpoints
- [ ] Create `hooks/useSandboxWebSocket.ts`
- [ ] Stream logs to ExecutionLogs component

### Future (V2)
- [ ] Persistent sandbox sessions (sandbox_id tracking)
- [ ] Secrets management table + encryption
- [ ] Secrets UI on build page
- [ ] Incremental file sync (only changed files)
- [ ] Network egress rules for security

---

## Resources

- [Daytona Documentation](https://www.daytona.io/docs/)
- [Python SDK Reference](https://www.daytona.io/docs/en/python-sdk/)
- [TypeScript SDK Reference](https://www.daytona.io/docs/en/typescript-sdk/)
- [Pricing Details](https://www.daytona.io/pricing)
- [Process & Code Execution](https://www.daytona.io/docs/en/process-code-execution)
