# Plan Feature - Technical Design Document

## Overview

The Plan feature is the first step in a 3-phase workflow: **Plan → Iterate → Build**. This document focuses on the Plan phase, where users collaborate with an LLM to develop a comprehensive agent specification before building.

### User Flow
1. User enters an initial prompt (e.g., "Build me an agent that helps me accomplish my fitness goals")
2. Backend LLM processes the prompt and asks clarifying questions
3. User and LLM go back and forth until sufficient context is gathered
4. The plan document is continuously updated as new information comes in
5. User can view both the conversation and the current plan document in real-time
6. Once the user approves the plan, it moves to the Build phase

---

## Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Next.js)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐    ┌──────────────────────────────────────────┐   │
│  │   Conversation View  │    │          Plan Document View              │   │
│  │   - Message history  │    │   - Current plan (markdown/txt)          │   │
│  │   - User input       │    │   - Real-time updates                    │   │
│  │   - LLM responses    │    │   - Edit suggestions                     │   │
│  └──────────────────────┘    └──────────────────────────────────────────┘   │
│                                        │                                     │
│                              ┌─────────▼─────────┐                          │
│                              │   API Requests    │                          │
└──────────────────────────────┴─────────┬─────────┴──────────────────────────┘
                                         │
                              ┌──────────▼──────────┐
                              │   FastAPI Backend   │
                              ├─────────────────────┤
                              │  /api/plans/        │
                              │  - POST /create     │
                              │  - POST /{id}/chat  │
                              │  - GET /{id}        │
                              │  - PUT /{id}/approve│
                              └──────────┬──────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    │                    │                    │
           ┌────────▼────────┐  ┌────────▼────────┐  ┌────────▼────────┐
           │   Supabase DB   │  │ Supabase Storage│  │   LLM Service   │
           │   (Postgres)    │  │   (File Store)  │  │   (Anthropic)   │
           │                 │  │                 │  │                 │
           │  - plans table  │  │  - plan docs    │  │  - Claude API   │
           │  - messages     │  │  - .txt/.md     │  │  - Streaming    │
           └─────────────────┘  └─────────────────┘  └─────────────────┘
```

---

## Storage Strategy

### Option A: Hybrid Approach (Recommended)

Use **Supabase Database** for structured data and **Supabase Storage** for the plan document files.

#### Why Hybrid?
- **Database**: Fast queries, relationships, real-time subscriptions, ACID transactions
- **Storage**: Version history, larger documents, easy file downloads, CDN support

### Database Schema

```sql
-- Plans table: Core plan metadata
CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(255),
    status VARCHAR(50) DEFAULT 'drafting', -- drafting, approved, building, completed
    initial_prompt TEXT NOT NULL,
    document_path VARCHAR(500), -- Path in Supabase Storage
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    approved_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT valid_status CHECK (status IN ('drafting', 'approved', 'building', 'completed'))
);

-- Messages table: Conversation history
CREATE TABLE plan_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL, -- 'user' or 'assistant'
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_role CHECK (role IN ('user', 'assistant'))
);

-- Indexes for performance
CREATE INDEX idx_plans_user_id ON plans(user_id);
CREATE INDEX idx_plans_status ON plans(status);
CREATE INDEX idx_plan_messages_plan_id ON plan_messages(plan_id);
CREATE INDEX idx_plan_messages_created_at ON plan_messages(created_at);

-- Enable Row Level Security
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own plans" ON plans
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own plans" ON plans
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own plans" ON plans
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view messages for own plans" ON plan_messages
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM plans WHERE plans.id = plan_messages.plan_id AND plans.user_id = auth.uid())
    );

CREATE POLICY "Users can insert messages for own plans" ON plan_messages
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM plans WHERE plans.id = plan_messages.plan_id AND plans.user_id = auth.uid())
    );
```

### Supabase Storage Setup

```python
# Storage bucket for plan documents
BUCKET_NAME = "plan-documents"

# File structure:
# plan-documents/
#   └── {user_id}/
#       └── {plan_id}/
#           ├── plan.txt           # Current plan document
#           └── versions/          # Optional: version history
#               ├── plan_v1.txt
#               ├── plan_v2.txt
#               └── ...
```

---

## Backend Implementation

### New Files Structure

```
api/
├── plans.py          # Plan endpoints
├── conscience.py     # Existing
└── auth.py           # Existing

