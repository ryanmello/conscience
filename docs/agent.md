# Plan Approval & Agent Creation Implementation

## Overview

When a user approves their plan, we need to:
1. Save the plan document to Supabase storage (already implemented)
2. Create a `Plan` record in the database
3. Create an `Agent` record linked to the plan
4. Return the agent ID to the frontend
5. Redirect the user to `/build/[agentId]`

---

## 1. Database Schema

### Plan Table

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique plan identifier |
| `user_id` | UUID | NOT NULL | Supabase auth user ID |
| `title` | VARCHAR(500) | NOT NULL | Plan title |
| `document_url` | TEXT | NOT NULL | Signed URL to plan document in Supabase storage |
| `document_path` | VARCHAR(500) | NOT NULL | Storage path (for regenerating signed URLs) |
| `status` | VARCHAR(50) | DEFAULT 'approved' | Plan status (approved, archived, etc.) |
| `created_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Last update timestamp |

### Agent Table

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique agent identifier |
| `user_id` | UUID | NOT NULL | Supabase auth user ID |
| `plan_id` | UUID | NOT NULL, FOREIGN KEY (plan.id) | Reference to the approved plan |
| `name` | VARCHAR(200) | NULL | Agent name (can be derived from plan title) |
| `status` | VARCHAR(50) | DEFAULT 'building' | Agent status (building, active, paused, archived) |
| `created_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Last update timestamp |

---

## 2. Implementation Steps

### Step 2.1: Create SQLAlchemy Models

Create new model files following the existing `Environment` model pattern.

**File: `models/plan.py`**

```python
from datetime import datetime
from typing import Optional
from uuid import UUID
from sqlalchemy import String, Text, DateTime, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from db.database import Base
import uuid


class Plan(Base):
    """
    Plan model - stores approved plan documents.
    """
    __tablename__ = "plan"
    
    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4
    )
    user_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    document_url: Mapped[str] = mapped_column(Text, nullable=False)
    document_path: Mapped[str] = mapped_column(String(500), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="approved")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        onupdate=func.now()
    )
    
    # Relationship to agents
    agents: Mapped[list["Agent"]] = relationship("Agent", back_populates="plan")
    
    def __repr__(self) -> str:
        return f"<Plan(id={self.id}, title='{self.title}')>"
```

**File: `models/agent.py`**

```python
from datetime import datetime
from typing import Optional, TYPE_CHECKING
from uuid import UUID
from sqlalchemy import String, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from db.database import Base
import uuid

if TYPE_CHECKING:
    from models.plan import Plan


class Agent(Base):
    """
    Agent model - represents a user's AI agent built from an approved plan.
    """
    __tablename__ = "agent"
    
    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4
    )
    user_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    plan_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), 
        ForeignKey("plan.id"), 
        nullable=False
    )
    name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="building")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        onupdate=func.now()
    )
    
    # Relationship to plan
    plan: Mapped["Plan"] = relationship("Plan", back_populates="agents")
    
    def __repr__(self) -> str:
        return f"<Agent(id={self.id}, name='{self.name}')>"
```

### Step 2.2: Update `models/__init__.py`

```python
from models.environment import Environment
from models.plan import Plan
from models.agent import Agent

__all__ = ["Environment", "Plan", "Agent"]
```

### Step 2.3: Update `alembic/env.py`

Ensure the new models are imported so Alembic can detect them:

```python
from models import Environment, Plan, Agent
```

### Step 2.4: Generate Alembic Migration

```bash
# Generate the migration
alembic revision --autogenerate -m "add_plan_and_agent_tables"

# Review the generated migration file in alembic/versions/

# Apply the migration
alembic upgrade head
```

---

## 3. Backend API Updates

### Step 3.1: Update API Response Model

**File: `models/api.py`** - Add `agent_id` to response:

```python
class ApprovePlanResponse(BaseModel):
    success: bool
    message: str
    document_url: Optional[str] = None
    agent_id: Optional[str] = None  # NEW: Return agent ID for redirect
```

### Step 3.2: Update Approve Endpoint

**File: `api/plan.py`**:

