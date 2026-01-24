# Minimal Plan Feature - MVP Design

## Overview

A simplified version of the Plan feature that generates an agent specification document from a single user request. No back-and-forth conversation—just input, generate, and store.

### User Flow
1. User enters a prompt (e.g., "Build me an agent that helps me accomplish my fitness goals")
2. Backend LLM generates a complete plan document in one shot
3. Document is uploaded to Supabase Storage
4. User receives the generated plan

---

## Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Plan Input Form                        │   │
│  │    - Text input for user request                         │   │
│  │    - Submit button                                        │   │
│  │    - Display generated plan                               │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                    POST /api/plans/generate                      │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   FastAPI Backend   │
                    ├─────────────────────┤
                    │  POST /api/plans/   │
                    │    generate         │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                                 │
     ┌────────▼────────┐              ┌────────▼────────┐
     │ Supabase Storage│              │   LLM Service   │
     │   (File Store)  │              │   (Anthropic)   │
     │                 │              │                 │
     │  - plan docs    │              │  - Claude API   │
     │  - .txt/.md     │              │  - One-shot gen │
     └─────────────────┘              └─────────────────┘
```

---

## Supabase Storage Setup

### Bucket Configuration

```python
BUCKET_NAME = "plan-documents"

# File structure:
# plan-documents/
#   └── {user_id}/
#       └── {plan_id}.txt
```

### Storage Bucket Creation (Supabase Dashboard or SQL)

```sql
-- Create storage bucket (via Supabase Dashboard is easier)
-- Or use the Supabase client in Python:
-- supabase.storage.create_bucket('plan-documents', {'public': False})
```

### Row Level Security for Storage

```sql
-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload own plan documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'plan-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to read their own documents
CREATE POLICY "Users can read own plan documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'plan-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
);
```

---

## Backend Implementation

### New Files

```
api/
├── plans.py              # Plan generation endpoint

services/
├── plan_service.py     # LLM plan generation
└── storage_service.py    # Supabase Storage wrapper
```

### API Endpoint

#### `POST /api/plans/generate`

Generate a plan document from user request.

```python
# Request
{
    "prompt": "Build me an agent that helps me accomplish my fitness goals"
}

# Response
{
    "plan_id": "uuid",
    "title": "Fitness Goals Agent",
    "document_url": "https://...",  # Signed URL to view/download
    "content": "# Fitness Goals Agent\n\n## Overview..."  # Full plan content
}
```

### Implementation

#### `api/plans.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from uuid import uuid4
from services.plan_generator import PlanGenerator
from services.storage_service import StorageService
from api.auth import get_current_user

router = APIRouter(prefix="/api/plans", tags=["plans"])

class GeneratePlanRequest(BaseModel):
    prompt: str

class GeneratePlanResponse(BaseModel):
    plan_id: str
    title: str
    document_url: str
    content: str

@router.post("/generate", response_model=GeneratePlanResponse)
async def generate_plan(
    request: GeneratePlanRequest,
    user = Depends(get_current_user)
):
    plan_generator = PlanGenerator()
    storage = StorageService()
    
    # Generate plan document using LLM
    plan_id = str(uuid4())
    result = await plan_generator.generate(request.prompt)
    
    # Upload to Supabase Storage
    file_path = storage.upload_plan_document(
        user_id=str(user.id),
        plan_id=plan_id,
        content=result["content"]
    )
    
    # Get signed URL for access
    document_url = storage.get_signed_url(file_path)
    
    return GeneratePlanResponse(
        plan_id=plan_id,
        title=result["title"],
        document_url=document_url,
        content=result["content"]
    )
```

#### `services/storage_service.py`

```python
from db.supabase import get_supabase_client

BUCKET_NAME = "plan-documents"