services/
├── plan_service.py   # Plan business logic
├── llm_service.py    # LLM interaction
└── storage_service.py # Supabase Storage wrapper

models/
├── plan.py           # Plan Pydantic models
└── ...
```

### API Endpoints

#### `POST /api/plans/create`
Create a new plan with initial prompt.

```python
# Request
{
    "initial_prompt": "Build me an agent that helps me accomplish my fitness goals"
}

# Response
{
    "plan_id": "uuid",
    "title": "Fitness Goals Agent",
    "status": "drafting",
    "initial_message": {
        "role": "assistant",
        "content": "I'd love to help you build a fitness agent! Let me ask a few questions..."
    },
    "document_url": "https://..."  # Signed URL to view document
}
```

#### `POST /api/plans/{plan_id}/chat`
Send a message and receive LLM response with updated plan.

```python
# Request
{
    "message": "I want it to track my workouts and suggest improvements"
}

# Response (streaming or regular)
{
    "response": {
        "role": "assistant",
        "content": "Great! So you want workout tracking..."
    },
    "plan_updated": true,
    "document_url": "https://...",  # Fresh signed URL
    "plan_preview": "## Fitness Goals Agent\n\n### Core Features..."  # First 500 chars
}
```

#### `GET /api/plans/{plan_id}`
Get plan details including conversation history.

```python
# Response
{
    "id": "uuid",
    "title": "Fitness Goals Agent",
    "status": "drafting",
    "initial_prompt": "...",
    "messages": [
        {"role": "user", "content": "...", "created_at": "..."},
        {"role": "assistant", "content": "...", "created_at": "..."}
    ],
    "document_url": "https://...",
    "document_content": "## Full plan content...",
    "created_at": "...",
    "updated_at": "..."
}
```

#### `PUT /api/plans/{plan_id}/approve`
Approve the plan and move to build phase.

```python
# Response
{
    "id": "uuid",
    "status": "approved",
    "approved_at": "..."
}
```

#### `GET /api/plans`
List all plans for the authenticated user.

```python
# Response
{
    "plans": [
        {
            "id": "uuid",
            "title": "Fitness Goals Agent",
            "status": "drafting",
            "created_at": "...",
            "updated_at": "..."
        }
    ]
}
```

### Service Layer

#### `plan_service.py`

```python
from uuid import UUID
from db.supabase import supabase
from services.llm_service import LLMService
from services.storage_service import StorageService

class PlanService:
    def __init__(self):
        self.llm = LLMService()
        self.storage = StorageService()
    
    async def create_plan(self, user_id: UUID, initial_prompt: str) -> dict:
        """
        1. Create plan record in database
        2. Generate initial plan document
        3. Upload to storage
        4. Generate first LLM response (clarifying questions)
        5. Save assistant message
        6. Return plan with first response
        """
        pass
    
    async def chat(self, plan_id: UUID, user_id: UUID, message: str) -> dict:
        """
        1. Validate user owns plan
        2. Get conversation history
        3. Get current plan document
        4. Send to LLM with context
        5. Parse response (message + plan updates)
        6. Update plan document in storage
        7. Save messages to database
        8. Return response
        """
        pass
    
    async def get_plan(self, plan_id: UUID, user_id: UUID) -> dict:
        """Fetch plan with messages and document content"""
        pass
    
    async def approve_plan(self, plan_id: UUID, user_id: UUID) -> dict:
        """Mark plan as approved, ready for build phase"""
        pass
```

#### `storage_service.py`

```python
from db.supabase import supabase

BUCKET_NAME = "plan-documents"