```python
from sqlalchemy.orm import Session
from db.database import get_db
from models.plan import Plan
from models.agent import Agent
from uuid import UUID

@router.post("/approve", response_model=ApprovePlanResponse)
async def approve_plan(
    request: ApproveDocumentRequest,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Approve the refined document and prepare for next phase.
    1. Save document to storage
    2. Create Plan record in database
    3. Create Agent record linked to the plan
    4. Return agent_id for frontend redirect
    """
    logger.info(f"User {user.id} approving plan {request.plan_id}")
    
    try:
        # 1. Save the final approved document to storage
        file_path = storage_service.upload_plan_document(
            user_id=str(user.id),
            plan_id=request.plan_id,
            content=request.content
        )
        document_url = storage_service.get_signed_url(file_path)
        
        # 2. Create Plan record
        plan = Plan(
            user_id=UUID(user.id),
            title=request.title,
            document_url=document_url,
            document_path=file_path,
            status="approved"
        )
        db.add(plan)
        db.flush()  # Get the plan.id before commit
        
        # 3. Create Agent record
        agent = Agent(
            user_id=UUID(user.id),
            plan_id=plan.id,
            name=request.title,  # Use plan title as initial agent name
            status="building"
        )
        db.add(agent)
        db.commit()
        
        logger.info(f"Plan {plan.id} and Agent {agent.id} created for user {user.id}")
        
        return ApprovePlanResponse(
            success=True,
            message="Plan approved and agent created successfully",
            document_url=document_url,
            agent_id=str(agent.id)
        )
        
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to approve plan: {e}")
        raise HTTPException(status_code=500, detail="Failed to approve plan")
```

---

## 4. Frontend Updates

### Step 4.1: Update Action Types

**File: `ui/actions/approve-plan.ts`**:

```typescript
export interface ApprovePlanResult {
  success: boolean;
  message: string;
  document_url?: string;
  agent_id?: string;  // NEW: Agent ID for redirect
}
```

### Step 4.2: Update Page Handler

**File: `ui/app/build/page.tsx`**:

```typescript
import { useRouter } from "next/navigation";

// In the component:
const router = useRouter();

const handleApprove = async () => {
  if (!document || !sessionId) return;

  setIsApproving(true);
  disconnect();

  try {
    const result = await approvePlan({
      plan_id: sessionId,
      title: document.title,
      content: document.content,
      version: document.version,
    });

    if (result.success && result.data) {
      toast.success(result.data.message);
      
      // Redirect to the agent sandbox
      if (result.data.agent_id) {
        router.push(`/build/${result.data.agent_id}`);
      }
    } else {
      toast.error(result.error || "Failed to approve plan");
    }
  } catch (err) {
    console.error("Error approving plan:", err);
    toast.error("Failed to approve plan");
  } finally {
    setIsApproving(false);
  }
};
```

---

## 5. File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `models/plan.py` | CREATE | New Plan SQLAlchemy model |
| `models/agent.py` | CREATE | New Agent SQLAlchemy model |
| `models/__init__.py` | UPDATE | Export Plan and Agent |
| `alembic/env.py` | UPDATE | Import Plan and Agent for migrations |
| `models/api.py` | UPDATE | Add `agent_id` to ApprovePlanResponse |
| `api/plan.py` | UPDATE | Create Plan/Agent records, return agent_id |
| `ui/actions/approve-plan.ts` | UPDATE | Add `agent_id` to response type |
| `ui/app/build/page.tsx` | UPDATE | Add router redirect to `/build/[agentId]` |

---

## 6. Testing Checklist

- [ ] Run Alembic migration successfully
- [ ] Verify Plan table created in Supabase
- [ ] Verify Agent table created in Supabase
- [ ] Test approve endpoint creates both records
- [ ] Verify foreign key constraint (agent.plan_id → plan.id)
- [ ] Test frontend receives agent_id in response
- [ ] Test redirect to `/build/[agentId]` works
- [ ] Test error handling (rollback on failure)

---

## 7. Future Considerations

1. **Agent Status Workflow**: Define status transitions (building → active → paused → archived)
2. **Soft Deletes**: Add `deleted_at` column for soft delete support
3. **Plan Versioning**: Track plan revisions if users can edit approved plans
4. **Indexes**: Add indexes on `user_id` columns for query performance
5. **RLS Policies**: Set up Row Level Security in Supabase for direct database access