class StorageService:
    def __init__(self):
        self.client = get_supabase_client()
    
    def upload_plan_document(self, user_id: str, plan_id: str, content: str) -> str:
        """Upload plan document to Supabase Storage, return file path."""
        file_path = f"{user_id}/{plan_id}.txt"
        file_bytes = content.encode('utf-8')
        
        self.client.storage.from_(BUCKET_NAME).upload(
            path=file_path,
            file=file_bytes,
            file_options={"content-type": "text/plain", "upsert": "true"}
        )
        
        return file_path
    
    def get_signed_url(self, file_path: str, expires_in: int = 3600) -> str:
        """Generate signed URL for frontend access."""
        response = self.client.storage.from_(BUCKET_NAME).create_signed_url(
            path=file_path,
            expires_in=expires_in
        )
        
        return response["signedURL"]
    
    def download_plan_document(self, file_path: str) -> str:
        """Download plan document content."""
        response = self.client.storage.from_(BUCKET_NAME).download(file_path)
        return response.decode('utf-8')
```

#### `services/plan_generator.py`

```python
from anthropic import Anthropic
import re

SYSTEM_PROMPT = """You are an AI agent planning assistant. Given a user's request, 
generate a comprehensive plan document for building an AI agent.

The plan should include:
- Agent name and description
- Core capabilities and features
- Input/output specifications
- Data sources needed (if any)
- Success criteria
- Edge cases to handle
- Implementation considerations

Format your response as:
<title>Agent Title Here</title>
<plan>
# Agent Name

## Overview
...

## Core Capabilities
...

## Input/Output Specifications
...

## Data Sources
...

## Success Criteria
...

## Edge Cases
...

## Implementation Notes
...
</plan>
"""

class PlanGenerator:
    def __init__(self):
        self.client = Anthropic()
    
    async def generate(self, prompt: str) -> dict:
        """
        Generate a complete plan document from user prompt.
        Returns: { "title": str, "content": str }
        """
        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        
        return self._parse_response(response.content[0].text)
    
    def _parse_response(self, response: str) -> dict:
        """Parse structured response from LLM."""
        title_match = re.search(r'<title>(.*?)</title>', response, re.DOTALL)
        plan_match = re.search(r'<plan>(.*?)</plan>', response, re.DOTALL)
        
        title = title_match.group(1).strip() if title_match else "Untitled Plan"
        content = plan_match.group(1).strip() if plan_match else response
        
        return {
            "title": title,
            "content": content
        }
```

---

## Frontend Implementation

### Simple Form Component

```tsx
// components/plan/GeneratePlanForm.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function GeneratePlanForm() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    plan_id: string;
    title: string;
    content: string;
    document_url: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/plans/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) throw new Error("Failed to generate plan");

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error("Error generating plan:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Textarea
          placeholder="Describe the agent you want to build..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          className="w-full"
        />
        <Button type="submit" disabled={loading || !prompt.trim()}>
          {loading ? "Generating..." : "Generate Plan"}
        </Button>
      </form>

      {result && (
        <div className="mt-8 space-y-4">
          <h2 className="text-2xl font-bold">{result.title}</h2>
          <div className="prose prose-invert max-w-none">
            <pre className="whitespace-pre-wrap bg-muted p-4 rounded-lg">
              {result.content}
            </pre>
          </div>
          <a
            href={result.document_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            Download Plan Document
          </a>
        </div>
      )}
    </div>
  );
}
```

---

## Integration with Existing App

### Register Router in FastAPI

```python
# core/app.py
from api.plans import router as plans_router

app.include_router(plans_router)
```

### Environment Variables

```bash
# .env
ANTHROPIC_API_KEY=your-key-here
SUPABASE_URL=your-supabase-url
SUPABASE_KEY=your-supabase-key
```

---

## Implementation Checklist

- [ ] Create `plan-documents` bucket in Supabase Storage
- [ ] Set up RLS policies for storage bucket
- [ ] Implement `services/storage_service.py`
- [ ] Implement `services/plan_generator.py`
- [ ] Implement `api/plans.py` endpoint
- [ ] Register router in `core/app.py`
- [ ] Create frontend form component
- [ ] Test end-to-end flow

---

## Future Enhancements (from full plan.md)

Once this minimal version works, consider adding:
- Database table for plan metadata (plans table)
- Conversation/iteration flow with follow-up questions
- Plan versioning in storage
- Real-time updates with Supabase subscriptions
- Plan approval workflow