class StorageService:
    
    def upload_plan_document(self, user_id: str, plan_id: str, content: str) -> str:
        """Upload or update plan document, return file path"""
        file_path = f"{user_id}/{plan_id}/plan.txt"
        
        # Convert string to bytes
        file_bytes = content.encode('utf-8')
        
        response = supabase.get_client().storage.from_(BUCKET_NAME).upload(
            path=file_path,
            file=file_bytes,
            file_options={"content-type": "text/plain", "upsert": "true"}
        )
        
        return file_path
    
    def download_plan_document(self, user_id: str, plan_id: str) -> str:
        """Download plan document content"""
        file_path = f"{user_id}/{plan_id}/plan.txt"
        
        response = supabase.get_client().storage.from_(BUCKET_NAME).download(file_path)
        
        return response.decode('utf-8')
    
    def get_signed_url(self, file_path: str, expires_in: int = 3600) -> str:
        """Generate signed URL for frontend access"""
        response = supabase.get_client().storage.from_(BUCKET_NAME).create_signed_url(
            path=file_path,
            expires_in=expires_in
        )
        
        return response['signedURL']
```

#### `llm_service.py`

```python
from anthropic import Anthropic

SYSTEM_PROMPT = """You are an AI agent planning assistant. Your job is to help users 
define clear, actionable specifications for AI agents they want to build.

When a user describes what they want, you should:
1. Ask clarifying questions to understand their needs
2. Identify edge cases and potential challenges
3. Suggest features they might not have considered
4. Help them prioritize features

As you gather information, you will update a plan document that will be used to 
build the agent. The plan should include:
- Agent name and description
- Core capabilities
- Input/output specifications
- Data sources needed
- Success criteria
- Edge cases to handle

Respond in this format:
<message>Your conversational response to the user</message>
<plan_update>true/false - whether the plan needs updating</plan_update>
<plan>
If plan_update is true, include the full updated plan document here in markdown format.
</plan>
"""

class LLMService:
    def __init__(self):
        self.client = Anthropic()
    
    async def generate_plan_response(
        self, 
        conversation_history: list,
        current_plan: str,
        user_message: str
    ) -> dict:
        """
        Generate LLM response with optional plan update
        Returns: { "message": str, "plan_updated": bool, "plan_content": str | None }
        """
        messages = self._build_messages(conversation_history, current_plan, user_message)
        
        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            messages=messages
        )
        
        return self._parse_response(response.content[0].text)
    
    def _build_messages(self, history: list, plan: str, new_message: str) -> list:
        """Build message list with plan context"""
        messages = []
        
        # Add conversation history
        for msg in history:
            messages.append({"role": msg["role"], "content": msg["content"]})
        
        # Add current message with plan context
        context = f"""Current plan document:
<current_plan>
{plan if plan else "No plan document yet."}
</current_plan>

User message: {new_message}"""
        
        messages.append({"role": "user", "content": context})
        
        return messages
    
    def _parse_response(self, response: str) -> dict:
        """Parse structured response from LLM"""
        # Extract message, plan_update flag, and plan content
        # Implementation details...
        pass
```

---

## Frontend Implementation

### Components Structure

```
app/
├── plan/
│   └── [id]/
│       └── page.tsx      # Plan detail page with chat + document view
├── build/
│   └── page.tsx          # Existing - add "Start Planning" flow

components/
├── plan/
│   ├── PlanChat.tsx      # Conversation interface
│   ├── PlanDocument.tsx  # Plan document viewer
│   ├── PlanLayout.tsx    # Split view layout
│   └── ApproveButton.tsx # Approve and proceed to build
```

### Plan Page Layout

```tsx
// app/plan/[id]/page.tsx
export default function PlanPage({ params }: { params: { id: string } }) {
  return (
    <div className="h-screen flex">
      {/* Left: Conversation */}
      <div className="w-1/2 border-r flex flex-col">
        <PlanChat planId={params.id} />
      </div>
      
      {/* Right: Plan Document */}
      <div className="w-1/2 flex flex-col">
        <PlanDocument planId={params.id} />
      </div>
    </div>
  );
}
```

### State Management

```tsx
// Consider using React Query or SWR for:
// - Fetching plan data
// - Polling/real-time updates for document
// - Optimistic updates for messages

// Or Supabase Realtime for live updates:
supabase
  .channel('plan-updates')
  .on('postgres_changes', { 
    event: 'UPDATE', 
    schema: 'public', 
    table: 'plans',
    filter: `id=eq.${planId}`
  }, (payload) => {
    // Refetch document when plan updates
  })
  .subscribe();
```

---

## Conversation Flow Example

```
User: "Build me an agent that helps me accomplish my fitness goals"